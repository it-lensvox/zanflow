"""
PDF preview generation for quick note attachments.
Reuses the LibreOffice conversion from groundtruth services.
"""
import os
import tempfile
import logging
import boto3
from django.conf import settings
from django.core.files.base import ContentFile

from apps.groundtruth.services import (
    needs_pdf_conversion,
    convert_office_to_pdf,
)

logger = logging.getLogger(__name__)


def generate_note_attachment_preview(attachment_id):
    """Convert a NoteAttachment's file to PDF for inline preview."""
    from .models import NoteAttachment
    
    try:
        attachment = NoteAttachment.objects.get(id=attachment_id)
    except NoteAttachment.DoesNotExist:
        logger.error(f"NoteAttachment {attachment_id} not found")
        return False
    
    if not attachment.file:
        attachment.preview_status = 'not_needed'
        attachment.save(update_fields=['preview_status'])
        return True
    
    filename = attachment.file.name
    
    if not needs_pdf_conversion(filename):
        attachment.preview_status = 'not_needed'
        attachment.save(update_fields=['preview_status'])
        return True
    
    attachment.preview_status = 'processing'
    attachment.save(update_fields=['preview_status'])
    
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            
            local_filename = os.path.basename(filename)
            local_input_path = os.path.join(temp_dir, local_filename)
            
            s3_client.download_file(
                settings.AWS_STORAGE_BUCKET_NAME,
                filename,
                local_input_path
            )
            logger.info(f"Downloaded note attachment {filename} for conversion")
            
            pdf_path = convert_office_to_pdf(local_input_path, temp_dir)
            if not pdf_path:
                raise Exception("LibreOffice did not produce a PDF")
            
            with open(pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
            
            pdf_filename = f"{attachment.id}.pdf"
            attachment.preview_pdf.save(
                pdf_filename,
                ContentFile(pdf_content),
                save=False
            )
            
            attachment.preview_status = 'ready'
            attachment.preview_error = ''
            attachment.save(update_fields=['preview_pdf', 'preview_status', 'preview_error'])
            
            logger.info(f"Preview PDF generated for note attachment {attachment.id}")
            return True
            
        except Exception as e:
            error_msg = str(e)[:500]
            logger.error(f"Note preview generation failed for {attachment_id}: {error_msg}")
            attachment.preview_status = 'failed'
            attachment.preview_error = error_msg
            attachment.save(update_fields=['preview_status', 'preview_error'])
            return False


def trigger_note_preview_async(attachment_id):
    """Run conversion in background thread."""
    import threading
    
    def background_task():
        try:
            generate_note_attachment_preview(str(attachment_id))
        except Exception as e:
            logger.error(f"Background note preview failed: {e}")
    
    thread = threading.Thread(target=background_task, daemon=True)
    thread.start()