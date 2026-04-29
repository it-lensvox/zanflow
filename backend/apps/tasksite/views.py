import json
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListCreateAPIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.groundtruth.models import Document
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.db.models import Count, Q, Case, When, Value, BooleanField
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination
from rest_framework import serializers
from apps.users.auth import StaticTokenAuthentication
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
class AllUsersListView(APIView):
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_manager:
             return Response(
                {"detail": "You do not have permission to view users."},
                status=status.HTTP_403_FORBIDDEN
            )

        users = User.objects.all().order_by('username')
        # Scope to current user's organization
        if request.user.organization_id:
            users = users.filter(organization_id=request.user.organization_id)
        serializer = UserManagementSerializer(users, many=True)
        return Response({
            "message": "All users retrieved successfully",
            "users": serializer.data
        }, status=status.HTTP_200_OK)

class TaskListCreateView(APIView):
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
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
        # Allow Admin to create tasks too
        if not (request.user.is_manager or request.user.is_superuser):
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


class TaskRetrieveUpdateView(APIView):
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)

        # --- UPDATE THIS CONDITION ---
        # Allow if Manager OR Superuser OR if assigned to the user
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
        
        # ================================================================
        # 1. Capture existing assignees BEFORE the update
        # ================================================================
        old_assignee_ids = set(task.assigned_to.values_list('id', flat=True))

        if request.user.is_manager:
            serializer = TaskSerializer(task, data=request.data, partial=True, context={'request': request})
        else:
            if not task.assigned_to.filter(id=request.user.id).exists():
                return Response(
                    {"detail": "You do not have permission to update this task."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Allow status updates
            if len(request.data) > 1 or ('status' in request.data and len(request.data) == 1):
                pass
            else:
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
                # Fetch only the users who were just added
                added_users = list(updated_task.assigned_to.filter(id__in=added_assignee_ids))
                notify_task_assignees_added(
                    task=updated_task,
                    actor=request.user,
                    new_assignees=added_users
                )
            # ================================================================

            return Response({
                "message": "Task updated successfully",
                "task": serializer.data
            }, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, task_id): 
        task = get_object_or_404(Task, id=task_id)

        if not request.user.is_manager:
             return Response(
                {"detail": "You do not have permission to delete tasks."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        task.delete()
        return Response({
            "message": "Task deleted successfully"
        }, status=status.HTTP_204_NO_CONTENT)
    def delete(self, request, task_id): 
        task = get_object_or_404(Task, id=task_id)

        # STRICT CHECK: Only the user who created the task (assigned_by) can delete it.
        # Note: If you want Superusers to also be able to delete, use:
        # if task.assigned_by != request.user and not request.user.is_superuser:
        if task.assigned_by != request.user:
             return Response(
                {"detail": "You do not have permission to delete this task. Only the creator can delete it."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        task.delete()
        return Response({
            "message": "Task deleted successfully"
        }, status=status.HTTP_204_NO_CONTENT)

# --- CORRECTED PERFORMANCE VIEW ---
class UserPerformanceView(APIView):
    """
    GET: Retrieve detailed performance metrics for a specific user.
    Only accessible by Admins and Managers.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        # 1. Permission Check
        if not request.user.is_manager:
            return Response(
                {"detail": "You do not have permission to view team performance."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # 2. Get the target user
        target_user = get_object_or_404(User, id=user_id)
        
        # 3. Get all tasks assigned to this user
        user_tasks = Task.objects.filter(assigned_to=target_user)
        
        # 4. Calculate Metrics
        total_tasks = user_tasks.count()
        
        # FIX: Used '__iexact' to match status regardless of case (pending vs PENDING)
        metrics = {
            "total": total_tasks,
            "pending": user_tasks.filter(status__iexact='pending').count(),
            "in_progress": user_tasks.filter(status__iexact='in_progress').count(),
            "completed": user_tasks.filter(status__iexact='completed').count(),
            "deployed": user_tasks.filter(status__iexact='deployed').count(),
            "deferred": user_tasks.filter(status__iexact='deferred').count(),
            "Backlog": user_tasks.filter(status__iexact='Backlog').count(),
        }
        
        # 5. Serialize the task list for detailed history
        task_serializer = TaskSerializer(user_tasks, many=True)
        user_serializer = UserManagementSerializer(target_user)

        return Response({
            "user": user_serializer.data,
            "performance_metrics": metrics,
            "task_history": task_serializer.data
        }, status=status.HTTP_200_OK)
class TaskCommentListCreateView(ListCreateAPIView):
    serializer_class = TaskCommentSerializer
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
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

        # --- Security Check ---
        # Only allow comments if user is Manager/Admin OR is assigned to the task
        is_assigned = task.assigned_to.filter(id=self.request.user.id).exists()
        if not (self.request.user.is_manager or self.request.user.is_superuser or is_assigned):
            raise serializers.ValidationError("You do not have permission to comment on this task.")
        comment = serializer.save(user=self.request.user, task=task)
        
        # ====================================================================
        # TRIGGER NOTIFICATION: New Comment
        # ====================================================================
        notify_task_comment(task=task, comment=comment, actor=self.request.user)
        # ====================================================================
        serializer.save(user=self.request.user, task=task)

class TaskAttachmentDeleteView(APIView):
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        # 1. Get the document using the new model
        attachment = get_object_or_404(Document, id=pk)
        task = attachment.task

        # 2. Permission Check
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

class TaskPinToggleView(APIView):
    """
    POST: Toggles the pin status of a task for the requesting user.
    """
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)

        # Ensure the user has access to this task
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
    
class TaskBulkUploadView(APIView):
    authentication_classes = [StaticTokenAuthentication, JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, project_id):
        # 1. Permission check (Only managers/superusers)
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

                    # Pass data to your existing serializer
                    serializer = TaskSerializer(data=task_data, context={'request': request})
                    
                    if serializer.is_valid():
                        # Save the task
                        task = serializer.save(assigned_by=request.user)
                        
                        # Map emails to user objects and assign them
                        if assignee_emails:
                            users = User.objects.filter(email__in=assignee_emails)
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