import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { teamsApi, usersApi } from '@/services/api';
import { LINE, MUTED, TEXT } from '@/config/tokens';
import type { Team } from '@/types';

interface Props {
  team: Team;
  onMemberAdded: () => void;
}

export function AddMembersDropdown({ team, onMemberAdded }: Props) {
  const [isOpen,           setIsOpen]           = React.useState(false);
  const [searchTerm,       setSearchTerm]       = React.useState('');
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number } | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef   = React.useRef<HTMLButtonElement>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users-all'],
    queryFn: usersApi.listAll, // GET /tasksite/all-users/ — returns all users
    staleTime: Infinity,
  });

  const allUsers = React.useMemo(() => {
    if (!usersData) return [];
    const data = (usersData as any).users || (usersData as any)?.results || usersData;
    return Array.isArray(data) ? data : [];
  }, [usersData]);

  const filteredUsers = React.useMemo(() => {
    const existingIds = team.members?.map(m => m.user.id) || [];
    const available   = allUsers.filter((u: any) => !existingIds.includes(u.id));
    if (!searchTerm.trim()) return available;
    const term = searchTerm.toLowerCase();
    return available.filter((u: any) => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      return name.includes(term) || (u.username || '').toLowerCase().includes(term);
    });
  }, [allUsers, team.members, searchTerm]);

  React.useEffect(() => {
    if (isOpen && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: r.bottom + 8,
        left: Math.max(8, r.right - 220),
      });
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current   && !buttonRef.current.contains(e.target as Node)
      ) { setIsOpen(false); setSearchTerm(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleAddMember = async (userId: number) => {
    try {
      await teamsApi.addMember(team.id, { user_id: userId, role: 'member' });
      onMemberAdded();
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setIsOpen(v => !v); }}
        style={{
          padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer',
          background: isOpen ? '#1663f618' : 'none',
          color: '#1663f6', display: 'flex', alignItems: 'center', transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#1663f618'}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'none'; }}
        title="Add members"
      >
        <UserPlus style={{ width: 15, height: 15 }} />
      </button>

      {isOpen && dropdownPosition && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed', zIndex: 9999,
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: 240,
            background: 'hsl(var(--popover))',
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.18)',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Search */}
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${LINE}` }}>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', padding: '5px 10px', fontSize: 12,
                border: `1px solid ${LINE}`, borderRadius: 6,
                background: 'hsl(var(--input))', color: TEXT,
                outline: 'none', fontFamily: 'inherit',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#1663f6'}
              onBlur={e => e.currentTarget.style.borderColor = LINE}
            />
          </div>

          {/* Results */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {isLoading ? (
              <p style={{ padding: '12px', fontSize: 12, color: MUTED, textAlign: 'center', margin: 0 }}>Loading…</p>
            ) : filteredUsers.length === 0 ? (
              <p style={{ padding: '12px', fontSize: 12, color: MUTED, textAlign: 'center', margin: 0 }}>
                {searchTerm ? 'No users found' : 'No available users'}
              </p>
            ) : filteredUsers.map((user: any) => {
              const name = user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username;
              return (
                <div
                  key={user.id}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); handleAddMember(user.id); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 13, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}