import React, { useState, useRef, useEffect } from 'react';
import { chatWithAI } from '../../services/api';
import { X, Send, Bot } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

interface AICoachChatProps { onClose: () => void; memberName: string; }
interface Message { role: 'user' | 'assistant'; text: string; }

const AICoachChat: React.FC<AICoachChatProps> = ({ onClose, memberName }) => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', text: `안녕하세요 ${memberName}님! 💪\nFitTrack AI 코치입니다.\n오늘 운동이나 식단에 대해 궁금한 점이 있으신가요?` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput(''); setLoading(true);
        try {
            const res = await chatWithAI(userMsg);
            setMessages(prev => [...prev, { role: 'assistant', text: res.data.answer }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', text: "죄송해요, 연결이 원활하지 않습니다. 😭" }]);
        } finally { setLoading(false); }
    };

    return (
        <div style={{
            ...styles.container,
            ...(isMobile ? styles.mobileContainer : {})
        }}>
            <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={styles.avatar}><Bot size={24} /></div>
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '15px' }}>FitTrack AI 코치</div>
                        <div style={{ fontSize: '12px', opacity: 0.8 }}>실시간 상담 중</div>
                    </div>
                </div>
                <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
            </div>
            <div style={styles.messages}>
                {messages.map((msg, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
                        <div style={msg.role === 'user' ? styles.userBubble : styles.aiBubble}>
                            {msg.text.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
                        </div>
                    </div>
                ))}
                {loading && <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}><div style={{ ...styles.aiBubble, backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>답변 작성 중... ✍️</div></div>}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSend} style={styles.inputArea}>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="질문을 입력하세요..." style={styles.input} disabled={loading} />
                <button type="submit" disabled={loading} style={styles.sendBtn}><Send size={18} /></button>
            </form>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        position: 'fixed' as const,
        bottom: '100px',
        right: '20px',
        width: '380px',
        height: '600px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        zIndex: 10000
    },
    mobileContainer: {
        bottom: 0,
        right: 0,
        width: '100%',
        height: '85%',
        borderRadius: '24px 24px 0 0',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: 'none',
    },
    header: { padding: '16px 20px', backgroundColor: TOSS_BLUE, color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    avatar: { width: '40px', height: '40px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    closeBtn: { background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: '4px' },
    messages: { flex: 1, padding: '20px', overflowY: 'auto', backgroundColor: 'var(--bg-secondary)' },
    userBubble: { backgroundColor: TOSS_BLUE, color: '#FFF', padding: '12px 16px', borderRadius: '16px 16px 4px 16px', maxWidth: '80%', fontSize: '14px', lineHeight: '1.5' },
    aiBubble: { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', maxWidth: '85%', fontSize: '14px', lineHeight: '1.5', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' },
    inputArea: { padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', backgroundColor: 'var(--bg-card)' },
    input: { flex: 1, padding: '14px 18px', borderRadius: '24px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '14px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
    sendBtn: { width: '48px', height: '48px', backgroundColor: TOSS_BLUE, color: '#FFF', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default AICoachChat;