# API Testing & Automation Platform

A Django app providing Postman-like API testing capabilities with one-click collection execution and secure credential management.

## Features

- **API Collections**: Group related APIs for batch testing
- **One-Click Execution**: Run all APIs in a collection with a single click
- **Secure Credentials**: Encrypted storage for tokens, passwords, API keys
- **Variable Substitution**: Use `{{variable}}` placeholders in URLs, headers, and bodies
- **Response Validation**: Assert status codes and response content
- **Execution History**: Full audit trail with request/response capture
- **Role-Based Access**: Different permissions for Backend, Manager, and Non-Tech users
- **Async Support**: Optional Celery integration for background execution
- **Scheduled Runs**: Set up recurring API tests (with Celery Beat)

## Installation

### 1. Add to INSTALLED_APPS

```python
# settings.py

INSTALLED_APPS = [
    # ... existing apps ...
    'apps.api_testing',
]
```

### 2. Add URL Routes

```python
# config/urls.py

urlpatterns = [
    # ... existing urls ...
    path("api/v1/api-testing/", include("apps.api_testing.urls")),
]
```

### 3. Run Migrations

```bash
python manage.py makemigrations api_testing
python manage.py migrate
```

### 4. Configure Encryption Key (Required for Production)

```python
# settings.py

# Generate with: from cryptography.fernet import Fernet; print(Fernet.generate_key())
CREDENTIAL_ENCRYPTION_KEY = config('CREDENTIAL_ENCRYPTION_KEY', default=None)
```

### 5. Install Dependencies

```bash
pip install requests cryptography
```

## API Endpoints

### Collections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-testing/collections/` | List all collections |
| POST | `/api/v1/api-testing/collections/` | Create new collection |
| GET | `/api/v1/api-testing/collections/{id}/` | Get collection details |
| PUT | `/api/v1/api-testing/collections/{id}/` | Update collection |
| DELETE | `/api/v1/api-testing/collections/{id}/` | Delete collection |
| POST | `/api/v1/api-testing/collections/{id}/run/` | **Run entire collection** |
| GET | `/api/v1/api-testing/collections/{id}/export/` | Export collection |
| GET | `/api/v1/api-testing/collections/{id}/history/` | Get execution history |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-testing/endpoints/` | List all endpoints |
| POST | `/api/v1/api-testing/endpoints/` | Create new endpoint |
| GET | `/api/v1/api-testing/endpoints/{id}/` | Get endpoint details |
| PUT | `/api/v1/api-testing/endpoints/{id}/` | Update endpoint |
| DELETE | `/api/v1/api-testing/endpoints/{id}/` | Delete endpoint |
| POST | `/api/v1/api-testing/endpoints/{id}/run/` | **Run single endpoint** |
| POST | `/api/v1/api-testing/endpoints/bulk_create/` | Bulk create endpoints |
| POST | `/api/v1/api-testing/endpoints/reorder/` | Reorder endpoints |

### Auth Credentials

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-testing/credentials/` | List credentials (metadata only) |
| POST | `/api/v1/api-testing/credentials/` | Create credential |
| GET | `/api/v1/api-testing/credentials/{id}/` | Get credential details |
| PUT | `/api/v1/api-testing/credentials/{id}/` | Update credential |
| DELETE | `/api/v1/api-testing/credentials/{id}/` | Delete credential |

### Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/api-testing/run/collection/` | Run collection (standalone) |
| POST | `/api/v1/api-testing/run/api/` | Run single API (standalone) |

### History

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-testing/runs/` | List execution runs |
| GET | `/api/v1/api-testing/runs/{id}/` | Get run details with results |
| GET | `/api/v1/api-testing/results/` | List execution results |
| GET | `/api/v1/api-testing/results/{id}/` | Get result details |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-testing/dashboard/` | Get statistics |

## Usage Examples

### Create a Collection

```bash
curl -X POST http://localhost:8000/api/v1/api-testing/collections/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User API Tests",
    "description": "Tests for user management APIs",
    "environment_variables": {
      "base_url": "https://api.example.com",
      "api_version": "v1"
    }
  }'
```

### Add an API Endpoint

```bash
curl -X POST http://localhost:8000/api/v1/api-testing/endpoints/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "<collection-uuid>",
    "name": "Get User Profile",
    "http_method": "GET",
    "url": "{{base_url}}/{{api_version}}/users/me",
    "headers": {
      "Accept": "application/json"
    },
    "expected_status_code": 200,
    "expected_response_contains": ["id", "email"],
    "extract_variables": {
      "user_id": "data.id"
    }
  }'
```

### Add Authentication

```bash
curl -X POST http://localhost:8000/api/v1/api-testing/credentials/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "<collection-uuid>",
    "name": "API Bearer Token",
    "auth_type": "bearer",
    "token": "your-secret-token"
  }'
```

### Run All APIs (One-Click)

```bash
curl -X POST http://localhost:8000/api/v1/api-testing/collections/<collection-uuid>/run/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "credential_id": "<credential-uuid>",
    "notes": "Testing before release"
  }'
```

### Response Example

```json
{
  "id": "abc123...",
  "collection": {...},
  "executed_by": {...},
  "status": "completed",
  "started_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T10:30:05Z",
  "total_apis": 5,
  "successful_count": 5,
  "failed_count": 0,
  "duration_seconds": 5.2,
  "success_rate": 100.0,
  "results": [
    {
      "endpoint_name": "Get User Profile",
      "endpoint_method": "GET",
      "status": "success",
      "response_status_code": 200,
      "execution_time_ms": 245,
      "assertions_passed": true
    },
    ...
  ]
}
```

## Role-Based Access Control

| Role | Create/Edit | View | Run |
|------|-------------|------|-----|
| Admin | ✅ | ✅ | ✅ |
| Backend Member | ✅ | ✅ | ✅ |
| Manager | ❌ | ✅ | ✅ |
| Non-Tech Member | ❌ | ✅ | ✅ |

## Security Features

1. **Encrypted Credentials**: All sensitive data (tokens, passwords) encrypted at rest using Fernet symmetric encryption
2. **Masked Headers**: Authorization headers are masked in stored results
3. **Soft Deletes**: Collections and endpoints are soft-deleted to preserve audit history
4. **Role Permissions**: Strict access control based on user roles
5. **No Credential Exposure**: Actual credentials never returned in API responses

## Optional: Celery Integration

For background execution and scheduled runs, install Celery:

```bash
pip install celery redis
```

Configure in settings:

```python
# settings.py
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
```

Add to Celery Beat schedule:

```python
CELERY_BEAT_SCHEDULE = {
    'process-scheduled-runs': {
        'task': 'apps.api_testing.tasks.process_scheduled_runs',
        'schedule': 60.0,  # Every minute
    },
    'cleanup-old-results': {
        'task': 'apps.api_testing.tasks.cleanup_old_results',
        'schedule': 86400.0,  # Daily
        'kwargs': {'days': 30}
    },
}
```

## Database Models

- **APICollection**: Groups of related API tests
- **APIEndpoint**: Individual API configurations
- **AuthCredential**: Encrypted credential storage
- **ExecutionRun**: Batch execution records
- **ExecutionResult**: Individual API test results
- **ScheduledRun**: Recurring test configurations

## Contributing

Please read the existing code style and maintain consistency. All new features should include tests and documentation.
