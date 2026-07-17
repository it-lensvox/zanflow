"""
Django settings for ZanFlow project.
"""
import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url
from decouple import config
from corsheaders.defaults import default_headers

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent

# Security
SECRET_KEY = config("SECRET_KEY", default="django-insecure-dev-key-change-in-production")
DEBUG = config("DEBUG", default=True, cast=bool)
# ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1,192.168.1.12").split(",")
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "192.168.1.17"," 192.168.1.229", "*"]


# Application definition
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "storages",
    "channels",
]

LOCAL_APPS = [
    "apps.users",
    "apps.audit",
    "apps.projects",
    "apps.groundtruth",
    "apps.testing",
    "apps.issues",
    "apps.tasksite",
    "apps.task_ai",
    "apps.api_testing",
    "apps.notification",
    "apps.chat",
    "apps.teams",
    "apps.organizations",
    "apps.quicknotes",
    "apps.daily_updates.apps.DailyUpdatesConfig",
    "apps.ai_agent.apps.AiAgentConfig",
    "apps.dashboard",
    "apps.rbac",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.organizations.middleware.TenantMiddleware", 
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit.middleware.AuditMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
REDIS_URL = config("REDIS_URL", default="redis://localhost:6379/0")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}
# Database
# Default to SQLite for easy development, use DATABASE_URL for PostgreSQL
DATABASE_URL = config(
    "DATABASE_URL",
    default="sqlite:///" + str(BASE_DIR / "db.sqlite3")
)

# Handle both SQLite and PostgreSQL
if DATABASE_URL.startswith("sqlite"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": dj_database_url.parse(DATABASE_URL)
    }

# Custom User Model
AUTH_USER_MODEL = "users.User"

AUTHENTICATION_BACKENDS = [
    'apps.users.backends.EmailOrUsernameModelBackend', # Path to your custom backend
    'django.contrib.auth.backends.ModelBackend',       # Default backend fallback
]
# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    # {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Media files

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"     

# CORS
_cors_origins = config(
    "CORS_ALLOWED_ORIGINS",
    default=(
        # Local development
        "http://localhost:3000,"
        "http://localhost:3001,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        # LAN IPs (development)
        "http://192.168.1.121:5173,"
        "http://192.168.1.15:3001," 
        "http://192.168.1.160:3001,"
        "http://192.168.1.11:5173,"
        "http://192.168.1.188:8000,"
        "http://192.168.1.15:5173,"
        "http://192.168.1.15:8081,"
        "http://192.168.1.14:5173,"
        # Dyuksa production domains
        "https://pm.dyuksa.com,"
        "https://hrms.dyuksa.com,"
        "https://crm.dyuksa.com"
    )
)
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_origins.split(",") if origin.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-workspace-id",
    "x-internal-token",
]
STATIC_API_TOKEN = config("STATIC_API_TOKEN", default=None)

# ── Internal cross-product API token ──────────────────────────────
# Used for server-to-server calls between Dyuksa products (HRMS, CRM etc.)
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
# Must be identical in PM .env AND HRMS .env AND CRM .env
INTERNAL_API_TOKEN = config("INTERNAL_API_TOKEN", default="")
# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.organizations.authentication.WorkspaceStaticTokenAuthentication",  # ✅ NEW
        "apps.organizations.authentication.WorkspaceJWTAuthentication",          # ✅ NEW
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# JWT Settings
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=60, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# API Documentation
SPECTACULAR_SETTINGS = {
    "TITLE": "ZanFlow API",
    "DESCRIPTION": "Quality Assurance & Ground Truth Management Platform API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}
env_path = BASE_DIR.parent / '.env'
load_dotenv(env_path)

# AWS S3 Settings
USE_S3 = config("USE_S3", default=True, cast=bool)

# Amazon SES Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = f'email-smtp.{os.getenv("SES_REGION")}.amazonaws.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
# Fetch the URL from environment, fallback to a default if not found
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
# Fetching credentials from .env
EMAIL_HOST_USER = os.getenv('SES_SMTP_USER')
EMAIL_HOST_PASSWORD = os.getenv('SES_SMTP_PASSWORD')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL')
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
MICROSOFT_TENANT_ID = os.getenv("MICROSOFT_TENANT_ID", "")
# --- CHANGE STARTS HERE ---
# define these OUTSIDE the 'if' block so 'views.py' can always find them.
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME")
AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", default="us-east-1")
AWS_REGION = os.getenv("AWS_REGION", default="us-east-1")
BEDROCK_MODEL_ID = os.getenv('BEDROCK_MODEL_ID')
LLM_PROVIDER   = os.getenv("LLM_PROVIDER", "bedrock")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
if USE_S3:
    # Keep the storage configuration inside the IF block
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = 3600
    # AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
    
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

# File Upload Settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024  # 50MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024  # 50MB

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": config("DJANGO_LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}