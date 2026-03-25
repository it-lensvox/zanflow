# models.py
from django.db import models
from apps.users.models import User
from apps.projects.models import Project, Label
from apps.organizations.models import TenantModel


class Task(TenantModel):
    """
    Task model — now tenant-scoped via TenantModel.
    """

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('review', 'Review'),
        ('deployed', 'Deployed'),
        ('deferred', 'Deferred'),
        ('backlog', 'Backlog')
    )

    PRIORITY_CHOICES = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    )

    heading = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    duration_time = models.DurationField(null=True, blank=True)
    
    priority = models.CharField(
        max_length=20, 
        choices=PRIORITY_CHOICES, 
        default='medium'
    )
    labels = models.ManyToManyField(
        Label, 
        blank=True, 
        related_name='tasks'
    )

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='tasks'
    )

    assigned_to = models.ManyToManyField(User, related_name='assigned_tasks', blank=True)
    assigned_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='created_tasks'
    )
    pinned_by = models.ManyToManyField(User, related_name='pinned_tasks', blank=True)
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='pending'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.heading


class TaskLink(models.Model):
    """Not directly tenant-scoped — implicitly scoped via Task FK."""
    task = models.ForeignKey(
        Task, 
        related_name='links',
        on_delete=models.CASCADE
    )
    url = models.URLField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.url


class TaskAttachment(models.Model):
    """Not directly tenant-scoped — implicitly scoped via Task FK."""
    task = models.ForeignKey(
        Task, 
        related_name='attachments',
        on_delete=models.CASCADE
    )
    file = models.FileField(upload_to='task_documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"File for task {self.task_id}"


class TaskComment(models.Model):
    """Not directly tenant-scoped — implicitly scoped via Task FK."""
    task = models.ForeignKey(
        Task, 
        related_name='comments', 
        on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        User, 
        related_name='task_comments', 
        on_delete=models.CASCADE
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.user.username} on {self.task.heading}"
