import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Play, Folder, Link2, Key, ChevronRight, ChevronDown,
  Loader2, CheckCircle2, XCircle, Clock, Trash2, Edit2,
  MoreVertical, RefreshCw, Settings, Send, Save, X,
  AlertCircle, Zap, Eye, EyeOff, Copy, Check
} from 'lucide-react';
import { apiTestingApi, projectsApi } from '@/services/api';
import type {
  APICollection, APIEndpoint, AuthCredential, ExecutionRun,
  CreateCollectionPayload, CreateEndpointPayload, CreateCredentialPayload
} from '@/types';
import './ApiTesting.scss';

// HTTP Method colors
const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
  success: '#49cc90',
  completed: '#49cc90',
  failed: '#f93e3e',
  error: '#f93e3e',
  partial_failure: '#fca130',
  timeout: '#9012fe',
  skipped: '#6b7280',
  pending: '#6b7280',
  running: '#61affe',
};

// ============================================
// Sub-Components
// ============================================

// Method Badge Component
function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className="api-testing__method-badge"
      style={{ backgroundColor: METHOD_COLORS[method] || '#6b7280' }}
    >
      {method}
    </span>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const Icon = status === 'success' || status === 'completed' ? CheckCircle2 :
    status === 'failed' || status === 'error' ? XCircle :
      status === 'running' ? Loader2 :
        status === 'timeout' ? Clock : AlertCircle;

  return (
    <span
      className="api-testing__status-badge"
      style={{ backgroundColor: `${STATUS_COLORS[status] || '#6b7280'}20`, color: STATUS_COLORS[status] || '#6b7280' }}
    >
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status.replace('_', ' ')}
    </span>
  );
}

// Empty State Component
function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: any;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="api-testing__empty">
      <Icon className="api-testing__empty-icon" />
      <h3 className="api-testing__empty-title">{title}</h3>
      <p className="api-testing__empty-desc">{description}</p>
      {action && (
        <button className="api-testing__btn api-testing__btn--primary" onClick={action.onClick}>
          <Plus className="h-4 w-4" />
          {action.label}
        </button>
      )}
    </div>
  );
}

// Loading Spinner
function LoadingSpinner() {
  return (
    <div className="api-testing__loading">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p>Loading...</p>
    </div>
  );
}

// Create Collection Modal
function CreateCollectionModal({
  projectId,
  onClose,
  onSuccess
}: {
  projectId:  number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<CreateCollectionPayload>({
    name: '',
    description: '',
    project_id: projectId,
    execution_order: 'sequential',
    environment_variables: {},
    tags: [],
  });
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: apiTestingApi.createCollection,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create collection');
    },
  });

  const handleAddEnvVar = () => {
    if (envKey && envValue) {
      setFormData(prev => ({
        ...prev,
        environment_variables: {
          ...prev.environment_variables,
          [envKey]: envValue,
        },
      }));
      setEnvKey('');
      setEnvValue('');
    }
  };

  const handleRemoveEnvVar = (key: string) => {
    setFormData(prev => {
      const newVars = { ...prev.environment_variables };
      delete newVars[key];
      return { ...prev, environment_variables: newVars };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Collection name is required');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="api-testing__modal-overlay" onClick={onClose}>
      <div className="api-testing__modal" onClick={e => e.stopPropagation()}>
        <div className="api-testing__modal-header">
          <h2>Create New Collection</h2>
          <button className="api-testing__modal-close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="api-testing__modal-body">
          {error && <div className="api-testing__error">{error}</div>}

          <div className="api-testing__form-group">
            <label>Collection Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., User Management APIs"
              className="api-testing__input"
            />
          </div>

          <div className="api-testing__form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this collection tests..."
              className="api-testing__textarea"
              rows={3}
            />
          </div>

          <div className="api-testing__form-group">
            <label>Execution Order</label>
            <select
              value={formData.execution_order}
              onChange={e => setFormData(prev => ({ ...prev, execution_order: e.target.value as 'sequential' | 'parallel' }))}
              className="api-testing__select"
            >
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel</option>
            </select>
          </div>

          <div className="api-testing__form-group">
            <label>Environment Variables</label>
            <div className="api-testing__env-vars">
              {Object.entries(formData.environment_variables || {}).map(([key, value]) => (
                <div key={key} className="api-testing__env-var">
                  <span className="api-testing__env-key">{key}</span>
                  <span className="api-testing__env-value">{value}</span>
                  <button type="button" onClick={() => handleRemoveEnvVar(key)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="api-testing__env-add">
                <input
                  type="text"
                  placeholder="Key"
                  value={envKey}
                  onChange={e => setEnvKey(e.target.value)}
                  className="api-testing__input api-testing__input--small"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={envValue}
                  onChange={e => setEnvValue(e.target.value)}
                  className="api-testing__input api-testing__input--small"
                />
                <button type="button" onClick={handleAddEnvVar} className="api-testing__btn api-testing__btn--secondary">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="api-testing__modal-footer">
            <button type="button" onClick={onClose} className="api-testing__btn api-testing__btn--secondary">
              Cancel
            </button>
            <button type="submit" className="api-testing__btn api-testing__btn--primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Collection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Create Endpoint Modal
// ============================================
function CreateEndpointModal({
  collectionId,
  onClose,
  onSuccess
}: {
  collectionId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<CreateEndpointPayload>({
    collection: collectionId,
    name: '',
    description: '',
    http_method: 'GET',
    url: '',
    headers: {},
    query_params: {},
    request_body: {},
    body_type: 'json',
    expected_status_code: 200,
    timeout_seconds: 30,
    retry_count: 0,
    sort_order: 0,
  });
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [bodyString, setBodyString] = useState('{}');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: apiTestingApi.createEndpoint,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || err.response?.data?.url?.[0] || 'Failed to create endpoint');
    },
  });

  const handleAddHeader = () => {
    if (headerKey && headerValue) {
      setFormData(prev => ({
        ...prev,
        headers: { ...prev.headers, [headerKey]: headerValue },
      }));
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const handleRemoveHeader = (key: string) => {
    setFormData(prev => {
      const newHeaders = { ...prev.headers };
      delete newHeaders[key];
      return { ...prev, headers: newHeaders };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Endpoint name is required');
      return;
    }
    if (!formData.url.trim()) {
      setError('URL is required');
      return;
    }

    let finalData = { ...formData };

    // Parse body if JSON
    if (formData.body_type === 'json' && bodyString.trim()) {
      try {
        finalData.request_body = JSON.parse(bodyString);
      } catch {
        setError('Invalid JSON in request body');
        return;
      }
    }

    createMutation.mutate(finalData);
  };

  return (
    <div className="api-testing__modal-overlay" onClick={onClose}>
      <div className="api-testing__modal api-testing__modal--large" onClick={e => e.stopPropagation()}>
        <div className="api-testing__modal-header">
          <h2>Add API Endpoint</h2>
          <button className="api-testing__modal-close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="api-testing__modal-body">
          {error && <div className="api-testing__error">{error}</div>}

          <div className="api-testing__form-row">
            <div className="api-testing__form-group api-testing__form-group--flex">
              <label>Method & URL *</label>
              <div className="api-testing__url-input">
                <select
                  value={formData.http_method}
                  onChange={e => setFormData(prev => ({ ...prev, http_method: e.target.value }))}
                  className="api-testing__select api-testing__select--method"
                  style={{ backgroundColor: `${METHOD_COLORS[formData.http_method]}20`, color: METHOD_COLORS[formData.http_method] }}
                >
                  {Object.keys(METHOD_COLORS).map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formData.url}
                  onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://api.example.com/users or {{base_url}}/users"
                  className="api-testing__input api-testing__input--url"
                />
              </div>
            </div>
          </div>

          <div className="api-testing__form-row">
            <div className="api-testing__form-group">
              <label>Endpoint Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Get All Users"
                className="api-testing__input"
              />
            </div>
            <div className="api-testing__form-group">
              <label>Expected Status</label>
              <input
                type="number"
                value={formData.expected_status_code}
                onChange={e => setFormData(prev => ({ ...prev, expected_status_code: parseInt(e.target.value) }))}
                className="api-testing__input"
              />
            </div>
          </div>

          <div className="api-testing__form-group">
            <label>Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does this endpoint do?"
              className="api-testing__input"
            />
          </div>

          <div className="api-testing__form-group">
            <label>Headers</label>
            <div className="api-testing__key-value-list">
              {Object.entries(formData.headers || {}).map(([key, value]) => (
                <div key={key} className="api-testing__key-value">
                  <span className="api-testing__kv-key">{key}</span>
                  <span className="api-testing__kv-value">{value}</span>
                  <button type="button" onClick={() => handleRemoveHeader(key)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="api-testing__key-value-add">
                <input
                  type="text"
                  placeholder="Header name"
                  value={headerKey}
                  onChange={e => setHeaderKey(e.target.value)}
                  className="api-testing__input api-testing__input--small"
                />
                <input
                  type="text"
                  placeholder="Header value"
                  value={headerValue}
                  onChange={e => setHeaderValue(e.target.value)}
                  className="api-testing__input api-testing__input--small"
                />
                <button type="button" onClick={handleAddHeader} className="api-testing__btn api-testing__btn--icon">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {['POST', 'PUT', 'PATCH'].includes(formData.http_method) && (
            <div className="api-testing__form-group">
              <label>Request Body (JSON)</label>
              <textarea
                value={bodyString}
                onChange={e => setBodyString(e.target.value)}
                placeholder='{"key": "value"}'
                className="api-testing__textarea api-testing__textarea--code"
                rows={6}
              />
            </div>
          )}

          <div className="api-testing__form-row">
            <div className="api-testing__form-group">
              <label>Timeout (seconds)</label>
              <input
                type="number"
                value={formData.timeout_seconds}
                onChange={e => setFormData(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) }))}
                className="api-testing__input"
              />
            </div>
            <div className="api-testing__form-group">
              <label>Retry Count</label>
              <input
                type="number"
                value={formData.retry_count}
                onChange={e => setFormData(prev => ({ ...prev, retry_count: parseInt(e.target.value) }))}
                className="api-testing__input"
              />
            </div>
          </div>

          <div className="api-testing__modal-footer">
            <button type="button" onClick={onClose} className="api-testing__btn api-testing__btn--secondary">
              Cancel
            </button>
            <button type="submit" className="api-testing__btn api-testing__btn--primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Endpoint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Create Credential Modal
// ============================================
function CreateCredentialModal({
  collectionId,
  onClose,
  onSuccess
}: {
  collectionId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<CreateCredentialPayload>({
    collection: collectionId,
    name: '',
    auth_type: 'bearer',
    token: '',
    header_name: 'Authorization',
    header_prefix: 'Bearer',
  });
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: apiTestingApi.createCredential,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || err.response?.data?.token?.[0] || 'Failed to create credential');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Credential name is required');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="api-testing__modal-overlay" onClick={onClose}>
      <div className="api-testing__modal" onClick={e => e.stopPropagation()}>
        <div className="api-testing__modal-header">
          <h2>Add Authentication</h2>
          <button className="api-testing__modal-close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="api-testing__modal-body">
          {error && <div className="api-testing__error">{error}</div>}

          <div className="api-testing__form-group">
            <label>Credential Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Production API Token"
              className="api-testing__input"
            />
          </div>

          <div className="api-testing__form-group">
            <label>Auth Type</label>
            <select
              value={formData.auth_type}
              onChange={e => setFormData(prev => ({ ...prev, auth_type: e.target.value }))}
              className="api-testing__select"
            >
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
              <option value="api_key_header">API Key (Header)</option>
              <option value="api_key_query">API Key (Query)</option>
            </select>
          </div>

          {formData.auth_type === 'bearer' && (
            <div className="api-testing__form-group">
              <label>Token *</label>
              <div className="api-testing__input-with-icon">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={formData.token}
                  onChange={e => setFormData(prev => ({ ...prev, token: e.target.value }))}
                  placeholder="Enter your bearer token"
                  className="api-testing__input"
                />
                <button type="button" onClick={() => setShowToken(!showToken)} className="api-testing__input-icon">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {formData.auth_type === 'basic' && (
            <>
              <div className="api-testing__form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                  className="api-testing__input"
                />
              </div>
              <div className="api-testing__form-group">
                <label>Password *</label>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={formData.password || ''}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  className="api-testing__input"
                />
              </div>
            </>
          )}

          {(formData.auth_type === 'api_key_header' || formData.auth_type === 'api_key_query') && (
            <>
              <div className="api-testing__form-group">
                <label>API Key Name</label>
                <input
                  type="text"
                  value={formData.api_key_name || 'X-API-Key'}
                  onChange={e => setFormData(prev => ({ ...prev, api_key_name: e.target.value }))}
                  placeholder="X-API-Key"
                  className="api-testing__input"
                />
              </div>
              <div className="api-testing__form-group">
                <label>API Key Value *</label>
                <div className="api-testing__input-with-icon">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={formData.api_key || ''}
                    onChange={e => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="Enter your API key"
                    className="api-testing__input"
                  />
                  <button type="button" onClick={() => setShowToken(!showToken)} className="api-testing__input-icon">
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="api-testing__modal-footer">
            <button type="button" onClick={onClose} className="api-testing__btn api-testing__btn--secondary">
              Cancel
            </button>
            <button type="submit" className="api-testing__btn api-testing__btn--primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Save Credential
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Execution Results Modal
// ============================================
function ExecutionResultsModal({
  run,
  onClose
}: {
  run: ExecutionRun;
  onClose: () => void;
}) {
  return (
    <div className="api-testing__modal-overlay" onClick={onClose}>
      <div className="api-testing__modal api-testing__modal--xlarge" onClick={e => e.stopPropagation()}>
        <div className="api-testing__modal-header">
          <div>
            <h2>Execution Results</h2>
            <p className="api-testing__modal-subtitle">
              Run ID: {run.id.slice(0, 8)}... | {new Date(run.started_at || run.created_at).toLocaleString()}
            </p>
          </div>
          <button className="api-testing__modal-close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="api-testing__modal-body">
          {/* Summary Stats */}
          <div className="api-testing__results-summary">
            <div className="api-testing__results-stat api-testing__results-stat--total">
              <span className="api-testing__results-stat-value">{run.total_apis}</span>
              <span className="api-testing__results-stat-label">Total APIs</span>
            </div>
            <div className="api-testing__results-stat api-testing__results-stat--success">
              <span className="api-testing__results-stat-value">{run.successful_count}</span>
              <span className="api-testing__results-stat-label">Passed</span>
            </div>
            <div className="api-testing__results-stat api-testing__results-stat--failed">
              <span className="api-testing__results-stat-value">{run.failed_count}</span>
              <span className="api-testing__results-stat-label">Failed</span>
            </div>
            <div className="api-testing__results-stat api-testing__results-stat--rate">
              <span className="api-testing__results-stat-value">{run.success_rate?.toFixed(1) || 0}%</span>
              <span className="api-testing__results-stat-label">Success Rate</span>
            </div>
          </div>

          {/* Results List */}
          <div className="api-testing__results-list">
            {run.results && run.results.length > 0 ? (
              run.results.map((result, index) => (
                <div key={result.id || index} className={`api-testing__result-item api-testing__result-item--${result.status}`}>
                  <div className="api-testing__result-header">
                    <div className="api-testing__result-info">
                      <MethodBadge method={result.endpoint_method} />
                      <span className="api-testing__result-name">{result.endpoint_name}</span>
                    </div>
                    <div className="api-testing__result-meta">
                      <StatusBadge status={result.status} />
                      {result.response_status_code && (
                        <span className="api-testing__result-code">{result.response_status_code}</span>
                      )}
                      <span className="api-testing__result-time">{result.execution_time_ms}ms</span>
                    </div>
                  </div>
                  
                  {result.error_message && (
                    <div className="api-testing__result-error">
                      <AlertCircle className="h-4 w-4" />
                      {result.error_message}
                    </div>
                  )}
                  
                  <div className="api-testing__result-url">{result.request_url}</div>
                </div>
              ))
            ) : (
              <div className="api-testing__results-empty">No results available</div>
            )}
          </div>
        </div>

        <div className="api-testing__modal-footer">
          <button onClick={onClose} className="api-testing__btn api-testing__btn--primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Collection Card Component
// ============================================
function CollectionCard({
  collection,
  isExpanded,
  onToggle,
  onRun,
  onDelete,
  onAddEndpoint,
  onAddCredential,
  endpoints,
  credentials,
  isLoadingEndpoints,
  onRunEndpoint,
  onDeleteEndpoint,
  onDeleteCredential
}: {
  collection: APICollection;
  isExpanded: boolean;
  onToggle: () => void;
  onRun: (credentialId?: string) => void;
  onDelete: () => void;
  onAddEndpoint: () => void;
  onAddCredential: () => void;
  endpoints: APIEndpoint[];
  credentials: AuthCredential[];
  isLoadingEndpoints: boolean;
  onRunEndpoint: (endpointId: string, credentialId?: string) => void;
  onDeleteEndpoint: (endpointId: string) => void;
  onDeleteCredential: (credentialId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<string>('');

  return (
    <div className={`api-testing__collection ${isExpanded ? 'api-testing__collection--expanded' : ''}`}>
      <div className="api-testing__collection-header" onClick={onToggle}>
        <div className="api-testing__collection-toggle">
          {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </div>
        
        <div className="api-testing__collection-icon">
          <Folder className="h-5 w-5" />
        </div>
        
        <div className="api-testing__collection-info">
          <h3 className="api-testing__collection-name">{collection.name}</h3>
          <p className="api-testing__collection-meta">
            {collection.api_count || 0} APIs • {collection.execution_order}
            {collection.last_run && (
              <> • Last run: <StatusBadge status={collection.last_run.status} /></>
            )}
          </p>
        </div>

        <div className="api-testing__collection-actions" onClick={e => e.stopPropagation()}>
          {credentials.length > 0 && (
            <select
              value={selectedCredential}
              onChange={e => setSelectedCredential(e.target.value)}
              className="api-testing__select api-testing__select--small"
              onClick={e => e.stopPropagation()}
            >
              <option value="">No Auth</option>
              {credentials.map(cred => (
                <option key={cred.id} value={cred.id}>{cred.name}</option>
              ))}
            </select>
          )}
          
          <button
            className="api-testing__btn api-testing__btn--success api-testing__btn--small"
            onClick={() => onRun(selectedCredential || undefined)}
          >
            <Play className="h-4 w-4" />
            Run All
          </button>

          <div className="api-testing__dropdown">
            <button
              className="api-testing__btn api-testing__btn--icon"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showActions && (
              <div className="api-testing__dropdown-menu">
                <button onClick={onAddEndpoint}>
                  <Link2 className="h-4 w-4" />
                  Add API
                </button>
                <button onClick={onAddCredential}>
                  <Key className="h-4 w-4" />
                  Add Credential
                </button>
                <button onClick={onDelete} className="api-testing__dropdown-item--danger">
                  <Trash2 className="h-4 w-4" />
                  Delete Collection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="api-testing__collection-content">
          {/* Credentials Section */}
          {credentials.length > 0 && (
            <div className="api-testing__section">
              <div className="api-testing__section-header">
                <Key className="h-4 w-4" />
                <span>Credentials ({credentials.length})</span>
              </div>
              <div className="api-testing__credentials-list">
                {credentials.map(cred => (
                  <div key={cred.id} className="api-testing__credential-item">
                    <div className="api-testing__credential-info">
                      <span className="api-testing__credential-name">{cred.name}</span>
                      <span className="api-testing__credential-type">{cred.auth_type.replace('_', ' ')}</span>
                    </div>
                    <button
                      className="api-testing__btn api-testing__btn--icon api-testing__btn--danger"
                      onClick={() => onDeleteCredential(cred.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Endpoints Section */}
          <div className="api-testing__section">
            <div className="api-testing__section-header">
              <Link2 className="h-4 w-4" />
              <span>API Endpoints ({endpoints.length})</span>
              <button className="api-testing__btn api-testing__btn--secondary api-testing__btn--small" onClick={onAddEndpoint}>
                <Plus className="h-4 w-4" />
                Add API
              </button>
            </div>

            {isLoadingEndpoints ? (
              <div className="api-testing__loading-inline">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading endpoints...
              </div>
            ) : endpoints.length > 0 ? (
              <div className="api-testing__endpoints-list">
                {endpoints.map(endpoint => (
                  <div key={endpoint.id} className="api-testing__endpoint-item">
                    <div className="api-testing__endpoint-info">
                      <MethodBadge method={endpoint.http_method} />
                      <div className="api-testing__endpoint-details">
                        <span className="api-testing__endpoint-name">{endpoint.name}</span>
                        <span className="api-testing__endpoint-url">{endpoint.url}</span>
                      </div>
                    </div>
                    <div className="api-testing__endpoint-actions">
                      <span className="api-testing__endpoint-status">
                        Expected: {endpoint.expected_status_code}
                      </span>
                      <button
                        className="api-testing__btn api-testing__btn--success api-testing__btn--small"
                        onClick={() => onRunEndpoint(endpoint.id, selectedCredential || undefined)}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        className="api-testing__btn api-testing__btn--icon api-testing__btn--danger"
                        onClick={() => onDeleteEndpoint(endpoint.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="api-testing__empty-inline">
                <p>No endpoints yet.</p>
                <button className="api-testing__btn api-testing__btn--primary api-testing__btn--small" onClick={onAddEndpoint}>
                  <Plus className="h-4 w-4" />
                  Add First API
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// Main APITesting Component
export function APITesting() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const queryClient = useQueryClient();

  // State
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showCreateEndpoint, setShowCreateEndpoint] = useState<string | null>(null);
  const [showCreateCredential, setShowCreateCredential] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(null);
  const [runningCollection, setRunningCollection] = useState<string | null>(null);
  const [runningEndpoint, setRunningEndpoint] = useState<string | null>(null);

  // Queries
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
  });

  const { data: collectionsData, isLoading: isLoadingCollections, refetch: refetchCollections } = useQuery({
    queryKey: ['api-collections', projectId],
    queryFn: () => apiTestingApi.listCollections({ project_id: projectId }),
    enabled: !!projectId,
  });

  const collections = collectionsData?.results || [];

  // Fetch endpoints for expanded collection
  const { data: endpointsData, isLoading: isLoadingEndpoints } = useQuery({
    queryKey: ['api-endpoints', expandedCollection],
    queryFn: () => apiTestingApi.listEndpoints({ collection: expandedCollection! }),
    enabled: !!expandedCollection,
  });

  const endpoints = endpointsData?.results || [];

  // Fetch credentials for expanded collection
  const { data: credentialsData } = useQuery({
    queryKey: ['api-credentials', expandedCollection],
    queryFn: () => apiTestingApi.listCredentials({ collection: expandedCollection! }),
    enabled: !!expandedCollection,
  });

  const credentials = credentialsData?.results || [];

  // Mutations
  const runCollectionMutation = useMutation({
    mutationFn: ({ collectionId, credentialId }: { collectionId: string; credentialId?: string }) =>
      apiTestingApi.runCollection(collectionId, { credential_id: credentialId }),
    onSuccess: (data) => {
      setSelectedRun(data);
      setRunningCollection(null);
      queryClient.invalidateQueries({ queryKey: ['api-collections'] });
    },
    onError: () => {
      setRunningCollection(null);
    },
  });

  const runEndpointMutation = useMutation({
    mutationFn: ({ endpointId, credentialId }: { endpointId: string; credentialId?: string }) =>
      apiTestingApi.runEndpoint(endpointId, { credential_id: credentialId }),
    onSuccess: () => {
      setRunningEndpoint(null);
      queryClient.invalidateQueries({ queryKey: ['api-endpoints'] });
    },
    onError: () => {
      setRunningEndpoint(null);
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: apiTestingApi.deleteCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-collections'] });
      setExpandedCollection(null);
    },
  });

  const deleteEndpointMutation = useMutation({
    mutationFn: apiTestingApi.deleteEndpoint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-endpoints'] });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: apiTestingApi.deleteCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-credentials'] });
    },
  });

  // Handlers
  const handleRunCollection = (collectionId: string, credentialId?: string) => {
    setRunningCollection(collectionId);
    runCollectionMutation.mutate({ collectionId, credentialId });
  };

  const handleRunEndpoint = (endpointId: string, credentialId?: string) => {
    setRunningEndpoint(endpointId);
    runEndpointMutation.mutate({ endpointId, credentialId });
  };

  const handleDeleteCollection = (collectionId: string) => {
    if (window.confirm('Are you sure you want to delete this collection? All endpoints and credentials will be lost.')) {
      deleteCollectionMutation.mutate(collectionId);
    }
  };

  const handleDeleteEndpoint = (endpointId: string) => {
    if (window.confirm('Are you sure you want to delete this endpoint?')) {
      deleteEndpointMutation.mutate(endpointId);
    }
  };

  const handleDeleteCredential = (credentialId: string) => {
    if (window.confirm('Are you sure you want to delete this credential?')) {
      deleteCredentialMutation.mutate(credentialId);
    }
  };

  return (
    <div className="api-testing">
      {/* Header */}
      <div className="api-testing__header">
        <div className="api-testing__header-info">
          <h1 className="api-testing__title">
            <Zap className="h-6 w-6" />
            API Testing
          </h1>
          <p className="api-testing__subtitle">
            Test and automate API endpoints for {project?.name || 'this project'}
          </p>
        </div>
        <button
          className="api-testing__btn api-testing__btn--primary"
          onClick={() => setShowCreateCollection(true)}
        >
          <Plus className="h-4 w-4" />
          New Collection
        </button>
      </div>

      {/* Main Content */}
      <div className="api-testing__content">
        {isLoadingCollections ? (
          <LoadingSpinner />
        ) : collections.length > 0 ? (
          <div className="api-testing__collections">
            {collections.map(collection => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                isExpanded={expandedCollection === collection.id}
                onToggle={() => setExpandedCollection(
                  expandedCollection === collection.id ? null : collection.id
                )}
                onRun={(credentialId) => handleRunCollection(collection.id, credentialId)}
                onDelete={() => handleDeleteCollection(collection.id)}
                onAddEndpoint={() => setShowCreateEndpoint(collection.id)}
                onAddCredential={() => setShowCreateCredential(collection.id)}
                endpoints={expandedCollection === collection.id ? endpoints : []}
                credentials={expandedCollection === collection.id ? credentials : []}
                isLoadingEndpoints={isLoadingEndpoints && expandedCollection === collection.id}
                onRunEndpoint={handleRunEndpoint}
                onDeleteEndpoint={handleDeleteEndpoint}
                onDeleteCredential={handleDeleteCredential}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Folder}
            title="No Collections Yet"
            description="Create your first API collection to start testing endpoints"
            action={{
              label: 'Create Collection',
              onClick: () => setShowCreateCollection(true),
            }}
          />
        )}
      </div>

      {/* Running Overlay */}
      {(runningCollection || runningEndpoint) && (
        <div className="api-testing__running-overlay">
          <div className="api-testing__running-content">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Running {runningCollection ? 'collection' : 'endpoint'}...</p>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateCollection && (
        <CreateCollectionModal
          projectId={projectId}
          onClose={() => setShowCreateCollection(false)}
          onSuccess={() => {
            refetchCollections();
          }}
        />
      )}

      {showCreateEndpoint && (
        <CreateEndpointModal
          collectionId={showCreateEndpoint}
          onClose={() => setShowCreateEndpoint(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['api-endpoints'] });
            queryClient.invalidateQueries({ queryKey: ['api-collections'] });
          }}
        />
      )}

      {showCreateCredential && (
        <CreateCredentialModal
          collectionId={showCreateCredential}
          onClose={() => setShowCreateCredential(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['api-credentials'] });
          }}
        />
      )}

      {selectedRun && (
        <ExecutionResultsModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </div>
  );
}