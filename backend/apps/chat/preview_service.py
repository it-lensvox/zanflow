"""
PDF preview generation for chat attachments.
Reuses the LibreOffice conversion logic from the groundtruth app.
"""
import os
import tempfile
import logging
import boto3
from django.conf import settings
from django.core.files.base import ContentFile

# Reuse the existing conversion functions from groundtruth services
from apps.groundtruth.services import (
    needs_pdf_conversion,
    convert_office_to_pdf,
)

logger = logging.getLogger(__name__)


def generate_chat_attachment_preview(message_id):
    """
    Convert a ChatMessage's attachment to PDF for inline preview.
    Mirrors generate_document_preview but for ChatMessage instead of Document.
    """
    from .models import ChatMessage
    
    try:
        message = ChatMessage.objects.get(id=message_id)
    except ChatMessage.DoesNotExist:
        logger.error(f"ChatMessage {message_id} not found")
        return False
    
    # Skip if no attachment
    if not message.attachment:
        message.preview_status = 'not_needed'
        message.save(update_fields=['preview_status'])
        return True
    
    filename = message.attachment.name
    
    # Skip if file type doesn't need conversion
    if not needs_pdf_conversion(filename):
        message.preview_status = 'not_needed'
        message.save(update_fields=['preview_status'])
        return True
    
    # Mark as processing
    message.preview_status = 'processing'
    message.save(update_fields=['preview_status'])
    
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Step 1: Download original attachment from S3
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
            logger.info(f"Downloaded chat attachment {filename} for conversion")
            
            # Step 2: Convert to PDF
            pdf_path = convert_office_to_pdf(local_input_path, temp_dir)
            if not pdf_path:
                raise Exception("LibreOffice did not produce a PDF")
            
            # Step 3: Upload PDF to S3 via Django storage
            with open(pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
            
            pdf_filename = f"{message.id}.pdf"
            message.preview_pdf.save(
                pdf_filename,
                ContentFile(pdf_content),
                save=False
            )
            
            # Step 4: Mark as ready
            message.preview_status = 'ready'
            message.preview_error = ''
            message.save(update_fields=['preview_pdf', 'preview_status', 'preview_error'])
            
            logger.info(f"Preview PDF generated for chat message {message.id}")
            return True
            
        except Exception as e:
            error_msg = str(e)[:500]
            logger.error(f"Chat preview generation failed for {message_id}: {error_msg}")
            message.preview_status = 'failed'
            message.preview_error = error_msg
            message.save(update_fields=['preview_status', 'preview_error'])
            return False


def trigger_preview_generation_async(message_id):
    """
    Run preview generation in a background thread so chat sending isn't slow.
    """
    import threading
    
    def background_task():
        try:
            generate_chat_attachment_preview(str(message_id))
        except Exception as e:
            logger.error(f"Background chat preview failed: {e}")
    
    thread = threading.Thread(target=background_task, daemon=True)
    thread.start()