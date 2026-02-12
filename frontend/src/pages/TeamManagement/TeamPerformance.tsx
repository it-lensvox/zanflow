import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp,
    CheckCircle,
    Clock,
    ListTodo,
    Activity,
    BarChart3,
    Users,
    ArrowLeft,
    Loader2
} from 'lucide-react';
import { usersApi, taskApi } from '@/services/api'; 
import type { User as AppUser } from '@/types'; 
import './TeamPerformance.scss'; 

export interface UserPerformance {
    performance_score: number;
    completed_tasks_count: number;
    in_progress_tasks_count: number;
    pending_tasks_count: number;
    total_tasks_count: number;
    
    // Detailed sections
    project_distribution: Array<{
        project_name: string;
        task_count: number;
        total_project_tasks: number;
    }>;
    recent_activity: Array<{
        task_name: string;
        project_name: string;
        status: 'completed' | 'in_progress' | 'pending' | 'deployed' | 'deferred' | string; 
        timestamp: string; 
    }>;
}

interface TeamMember extends AppUser {
    avatar: string; 
    performance: UserPerformance | null;
}

const getInitials = (first: string, last: string) => 
    `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}`;

// --- Main Component ---
export const TeamPerformance: React.FC = () => {
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);

    const fetchPerformanceData = useCallback(async (userId: number) => {
        setIsPerformanceLoading(true);
        try {
            const data: UserPerformance = await taskApi.getPerformance(userId);
            console.log("🔥 PERFORMANCE API RESPONSE FOR USER:", userId, data);
            setTeamMembers(prevMembers => 
                prevMembers.map(m => 
                    m.id === userId ? { ...m, performance: data } : m
                )
            );
            
            // Update the selected member state as well
            setSelectedMember(prevSelected => 
                prevSelected && prevSelected.id === userId ? { ...prevSelected, performance: data } : prevSelected
            );

        } catch (error) {
            console.error(`Failed to fetch performance for user ${userId}:`, error);
            setTeamMembers(prevMembers => 
                prevMembers.map(m => 
                    m.id === userId ? { ...m, performance: null } : m
                )
            );
        } finally {
            setIsPerformanceLoading(false);
        }
    }, []);

    // Fetch team members list (Left Sidebar)
    const fetchTeamMembers = useCallback(async () => {
        try {
            setLoading(true);
            const apiUsers: AppUser[] = await usersApi.listAll(); 
            
            const members: TeamMember[] = apiUsers.map((user: AppUser) => {
                const initials = getInitials(user.first_name, user.last_name);
                
                return {
                    ...user,
                    avatar: initials,
                    performance: null,
                } as TeamMember;
            });

            setTeamMembers(members);
            if (members.length > 0) {
                const firstMember = members[0];
                setSelectedMember(firstMember);
                fetchPerformanceData(firstMember.id);
            }
        } catch (error) {
            console.error("Failed to fetch team members:", error);
        } finally {
            setLoading(false);
        }
    }, [fetchPerformanceData]);


    useEffect(() => {
        fetchTeamMembers();
    }, [fetchTeamMembers]);

    // Handle member selection and trigger new API call
    const handleSelectMember = (member: TeamMember) => {
        setSelectedMember(member);
        
        // If performance data is not already loaded for this member, fetch it
        if (!member.performance) {
            fetchPerformanceData(member.id);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[500px] bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
                <p className="ml-3 text-slate-600">Loading team data...</p>
            </div>
        );
    }
    
    // Fallback for initial state before selection
    const displayMember = selectedMember || teamMembers[0] || null;
    const performance = displayMember?.performance;

    // Calculate dynamic stats based on fetched performance data (or default to 0)
    const memberTotalTasks = performance?.total_tasks_count ?? 0;
    const memberCompletedTasks = performance?.completed_tasks_count ?? 0;
    const memberPerformanceScore = memberTotalTasks > 0 
        ? Math.round((memberCompletedTasks / memberTotalTasks) * 100) 
        : 0;
    
    // Determine if we should show the "No data" placeholder or the actual details
    const showNoDataPlaceholder = !performance && !isPerformanceLoading;

    return (
        <div className="w-full h-full p-8 bg-gray-50">

            {/* Adjusted height for main container */}
            <div className="flex w-full h-[calc(100vh-100px)] rounded-xl overflow-hidden shadow-2xl border border-slate-200"> 
                {/* Left Sidebar: Team Member List */}
                <div className="min-w-[300px] max-w-[350px] w-1/3 bg-white border-r border-slate-200 overflow-y-auto">
                    <div className="p-6 border-b border-slate-200">
                        <div className="flex items-center gap-3 mb-2">
                            <Users className="w-6 h-6 text-slate-700" />
                            <h2 className="text-xl font-bold text-slate-800">Team Members ({teamMembers.length})</h2>
                        </div>
                        <p className="text-sm text-slate-600">Select a member to view details</p>
                    </div>

                    <div className="p-4 space-y-2">
                        {teamMembers.map((member) => {
                            const memberPerformance = member.performance;
                            const totalTasks = memberPerformance?.total_tasks_count ?? 0;
                            const completedTasks = memberPerformance?.completed_tasks_count ?? 0;

                            const memberPerfScore = totalTasks > 0 
                                ? Math.round((completedTasks / totalTasks) * 100) 
                                : 0;
                            return (
                                <button
                                    key={member.id}
                                    onClick={() => handleSelectMember(member)}
                                    className={`w-full text-left p-4 rounded-lg transition-all ${
                                        displayMember?.id === member.id
                                            ? 'bg-slate-800 text-white shadow-lg'
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                                    }`}
                                    disabled={isPerformanceLoading}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                                            displayMember?.id === member.id
                                                ? 'bg-white text-slate-800'
                                                : 'bg-slate-200 text-slate-700'
                                        }`}>
                                            {member.avatar}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{member.first_name} {member.last_name}</p>
                                            <p className={`text-xs ${
                                                displayMember?.id === member.id ? 'text-slate-300' : 'text-slate-500'
                                            }`}>
                                                {member.role}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className={displayMember?.id === member.id ? 'text-slate-300' : 'text-slate-600'}>
                                            {completedTasks}/{totalTasks} completed
                                        </span>
                                        <span className={`font-semibold ${
                                            displayMember?.id === member.id ? 'text-white' : 'text-slate-800'
                                        }`}>
                                            {memberPerfScore}%
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Content: Performance Details */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100">
                    <div className="p-8">
                        {isPerformanceLoading ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
                                <p className="ml-3 mt-3">Loading performance data...</p>
                            </div>
                        ) : showNoDataPlaceholder ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-slate-500">
                                <Users className="w-12 h-12 mb-4" />
                                <h3 className="text-xl font-medium">No performance data available</h3>
                                <p>Select a team member from the list to view their details.</p>
                            </div>
                        ) : (
                            displayMember && performance && (
                                <>
                                    {/* Member Profile and Completion Rate */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                                                    {displayMember.avatar}
                                                </div>
                                                <div>
                                                    <h1 className="text-3xl font-bold text-slate-800 mb-1">{displayMember.first_name} {displayMember.last_name}</h1>
                                                    <p className="text-slate-600 mb-1">{displayMember.role}</p>
                                                    <p className="text-sm text-slate-500">{displayMember.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-lg">
                                                <TrendingUp className="w-5 h-5" />
                                                <span className="text-2xl font-bold">{memberPerformanceScore}%</span>
                                            </div>
                                        </div>

                                        {/* Task Stats Cards */}
                                        <div className="grid grid-cols-3 gap-4">
                                            {/* Completed Tasks */}
                                            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                                                <CheckCircle className="w-8 h-8 mb-3 opacity-90" />
                                                <p className="text-emerald-100 text-sm mb-1">Completed Tasks</p>
                                                <p className="text-4xl font-bold">{performance.completed_tasks_count}</p>
                                            </div>
                                            {/* In Progress */}
                                            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white shadow-lg">
                                                <Clock className="w-8 h-8 mb-3 opacity-90" />
                                                <p className="text-amber-100 text-sm mb-1">In Progress</p>
                                                <p className="text-4xl font-bold">{performance.in_progress_tasks_count}</p>
                                            </div>
                                            {/* Pending Tasks */}
                                            <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-6 text-white shadow-lg">
                                                <ListTodo className="w-8 h-8 mb-3 opacity-90" />
                                                <p className="text-slate-100 text-sm mb-1">Pending Tasks</p>
                                                <p className="text-4xl font-bold">{performance.pending_tasks_count}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Project Distribution and Recent Activity */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        
                                        {/* Project Distribution */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                                    <BarChart3 className="w-5 h-5 text-slate-700" />
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-800">Project Distribution</h3>
                                            </div>
                                            {(performance.project_distribution ?? []).length > 0 ? (
                                                <div className="space-y-5">
                                                    {(performance.project_distribution ?? []).map((project, idx) => {
                                                        const projectTotal = project.total_project_tasks || 1; // Avoid division by zero
                                                        const percentage = Math.round((project.task_count / projectTotal) * 100);

                                                        return (
                                                        <div key={idx} className="group">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <span className="text-sm font-medium text-slate-700">{project.project_name}</span>
                                                                <span className="text-lg font-bold text-slate-800">{project.task_count}</span>
                                                            </div>
                                                            <div className="relative">
                                                                <div className="w-full bg-slate-100 rounded-full h-3">
                                                                    <div
                                                                        className={`bg-indigo-500 h-3 rounded-full transition-all duration-500 shadow-sm`}
                                                                        style={{ 
                                                                            width: `${percentage}%` 
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span className="absolute right-0 -top-6 text-xs font-semibold text-slate-500">
                                                                    {percentage}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );})}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500">No project distribution data available.</p>
                                            )}

                                            <div className="mt-6 pt-6 border-t border-slate-100">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-slate-600">Total Tasks</span>
                                                    <span className="text-2xl font-bold text-slate-800">{performance.total_tasks_count}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Activity */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                                    <Activity className="w-5 h-5 text-slate-700" />
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-800">Recent Activity</h3>
                                            </div>
                                            <div className="space-y-4">
                                                {(performance.recent_activity ?? []).length > 0 ? (
                                                    (performance.recent_activity ?? []).map((activity, idx) => (
                                                        <div key={idx} className="flex gap-4 group">
                                                           <div className="flex flex-col items-center">
                                                                <div className={`w-3 h-3 rounded-full ${
                                                                    activity.status === 'completed' || activity.status === 'deployed' ? 'bg-emerald-500' : // Treat deployed as complete for coloring
                                                                    activity.status === 'in_progress' ? 'bg-amber-500' :
                                                                    'bg-slate-400' 
                                                                }`} />
                                                                {idx < (performance.recent_activity?.length ?? 0) - 1 && (
                                                                    <div className="w-0.5 h-full bg-slate-200 mt-2" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 pb-4">
                                                                <p className="font-medium text-slate-800 mb-1">{activity.task_name}</p>
                                                                <p className="text-xs text-slate-500 mb-2">{activity.project_name}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                                                        activity.status === 'completed' || activity.status === 'deployed' ? 'bg-emerald-100 text-emerald-700' :
                                                                        activity.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-slate-100 text-slate-600'
                                                                    }`}>
                                                                        {activity.status.replace('_', ' ')}
                                                                    </span>
                                                                    <span className="text-xs text-slate-400">{activity.timestamp}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-slate-500">No recent activity found.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};