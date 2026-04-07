import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { getConversations, getCoachesList } from '../../services/api';
import ChatRoom from '../../components/chat/ChatRoom';
import { User, ChevronRight, X, MessageCircleMore } from 'lucide-react';

interface Conversation {
    id: number;
    name: string;
    role: string;
    gym_id?: number | null;
    last_message?: string | null;
    last_message_at?: string | null;
    unread_count: number;
}

const CoachChatPage: React.FC = () => {
    const { user } = useAppContext();
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
    const [selectedPartnerName, setSelectedPartnerName] = useState<string>('');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [coaches, setCoaches] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. 기존 대화 목록 조회
            const convRes = await getConversations();
            setConversations(convRes.data);

            // 2. 채팅 가능한 코치 목록 조회 (새 대화 시작용)
            if (user?.role === 'user') {
                const coachRes = await getCoachesList();
                setCoaches(coachRes.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatMessageTime = (value?: string | null) => {
        if (!value) return '';
        const date = new Date(value);
        const now = new Date();
        const isSameDay = date.toDateString() === now.toDateString();
        if (isSameDay) {
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    };

    const getRoleLabel = (role: string) => {
        if (role === 'subcoach') return '관리자';
        if (role === 'coach') return '코치';
        return '문의 담당';
    };

    if (selectedPartnerId) {
        return (
            <ChatRoom
                partnerId={selectedPartnerId}
                partnerName={selectedPartnerName}
                onBack={() => {
                    setSelectedPartnerId(null);
                    fetchData(); // 돌아올 때 목록 갱신
                }}
            />
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>코치에게 문의하기</h1>
                    <p style={styles.subtitle}>문의 내역을 확인하고 새 대화를 시작할 수 있습니다.</p>
                </div>
                <button
                    style={styles.newChatBtn}
                    onClick={() => setIsModalOpen(true)}
                >
                    새 문의
                </button>
            </div>

            {loading ? (
                <div style={styles.emptyState}>
                    <p>문의 목록을 불러오는 중입니다.</p>
                </div>
            ) : conversations.length === 0 ? (
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>
                        <MessageCircleMore size={26} color="#3182F6" />
                    </div>
                    <p style={styles.emptyTitle}>진행 중인 대화가 없습니다.</p>
                    <p style={styles.emptyDescription}>궁금한 점이 있으면 코치에게 바로 문의를 남겨보세요.</p>
                    <button
                        style={styles.startButton}
                        onClick={() => setIsModalOpen(true)}
                    >
                        새 문의 시작하기
                    </button>
                </div>
            ) : (
                <div style={styles.list}>
                    {conversations.map((partner) => (
                        <button
                            key={partner.id}
                            style={styles.item}
                            onClick={() => {
                                setSelectedPartnerId(partner.id);
                                setSelectedPartnerName(partner.name);
                            }}
                        >
                            <div style={styles.avatar}>
                                <User size={20} color="#FFF" />
                            </div>
                            <div style={styles.info}>
                                <div style={styles.nameRow}>
                                    <div style={styles.name}>{partner.name}</div>
                                    {partner.last_message_at && (
                                        <div style={styles.messageTime}>{formatMessageTime(partner.last_message_at)}</div>
                                    )}
                                </div>
                                <div style={styles.sub}>
                                    {getRoleLabel(partner.role)}
                                </div>
                                <div style={styles.previewRow}>
                                    <div style={styles.previewText}>
                                        {partner.last_message || '아직 메시지가 없습니다.'}
                                    </div>
                                    {partner.unread_count > 0 && (
                                        <div style={styles.unreadBadge}>
                                            {partner.unread_count > 99 ? '99+' : partner.unread_count}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <ChevronRight size={20} color="#9CA3AF" />
                        </button>
                    ))}
                </div>
            )}

            {/* 코치 선택 모달 */}
            {isModalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>문의할 코치 선택</h2>
                            <button onClick={() => setIsModalOpen(false)} style={styles.closeButton}>
                                <X size={24} color="#1F2937" />
                            </button>
                        </div>
                        <div style={styles.coachList}>
                            {coaches.length > 0 ? (
                                coaches.map((coach: any) => (
                                    <div key={coach.id} style={styles.coachItem} onClick={() => {
                                        setSelectedPartnerId(coach.id);
                                        setSelectedPartnerName(coach.name);
                                        setIsModalOpen(false);
                                    }}>
                                        <div style={styles.avatarSmall}>
                                            <User size={16} color="#FFF" />
                                        </div>
                                        <div>
                                            <div style={styles.coachName}>{coach.name}</div>
                                            <div style={styles.coachRole}>{coach.role === 'subcoach' ? '관리자' : '코치'}</div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p style={{ textAlign: 'center', color: '#6B7280', padding: '20px' }}>문의 가능한 코치님이 없습니다.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        padding: '20px',
        backgroundColor: '#F9FAFB',
        minHeight: '100vh',
    },
    header: {
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
    },
    title: {
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#111827',
        margin: 0,
    },
    subtitle: {
        fontSize: '13px',
        color: '#6B7280',
        margin: '4px 0 0 0',
    },
    newChatBtn: {
        padding: '8px 16px',
        backgroundColor: '#E5E7EB', // 연한 회색 버튼
        color: '#1F2937',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    emptyState: {
        textAlign: 'center',
        padding: '48px 24px',
        color: '#6B7280',
        backgroundColor: '#FFF',
        borderRadius: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    },
    emptyIcon: {
        width: '56px',
        height: '56px',
        borderRadius: '20px',
        backgroundColor: '#E8F3FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
    },
    emptyTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#111827',
        margin: 0,
    },
    emptyDescription: {
        margin: '8px 0 0 0',
        fontSize: '14px',
        color: '#6B7280',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: '#FFF',
        borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        width: '100%',
        border: 'none',
        textAlign: 'left',
    },
    avatar: {
        width: '48px',
        height: '48px',
        borderRadius: '20px',
        backgroundColor: '#3182F6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '16px',
    },
    info: {
        flex: 1,
    },
    nameRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '2px',
    },
    name: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1F2937',
    },
    sub: {
        fontSize: '13px',
        color: '#6B7280',
        marginBottom: '8px',
    },
    previewRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    previewText: {
        flex: 1,
        fontSize: '13px',
        color: '#4B5563',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    messageTime: {
        fontSize: '12px',
        color: '#9CA3AF',
        flexShrink: 0,
    },
    unreadBadge: {
        minWidth: '22px',
        height: '22px',
        borderRadius: '11px',
        backgroundColor: '#EF4444',
        color: '#FFF',
        fontSize: '11px',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 6px',
        flexShrink: 0,
    },
    startButton: {
        marginTop: '16px',
        padding: '12px 24px',
        backgroundColor: '#3182F6',
        color: '#FFF',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    // 모달 스타일
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '400px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    },
    modalHeader: {
        padding: '16px 20px',
        borderBottom: '1px solid #F3F4F6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#111827',
    },
    closeButton: {
        border: 'none',
        background: 'none',
        padding: '4px',
        cursor: 'pointer',
    },
    coachList: {
        padding: '10px',
        maxHeight: '300px',
        overflowY: 'auto',
    },
    coachItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #F3F4F6',
        cursor: 'pointer',
    },
    avatarSmall: {
        width: '36px',
        height: '36px',
        borderRadius: '14px',
        backgroundColor: '#10B981',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '12px',
    },
    coachName: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#1F2937',
    },
    coachRole: {
        fontSize: '12px',
        color: '#6B7280',
    }
};

export default CoachChatPage;
