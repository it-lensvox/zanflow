"""
Services for Ground Truth operations.
"""
import os
import subprocess
import tempfile
import logging
from pathlib import Path

import boto3
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
import shutil
from .models import Document

logger = logging.getLogger(__name__)


# ============ NEW: PDF CONVERSION CONFIGURATION ============

# File types that should be converted to PDF for preview
CONVERTIBLE_EXTENSIONS = {
    'ppt', 'pptx',   # PowerPoint
    'doc', 'docx',   # Word
    # 'xls', 'xlsx',   # Excel
    'odt', 'odp', 'ods',  # OpenDocument
}


def needs_pdf_conversion(filename):
    """Check if a file needs to be converted to PDF for preview."""
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[-1].lower()
    return ext in CONVERTIBLE_EXTENSIONS


def get_libreoffice_command():
    """
    Find the LibreOffice executable across different operating systems.
    Returns the path to the executable, or None if not found.
    """
    # Try standard command names first (works on Linux + Mac if in PATH)
    for cmd in ['libreoffice', 'soffice']:
        path = shutil.which(cmd)
        if path:
            return path
    
    # Mac-specific paths (when LibreOffice is not in PATH)
    mac_paths = [
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
        '/opt/homebrew/bin/soffice',   # Apple Silicon Homebrew
        '/usr/local/bin/soffice',      # Intel Mac Homebrew
    ]
    for path in mac_paths:
        if os.path.exists(path):
            return path
    
    return None


def convert_office_to_pdf(input_path, output_dir, timeout=120):
    """
    Convert an Office document to PDF using LibreOffice headless.
    
    Args:
        input_path: Full path to the input file
        output_dir: Directory where PDF should be saved
        timeout: Maximum seconds to wait (default 2 minutes)
    
    Returns:
        Path to the generated PDF, or None if conversion failed
    """
    libreoffice_cmd = get_libreoffice_command()
    if not libreoffice_cmd:
        logger.error(
            "LibreOffice not found. On Mac: brew install --cask libreoffice. "
            "On Ubuntu: sudo apt-get install libreoffice"
        )
        return None
    
    try:
        result = subprocess.run(
            [
                libreoffice_cmd,
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', output_dir,
                input_path
            ],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        if result.returncode != 0:
            logger.error(f"LibreOffice conversion failed: {result.stderr}")
            return None
        
        # LibreOffice names the output as <input_basename>.pdf
        base_name = Path(input_path).stem
        pdf_path = os.path.join(output_dir, f"{base_name}.pdf")
        
        if os.path.exists(pdf_path):
            logger.info(f"Successfully converted {input_path} to PDF")
            return pdf_path
        
        logger.error(f"PDF not found at expected path: {pdf_path}")
        return None
        
    except subprocess.TimeoutExpired:
        logger.error(f"LibreOffice timeout for {input_path}")
        return None
    except Exception as e:
        logger.error(f"Conversion exception: {e}")
        return None


def generate_document_preview(document):
    """
    Main function: Download original from S3, convert to PDF, upload back.
    
    Args:
        document: Document instance
    
    Returns:
        True if conversion succeeded, False otherwise
    """
    # Skip if no source file
    if not document.source_file:
        document.preview_status = Document.PreviewStatus.NOT_NEEDED
        document.save(update_fields=['preview_status'])
        return True
    
    filename = document.source_file.name
    
    # Skip if file type doesn't need conversion
    if not needs_pdf_conversion(filename):
        document.preview_status = Document.PreviewStatus.NOT_NEEDED
        document.save(update_fields=['preview_status'])
        return True
    
    # Mark as processing
    document.preview_status = Document.PreviewStatus.PROCESSING
    document.save(update_fields=['preview_status'])
    
    # Use temp directory for conversion (auto-cleaned after)
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Step 1: Download original file from S3 to local temp folder
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
            logger.info(f"Downloaded {filename} for conversion")
            
            # Step 2: Convert to PDF using LibreOffice
            pdf_path = convert_office_to_pdf(local_input_path, temp_dir)
            if not pdf_path:
                raise Exception("LibreOffice did not produce a PDF")
            
            # Step 3: Read the PDF and save it to Django's storage (which uploads to S3)
            with open(pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
            
            pdf_filename = f"{document.id}.pdf"
            document.preview_pdf.save(
                pdf_filename,
                ContentFile(pdf_content),
                save=False
            )
            
            # Step 4: Mark as ready
            document.preview_status = Document.PreviewStatus.READY
            document.preview_error = ''
            document.save(update_fields=['preview_pdf', 'preview_status', 'preview_error'])
            
            logger.info(f"Preview PDF generated for document {document.id}")
            return True
            
        except Exception as e:
            error_msg = str(e)[:500]  # Truncate long errors
            logger.error(f"Preview generation failed for {document.id}: {error_msg}")
            document.preview_status = Document.PreviewStatus.FAILED
            document.preview_error = error_msg
            document.save(update_fields=['preview_status', 'preview_error'])
            return False


# ============ EXISTING FUNCTIONS — KEEP AS-IS ============

def compute_gt_diff(old_data: dict, new_data: dict) -> dict:
    """
    Compute detailed diff between two GT data dictionaries.
    """
    old_keys = set(old_data.keys()) if old_data else set()
    new_keys = set(new_data.keys()) if new_data else set()
    
    added = {k: new_data[k] for k in (new_keys - old_keys)}
    removed = {k: old_data[k] for k in (old_keys - new_keys)}
    
    modified = {}
    for k in old_keys & new_keys:
        if old_data[k] != new_data[k]:
            modified[k] = {
                "old": old_data[k],
                "new": new_data[k],
            }
    
    return {
        "added": added,
        "removed": removed,
        "modified": modified,
    }


def approve_gt_version(version, user):
    """
    Approve a GT version and set it as current for the document.
    """
    from apps.audit.services import log_action
    
    version.is_approved = True
    version.approved_at = timezone.now()
    version.approved_by = user
    version.save()
    
    document = version.document
    document.current_gt_version = version
    document.status = "approved"
    document.updated_by = user
    document.save()
    
    log_action(
        version,
        "approve",
        change_summary=f"Approved version {version.version_number}",
        user=user,
    )
    
    return version


def submit_for_review(document, user):
    """
    Submit a document for review.
    """
    from apps.audit.services import log_action
    
    old_status = document.status
    document.status = "in_review"
    document.updated_by = user
    document.save()
    
    log_action(
        document,
        "submit",
        old_value={"status": old_status},
        new_value={"status": "in_review"},
        change_summary="Submitted for review",
        user=user,
    )
    
    return document


def import_gt_from_output(document, extracted_data: dict, user, source_reference: str = ""):
    """
    Import ground truth from model output (for correction workflow).
    """
    from .models import GTVersion
    
    version = GTVersion.objects.create(
        document=document,
        gt_data=extracted_data,
        source_type="imported",
        source_reference=source_reference,
        created_by=user,
        change_summary="Imported from model output",
    )
    
    return version