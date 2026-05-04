import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, Video, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

interface PublicEvent {
    id: number;
    organizer_name: string;
    title: string;
    event_type: string;
    start_time: string;
    end_time: string;
    is_online_meeting: boolean;
}

export const SharedCalendarView: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [ownerName, setOwnerName] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const fetchPublicCalendar = async () => {
            if (!token) return;
            
            setIsLoading(true);
            setError(null);
            
            try {
                // IMPORTANT: No auth header for public endpoint
                const response = await axios.get(
                    `http://192.168.1.164:8000/api/v1/daily-updates/shared-calendar/${token}/`
                );
                
                setEvents(response.data.events || []);
                setOwnerName(response.data.owner_name || 'Unknown');
            } catch (err: any) {
                console.error('Failed to fetch public calendar:', err);
                if (err.response?.status === 404) {
                    setError('This calendar link is invalid or has expired.');
                } else {
                    setError('Failed to load calendar. Please try again later.');
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchPublicCalendar();
    }, [token]);

    const getWeekDays = () => {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);
        
        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            days.push(day);
        }
        return days;
    };

    const weekDays = getWeekDays();

    const getEventsForDay = (day: Date) => {
        return events.filter(event => {
            const eventDate = new Date(event.start_time);
            return eventDate.toDateString() === day.toDateString();
        }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    };

    const formatDateRange = () => {
        const start = weekDays[0];
        const end = weekDays[6];
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
    };

    const navigateWeek = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        setCurrentDate(newDate);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={48} className="animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading calendar...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Calendar Not Available</h1>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                                <Calendar size={24} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    {ownerName}'s Calendar
                                </h1>
                                <p className="text-sm text-gray-500">Shared calendar view</p>
                            </div>
                        </div>
                        
                        {/* Week Navigation */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigateWeek('prev')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ChevronLeft size={20} className="text-gray-600" />
                            </button>
                            <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
                                {formatDateRange()}
                            </span>
                            <button
                                onClick={() => navigateWeek('next')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ChevronRight size={20} className="text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Calendar Grid */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-7 gap-3">
                    {weekDays.map((day, index) => {
                        const dayEvents = getEventsForDay(day);
                        const isToday = day.toDateString() === new Date().toDateString();
                        
                        return (
                            <div 
                                key={index}
                                className={`bg-white rounded-xl border-2 ${
                                    isToday ? 'border-indigo-400 shadow-lg shadow-indigo-100' : 'border-gray-100'
                                } overflow-hidden min-h-[350px] transition-all hover:shadow-md`}
                            >
                                {/* Day Header */}
                                <div className={`px-3 py-3 text-center ${
                                    isToday 
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white' 
                                        : 'bg-gray-50 border-b border-gray-100'
                                }`}>
                                    <p className={`text-xs font-medium uppercase tracking-wide ${
                                        isToday ? 'text-indigo-100' : 'text-gray-500'
                                    }`}>
                                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </p>
                                    <p className={`text-2xl font-bold ${
                                        isToday ? 'text-white' : 'text-gray-900'
                                    }`}>
                                        {day.getDate()}
                                    </p>
                                </div>

                                {/* Events */}
                                <div className="p-2 space-y-2">
                                    {dayEvents.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-8">
                                            No events
                                        </p>
                                    ) : (
                                        dayEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                className="p-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 rounded-r-lg hover:from-indigo-100 hover:to-purple-100 transition-colors"
                                            >
                                                <p className="text-sm font-semibold text-gray-900 truncate">
                                                    {event.title}
                                                </p>
                                                <div className="flex items-center gap-1 mt-1.5">
                                                    <Clock size={12} className="text-gray-400" />
                                                    <span className="text-xs text-gray-600">
                                                        {formatTime(event.start_time)} - {formatTime(event.end_time)}
                                                    </span>
                                                </div>
                                                {event.is_online_meeting && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Video size={12} className="text-blue-500" />
                                                        <span className="text-xs text-blue-600 font-medium">Online Meeting</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-200 bg-white/80 backdrop-blur-sm mt-8">
                <div className="max-w-7xl mx-auto px-4 py-4 text-center">
                    <p className="text-sm text-gray-500">
                        Powered by <span className="font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Dyuksa</span>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default SharedCalendarView;
