import React from 'react';
import { Search, Building2, Users, CheckCircle, XCircle, Plus } from 'lucide-react';
import { useOrganization } from './hooks/useOrganization';
import { OrgDetailPanel } from './components/OrgDetailPanel';
import DeleteModal from '@/components/common/Deletemodal';
import { StatusToggleCell } from '@/components/layout/DualView/WorkspaceConfig';
import { BLUE, LINE, TEXT, MUTED } from '@/config/tokens';
import { formatRelativeTime } from '@/lib/utils';
import type { Tenant } from '@/types';

// ── Shared table styles — same as Projects page ───────────────────────────────
const th: React.CSSProperties = { textAlign: 'left', color: '#172033', fontSize: 14, fontWeight: 800, padding: '14px 16px', borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, background: '#f9fafb', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
const td: React.CSSProperties = { padding: '14px 16px', borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, verticalAlign: 'middle', fontSize: 14, color: TEXT };

// ── Summary card — same pattern as Project status pills ───────────────────────
function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, flex: 1, minWidth: 140 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}18`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {React.cloneElement(icon as React.ReactElement, { size: 16, style: { color } })}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Main exported component (named export kept for backward compat) ────────────
export function WorkSpace() {
  const o = useOrganization();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>
      <DeleteModal
        isOpen={!!o.deleteTarget}
        type="confirm"
        itemType="organization"
        itemName={o.deleteTarget?.name}
        onConfirm={o.handleDeleteConfirm}
        onCancel={o.handleDeleteCancel}
        isDeleting={o.isDeleting}
      />

      {/* ── Sticky header — same pattern as Projects page ── */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
        style={{ flexShrink: 0, background: '#fff', borderBottom: `1px solid ${LINE}`, paddingTop: 16, paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: '-.04em' }}>Organizations</h1>
            <p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>Manage all registered organizations on the platform</p>
          </div>
        </div>

        {/* Search + status filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, height: 40, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
            <Search size={16} color={MUTED} style={{ flexShrink: 0 }} />
            <input
              value={o.searchTerm}
              onChange={e => o.setSearchTerm(e.target.value)}
              placeholder="Search organizations by name or slug…"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: TEXT, background: 'transparent', fontFamily: 'inherit' }}
            />
          </div>
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => o.setStatusFilter(s)}
              style={{ height: 40, padding: '0 16px', borderRadius: 8, border: `1px solid ${o.statusFilter === s ? BLUE : LINE}`, background: o.statusFilter === s ? '#EEF4FF' : '#fff', color: o.statusFilter === s ? BLUE : TEXT, fontWeight: 600, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s === 'all' ? 'All' : s === 'active' ? '● Active' : '○ Inactive'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40"
        style={{ flex: 1, overflowY: 'auto', paddingTop: 24, paddingBottom: 32 }}>

        {/* Summary cards */}
        {o.summary && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <SummaryCard icon={<Building2 />} label="Total Organizations" value={o.summary.total_organizations} color="#4f46e5" />
            <SummaryCard icon={<CheckCircle />} label="Active" value={o.summary.active_organizations} color="#09925e" />
            <SummaryCard icon={<XCircle />} label="Inactive" value={o.summary.inactive_organizations} color="#dc2626" />
            <SummaryCard icon={<Users />} label="Total Users" value={o.summary.total_users} color="#2563eb" />
          </div>
        )}

        {/* Table + optional detail panel side-by-side */}
        <div style={{ display: 'flex', gap: 0, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>

          {/* Table */}
          <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
            {o.isError ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#dc2626', fontSize: 14 }}>Failed to load organizations. Please try again.</div>
            ) : o.isLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 14 }}>Loading…</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={th}>Organization</th>
                    <th style={th}>Status</th>
                    <th style={th}>Users</th>
                    <th style={th}>Projects</th>
                    <th style={th}>Tasks</th>
                    <th style={th}>Teams</th>
                    <th style={th}>Created</th>
                    <th style={th}>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {o.filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: MUTED, padding: 48 }}>No organizations found</td></tr>
                  ) : o.filtered.map((t: Tenant) => {
                    const isSelected = o.detailOrgId === t.id;
                    return (
                      <tr key={t.id}
                        onClick={() => o.setDetailOrgId(isSelected ? null : t.id)}
                        style={{ background: isSelected ? '#f0f4ff' : undefined, cursor: 'pointer' }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ''; }}
                      >
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 7, background: '#EEF4FF', display: 'grid', placeItems: 'center', color: BLUE, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                              {t.name[0].toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                              <div style={{ fontSize: 11, color: MUTED }}>{t.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td style={td} onClick={e => e.stopPropagation()}>
                          <StatusToggleCell tenant={t} onToggled={o.handleStatusToggled} />
                        </td>
                        <td style={{ ...td, fontWeight: 600, color: '#4f46e5' }}>{t.stats.users}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#2563eb' }}>{t.stats.projects}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#7c3aed' }}>{t.stats.tasks}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#059669' }}>{t.stats.teams}</td>
                        <td style={{ ...td, color: MUTED, fontSize: 13 }}>{formatRelativeTime(t.created_at)}</td>
                        <td style={td}>
                          {t.admins[0] ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{t.admins[0].username}</div>
                              <div style={{ fontSize: 11, color: MUTED }}>{t.admins[0].email}</div>
                            </div>
                          ) : <span style={{ color: MUTED }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail panel — slides in when row is clicked, same as Project detail panel */}
          {o.detailOrgId && (
            <OrgDetailPanel
              orgId={o.detailOrgId}
              onClose={() => o.setDetailOrgId(null)}
              onDelete={() => {
                const t = o.filtered.find(x => x.id === o.detailOrgId);
                if (t) o.setDeleteTarget(t);
              }}
            />
          )}
        </div>

        {/* Count */}
        {!o.isLoading && (
          <div style={{ marginTop: 14, fontSize: 13, color: MUTED }}>
            Showing <strong>{o.filtered.length}</strong> of <strong>{o.allTenants.length}</strong> organizations
          </div>
        )}
      </div>
    </div>
  );
}