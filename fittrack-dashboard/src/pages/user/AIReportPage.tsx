import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAIAnalysis } from '../../services/api'; // ✅ API 함수
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis as PolarAngleAxisSource, PolarRadiusAxis as PolarRadiusAxisSource, ResponsiveContainer
} from 'recharts';
import { ArrowLeft, Brain, TrendingUp, AlertCircle, ThumbsUp, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

// Recharts Type Error Fix (TS2786)
const PolarAngleAxis = PolarAngleAxisSource as any;
const PolarRadiusAxis = PolarRadiusAxisSource as any;

// 토스 스타일 색상
const TOSS_BLUE = '#3182F6';
const TOSS_GREY = '#F2F4F6';

const AIReportPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        fetchAnalysis();
    }, []);

    const fetchAnalysis = async () => {
        try {
            const res = await getAIAnalysis();
            setData(res.data);
        } catch (err: any) {
            console.error(err);
            toast.error("AI 분석을 불러오지 못했어요.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <header style={styles.header}>
                    <button onClick={() => navigate(-1)} style={styles.backButton}>
                        <ArrowLeft size={24} color="#191F28" />
                    </button>
                    <h1 style={styles.title}>AI 운동 분석</h1>
                </header>
                <div style={styles.loadingContainer}>
                    <div style={styles.loadingSpinner}></div>
                    <p style={styles.loadingText}>AI가 운동 기록을 분석하고 있어요... 🤖</p>
                    <p style={styles.subText}>약 5~10초 정도 소요될 수 있어요.</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    // 분석 데이터가 부족한 경우
    if (!data.can_analyze) {
        return (
            <div style={styles.container}>
                <header style={styles.header}>
                    <button onClick={() => navigate(-1)} style={styles.backButton}>
                        <ArrowLeft size={24} color="#191F28" />
                    </button>
                    <h1 style={styles.title}>AI 운동 분석</h1>
                </header>
                <div style={styles.emptyState}>
                    <AlertCircle size={48} color="#FF6B35" style={{ marginBottom: '16px' }} />
                    <h2 style={styles.emptyTitle}>데이터가 더 필요해요!</h2>
                    <p style={styles.emptyDesc}>
                        {data.message || "정확한 분석을 위해 5회 이상의 운동 기록이 필요합니다."}
                    </p>
                    <button onClick={() => navigate('/my-workouts')} style={styles.primaryButton}>
                        운동 기록하러 가기
                    </button>
                </div>
            </div>
        );
    }

    // 레이더 차트 데이터 변환
    const radarData = data.radar_chart ? Object.keys(data.radar_chart).map(key => ({
        subject: key,
        A: data.radar_chart[key],
        fullMark: 100
    })) : [];

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <button onClick={() => navigate(-1)} style={styles.backButton}>
                    <ArrowLeft size={24} color="#191F28" />
                </button>
                <h1 style={styles.title}>AI 코치 리포트</h1>
            </header>

            <div style={styles.content}>
                {/* 1. 요약 카드 */}
                <section style={styles.summaryCard}>
                    <div style={styles.cardHeader}>
                        <Brain size={20} color={TOSS_BLUE} />
                        <span style={styles.cardLabel}>AI 총평</span>
                    </div>
                    <p style={styles.summaryText}>{data.summary}</p>
                </section>

                {/* 2. 레이더 차트 */}
                <section style={styles.chartSection}>
                    <h3 style={styles.sectionTitle}>나의 운동 능력치</h3>
                    <div style={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height={250}>
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid stroke="var(--border-color)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar
                                    name="My Stats"
                                    dataKey="A"
                                    stroke={TOSS_BLUE}
                                    fill={TOSS_BLUE}
                                    fillOpacity={0.4}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* 3. 강점 & 약점 */}
                <div style={styles.gridRow}>
                    <section style={{ ...styles.card, flex: 1 }}>
                        <div style={styles.cardHeader}>
                            <ThumbsUp size={18} color="#10B981" />
                            <span style={styles.cardLabel}>강점</span>
                        </div>
                        <ul style={styles.list}>
                            {data.strengths.map((item: string, idx: number) => (
                                <li key={idx} style={styles.listItem}>{item}</li>
                            ))}
                        </ul>
                    </section>
                    <section style={{ ...styles.card, flex: 1 }}>
                        <div style={styles.cardHeader}>
                            <TrendingUp size={18} color="#EF4444" />
                            <span style={styles.cardLabel}>보완점</span>
                        </div>
                        <ul style={styles.list}>
                            {data.weaknesses.map((item: string, idx: number) => (
                                <li key={idx} style={styles.listItem}>{item}</li>
                            ))}
                        </ul>
                    </section>
                </div>

                {/* 4. 코치 조언 */}
                <section style={styles.adviceCard}>
                    <div style={styles.cardHeader}>
                        <Activity size={20} color="#8B5CF6" />
                        <span style={styles.cardLabel}>코치 조언</span>
                    </div>
                    <p style={styles.adviceText}>{data.advice}</p>
                </section>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        maxWidth: '560px',
        margin: '0 auto',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-card)',
        paddingBottom: '40px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--bg-card)',
        zIndex: 10,
    },
    backButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        marginRight: '12px',
    },
    title: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        flex: 1,
    },
    content: {
        padding: '20px',
    },
    summaryCard: {
        backgroundColor: 'var(--primary-bg)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
    },
    cardHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
    },
    cardLabel: {
        fontSize: '14px',
        fontWeight: '700',
        color: 'var(--text-secondary)',
    },
    summaryText: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        lineHeight: '1.5',
        margin: 0,
    },
    chartSection: {
        marginBottom: '24px',
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '16px',
    },
    chartContainer: {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '20px',
        padding: '10px 0',
    },
    gridRow: {
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
    },
    card: {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '16px',
    },
    list: {
        margin: 0,
        paddingLeft: '20px',
        color: 'var(--text-secondary)',
        fontSize: '14px',
    },
    listItem: {
        marginBottom: '4px',
    },
    adviceCard: {
        backgroundColor: 'var(--primary-bg)',
        opacity: 0.9,
        borderRadius: '16px',
        padding: '20px',
    },
    adviceText: {
        fontSize: '15px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
        margin: 0,
        whiteSpace: 'pre-line',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
    },
    loadingSpinner: {
        width: '40px',
        height: '40px',
        border: `3px solid var(--bg-hover)`,
        borderTop: `3px solid var(--primary)`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '20px',
    },
    loadingText: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '8px',
    },
    subText: {
        fontSize: '14px',
        color: 'var(--text-tertiary)',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        padding: '20px',
        textAlign: 'center',
    },
    emptyTitle: {
        fontSize: '20px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '12px',
    },
    emptyDesc: {
        fontSize: '15px',
        color: 'var(--text-secondary)',
        marginBottom: '32px',
        lineHeight: '1.5',
    },
    primaryButton: {
        backgroundColor: TOSS_BLUE,
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '12px',
        padding: '14px 24px',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
    }
};

// 스피너 애니메이션
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(styleSheet);

export default AIReportPage;
