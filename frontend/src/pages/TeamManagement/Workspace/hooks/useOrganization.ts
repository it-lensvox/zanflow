import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/services/api';
import type { Tenant, OrganizationsOverviewResponse } from '@/types';

export function useOrganization() {
  const queryClient = useQueryClient();

  // ── UI state
  const [searchTerm,    setSearchTerm]    = useState('');
  const [statusFilter,  setStatusFilter]  = useState<'all' | 'active' | 'inactive'>('all');
  const [detailOrgId,   setDetailOrgId]   = useState<number | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<Tenant | null>(null);
  const [isDeleting,    setIsDeleting]    = useState(false);

  // ── Data
  const { data, isLoading, isError } = useQuery({
    queryKey: ['organizations-overview'],
    queryFn: organizationsApi.overview,
    staleTime: 30_000,
  });

  const allTenants: Tenant[] = data?.tenants ?? [];
  const summary = data?.platform_summary;

  // ── Filter
  const filtered = useMemo(() => {
    return allTenants.filter(t => {
      if (statusFilter === 'active'   && !t.is_active) return false;
      if (statusFilter === 'inactive' &&  t.is_active) return false;
      if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !t.slug.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [allTenants, statusFilter, searchTerm]);

  // ── Optimistic status toggle
  const handleStatusToggled = useCallback((id: number, isActive: boolean) => {
    queryClient.setQueryData<OrganizationsOverviewResponse>(
      ['organizations-overview'],
      (old) => {
        if (!old) return old;
        const tenants = old.tenants.map(t => t.id === id ? { ...t, is_active: isActive } : t);
        const active = tenants.filter(t => t.is_active).length;
        return {
          ...old, tenants,
          platform_summary: {
            ...old.platform_summary,
            active_organizations: active,
            inactive_organizations: tenants.length - active,
          },
        };
      }
    );
  }, [queryClient]);

  // ── Delete
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await organizationsApi.delete(deleteTarget.id);
      queryClient.setQueryData<OrganizationsOverviewResponse>(
        ['organizations-overview'],
        (old) => {
          if (!old) return old;
          const tenants = old.tenants.filter(t => t.id !== deleteTarget.id);
          const active = tenants.filter(t => t.is_active).length;
          return {
            ...old, tenants,
            platform_summary: {
              ...old.platform_summary,
              total_organizations: tenants.length,
              active_organizations: active,
              inactive_organizations: tenants.length - active,
            },
          };
        }
      );
      setDetailOrgId(null);
    } catch (err) {
      console.error('Failed to delete organization:', err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, queryClient]);

  return {
    // data
    allTenants, filtered, isLoading, isError, summary,
    // filters
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    // detail
    detailOrgId, setDetailOrgId,
    // delete
    deleteTarget, setDeleteTarget,
    isDeleting,
    handleDeleteConfirm,
    handleDeleteCancel: () => { if (!isDeleting) setDeleteTarget(null); },
    handleStatusToggled,
  };
}