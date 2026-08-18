"""
Cleanup command to remove PDF previews from Excel files.

Excel files (xlsx, xls, ods) are now rendered using SheetJS in the frontend
instead of being converted to PDF. This command:
  1. Finds Excel documents that previously got converted to PDF
  2. Deletes the PDF preview file from S3
  3. Resets preview_status to 'not_needed'

Run after deployment of the Excel-SheetJS feature.

Usage:
    python manage.py cleanup_excel_pdfs              # Run cleanup
    python manage.py cleanup_excel_pdfs --dry-run    # Preview changes only
"""
from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = 'Remove PDF previews from Excel files (xlsx, xls, ods) — they now use SheetJS'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned without making changes',
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING("=" * 60))
            self.stdout.write(self.style.WARNING("DRY RUN MODE — No changes will be made"))
            self.stdout.write(self.style.WARNING("=" * 60))
        
        total_cleaned = 0
        
        # Cleanup Documents (used by Documents page, Projects, Tasks)
        total_cleaned += self.cleanup_documents(dry_run)
        
        # Cleanup Chat attachments
        total_cleaned += self.cleanup_chat_messages(dry_run)
        
        # Cleanup QuickNote attachments
        total_cleaned += self.cleanup_note_attachments(dry_run)
        
        self.stdout.write("")
        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f"DRY RUN: {total_cleaned} Excel files would be cleaned. "
                f"Run without --dry-run to apply changes."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Done. Cleaned {total_cleaned} Excel files across all surfaces."
            ))
    
    def cleanup_documents(self, dry_run):
        """Cleanup Documents (Documents page, Projects, Tasks)."""
        from apps.groundtruth.models import Document
        
        excel_filter = (
            Q(source_file__iendswith='.xlsx') | 
            Q(source_file__iendswith='.xls') |
            Q(source_file__iendswith='.ods')
        )
        docs = Document.objects.filter(excel_filter, preview_status='ready')
        count = docs.count()
        
        self.stdout.write(f"\n[Documents] Found {count} Excel files with PDF previews")
        
        if count == 0:
            return 0
        
        if dry_run:
            for doc in docs[:5]:  # Show first 5
                self.stdout.write(f"  - {doc.name} ({doc.source_file.name})")
            if count > 5:
                self.stdout.write(f"  ... and {count - 5} more")
            return count
        
        for doc in docs:
            self._cleanup_record(doc, 'preview_pdf')
        
        self.stdout.write(self.style.SUCCESS(f"  ✓ Cleaned {count} documents"))
        return count
    
    def cleanup_chat_messages(self, dry_run):
        """Cleanup chat message attachments."""
        try:
            from apps.chat.models import ChatMessage
        except ImportError:
            self.stdout.write("\n[Chat] Skipped — chat app not available")
            return 0
        
        excel_filter = (
            Q(attachment__iendswith='.xlsx') | 
            Q(attachment__iendswith='.xls') |
            Q(attachment__iendswith='.ods')
        )
        msgs = ChatMessage.objects.filter(excel_filter, preview_status='ready')
        count = msgs.count()
        
        self.stdout.write(f"\n[Chat] Found {count} Excel files with PDF previews")
        
        if count == 0:
            return 0
        
        if dry_run:
            for msg in msgs[:5]:
                self.stdout.write(f"  - {msg.attachment_name or msg.attachment.name}")
            if count > 5:
                self.stdout.write(f"  ... and {count - 5} more")
            return count
        
        for msg in msgs:
            self._cleanup_record(msg, 'preview_pdf')
        
        self.stdout.write(self.style.SUCCESS(f"  ✓ Cleaned {count} chat messages"))
        return count
    
    def cleanup_note_attachments(self, dry_run):
        """Cleanup quicknote attachments."""
        try:
            from apps.quicknotes.models import NoteAttachment
        except ImportError:
            self.stdout.write("\n[QuickNotes] Skipped — quicknotes app not available")
            return 0
        
        excel_filter = (
            Q(file__iendswith='.xlsx') | 
            Q(file__iendswith='.xls') |
            Q(file__iendswith='.ods')
        )
        attachments = NoteAttachment.objects.filter(excel_filter, preview_status='ready')
        count = attachments.count()
        
        self.stdout.write(f"\n[QuickNotes] Found {count} Excel files with PDF previews")
        
        if count == 0:
            return 0
        
        if dry_run:
            for att in attachments[:5]:
                self.stdout.write(f"  - {att.filename or att.file.name}")
            if count > 5:
                self.stdout.write(f"  ... and {count - 5} more")
            return count
        
        for att in attachments:
            self._cleanup_record(att, 'preview_pdf')
        
        self.stdout.write(self.style.SUCCESS(f"  ✓ Cleaned {count} note attachments"))
        return count
    
    def _cleanup_record(self, record, pdf_field_name):
        """Reset a single record's preview fields and delete its PDF file."""
        pdf_field = getattr(record, pdf_field_name)
        
        # Delete the PDF file from S3
        if pdf_field:
            try:
                pdf_field.delete(save=False)
            except Exception as e:
                self.stdout.write(self.style.WARNING(
                    f"  ⚠ Could not delete PDF for {record.id}: {e}"
                ))
        
        # Reset the fields
        setattr(record, pdf_field_name, None)
        record.preview_status = 'not_needed'
        record.preview_error = ''
        record.save(update_fields=[pdf_field_name, 'preview_status', 'preview_error'])