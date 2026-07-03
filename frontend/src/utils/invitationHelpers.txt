import { InvitationStatus } from '@/types';

// ============================================================================
// INVITATION STATUS HELPER FUNCTIONS
// Create this file: src/utils/invitationHelpers.ts
// Or add these functions to your existing utils file
// ============================================================================

/**
 * Get background and border colors for event cards based on invitation status
 */
export const getEventStatusColors = (
    status: InvitationStatus | undefined, 
    isOrganizer: boolean
): string => {
    if (isOrganizer || status === 'ORGANIZER') {
        return 'border-l-blue-500 bg-blue-50 text-blue-800';
    }
    
    switch (status) {
        case 'PENDING':
            return 'border-l-amber-500 bg-amber-50 text-amber-800';
        case 'ACCEPTED':
            return 'border-l-emerald-500 bg-emerald-50 text-emerald-800';
        case 'DECLINED':
            return 'border-l-red-400 bg-red-50 text-red-600 opacity-60';
        default:
            return 'border-l-gray-400 bg-gray-50 text-gray-700';
    }
};

/**
 * Get badge/pill colors for status indicators
 */
export const getStatusBadgeColors = (status: InvitationStatus | undefined): string => {
    switch (status) {
        case 'PENDING':
            return 'bg-amber-500 text-white';
        case 'ACCEPTED':
            return 'bg-emerald-500 text-white';
        case 'DECLINED':
            return 'bg-red-500 text-white';
        case 'ORGANIZER':
            return 'bg-blue-500 text-white';
        default:
            return 'bg-gray-500 text-white';
    }
};

/**
 * Get status icon emoji
 */
export const getStatusIcon = (status: InvitationStatus | undefined): string => {
    switch (status) {
        case 'PENDING':
            return '⏳';
        case 'ACCEPTED':
            return '✓';
        case 'DECLINED':
            return '✕';
        case 'ORGANIZER':
            return '👤';
        default:
            return '';
    }
};

/**
 * Get status display label
 */
export const getStatusLabel = (status: InvitationStatus | undefined): string => {
    switch (status) {
        case 'PENDING':
            return 'Pending';
        case 'ACCEPTED':
            return 'Accepted';
        case 'DECLINED':
            return 'Declined';
        case 'ORGANIZER':
            return 'Organizer';
        default:
            return '';
    }
};

/**
 * Check if the event requires action (has pending invitation)
 */
export const requiresAction = (status: InvitationStatus | undefined): boolean => {
    return status === 'PENDING';
};

/**
 * Check if the event should be displayed prominently
 */
export const isActiveEvent = (status: InvitationStatus | undefined): boolean => {
    return status === 'ACCEPTED' || status === 'ORGANIZER';
};