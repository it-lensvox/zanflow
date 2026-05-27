import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Settings2,
  Palette,
  Bell,
  Shield,
  Monitor,
  Cloud,
  Sun,
  Moon,
  LayoutGrid,
  Table2,
  Globe,
  Type,
  PanelLeft,
  BellRing,
  Mail,
  MessageSquare,
  ClipboardList,
  Volume2,
  Clock,
  Smartphone,
  Trash2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common';

// Toggle Switch
function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-primary' : 'bg-muted'
        }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
    </button>
  );
}

// Segmented Control 
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-muted/40 p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${value === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Select Dropdown 
function SettingSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// Row
function SettingRow({
  icon,
  label,
  description,
  control,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="ml-6 shrink-0">{control}</div>
    </div>
  );
}

// Section Card
function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

// ✅ Workspace interface
interface Workspace {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  member_count: number;
  role: 'admin' | 'manager' | 'member';
  created_by?: number;
  created_at: string;
  updated_at: string;
}

// Main Settings Page 
export function Settings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Configuration
  const [dataMode, setDataMode] = useState<'local' | 'cloud'>('cloud');
  const [defaultView, setDefaultView] = useState<'grid' | 'table'>('grid');
  const [language, setLanguage] = useState('en');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

  // Appearance
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSize, setFontSize] = useState('medium');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Notifications
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [chatMentions, setChatMentions] = useState(true);
  const [taskAssignments, setTaskAssignments] = useState(true);
  const [notifSound, setNotifSound] = useState(true);

  // Security
  const [autoLogout, setAutoLogout] = useState('30');
  const [sessionAlerts, setSessionAlerts] = useState(true);

  // ✅ Delete Workspace State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // ✅ Fetch workspace data
  const { data: workspaceData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.getWorkspaces,
  });

  const workspaces = workspaceData?.workspaces || [];
  const activeWorkspaceId = workspaceData?.active_workspace_id || workspaceApi.getActiveWorkspaceId();
  const activeWorkspace = workspaces.find((w: Workspace) => w.id === activeWorkspaceId);

  // ✅ Check if user can delete current workspace
  const canDeleteWorkspace = (): boolean => {
    if (!activeWorkspace) return false;
    if (activeWorkspace.is_default) return false;
    if (activeWorkspace.created_by && user?.id) {
      return activeWorkspace.created_by === user.id;
    }
    return false;
  };

  // ✅ Handle Delete Workspace
  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) return;

    setIsDeleting(true);

    try {
      await workspaceApi.deleteWorkspace(activeWorkspace.id);

      // Switch to default workspace
      const defaultWorkspace = workspaces.find((w: Workspace) => w.is_default);
      if (defaultWorkspace) {
        localStorage.setItem('active_workspace_id', String(defaultWorkspace.id));
      }

      setShowDeleteModal(false);
      setDeleteConfirmText('');

      // Refetch and reload
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      window.location.href = '/';
    } catch (error: any) {
      console.error('Failed to delete workspace:', error);
      alert(error.message || 'Failed to delete workspace');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your preferences and account configuration
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* ── Configuration ── */}
          <SectionCard title="Configuration">
            <SettingRow
              icon={<Monitor className="h-4 w-4" />}
              label="Data Mode"
              description="Choose where your data is stored and synced"
              control={
                <SegmentedControl
                  options={[
                    { label: 'Local', value: 'local', icon: <Monitor className="h-3.5 w-3.5" /> },
                    { label: 'Cloud', value: 'cloud', icon: <Cloud className="h-3.5 w-3.5" /> },
                  ]}
                  value={dataMode}
                  onChange={setDataMode}
                />
              }
            />
            <SettingRow
              icon={<LayoutGrid className="h-4 w-4" />}
              label="Default Project View"
              description="How projects and tasks are displayed by default"
              control={
                <SegmentedControl
                  options={[
                    { label: 'Grid', value: 'grid', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                    { label: 'Table', value: 'table', icon: <Table2 className="h-3.5 w-3.5" /> },
                  ]}
                  value={defaultView}
                  onChange={setDefaultView}
                />
              }
            />
            <SettingRow
              icon={<Globe className="h-4 w-4" />}
              label="Language"
              description="Interface display language"
              control={
                <SettingSelect
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { label: 'English', value: 'en' },
                    { label: 'Hindi', value: 'hi' },
                    { label: 'Spanish', value: 'es' },
                    { label: 'French', value: 'fr' },
                  ]}
                />
              }
            />
            <SettingRow
              icon={<Clock className="h-4 w-4" />}
              label="Date Format"
              description="How dates appear across the app"
              control={
                <SettingSelect
                  value={dateFormat}
                  onChange={setDateFormat}
                  options={[
                    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
                    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
                    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
                  ]}
                />
              }
            />
          </SectionCard>

          {/* ── Appearance ── */}
          <SectionCard title="Appearance">
            <SettingRow
              icon={<Palette className="h-4 w-4" />}
              label="Theme"
              description="Choose your preferred color scheme"
              control={
                <SegmentedControl
                  options={[
                    { label: 'Light', value: 'light', icon: <Sun className="h-3.5 w-3.5" /> },
                    { label: 'Dark', value: 'dark', icon: <Moon className="h-3.5 w-3.5" /> },
                  ]}
                  value={theme}
                  onChange={setTheme}
                />
              }
            />
            <SettingRow
              icon={<Type className="h-4 w-4" />}
              label="Font Size"
              description="Adjust text size for readability"
              control={
                <SettingSelect
                  value={fontSize}
                  onChange={setFontSize}
                  options={[
                    { label: 'Small', value: 'small' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Large', value: 'large' },
                  ]}
                />
              }
            />
            <SettingRow
              icon={<PanelLeft className="h-4 w-4" />}
              label="Collapsed Sidebar by Default"
              description="Start with the sidebar minimized on load"
              control={
                <Toggle enabled={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
              }
            />
          </SectionCard>

          {/* ── Notifications ── */}
          <SectionCard title="Notifications">
            <SettingRow
              icon={<BellRing className="h-4 w-4" />}
              label="Desktop Notifications"
              description="Push alerts in your browser"
              control={
                <Toggle enabled={desktopNotifs} onToggle={() => setDesktopNotifs(!desktopNotifs)} />
              }
            />
            <SettingRow
              icon={<Mail className="h-4 w-4" />}
              label="Email Notifications"
              description="Receive updates to your inbox"
              control={
                <Toggle enabled={emailNotifs} onToggle={() => setEmailNotifs(!emailNotifs)} />
              }
            />
            <SettingRow
              icon={<MessageSquare className="h-4 w-4" />}
              label="Chat Mention Alerts"
              description="Notify when someone @mentions you in chat"
              control={
                <Toggle enabled={chatMentions} onToggle={() => setChatMentions(!chatMentions)} />
              }
            />
            <SettingRow
              icon={<ClipboardList className="h-4 w-4" />}
              label="Task Assignment Alerts"
              description="Notify when a task is assigned to you"
              control={
                <Toggle enabled={taskAssignments} onToggle={() => setTaskAssignments(!taskAssignments)} />
              }
            />
            <SettingRow
              icon={<Volume2 className="h-4 w-4" />}
              label="Notification Sound"
              description="Play a sound for incoming notifications"
              control={
                <Toggle enabled={notifSound} onToggle={() => setNotifSound(!notifSound)} />
              }
            />
          </SectionCard>

          {/* ── Security ── */}
          <SectionCard title="Security">
            <SettingRow
              icon={<Clock className="h-4 w-4" />}
              label="Auto-logout Timeout"
              description="Sign out automatically after inactivity"
              control={
                <SettingSelect
                  value={autoLogout}
                  onChange={setAutoLogout}
                  options={[
                    { label: '15 minutes', value: '15' },
                    { label: '30 minutes', value: '30' },
                    { label: '1 hour', value: '60' },
                    { label: 'Never', value: '0' },
                  ]}
                />
              }
            />
            <SettingRow
              icon={<Smartphone className="h-4 w-4" />}
              label="Active Session Alerts"
              description="Get notified when a new device logs into your account"
              control={
                <Toggle enabled={sessionAlerts} onToggle={() => setSessionAlerts(!sessionAlerts)} />
              }
            />

            {/* ✅ DANGER ZONE - Delete Workspace */}
            {activeWorkspace && canDeleteWorkspace() && (
              <>
                <div className="pt-6 mt-4 border-t-2 border-red-200">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-red-600 mb-1">
                        Danger Zone
                      </h3>
                      <p className="text-xs text-gray-600">
                        Irreversible and destructive actions
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                          Delete Workspace
                        </h4>
                        <p className="text-xs text-gray-600 mb-2">
                          Permanently delete "{activeWorkspace.name}" and all its data
                        </p>
                        <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
                          <li>All projects and tasks will be deleted</li>
                          <li>All documents and files will be removed</li>
                          <li>All members will lose access</li>
                          <li>This action cannot be undone</li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="ml-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Workspace
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ✅ Delete Confirmation Modal */}
      {showDeleteModal && activeWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Workspace?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium mb-2">
                You are about to permanently delete "{activeWorkspace.name}"
              </p>
              <p className="text-xs text-red-700">
                This will permanently delete:
              </p>
              <ul className="text-xs text-red-700 list-disc list-inside mt-1 space-y-0.5">
                <li>All projects in this workspace</li>
                <li>All tasks and documents</li>
                <li>All team data and chat rooms</li>
                <li>All workspace members will lose access</li>
              </ul>
            </div>

            {/* Confirmation Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-semibold text-red-600">"{activeWorkspace.name}"</span> to confirm:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={activeWorkspace.name}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {deleteConfirmText.length > 0 && (
                    <>
                      {deleteConfirmText === activeWorkspace.name ? (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {deleteConfirmText.length > 0 && deleteConfirmText !== activeWorkspace.name && (
                <p className="mt-1 text-xs text-red-600">
                  Workspace name does not match
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                disabled={isDeleting || deleteConfirmText !== activeWorkspace.name}
                className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}