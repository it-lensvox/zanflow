import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Users, Loader2, CheckCircle } from 'lucide-react';
import { organizationsApi } from '@/services/api';
import { BLUE, LINE, TEXT, MUTED } from '@/config/tokens';
import type { OrgDetailPlatform } from '@/types';

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: '1 1 70px', padding: '10px 12px', background: '#f9fafb', borderRadius: 10, border: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function PlatformRow({ platform, orgId, activePlatformKeys, onUpdated }: {
  platform: OrgDetailPlatform;
  orgId: number;
  activePlatformKeys: Set<string>;
  onUpdated: (updatedKeys: string[], message: string) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const isEnabled = activePlatformKeys.has(platform.key);

  const handleToggle = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await organizationsApi.togglePlatform(orgId, platform.key, !isEnabled);
      onUpdated(result.updated_platforms, result.message);
    } catch (err) {
      console.error('Failed to toggle platform:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isEnabled ? '#f0fdf4' : '#f9fafb', borderRadius: 8, border: `1px solid ${isEnabled ? '#bbf7d0' : LINE}`, transition: 'all 0.15s' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{platform.name}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{platform.key.toUpperCase()}</div>
      </div>
      <button
        onClick={handleToggle}
        disabled={isLoading}
        title={isEnabled ? `Revoke ${platform.name} access` : `Grant ${platform.name} access`}
        style={{ width: 40, height: 22, borderRadius: 11, background: isEnabled ? '#16a34a' : '#d1d5db', border: 'none', cursor: isLoading ? 'wait' : 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0, flexShrink: 0, opacity: isLoading ? 0.6 : 1 }}
      >
        {isLoading
          ? <Loader2 size={11} style={{ color: '#fff', position: 'absolute', top: 6, left: 15 }} className="animate-spin" />
          : <span style={{ display: 'block', width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: isEnabled ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        }
      </button>
    </div>
  );
}

interface Props {
  orgId: number;
  onClose: () => void;
  onDelete: () => void;
}

export function OrgDetailPanel({ orgId, onClose, onDelete }: Props) {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [activePlatformKeys, setActivePlatformKeys] = useState<Set<string> | null>(null);

  const { data: org, isLoading } = useQuery({
    queryKey: ['org-detail', orgId],
    queryFn: () => organizationsApi.getDetail(orgId),
    staleTime: 30_000,
  });

  const effectiveKeys: Set<string> = activePlatformKeys ?? new Set(
    (org?.platforms ?? []).filter(p => p.has_access).map(p => p.key)
  );

  React.useEffect(() => {
    if (org && activePlatformKeys === null) {
      setActivePlatformKeys(new Set(org.platforms.filter(p => p.has_access).map(p => p.key)));
    }
  }, [org, activePlatformKeys]);

  const handlePlatformUpdated = useCallback((updatedKeys: string[], message: string) => {
    setActivePlatformKeys(new Set(updatedKeys));
    queryClient.invalidateQueries({ queryKey: ['org-detail', orgId] });
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }, [queryClient, orgId]);

  return (
    // Overlay drawer — fixed on mobile, side panel on desktop
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: '100%', maxWidth: 380,
      zIndex: 200,
      borderLeft: `1px solid ${LINE}`,
      display: 'flex', flexDirection: 'column',
      background: '#fff',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
    }}>

      {/* Backdrop for mobile — tap outside to close */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: -1, background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org?.name ?? '…'}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{org?.slug}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4, flexShrink: 0 }}>
          <X size={16} />
        </button>
      </div>

      {/* Success toast */}
      {toast && (
        <div style={{ margin: '10px 16px 0', padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={13} /> {toast}
        </div>
      )}

      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={24} style={{ color: BLUE }} className="animate-spin" />
        </div>
      ) : !org ? null : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Stats */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Stats</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatCard label="Users" value={org.stats.users} color="#4f46e5" />
              <StatCard label="Projects" value={org.stats.projects} color="#2563eb" />
              <StatCard label="Tasks" value={org.stats.tasks} color="#7c3aed" />
              <StatCard label="Teams" value={org.stats.teams} color="#059669" />
            </div>
          </section>

          {/* Platform access — live toggle switches */}
          {org.platforms && org.platforms.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Platform Access</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {org.platforms.map(platform => (
                  <PlatformRow
                    key={platform.key}
                    platform={platform}
                    orgId={orgId}
                    activePlatformKeys={effectiveKeys}
                    onUpdated={handlePlatformUpdated}
                  />
                ))}
              </div>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
                Changes take effect on the user's next login.
              </p>
            </section>
          )}

          {/* Users */}
          {org.users && org.users.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                <Users size={11} style={{ display: 'inline', marginRight: 4 }} />Users ({org.users.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {org.users.slice(0, 8).map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#f9fafb', borderRadius: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: '#EEF4FF', display: 'grid', placeItems: 'center', color: BLUE, fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                      {u.username[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</div>
                      <div style={{ fontSize: 10, color: MUTED }}>{u.role}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99, flexShrink: 0, background: u.is_active ? '#eafaf3' : '#f2f4f7', color: u.is_active ? '#09925e' : '#667085' }}>
                      {u.is_active ? 'Active' : 'Off'}
                    </span>
                  </div>
                ))}
                {org.users.length > 8 && <div style={{ fontSize: 12, color: MUTED, textAlign: 'center', paddingTop: 4 }}>+{org.users.length - 8} more</div>}
              </div>
            </section>
          )}
          <section style={{ paddingTop: 8, borderTop: `1px solid ${LINE}` }}>
            <button onClick={onDelete}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              Delete Organization
            </button>
          </section>
        </div>
      )}
    </div>
  );
}