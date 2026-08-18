# apps/tasksite/child_task_views.py
"""
New views for AI-Suggested Child Tasks feature.

Endpoints added:
  POST  /api/v1/tasksite/<task_id>/ai-suggest-children/
  GET   /api/v1/tasksite/<task_id>/children/
  POST  /api/v1/tasksite/<task_id>/children/batch/
"""
import json
import logging

import boto3
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from apps.organizations.authentication import (
    WorkspaceJWTAuthentication,
    WorkspaceStaticTokenAuthentication,
)

from apps.organizations.mixins import WorkspaceAPIView
from apps.users.auth import StaticTokenAuthentication

from .models import Task

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _call_nova(prompt: str) -> str:
    """
    Call Amazon Nova Lite via AWS Bedrock and return the raw text response.

    Model ID is read from settings.BEDROCK_MODEL_ID.
    Falls back to 'amazon.nova-lite-v1:0' if the env var is not set.
    """
    model_id = getattr(settings, 'BEDROCK_MODEL_ID', None) or 'amazon.nova-lite-v1:0'

    client = boto3.client(
        'bedrock-runtime',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=getattr(settings, 'AWS_REGION', 'us-east-1'),
    )

    body = {
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        "inferenceConfig": {
            "maxTokens": 1024,
            "temperature": 0.4,
        },
    }

    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps(body),
        contentType='application/json',
        accept='application/json',
    )

    result = json.loads(response['body'].read())
    # Nova response shape: output.message.content[0].text
    return result['output']['message']['content'][0]['text']


def _build_suggestion_prompt(
    title: str,
    description: str,
    project_name: str,
    task_type: str,
    existing_child_tasks: list,
    suggestion_count: int,
    feature_type: str,
) -> str:
    existing_str = (
        ', '.join(f'"{t}"' for t in existing_child_tasks)
        if existing_child_tasks
        else 'none'
    )

    if feature_type == 'child_tasks':
        return (
            f'You are a project management AI assistant.\n'
            f'Parent task: "{title}"\n'
            f'Description: {description or "N/A"}\n'
            f'Project: {project_name or "N/A"}\n'
            f'Task type: {task_type or "N/A"}\n'
            f'Existing child tasks (do NOT duplicate these): [{existing_str}]\n\n'
            f'Generate exactly {suggestion_count} actionable child tasks that together complete '
            f'the parent task. Each suggestion must have a "title" (string) and a "priority" '
            f'("low", "medium", "high", or "critical").\n'
            f'Return ONLY a valid JSON array — no commentary, no markdown fences.\n'
            f'Each object must have "title", "priority", and "status" fields. '
            f'Always set "status" to "pending" since these are new suggested tasks.\n'
            f'Example: [{{"title": "Write unit tests", "priority": "low", "status": "pending"}}]'
        )

    # Future feature_types (checklist, acceptance_criteria, etc.) can be added here.
    raise ValueError(f'Unsupported feature_type: {feature_type}')


# ---------------------------------------------------------------------------
# View 1 — AI Suggest Children
# ---------------------------------------------------------------------------

class AISuggestChildTasksView(WorkspaceAPIView):
    """
    POST /api/v1/tasksite/<task_id>/ai-suggest-children/

    Calls Amazon Nova via Bedrock and returns structured child-task suggestions.

    Supports a future `feature_type` field so the same endpoint can power
    AI-generated checklists, acceptance criteria, estimates, etc.
    """
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)

        # ── Auth: must have read access to this task ──────────────────────
        is_authorized = (
            request.user.is_manager
            or request.user.is_superuser
            or task.assigned_to.filter(id=request.user.id).exists()
            or task.assigned_by == request.user
        )
        if not is_authorized:
            return Response(
                {'detail': 'You do not have permission to access this task.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data

        # ── Input ─────────────────────────────────────────────────────────
        title = data.get('title') or task.heading
        description = data.get('description') or task.description or ''
        project_name = data.get('project_name') or (
            task.project.name if task.project else ''
        )
        task_type = data.get('task_type', '')
        existing_child_tasks = data.get('existing_child_tasks', [])
        suggestion_count = int(data.get('suggestion_count', 6))
        feature_type = data.get('feature_type', 'child_tasks')   # future-proof

        # ── Build prompt & call Nova ───────────────────────────────────────
        try:
            prompt = _build_suggestion_prompt(
                title=title,
                description=description,
                project_name=project_name,
                task_type=task_type,
                existing_child_tasks=existing_child_tasks,
                suggestion_count=suggestion_count,
                feature_type=feature_type,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            raw_text = _call_nova(prompt)
        except Exception as exc:
            logger.error('Nova Bedrock call failed: %s', exc, exc_info=True)
            return Response(
                {'detail': 'AI service is temporarily unavailable. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # ── Parse JSON from model output ───────────────────────────────────
        try:
            # Strip accidental markdown fences the model may still include
            clean = raw_text.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip()
            suggestions = json.loads(clean)
            if not isinstance(suggestions, list):
                raise ValueError('Expected a JSON array')
        except (json.JSONDecodeError, ValueError) as exc:
            logger.error('Failed to parse Nova response: %s | raw: %s', exc, raw_text)
            return Response(
                {'detail': 'AI returned an unexpected format. Please try again.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ✅ Attach parent assignees to each suggestion so frontend can show & edit before creation
        parent_assignee_ids = list(task.assigned_to.values_list('id', flat=True))

        for suggestion in suggestions:
            suggestion['assigned_to'] = parent_assignee_ids

        return Response({'suggestions': suggestions}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# View 2 — List Child Tasks
# ---------------------------------------------------------------------------

class ChildTaskListView(WorkspaceAPIView):
    """
    GET /api/v1/tasksite/<task_id>/children/

    Returns all direct child tasks for the given parent task.
    """
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        parent_task = get_object_or_404(Task, id=task_id)

        is_authorized = (
            request.user.is_manager
            or request.user.is_superuser
            or parent_task.assigned_to.filter(id=request.user.id).exists()
            or parent_task.assigned_by == request.user
        )
        if not is_authorized:
            return Response(
                {'detail': 'You do not have permission to access this task.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        children = parent_task.children.prefetch_related('assigned_to').all()

        children_data = [
            {
                'id': child.id,
                'title': child.heading,
                'priority': child.priority,
                'status': child.status,
                'assigned_to': list(child.assigned_to.values_list('id', flat=True)),
            }
            for child in children
        ]

        return Response(
            {
                'parent_task_id': task_id,
                'children': children_data,
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# View 3 — Batch Create Child Tasks
# ---------------------------------------------------------------------------

class BatchCreateChildTasksView(WorkspaceAPIView):
    """
    POST /api/v1/tasksite/<task_id>/children/batch/

    Creates multiple child tasks in one request.
    Supports partial success: failed tasks are reported without blocking the rest.
    """
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]

    # Valid choices mirrored from Task model
    VALID_STATUSES = {'pending', 'in_progress', 'completed', 'review', 'deployed', 'deferred', 'backlog'}
    VALID_PRIORITIES = {'low', 'medium', 'high', 'critical'}

    def post(self, request, task_id):
        parent_task = get_object_or_404(Task, id=task_id)

        # ── Auth ───────────────────────────────────────────────────────────
        is_authorized = (
            request.user.is_manager
            or request.user.is_superuser
            or parent_task.assigned_to.filter(id=request.user.id).exists()
            or parent_task.assigned_by == request.user
        )
        if not is_authorized:
            return Response(
                {'detail': 'You do not have permission to create tasks under this parent.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        tasks_payload = request.data.get('tasks', [])
        if not tasks_payload or not isinstance(tasks_payload, list):
            return Response(
                {'detail': '"tasks" must be a non-empty list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = []
        failed = []

        for item in tasks_payload:
            title = (item.get('title') or '').strip()
            if not title:
                failed.append({'title': item.get('title', ''), 'error': 'title is required'})
                continue

            priority = item.get('priority', 'medium')
            if priority not in self.VALID_PRIORITIES:
                priority = 'medium'

            task_status = item.get('status', 'pending')
            if task_status not in self.VALID_STATUSES:
                task_status = 'pending'

            # ✅ Use frontend-sent assignees if provided, else fall back to parent's assignees
            custom_assignee_ids = item.get('assigned_to', None)

            try:
                child = Task.objects.create(
                    heading=title,
                    priority=priority,
                    status=task_status,
                    parent_task=parent_task,
                    project=parent_task.project,
                    assigned_by=request.user,
                    **self._tenant_kwargs(parent_task),
                )

                if custom_assignee_ids is not None:
                    # Frontend explicitly sent assignees (can be edited list or empty)
                    from apps.users.models import User as UserModel
                    assignees = UserModel.objects.filter(id__in=custom_assignee_ids)
                    child.assigned_to.set(assignees)
                else:
                    # Default: inherit from parent
                    parent_assignees = parent_task.assigned_to.all()
                    if parent_assignees.exists():
                        child.assigned_to.set(parent_assignees)

                created.append({
                    'id': child.id,
                    'title': child.heading,
                    'priority': child.priority,
                    'status': child.status,
                    'parent_task': parent_task.id,
                    'assigned_to': list(child.assigned_to.values_list('id', flat=True)),  # ✅ returned so frontend can show & edit
                })
            except Exception as exc:
                logger.error('Failed to create child task "%s": %s', title, exc, exc_info=True)
                failed.append({'title': title, 'error': str(exc)})

        return Response(
            {'created': created, 'failed': failed},
            status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST,
        )

    # ── Tenant helper ──────────────────────────────────────────────────────
    @staticmethod
    def _tenant_kwargs(parent_task: Task) -> dict:
        """
        TenantModel stores the workspace/org FK on the model itself.
        Copy those fields from the parent task so children inherit the same tenant scope.
        """
        kwargs = {}
        # Adjust field names below if your TenantModel uses different field names.
        if hasattr(parent_task, 'workspace_id') and parent_task.workspace_id:
            kwargs['workspace_id'] = parent_task.workspace_id
        if hasattr(parent_task, 'organization_id') and parent_task.organization_id:
            kwargs['organization_id'] = parent_task.organization_id
        return kwargs