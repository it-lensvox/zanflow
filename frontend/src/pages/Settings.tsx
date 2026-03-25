import React, { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';

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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        enabled ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
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
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
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

//Select Dropdown 
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

// Main Settings Page
export function Settings() {
  // Configuration
  const [dataMode, setDataMode] = useState<'local' | 'cloud'>('cloud');
  const [defaultView, setDefaultView] = useState<'grid' | 'table'>('grid');
  const [language, setLanguage] = useState('en');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

  // Appearance — theme driven by global ThemeContext
  const { theme, setTheme } = useTheme();
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

  return (
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
          {/* Theme picker — visual card style */}
          <div className="py-4 border-b border-border">
            <div className="flex items-start gap-3 mb-4">
              <span className="mt-0.5 text-muted-foreground"><Palette className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-medium text-foreground">Theme</p>
                <p className="text-xs text-muted-foreground mt-0.5">Choose your preferred color scheme</p>
              </div>
            </div>
            <div className="flex gap-3 pl-7">
              {/* Light card */}
              <button
                onClick={() => setTheme('light')}
                className={`group relative flex-1 rounded-xl border-2 overflow-hidden transition-all duration-200 focus:outline-none ${
                  theme === 'light'
                    ? 'border-primary shadow-md shadow-primary/20'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                {/* Preview */}
                <div className="bg-white p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-slate-200" />
                    <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100" />
                  <div className="h-1.5 w-4/5 rounded-full bg-slate-100" />
                  <div className="flex gap-1 pt-0.5">
                    <div className="h-4 w-8 rounded bg-blue-100" />
                    <div className="h-4 w-8 rounded bg-slate-100" />
                  </div>
                </div>
                {/* Label */}
                <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-50 border-t border-slate-100">
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-slate-700">Light</span>
                </div>
                {/* Active tick */}
                {theme === 'light' && (
                  <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 10 10">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </button>

              {/* Dark card */}
              <button
                onClick={() => setTheme('dark')}
                className={`group relative flex-1 rounded-xl border-2 overflow-hidden transition-all duration-200 focus:outline-none ${
                  theme === 'dark'
                    ? 'border-primary shadow-md shadow-primary/20'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                {/* Preview */}
                <div className="bg-slate-900 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-slate-600" />
                    <div className="h-1.5 w-12 rounded-full bg-slate-700" />
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800" />
                  <div className="h-1.5 w-4/5 rounded-full bg-slate-800" />
                  <div className="flex gap-1 pt-0.5">
                    <div className="h-4 w-8 rounded bg-blue-900" />
                    <div className="h-4 w-8 rounded bg-slate-800" />
                  </div>
                </div>
                {/* Label */}
                <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 border-t border-slate-700">
                  <Moon className="h-3.5 w-3.5 text-slate-300" />
                  <span className="text-xs font-medium text-slate-300">Dark</span>
                </div>
                {/* Active tick */}
                {theme === 'dark' && (
                  <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 10 10">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </div>
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
        </SectionCard>
      </div>
    </div>
  );
}
