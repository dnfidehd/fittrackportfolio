import React, { useState, useEffect } from 'react';

const OneRepMaxFloatingButton: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'1RM' | 'CONVERTER'>('1RM');

    // 1RM 관련 상태
    const [weight, setWeight] = useState<string>('');
    const [reps, setReps] = useState<string>('');
    const [oneRm, setOneRm] = useState<number | null>(null);

    // 단위 변환 관련 상태
    const [kg, setKg] = useState<string>('');
    const [lbs, setLbs] = useState<string>('');

    // 화면 너비 감지
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 1RM 계산 로직
    useEffect(() => {
        const w = parseFloat(weight);
        const r = parseFloat(reps);

        if (w > 0 && r > 0) {
            let result = 0;
            if (r === 1) {
                result = w;
            } else {
                result = w * (1 + r / 30);
            }
            setOneRm(Math.round(result));
        } else {
            setOneRm(null);
        }
    }, [weight, reps]);

    // 단위 변환 로직 (양방향)
    const handleKgChange = (value: string) => {
        setKg(value);
        if (value && !isNaN(parseFloat(value))) {
            setLbs((parseFloat(value) * 2.20462).toFixed(1));
        } else {
            setLbs('');
        }
    };

    const handleLbsChange = (value: string) => {
        setLbs(value);
        if (value && !isNaN(parseFloat(value))) {
            setKg((parseFloat(value) / 2.20462).toFixed(1));
        } else {
            setKg('');
        }
    };

    const percentages = [95, 90, 85, 80, 75, 70, 65, 60, 50];

    const TOSS_BLUE = '#3182F6';
    const TOSS_GREEN = '#10B981';

    return (
        <>
            {/* 플로팅 버튼 */}
            <button
                className="floating-btn-1rm"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    bottom: isMobile ? '20px' : '80px',
                    right: isMobile ? '96px' : '100px',
                    width: isMobile ? '56px' : '64px',
                    height: isMobile ? '56px' : '64px',
                    borderRadius: '50%',
                    backgroundColor: isOpen ? '#EF4444' : TOSS_GREEN,
                    color: 'white',
                    fontSize: isMobile ? '20px' : '24px',
                    border: 'none',
                    boxShadow: `0 8px 24px ${isOpen ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                    cursor: 'pointer',
                    zIndex: 9997,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                title="운동 도구함"
            >
                {isOpen ? '✕' : '🧮'}
            </button>

            {/* 계산기 팝업 */}
            {isOpen && (
                <div style={{
                    ...popupStyle,
                    bottom: isMobile ? '86px' : '160px',
                    right: isMobile ? '16px' : '24px',
                    width: isMobile ? 'calc(100vw - 32px)' : '320px',
                    maxWidth: isMobile ? '380px' : '320px',
                }}>
                    <div style={headerStyle}>
                        <span style={{ fontWeight: '700', fontSize: '18px' }}>FitTools</span>
                        <button onClick={() => setIsOpen(false)} style={closeBtnStyle}>닫기</button>
                    </div>

                    {/* 탭 메뉴 */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #F2F4F6' }}>
                        <button
                            onClick={() => setActiveTab('1RM')}
                            style={{
                                ...tabStyle,
                                color: activeTab === '1RM' ? TOSS_GREEN : '#8B95A1',
                                borderBottom: activeTab === '1RM' ? `2px solid ${TOSS_GREEN}` : 'none',
                                fontWeight: activeTab === '1RM' ? '700' : '500',
                            }}
                        >
                            1RM 계산기
                        </button>
                        <button
                            onClick={() => setActiveTab('CONVERTER')}
                            style={{
                                ...tabStyle,
                                color: activeTab === 'CONVERTER' ? TOSS_BLUE : '#8B95A1',
                                borderBottom: activeTab === 'CONVERTER' ? `2px solid ${TOSS_BLUE}` : 'none',
                                fontWeight: activeTab === 'CONVERTER' ? '700' : '500',
                            }}
                        >
                            단위 변환
                        </button>
                    </div>

                    <div style={{ padding: '24px' }}>
                        {activeTab === '1RM' ? (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                    <div>
                                        <label style={labelStyle}>무게 (lb)</label>
                                        <input
                                            type="number"
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                            placeholder="135"
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>횟수 (Reps)</label>
                                        <input
                                            type="number"
                                            value={reps}
                                            onChange={(e) => setReps(e.target.value)}
                                            placeholder="5"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                {oneRm !== null ? (
                                    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                                        <div style={resultBoxStyle}>
                                            <span style={{ fontSize: '14px', color: '#6B7280', marginBottom: '4px', display: 'block' }}>Estimated 1RM</span>
                                            <div style={{ fontSize: '36px', fontWeight: '800', color: TOSS_GREEN, lineHeight: '1' }}>
                                                {oneRm} <span style={{ fontSize: '16px', color: '#6B7280', fontWeight: '500' }}>lb</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                            {percentages.map(pct => (
                                                <div key={pct} style={pctBoxStyle}>
                                                    <div style={{ fontSize: '12px', color: '#8B95A1', marginBottom: '2px' }}>{pct}%</div>
                                                    <div style={{ fontWeight: '700', fontSize: '16px', color: '#333D4B' }}>
                                                        {Math.round(oneRm * (pct / 100))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#8B95A1', padding: '20px 0', fontSize: '14px' }}>
                                        무게와 횟수를 입력하면<br />1RM을 계산해드립니다.
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div>
                                        <label style={labelStyle}>킬로그램 (kg)</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="number"
                                                value={kg}
                                                onChange={(e) => handleKgChange(e.target.value)}
                                                placeholder="0"
                                                style={{ ...inputStyle, textAlign: 'left', paddingLeft: '16px' }}
                                            />
                                            <span style={unitTagStyle}>kg</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'center', color: '#8B95A1' }}>
                                        <div style={{ fontSize: '20px' }}>⇄</div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>파운드 (lb)</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="number"
                                                value={lbs}
                                                onChange={(e) => handleLbsChange(e.target.value)}
                                                placeholder="0"
                                                style={{ ...inputStyle, border: `1px solid ${TOSS_BLUE}33`, textAlign: 'left', paddingLeft: '16px' }}
                                            />
                                            <span style={{ ...unitTagStyle, color: TOSS_BLUE }}>lb</span>
                                        </div>
                                    </div>

                                    <div style={{
                                        marginTop: '10px',
                                        padding: '16px',
                                        backgroundColor: '#F9FAFB',
                                        borderRadius: '14px',
                                        fontSize: '13px',
                                        color: '#6B7280',
                                        lineHeight: '1.6'
                                    }}>
                                        💡 <strong>1kg ≈ 2.20lb</strong> 기준으로 계산됩니다.<br />
                                        미국식 원판 무게와 한국식 원판 무게를<br />빠르게 확인해 보세요!
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

const tabStyle: React.CSSProperties = {
    flex: 1,
    padding: '14px 0',
    fontSize: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
};

const unitTagStyle: React.CSSProperties = {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '14px',
    fontWeight: '700',
    color: '#8B95A1',
};

// --- Toss Style Definition ---
const popupStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '160px',
    right: '24px',
    width: '320px',
    backgroundColor: '#FFFFFF',
    borderRadius: '24px',
    boxShadow: '0 20px 48px rgba(0, 0, 0, 0.12)',
    zIndex: 9996,
    overflow: 'hidden',
    border: '1px solid rgba(0,0,0,0.08)',
    fontFamily: '"Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #F2F4F6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#191F28',
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

const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: '8px',
    display: 'block',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #E5E8EB',
    fontSize: '16px',
    textAlign: 'center',
    backgroundColor: '#F9FAFB',
    color: '#191F28',
    outline: 'none',
    fontWeight: '600',
    transition: 'all 0.2s',
};

const resultBoxStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#ECFDF5', // 옅은 초록 배경
    borderRadius: '16px',
    marginBottom: '20px',
    border: '1px solid #D1FAE5',
};

const pctBoxStyle: React.CSSProperties = {
    backgroundColor: '#F9FAFB',
    padding: '10px',
    borderRadius: '12px',
    textAlign: 'center',
    border: '1px solid #F2F4F6',
    transition: 'all 0.2s',
};

export default OneRepMaxFloatingButton;
