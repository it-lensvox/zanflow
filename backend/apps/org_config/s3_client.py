"""
apps/org_config/s3_client.py

Low-level S3 operations for org config JSON files.

Bucket structure:
    s3://{DYUKSA_CONFIG_BUCKET}/
        lensvox/
            pm.json
            hrms.json
        banner_pvt/
            pm.json
        unisys/
            ims.json

All methods raise OrgConfigS3Error on failure.
Callers (services.py) catch and handle these.
"""

import json
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings

logger = logging.getLogger(__name__)


class OrgConfigS3Error(Exception):
    """Raised when an S3 operation on org config fails."""
    pass


def _get_client():
    """Return a boto3 S3 client using settings credentials."""
    return boto3.client(
        "s3",
        region_name          = getattr(settings, "AWS_S3_REGION_NAME", "us-east-1"),
        aws_access_key_id    = getattr(settings, "AWS_ACCESS_KEY_ID",     None),
        aws_secret_access_key= getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
    )


def _bucket() -> str:
    """Return the config bucket name from settings."""
    bucket = getattr(settings, "DYUKSA_CONFIG_BUCKET", None)
    if not bucket:
        raise OrgConfigS3Error(
            "DYUKSA_CONFIG_BUCKET is not set in settings / .env"
        )
    return bucket


def _key(org_slug: str, platform: str) -> str:
    """Return the S3 key for an org+platform config."""
    return f"{org_slug}/{platform}.json"


# ── Public API ────────────────────────────────────────────────────────────────

def get_config(org_slug: str, platform: str) -> dict:
    """
    Fetch and return the parsed JSON config for org+platform from S3.

    Returns:
        dict — the parsed JSON

    Raises:
        OrgConfigS3Error — if file not found or S3 error
    """
    key = _key(org_slug, platform)
    try:
        client   = _get_client()
        response = client.get_object(Bucket=_bucket(), Key=key)
        body     = response["Body"].read().decode("utf-8")
        return json.loads(body)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("NoSuchKey", "404"):
            raise OrgConfigS3Error(
                f"Config not found in S3: {key}"
            ) from e
        raise OrgConfigS3Error(
            f"S3 error fetching {key}: {code} — {e}"
        ) from e
    except (BotoCoreError, json.JSONDecodeError) as e:
        raise OrgConfigS3Error(
            f"Failed to read S3 config {key}: {e}"
        ) from e


def put_config(org_slug: str, platform: str, config: dict) -> None:
    """
    Upload a config dict as JSON to S3.

    Args:
        org_slug: organisation slug (e.g. "lensvox")
        platform: product key (e.g. "pm")
        config:   dict to serialise and upload

    Raises:
        OrgConfigS3Error — on S3 error
    """
    key  = _key(org_slug, platform)
    body = json.dumps(config, indent=2, ensure_ascii=False)
    try:
        client = _get_client()
        client.put_object(
            Bucket      = _bucket(),
            Key         = key,
            Body        = body.encode("utf-8"),
            ContentType = "application/json",
        )
        logger.info("OrgConfig: uploaded s3://%s/%s", _bucket(), key)
    except (ClientError, BotoCoreError) as e:
        raise OrgConfigS3Error(
            f"Failed to upload S3 config {key}: {e}"
        ) from e


def delete_config(org_slug: str, platform: str) -> None:
    """
    Delete an org+platform config from S3.

    Raises:
        OrgConfigS3Error — on S3 error
    """
    key = _key(org_slug, platform)
    try:
        client = _get_client()
        client.delete_object(Bucket=_bucket(), Key=key)
        logger.info("OrgConfig: deleted s3://%s/%s", _bucket(), key)
    except (ClientError, BotoCoreError) as e:
        raise OrgConfigS3Error(
            f"Failed to delete S3 config {key}: {e}"
        ) from e


def config_exists(org_slug: str, platform: str) -> bool:
    """
    Check whether an org+platform config exists in S3.

    Returns:
        True if the object exists, False otherwise.
    """
    key = _key(org_slug, platform)
    try:
        client = _get_client()
        client.head_object(Bucket=_bucket(), Key=key)
        return True
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchKey"):
            return False
        raise OrgConfigS3Error(
            f"S3 error checking {key}: {e}"
        ) from e


def list_org_configs(org_slug: str) -> list:
    """
    List all platform config files for an org.

    Returns:
        List of platform keys e.g. ["pm", "hrms"]
    """
    prefix = f"{org_slug}/"
    try:
        client   = _get_client()
        response = client.list_objects_v2(Bucket=_bucket(), Prefix=prefix)
        contents = response.get("Contents", [])
        platforms = []
        for obj in contents:
            key = obj["Key"]                    # e.g. "lensvox/pm.json"
            filename = key[len(prefix):]        # e.g. "pm.json"
            if filename.endswith(".json"):
                platforms.append(filename[:-5]) # e.g. "pm"
        return platforms
    except (ClientError, BotoCoreError) as e:
        raise OrgConfigS3Error(
            f"Failed to list S3 configs for {org_slug}: {e}"
        ) from e
