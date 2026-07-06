import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface DeclineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDecline: (reason: string) => void;
    isLoading: boolean;
    eventTitle?: string;
}

const DeclineModal: React.FC<DeclineModalProps> = ({
    isOpen,
    onClose,
    onDecline,
    isLoading,
    eventTitle,
}) => {
    const [reason, setReason] = React.useState('');

    const quickReasons = [
        "Conflict with another meeting",
        "Out of office",
        "Not available at this time",
        "Will send delegate instead",
        "Personal commitment",
    ];

    // Reset reason when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setReason('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            <div 
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <X className="text-red-600" size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">Decline invitation</h3>
                        {eventTitle && (
                            <p className="text-sm text-gray-500 truncate">{eventTitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4">
                    Let the organizer know why you can't attend. This helps them understand your availability.
                </p>

                {/* Quick reason buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {quickReasons.map((qr) => (
                        <button
                            key={qr}
                            type="button"
                            onClick={() => setReason(qr)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                                reason === qr
                                    ? 'bg-red-100 border-red-300 text-red-700 font-medium'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {qr}
                        </button>
                    ))}
                </div>

                {/* Custom reason input */}
                <div className="mb-5">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Reason for declining
                    </label>
                    <textarea
                        placeholder="Or write a custom reason..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (reason.trim()) {
                                onDecline(reason.trim());
                            }
                        }}
                        disabled={!reason.trim() || isLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        {isLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>
                                <X size={18} />
                                Decline invitation
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeclineModal;