"""
Management command to generate PDF previews for existing documents.
Usage: python manage.py generate_previews
"""
from django.core.management.base import BaseCommand
from apps.groundtruth.models import Document
from apps.groundtruth.services import generate_document_preview, needs_pdf_conversion


class Command(BaseCommand):
    help = 'Generate PDF previews for existing documents that need conversion'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Maximum number of documents to process'
        )
        parser.add_argument(
            '--retry-failed',
            action='store_true',
            help='Also retry documents where preview generation previously failed'
        )
    
    def handle(self, *args, **options):
        # Find documents that need preview generation
        statuses = ['pending']
        if options['retry_failed']:
            statuses.append('failed')
        
        docs = Document.objects.filter(
            preview_status__in=statuses
        ).exclude(source_file='')
        
        if options['limit']:
            docs = docs[:options['limit']]
        
        total = docs.count()
        success = 0
        failed = 0
        skipped = 0
        
        self.stdout.write(f"Processing {total} documents...")
        
        for i, doc in enumerate(docs, 1):
            if not doc.source_file or not needs_pdf_conversion(doc.source_file.name):
                skipped += 1
                continue
            
            self.stdout.write(f"[{i}/{total}] Converting: {doc.name}")
            
            try:
                if generate_document_preview(doc):
                    success += 1
                    self.stdout.write(self.style.SUCCESS(f"  ✓ Success"))
                else:
                    failed += 1
                    self.stdout.write(self.style.ERROR(f"  ✗ Failed"))
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f"  ✗ Exception: {e}"))
        
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. Success: {success}, Failed: {failed}, Skipped: {skipped}"
        ))