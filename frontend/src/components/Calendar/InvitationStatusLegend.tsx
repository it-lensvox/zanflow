import React from 'react';

interface InvitationStatusLegendProps {
    className?: string;
}

const InvitationStatusLegend: React.FC<InvitationStatusLegendProps> = ({ className = '' }) => {
    const statuses = [
        { color: 'bg-blue-500', label: 'Organizer' },
        { color: 'bg-amber-500', label: 'Pending' },
        { color: 'bg-emerald-500', label: 'Accepted' },
        { color: 'bg-red-500', label: 'Declined' },
    ];

    return (
        <div className={`flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs ${className}`}>
            <span className="text-gray-500 font-medium">Status:</span>
            {statuses.map((status) => (
                <div key={status.label} className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 ${status.color} rounded-full`} />
                    <span className="text-gray-600">{status.label}</span>
                </div>
            ))}
        </div>
    );
};

export default InvitationStatusLegend;