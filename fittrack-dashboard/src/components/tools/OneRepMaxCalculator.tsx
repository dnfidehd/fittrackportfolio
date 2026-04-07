import React, { useState, useEffect } from 'react';

const OneRepMaxCalculator: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'1RM' | 'CONVERTER'>('1RM');

    // 1RM 관련 상태
    const [weight, setWeight] = useState<string>('');
    const [reps, setReps] = useState<string>('');
    const [oneRm, setOneRm] = useState<number | null>(null);

    // 단위 변환 관련 상태
    const [kg, setKg] = useState<string>('');
    const [lbs, setLbs] = useState<string>('');

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

    // 단위 변환 로직
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
        <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            marginTop: '32px',
            fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif',
            overflow: 'hidden'
        }}>
            {/* 탭 헤더 */}
            <div style={{ display: 'flex', borderBottom: '1px solid #F2F4F6', backgroundColor: '#F9FAFB' }}>
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
                    단위 변환기
                </button>
            </div>

            <div style={{ padding: '32px' }}>
                {activeTab === '1RM' ? (
                    <>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: '#191F28' }}>🧮 1RM 계산기</h3>
                        <p style={{ fontSize: '15px', color: '#8B95A1', marginBottom: '24px', lineHeight: '1.5' }}>
                            반복 가능한 무게(lb)와 횟수를 입력하면<br />1RM(1회 최대 중량)을 추정해드립니다.
                        </p>

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
                                <label style={labelStyle}>반복 횟수 (Reps)</label>
                                <input
                                    type="number"
                                    value={reps}
                                    onChange={(e) => setReps(e.target.value)}
                                    placeholder="5"
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {oneRm !== null && (
                            <div style={{ animation: 'fadeIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                                <div style={resultBoxStyle}>
                                    <span style={{ fontSize: '14px', color: '#6B7280', marginBottom: '6px', display: 'block' }}>Estimated 1RM</span>
                                    <div style={{ fontSize: '40px', fontWeight: '800', color: TOSS_GREEN, lineHeight: '1' }}>
                                        {oneRm} <span style={{ fontSize: '18px', color: '#6B7280', fontWeight: '600' }}>lb</span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {percentages.map(pct => (
                                        <div key={pct} style={pctBoxStyle}>
                                            <div style={{ fontSize: '12px', color: '#8B95A1', marginBottom: '4px' }}>{pct}%</div>
                                            <div style={{ fontWeight: '700', fontSize: '15px', color: '#333D4B' }}>
                                                {Math.round(oneRm * (pct / 100))} <span style={{ fontSize: '11px', fontWeight: '400', color: '#9CA3AF' }}>lb</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ animation: 'fadeIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: '#191F28' }}>⚖️ Kg ↔ Lbs 변환기</h3>
                        <p style={{ fontSize: '15px', color: '#8B95A1', marginBottom: '32px', lineHeight: '1.5' }}>
                            킬로그램(kg)과 파운드(lb)를 실시간으로 변환합니다.<br />원판 무게를 빠르게 계산해 보세요.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '320px', margin: '0 auto' }}>
                            <div style={{ position: 'relative' }}>
                                <label style={labelStyle}>킬로그램 (kg)</label>
                                <input
                                    type="number"
                                    value={kg}
                                    onChange={(e) => handleKgChange(e.target.value)}
                                    placeholder="0"
                                    style={{ ...inputStyle, textAlign: 'left', paddingLeft: '20px' }}
                                />
                                <span style={unitTagStyle}>kg</span>
                            </div>

                            <div style={{ textAlign: 'center', color: '#8B95A1', fontSize: '24px' }}>⇄</div>

                            <div style={{ position: 'relative' }}>
                                <label style={labelStyle}>파운드 (lb)</label>
                                <input
                                    type="number"
                                    value={lbs}
                                    onChange={(e) => handleLbsChange(e.target.value)}
                                    placeholder="0"
                                    style={{ ...inputStyle, border: `1px solid ${TOSS_BLUE}33`, textAlign: 'left', paddingLeft: '20px' }}
                                />
                                <span style={{ ...unitTagStyle, color: TOSS_BLUE }}>lb</span>
                            </div>
                        </div>

                        <div style={{
                            marginTop: '32px',
                            padding: '20px',
                            backgroundColor: '#F9FAFB',
                            borderRadius: '16px',
                            fontSize: '14px',
                            color: '#4E5968',
                            lineHeight: '1.6',
                            border: '1px solid #F2F4F6'
                        }}>
                            📌 <strong>1kg = 2.20462lbs</strong><br />
                            보통 크로스핏에서는 소수점 첫째 자리까지 반올림하여 계산합니다.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const tabStyle: React.CSSProperties = {
    flex: 1,
    padding: '16px 0',
    fontSize: '15px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
};

const unitTagStyle: React.CSSProperties = {
    position: 'absolute',
    right: '20px',
    top: '38px',
    fontSize: '16px',
    fontWeight: '700',
    color: '#8B95A1',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    fontSize: '13px',
    color: '#4E5968'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px',
    borderRadius: '14px',
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
    padding: '24px',
    backgroundColor: '#E8F3FF', // 옅은 파랑
    borderRadius: '20px',
    marginBottom: '20px',
    border: '1px solid #D6E4F5',
};

const pctBoxStyle: React.CSSProperties = {
    backgroundColor: '#F9FAFB',
    padding: '12px',
    borderRadius: '12px',
    textAlign: 'center',
    border: '1px solid #E5E8EB',
    transition: 'all 0.2s',
};

export default OneRepMaxCalculator;
