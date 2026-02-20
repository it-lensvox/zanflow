"""
Services for Ground Truth operations.
"""
import os
from django.utils import timezone
from .models import Document

def compute_gt_diff(old_data: dict, new_data: dict) -> dict:
    """
    Compute detailed diff between two GT data dictionaries.
    
    Returns:
        {
            "added": {"field": "value"},
            "removed": {"field": "value"},
            "modified": {"field": {"old": "x", "new": "y"}}
        }
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
    
    # Update document's current version
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

