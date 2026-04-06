import os
from django.db import models
from django.conf import settings
from django.db.models.signals import post_delete
from django.dispatch import receiver
from apps.projects.models import Project
class Folder(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='note_folders')
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('user', 'name') # Prevents duplicate folder names for a single user

    def __str__(self):
        return self.name

class Note(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notes')
    folder = models.ForeignKey(Folder, on_delete=models.CASCADE, null=True, blank=True, related_name='notes')
    title = models.CharField(max_length=255, blank=True)
    content = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='project_notes')
    class Meta:
        ordering = ['-updated_at'] # Shows most recently edited notes first

    def __str__(self):
        return self.title or "Untitled Note"
    
class NoteAttachment(models.Model):
    # Link the attachment to a specific note
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='attachments')
    
    # Django will automatically upload this to your S3 bucket under this path structure
    file = models.FileField(upload_to='quicknotes/attachments/%Y/%m/%d/')
    
    # Store the original filename for display purposes
    filename = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        # Automatically extract and save the original filename before saving to DB/S3
        if self.file and not self.filename:
            self.filename = os.path.basename(self.file.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.filename
    
@receiver(post_delete, sender=NoteAttachment)
def delete_s3_file_on_model_delete(sender, instance, **kwargs):
        """
        Listens for a delete event on the NoteAttachment model. 
        When the database row is deleted, it reaches into S3 and deletes the physical file too.
        """
        if instance.file:
            # Pass save=False so Django doesn't try to update the database row we are actively deleting
            instance.file.delete(save=False)