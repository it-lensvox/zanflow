from django.urls import path
from .views import TaskListCreateView, TaskRetrieveUpdateView, AllUsersListView, UserPerformanceView, TaskCommentListCreateView, TaskAttachmentDeleteView, ProjectAllDocumentsView

urlpatterns = [
    path('', TaskListCreateView.as_view(), name='task_list_create'),
    path('<int:task_id>/', TaskRetrieveUpdateView.as_view(), name='task_retrieve_update'),
    path('all-users/', AllUsersListView.as_view(), name='all_users_list'),
    path('<int:task_id>/comments/', TaskCommentListCreateView.as_view(), name='task_comments'),
    # --- New Performance Endpoint ---
    path('performance/<int:user_id>/', UserPerformanceView.as_view(), name='user_performance'),
    path('attachments/<int:pk>/', TaskAttachmentDeleteView.as_view(), name='delete_task_attachment'),
    path('projects/<int:project_id>/all-documents/', ProjectAllDocumentsView.as_view(), name='project_all_documents'),
]