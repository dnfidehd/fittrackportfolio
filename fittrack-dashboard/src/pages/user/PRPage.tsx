import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getMyPRs, createOrUpdatePR, deletePR, getWodHistoryByTitle } from '../../services/api';
import { PersonalRecord, WodRecord } from '../../types';
import { CROSSFIT_MOVEMENTS, BENCHMARK_WODS } from '../../constants/workouts';
import { Trophy, TrendingUp, Plus, X, Trash2, ChevronDown } from 'lucide-react';

// 토스 스타일 색상
const TOSS_BLUE = '#3182F6';

const PRPage: React.FC = () => {
    const [prs, setPrs] = useState<PersonalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRecordForm, setShowRecordForm] = useState(false);

    const getKoreanName = (fullName: string) => {
        const match = fullName.match(/\(([^)]+)\)/);
        return match ? match[1] : fullName;
    };

    const [selectedExercise, setSelectedExercise] = useState(getKoreanName(CROSSFIT_MOVEMENTS.weightlifting[0]));
    const [recordValue, setRecordValue] = useState('');
    const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
    const [isDirectInput, setIsDirectInput] = useState(false);
    const [customExercise, setCustomExercise] = useState('');

    const [chartExercise, setChartExercise] = useState<string>('');

    const [selectedBenchmark, setSelectedBenchmark] = useState<string>('Fran');
    const [benchmarkHistory, setBenchmarkHistory] = useState<WodRecord[]>([]);
    const [loadingBenchmark, setLoadingBenchmark] = useState(false);

    useEffect(() => { fetchPRs(); }, []);

    useEffect(() => {
        if (prs.length > 0 && !chartExercise) {
            setChartExercise(prs[0].exercise_name);
        }
    }, [prs, chartExercise]);

    const fetchPRs = async () => {
        try {
            const res = await getMyPRs();
            setPrs(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBenchmarkHistory = async (wodName: string) => {
        setLoadingBenchmark(true);
        try {
            const res = await getWodHistoryByTitle(wodName);
            setBenchmarkHistory(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingBenchmark(false);
        }
    };

    useEffect(() => { fetchBenchmarkHistory(selectedBenchmark); }, [selectedBenchmark]);

    const { chartData, uniqueExercises, currentMax, recentPRUpdates, prHighlights, benchmarkBest } = useMemo(() => {
        const unique = Array.from(new Set(prs.map(p => p.exercise_name)));
        const filtered = prs
            .filter(p => p.exercise_name === chartExercise)
            .sort((a, b) => new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime())
            .map(p => ({
                date: p.recorded_date.substring(5),
                fullDate: p.recorded_date,
                value: parseFloat(p.record_value.toString())
            }));
        const max = filtered.length > 0 ? Math.max(...filtered.map(d => d.value)) : 0;

        const recent = [...prs]
            .sort((a, b) => new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime())
            .slice(0, 5);

        const groupedByExercise = prs.reduce<Record<string, PersonalRecord[]>>((acc, pr) => {
            if (!acc[pr.exercise_name]) acc[pr.exercise_name] = [];
            acc[pr.exercise_name].push(pr);
            return acc;
        }, {});

        const highlights = Object.entries(groupedByExercise)
            .map(([exercise, records]) => {
                const sorted = [...records].sort((a, b) => new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime());
                const latest = sorted[0];
                const previous = sorted[1];
                const latestValue = Number(latest.record_value);
                const previousValue = previous ? Number(previous.record_value) : null;
                return {
                    exercise,
                    latestValue,
                    previousValue,
                    change: previousValue !== null ? latestValue - previousValue : null,
                    date: latest.recorded_date,
                };
            })
            .sort((a, b) => (b.change ?? b.latestValue) - (a.change ?? a.latestValue))
            .slice(0, 4);

        const bestBenchmark = benchmarkHistory.length > 0
            ? benchmarkHistory.reduce((best, current) => {
                if (!best) return current;
                return Number(current.record_value) > Number(best.record_value) ? current : best;
            }, benchmarkHistory[0] as WodRecord)
            : null;

        return {
            chartData: filtered,
            uniqueExercises: unique,
            currentMax: max,
            recentPRUpdates: recent,
            prHighlights: highlights,
            benchmarkBest: bestBenchmark,
        };
    }, [prs, chartExercise, benchmarkHistory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recordValue) { toast.error("기록을 입력해주세요."); return; }
        const exerciseName = isDirectInput ? customExercise : selectedExercise;
        if (!exerciseName) { toast.error("운동 종목을 입력해주세요."); return; }

        try {
            await createOrUpdatePR({ exercise_name: exerciseName, record_value: recordValue, recorded_date: recordDate });
            toast.success("🏆 기록 저장 완료!");
            setRecordValue("");
            setShowRecordForm(false);
            fetchPRs();
        } catch (error) {
            toast.error("저장 실패");
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("정말 삭제하시겠습니까?")) {
            try { await deletePR(id); fetchPRs(); }
            catch (error) { toast.error("삭제 실패"); }
        }
    };

    return (
        <div style={styles.container}>
            {/* 헤더 */}
            <header style={styles.header}>
                <h1 style={styles.title}>나의 최고 기록</h1>
                <button
                    onClick={() => setShowRecordForm(!showRecordForm)}
                    style={showRecordForm ? styles.closeButton : styles.addButton}
                >
                    {showRecordForm ? <X size={18} /> : <Plus size={18} />}
                </button>
            </header>

            {/* 성장 그래프 카드 */}
            {uniqueExercises.length > 0 && (
                <section style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <div>
                            <div style={styles.sectionTitleRow}>
                                <TrendingUp size={20} color={TOSS_BLUE} />
                                <h2 style={styles.sectionTitle}>성장 그래프</h2>
                            </div>
                            <p style={styles.maxRecord}>
                                최고 기록 <span style={styles.maxValue}>{currentMax} lb</span>
                            </p>
                        </div>
                        <div style={styles.headerActions}>
                            <div style={styles.selectWrapper}>
                                <select
                                    value={chartExercise}
                                    onChange={(e) => setChartExercise(e.target.value)}
                                    style={styles.select}
                                >
                                    {uniqueExercises.map(ex => (
                                        <option key={ex} value={ex}>{ex}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} color="#9CA3AF" style={styles.selectIcon} />
                            </div>
                        </div>
                    </div>

                    <div style={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                    labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                                    cursor={{ stroke: TOSS_BLUE, strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke={TOSS_BLUE}
                                    strokeWidth={3}
                                    dot={{ r: 5, fill: TOSS_BLUE, strokeWidth: 2, stroke: 'var(--bg-card)' }}
                                    activeDot={{ r: 7, fill: TOSS_BLUE, stroke: 'var(--bg-card)', strokeWidth: 3 }}
                                    animationDuration={1200}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {prHighlights.length > 0 && (
                        <div style={styles.highlightGrid}>
                            {prHighlights.map((item) => (
                                <div key={item.exercise} style={styles.highlightCard}>
                                    <div style={styles.highlightLabel}>{item.exercise}</div>
                                    <div style={styles.highlightValue}>{item.latestValue} lb</div>
                                    <div style={styles.highlightMeta}>
                                        {item.change !== null
                                            ? `${item.change > 0 ? '+' : ''}${item.change} lb · 직전 기록 대비`
                                            : '첫 기록'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* 기록 입력 폼 */}
            {showRecordForm && (
                <section style={styles.formSection}>
                    <h3 style={styles.formTitle}>신기록 달성! 🔥</h3>
                    <form onSubmit={handleSubmit}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>운동 종목</label>
                            <div style={styles.selectWrapper}>
                                <select
                                    value={isDirectInput ? "DIRECT" : selectedExercise}
                                    onChange={(e) => {
                                        if (e.target.value === "DIRECT") {
                                            setIsDirectInput(true); setSelectedExercise("");
                                        } else {
                                            setIsDirectInput(false); setSelectedExercise(e.target.value);
                                        }
                                    }}
                                    style={styles.formSelect}
                                >
                                    {CROSSFIT_MOVEMENTS.weightlifting.map(m => {
                                        const korName = getKoreanName(m);
                                        return <option key={korName} value={korName}>{m}</option>;
                                    })}
                                    <option value="DIRECT">✨ 직접 입력</option>
                                </select>
                                <ChevronDown size={16} color="#9CA3AF" style={styles.selectIcon} />
                            </div>
                            {isDirectInput && (
                                <input
                                    type="text"
                                    placeholder="운동명 입력"
                                    value={customExercise}
                                    onChange={(e) => setCustomExercise(e.target.value)}
                                    style={{ ...styles.input, marginTop: '8px' }}
                                />
                            )}
                        </div>

                        <div style={styles.formRow}>
                            <div style={{ flex: 1 }}>
                                <label style={styles.label}>기록 (lb)</label>
                                <input
                                    type="number"
                                    placeholder="100"
                                    value={recordValue}
                                    onChange={(e) => setRecordValue(e.target.value)}
                                    style={styles.input}
                                    step="0.5"
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={styles.label}>날짜</label>
                                <input
                                    type="date"
                                    value={recordDate}
                                    onChange={(e) => setRecordDate(e.target.value)}
                                    style={styles.input}
                                />
                            </div>
                        </div>

                        <button type="submit" style={styles.submitButton}>저장하기</button>
                    </form>
                </section>
            )}

            {/* 벤치마크 WOD */}
            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionTitleRow}>
                        <Trophy size={20} color="#10B981" />
                        <h2 style={styles.sectionTitle}>벤치마크 WOD</h2>
                    </div>
                    <div style={styles.selectWrapper}>
                        <select
                            value={selectedBenchmark}
                            onChange={(e) => setSelectedBenchmark(e.target.value)}
                            style={styles.select}
                        >
                            <optgroup label="👩 Girls">
                                {BENCHMARK_WODS.girls.map(w => (
                                    <option key={w.name} value={w.name}>{w.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="🦸 Heroes">
                                {BENCHMARK_WODS.heroes.map(w => (
                                    <option key={w.name} value={w.name}>{w.name}</option>
                                ))}
                            </optgroup>
                        </select>
                        <ChevronDown size={16} color="#9CA3AF" style={styles.selectIcon} />
                    </div>
                </div>

                {loadingBenchmark ? (
                    <div style={styles.loadingText}>로딩 중...</div>
                ) : benchmarkHistory.length > 0 ? (
                    <>
                        <div style={styles.benchmarkSummary}>
                            <div style={styles.benchmarkSummaryCard}>
                                <div style={styles.highlightLabel}>최고 기록</div>
                                <div style={styles.highlightValue}>{benchmarkBest?.record_value}</div>
                                <div style={styles.highlightMeta}>{benchmarkBest?.is_rx ? 'RX' : 'Scaled'} · {benchmarkBest?.wod_date?.toString().substring(0, 10)}</div>
                            </div>
                            <div style={styles.benchmarkSummaryCard}>
                                <div style={styles.highlightLabel}>최근 기록</div>
                                <div style={styles.highlightValue}>{benchmarkHistory[0]?.record_value}</div>
                                <div style={styles.highlightMeta}>{benchmarkHistory[0]?.is_rx ? 'RX' : 'Scaled'} · {benchmarkHistory[0]?.wod_date?.toString().substring(0, 10)}</div>
                            </div>
                        </div>
                        <div style={{ ...styles.chartContainer, height: '200px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={benchmarkHistory.slice().reverse().map(r => ({
                                    date: r.wod_date?.toString().substring(5) || '',
                                    value: r.record_value,
                                    isRx: r.is_rx
                                }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                    />
                                    <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} dot={{ r: 5, fill: '#10B981', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={styles.historyTags}>
                            {benchmarkHistory.slice(0, 5).map(r => (
                                <span key={r.id} style={r.is_rx ? styles.rxTag : styles.scaleTag}>
                                    {r.wod_date?.toString().substring(5)}: {r.record_value}
                                </span>
                            ))}
                        </div>
                    </>
                ) : (
                    <div style={styles.emptyState}>
                        <Trophy size={40} color="#E5E7EB" />
                        <p style={styles.emptyText}>"{selectedBenchmark}" 기록이 없어요</p>
                    </div>
                )}
            </section>

            {/* PR 목록 */}
            <section style={styles.section}>
                <div style={styles.sectionTitleRow}>
                    <Trophy size={20} color={TOSS_BLUE} />
                    <h2 style={styles.sectionTitle}>현재 보유 PR</h2>
                </div>

                {recentPRUpdates.length > 0 && (
                    <div style={styles.recentSection}>
                        <div style={styles.recentHeader}>최근 PR 갱신</div>
                        <div style={styles.recentList}>
                            {recentPRUpdates.map((pr) => {
                                const sameExerciseHistory = prs
                                    .filter((item) => item.exercise_name === pr.exercise_name)
                                    .sort((a, b) => new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime());
                                const currentIndex = sameExerciseHistory.findIndex((item) => item.id === pr.id);
                                const previous = currentIndex >= 0 ? sameExerciseHistory[currentIndex + 1] : undefined;
                                const delta = previous ? Number(pr.record_value) - Number(previous.record_value) : null;
                                return (
                                    <div key={pr.id} style={styles.recentItem}>
                                        <div>
                                            <div style={styles.recentExercise}>{pr.exercise_name}</div>
                                            <div style={styles.recentDate}>{pr.recorded_date}</div>
                                        </div>
                                        <div style={styles.recentRight}>
                                            <div style={styles.recentValue}>{pr.record_value} lb</div>
                                            <div style={styles.recentDelta}>
                                                {delta !== null ? `${delta > 0 ? '+' : ''}${delta} lb` : '첫 기록'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div style={styles.loadingText}>로딩 중...</div>
                ) : prs.length === 0 ? (
                    <div style={styles.emptyState}>
                        <Trophy size={40} color="#E5E7EB" />
                        <p style={styles.emptyText}>아직 등록된 기록이 없어요</p>
                    </div>
                ) : (
                    <div style={styles.prGrid}>
                        {prs.map(pr => (
                            <div key={pr.id} style={styles.prCard}>
                                <button onClick={() => handleDelete(pr.id)} style={styles.deleteButton}>
                                    <Trash2 size={14} />
                                </button>
                                <div style={styles.prExercise}>{pr.exercise_name}</div>
                                <div style={styles.prValue}>
                                    {pr.record_value}
                                    <span style={styles.prUnit}>lb</span>
                                </div>
                                <div style={styles.prDate}>{pr.recorded_date}</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        maxWidth: '560px',
        margin: '0 auto',
        padding: '0 20px 100px',
        backgroundColor: 'var(--bg-card)',
        minHeight: '100vh',
    },
    header: {
        paddingTop: '24px',
        paddingBottom: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: '24px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
    },
    section: {
        paddingTop: '24px',
        paddingBottom: '24px',
        borderBottom: '8px solid var(--bg-secondary)',
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px',
        flexWrap: 'wrap' as const,
        gap: '12px',
    },
    sectionTitleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    sectionTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
    },
    maxRecord: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        margin: '4px 0 0 28px',
    },
    maxValue: {
        color: TOSS_BLUE,
        fontWeight: '700',
    },
    headerActions: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
    },
    selectWrapper: {
        position: 'relative' as const,
    },
    select: {
        padding: '10px 32px 10px 12px',
        fontSize: '14px',
        fontWeight: '500',
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        appearance: 'none' as const,
        cursor: 'pointer',
    },
    selectIcon: {
        position: 'absolute' as const,
        right: '10px',
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none' as const,
    },
    addButton: {
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: TOSS_BLUE,
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
    },
    closeButton: {
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
    },
    chartContainer: {
        height: '260px',
        width: '100%',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '16px',
    },
    highlightGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginTop: '16px',
    },
    highlightCard: {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '14px',
        padding: '14px',
    },
    highlightLabel: {
        fontSize: '12px',
        color: 'var(--text-secondary)',
        marginBottom: '6px',
    },
    highlightValue: {
        fontSize: '22px',
        fontWeight: '700',
        color: TOSS_BLUE,
        marginBottom: '4px',
    },
    highlightMeta: {
        fontSize: '12px',
        color: 'var(--text-tertiary)',
    },

    // Form
    formSection: {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
    },
    formTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: '0 0 16px 0',
    },
    formGroup: {
        marginBottom: '16px',
    },
    label: {
        display: 'block',
        fontSize: '13px',
        fontWeight: '500',
        color: 'var(--text-secondary)',
        marginBottom: '8px',
    },
    formSelect: {
        width: '100%',
        padding: '14px 32px 14px 14px',
        fontSize: '15px',
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        appearance: 'none' as const,
    },
    input: {
        width: '100%',
        padding: '14px',
        fontSize: '15px',
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        boxSizing: 'border-box' as const,
    },
    formRow: {
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
    },
    submitButton: {
        width: '100%',
        padding: '16px',
        fontSize: '16px',
        fontWeight: '600',
        color: '#FFFFFF',
        backgroundColor: TOSS_BLUE,
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
    },

    // History tags
    historyTags: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap' as const,
        marginTop: '16px',
    },
    benchmarkSummary: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginBottom: '16px',
    },
    benchmarkSummaryCard: {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '14px',
        padding: '14px',
    },
    rxTag: {
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600',
        backgroundColor: 'var(--success-bg)',
        color: 'var(--success)',
    },
    scaleTag: {
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600',
        backgroundColor: 'var(--bg-hover)',
        color: 'var(--text-secondary)',
    },

    // PR Cards
    prGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        marginTop: '16px',
    },
    recentSection: {
        marginTop: '16px',
        marginBottom: '20px',
    },
    recentHeader: {
        fontSize: '14px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '10px',
    },
    recentList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    },
    recentItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '14px',
    },
    recentExercise: {
        fontSize: '14px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '4px',
    },
    recentDate: {
        fontSize: '12px',
        color: 'var(--text-tertiary)',
    },
    recentRight: {
        textAlign: 'right' as const,
    },
    recentValue: {
        fontSize: '15px',
        fontWeight: '700',
        color: TOSS_BLUE,
        marginBottom: '4px',
    },
    recentDelta: {
        fontSize: '12px',
        color: '#10B981',
        fontWeight: '600',
    },
    prCard: {
        position: 'relative' as const,
        padding: '16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
    },
    deleteButton: {
        position: 'absolute' as const,
        top: '12px',
        right: '12px',
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--danger-bg)',
        color: 'var(--danger)',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
    },
    prExercise: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        marginBottom: '4px',
    },
    prValue: {
        fontSize: '28px',
        fontWeight: '700',
        color: TOSS_BLUE,
    },
    prUnit: {
        fontSize: '14px',
        fontWeight: '400',
        color: 'var(--text-tertiary)',
        marginLeft: '4px',
    },
    prDate: {
        fontSize: '12px',
        color: 'var(--text-tertiary)',
        marginTop: '4px',
    },

    // Empty & Loading
    loadingText: {
        textAlign: 'center' as const,
        padding: '40px',
        color: '#9CA3AF',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '40px 20px',
    },
    emptyText: {
        fontSize: '14px',
        color: 'var(--text-tertiary)',
        marginTop: '12px',
    },
};

export default PRPage;
