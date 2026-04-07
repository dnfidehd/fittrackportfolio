import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getMyStats, getMyGoals, createGoal, deleteGoal, cancelReservation, generateDailyReport, getAIAnalysis, generateAiWod } from '../../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Radar, RadarChart, PolarGrid, PolarAngleAxis as PolarAngleAxisSource, PolarRadiusAxis as PolarRadiusAxisSource
} from 'recharts';
import { DashboardSkeleton } from '../../components/common/SkeletonLoader';
import toast from 'react-hot-toast';
import { Goal } from '../../types';
import { ChevronRight, Plus, X, Target, Flame, Calendar, CreditCard, Dumbbell, TrendingUp, ChevronUp, ChevronDown, Brain, Sparkles, Send } from 'lucide-react';

// Recharts Type Error Fix
const PolarAngleAxis = PolarAngleAxisSource as any;
const PolarRadiusAxis = PolarRadiusAxisSource as any;

// 토스 스타일 색상
const TOSS_BLUE = '#3182F6';
const TOSS_BLUE_LIGHT = '#E8F3FF';

const UserDashboard: React.FC = () => {
    // JSON 형식인지 확인하는 함수
    const isJsonString = (str: string) => {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    };

    // WOD 내용 포맷팅 함수
    const formatWodContent = (content: string) => {
        if (!content) return null;
        if (isJsonString(content)) {
            try {
                const parsed = JSON.parse(content);

                // 최상단이 객체이면서 parts 배열을 포함하는 경우 (멀티 파트)
                if (parsed.parts && Array.isArray(parsed.parts)) {
                    // 유효한 파트만 필터링 (내용이 있고, 단순히 '-' 기호가 아닌 것)
                    const validParts = parsed.parts.filter((p: any) =>
                        p.lines && p.lines.length > 0 &&
                        p.lines.some((l: any) => l.movement && l.movement.trim() !== "" && l.movement.trim() !== "-")
                    );

                    if (validParts.length === 0) return null;

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {validParts.map((partData: any, idx: number) => (
                                <div key={idx}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary)' }}>{partData.label || `Part ${String.fromCharCode(65 + idx)}`}</div>
                                    {partData.lines?.map((line: any, lineIdx: number) => {
                                        if (!line.movement || line.movement.trim() === "" || line.movement.trim() === "-") return null;
                                        return (
                                            <div key={lineIdx} style={{ marginLeft: '8px' }}>
                                                - {line.reps} {line.movement} {line.weightRx ? `(${line.weightRx})` : ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    );
                }

                // 단일 파트
                if (parsed.type && parsed.lines) {
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {parsed.lines.map((line: any, idx: number) => {
                                if (!line.movement || line.movement.trim() === "" || line.movement.trim() === "-") return null;
                                return (
                                    <div key={idx}>- {line.reps} {line.movement} {line.weightRx ? `(${line.weightRx})` : ''}</div>
                                );
                            })}
                        </div>
                    );
                }

                // 이전 하위 호환을 위한 멀티 파트 (A, B, C...)
                if (typeof parsed === 'object') {
                    const entries = Object.entries(parsed).filter(([_, data]: [string, any]) =>
                        data.lines && data.lines.length > 0 &&
                        data.lines.some((l: any) => l.movement && l.movement.trim() !== "" && l.movement.trim() !== "-")
                    );

                    if (entries.length === 0) return null;

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {entries.map(([partName, partData]: [string, any]) => (
                                <div key={partName}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary)' }}>{partData.label || partName}</div>
                                    {partData.lines?.map((line: any, idx: number) => {
                                        if (!line.movement || line.movement.trim() === "" || line.movement.trim() === "-") return null;
                                        return (
                                            <div key={idx} style={{ marginLeft: '8px' }}>
                                                - {line.reps} {line.movement} {line.weightRx ? `(${line.weightRx})` : ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    );
                }
            } catch (e) {
                console.error("WOD 파싱 에러:", e);
                return content;
            }
        }
        return content;
    };

    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [newGoal, setNewGoal] = useState({ title: '', target_value: 0, unit: 'lb', category: 'pr' });

    const [error, setError] = useState<string | null>(null);

    // ✅ [신규] 데일리 리포트 상태
    const [dailyReport, setDailyReport] = useState<{ score: number, summary: string, advice: string } | null>(null);
    const [isReportLoading, setIsReportLoading] = useState(false);
    const [isReportCollapsed, setIsReportCollapsed] = useState(false);

    // ✅ [신규] AI 성과 분석 (레이더 차트) 상태
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

    // ✅ [신규] AI 개인 와드 생성 상태
    const [showAiWodModal, setShowAiWodModal] = useState(false);
    const [aiWodPrompt, setAiWodPrompt] = useState('');
    const [generatedAiWod, setGeneratedAiWod] = useState<any>(null);
    const [isAiWodLoading, setIsAiWodLoading] = useState(false);
    const [selectedEnv, setSelectedEnv] = useState<'box' | 'home'>('box');

    const handleGenerateReport = async () => {
        setIsReportLoading(true);
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const res = await generateDailyReport(todayStr);
            setDailyReport(res.data);
            toast.success("오늘의 리포트가 도착했습니다! 📩");
        } catch (error) {
            console.error(error);
            toast.error("리포트 생성에 실패했습니다.");
        } finally {
            setIsReportLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        fetchGoals();
        fetchAiAnalysis();
    }, []);

    const fetchAiAnalysis = async () => {
        setIsAnalysisLoading(true);
        try {
            const res = await getAIAnalysis();
            setAiAnalysis(res.data);
        } catch (err) {
            console.error("AI 분석 데이터 로드 실패:", err);
        } finally {
            setIsAnalysisLoading(false);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const res = await getMyStats();
            if (res.data) {
                setStats(res.data);
            } else {
                throw new Error("데이터 형식이 올바르지 않습니다.");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const fetchGoals = async () => {
        try {
            const res = await getMyGoals();
            setGoals(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateGoal = async () => {
        if (!newGoal.title || !newGoal.target_value) {
            toast.error('목표 제목과 목표 값을 입력해주세요.');
            return;
        }
        try {
            await createGoal(newGoal);
            toast.success('목표가 생성되었습니다! 🎯');
            setNewGoal({ title: '', target_value: 0, unit: 'lb', category: 'pr' });
            setShowGoalForm(false);
            fetchGoals();
        } catch (err) {
            toast.error('목표 생성 실패');
        }
    };

    const handleDeleteGoal = async (id: number) => {
        if (window.confirm('이 목표를 삭제하시겠습니까?')) {
            try {
                await deleteGoal(id);
                fetchGoals();
            } catch (err) {
                toast.error('삭제 실패');
            }
        }
    };

    const handleCancelReservation = async (scheduleId: number) => {
        if (!window.confirm('수업 예약을 취소하시겠습니까?')) return;
        try {
            await cancelReservation(scheduleId);
            toast.success('예약이 취소되었습니다.');
            fetchDashboardData();
        } catch (err) {
            toast.error('취소 실패');
        }
    };

    const handleGenerateAiWod = async () => {
        if (!aiWodPrompt.trim()) {
            toast.error("어떤 운동을 하고 싶은지 알려주세요!");
            return;
        }
        setIsAiWodLoading(true);
        try {
            const res = await generateAiWod(aiWodPrompt, selectedEnv);
            setGeneratedAiWod(res.data);
            toast.success("나만의 와드가 생성되었습니다! 💪");
        } catch (error) {
            console.error(error);
            toast.error("와드 생성에 실패했습니다.");
        } finally {
            setIsAiWodLoading(false);
        }
    };

    if (loading) return (
        <div style={styles.container}>
            <DashboardSkeleton />
        </div>
    );

    if (error) return (
        <div style={styles.container}>
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <h3 style={{ color: '#EF4444' }}>오류 발생</h3>
                <p style={{ color: '#6B7280', marginBottom: '20px' }}>{error}</p>
                <button onClick={() => window.location.reload()} style={styles.outlineButton}>다시 시도</button>
            </div>
        </div>
    );

    if (!stats) return null;

    const { membership_info, next_reservation, today_wod, attendance_count, user_name, attendance_history, workout_goal, current_streak } = stats;
    return (
        <div style={styles.container}>
            {/* 1. 인사 섹션 */}
            <section style={styles.greetingSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h1 style={styles.greeting}>
                        {user_name}님,<br />
                        <span style={styles.greetingHighlight}>오늘도 화이팅! 💪</span>
                    </h1>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <button
                            onClick={() => setShowAiWodModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: '#E8F3FF',
                                color: '#3182F6',
                                border: 'none',
                                padding: '10px 16px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                width: 'fit-content'
                            }}
                        >
                            <Sparkles size={16} />
                            AI 개인운동
                        </button>

                        {membership_info?.remaining_days > 0 && (
                            <div
                                onClick={() => navigate('/mypage')}
                                style={{
                                    fontSize: '13px',
                                    color: '#6B7684',
                                    backgroundColor: '#F9FAFB',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    border: '1px solid #F2F4F6',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <span style={{ fontWeight: '600', color: TOSS_BLUE }}>D-{membership_info.remaining_days}</span>
                                <span style={{ color: '#8B95A1' }}>|</span>
                                <span>{membership_info.end_date} 만료</span>
                                <ChevronRight size={12} />
                            </div>
                        )}
                    </div>
                </div>
                {current_streak > 0 && (
                    <div style={styles.streakBadge}>
                        <Flame size={16} color="#FF6B35" />
                        <span>{current_streak}일 연속 출석</span>
                    </div>
                )}
            </section>

            {/* ✅ [신규] AI 데일리 리포트 카드 (회원용 스타일) */}
            <section style={styles.section}>
                <div style={{
                    backgroundColor: '#fff',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    background: 'linear-gradient(135deg, #E8F3FF 0%, #FFFFFF 100%)',
                    border: '1px solid #DBE9FF'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#191F28', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                🤖 오늘의 AI 리포트
                                {dailyReport && <span style={{ fontSize: '12px', backgroundColor: '#3182F6', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>{dailyReport.score}점</span>}
                            </h2>
                            <p style={{ fontSize: '13px', color: '#6B7684', marginTop: '4px', marginBottom: 0 }}>
                                오늘 하루 운동과 식단을 분석해드려요!
                            </p>
                        </div>
                        {dailyReport && (
                            <button
                                onClick={() => setIsReportCollapsed(!isReportCollapsed)}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7684', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 'bold' }}
                            >
                                {isReportCollapsed ? <><ChevronDown size={20} /> 펼치기</> : <><ChevronUp size={20} /> 접기</>}
                            </button>
                        )}
                        {!dailyReport && (
                            <button
                                onClick={handleGenerateReport}
                                disabled={isReportLoading}
                                style={{
                                    marginLeft: 'auto',
                                    backgroundColor: '#3182F6', color: '#fff', border: 'none',
                                    padding: '8px 16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px',
                                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.3)',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                {isReportLoading ? '분석 중...' : '분석하기 ✨'}
                            </button>
                        )}
                    </div>

                    {dailyReport && !isReportCollapsed && (
                        <div style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
                            <div style={{
                                backgroundColor: 'rgba(255,255,255,0.7)',
                                borderRadius: '12px',
                                padding: '16px',
                                marginBottom: '12px',
                                border: '1px solid rgba(255,255,255,0.8)'
                            }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: '#333', margin: 0 }}>📢 요약</h3>
                                <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#4E5968', margin: 0 }}>
                                    {dailyReport.summary}
                                </p>
                            </div>

                            <div style={{
                                backgroundColor: '#FFF8F8',
                                borderRadius: '12px',
                                padding: '16px',
                                border: '1px solid #FFE4E4'
                            }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: '#E54B4B', margin: 0 }}>💡 코치 조언</h3>
                                <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#4E5968', margin: 0 }}>
                                    {dailyReport.advice}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ✅ [신규] AI 성과 분석 레이더 차트 (Dashboard 통합) */}
            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <h2 style={styles.sectionTitle}>나의 운동 능력치</h2>
                    <Link to="/ai-report" style={styles.seeAllLink}>
                        상세 분석 <ChevronRight size={16} />
                    </Link>
                </div>
                <div style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '20px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: 'center',
                    gap: '20px',
                    minHeight: '200px'
                }}>
                    {isAnalysisLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '180px' }}>
                            <p style={{ color: '#9CA3AF', fontSize: '14px' }}>AI가 분석 중입니다... 🤖</p>
                        </div>
                    ) : aiAnalysis?.can_analyze ? (
                        <>
                            <div style={{ width: isMobile ? '100%' : '50%', height: '220px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={
                                        Object.keys(aiAnalysis.radar_chart).map(key => ({
                                            subject: key,
                                            A: aiAnalysis.radar_chart[key],
                                            fullMark: 100
                                        }))
                                    }>
                                        <PolarGrid stroke="var(--border-color)" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
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
                            <div style={{ width: isMobile ? '100%' : '50%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <Brain size={18} color={TOSS_BLUE} />
                                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>핵심 요약</span>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                                    {aiAnalysis.summary}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '20px', textAlign: 'center' }}>
                            <p style={{ color: '#9CA3AF', fontSize: '14px', marginBottom: '12px' }}>
                                {aiAnalysis?.message || "더 많은 운동 기록이 쌓이면 분석이 시작됩니다!"}
                            </p>
                            <button onClick={() => navigate('/my-workouts')} style={{ ...styles.outlineButton, fontSize: '12px', padding: '6px 12px' }}>기록하러 가기</button>
                        </div>
                    )}
                </div>
            </section>

            {/* 2. 핵심 통계 카드 (가로 스크롤) */}
            <section style={styles.statsSection}>
                <div style={styles.statsGrid}>
                    {/* 이번 달 출석 */}
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>
                            <Flame size={20} color={TOSS_BLUE} />
                        </div>
                        <div style={styles.statLabel}>이번 달 출석</div>
                        <div style={styles.statValue}>{attendance_count}<span style={styles.statUnit}>회</span></div>
                    </div>

                    {/* 연속 출석 */}
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>
                            <TrendingUp size={20} color="#FF6B35" />
                        </div>
                        <div style={styles.statLabel}>연속 출석</div>
                        <div style={{ ...styles.statValue, color: '#FF6B35' }}>{current_streak || 0}<span style={styles.statUnit}>일</span></div>
                    </div>

                    {/* 총 운동 */}
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>
                            <Dumbbell size={20} color="#10B981" />
                        </div>
                        <div style={styles.statLabel}>총 운동</div>
                        <div style={{ ...styles.statValue, color: '#10B981' }}>{stats.total_workouts}<span style={styles.statUnit}>회</span></div>
                    </div>
                </div>
            </section>



            {/* 4. 오늘의 WOD */}
            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <h2 style={styles.sectionTitle}>오늘의 WOD</h2>
                    <Link to="/wod" style={styles.seeAllLink}>
                        전체보기 <ChevronRight size={16} />
                    </Link>
                </div>
                <div style={styles.wodCard}>
                    {today_wod ? (
                        <>
                            <div style={styles.wodTitle}>{today_wod.title}</div>
                            {today_wod.is_rest_day ? (
                                <div style={styles.restDay}>오늘은 휴식일입니다 😴</div>
                            ) : (
                                <div style={styles.wodContent}>{formatWodContent(today_wod.content)}</div>
                            )}
                            {!today_wod.is_rest_day && (
                                <div style={styles.wodActionRow}>
                                    <button style={styles.outlineButton} onClick={() => navigate('/my-workouts')}>
                                        기록하러 가기
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={styles.emptyState}>등록된 WOD가 없습니다.</div>
                    )}
                </div>
            </section>

            {/* 5. 다음 예약 수업 */}
            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <h2 style={styles.sectionTitle}>다음 수업</h2>
                    <Link to="/reservation" style={styles.seeAllLink}>
                        예약하기 <ChevronRight size={16} />
                    </Link>
                </div>
                <div style={styles.reservationCard}>
                    {next_reservation ? (
                        <div style={styles.reservationContent}>
                            <Calendar size={24} color={TOSS_BLUE} />
                            <div style={styles.reservationInfo}>
                                <div style={styles.reservationTitle}>{next_reservation.title}</div>
                                <div style={styles.reservationTime}>
                                    {new Date(next_reservation.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} {next_reservation.time}
                                </div>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCancelReservation(next_reservation.id);
                                }}
                                style={styles.resCancelBtn}
                                title="예약 취소"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div style={styles.emptyReservation}>
                            <div style={styles.emptyText}>예약된 수업이 없어요</div>
                            <button style={styles.outlineButton} onClick={() => navigate('/reservation')}>
                                수업 예약하기
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* 6. 월별 출석 차트 */}
            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <h2 style={styles.sectionTitle}>출석 추이</h2>
                </div>
                <div style={styles.chartCard}>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={attendance_history}>
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    borderRadius: '12px',
                                    border: 'none',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                }}
                                cursor={{ fill: '#F3F4F6' }}
                            />
                            <Bar
                                dataKey="attendance"
                                name="출석"
                                fill={TOSS_BLUE}
                                radius={[6, 6, 0, 0]}
                                barSize={28}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            {/* 7. 나의 목표 */}
            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <h2 style={styles.sectionTitle}>나의 목표</h2>
                    <button
                        style={styles.addButton}
                        onClick={() => setShowGoalForm(!showGoalForm)}
                    >
                        {showGoalForm ? <X size={20} /> : <Plus size={20} />}
                    </button>
                </div>

                {/* 목표 생성 폼 */}
                {showGoalForm && (
                    <div style={styles.goalForm}>
                        <input
                            type="text"
                            placeholder="목표 (예: 백스쿼트 225lb)"
                            value={newGoal.title}
                            onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                            style={styles.input}
                        />
                        <div style={styles.goalFormRow}>
                            <input
                                type="number"
                                inputMode="decimal"
                                placeholder="목표값"
                                value={newGoal.target_value || ''}
                                onChange={e => setNewGoal({ ...newGoal, target_value: parseFloat(e.target.value) || 0 })}
                                style={{ ...styles.input, flex: 1 }}
                            />
                            <select
                                value={newGoal.unit}
                                onChange={e => setNewGoal({ ...newGoal, unit: e.target.value })}
                                style={{ ...styles.input, width: '80px' }}
                            >
                                <option value="lb">lb</option>
                                <option value="kg">kg</option>
                                <option value="분">분</option>
                                <option value="회">회</option>
                                <option value="%">%</option>
                            </select>
                        </div>
                        <button onClick={handleCreateGoal} style={styles.primaryButton}>
                            목표 추가하기
                        </button>
                    </div>
                )}

                {/* 목표 리스트 */}
                <div style={styles.goalList}>
                    {goals.length === 0 ? (
                        <div style={styles.emptyGoal}>
                            <Target size={32} color="#D1D5DB" />
                            <div style={styles.emptyGoalText}>아직 설정된 목표가 없어요</div>
                            <div style={styles.emptyGoalSubtext}>+ 버튼을 눌러 목표를 추가해보세요</div>
                        </div>
                    ) : (
                        goals.map(goal => {
                            const progress = Math.min((goal.current_value / goal.target_value) * 100, 100);
                            const isCompleted = goal.status === '달성';
                            return (
                                <div key={goal.id} style={{
                                    ...styles.goalItem,
                                    backgroundColor: isCompleted ? 'var(--success-bg)' : 'var(--bg-secondary)',
                                    border: isCompleted ? '1px solid var(--success)' : '1px solid var(--border-color)'
                                }}>
                                    <div style={styles.goalHeader}>
                                        <div style={styles.goalTitle}>
                                            {isCompleted && <span style={{ marginRight: '4px' }}>✅</span>}
                                            {goal.title}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteGoal(goal.id)}
                                            style={styles.deleteButton}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div style={styles.goalProgress}>
                                        <div style={styles.progressBar}>
                                            <div style={{
                                                ...styles.progressFill,
                                                width: `${progress}%`,
                                                backgroundColor: isCompleted ? '#10B981' : TOSS_BLUE
                                            }} />
                                        </div>
                                        <span style={styles.goalValue}>
                                            {goal.current_value}/{goal.target_value}{goal.unit}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            {/* ✅ [신규] AI 개인 와드 생성 모달 */}
            {showAiWodModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>AI 개인 와드 생성</h2>
                            <button onClick={() => {
                                setShowAiWodModal(false);
                                setGeneratedAiWod(null);
                                setAiWodPrompt('');
                            }} style={styles.closeBtn}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ padding: '20px' }}>
                            {/* 장소 선택 탭 */}
                            <div style={{ display: 'flex', backgroundColor: '#F2F4F6', padding: '4px', borderRadius: '12px', marginBottom: '20px' }}>
                                <button
                                    onClick={() => setSelectedEnv('box')}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: selectedEnv === 'box' ? '#fff' : 'transparent',
                                        color: selectedEnv === 'box' ? '#191F28' : '#8B95A1',
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        boxShadow: selectedEnv === 'box' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    🏋️ 박스(Box)
                                </button>
                                <button
                                    onClick={() => setSelectedEnv('home')}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: selectedEnv === 'home' ? '#fff' : 'transparent',
                                        color: selectedEnv === 'home' ? '#191F28' : '#8B95A1',
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        boxShadow: selectedEnv === 'home' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    🏠 집(Home)
                                </button>
                            </div>

                            <p style={{ fontSize: '14px', color: '#6B7684', marginBottom: '16px' }}>
                                {selectedEnv === 'box' ? '박스에 있는 모든 장비를 활용할 수 있어요.' : '집에 있는 가벼운 도구 위주로 구성해드릴게요.'}<br />
                                <span style={{ fontSize: '12px', color: '#3182F6' }}>예: {selectedEnv === 'box' ? '"20분짜리 하체 위주 WOD 짜줘"' : '"집에서 덤벨로만 하는 20분 유산소 루틴 짜줘"'}</span>
                            </p>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                <input
                                    type="text"
                                    value={aiWodPrompt}
                                    onChange={(e) => setAiWodPrompt(e.target.value)}
                                    placeholder="운동 요청사항 입력..."
                                    style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleGenerateAiWod()}
                                />
                                <button
                                    onClick={handleGenerateAiWod}
                                    disabled={isAiWodLoading}
                                    style={{
                                        backgroundColor: '#3182F6',
                                        color: '#fff',
                                        border: 'none',
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {isAiWodLoading ? '...' : <Send size={20} />}
                                </button>
                            </div>

                            {isAiWodLoading && (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <Sparkles size={32} color="#3182F6" className="animate-spin" style={{ marginBottom: '12px' }} />
                                    <p style={{ fontSize: '15px', fontWeight: '600' }}>AI 코치가 운동을 구성하고 있어요...</p>
                                </div>
                            )}

                            {generatedAiWod && (
                                <div style={{
                                    backgroundColor: '#F9FAFB',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    border: '1px solid #E5E8EB',
                                    maxHeight: '400px',
                                    overflowY: 'auto'
                                }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#3182F6', marginBottom: '8px' }}>
                                        🔥 {generatedAiWod.title}
                                    </h3>
                                    <div style={{ fontSize: '13px', color: '#6B7684', marginBottom: '16px', display: 'flex', gap: '12px' }}>
                                        <span>타입: {generatedAiWod.score_type === 'time' ? 'For Time' : 'AMRAP'}</span>
                                        {generatedAiWod.time_cap && <span>Time Cap: {generatedAiWod.time_cap}분</span>}
                                    </div>

                                    <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #F0F0F0' }}>
                                        {Array.isArray(generatedAiWod.content) ? (
                                            generatedAiWod.content.map((item: any, idx: number) => (
                                                <div key={idx} style={{ fontSize: '15px', marginBottom: '8px', color: '#191F28' }}>
                                                    • {item.reps} {item.movement} {item.weight && `(${item.weight})`}
                                                </div>
                                            ))
                                        ) : (
                                            <p style={{ fontSize: '15px', color: '#191F28', whiteSpace: 'pre-wrap' }}>{generatedAiWod.content}</p>
                                        )}
                                    </div>

                                    <div style={{ fontSize: '14px', color: '#4E5968', fontStyle: 'italic' }}>
                                        💬 {generatedAiWod.comment}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 토스 스타일 CSS-in-JS
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        maxWidth: '560px',
        margin: '0 auto',
        padding: '0 20px 100px',
        backgroundColor: 'var(--bg-card)',
        minHeight: '100vh',
    },

    // 인사 섹션
    greetingSection: {
        paddingTop: '24px',
        paddingBottom: '20px',
    },
    greeting: {
        fontSize: '26px',
        fontWeight: '700',
        lineHeight: '1.4',
        color: 'var(--text-primary)',
        margin: 0,
    },
    greetingHighlight: {
        color: TOSS_BLUE,
    },
    streakBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '12px',
        padding: '6px 12px',
        backgroundColor: '#FFF7ED',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#FF6B35',
    },

    // 통계 섹션
    statsSection: {
        marginBottom: '24px',
    },
    statsGrid: {
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '4px',
    },
    statCard: {
        flex: '1',
        minWidth: '100px',
        padding: '16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        textAlign: 'center' as const,
    },
    statIcon: {
        marginBottom: '8px',
    },
    statLabel: {
        fontSize: '12px',
        color: 'var(--text-secondary)',
        marginBottom: '4px',
    },
    statValue: {
        fontSize: '24px',
        fontWeight: '700',
        color: TOSS_BLUE,
    },
    statUnit: {
        fontSize: '14px',
        fontWeight: '400',
        color: 'var(--text-tertiary)',
        marginLeft: '2px',
    },

    // 섹션 공통
    section: {
        marginBottom: '24px',
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
    },
    sectionTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
    },
    seeAllLink: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '14px',
        color: 'var(--text-secondary)',
        textDecoration: 'none',
    },

    // 멤버십 카드
    membershipCard: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
    },
    membershipLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    membershipInfo: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
    },
    membershipType: {
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--text-primary)',
    },
    membershipDate: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
    },
    membershipRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    dDay: {
        fontSize: '20px',
        fontWeight: '700',
        color: TOSS_BLUE,
    },

    // WOD 카드
    wodCard: {
        padding: '20px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
    },
    wodTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '12px',
    },
    wodContent: {
        fontSize: '14px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap' as const,
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        // maxHeight과 overflowY 제거하여 전체 노출
    },
    wodActionRow: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '8px',
    },
    restDay: {
        fontSize: '15px',
        color: 'var(--text-secondary)',
        padding: '20px 0',
        textAlign: 'center' as const,
    },

    // 예약 카드
    reservationCard: {
        padding: '20px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
    },
    reservationContent: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    reservationInfo: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
    },
    reservationTitle: {
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--text-primary)',
    },
    reservationTime: {
        fontSize: '14px',
        color: TOSS_BLUE,
        fontWeight: '500',
    },
    emptyReservation: {
        textAlign: 'center' as const,
        padding: '20px 0',
    },
    emptyText: {
        fontSize: '14px',
        color: 'var(--text-secondary)',
        marginBottom: '16px',
    },

    // 차트 카드
    chartCard: {
        padding: '20px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
    },

    // 목표 섹션
    addButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        backgroundColor: TOSS_BLUE_LIGHT,
        border: 'none',
        borderRadius: '50%',
        cursor: 'pointer',
        color: TOSS_BLUE,
    },
    goalForm: {
        padding: '16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    goalFormRow: {
        display: 'flex',
        gap: '8px',
    },
    input: {
        padding: '14px 16px',
        fontSize: '15px',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        backgroundColor: 'var(--bg-card)',
        outline: 'none',
        color: 'var(--text-primary)',
    },
    goalList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    goalItem: {
        padding: '16px',
        borderRadius: '16px',
    },
    goalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
    },
    goalTitle: {
        fontSize: '15px',
        fontWeight: '600',
        color: 'var(--text-primary)',
    },
    deleteButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#9CA3AF',
        padding: '4px',
    },
    goalProgress: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    progressBar: {
        flex: 1,
        height: '8px',
        backgroundColor: 'var(--bg-hover)',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: '4px',
        transition: 'width 0.3s ease',
    },
    goalValue: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        minWidth: '70px',
        textAlign: 'right' as const,
    },
    emptyGoal: {
        textAlign: 'center' as const,
        padding: '40px 20px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
    },
    emptyGoalText: {
        fontSize: '15px',
        color: 'var(--text-secondary)',
        marginTop: '16px',
    },
    emptyGoalSubtext: {
        fontSize: '13px',
        color: 'var(--text-tertiary)',
        marginTop: '4px',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '20px',
        color: 'var(--text-secondary)',
        fontSize: '14px',
    },

    // 버튼
    primaryButton: {
        width: '100%',
        padding: '14px',
        backgroundColor: TOSS_BLUE,
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '12px',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    outlineButton: {
        padding: '12px 24px',
        backgroundColor: '#FFFFFF',
        color: TOSS_BLUE,
        border: `1px solid ${TOSS_BLUE}`,
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    resCancelBtn: {
        marginLeft: 'auto',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-hover)',
        color: 'var(--text-secondary)',
        border: 'none',
        borderRadius: '50%',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    // 모달 스타일
    modalOverlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '440px',
        maxHeight: '90vh',
        overflowY: 'auto' as const,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        position: 'relative' as const,
    },
    modalHeader: {
        padding: '20px 24px',
        borderBottom: '1px solid #F2F4F6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky' as const,
        top: 0,
        backgroundColor: 'white',
        zIndex: 10,
    },
    modalTitle: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#191F28',
        margin: 0,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#8B95A1',
        padding: '4px',
    },
};

export default UserDashboard;
