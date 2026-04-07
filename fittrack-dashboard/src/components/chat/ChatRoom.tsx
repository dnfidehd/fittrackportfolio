import React, { useState, useEffect, useRef } from 'react';
import { getMessages, sendMessage } from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';
import { Send, User, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useVisiblePolling } from '../../hooks/useVisiblePolling';

interface Message {
    id: number;
    sender_id: number;
    sender_name: string;
    receiver_id: number;
    receiver_name: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

interface ChatRoomProps {
    partnerId: number;
    partnerName: string;
    partnerLabel?: string; // 상대방 역할/정보 텍스트
    onBack?: () => void; // 모바일/코치용 뒤로가기
}

const TOSS_BLUE = '#3182F6';
const MY_MESSAGE_BG = '#3182F6';
const OTHER_MESSAGE_BG = '#F3F4F6';

const ChatRoom: React.FC<ChatRoomProps> = ({ partnerId, partnerName, partnerLabel = '운영진/코치', onBack }) => {
    const { user } = useAppContext();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isSending, setIsSending] = useState(false);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    const fetchMessages = async () => {
        try {
            const res = await getMessages(partnerId);
            setMessages(res.data);
            if (loading) setLoading(false);
        } catch (error) {
            console.error("Failed to fetch messages", error);
        }
    };

    useVisiblePolling(fetchMessages, 5000, [partnerId]);

    useEffect(() => {
        // 메시지가 로드되면 자동으로 스크롤 내림 (처음 로딩시는 즉시, 이후는 스무스)
        if (loading) {
            scrollToBottom('auto');
        } else {
            scrollToBottom('smooth');
        }
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isSending) return;

        setIsSending(true);
        try {
            await sendMessage(partnerId, input);
            setInput('');
            await fetchMessages(); // 즉시 갱신
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 50); // 포커스 유지 (약간의 지연 추가)
        } catch (error) {
            toast.error("메시지 전송 실패");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* 헤더 (고정) */}
            <div style={styles.header}>
                {onBack && (
                    <button onClick={onBack} style={styles.backButton}>
                        <ArrowLeft size={24} color="#1F2937" />
                        <span style={styles.backText}>목록</span>
                    </button>
                )}
                <div style={styles.headerInfo}>
                    <div style={styles.avatar}>
                        <User size={20} color="#FFF" />
                    </div>
                    <div>
                        <div style={styles.partnerName}>{partnerName}</div>
                        <div style={styles.statusText}>{partnerLabel}</div>
                    </div>
                </div>
            </div>

            {/* 메시지 영역 (스크롤 가능, 하단부터 채워짐) */}
            <div style={styles.messageArea}>
                <div style={styles.messagesContainer}>
                    {messages.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0' }}>
                            <p>대화를 시작해보세요!</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => {
                            const isMe = msg.sender_id === user?.id;
                            const showTime = index === messages.length - 1 ||
                                messages[index + 1].sender_id !== msg.sender_id ||
                                new Date(msg.created_at).getMinutes() !== new Date(messages[index + 1].created_at).getMinutes();

                            return (
                                <div key={msg.id} style={{ ...styles.messageRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                    {!isMe && (
                                        <div style={styles.messageAvatar}>
                                            <User size={14} color="#FFF" />
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                                        <div style={{
                                            ...styles.bubble,
                                            backgroundColor: isMe ? MY_MESSAGE_BG : OTHER_MESSAGE_BG,
                                            color: isMe ? '#FFF' : '#1F2937',
                                            borderTopRightRadius: isMe ? '4px' : '18px',
                                            borderTopLeftRadius: !isMe ? '4px' : '18px',
                                        }}>
                                            {msg.message}
                                        </div>
                                        {showTime && (
                                            <span style={styles.timestamp}>
                                                {format(new Date(msg.created_at), 'a h:mm', { locale: ko })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* 입력 영역 (하단 고정) */}
            <div style={styles.inputWrapper}>
                <form onSubmit={handleSend} style={styles.inputArea}>
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        style={styles.input}
                        disabled={isSending}
                    />
                    <button type="submit" style={styles.sendButton} disabled={!input.trim() || isSending}>
                        <Send size={20} color={input.trim() ? TOSS_BLUE : '#9CA3AF'} />
                    </button>
                </form>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        position: 'fixed',
        top: '56px', // 헤더 높이만큼 아래로
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '560px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFF',
        overflow: 'hidden', // 전체 스크롤 방지
        zIndex: 90, // MemberLayout 헤더(100)보다 아래, 내용 위
    },
    header: {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid #F3F4F6',
        backgroundColor: '#FFF',
        gap: '12px',
        zIndex: 10,
    },
    backButton: {
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        display: 'flex', // flex 추가
        alignItems: 'center',
        gap: '4px',
    },
    backText: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1F2937',
    },
    headerInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    avatar: {
        width: '40px',
        height: '40px',
        borderRadius: '16px',
        backgroundColor: '#D1D5DB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    partnerName: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#1F2937',
    },
    statusText: {
        fontSize: '12px',
        color: '#6B7280',
    },
    // 메시지 영역 (스크롤 담당)
    messageArea: {
        flex: 1, // 남은 공간 모두 차지
        overflowY: 'auto', // 내부 스크롤 허용
        backgroundColor: '#F9FAFB',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: '20px', // 여유 공간
    },
    // 실제 메시지들이 담기는 컨테이너 (flex-grow로 하단부터 채워지게)
    messagesContainer: {
        flexGrow: 1,
        justifyContent: 'flex-end', // 내용이 적을 때도 하단 정렬 원하면 사용
        padding: '20px',
        paddingBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    messageRow: {
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
    },
    messageAvatar: {
        width: '28px',
        height: '28px',
        borderRadius: '10px',
        backgroundColor: '#D1D5DB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
    },
    bubble: {
        padding: '10px 14px',
        borderRadius: '18px',
        fontSize: '15px',
        lineHeight: '1.4',
        wordBreak: 'break-word',
        maxWidth: '100%',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    },
    timestamp: {
        fontSize: '11px',
        color: '#9CA3AF',
        marginTop: '4px',
        marginRight: '4px',
        marginLeft: '4px',
        alignSelf: 'flex-end',
    },
    // 입력창 래퍼 (하단 고정 역할)
    inputWrapper: {
        flexShrink: 0,
        backgroundColor: '#FFF',
        borderTop: '1px solid #F3F4F6',
        zIndex: 10,
        paddingBottom: 'safe-area-inset-bottom', // 아이폰 하단 바 대응
    },
    inputArea: {
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    input: {
        flex: 1,
        padding: '12px 16px',
        borderRadius: '24px',
        border: '1px solid #E5E7EB',
        fontSize: '15px',
        outline: 'none',
        backgroundColor: '#F9FAFB',
    },
    sendButton: {
        border: 'none',
        background: 'none',
        padding: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
};

export default ChatRoom;
