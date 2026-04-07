import React, { useState } from 'react';
import { getConversations } from '../../services/api';
import ChatRoom from '../../components/chat/ChatRoom';
import { User, ChevronRight } from 'lucide-react';
import { useVisiblePolling } from '../../hooks/useVisiblePolling';

const CoachInboxPage: React.FC = () => {
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
    const [selectedPartnerName, setSelectedPartnerName] = useState<string>('');
    const [selectedPartnerLabel, setSelectedPartnerLabel] = useState<string>(''); // 추가
    const [conversations, setConversations] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            const res = await getConversations();
            setConversations(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    useVisiblePolling(fetchData, 20000);

    if (selectedPartnerId) {
        return (
            <ChatRoom
                partnerId={selectedPartnerId}
                partnerName={selectedPartnerName}
                partnerLabel={selectedPartnerLabel} // 전달
                onBack={() => {
                    setSelectedPartnerId(null);
                    fetchData();
                }}
            />
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>회원 문의 함</h1>
            </div>

            {conversations.length === 0 ? (
                <div style={styles.emptyState}>
                    <p>아직 도착한 문의가 없습니다.</p>
                </div>
            ) : (
                <div style={styles.list}>
                    {conversations.map((partner: any) => (
                        <div key={partner.id} style={styles.item} onClick={() => {
                            setSelectedPartnerId(partner.id);
                            setSelectedPartnerName(partner.name);
                            setSelectedPartnerLabel(partner.phone || '회원'); // 전화번호 또는 '회원' 표시
                        }}>
                            <div style={styles.avatar}>
                                <User size={20} color="#FFF" />
                            </div>
                            <div style={styles.info}>
                                <div style={styles.name}>{partner.name}</div>
                                <div style={styles.sub}>
                                    {partner.phone}
                                </div>
                            </div>
                            <ChevronRight size={20} color="#9CA3AF" />
                        </div>
                    ))}
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
    },
    title: {
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#111827',
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px',
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
    },
    avatar: {
        width: '48px',
        height: '48px',
        borderRadius: '20px',
        backgroundColor: '#10B981', // 코치는 Green? or User Color
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '16px',
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: '2px',
    },
    sub: {
        fontSize: '13px',
        color: '#6B7280',
    },
};

export default CoachInboxPage;
