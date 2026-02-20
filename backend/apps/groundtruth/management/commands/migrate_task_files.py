import os
import re
from django.core.management.base import BaseCommand
from apps.tasksite.models import TaskAttachment
from apps.groundtruth.models import Document

class Command(BaseCommand):
    help = 'Migrates old TaskAttachments into the unified Document table'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Starting file migration...'))
        
        attachments = TaskAttachment.objects.all()
        success_count = 0
        skip_count = 0

        for att in attachments:
            # 1. Skip if the task has no project
            if not getattr(att.task, 'project', None):
                self.stdout.write(self.style.ERROR(f"Skipping Attachment {att.id} - Task has no project"))
                skip_count += 1
                continue

            # 2. Clean the filename
            raw_name = os.path.basename(att.file.name)
            clean_name = re.sub(r'_[a-zA-Z0-9]{7}(\.[^.]+)$', r'\1', raw_name)

            # 3. Create the Document if it doesn't already exist
            if not Document.objects.filter(source_file=att.file.name).exists():
                Document.objects.create(
                    project=att.task.project,
                    task=att.task,
                    name=clean_name,
                    source_file=att.file, # Points safely to existing S3 link
                    status='draft',
                    created_by=att.task.assigned_by
                )
                success_count += 1
                self.stdout.write(self.style.SUCCESS(f"Migrated: {clean_name}"))
            else:
                skip_count += 1

        self.stdout.write(self.style.SUCCESS(f'✅ Migration Complete!'))
        self.stdout.write(self.style.SUCCESS(f'Successfully moved: {success_count}'))
        self.stdout.write(self.style.WARNING(f'Skipped (already exist or no project): {skip_count}'))