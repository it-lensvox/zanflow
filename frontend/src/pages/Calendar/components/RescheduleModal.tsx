import React from 'react';
import { Calendar as CalendarIcon, X, Loader2, Clock } from 'lucide-react';

interface RescheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onReschedule: (proposedTime: string) => void;
    isLoading: boolean;
    eventTitle?: string;
    originalTime?: string;
}

const RescheduleModal: React.FC<RescheduleModalProps> = ({
    isOpen,
    onClose,
    onReschedule,
    isLoading,
    eventTitle,
    originalTime,
}) => {
    const [proposedTime, setProposedTime] = React.useState('');

    // Reset when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setProposedTime('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Format original time for display
    const formatOriginalTime = originalTime
        ? new Date(originalTime).toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : '';

    // Generate quick time suggestions
    const generateSuggestions = () => {
        const base = originalTime ? new Date(originalTime) : new Date();
        const suggestions = [];

        // Tomorrow same time
        const tomorrow = new Date(base);
        tomorrow.setDate(tomorrow.getDate() + 1);
        suggestions.push({
            label: 'Tomorrow, same time',
            value: tomorrow.toISOString(),
            display: tomorrow.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            }),
        });

        // In 2 days
        const dayAfter = new Date(base);
        dayAfter.setDate(dayAfter.getDate() + 2);
        suggestions.push({
            label: 'In 2 days, same time',
            value: dayAfter.toISOString(),
            display: dayAfter.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            }),
        });

        // Next week
        const nextWeek = new Date(base);
        nextWeek.setDate(nextWeek.getDate() + 7);
        suggestions.push({
            label: 'Next week, same time',
            value: nextWeek.toISOString(),
            display: nextWeek.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            }),
        });

        // Later today (if before 5pm)
        const laterToday = new Date();
        laterToday.setHours(laterToday.getHours() + 2);
        laterToday.setMinutes(0);
        if (laterToday.getHours() < 18) {
            suggestions.unshift({
                label: 'Later today',
                value: laterToday.toISOString(),
                display: laterToday.toLocaleString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                }),
            });
        }

        return suggestions;
    };

    const suggestions = generateSuggestions();

    // Get min datetime (now)
    const getMinDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };

    // Convert local datetime to ISO
    const handleDateTimeChange = (localDateTime: string) => {
        if (localDateTime) {
            const date = new Date(localDateTime);
            setProposedTime(date.toISOString());
        } else {
            setProposedTime('');
        }
    };

    // Get value for datetime-local input
    const getInputValue = () => {
        if (!proposedTime) return '';
        const date = new Date(proposedTime);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date.toISOString().slice(0, 16);
    };

    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            <div 
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-amber-500/15 rounded-full flex items-center justify-center flex-shrink-0">
                        <CalendarIcon className="text-amber-500" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-base">Propose new time</h3>
                        {eventTitle && (
                            <p className="text-sm text-muted-foreground truncate">{eventTitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-accent rounded-lg transition-colors flex-shrink-0"
                    >
                        <X size={18} className="text-muted-foreground" />
                    </button>
                </div>

                {/* Current time info */}
                {formatOriginalTime && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-xl mb-4">
                        <Clock size={15} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">
                            Current: <span className="font-medium text-foreground">{formatOriginalTime}</span>
                        </span>
                    </div>
                )}

                {/* Quick suggestions */}
                <div className="space-y-2 mb-4">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Quick options
                    </label>
                    {suggestions.map((s) => (
                        <button
                            key={s.label}
                            type="button"
                            onClick={() => setProposedTime(s.value)}
                            className={`w-full px-4 py-3 text-left rounded-xl border transition-all ${
                                proposedTime === s.value
                                    ? 'bg-amber-500/10 border-amber-400/60 text-amber-600'
                                    : 'bg-muted border-border text-foreground hover:bg-accent hover:border-border'
                            }`}
                        >
                            <span className="text-sm font-medium">{s.label}</span>
                            <span className="block text-xs opacity-70 mt-0.5">{s.display}</span>
                        </button>
                    ))}
                </div>

                {/* Custom datetime picker */}
                <div className="mb-5">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Or pick a custom time
                    </label>
                    <input
                        type="datetime-local"
                        value={getInputValue()}
                        onChange={(e) => handleDateTimeChange(e.target.value)}
                        min={getMinDateTime()}
                        className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                        style={{ colorScheme: 'light dark' }}
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-muted hover:bg-accent text-foreground text-sm font-medium rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (proposedTime) {
                                onReschedule(proposedTime);
                            }
                        }}
                        disabled={!proposedTime || isLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        {isLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>
                                <CalendarIcon size={18} />
                                Propose time
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RescheduleModal;