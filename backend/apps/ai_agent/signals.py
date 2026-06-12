"""
Signals for the ai_agent app.

Currently empty — this file exists so apps.py can import it without error.

Future use: connect post_save signals on Task, Note, etc. to auto-generate
embeddings when records are created/updated.

Example (uncomment when you add pgvector support):

from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender="tasksite.Task")
def embed_task_on_save(sender, instance, created, **kwargs):
    from apps.ai_agent.embeddings import embed_task
    embed_task.delay(instance.id)   # Celery task
"""