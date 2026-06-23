import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/services/api';
import { TableView } from '@/components/layout/DualView/TableView';
import { getWorkspaceTableColumns } from '@/components/layout/DualView/WorkspaceConfig';
import DeleteModal from '@/components/common/Deletemodal';
import type { Tenant } from '@/types';

export function WorkSpace() {
    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['organizations-overview'],
        queryFn: organizationsApi.overview,
        staleTime: 30_000,
    });

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteRequest = useCallback((tenant: Tenant) => {
        setDeleteTarget(tenant);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await organizationsApi.delete(deleteTarget.id);
            // Optimistically remove from cached data
            queryClient.setQueryData<import('@/types').OrganizationsOverviewResponse>(
                ['organizations-overview'],
                (old) => {
                    if (!old) return old;
                    const tenants = old.tenants.filter((t) => t.id !== deleteTarget.id);
                    const active = tenants.filter((t) => t.is_active).length;
                    return {
                        ...old,
                        tenants,
                        platform_summary: {
                            ...old.platform_summary,
                            total_organizations: tenants.length,
                            active_organizations: active,
                            inactive_organizations: tenants.length - active,
                        },
                    };
                }
            );
        } catch (err) {
            console.error('Failed to delete organization:', err);
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    }, [deleteTarget, queryClient]);

    const handleDeleteCancel = useCallback(() => {
        if (!isDeleting) setDeleteTarget(null);
    }, [isDeleting]);

    // ─── Toggle status handler — updates cache optimistically ─────────────────
    const handleStatusToggled = useCallback((id: number, isActive: boolean) => {
        queryClient.setQueryData<import('@/types').OrganizationsOverviewResponse>(
            ['organizations-overview'],
            (old) => {
                if (!old) return old;
                const tenants = old.tenants.map((t) =>
                    t.id === id ? { ...t, is_active: isActive } : t
                );
                const active = tenants.filter((t) => t.is_active).length;
                return {
                    ...old,
                    tenants,
                    platform_summary: {
                        ...old.platform_summary,
                        active_organizations: active,
                        inactive_organizations: tenants.length - active,
                    },
                };
            }
        );
    }, [queryClient]);

    // ─── Columns (pass delete + toggle handlers) ──────────────────────────────
    const columns = getWorkspaceTableColumns(handleDeleteRequest, handleStatusToggled);
    const tenants: Tenant[] = data?.tenants ?? [];

    return (
        <>
            {/* Delete confirmation modal */}
            <DeleteModal
                isOpen={!!deleteTarget}
                type="confirm"
                itemType="organization"
                itemName={deleteTarget?.name}
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
                isDeleting={isDeleting}
            />

            {/* ── Main Responsive Wrapper ── */}
            <div className="flex flex-col h-full bg-[#F7F8FB] px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6 pb-8">
                
                {/* ── Inner Card Container ── */}
                <div className="flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                    {/* ── Header ── */}
                    <div className="px-6 pt-6 pb-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-foreground">Workspace</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Manage all registered organizations on the platform
                        </p>
                    </div>

                    {/* ── Table ── */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                        {isError ? (
                        <div className="flex items-center justify-center py-16 text-sm text-red-500">
                            Failed to load organizations. Please try again.
                        </div>
                    ) : (
                        <TableView<Tenant>
                            data={tenants}
                            columns={columns}
                            rowKey={(t) => t.id}
                            isLoading={isLoading}
                            maxHeight="calc(100vh - 140px)"
                            emptyState={
                                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                                    <span className="text-sm">No organizations found</span>
                                </div>
                            }
                        />
                    )}
                </div>
            </div>
            </div>
        </>
    );
}