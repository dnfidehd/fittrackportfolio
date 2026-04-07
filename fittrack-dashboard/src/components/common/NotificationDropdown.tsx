import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getMyNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext'; // ✅ 추가
import toast from 'react-hot-toast';
import { useVisiblePolling } from '../../hooks/useVisiblePolling';

interface Notification {
    id: number;
    recipient_id: number;
    sender_id?: number;
    type: string;
    title: string;
    message: string;
    related_link?: string;
    is_read: boolean;
    created_at: string;
}

// 🔔 Bell Icon SVG
const BellIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
);

// 🏆 Trophy Icon
const TrophyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
        <path d="M4 22h16"></path>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
    </svg>
);

// 💬 Message Icon
const MessageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

// ⚠️ Alert Icon
const AlertIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
);

// 📅 Calendar Icon (for reservations)
const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

const NotificationDropdown: React.FC = () => {
    const { user } = useAppContext(); // ✅ 추가
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        if (!user) return; // ✅ 인증 체크 추가
        try {
            const res = await getMyNotifications();
            setNotifications(res.data);
        } catch (err: any) {
            if (err.response?.status !== 401) {
                console.error("Failed to fetch notifications", err);
            }
        }
    }, [user]);

    // Fetch unread count
    const fetchUnreadCount = useCallback(async () => {
        if (!user) return; // ✅ 인증 체크 추가
        try {
            const res = await getUnreadCount();
            setUnreadCount(res.data.unread_count);
        } catch (err: any) {
            if (err.response?.status !== 401) {
                console.error("Failed to fetch unread count", err);
            }
        }
    }, [user]);

    // Polling for unread count (every 60s)
    useVisiblePolling(fetchUnreadCount, 30000, [user?.id], {
        enabled: !!user,
    });

    // When dropdown opens, fetch list
    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen, fetchNotifications]);

    const handleMarkRead = async (id: number, link?: string) => {
        try {
            await markNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));

            if (link) {
                setIsOpen(false);
                navigate(link);
            }
        } catch (err) {
            toast.error("알림 처리 실패");
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            toast.success("모든 알림을 읽음 처리했습니다.");
        } catch (err) {
            toast.error("일괄 처리 실패");
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'competition_status': return <TrophyIcon />;
            case 'comment':
            case 'reply': return <MessageIcon />;
            case 'reservation_confirmed':
            case 'reservation_cancelled': return <CalendarIcon />;
            case 'class_change':
            case 'system': return <AlertIcon />;
            default: return <BellIcon />;
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return '방금 전';
        if (mins < 60) return `${mins}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        if (days < 7) return `${days}일 전`;
        return date.toLocaleDateString();
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '8px',
                    borderRadius: '50%',
                    color: 'var(--text-secondary)',
                    transition: 'background-color 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title="알림"
            >
                <BellIcon />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '45px',
                    right: '0',
                    width: window.innerWidth < 480 ? '300px' : '360px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                    zIndex: 101,
                    maxHeight: '70vh',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.15s ease-out'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'var(--bg-secondary)',
                    }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            🔔 알림
                        </span>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--primary)',
                                    fontSize: '0.8rem',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                ✓ 모두 읽음
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {notifications.length > 0 ? (
                            notifications.map((noti) => (
                                <div
                                    key={noti.id}
                                    onClick={() => handleMarkRead(noti.id, noti.related_link)}
                                    style={{
                                        padding: '14px 16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        backgroundColor: noti.is_read ? 'transparent' : 'var(--bg-hover)',
                                        transition: 'background-color 0.15s',
                                        display: 'flex',
                                        gap: '12px',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = noti.is_read ? 'transparent' : 'var(--bg-secondary)';
                                    }}
                                >
                                    {/* Unread indicator */}
                                    {!noti.is_read && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '16px',
                                            right: '14px',
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: '#ef4444'
                                        }} />
                                    )}

                                    {/* Icon */}
                                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                                        {getIcon(noti.type)}
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: noti.is_read ? '500' : '700',
                                            fontSize: '0.9rem',
                                            marginBottom: '4px',
                                            color: 'var(--text-primary)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {noti.title}
                                        </div>
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-secondary)',
                                            marginBottom: '4px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical'
                                        }}>
                                            {noti.message}
                                        </div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-tertiary)'
                                        }}>
                                            {formatTime(noti.created_at)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{
                                padding: '40px 20px',
                                textAlign: 'center',
                                color: 'var(--text-tertiary)',
                                fontSize: '0.9rem'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔔</div>
                                새로운 알림이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Animation Keyframes */}
            <style>
                {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
            </style>
        </div>
    );
};

export default NotificationDropdown;
