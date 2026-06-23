import * as Tabs from '@radix-ui/react-tabs';
import {
  MessageSquare, Search, Plus, X, Users as UsersIcon, Paperclip, Smile,
  MoreVertical, Reply, Forward, Link2, Bookmark, Trash2, Pin, MailOpen,
  PinOff, Loader2, AlertCircle, RotateCcw,
} from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { chatApi } from '@/services/api';
import type { ChatRoom, ToastNotification, OptimisticChatMessage } from '@/types';
import { CreateTeamModal } from '@/pages/TeamManagement/Createteammodal';
import { ChatMessageInput } from '@/components/common/RichTextEditor';
import { DocumentThumbnail, DocumentPreview } from '@/components/common/DocumentPreview';
import { useTeamChat } from '@/hooks/useTeamChat';

// ─── MemberListContent 
function MemberListContent({ roomId, roomType }: { roomId: string; roomType: 'team' | 'project' }) {
  const { data: roomDetails, isLoading } = useQuery({
    queryKey: ['chat-room-details', roomId],
    queryFn: () => chatApi.getRoomDetails(roomId),
    enabled: !!roomId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const members = roomDetails?.memberships || [];

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <UsersIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No members found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {members.map((member) => (
        <div key={member.user.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-semibold text-white text-xs flex-shrink-0">
            {member.user.full_name
              ? ((member.user.full_name.split(' ')[0]?.charAt(0) || '') + (member.user.full_name.split(' ')[1]?.charAt(0) || '')).toUpperCase()
              : member.user.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{member.user.full_name || member.user.username}</p>
            <p className="text-[10px] text-gray-500 truncate">{member.user.email}</p>
          </div>
          {member.room_role && member.room_role !== 'member' && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
              {member.room_role}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ToastNotificationComponent 
function ToastNotificationComponent({
  toast,
  onDismiss,
}: {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-start gap-3 p-4 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[300px] max-w-[400px] animate-slide-in">
      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-700 text-sm flex-shrink-0">
        {toast.sender_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900">{toast.sender_name}</p>
        <p className="text-xs text-gray-600 mt-0.5 truncate">{toast.message_preview}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── PresenceIndicator 
function PresenceIndicator({
  status,
  size = 'md',
}: {
  status: 'online' | 'offline';
  size?: 'sm' | 'md';
}) {
  const isOnline = status === 'online';
  const sizeClass = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  return (
    <span
      title={isOnline ? 'Online' : 'Offline'}
      className={cn(
        'absolute rounded-full border-2 border-white flex items-center justify-center -bottom-0.5 -right-0.5',
        sizeClass,
        isOnline ? 'bg-green-500' : 'bg-gray-400'
      )}
    >
      {!isOnline && (
        <svg viewBox="0 0 8 8" className="w-1.5 h-1.5" fill="none">
          <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

// ─── Main Component 
export function TeamChatModern() {
  const chat = useTeamChat();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const derivedTab = (() => {
    if (pathname.startsWith('/team-chat/chat')) return 'direct';
    if (pathname.startsWith('/team-chat/project')) return 'channels';
    if (pathname.startsWith('/team-chat/teams')) return 'channels';
    if (pathname.startsWith('/team-chat/unread')) return 'unread';
    return 'all';
  })();

  useEffect(() => {
    if (derivedTab && derivedTab !== chat.activeTab) {
      chat.setActiveTab(derivedTab);
    }
  }, [derivedTab]);

  const directUnreadCount = chat.tabUnreadCounts['chats' as keyof typeof chat.tabUnreadCounts] || 0;
  const channelsUnreadCount = (chat.tabUnreadCounts['projects' as keyof typeof chat.tabUnreadCounts] || 0)
    + (chat.tabUnreadCounts['teams' as keyof typeof chat.tabUnreadCounts] || 0);
  const allUnreadCount = chat.tabUnreadCounts['unread' as keyof typeof chat.tabUnreadCounts] || 0;

  // Tab config
  const tabConfig = [
    { value: 'all', label: 'All', count: allUnreadCount },
    { value: 'channels', label: 'Channels', count: channelsUnreadCount },
    { value: 'direct', label: 'Direct', count: directUnreadCount },
    { value: 'unread', label: 'Unread', count: chat.tabUnreadCounts['unread' as keyof typeof chat.tabUnreadCounts] || 0 },
  ] as const;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 2xl:px-40 pt-6 pb-8 bg-[#F7F8FB]">
      <div className="flex flex-1 w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">

        {/* Document Preview Overlay */}
      {chat.previewDoc && (
        <div className="fixed inset-0 z-[200]">
          <DocumentPreview
            url={chat.previewDoc.url}
            fileName={chat.previewDoc.fileName}
            fileType={chat.previewDoc.fileType}
            onClose={() => chat.setPreviewDoc(null)}
            defaultFullscreen={false}
          />
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {chat.toastNotifications.map(toast => (
          <ToastNotificationComponent key={toast.id} toast={toast} onDismiss={chat.dismissToast} />
        ))}
      </div>

      {/* Left Sidebar */}
      <div className={cn(
        "bg-[#f3f2f1] border-r border-gray-200 flex flex-col h-full overflow-hidden flex-shrink-0 transition-all duration-200",
        "w-full md:w-80",
        (chat.activeRoom || chat.selectedProjectRoom || chat.selectedTeamRoom)
          ? "hidden md:flex"
          : "flex"
      )}>

        {/* Sidebar Header */}
        <div className="h-14 px-4 flex items-center justify-between bg-white border-b border-gray-200">
          <h2 className="font-semibold text-base text-gray-900">Chat</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => chat.setIsCreateTeamModalOpen(true)}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Create Team"
            >
              <Plus className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-3 bg-white border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={chat.searchQuery}
              onChange={(e) => chat.setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#f3f2f1] rounded border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs.Root
          value={chat.activeTab}
          onValueChange={(tab) => {
            chat.setActiveTab(tab);
            const tabToUrl: Record<string, string> = {
              all: '/team-chat',
              channels: '/team-chat/project',
              direct: '/team-chat/chat',
              unread: '/team-chat/unread',
            };
            if (tabToUrl[tab]) navigate(tabToUrl[tab]);
          }}
          className="flex-1 flex flex-col min-h-0"
        >
          {/* Tab Pills */}
          <Tabs.List className="flex items-center gap-1 px-3 py-2 bg-white border-b border-gray-200">
            {tabConfig.map(({ value, label, count }) => (
              <div key={value} className="relative inline-flex">
                <Tabs.Trigger
                  value={value}
                  className="px-4 py-1.5 text-xs font-medium rounded-full transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
                >
                  {label}
                </Tabs.Trigger>
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none pointer-events-none z-10">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </div>
            ))}
          </Tabs.List>

          {/* Scrollable Lists */}
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0 bg-white">

            {/* ── All Tab — Direct users + Projects + Teams */}
            <Tabs.Content value="all">
              <div className="bg-white">

                {/* Direct Messages section */}
                {chat.filteredUsers.length > 0 && (
                  <>
                    <div className="px-4 py-2 border-t border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Direct Messages</p>
                    </div>
                    {chat.filteredUsers.map(user => {
                      const isSelected = chat.selectedUserId === user.id;
                      const unreadCount = chat.getUserUnreadCount(user.id);
                      const hasUnread = (user as any).isUnread || unreadCount > 0;
                      const roomId = chat.userRoomMap.get(user.id);
                      const roomDetailsQuery = roomId
                        ? chat.queryClient.getQueryData(['chat-room-details', roomId]) as ChatRoom | undefined
                        : undefined;
                      const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;
                      const presenceStatus = chat.userPresence.get(user.id) ?? 'offline';

                      return (
                        <button
                          key={user.id}
                          onClick={() => chat.handleUserSelect(user.id)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                            isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <div className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm overflow-hidden",
                              isSelected ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                            )}>
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={`${user.first_name} ${user.last_name}`}
                                  className="w-full h-full object-cover rounded-full"
                                  onError={e => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                ((user.first_name?.charAt(0) || '') + (user.last_name?.charAt(0) || '')).toUpperCase() || user.username.charAt(0).toUpperCase()
                              )}
                            </div>
                            <PresenceIndicator status={presenceStatus} size="md" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={cn(
                                "text-sm truncate flex-1",
                                hasUnread ? "font-bold text-gray-900" : "font-medium text-gray-900"
                              )}>
                                {user?.first_name} {user?.last_name}
                              </p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {isFavourite && <Pin className="h-3.5 w-3.5 text-blue-600" />}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={cn(
                                "text-xs truncate",
                                hasUnread ? "font-semibold text-gray-900" : "text-gray-600"
                              )}>
                                {user.lastMessageContent
                                  ? user.lastMessageContent.replace(/<[^>]*>/g, '').trim() || 'Sent a message'
                                  : 'No messages yet'}
                              </p>
                              {unreadCount > 0 && (
                                <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Projects section */}
                {chat.projectRooms.length > 0 && (
                  <>
                    <div className="px-4 py-2 border-t border-gray-100 mt-1">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Projects</p>
                    </div>
                    {chat.projectRooms.map(project => {
                      const isSelected = chat.selectedProjectRoom?.id === project.id;
                      const unreadCount = chat.unreadCounts.get(project.id) || 0;
                      const roomDetailsQuery = chat.queryClient.getQueryData(['chat-room-details', project.id]) as ChatRoom | undefined;
                      const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;

                      return (
                        <button
                          key={project.id}
                          onClick={() => chat.handleProjectClick(project)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                            isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                          )}
                        >
                          <div className="h-10 w-10 rounded bg-purple-100 flex items-center justify-center font-semibold text-purple-700 text-sm flex-shrink-0">
                            {project.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                            <p className="text-xs text-gray-600 truncate">
                              {project.last_message?.content_preview
                                ? project.last_message.content_preview.replace(/<[^>]*>/g, '').trim() || 'Sent a message'
                                : 'No messages yet'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isFavourite && <Pin className="h-3.5 w-3.5 text-blue-600" />}
                            {unreadCount > 0 && (
                              <span className="h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Teams section */}
                {chat.teamRooms.length > 0 && (
                  <>
                    <div className="px-4 py-2 border-t border-gray-100 mt-1">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Teams</p>
                    </div>
                    {chat.teamRooms.map(team => {
                      const isSelected = chat.selectedTeamRoom?.id === team.id;
                      const unreadCount = chat.unreadCounts.get(team.id) || 0;
                      const roomDetailsQuery = chat.queryClient.getQueryData(['chat-room-details', team.id]) as ChatRoom | undefined;
                      const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;

                      return (
                        <button
                          key={team.id}
                          onClick={() => chat.handleTeamClick(team)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                            isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                          )}
                        >
                          <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center font-semibold text-green-700 text-sm flex-shrink-0">
                            {team.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-gray-900 truncate">{team.name}</p>
                            <p className="text-xs text-gray-600 truncate">
                              {(() => {
                                const lastMsg = (team.last_message as any);
                                if (!lastMsg) return 'No messages yet';
                                const raw = lastMsg.content_preview || lastMsg.content || '';
                                return raw.replace(/<[^>]*>/g, '').trim() || 'Sent a message';
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isFavourite && <Pin className="h-3.5 w-3.5 text-blue-600" />}
                            {unreadCount > 0 && (
                              <span className="h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Empty state for All */}
                {chat.filteredUsers.length === 0 && chat.projectRooms.length === 0 && chat.teamRooms.length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500">Nothing found</div>
                )}
              </div>
            </Tabs.Content>

            {/* Channels Tab */}
            <Tabs.Content value="channels">
              <div className="bg-white">

                {/* Projects section */}
                {chat.isLoadingProjects ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 border-t border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Projects</p>
                    </div>
                    {chat.projectRooms.length === 0 ? (
                      <div className="px-4 pb-3 text-xs text-gray-400">No projects</div>
                    ) : (
                      chat.projectRooms.map(project => {
                        const isSelected = chat.selectedProjectRoom?.id === project.id;
                        const unreadCount = chat.unreadCounts.get(project.id) || 0;
                        const roomDetailsQuery = chat.queryClient.getQueryData(['chat-room-details', project.id]) as ChatRoom | undefined;
                        const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;

                        return (
                          <button
                            key={project.id}
                            onClick={() => chat.handleProjectClick(project)}
                            className={cn(
                              "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                              isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                            )}
                          >
                            <div className="h-10 w-10 rounded bg-purple-100 flex items-center justify-center font-semibold text-purple-700 text-sm flex-shrink-0">
                              {project.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                              <p className="text-xs text-gray-600 truncate">
                                {project.last_message?.content_preview
                                  ? project.last_message.content_preview.replace(/<[^>]*>/g, '').trim() || 'Sent a message'
                                  : 'No messages yet'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isFavourite && <Pin className="h-3.5 w-3.5 text-blue-600" />}
                              {unreadCount > 0 && (
                                <span className="h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </>
                )}

                {/* Teams section */}
                {chat.isLoadingTeams ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 border-t border-gray-100 mt-1">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Teams</p>
                    </div>
                    {chat.teamRooms.length === 0 ? (
                      <div className="px-4 pb-3 text-xs text-gray-400">No teams</div>
                    ) : (
                      chat.teamRooms.map(team => {
                        const isSelected = chat.selectedTeamRoom?.id === team.id;
                        const unreadCount = chat.unreadCounts.get(team.id) || 0;
                        const roomDetailsQuery = chat.queryClient.getQueryData(['chat-room-details', team.id]) as ChatRoom | undefined;
                        const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;

                        return (
                          <button
                            key={team.id}
                            onClick={() => chat.handleTeamClick(team)}
                            className={cn(
                              "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                              isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                            )}
                          >
                            <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center font-semibold text-green-700 text-sm flex-shrink-0">
                              {team.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-gray-900 truncate">{team.name}</p>
                              <p className="text-xs text-gray-600 truncate">
                                {(() => {
                                  const lastMsg = (team.last_message as any);
                                  if (!lastMsg) return 'No messages yet';
                                  const raw = lastMsg.content_preview || lastMsg.content || '';
                                  return raw.replace(/<[^>]*>/g, '').trim() || 'Sent a message';
                                })()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isFavourite && <Pin className="h-3.5 w-3.5 text-blue-600" />}
                              {unreadCount > 0 && (
                                <span className="h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            </Tabs.Content>

            {/* ── Direct Tab — 1-to-1 user conversations */}
            <Tabs.Content value="direct">
              <div className="bg-white">
                <div className="border-t border-gray-100">
                  {chat.isLoadingUsers ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                    </div>
                  ) : chat.filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No users found</div>
                  ) : (
                    chat.filteredUsers.map(user => {
                      const isSelected = chat.selectedUserId === user.id;
                      const unreadCount = chat.getUserUnreadCount(user.id);
                      const hasUnread = (user as any).isUnread || unreadCount > 0;
                      const roomId = chat.userRoomMap.get(user.id);
                      const roomDetailsQuery = roomId
                        ? chat.queryClient.getQueryData(['chat-room-details', roomId]) as ChatRoom | undefined
                        : undefined;
                      const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;
                      const presenceStatus = chat.userPresence.get(user.id) ?? 'offline';

                      return (
                        <button
                          key={user.id}
                          onClick={() => chat.handleUserSelect(user.id)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                            isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <div className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm overflow-hidden",
                              isSelected ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                            )}>
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={`${user.first_name} ${user.last_name}`}
                                  className="w-full h-full object-cover rounded-full"
                                  onError={e => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                ((user.first_name?.charAt(0) || '') + (user.last_name?.charAt(0) || '')).toUpperCase() || user.username.charAt(0).toUpperCase()
                              )}
                            </div>
                            <PresenceIndicator status={presenceStatus} size="md" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={cn(
                                "text-sm truncate flex-1",
                                hasUnread ? "font-bold text-gray-900" : "font-medium text-gray-900"
                              )}>
                                {user?.first_name} {user?.last_name}
                              </p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {isFavourite && <Pin className="h-3.5 w-3.5 text-blue-600" />}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={cn(
                                "text-xs truncate",
                                hasUnread ? "font-semibold text-gray-900" : "text-gray-600"
                              )}>
                                {user.lastMessageContent
                                  ? user.lastMessageContent.replace(/<[^>]*>/g, '').trim() || 'Sent a message'
                                  : 'No messages yet'}
                              </p>
                              {unreadCount > 0 && (
                                <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </Tabs.Content>

            {/* ── Unread Tab — unchanged */}
            <Tabs.Content value="unread">
              <div className="bg-white">
                <div className="border-t border-gray-100">
                  {chat.allUnreadItems.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No unread messages</div>
                  ) : (
                    chat.allUnreadItems.map(item => (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={item.onClick}
                        className={cn(
                          "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2",
                          item.isSelected ? "bg-blue-50 border-blue-600" : "border-transparent"
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          <div className={cn(
                            "h-10 w-10 flex items-center justify-center font-semibold text-sm",
                            item.isSelected ? "bg-blue-600 text-white rounded-full" : item.avatarClass
                          )}>
                            {item.avatar}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-900 truncate">{item.preview}</p>
                            {item.unreadCount > 0 && (
                              <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                                {item.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </Tabs.Content>

          </div>
        </Tabs.Root>
      </div>

      {/* ── Right Panel - Chat View */}
      <div className={cn(
        "flex-1 flex flex-col bg-white h-full overflow-hidden min-w-0",
        !(chat.activeRoom || chat.selectedProjectRoom || chat.selectedTeamRoom)
          ? "hidden md:flex"
          : "flex"
      )}>
        {(chat.activeRoom || chat.selectedProjectRoom || chat.selectedTeamRoom) ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-6 flex items-center justify-between bg-white border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {chat.selectedProjectRoom ? (
                      <div className="h-10 w-10 rounded bg-purple-100 flex items-center justify-center font-semibold text-purple-700 text-sm">
                        {chat.selectedProjectRoom.name.charAt(0).toUpperCase()}
                      </div>
                    ) : chat.selectedTeamRoom ? (
                      <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center font-semibold text-green-700 text-sm">
                        {chat.selectedTeamRoom.name.charAt(0).toUpperCase()}
                      </div>
                    ) : chat.selectedUser ? (
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-700 text-sm overflow-hidden">
                          {chat.selectedUser.avatar ? (
                            <img
                              src={chat.selectedUser.avatar}
                              alt={`${chat.selectedUser.first_name} ${chat.selectedUser.last_name}`}
                              className="w-full h-full object-cover"
                              onError={e => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            ((chat.selectedUser.first_name?.charAt(0) || '') + (chat.selectedUser.last_name?.charAt(0) || '')).toUpperCase() || chat.selectedUser.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <PresenceIndicator status={chat.userPresence.get(chat.selectedUser.id) ?? 'offline'} size="md" />
                      </div>
                    ) : null}
                  </div>
                  <div>
                   <div className="flex items-center gap-2 min-w-0">
                      {/* Back to sidebar — mobile only */}
                      <button
                        className="md:hidden p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                        onClick={() => navigate('/team-chat')}
                        aria-label="Back to chat list"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M11 14l-5-5 5-5" stroke="#374151" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {chat.selectedProjectRoom?.name
                          || chat.selectedTeamRoom?.name
                          || chat.activeRoom?.name
                          || chat.selectedUser
                            ? `${chat.selectedUser?.first_name || ''} ${chat.selectedUser?.last_name || ''}`.trim() || chat.selectedUser?.username
                            : 'Select a conversation'}
                      </h3>
                    </div>
                    {chat.selectedProjectRoom && <p className="text-xs text-gray-500" />}
                    {chat.selectedTeamRoom && <p className="text-xs text-gray-500" />}
                  </div>
                </div>

                {/* View Switcher */}
                <Tabs.Root
                  value={chat.headerView}
                  onValueChange={(value) => chat.setHeaderView(value as 'chat' | 'shared')}
                  className="flex items-center"
                >
                  <Tabs.List className="flex items-center gap-1 border-b-2 border-transparent">
                    {(['chat', 'shared'] as const).map(v => (
                      <Tabs.Trigger
                        key={v}
                        value={v}
                        className="px-3 py-1 text-sm font-medium transition-all border-b-2 -mb-[2px] data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=inactive]:border-transparent data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900"
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                </Tabs.Root>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1">
                <div className="relative" ref={chat.headerMenuRef}>
                  <button
                    onClick={() => chat.setShowHeaderMenu(!chat.showHeaderMenu)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <MoreVertical className="h-4 w-4 text-gray-600" />
                  </button>

                  {chat.showHeaderMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        onClick={() => {
                          const roomId = chat.selectedProjectRoom?.id || chat.selectedTeamRoom?.id || chat.activeRoom?.id;
                          if (roomId) {
                            const roomDetailsQuery = chat.queryClient.getQueryData(['chat-room-details', roomId]) as ChatRoom | undefined;
                            const currentFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;
                            chat.toggleFavouriteMutation.mutate({ roomId, isFavourite: !currentFavourite });
                          } else {
                            console.error('❌ No room ID available for favourite toggle');
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        {(() => {
                          const roomId = chat.selectedProjectRoom?.id || chat.selectedTeamRoom?.id || chat.activeRoom?.id;
                          const roomDetailsQuery = roomId ? chat.queryClient.getQueryData(['chat-room-details', roomId]) as ChatRoom | undefined : undefined;
                          const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;
                          return isFavourite ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />;
                        })()}
                        {(() => {
                          const roomId = chat.selectedProjectRoom?.id || chat.selectedTeamRoom?.id || chat.activeRoom?.id;
                          const roomDetailsQuery = roomId ? chat.queryClient.getQueryData(['chat-room-details', roomId]) as ChatRoom | undefined : undefined;
                          const isFavourite = roomDetailsQuery?.current_user_membership?.is_favourite || false;
                          return isFavourite ? 'Remove from favourites' : 'Add to favourites';
                        })()}
                      </button>

                      {(chat.selectedTeamRoom || chat.selectedProjectRoom) && (
                        <>
                          <button
                            onClick={() => chat.setShowMemberList(!chat.showMemberList)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <UsersIcon className="h-4 w-4" />
                            Member list
                          </button>
                          {chat.showMemberList && (
                            <div className="border-t border-gray-200 mt-1 pt-2 px-2 max-h-64 overflow-y-auto">
                              {chat.selectedTeamRoom && <MemberListContent roomId={chat.selectedTeamRoom.id} roomType="team" />}
                              {chat.selectedProjectRoom && <MemberListContent roomId={chat.selectedProjectRoom.id} roomType="project" />}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            {chat.headerView === 'chat' ? (
              <>
                {/* Messages Area */}
                <div
                  ref={chat.scrollContainerRef}
                  className="flex-1 overflow-y-auto bg-[#efeae2] scrollbar-hide p-6"
                  onScroll={chat.handleScroll}
                  onDragEnter={chat.handleDragEnter}
                  onDragOver={chat.handleDragOver}
                  onDragLeave={chat.handleDragLeave}
                  onDrop={chat.handleDrop}
                >
                  {/* Drag Overlay */}
                  {chat.isDragging && (
                    <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-4 border-dashed border-blue-400 rounded-lg z-50 flex items-center justify-center">
                      <div className="text-center">
                        <Paperclip className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                        <p className="text-xl font-semibold text-blue-600">Drop file to upload</p>
                        <p className="text-sm text-blue-500 mt-2">Release to attach the file</p>
                      </div>
                    </div>
                  )}

                  {chat.isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                    </div>
                  ) : chat.messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No messages yet</p>
                        <p className="text-xs text-gray-400 mt-1">Start the conversation!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chat.isFetchingMore && (
                        <div className="flex justify-center py-4">
                          <div className="flex items-center gap-2 text-xs font-medium text-blue-600 bg-white border border-blue-200 px-4 py-1.5 rounded-full shadow-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading older messages...
                          </div>
                        </div>
                      )}

                      {chat.messages.filter(m => m.sender != null).map((message, index, visibleMessages) => {
                        const isOwn = message.is_own_message;
                        const showAvatar = index === 0 || visibleMessages[index - 1].sender.id !== message.sender.id;
                        const isHovered = chat.hoveredMessageId === message.id;

                        const msgDate = new Date(message.created_at);
                        const msgDay = msgDate.toDateString();
                        const prevMsgDay = index > 0 ? new Date(chat.messages[index - 1].created_at).toDateString() : null;
                        const showDateSeparator = index === 0 || msgDay !== prevMsgDay;

                        const getDateLabel = (date: Date) => {
                          const today = new Date();
                          const yesterday = new Date();
                          yesterday.setDate(today.getDate() - 1);
                          if (date.toDateString() === today.toDateString()) return 'Today';
                          if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
                          return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                        };

                        const menuOpen = chat.openMenuMessageId === message.id;
                        const reactions = chat.messageReactions.get(message.id);

                        return (
                          <div key={message.id}>
                            {showDateSeparator && (
                              <div className="flex items-center gap-3 my-4 px-2">
                                <div className="flex-1 h-px bg-gray-400" />
                                <span className="text-[11px] font-medium text-gray-700 bg-[#efeae2] px-3 py-1 rounded-full whitespace-nowrap select-none">
                                  {getDateLabel(msgDate)}
                                </span>
                                <div className="flex-1 h-px bg-gray-400" />
                              </div>
                            )}

                            <div
                              className={cn("flex gap-2 group relative", isOwn ? "flex-row-reverse" : "")}
                              onMouseEnter={() => chat.setHoveredMessageId(message.id)}
                              onMouseLeave={() => chat.setHoveredMessageId(null)}
                            >
                              {/* Avatar */}
                              <div className="flex-shrink-0">
                                {showAvatar ? (
                                  <div className="h-6 w-6 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center font-semibold text-white text-sm shadow-sm flex-shrink-0">
                                    {(message.sender as any).avatar ? (
                                      <img
                                        src={(message.sender as any).avatar}
                                        alt={message.sender.full_name || message.sender.username}
                                        className="w-full h-full object-cover"
                                        onError={e => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    ) : (
                                      message.sender.full_name
                                        ? (message.sender.full_name.split(' ')[0]?.charAt(0) || '') + (message.sender.full_name.split(' ')[1]?.charAt(0) || '')
                                        : message.sender.username.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-9 w-9" />
                                )}
                              </div>

                              {/* Message Content */}
                              <div className={cn("flex-1 max-w-[65%]", isOwn ? "flex flex-col items-end" : "flex flex-col items-start")}>
                                {showAvatar && (
                                  <div className={cn("flex items-baseline gap-2 mb-1", isOwn ? "flex-row-reverse" : "")}>
                                    <span className={cn("text-xs font-medium", isOwn ? "text-gray-700" : "text-gray-900")}>
                                      {message.sender.full_name || message.sender.username}
                                    </span>
                                    <span className="text-[11px] text-gray-400 font-normal">
                                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                )}

                                <div className="relative">
                                  {(() => {
                                    const plainText = message.content ? message.content.replace(/<[^>]*>/g, '').trim() : '';
                                    const isEmojiOnly = plainText.length > 0 &&
                                      /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}\s]+$/u.test(plainText) &&
                                      !/[a-zA-Z0-9]/.test(plainText);

                                    return (
                                      <div
                                        className={cn(
                                          "text-sm break-words max-w-full",
                                          isEmojiOnly
                                            ? "px-1 py-1"
                                            : cn(
                                              "px-3 py-2 rounded-lg shadow-sm",
                                              isOwn
                                                ? "bg-[#7699a3] text-white rounded-br-none"
                                                : "bg-white text-gray-900 border border-gray-100 rounded-bl-none"
                                            )
                                        )}
                                        style={{ minWidth: isEmojiOnly ? undefined : '60px', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                                      >
                                        {message.content && (
                                          <div
                                            className={cn(
                                              "prose prose-sm max-w-none break-words",
                                              isEmojiOnly
                                                ? "[&_p]:m-0 [&_p]:text-4xl [&_p]:leading-none"
                                                : isOwn
                                                  ? "prose-invert [&_*]:text-white [&_a]:text-blue-200 [&_code]:bg-green-800 [&_code]:text-green-100 [&_blockquote]:border-green-400"
                                                  : "[&_a]:text-blue-600 [&_code]:bg-gray-100 [&_code]:text-red-600"
                                            )}
                                            dangerouslySetInnerHTML={{ __html: message.content }}
                                          />
                                        )}

                                        {message.attachment && (
                                          <div className={message.content ? "mt-2 pt-2 border-t border-blue-500" : ""}>
                                            {(message as OptimisticChatMessage).optimisticStatus === 'sending' ? (
                                              <div className="flex items-center gap-2 text-xs opacity-70">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                <span>{(message as OptimisticChatMessage).attachment_name || 'Uploading file…'}</span>
                                              </div>
                                            ) : (
                                              <DocumentThumbnail
                                                url={message.attachment}
                                                fileName={message.attachment_name || 'Attachment'}
                                                onClick={() => chat.setPreviewDoc({
                                                  url: message.attachment!,
                                                  fileName: message.attachment_name || 'Attachment',
                                                })}
                                                className="w-40"
                                              />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Optimistic status */}
                                  {isOwn && (message as OptimisticChatMessage).optimisticStatus === 'sending' && (
                                    <div className="flex justify-end mt-1">
                                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Sending…
                                      </span>
                                    </div>
                                  )}
                                  {isOwn && (message as OptimisticChatMessage).optimisticStatus === 'error' && (
                                    <div className="flex justify-end mt-1">
                                      <button
                                        onClick={() => chat.handleRetryMessage(message as OptimisticChatMessage)}
                                        className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 transition-colors"
                                        title="Failed to send — click to retry"
                                      >
                                        <AlertCircle className="h-3 w-3" />
                                        Failed to send
                                        <RotateCcw className="h-3 w-3 ml-0.5" />
                                      </button>
                                    </div>
                                  )}

                                  {/* Quick Actions on Hover */}
                                  {(isHovered || menuOpen) && (
                                    <div className={cn(
                                      "absolute top-0 flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5",
                                      isOwn ? "right-full mr-2" : "left-full ml-2"
                                    )}>
                                      <button onClick={() => chat.handleQuickReaction(message.id, '👍')} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Like">
                                        <span className="text-xs">👍</span>
                                      </button>
                                      <button onClick={() => chat.handleQuickReaction(message.id, '❤️')} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Love">
                                        <span className="text-xs">❤️</span>
                                      </button>
                                      <button onClick={() => chat.handleQuickReaction(message.id, '😊')} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Smile">
                                        <span className="text-xs">😊</span>
                                      </button>
                                      <div className="h-4 w-px bg-gray-200 mx-0.5" />
                                      <button
                                        onClick={() => chat.setShowReactionPicker(chat.showReactionPicker === message.id ? null : message.id)}
                                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        title="More reactions"
                                      >
                                        <Smile className="h-3.5 w-3.5 text-gray-600" />
                                      </button>
                                      <button
                                        onClick={() => chat.setOpenMenuMessageId(menuOpen ? null : message.id)}
                                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        title="More options"
                                      >
                                        <MoreVertical className="h-3.5 w-3.5 text-gray-600" />
                                      </button>

                                      {/* Dropdown Menu */}
                                      {menuOpen && (
                                        <div
                                          ref={chat.menuRef}
                                          className={cn(
                                            "absolute top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48 z-50",
                                            isOwn ? "right-0" : "left-0"
                                          )}
                                        >
                                          <button onClick={() => chat.handleReplyWithQuote(message)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                                            <Reply className="h-4 w-4" /> Reply
                                          </button>
                                          <button onClick={() => chat.handleForward(message)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                                            <Forward className="h-4 w-4" /> Forward
                                          </button>
                                          <button onClick={() => chat.handleCopyLink(message)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                                            <Link2 className="h-4 w-4" /> Copy link
                                          </button>
                                          <button onClick={() => chat.handlePinMessage(message)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                                            <Pin className="h-4 w-4" /> Pin message
                                          </button>
                                          <button onClick={() => chat.handleSaveMessage(message)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                                            <Bookmark className="h-4 w-4" /> Save
                                          </button>
                                          <button onClick={() => chat.handleMarkAsUnread(message)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                                            <MailOpen className="h-4 w-4" /> Mark as unread
                                          </button>
                                          <div className="h-px bg-gray-200 my-1" />
                                          {isOwn && (
                                            <button
                                              onClick={() => chat.handleDeleteMessage(message.id)}
                                              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                            >
                                              <Trash2 className="h-4 w-4" /> Delete
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Reactions Display */}
                                  {reactions && reactions.size > 0 && (
                                    <div className={cn("flex gap-1 mt-1", isOwn ? "justify-end" : "")}>
                                      {Array.from(reactions.entries()).map(([emoji, count]) => (
                                        <span key={emoji} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs">
                                          <span>{emoji}</span>
                                          <span className="text-gray-600">{count}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chat.messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <div
                  className="bg-white border-t border-gray-200"
                  onDragEnter={chat.handleDragEnter}
                  onDragOver={chat.handleDragOver}
                  onDragLeave={chat.handleDragLeave}
                  onDrop={chat.handleDrop}
                >
                  <>
                    <input
                      ref={chat.fileInputRef}
                      type="file"
                      onChange={chat.handleFileSelect}
                      className="hidden"
                      accept="*"
                      multiple
                    />

                    {chat.selectedFiles.length > 0 && (
                      <div className="flex flex-col bg-white border-b border-gray-100">
                        {chat.selectedFiles.length > 1 && (
                          <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between text-sm text-blue-700">
                            <span className="flex items-center gap-2 font-medium">
                              <Paperclip className="h-4 w-4" />
                              {chat.selectedFiles.length} files selected
                            </span>
                            <button
                              onClick={() => {
                                chat.setSelectedFiles([]);
                                chat.filePreviewUrls.forEach(url => { if (url) URL.revokeObjectURL(url); });
                                chat.setFilePreviewUrls([]);
                                if (chat.fileInputRef.current) chat.fileInputRef.current.value = '';
                              }}
                              className="hover:text-blue-900 p-1"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}

                        <div className="px-4 py-3 flex items-center gap-3 overflow-x-auto scrollbar-hide">
                          {chat.selectedFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 shrink-0 w-64 max-w-full">
                              {chat.filePreviewUrls[index] ? (
                                <img src={chat.filePreviewUrls[index]} alt={file.name} className="h-9 w-9 object-cover rounded border border-blue-200" />
                              ) : (
                                <div className="h-9 w-9 rounded bg-blue-100 flex items-center justify-center shrink-0">
                                  <Paperclip className="h-4 w-4 text-blue-600" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <p className="text-sm font-medium text-blue-900 truncate" title={file.name}>{file.name}</p>
                                <p className="text-xs text-blue-500">{(file.size / 1024).toFixed(1)} KB</p>
                              </div>
                              <button
                                onClick={() => {
                                  const newFiles = [...chat.selectedFiles];
                                  newFiles.splice(index, 1);
                                  chat.setSelectedFiles(newFiles);
                                  const newUrls = [...chat.filePreviewUrls];
                                  const removedUrl = newUrls.splice(index, 1)[0];
                                  if (removedUrl) URL.revokeObjectURL(removedUrl);
                                  chat.setFilePreviewUrls(newUrls);
                                  if (newFiles.length === 0 && chat.fileInputRef.current) {
                                    chat.fileInputRef.current.value = '';
                                  }
                                }}
                                className="p-1 hover:bg-blue-100 rounded text-blue-400 hover:text-blue-600 transition-colors shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <ChatMessageInput
                      value={chat.messageInput}
                      onChange={(plainText, html) => {
                        chat.setMessageInput(plainText);
                        chat.setRichHtmlContent(html);
                      }}
                      onSend={chat.handleSendMessage}
                      onAttachmentClick={chat.handleAttachmentClick}
                      placeholder="Type a message…"
                      disabled={false}
                      isUploading={chat.isUploadingFile}
                      selectedFile={null}
                      filePreviewUrl={null}
                      onRemoveFile={() => { }}
                      hasAttachments={chat.selectedFiles.length > 0}
                    />
                  </>
                </div>
              </>
            ) : (
              /* Shared Documents Panel */
              <div className="flex-1 overflow-y-auto bg-[#f3f2f1] p-6">
                <div className="max-w-4xl mx-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Shared Documents</h3>
                  {chat.sharedDocuments.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <Paperclip className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No shared documents</p>
                        <p className="text-xs text-gray-400 mt-1">Documents shared in this chat will appear here</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {chat.sharedDocuments.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => chat.setPreviewDoc({ url: doc.url, fileName: doc.name })}
                          className="w-full flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
                        >
                          <div className="h-12 w-12 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Paperclip className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">{doc.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Shared by {doc.sender.full_name || doc.sender.username} • {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-[#f3f2f1]">
            <div className="text-center max-w-sm">
              <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-10 w-10 text-blue-600" />
              </div>
             <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Chat</h3>
              <p className="text-gray-600 text-sm">Select a user from the list to start messaging</p>
              <p className="text-xs text-gray-400 mt-4">
                {chat.users.length} {chat.users.length === 1 ? 'user' : 'users'} available
              </p>
            </div>
          </div>
        )}
        </div>
      </div> 

      {/* Create Team Modal */}
      {chat.isCreateTeamModalOpen && (
        <CreateTeamModal
          isOpen={chat.isCreateTeamModalOpen}
          onClose={() => chat.setIsCreateTeamModalOpen(false)}
          onSuccess={() => {
            chat.setIsCreateTeamModalOpen(false);
            chat.queryClient.invalidateQueries({
              queryKey: ['team-chat-rooms'],
              refetchType: 'active'
            });
          }}
        />
      )}
    </div>
  );
}