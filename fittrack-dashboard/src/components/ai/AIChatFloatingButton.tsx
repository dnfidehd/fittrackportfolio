import React, { useState, useRef, useEffect } from 'react';
import { chatWithAI } from '../../services/api';

// 빠른 추천 버튼
const QUICK_PROMPTS = [
    { emoji: '🏋️', text: '오늘 WOD 조언해줘' },
    { emoji: '💪', text: '내 약점이 뭐야?' },
    { emoji: '🏆', text: 'PR 세울 방법 알려줘' },
    { emoji: '🎯', text: '목표 달성 팀 줘' },
];
const AIChatFloatingButton: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: string, content: string }[]>(() => {
        const saved = localStorage.getItem('ai_chat_history');
        return saved ? JSON.parse(saved) : [{ role: 'assistant', content: '안녕하세요! AI 코치입니다. 운동이나 식단에 대해 궁금한 점을 물어보세요! 🤖' }];
    });
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showQuickPrompts, setShowQuickPrompts] = useState(true);

    // 화면 너비 감지
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    // 대화 내용 저장
    useEffect(() => {
        localStorage.setItem('ai_chat_history', JSON.stringify(messages));
    }, [messages]);

    const handleClearChat = () => {
        if (window.confirm("대화 내용을 모두 지우시겠습니까?")) {
            setMessages([{ role: 'assistant', content: '안녕하세요! AI 코치입니다. 운동이나 식단에 대해 궁금한 점을 물어보세요! 🤖' }]);
            localStorage.removeItem('ai_chat_history');
        }
    };

    const handleSend = async (e: React.FormEvent, customMessage?: string) => {
        e?.preventDefault?.();
        const messageToSend = customMessage || input;
        if (!messageToSend.trim()) return;

        const userMessage = messageToSend;
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setLoading(true);

        try {
            const currentHistory = [...messages, { role: 'user', content: userMessage }];
            const response = await chatWithAI(userMessage, currentHistory);
            const botMessage = response.data.response || response.data.answer;

            setMessages(prev => [...prev, { role: 'assistant', content: botMessage }]);
        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: '죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 💦' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickPrompt = (promptText: string) => {
        handleSend(undefined as any, promptText);
    };

    return (
        <>
            {/* 1. 플로팅 버튼 */}
            <button
                className="floating-btn-ai"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    ...floatingButtonStyle,
                    backgroundColor: isOpen ? '#EF4444' : '#3182F6',
                    bottom: isMobile ? '20px' : '80px',
                    right: isMobile ? '24px' : '24px',
                    width: isMobile ? '56px' : '64px',
                    height: isMobile ? '56px' : '64px',
                }}
            >
                {isOpen ? '✕' : '🤖'}
            </button>

            {/* 2. 채팅창 모달 */}
            {isOpen && (
                <div style={{
                    ...chatWindowStyle,
                    bottom: isMobile ? '86px' : '160px',
                    right: isMobile ? '16px' : '24px',
                    width: isMobile ? 'calc(100vw - 32px)' : '380px',
                    maxWidth: isMobile ? '380px' : '380px',
                    height: isMobile ? 'calc(80vh - 100px)' : '600px', // 모바일에서 너무 높지 않게 조정
                }}>
                    {/* 헤더 */}
                    <div style={headerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px', fontWeight: '700', color: '#191F28' }}>AI Coach</span>
                            <span style={{ fontSize: '12px', color: '#3182F6', backgroundColor: '#E8F3FF', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>BETA</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={handleClearChat} style={clearBtnStyle}>지우기</button>
                            <button onClick={() => setIsOpen(false)} style={closeBtnStyle}>닫기</button>
                        </div>
                    </div>

                    {/* 채팅 내용 영역 */}
                    <div style={messagesContainerStyle}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                style={{
                                    ...messageBubbleStyle,
                                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    backgroundColor: msg.role === 'user' ? '#3182F6' : '#F2F4F6',
                                    color: msg.role === 'user' ? 'white' : '#333D4B',
                                    borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                                    borderBottomLeftRadius: msg.role === 'user' ? '16px' : '4px',
                                }}
                            >
                                {msg.content}
                            </div>
                        ))}
                        {loading && (
                            <div style={{ alignSelf: 'flex-start', backgroundColor: '#F2F4F6', borderRadius: '16px', padding: '12px', borderBottomLeftRadius: '4px' }}>
                                <span style={{ fontSize: '14px', color: '#8B95A1' }}>답변을 생각하고 있어요... 🤔</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 빠른 추천 버튼 */}
                    {showQuickPrompts && (
                        <div style={quickPromptContainerStyle}>
                            {QUICK_PROMPTS.map((prompt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleQuickPrompt(prompt.text)}
                                    disabled={loading}
                                    style={quickPromptBtnStyle}
                                >
                                    <span style={{ marginRight: '4px' }}>{prompt.emoji}</span>
                                    {prompt.text}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 입력 폼 */}
                    <form onSubmit={handleSend} style={inputFormStyle}>
                        <button
                            type="button"
                            onClick={() => setShowQuickPrompts(!showQuickPrompts)}
                            style={togglePromptBtnStyle}
                            title="추천 질문 보기"
                        >
                            💡
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="궁금한 점을 물어보세요"
                            style={inputStyle}
                            disabled={loading}
                        />
                        <button type="submit" disabled={loading} style={sendButtonStyle}>
                            전송
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};

// --- Toss Style Definition ---
const floatingButtonStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '80px',
    right: '24px',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#3182F6',
    color: 'white',
    fontSize: '28px',
    border: 'none',
    boxShadow: '0 8px 24px rgba(49, 130, 246, 0.4)',
    cursor: 'pointer',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

const chatWindowStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '160px',
    right: '24px',
    width: '380px',
    height: '600px',
    backgroundColor: '#FFFFFF',
    borderRadius: '24px',
    boxShadow: '0 20px 48px rgba(0, 0, 0, 0.12)',
    zIndex: 9998,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid rgba(0,0,0,0.08)',
    fontFamily: '"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
};

const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #F2F4F6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
};

const closeBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#8B95A1',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    padding: '4px 8px',
};

const clearBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#EF4444',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    padding: '4px 8px',
};

const messagesContainerStyle: React.CSSProperties = {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: '#FFFFFF',
};

const messageBubbleStyle: React.CSSProperties = {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '15px',
    lineHeight: '1.5',
    wordBreak: 'break-word',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
};

const quickPromptContainerStyle: React.CSSProperties = {
    padding: '12px 16px',
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    backgroundColor: '#F9FAFB',
    borderTop: '1px solid #F2F4F6',
    whiteSpace: 'nowrap',
    scrollbarWidth: 'none', // Firefox
    msOverflowStyle: 'none', // IE/Edge
};

const quickPromptBtnStyle: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: '18px',
    border: '1px solid #E5E8EB',
    backgroundColor: '#FFFFFF',
    color: '#4E5968',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
};

const inputFormStyle: React.CSSProperties = {
    padding: '16px',
    borderTop: '1px solid #F2F4F6',
    display: 'flex',
    gap: '10px',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
};

const togglePromptBtnStyle: React.CSSProperties = {
    padding: '10px',
    backgroundColor: '#F2F4F6',
    color: '#6B7280',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
};

const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '20px',
    border: '1px solid #E5E8EB',
    outline: 'none',
    backgroundColor: '#F9FAFB',
    color: '#191F28',
    fontSize: '15px',
    transition: 'background 0.2s',
};

const sendButtonStyle: React.CSSProperties = {
    backgroundColor: '#3182F6',
    color: 'white',
    border: 'none',
    padding: '12px 18px',
    borderRadius: '16px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'background 0.2s',
};

export default AIChatFloatingButton;