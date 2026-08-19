# apps/tasksite/urls.py
from django.urls import path
from .views import (
    TaskListCreateView,
    TaskRetrieveUpdateView,
    AllUsersListView,
    UserPerformanceView,
    TaskCommentListCreateView,
    TaskAttachmentDeleteView,
    TaskPinToggleView,
    TaskBulkUploadView,
)
# ✅ NEW: child task + AI suggestion views
from .child_task_views import (
    AISuggestChildTasksView,
    ChildTaskListView,
    BatchCreateChildTasksView,
)

urlpatterns = [
    # ── Existing routes (unchanged) ────────────────────────────────────────
    path('', TaskListCreateView.as_view(), name='task_list_create'),
    path('project/<int:project_id>/bulk-upload/', TaskBulkUploadView.as_view(), name='task_bulk_upload'),
    path('<int:task_id>/', TaskRetrieveUpdateView.as_view(), name='task_retrieve_update'),
    path('all-users/', AllUsersListView.as_view(), name='all_users_list'),
    path('<int:task_id>/comments/', TaskCommentListCreateView.as_view(), name='task_comments'),
    path('performance/<int:user_id>/', UserPerformanceView.as_view(), name='user_performance'),
    path('attachments/<uuid:pk>/', TaskAttachmentDeleteView.as_view(), name='delete_task_attachment'),
    path('<int:task_id>/pin/', TaskPinToggleView.as_view(), name='task_pin_toggle'),

    # ── NEW: AI child task suggestions ────────────────────────────────────
    path('<int:task_id>/ai-suggest-children/', AISuggestChildTasksView.as_view(), name='task_ai_suggest_children'),

    # ── NEW: Child task list ───────────────────────────────────────────────
    path('<int:task_id>/children/', ChildTaskListView.as_view(), name='task_children_list'),

    # ── NEW: Batch create child tasks ─────────────────────────────────────
    path('<int:task_id>/children/batch/', BatchCreateChildTasksView.as_view(), name='task_children_batch_create'),
]