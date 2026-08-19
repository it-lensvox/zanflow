import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users,
    CheckSquare, Clock, MapPin, Video, X, Trash2, Check, XCircle,
    RefreshCw, Crown, Loader2,
} from 'lucide-react';
import { eventApi, usersApi } from '@/services/api';
import type { Event as CalendarEventType } from '@/types';
import { getStatusBadgeColors, getStatusLabel } from '../calendarConstants';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    selectedHour?: number | null;
    event?: CalendarEventType | null;
    currentUser: { id: number; role: string } | null;
    allEvents: CalendarEventType[];
    onAcceptInvitation?: (invitationId: number) => void;
    onDeclineInvitation?: (event: CalendarEventType) => void;
    onRescheduleInvitation?: (event: CalendarEventType) => void;
    isAccepting?: boolean;
    // ═══════════════ DYUKSA AI PROP ═══════════════
    dyuksaEventData?: {
        eventType: string;
        title: string;
        attendeeIds: number[];
        attendeeNames: string[];
        targetDate: string;
        suggestedSlots: string[];
        duration: number;
    } | null;
}

export const EventModal: React.FC<EventModalProps> = ({
    isOpen,
    onClose,
    selectedDate,
    selectedHour,
    event,
    currentUser,
    allEvents: _allEvents,
    onAcceptInvitation,
    onDeclineInvitation,
    onRescheduleInvitation,
    isAccepting,
    dyuksaEventData
}) => {
    const isReadOnly = Boolean(event && currentUser && event.organizer !== currentUser.id);
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [location, setLocation] = useState('');
    const [isOnline, setIsOnline] = useState(false);
    const [description, setDescription] = useState('');


    // NEW: Event Type state
    const [eventType, setEventType] = useState('Meeting');
    const [showEventTypeDropdown, setShowEventTypeDropdown] = useState(false);
    const [customEventType, setCustomEventType] = useState('');
    const [suggestedSlots, setSuggestedSlots] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState(30);


    // Predefined event types
    const EVENT_TYPES = [
        { value: 'Meeting', icon: '👥', color: 'bg-blue-100 text-blue-700 border-blue-200' },
        { value: 'Review', icon: '📋', color: 'bg-purple-100 text-purple-700 border-purple-200' },
        { value: 'Interview', icon: '🎯', color: 'bg-green-100 text-green-700 border-green-200' },
        { value: 'Training', icon: '📚', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    ];

    // Attendees states
    const [attendees, setAttendees] = useState<number[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);

    // Dropdown states
    const [showStartTimeDropdown, setShowStartTimeDropdown] = useState(false);
    const [showEndTimeDropdown, setShowEndTimeDropdown] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Date picker state
    const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

    // Refs for scrolling time dropdowns
    const startTimeRef = React.useRef<HTMLDivElement>(null);
    const endTimeRef = React.useRef<HTMLDivElement>(null);

    // Availability tracking
    const [availabilityMap, setAvailabilityMap] = useState<Record<number, boolean>>({});
    const [checkingAvailability, setCheckingAvailability] = useState(false);


    // Fetch available team members
    const { data: availableUsers = [] } = useQuery({
        queryKey: ['users-list-events'],
        queryFn: usersApi.listAll,
        enabled: isOpen,
    });

    // Fetch RSVP status for existing events
    const { data: rsvpData, isLoading: loadingRsvp } = useQuery({
        queryKey: ['event-rsvp', event?.id],
        queryFn: () => eventApi.getEventRsvpStatus(event!.id),
        enabled: !!event?.id && isOpen,
    });

    const getTimeIndex = (timeStr: string) => {
        // timeStr is usually "HH:MM"
        const [h, m] = timeStr.split(':').map(Number);
        // Since you have 30-minute intervals, index = (hours * 2) + (1 if 30 mins)
        return h * 2 + (m >= 30 ? 1 : 0);
    };

    // Check availability for all users when time changes
    const checkAllUsersAvailability = React.useCallback(async () => {
        if (!startTime || !endTime || availableUsers.length === 0) return;

        setCheckingAvailability(true);
        const newAvailabilityMap: Record<number, boolean> = {};

        try {
            const checks = availableUsers.map(async (user: any) => {
                try {
                    const result = await eventApi.checkAvailability(
                        user.id,
                        new Date(startTime).toISOString(),
                        new Date(endTime).toISOString()
                    );
                    return { userId: user.id, available: result.is_available };
                } catch (error) {
                    console.error(`Error checking availability for user ${user.id}:`, error);
                    return { userId: user.id, available: true };
                }
            });

            const results = await Promise.all(checks);
            results.forEach(({ userId, available }) => {
                newAvailabilityMap[userId] = available;
            });

            setAvailabilityMap(newAvailabilityMap);
        } catch (error) {
            console.error('Error checking availability:', error);
        } finally {
            setCheckingAvailability(false);
        }
    }, [startTime, endTime, availableUsers]);

    // Helper to get availability status
    const getUserAvailability = (userId: number): { available: boolean; loading: boolean } => {
        if (!startTime || !endTime) return { available: true, loading: false };
        if (checkingAvailability && availabilityMap[userId] === undefined) {
            return { available: true, loading: true };
        }
        return { available: availabilityMap[userId] ?? true, loading: false };
    };

    // ═══════════════ FETCH SUGGESTED SLOTS ═══════════════
    const fetchSuggestedSlots = async () => {
        if (attendees.length === 0) {
            setSuggestedSlots([]);
            return;
        }

        const targetDate = startTime.split('T')[0];
        if (!targetDate) return;

        setLoadingSuggestions(true);
        try {
            const response = await eventApi.suggestSlots(
                attendees,
                targetDate,
                selectedDuration
            );
            setSuggestedSlots(response.available_slots || []);
        } catch (error) {
            console.error('Error fetching suggested slots:', error);
            setSuggestedSlots([]);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // Handle slot selection - populate start and end time
    const handleSlotSelect = (slotIso: string) => {
        const startDate = new Date(slotIso);
        const endDate = new Date(startDate.getTime() + selectedDuration * 60 * 1000);

        // Format for datetime-local input
        const formatForInput = (date: Date) => {
            const d = new Date(date);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().slice(0, 16);
        };

        setStartTime(formatForInput(startDate));
        setEndTime(formatForInput(endDate));
        setSuggestedSlots([]); // Clear suggestions after selection
    };

    // Format slot time for display (e.g., "10:00 AM")
    const formatSlotTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Trigger availability check when time changes
    React.useEffect(() => {
        if (isOpen && startTime && endTime && availableUsers.length > 0) {
            checkAllUsersAvailability();
        }
    }, [isOpen, startTime, endTime, availableUsers.length, checkAllUsersAvailability]);

    // Scroll time dropdown to show 9:00 AM area when opened
    React.useEffect(() => {
        if (showStartTimeDropdown && startTimeRef.current) {
            // Extract "HH:MM" from the ISO string or state
            const currentTime = startTime.split('T')[1]?.slice(0, 5) || '13:00';
            const index = getTimeIndex(currentTime);

            // 36 is the approximate height of your 'px-4 py-2' items
            // Subtracting 72 (two rows) centers the selection slightly
            startTimeRef.current.scrollTop = (index * 36) - 72;
        }
    }, [showStartTimeDropdown, startTime]);

    React.useEffect(() => {
        if (showEndTimeDropdown && endTimeRef.current) {
            const currentTime = endTime.split('T')[1]?.slice(0, 5) || '13:30';
            const index = getTimeIndex(currentTime);
            endTimeRef.current.scrollTop = (index * 36) - 72;
        }
    }, [showEndTimeDropdown, endTime]);

    React.useEffect(() => {
        if (event && isOpen) {
            // ═══════════════ EDITING EXISTING EVENT ═══════════════
            setTitle(event.title || '');
            const formatDt = (iso: string) => {
                const d = new Date(iso);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            };

            setStartTime(formatDt(event.start_time));
            setEndTime(formatDt(event.end_time));
            setLocation(event.location || '');
            setIsOnline(event.is_online_meeting || false);
            setDescription(event.description || '');
            setAttendees(event.attendees || []);
            setUserSearch('');
            setShowUserDropdown(false);
            setAvailabilityMap({});
            setSuggestedSlots([]);
            setSelectedDuration(30);

            if (event.event_type) {
                setEventType(event.event_type);
            } else {
                const detectedType = EVENT_TYPES.find(t => event.title?.toLowerCase().includes(t.value.toLowerCase()));
                if (detectedType) {
                    setEventType(detectedType.value);
                } else {
                    setEventType('Meeting');
                }
            }
            setCustomEventType('');

            const eventDate = new Date(event.start_time);
            setPickerMonth(eventDate.getMonth());
            setPickerYear(eventDate.getFullYear());

        } else if (dyuksaEventData && isOpen) {
            // ═══════════════ DYUKSA AI PRE-FILL ═══════════════
            setError(null);
            setTitle(dyuksaEventData.title || '');
            setEventType(dyuksaEventData.eventType || 'Meeting');
            setAttendees(dyuksaEventData.attendeeIds || []);
            setSuggestedSlots(dyuksaEventData.suggestedSlots || []);
            setSelectedDuration(dyuksaEventData.duration || 30);

            // Set date and time
            const targetDate = new Date(dyuksaEventData.targetDate);
            const y = targetDate.getFullYear();
            const m = String(targetDate.getMonth() + 1).padStart(2, '0');
            const d = String(targetDate.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            // If there are suggested slots, pre-select the first one
            if (dyuksaEventData.suggestedSlots && dyuksaEventData.suggestedSlots.length > 0) {
                const firstSlot = new Date(dyuksaEventData.suggestedSlots[0]);
                const startHour = String(firstSlot.getHours()).padStart(2, '0');
                const startMin = String(firstSlot.getMinutes()).padStart(2, '0');
                setStartTime(`${dateStr}T${startHour}:${startMin}`);

                const endSlot = new Date(firstSlot.getTime() + dyuksaEventData.duration * 60000);
                const endHour = String(endSlot.getHours()).padStart(2, '0');
                const endMin = String(endSlot.getMinutes()).padStart(2, '0');
                setEndTime(`${dateStr}T${endHour}:${endMin}`);
            } else {
                setStartTime(`${dateStr}T09:00`);
                setEndTime(`${dateStr}T09:30`);
            }

            setLocation('');
            setIsOnline(false);
            setDescription('');
            setUserSearch('');
            setShowUserDropdown(false);
            setAvailabilityMap({});
            setCustomEventType('');

            setPickerMonth(targetDate.getMonth());
            setPickerYear(targetDate.getFullYear());

        } else if (isOpen) {
            // ═══════════════ NEW EVENT (NO DYUKSA DATA) ═══════════════
            setError(null);
            const now = new Date();
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);

            let targetDate = selectedDate || new Date();
            if (targetDate < todayMidnight) targetDate = new Date();

            const y = targetDate.getFullYear();
            const m = String(targetDate.getMonth() + 1).padStart(2, '0');
            const d = String(targetDate.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            // Determine start time
            let startHour: number;
            let startMin: number;

            if (selectedHour !== null && selectedHour !== undefined) {
                // User clicked a specific hour slot in the calendar grid
                startHour = selectedHour;
                startMin = 0;
            } else if (targetDate.toDateString() === now.toDateString()) {
                // Creating event for today → snap to next 30-minute slot from current time
                const currentMinutes = now.getMinutes();
                if (currentMinutes < 30) {
                    startHour = now.getHours();
                    startMin = 30;
                } else {
                    startHour = now.getHours() + 1;
                    startMin = 0;
                }
                // Edge case: if rounding pushes us past midnight, cap at 23:30
                if (startHour >= 24) {
                    startHour = 23;
                    startMin = 30;
                }
            } else {
                // Creating event for a future day → default to 9:00 AM
                startHour = 9;
                startMin = 0;
            }

            // Calculate end time = start + 30 minutes
            let endHour = startHour;
            let endMin = startMin + 30;
            if (endMin >= 60) {
                endHour += 1;
                endMin -= 60;
            }
            if (endHour >= 24) {
                endHour = 23;
                endMin = 59;
            }

            const pad = (n: number) => String(n).padStart(2, '0');
            setStartTime(`${dateStr}T${pad(startHour)}:${pad(startMin)}`);
            setEndTime(`${dateStr}T${pad(endHour)}:${pad(endMin)}`);

            setTitle('');
            setLocation('');
            setIsOnline(false);
            setDescription('');
            setAttendees([]);
            setUserSearch('');
            setShowUserDropdown(false);
            setAvailabilityMap({});
            setSuggestedSlots([]);
            setSelectedDuration(30);
            setEventType('Meeting');
            setCustomEventType('');

            setPickerMonth(targetDate.getMonth());
            setPickerYear(targetDate.getFullYear());
        }
    }, [selectedDate, selectedHour, isOpen, event, dyuksaEventData]);

    const { mutate: createEvent, isPending: isCreating } = useMutation({
        mutationFn: (data: Partial<CalendarEventType>) => eventApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            onClose();
        },
        onError: (err: any) => {
            const conflictMsg = err.response?.data?.attendees?.[0] || err.response?.data?.detail || "Could not create event.";
            setError(conflictMsg);
        }
    });

    const { mutate: updateEvent, isPending: isUpdating } = useMutation({
        mutationFn: (data: Partial<CalendarEventType>) => eventApi.update(event!.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            onClose();
        },
        onError: (err: any) => {
            const conflictMsg = err.response?.data?.attendees?.[0] || err.response?.data?.detail || "Could not update event.";
            setError(conflictMsg);
        }
    });

    const { mutate: deleteEvent, isPending: isDeleting } = useMutation({
        mutationFn: () => eventApi.delete(event!.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events-calendar'] });
            onClose();
        }
    });

    const isPending = isCreating || isUpdating || isDeleting;

    const handleSave = () => {
        const startDt = new Date(startTime);
        const endDt = new Date(endTime);
        const now = new Date();

        if (startDt < now) {
            setError("Cannot create or move an event to a past time.");
            return;
        }

        // // Conflict check logic for participants
        // const conflictAttendee = attendees.find(attendeeId => {
        //     return allEvents.some(existingEv => {
        //         if (event && existingEv.id === event.id) return false;
        //         const evStart = new Date(existingEv.start_time);
        //         const evEnd = new Date(existingEv.end_time);
        //         const isUserInvolved = existingEv.organizer === attendeeId || existingEv.attendees?.includes(attendeeId);
        //         return isUserInvolved && (startDt < evEnd && endDt > evStart);
        //     });
        // });

        // if (conflictAttendee) {
        //     const userObj = availableUsers.find((u: any) => u.id === conflictAttendee);
        //     setError(`${userObj?.first_name || "A participant"} is already busy during this time.`);
        //     return;
        // }

        // Build the payload with all fields to ensure they can be updated
        const payload = {
            id: event?.id, // ID is required for the update mutation
            title,
            event_type: eventType,
            location,
            is_online_meeting: isOnline,
            description,
            attendees, // This includes any newly added participant IDs
            start_time: startDt.toISOString(),
            end_time: endDt.toISOString()
        };

        if (event) {
            updateEvent(payload);
        } else {
            createEvent(payload);
        }
    };

    // Close all dropdowns helper
    const closeAllDropdowns = () => {
        setShowDatePicker(false);
        setShowStartTimeDropdown(false);
        setShowEndTimeDropdown(false);
        setShowEventTypeDropdown(false);
        setShowUserDropdown(false);
    };

    if (!isOpen) return null;

    const filteredUsers = availableUsers.filter((u: any) => {
        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        const searchLower = userSearch.toLowerCase();
        return (name.includes(searchLower) || u.email?.toLowerCase().includes(searchLower)) && !attendees.includes(u.id);
    });

    // Avatar helpers
    const getInitials = (user: any) => {
        const first = user?.first_name?.[0] || user?.username?.[0] || '';
        const last = user?.last_name?.[0] || '';
        return (first + last).toUpperCase() || '?';
    };

    const avatarColors = ['bg-amber-500', 'bg-cyan-500', 'bg-violet-500', 'bg-rose-500', 'bg-emerald-500', 'bg-blue-500', 'bg-orange-500', 'bg-pink-500'];
    const getAvatarColor = (id: number) => avatarColors[id % avatarColors.length];

    // Format date for display: "15 Apr 2026"
    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Generate time slots
    const timeSlots = Array.from({ length: 48 }).map((_, i) => {
        const h = String(Math.floor(i / 2)).padStart(2, '0');
        const m = i % 2 === 0 ? '00' : '30';
        return `${h}:${m}`;
    });

    // Mini Calendar helpers
    const MINI_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const MINI_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const getCalendarDays = () => {
        const firstDay = new Date(pickerYear, pickerMonth, 1);
        const startDay = new Date(firstDay);
        startDay.setDate(firstDay.getDate() - firstDay.getDay());

        const days = [];
        const iter = new Date(startDay);
        while (days.length < 42) {
            days.push(new Date(iter));
            iter.setDate(iter.getDate() + 1);
        }
        return days;
    };

    const handleDateSelect = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const newDateStr = `${y}-${m}-${d}`;

        setStartTime(`${newDateStr}T${startTime.split('T')[1] || '13:00'}`);
        setEndTime(`${newDateStr}T${endTime.split('T')[1] || '13:30'}`);
        setShowDatePicker(false);
    };

    const currentSelectedDate = startTime ? new Date(startTime.split('T')[0]) : new Date();

    // Get current event type config
    const currentEventTypeConfig = EVENT_TYPES.find(t => t.value === eventType) || { value: eventType, icon: '📅', color: 'bg-gray-100 text-gray-700 border-gray-200' };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card border border-border w-full max-w-[850px] rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden"
                style={{ maxHeight: '90vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ═══════════════ LEFT PANEL - Event Details ═══════════════ */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-foreground">
                                {event ? (isReadOnly ? 'View event' : 'Edit event') : 'Create event'}
                            </h2>
                            {event?.my_invitation_status && (
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColors(event.my_invitation_status)}`}>
                                    {getStatusLabel(event.my_invitation_status)}
                                </span>
                            )}
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto">
                        {/* ── Date & Time Row ── */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Date Picker Button */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => {
                                        closeAllDropdowns();
                                        setShowDatePicker(!showDatePicker);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2.5 bg-muted rounded-xl border border-border hover:border-muted-foreground/40 transition-colors ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                >
                                    <CalendarIcon size={16} className="text-gray-500" />
                                    <span className="text-sm font-medium text-foreground">
                                        {formatDisplayDate(startTime)}
                                    </span>
                                </button>

                                {/* Mini Calendar Dropdown */}
                                {showDatePicker && !isReadOnly && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowDatePicker(false)} />
                                        <div className="absolute top-full left-0 mt-2 bg-popover border border-border rounded-xl shadow-xl z-20 p-4 w-72">
                                            {/* Month/Year Header */}
                                            <div className="flex items-center justify-between mb-4">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (pickerMonth === 0) {
                                                            setPickerMonth(11);
                                                            setPickerYear(pickerYear - 1);
                                                        } else {
                                                            setPickerMonth(pickerMonth - 1);
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-accent rounded-lg text-muted-foreground"
                                                >
                                                    <ChevronLeft size={18} />
                                                </button>
                                                <span className="text-sm font-semibold text-foreground">
                                                    {MINI_MONTHS[pickerMonth]} {pickerYear}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (pickerMonth === 11) {
                                                            setPickerMonth(0);
                                                            setPickerYear(pickerYear + 1);
                                                        } else {
                                                            setPickerMonth(pickerMonth + 1);
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-accent rounded-lg text-muted-foreground"
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>

                                            {/* Day Headers */}
                                            <div className="grid grid-cols-7 mb-2">
                                                {MINI_DAYS.map(d => (
                                                    <div key={d} className="text-[11px] font-semibold text-muted-foreground text-center py-1">
                                                        {d}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Calendar Days */}
                                            <div className="grid grid-cols-7 gap-1">
                                                {getCalendarDays().map((date, i) => {
                                                    const isCurrentMonth = date.getMonth() === pickerMonth;
                                                    const isSelected = date.toDateString() === currentSelectedDate.toDateString();
                                                    const isToday = date.toDateString() === new Date().toDateString();
                                                    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            disabled={isPast}
                                                            onClick={() => handleDateSelect(date)}
                                                            className={`
                                                                text-sm h-8 w-8 flex items-center justify-center rounded-full mx-auto transition-all
                                                                ${isSelected
                                                                    ? 'bg-blue-600 text-white font-semibold'
                                                                    : isToday
                                                                        ? 'text-blue-600 font-semibold border border-blue-300'
                                                                        : isCurrentMonth
                                                                            ? isPast
                                                                                ? 'text-muted-foreground/40 cursor-not-allowed'
                                                                                : 'text-foreground hover:bg-accent'
                                                                            : 'text-muted-foreground/30'
                                                                }
                                                            `}
                                                        >
                                                            {date.getDate()}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Start Time Dropdown */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => {
                                        closeAllDropdowns();
                                        setShowStartTimeDropdown(!showStartTimeDropdown);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2.5 bg-muted rounded-xl border border-border hover:border-muted-foreground/40 transition-colors ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                >
                                    <span className="text-sm font-medium text-foreground">
                                        {startTime.split('T')[1]?.slice(0, 5) || '13:00'}
                                    </span>
                                    <ChevronRight size={14} className="text-gray-400 rotate-90" />
                                </button>

                                {showStartTimeDropdown && !isReadOnly && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowStartTimeDropdown(false)} />
                                        <div
                                            ref={startTimeRef}
                                            className="absolute top-full left-0 mt-2 bg-popover border border-border rounded-xl shadow-xl z-20 w-24 max-h-64 overflow-y-auto"
                                        >
                                            {timeSlots.map(time => {
                                                // --- NEW LOGIC START ---
                                                const [h, m] = time.split(':').map(Number);
                                                const slotDate = new Date(startTime.split('T')[0]);
                                                slotDate.setHours(h, m, 0, 0);

                                                // Check if this specific time slot on the selected date is in the past
                                                const isPastTime = slotDate < new Date();
                                                const isSelected = (startTime.split('T')[1]?.slice(0, 5) || '13:00') === time;
                                                // --- NEW LOGIC END ---

                                                return (
                                                    <div
                                                        key={`start-${time}`}
                                                        className={`px-4 py-2 cursor-pointer text-sm transition-colors ${isPastTime
                                                            ? 'text-muted-foreground cursor-not-allowed opacity-70'
                                                            : isSelected
                                                                ? 'bg-blue-500/10 text-blue-600 font-medium'
                                                                : 'text-foreground hover:bg-accent'
                                                            }`}
                                                        onClick={() => {
                                                            if (isPastTime) return;

                                                            const date = startTime.split('T')[0];
                                                            setStartTime(`${date}T${time}`);

                                                            // Logic to auto-set end time 30 mins after start
                                                            const [h, m] = time.split(':').map(Number);
                                                            const endH = String(m >= 30 ? (h + 1) % 24 : h).padStart(2, '0');
                                                            const endM = m >= 30 ? '00' : '30';
                                                            setEndTime(`${date}T${endH}:${endM}`);
                                                            setShowStartTimeDropdown(false);
                                                        }}
                                                    >
                                                        {isSelected && <span className="mr-1">✓</span>}
                                                        {time}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            <span className="text-muted-foreground font-medium">—</span>

                            {/* End Time Dropdown */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => {
                                        closeAllDropdowns();
                                        setShowEndTimeDropdown(!showEndTimeDropdown);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                >
                                    <span className="text-sm font-medium text-foreground">
                                        {endTime.split('T')[1]?.slice(0, 5) || '13:30'}
                                    </span>
                                    <ChevronRight size={14} className="text-gray-400 rotate-90" />
                                </button>

                                {showEndTimeDropdown && !isReadOnly && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowEndTimeDropdown(false)} />
                                        <div
                                            ref={endTimeRef}
                                            className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 w-24 max-h-64 overflow-y-auto"
                                        >
                                            {timeSlots.map(time => {
                                                const [h, m] = time.split(':').map(Number);
                                                const slotDate = new Date(endTime.split('T')[0]);
                                                slotDate.setHours(h, m, 0, 0);

                                                const isPastTime = slotDate < new Date();
                                                const isSelected = (endTime.split('T')[1]?.slice(0, 5) || '13:30') === time;

                                                return (
                                                    <div
                                                        key={`end-${time}`}
                                                        className={`px-4 py-2 cursor-pointer text-sm transition-colors ${isPastTime
                                                            ? 'text-muted-foreground cursor-not-allowed opacity-70'
                                                            : isSelected
                                                                ? 'bg-blue-500/10 text-blue-600 font-medium'
                                                                : 'text-foreground hover:bg-accent'
                                                            }`}
                                                        onClick={() => {
                                                            if (isPastTime) return; // Prevent selection

                                                            setEndTime(`${endTime.split('T')[0]}T${time}`);
                                                            setShowEndTimeDropdown(false);
                                                        }}
                                                    >
                                                        {isSelected && <span className="mr-1">✓</span>}
                                                        {time}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        {/* ═══════════════ SUGGEST TIMES SECTION ═══════════════ */}
                        {!isReadOnly && !event && attendees.length > 0 && (
                            <div className="space-y-3">
                                {/* Duration selector + Suggest button */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-gray-400" />
                                        <span className="text-xs font-medium text-gray-500">Duration:</span>
                                        <select
                                            value={selectedDuration}
                                            onChange={(e) => setSelectedDuration(Number(e.target.value))}
                                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value={15}>15 min</option>
                                            <option value={30}>30 min</option>
                                            <option value={45}>45 min</option>
                                            <option value={60}>1 hour</option>
                                            <option value={90}>1.5 hours</option>
                                            <option value={120}>2 hours</option>
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={fetchSuggestedSlots}
                                        disabled={loadingSuggestions || attendees.length === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-700 text-sm font-medium rounded-lg border border-emerald-200 transition-colors"
                                    >
                                        {loadingSuggestions ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                Finding times...
                                            </>
                                        ) : (
                                            <>
                                                <CalendarIcon size={14} />
                                                Suggest Times
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Suggested slots pills */}
                                {suggestedSlots.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Available Slots ({suggestedSlots.length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestedSlots.map((slot) => (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    onClick={() => handleSlotSelect(slot)}
                                                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium rounded-lg border border-emerald-200 transition-all hover:shadow-sm hover:scale-105"
                                                >
                                                    {formatSlotTime(slot)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* No slots available message */}
                                {!loadingSuggestions && suggestedSlots.length === 0 && attendees.length > 0 && (
                                    <p className="text-xs text-gray-400 italic">
                                        Click "Suggest Times" to find available slots for all participants
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── Event Name Input ── */}
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Event Name
                            </label>
                            <input
                                type="text"
                                placeholder="Enter event name"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={isReadOnly}
                                className={`w-full text-base font-medium text-foreground placeholder:text-muted-foreground bg-input border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
                            />
                        </div>

                        {/* ── Event Type Selector ── */}
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Event Type
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => {
                                        closeAllDropdowns();
                                        setShowEventTypeDropdown(!showEventTypeDropdown);
                                    }}
                                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all ${currentEventTypeConfig.color} ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:shadow-sm'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{currentEventTypeConfig.icon}</span>
                                        <span className="text-sm font-medium">{eventType}</span>
                                    </div>
                                    <ChevronRight size={16} className={`transition-transform ${showEventTypeDropdown ? 'rotate-90' : ''}`} />
                                </button>

                                {showEventTypeDropdown && !isReadOnly && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowEventTypeDropdown(false)} />
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                                            {/* Predefined Types */}
                                            {EVENT_TYPES.map(type => (
                                                <div
                                                    key={type.value}
                                                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent ${eventType === type.value ? 'bg-accent' : ''}`}
                                                    onClick={() => {
                                                        setEventType(type.value);
                                                        setCustomEventType('');
                                                        setShowEventTypeDropdown(false);
                                                    }}
                                                >
                                                    <span className="text-lg">{type.icon}</span>
                                                    <span className="text-sm font-medium text-foreground">{type.value}</span>
                                                    {eventType === type.value && (
                                                        <CheckSquare size={16} className="ml-auto text-blue-600" />
                                                    )}
                                                </div>
                                            ))}

                                            {/* Divider */}
                                            <div className="border-t border-border" />

                                            {/* Custom Type Input */}
                                            <div className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">✏️</span>
                                                    <input
                                                        type="text"
                                                        placeholder="Other (type custom name)"
                                                        value={customEventType}
                                                        onChange={(e) => setCustomEventType(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && customEventType.trim()) {
                                                                setEventType(customEventType.trim());
                                                                setShowEventTypeDropdown(false);
                                                            }
                                                        }}
                                                        className="flex-1 text-sm text-foreground placeholder:text-muted-foreground bg-input border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    {customEventType.trim() && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEventType(customEventType.trim());
                                                                setShowEventTypeDropdown(false);
                                                            }}
                                                            className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                                        >
                                                            Add
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ── Teams Meeting Toggle ── */}
                        <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => setIsOnline(!isOnline)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all w-fit ${isOnline
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                } ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                        >
                            <Video size={18} className={isOnline ? 'text-indigo-600' : 'text-gray-500'} />
                            <span className="text-sm font-medium">Teams meeting</span>
                            {isOnline && <X size={14} className="ml-1 text-indigo-400" />}
                        </button>
                        {isOnline && (
                            <p className="text-xs text-gray-500 -mt-3 ml-1">Link will be generated automatically</p>
                        )}

                        {/* ── Description ── */}
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Description
                            </label>
                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                <textarea
                                    placeholder="Let's discuss"
                                    value={description}
                                    disabled={isReadOnly}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={4}
                                    className={`w-full bg-transparent resize-none focus:outline-none text-sm text-foreground placeholder:text-muted-foreground p-4 ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
                                />
                            </div>
                        </div>

                        {/* ── Location (Optional) ── */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-muted rounded-xl border border-border">
                            <MapPin size={18} className="text-muted-foreground flex-shrink-0" />
                            <input
                                type="text"
                                disabled={isReadOnly}
                                placeholder="Add location (optional)"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                className={`flex-1 text-sm text-foreground placeholder:text-muted-foreground bg-transparent focus:outline-none ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mx-6 mb-3">
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                {error}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/50">
                        <div>
                            {event && !isReadOnly && (
                                <button
                                    onClick={() => deleteEvent()}
                                    disabled={isPending}
                                    className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            )}
                        </div>

                        {/* Show invitation buttons for PENDING events */}
                        {event && event.my_invitation_status === 'PENDING' && event.my_invitation_id ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onAcceptInvitation?.(event.my_invitation_id!)}
                                    disabled={isAccepting}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    {isAccepting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    Accept
                                </button>
                                <button
                                    onClick={() => onDeclineInvitation?.(event)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    <XCircle size={16} />
                                    Decline
                                </button>
                                <button
                                    onClick={() => onRescheduleInvitation?.(event)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
                                >
                                    <RefreshCw size={16} />
                                    Reschedule
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                {!isReadOnly && (
                                    <button
                                        onClick={handleSave}
                                        disabled={!title || isPending}
                                        className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                                    >
                                        {isPending ? 'Saving...' : event ? 'Save changes' : 'Create event'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════════ RIGHT PANEL - Participants ═══════════════ */}
                <div className="md:w-64 w-full bg-muted border-t md:border-t-0 md:border-l border-border flex flex-col">
                    {/* Participants Header */}
                    <div className="px-4 py-4 border-b border-border">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Participants</h3>
                        {checkingAvailability && (
                            <div className="flex items-center gap-1.5 text-[11px] text-blue-600 mt-1.5">
                                <Loader2 size={10} className="animate-spin" />
                                Checking availability...
                            </div>
                        )}
                    </div>

                    {/* Participants List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {/* Show Organizer First */}
                        {event && (
                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-2">
                                <div className="relative flex-shrink-0">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm ${getAvatarColor(event.organizer)}`}>
                                        {(() => {
                                            const organizer = availableUsers.find((u: any) => u.id === event.organizer);
                                            return organizer?.avatar ? (
                                                <img src={organizer.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                getInitials(organizer || { first_name: rsvpData?.organizer })
                                            );
                                        })()}
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-blue-50 bg-blue-500 flex items-center justify-center">
                                        <Crown size={8} className="text-white" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {rsvpData?.organizer || event.organizer_name || 'Organizer'}
                                    </p>
                                    <p className="text-[10px] font-medium text-blue-500">Organizer</p>
                                </div>
                            </div>
                        )}

                        {/* Loading state */}
                        {loadingRsvp && (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 size={16} className="animate-spin text-gray-400" />
                            </div>
                        )}

                        {/* Attendees with RSVP status - Now mapping over local 'attendees' state */}
                        {attendees.map((userId) => {
                            // 1. Skip if this user is the organizer (already shown above)
                            if (event && userId === event.organizer) return null;

                            // 2. Find detailed user info from your 'availableUsers' list
                            const userDetail = availableUsers.find((u: any) => u.id === userId);

                            // 3. Find RSVP status from the server data (if it exists yet)
                            const rsvpStatus = rsvpData?.attendee_status?.find((a: any) => a.user_id === userId);

                            // Logic for display labels
                            const status = rsvpStatus?.status || 'PENDING';
                            const statusColor =
                                status === 'ACCEPTED' ? 'bg-emerald-500' :
                                    status === 'DECLINED' ? 'bg-red-500' :
                                        'bg-amber-500';

                            const statusTextColor =
                                status === 'ACCEPTED' ? 'text-emerald-600' :
                                    status === 'DECLINED' ? 'text-red-600' :
                                        'text-amber-600';

                            const fullName = userDetail
                                ? `${userDetail.first_name || ''} ${userDetail.last_name || ''}`.trim() || userDetail.username
                                : (rsvpStatus?.name || 'User');

                            return (
                                <div
                                    key={userId}
                                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-card transition-colors group"
                                >
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm ${getAvatarColor(userId)}`}>
                                            {userDetail?.avatar ? (
                                                <img src={userDetail.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                getInitials(userDetail || { first_name: fullName })
                                            )}
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-50 ${statusColor}`} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
                                        <p className={`text-[10px] font-medium ${statusTextColor}`}>
                                            {/* If we have no rsvpStatus, it means the user was just added locally */}
                                            {!rsvpStatus ? 'Newly Added' : status.charAt(0) + status.slice(1).toLowerCase()}
                                        </p>

                                        {/* RSVP Details (Only if they exist from server) */}
                                        {rsvpStatus?.status === 'DECLINED' && rsvpStatus.decline_reason && (
                                            <p className="text-[9px] text-gray-400 truncate" title={rsvpStatus.decline_reason}>
                                                Reason: {rsvpStatus.decline_reason}
                                            </p>
                                        )}
                                        {rsvpStatus?.proposed_reschedule_time && (
                                            <p className="text-[9px] text-amber-600 truncate">
                                                Proposed: {new Date(rsvpStatus.proposed_reschedule_time).toLocaleString()}
                                            </p>
                                        )}
                                    </div>

                                    {!isReadOnly && (
                                        <button
                                            onClick={() => setAttendees(prev => prev.filter(a => a !== userId))}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* Empty state for new events */}
                        {!event && attendees.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users size={28} className="mx-auto mb-2 opacity-40" />
                                <p className="text-xs">No participants yet</p>
                            </div>
                        )}
                    </div>

                    {/* Add Participant */}
                    {!isReadOnly && (
                        <div className="p-3 border-t border-border relative">
                            <div
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-border hover:border-blue-400 hover:bg-card cursor-text transition-all"
                                onClick={() => setShowUserDropdown(true)}
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <Users size={14} className="text-gray-500" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="+ Add participants"
                                    value={userSearch}
                                    onChange={e => {
                                        setUserSearch(e.target.value);
                                        setShowUserDropdown(true);
                                    }}
                                    onFocus={() => setShowUserDropdown(true)}
                                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
                                />
                            </div>

                            {showUserDropdown && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                                    <div className="absolute bottom-full left-3 right-3 mb-2 bg-popover border border-border rounded-xl shadow-xl z-20 max-h-60 overflow-hidden flex flex-col">
                                        <div className="px-3 py-2 bg-muted border-b border-border flex items-center gap-4 text-[10px] font-semibold text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                                Available
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                                Busy
                                            </span>
                                        </div>

                                        <div className="overflow-y-auto flex-1">
                                            {filteredUsers.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-gray-500">
                                                    {userSearch ? 'No users found' : 'All users added'}
                                                </div>
                                            ) : (
                                                filteredUsers.map((u: any) => {
                                                    const { available, loading } = getUserAvailability(u.id);
                                                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;

                                                    return (
                                                        <div
                                                            key={u.id}
                                                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${loading ? 'hover:bg-accent' : available ? 'hover:bg-green-500/10' : 'hover:bg-red-500/10'
                                                                }`}
                                                            onClick={() => {
                                                                setAttendees(prev => [...prev, u.id]);
                                                                setUserSearch('');
                                                                setShowUserDropdown(false);
                                                            }}
                                                        >
                                                            <div className="relative flex-shrink-0">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getAvatarColor(u.id)}`}>
                                                                    {u.avatar ? (
                                                                        <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                                                    ) : (
                                                                        getInitials(u)
                                                                    )}
                                                                </div>
                                                                {!loading && (
                                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${available ? 'bg-green-500' : 'bg-red-500'
                                                                        }`} />
                                                                )}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
                                                                <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                                                            </div>

                                                            <div className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${loading
                                                                ? 'bg-gray-100 text-gray-500'
                                                                : available
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                {loading ? '...' : available ? 'Free' : 'Busy'}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {(!startTime || !endTime) && (
                                <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1 px-1">
                                    <Clock size={10} />
                                    Select time to check availability
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
