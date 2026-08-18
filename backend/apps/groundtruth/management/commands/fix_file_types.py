import os
from django.core.management.base import BaseCommand
from apps.groundtruth.models import Document

class Command(BaseCommand):
    help = "Backfills and corrects the file_type for all existing documents based on their file extensions."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run the script and print what would happen without saving any changes to the database.',
        )

    def handle(self, *args, **options):
        is_dry_run = options['dry_run']
        documents = Document.objects.all()
        updated_count = 0
        skipped_count = 0
        
        if is_dry_run:
            self.stdout.write(self.style.NOTICE("--- DRY RUN MODE ACTIVATED: NO CHANGES WILL BE SAVED ---"))
        else:
            self.stdout.write(self.style.WARNING("Starting document file_type correction..."))

        for doc in documents:
            filename = ""
            if doc.source_file and doc.source_file.name:
                filename = doc.source_file.name
            elif doc.name:
                filename = doc.name
                
            ext = os.path.splitext(filename)[1].lower()
            
            if ext == '.pdf':
                correct_type = 'pdf'
            elif ext in ['.png', '.jpg', '.jpeg']:
                correct_type = 'image'
            elif ext == '.json':
                correct_type = 'json'
            elif ext in ['.txt', '.md', '.csv']:
                correct_type = 'text'
            else:
                correct_type = 'other'
                
            if doc.file_type != correct_type:
                if not is_dry_run:
                    doc.file_type = correct_type
                    doc.save(update_fields=['file_type'])
                
                updated_count += 1
                prefix = "[DRY RUN] Would fix:" if is_dry_run else "  -> Fixed:"
                self.stdout.write(f"{prefix} {filename} (now '{correct_type}')")
            else:
                skipped_count += 1
                
        self.stdout.write(self.style.SUCCESS("========================================="))
        if is_dry_run:
            self.stdout.write(self.style.SUCCESS(f"[DRY RUN] Would update: {updated_count} documents"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Correction Complete! Updated: {updated_count} documents"))
            
        self.stdout.write(self.style.SUCCESS(f"Skipped (Already Correct): {skipped_count} documents"))
        self.stdout.write(self.style.SUCCESS("========================================="))