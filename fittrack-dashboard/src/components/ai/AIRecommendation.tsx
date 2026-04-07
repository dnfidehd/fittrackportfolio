import React, { useState, useRef, useEffect } from 'react';
import { chatWithAI } from '../../services/api';

const AIChatFloatingButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  // 초기 메시지 설정
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([
    { role: 'assistant', content: '안녕하세요! AI 코치입니다. 운동이나 식단에 대해 궁금한 점을 물어보세요! 🤖' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;

    // ✅ [핵심 변경점] 현재까지의 대화 기록을 복사합니다.
    // 이 리스트(currentHistory)를 API에 같이 보내야 AI가 앞 내용을 기억합니다.
    const currentHistory = [...messages];

    // 화면에는 내 메시지를 즉시 추가해서 보여줍니다.
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      // ✅ [핵심 변경점] 메시지 보낼 때 '대화 기록(history)'을 두 번째 인자로 같이 보냅니다.
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

  return (
    <>
      {/* 1. 플로팅 버튼 (위치: 바닥에서 100px 위로) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={floatingButtonStyle}
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* 2. 채팅창 모달 */}
      {isOpen && (
        <div style={chatWindowStyle}>
          <div style={headerStyle}>
            <span style={{ fontWeight: 'bold' }}>FitTrack AI Coach</span>
            <button onClick={() => setIsOpen(false)} style={closeBtnStyle}>닫기</button>
          </div>

          <div style={messagesContainerStyle}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  ...messageBubbleStyle,
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? '#3b82f6' : '#f3f4f6',
                  color: msg.role === 'user' ? 'white' : 'black',
                }}
              >
                {msg.content}
              </div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', color: '#9ca3af', fontSize: '0.9rem' }}>답변 생각 중... 🤔</div>}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} style={inputFormStyle}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="질문을 입력하세요..."
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

// --- 스타일 정의 ---

const floatingButtonStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '100px', // 버튼이 다른 요소와 겹치지 않게 위로 배치
  right: '30px',
  width: '60px',
  height: '60px',
  borderRadius: '50%',
  backgroundColor: '#3b82f6',
  color: 'white',
  fontSize: '2rem',
  border: 'none',
  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
  cursor: 'pointer',
  zIndex: 9999,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  transition: 'transform 0.2s',
};

const chatWindowStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '170px',
  right: '30px',
  width: '350px',
  height: '500px',
  backgroundColor: 'white',
  borderRadius: '16px',
  boxShadow: '0 5px 20px rgba(0,0,0,0.2)',
  zIndex: 9998,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  border: '1px solid #e5e7eb',
};

const headerStyle: React.CSSProperties = {
  padding: '1rem',
  backgroundColor: '#1f2937',
  color: 'white',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#9ca3af',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

const messagesContainerStyle: React.CSSProperties = {
  flex: 1,
  padding: '1rem',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
  backgroundColor: '#fff',
};

const messageBubbleStyle: React.CSSProperties = {
  maxWidth: '80%',
  padding: '0.8rem 1rem',
  borderRadius: '12px',
  fontSize: '0.95rem',
  lineHeight: '1.4',
  wordBreak: 'break-word',
};

const inputFormStyle: React.CSSProperties = {
  padding: '0.8rem',
  borderTop: '1px solid #e5e7eb',
  display: 'flex',
  gap: '0.5rem',
  backgroundColor: '#f9fafb',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.6rem',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  outline: 'none',
};

const sendButtonStyle: React.CSSProperties = {
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  padding: '0 1rem',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
};

export default AIChatFloatingButton;