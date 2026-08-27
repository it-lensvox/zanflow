import json
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListCreateAPIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.org_config.services import check_permission
from apps.groundtruth.models import Document
from rest_framework_simplejwt.authentication import JWTAuthentication
from apps.organizations.authentication import (
    WorkspaceJWTAuthentication,
    WorkspaceStaticTokenAuthentication,
)
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.db.models import Count, Q, Case, When, Value, BooleanField
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination
from rest_framework import serializers
from apps.users.auth import StaticTokenAuthentication
from apps.organizations.mixins import WorkspaceAPIView, WorkspaceListCreateAPIView
# Ensure this import matches your project structure
from apps.users.models import User
from apps.groundtruth.models import Document
from apps.notification.services import notify_task_created
from .models import Task, TaskComment, TaskAttachment
from .serializers import TaskSerializer, TaskStatusUpdateSerializer, UserManagementSerializer, TaskCommentSerializer
from apps.notification.services import (
    notify_task_created,
    notify_task_status_updated,
    notify_task_comment,
    notify_task_assignees_added
)
class AllUsersListView(WorkspaceAPIView):
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not check_permission(request, "workspace.member:invite"):
            if not request.user.is_manager:
                return Response(
                    {"detail": "You do not have permission to view users."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Get active workspace ID from header
        workspace_id = request.META.get("HTTP_X_WORKSPACE_ID")

        if workspace_id:
            # Return only users who are members of this workspace
            from apps.organizations.models import WorkspaceMembership
            member_user_ids = WorkspaceMembership.objects.filter(
                workspace_id=workspace_id,
                workspace__organization_id=request.user.organization_id,
            ).values_list('user_id', flat=True)
            users = User.objects.filter(id__in=member_user_ids).order_by('username')
        else:
            # Fallback: return all org users if no workspace header
            users = User.objects.all().order_by('username')
            if request.user.organization_id:
                users = users.filter(organization_id=request.user.organization_id)

        serializer = UserManagementSerializer(users, many=True)
        return Response({
            "message": "All users retrieved successfully",
            "users": serializer.data
        }, status=status.HTTP_200_OK)

class TaskListCreateView(WorkspaceAPIView):
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        user = self.request.user

        queryset = Task.objects.all()

        tasks = queryset.filter(
            Q(assigned_to=user) | Q(assigned_by=user)
        ).distinct()
        
        # 1. Filters by project_id
        project_id = request.query_params.get('project_id')
        if project_id:
            tasks = tasks.filter(project__id=project_id)

        # 1b. Filters by status — matches Task.STATUS_CHOICES exactly
        status_param = request.query_params.get('status')
        if status_param:
            valid_statuses = {'pending', 'in_progress', 'completed', 'review', 'deployed', 'deferred', 'backlog'}
            if status_param in valid_statuses:
                tasks = tasks.filter(status=status_param)

        # 1c. Filters by priority — matches Task.PRIORITY_CHOICES exactly
        priority_param = request.query_params.get('priority')
        if priority_param:
            valid_priorities = {'low', 'medium', 'high', 'critical'}
            if priority_param in valid_priorities:
                tasks = tasks.filter(priority=priority_param)

        tasks = tasks.annotate(
            user_has_pinned=Case(
                When(pinned_by=user, then=Value(True)),
                default=Value(False),
                output_field=BooleanField()
            )
        ).order_by('-user_has_pinned', '-updated_at')

        # 2. Checks for disable_pagination=true
        disable_pagination = request.query_params.get('disable_pagination', 'false').lower() == 'true'

        if disable_pagination:
            # RETURN ALL TASKS IN ONE GO
            serializer = TaskSerializer(tasks, many=True, context={'request': request})
            return Response({
                "count": tasks.count(),
                "results": serializer.data
            }, status=status.HTTP_200_OK)

        # 3. IF disable_pagination is NOT true, do normal pagination
        paginator = PageNumberPagination()
        paginated_tasks = paginator.paginate_queryset(tasks, request, view=self)
        serializer = TaskSerializer(paginated_tasks, many=True, context={'request': request})
        
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        # ── Permission check — reads from S3/Redis org config ─────────────
        # Replaces the old hardcoded role check (is_manager, is_developer etc.)
        # Now controlled dynamically from Central admin panel.
        # Fallback: if org config not found → checks legacy role (backward compat)
        if not check_permission(request, "task:create"):
            # Legacy fallback — allows admin/manager/developer even without config
            is_legacy_authorized = (
                request.user.is_manager or
                request.user.is_superuser or
                request.user.role == User.Role.DEVELOPER
            )
            if not is_legacy_authorized:
                return Response(
                    {"detail": "You do not have permission to create tasks."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = TaskSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            task = serializer.save(assigned_by=request.user)
            
            # TRIGGER NOTIFICATION: Task Created
            notify_task_created(task=task, actor=request.user)
            
            return Response({
                "message": "Task created successfully",
                "task": serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskRetrieveUpdateView(WorkspaceAPIView):
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)

        # task:read — check org config first, fallback to legacy
        if not check_permission(request, "task:read"):
            is_authorized = (
                request.user.is_manager or
                request.user.is_superuser or
                task.assigned_to.filter(id=request.user.id).exists()
            )
            if not is_authorized:
                return Response(
                    {"detail": "You do not have permission to view this task."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = TaskSerializer(task, context={'request': request})
        return Response({
            "message": "Task retrieved successfully",
            "task": serializer.data
        }, status=status.HTTP_200_OK)

    def patch(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)
        old_status = task.status
        
        # 1. Capture existing assignees BEFORE the update
        old_assignee_ids = set(task.assigned_to.values_list('id', flat=True))

        # task:update_any → full edit, task:update_own → own tasks only
        can_update_any = check_permission(request, "task:update_any")
        can_update_own = check_permission(request, "task:update_own")
        has_full_edit_access = (
            can_update_any or
            request.user.is_manager or
            request.user.is_superuser or
            (request.user.role == User.Role.DEVELOPER and task.assigned_by == request.user)
        )

        if has_full_edit_access:
            serializer = TaskSerializer(task, data=request.data, partial=True, context={'request': request})
        else:
            # If not full access, they must be assigned to it to change the status
            if not task.assigned_to.filter(id=request.user.id).exists():
                return Response(
                    {"detail": "You do not have permission to update this task."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Allow status updates only
            if len(request.data) > 1 or ('status' not in request.data and len(request.data) == 1):
                return Response(
                    {"detail": "You can only update the 'status' field."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            serializer = TaskStatusUpdateSerializer(task, data=request.data, partial=True)

        if serializer.is_valid():
            # Save the serializer and capture the updated task instance
            new_status_val = serializer.validated_data.get('status', old_status)
            
            # Add request.user to 'status_updated_by' if status is actually modified
            if new_status_val != old_status:
                updated_task = serializer.save(status_updated_by=request.user)
            else:
                updated_task = serializer.save()
            new_status = updated_task.status
            if old_status != new_status:
                notify_task_status_updated(
                    task=updated_task,
                    actor=request.user,
                    old_status=old_status,
                    new_status=new_status
                )
                
            # ================================================================
            # TRIGGER NOTIFICATION: New Assignees Added
            # ================================================================
            new_assignee_ids = set(updated_task.assigned_to.values_list('id', flat=True))
            added_assignee_ids = new_assignee_ids - old_assignee_ids
            if added_assignee_ids:
                new_users = User.objects.filter(id__in=added_assignee_ids)
                notify_task_assignees_added(
                    task=updated_task,
                    new_assignees=list(new_users),
                    actor=request.user
                )
            
            return Response({
                "message": "Task updated successfully",
                "task": TaskSerializer(updated_task, context={'request': request}).data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    # ---> PASTE THIS HERE <---
    def delete(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)

        # task:delete — check org config first, fallback to legacy
        if not check_permission(request, "task:delete"):
            is_authorized = (
                request.user.is_manager or
                request.user.is_superuser or
                task.assigned_by == request.user
            )
            if not is_authorized:
                return Response(
                    {"detail": "You do not have permission to delete this task."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        task.delete()
        
        return Response(
            {"message": "Task deleted successfully"}, 
            status=status.HTTP_204_NO_CONTENT
        )
    # --------------------------
class UserPerformanceView(WorkspaceAPIView):
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)

        user_serializer = UserManagementSerializer(user)

        tasks = Task.objects.filter(
            Q(assigned_to=user) | Q(assigned_by=user)
        ).distinct()

        total_tasks = tasks.count()
        completed_tasks = tasks.filter(status='completed').count()
        in_progress_tasks = tasks.filter(status='in_progress').count()
        pending_tasks = tasks.filter(status='pending').count()
        overdue_tasks = tasks.filter(status='overdue').count()

        metrics = {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "in_progress_tasks": in_progress_tasks,
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks,
            "completion_rate": round((completed_tasks / total_tasks * 100), 2) if total_tasks > 0 else 0,
        }

        task_serializer = TaskSerializer(tasks, many=True, context={'request': request})

        return Response({
            "user": user_serializer.data,
            "performance_metrics": metrics,
            "task_history": task_serializer.data
        }, status=status.HTTP_200_OK)
class TaskCommentListCreateView(WorkspaceListCreateAPIView):
    serializer_class = TaskCommentSerializer
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Get comments for a specific task.
        """
        task_id = self.kwargs['task_id']
        return TaskComment.objects.filter(task_id=task_id).order_by('-created_at')

    def perform_create(self, serializer):
        """
        Save the comment with the current user and the specific task.
        """
        task_id = self.kwargs['task_id']
        task = get_object_or_404(Task, id=task_id)

        # task:comment — check org config first, fallback to legacy
        is_assigned = task.assigned_to.filter(id=self.request.user.id).exists()
        if not check_permission(self.request, "task:comment"):
            if not (self.request.user.is_manager or self.request.user.is_superuser or is_assigned):
                raise serializers.ValidationError("You do not have permission to comment on this task.")
        comment = serializer.save(user=self.request.user, task=task)
        
        # ====================================================================
        # TRIGGER NOTIFICATION: New Comment
        # ====================================================================
        notify_task_comment(task=task, comment=comment, actor=self.request.user)
        # ====================================================================
        serializer.save(user=self.request.user, task=task)

class TaskAttachmentDeleteView(WorkspaceAPIView):
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        # 1. Get the document using the new model
        attachment = get_object_or_404(Document, id=pk)
        task = attachment.task

        # document:delete — check org config first, fallback to legacy
        if not check_permission(request, "document:delete"):
            is_authorized = (
                request.user.is_manager or
                request.user.is_superuser or
                (task and task.assigned_to.filter(id=request.user.id).exists()) or
                (task and task.assigned_by == request.user)
            )
            if not is_authorized:
                return Response(
                    {"detail": "You do not have permission to delete this file."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # 3. Delete the file (Updates: Now uses source_file instead of file)
        if attachment.source_file:
            attachment.source_file.delete() # Deletes from S3
            
        attachment.delete() # Deletes from DB

        return Response(
            {"message": "Attachment deleted successfully"}, 
            status=status.HTTP_204_NO_CONTENT
        )

class TaskPinToggleView(WorkspaceAPIView):
    """
    POST: Toggles the pin status of a task for the requesting user.
    """
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)

        # task:read level — can pin if you can read
        if not check_permission(request, "task:read"):
            is_authorized = (
                request.user.is_manager or
                request.user.is_superuser or
                task.assigned_to.filter(id=request.user.id).exists() or
                task.assigned_by == request.user
            )
            if not is_authorized:
                return Response(
                    {"detail": "You do not have permission to pin this task."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Toggle Logic
        if task.pinned_by.filter(id=request.user.id).exists():
            task.pinned_by.remove(request.user)
            is_pinned = False
            message = "Task unpinned successfully"
        else:
            task.pinned_by.add(request.user)
            is_pinned = True
            message = "Task pinned successfully"

        return Response({
            "message": message,
            "is_pinned": is_pinned
        }, status=status.HTTP_200_OK)
    
def convert_description_to_html(text: str) -> str:
    """
    Convert plain-text task descriptions (from bulk JSON imports) to basic HTML
    so Tiptap renders them correctly in both view and edit mode.

    Rules (applied per line after splitting on \n):
      • Lines starting with '-' or '•'  →  <ul><li> … </li></ul>
      • Lines starting with '1.', '2.', etc.  →  <ol><li> … </li></ol>
      • Everything else  →  <p> … </p>

    Consecutive list items of the same type are merged into a single list tag.
    Empty / whitespace-only lines are skipped.
    """
    import re

    if not text or not text.strip():
        return text  # Nothing to convert; leave the field as-is.

    lines = text.split('\n')
    html_parts = []
    ul_buffer = []
    ol_buffer = []

    def flush_ul():
        if ul_buffer:
            items = ''.join(f'<li>{item}</li>' for item in ul_buffer)
            html_parts.append(f'<ul>{items}</ul>')
            ul_buffer.clear()

    def flush_ol():
        if ol_buffer:
            items = ''.join(f'<li>{item}</li>' for item in ol_buffer)
            html_parts.append(f'<ol>{items}</ol>')
            ol_buffer.clear()

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue  # skip blank lines

        if stripped.startswith('-') or stripped.startswith('•'):
            # Bullet list item — flush any open ordered list first
            flush_ol()
            content = stripped.lstrip('-•').strip()
            ul_buffer.append(content)

        elif re.match(r'^\d+\.', stripped):
            # Numbered list item — flush any open unordered list first
            flush_ul()
            content = re.sub(r'^\d+\.\s*', '', stripped)
            ol_buffer.append(content)

        else:
            # Plain paragraph — flush any open lists first
            flush_ul()
            flush_ol()
            html_parts.append(f'<p>{stripped}</p>')

    # Flush any remaining list buffers
    flush_ul()
    flush_ol()

    return ''.join(html_parts)


class TaskBulkUploadView(WorkspaceAPIView):
    authentication_classes = [WorkspaceStaticTokenAuthentication, WorkspaceJWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, project_id):
        # task:create — check org config first, fallback to legacy
        if not check_permission(request, "task:create"):
            if not (request.user.is_manager or request.user.is_superuser):
                return Response(
                    {"detail": "You do not have permission to bulk create tasks."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # 2. Get the uploaded file
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No JSON file provided in the 'file' field."}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Read and parse the JSON
        try:
            file_content = file_obj.read().decode('utf-8')
            json_data = json.loads(file_content)
        except json.JSONDecodeError:
            return Response({"error": "Invalid JSON format in the uploaded file."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Error reading file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        tasks_data = json_data.get('tasks', [])
        if not tasks_data:
            return Response({"error": "No 'tasks' array found in the JSON file."}, status=status.HTTP_400_BAD_REQUEST)

        created_tasks = []
        errors = []

        # 4. Process within an Atomic Transaction
        try:
            with transaction.atomic():
                for index, task_data in enumerate(tasks_data):
                    # Inject the project ID from the URL into the payload
                    task_data['project'] = project_id

                    # Extract assignee emails if provided in JSON to map to User IDs
                    assignee_emails = task_data.pop('assignee_emails', [])

                    # Convert plain-text description to HTML for Tiptap compatibility.
                    # Only applied here (bulk import); regular create/update endpoints
                    # already receive HTML from the frontend editor.
                    if task_data.get('description'):
                        task_data['description'] = convert_description_to_html(task_data['description'])

                    # Pass data to your existing serializer
                    serializer = TaskSerializer(data=task_data, context={'request': request})
                    
                    if serializer.is_valid():
                        # Save the task
                        task = serializer.save(assigned_by=request.user)
                        
                        # ✅ THE FIX: Use case-insensitive email lookup via __iexact
                        if assignee_emails:
                            # Strip whitespace from each email
                            cleaned_emails = [email.strip() for email in assignee_emails if email]

                            # Build a Q filter with __iexact per email so PostgreSQL
                            # ignores case on BOTH sides — works regardless of how the
                            # address was stored in the DB (e.g. "HarshitJindal@lensvox.com"
                            # vs "harshitjindal@lensvox.com").
                            email_query = Q()
                            for email_stripped in cleaned_emails:
                                email_query |= Q(email__iexact=email_stripped)

                            users = User.objects.filter(email_query)
                            task.assigned_to.set(users)
                            
                        created_tasks.append(task)
                    else:
                        # Record the error and force a rollback
                        errors.append({
                            "row": index + 1,
                            "heading": task_data.get('heading', 'Unknown'),
                            "errors": serializer.errors
                        })
                        raise Exception("Validation Error") 
                        
        except Exception as e:
            if errors:
                return Response({
                    "message": "Bulk upload failed. No tasks were created.",
                    "details": errors
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 5. Trigger Notifications (Optional: You might want to batch this later if uploads are huge)
        for task in created_tasks:
            notify_task_created(task=task, actor=request.user)

        return Response({
            "message": f"{len(created_tasks)} tasks successfully created.",
        }, status=status.HTTP_201_CREATED)