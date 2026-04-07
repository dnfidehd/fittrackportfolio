import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { ChevronLeft, Trophy, User, Search, Users, Filter } from 'lucide-react';

const GuestScorePage: React.FC = () => {
    const navigate = useNavigate();
    const [compData, setCompData] = useState<any>(null);
    const [name, setName] = useState('');
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [scoreValue, setScoreValue] = useState('');
    const [isRx, setIsRx] = useState(true);
    const [loading, setLoading] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL');
    const [gymFilter, setGymFilter] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState<string>('');

    // ✅ 순위 재계산 로직
    const reRankEventLeaderboard = (items: any[]) => {
        const result: any[] = [];
        items.forEach((item, idx) => {
            if (idx === 0) { result.push({ ...item, rank: 1 }); return; }
            const prev = items[idx - 1];
            const prevRanked = result[idx - 1];
            const isTie =
                item.score_value === prev.score_value &&
                (item.tie_break || '') === (prev.tie_break || '');
            result.push({ ...item, rank: isTie ? prevRanked.rank : idx + 1 });
        });
        return result;
    };

    useEffect(() => {
        const session = localStorage.getItem('guest_session');
        if (!session) {
            navigate('/guest/entry');
            return;
        }
        const parsed = JSON.parse(session);
        setCompData(parsed);
        if (parsed.events.length > 0) {
            setSelectedEventId(parsed.events[0].id);
        }
    }, [navigate]);

    useEffect(() => {
        if (selectedEventId) {
            fetchLeaderboard(selectedEventId);
        }
    }, [selectedEventId]);

    const fetchLeaderboard = async (eventId: number) => {
        try {
            const res = await api.get(`/api/competitions/events/${eventId}/leaderboard`);
            setLeaderboard(res.data);
        } catch (error) {
            console.error('리더보드 로드 실패', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('이름을 입력해주세요.');
        if (!selectedEventId) return toast.error('이벤트를 선택해주세요.');
        if (!scoreValue.trim()) return toast.error('기록을 입력해주세요.');

        const selectedEvent = compData.events.find((ev: any) => ev.id === selectedEventId);
        if (selectedEvent) {
            if (selectedEvent.score_type === 'time' && selectedEvent.time_cap) {
                const upScore = scoreValue.toUpperCase();
                if (!upScore.includes('CAP') && !upScore.includes('REPS')) {
                    const timeStr = scoreValue.replace(/[^0-9]/g, '');
                    const min = parseInt(timeStr.slice(0, 2)) || 0;
                    const sec = parseInt(timeStr.slice(2, 4)) || 0;
                    const recordSeconds = min * 60 + sec;
                    if (recordSeconds > selectedEvent.time_cap) {
                        toast.error(`타임캡(${Math.floor(selectedEvent.time_cap / 60)}분 ${selectedEvent.time_cap % 60}초) 초과. 미완주 시 'CAP + 렙수'로 입력하세요.`);
                        return;
                    }
                }
            } else if (selectedEvent.score_type === 'reps' && selectedEvent.max_reps) {
                const recordReps = parseInt(scoreValue.replace(/[^0-9]/g, '')) || 0;
                if (recordReps > selectedEvent.max_reps) {
                    toast.error(`최대 제한 렙수(${selectedEvent.max_reps}회)를 초과하여 입력할 수 없습니다.`);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            await api.post(`/api/competitions/guest/scores?event_id=${selectedEventId}`, {
                member_name: name,
                score_value: scoreValue,
                is_rx: isRx,
                scale_rank: isRx ? null : 'A'
            });
            toast.success('기록이 성공적으로 등록되었습니다!');
            setScoreValue('');
            fetchLeaderboard(selectedEventId);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || '등록 실패');
        } finally {
            setLoading(false);
        }
    };

    if (!compData) return null;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <button onClick={() => navigate('/guest/entry')} style={styles.backButton}>
                    <ChevronLeft size={24} />
                </button>
                <h2 style={styles.headerTitle}>{compData.competition.title}</h2>
            </div>

            {/* 1. 종목 선택 섹션 (최상단) */}
            <div style={{ width: '95%', maxWidth: '600px', margin: '20px auto 10px auto' }}>
                <label style={{ ...styles.label, marginBottom: '12px' }}><Trophy size={16} /> WOD 선택</label>
                <div style={styles.eventList}>
                    {compData.events.map((e: any, index: number) => (
                        <div
                            key={e.id}
                            onClick={() => setSelectedEventId(e.id)}
                            style={selectedEventId === e.id ? styles.eventCardActive : styles.eventCard}
                        >
                            <span style={styles.eventNum}>Event {index + 1}</span>
                            <span style={styles.eventName}>{e.title}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. 필터 바 (종목 선택 바로 아래, 기록 입력 카드 위) */}
            <div style={{ width: '95%', maxWidth: '600px', margin: '10px auto 10px auto' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', padding: '2px', backgroundColor: '#F2F4F6', borderRadius: '10px', width: 'fit-content' }}>
                        {['ALL', 'M', 'F'].map((g) => (
                            <button
                                key={g}
                                type="button"
                                onClick={() => setGenderFilter(g as any)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    backgroundColor: genderFilter === g ? '#FFFFFF' : 'transparent',
                                    color: genderFilter === g ? '#191F28' : '#8B95A1',
                                    boxShadow: genderFilter === g ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {g === 'ALL' ? '전체' : g === 'M' ? '남자' : '여자'}
                            </button>
                        ))}
                    </div>

                    {(() => {
                        const uniqueGyms = Array.from(new Set([
                            ...(compData?.competition?.participating_gyms?.filter((pg: any) => pg.status === 'accepted').map((pg: any) => pg.gym_name) || []),
                            ...leaderboard.map(item => item.gym_name)
                        ].filter(Boolean))).sort() as string[];

                        if (uniqueGyms.length > 0) {
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F2F4F6', borderRadius: '10px', padding: '2px 8px', height: 'fit-content' }}>
                                    <select
                                        value={gymFilter}
                                        onChange={(e) => setGymFilter(e.target.value)}
                                        style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: '600', color: '#333D4B', outline: 'none', padding: '4px', cursor: 'pointer' }}
                                    >
                                        <option value="ALL">전체 체육관</option>
                                        {uniqueGyms.map(gym => (
                                            <option key={gym} value={gym}>{gym}</option>
                                        ))}
                                    </select>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F2F4F6', borderRadius: '10px', padding: '2px 10px', height: 'fit-content', flex: 1, minWidth: '130px' }}>
                        <Search size={14} color="#8B95A1" style={{ marginRight: '6px' }} />
                        <input
                            placeholder="이름 검색"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ border: 'none', background: 'transparent', fontSize: '12px', color: '#191F28', outline: 'none', width: '100%', padding: '6px 0' }}
                        />
                    </div>
                </div>
            </div>

            {/* 3. 기록 입력 카드 */}
            <div style={styles.card}>
                <div style={styles.badge}>기록 입력</div>
                <h3 style={styles.sectionTitle}>오픈 대회 기록 입력</h3>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}><User size={16} /> 본인 성함</label>
                        <input
                            type="text"
                            placeholder="성함을 정확히 입력하십시오"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>수행 등급</label>
                        <div style={styles.toggleGroup}>
                            <button
                                type="button"
                                onClick={() => setIsRx(true)}
                                style={{ ...styles.toggleButton, backgroundColor: isRx ? '#3182F6' : '#F2F4F6', color: isRx ? 'white' : '#4E5968' }}
                            > Rx'd </button>
                            <button
                                type="button"
                                onClick={() => setIsRx(false)}
                                style={{ ...styles.toggleButton, backgroundColor: !isRx ? '#3182F6' : '#F2F4F6', color: !isRx ? 'white' : '#4E5968' }}
                            > Scaled </button>
                        </div>
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>나의 기록</label>
                        <input
                            type="text"
                            placeholder="예: 12:34"
                            value={scoreValue}
                            onChange={(e) => setScoreValue(e.target.value)}
                            style={{ ...styles.input, fontSize: '20px', fontWeight: 'bold', color: '#3182F6' }}
                        />
                    </div>

                    <button type="submit" disabled={loading} style={styles.button}>
                        {loading ? '제출 중...' : '기록 제출하기'}
                    </button>
                </form>
                <p style={styles.footerNote}>* 이름이 같을 경우 기존 기록이 업데이트됩니다.</p>
            </div>

            {/* 4. 리더보드 섹션 */}
            <div style={{ ...styles.card, marginTop: '20px' }}>
                <h3 style={{ ...styles.sectionTitle, fontSize: '18px', marginBottom: '16px' }}>📊 현재 리더보드 (실시간)</h3>

                <div style={styles.leaderboard}>
                    {(() => {
                        const filtered = leaderboard.filter(item =>
                            (genderFilter === 'ALL' || item.gender === genderFilter) &&
                            (gymFilter === 'ALL' || item.gym_name === gymFilter) &&
                            (searchTerm === '' || item.member_name.toLowerCase().includes(searchTerm.toLowerCase()))
                        );
                        const ranked = (genderFilter === 'ALL' && gymFilter === 'ALL' && searchTerm === '') ? filtered : reRankEventLeaderboard([...filtered]);
                        if (ranked.length === 0) return <p style={{ textAlign: 'center', color: '#8B95A1', fontSize: '14px' }}>조건에 맞는 기록이 없습니다.</p>;
                        return ranked.map((item, idx) => (
                            <div key={idx} style={styles.leaderboardItem}>
                                <div style={styles.rank}>{item.rank}</div>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingRight: '12px' }}>
                                    <div style={styles.name}>{item.member_name}</div>
                                    {item.gym_name && <div style={{ fontSize: '11px', color: '#8B95A1', wordBreak: 'keep-all', lineHeight: '1.4' }}>{item.gym_name}</div>}
                                </div>
                                <div style={styles.score}>
                                    {item.score_value}
                                    <span style={styles.rxBadge}>{item.is_rx ? "Rx'd" : "Scaled"}</span>
                                </div>
                            </div>
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { minHeight: '100vh', backgroundColor: '#F9FAFB', paddingBottom: '40px', width: '100%', overflowX: 'hidden', boxSizing: 'border-box' },
    header: {
        height: '60px', backgroundColor: 'white', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: '10px',
        position: 'sticky', top: 0, zIndex: 10, width: '100%', boxSizing: 'border-box'
    },
    backButton: { background: 'none', border: 'none', cursor: 'pointer', padding: '5px', flexShrink: 0 },
    headerTitle: { fontSize: '18px', fontWeight: '700', color: '#191F28', margin: 0, wordBreak: 'keep-all', flex: 1, lineHeight: '1.3' },
    card: {
        width: '100%', maxWidth: '600px', margin: '16px auto', padding: '24px 16px',
        backgroundColor: '#FFFFFF', borderRadius: '24px',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', boxSizing: 'border-box'
    },
    badge: {
        display: 'inline-block', padding: '4px 10px', backgroundColor: '#E8F3FF',
        color: '#3182F6', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
        marginBottom: '12px'
    },
    sectionTitle: { fontSize: '22px', fontWeight: '800', color: '#191F28', marginBottom: '24px', margin: 0 },
    form: { display: 'flex', flexDirection: 'column', gap: '24px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { fontSize: '14px', fontWeight: '600', color: '#4E5968', display: 'flex', alignItems: 'center', gap: '5px' },
    input: { padding: '14px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '16px', outline: 'none', backgroundColor: '#F9FAFB', width: '100%', boxSizing: 'border-box' },
    toggleGroup: { display: 'flex', backgroundColor: '#F2F4F6', borderRadius: '12px', padding: '4px' },
    toggleButton: { flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    button: { padding: '18px', borderRadius: '16px', border: 'none', backgroundColor: '#3182F6', color: 'white', fontWeight: 'bold', fontSize: '17px', cursor: 'pointer', marginTop: '10px' },
    footerNote: { fontSize: '12px', color: '#8B95A1', textAlign: 'center', marginTop: '16px' },
    leaderboard: { display: 'flex', flexDirection: 'column', gap: '8px' },
    leaderboardItem: { display: 'flex', alignItems: 'flex-start', padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '12px', gap: '12px', width: '100%', boxSizing: 'border-box' },
    rank: { width: '28px', height: '28px', backgroundColor: '#E8F3FF', color: '#3182F6', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '14px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' },
    name: { fontSize: '15px', fontWeight: '600', color: '#191F28', wordBreak: 'keep-all', lineHeight: '1.4' },
    score: { textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#3182F6', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginTop: '4px' },
    rxBadge: { fontSize: '11px', padding: '2px 6px', backgroundColor: '#F2F4F6', color: '#8B95A1', borderRadius: '4px' },
    eventList: { display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' },
    eventCard: { backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', cursor: 'pointer', border: '1px solid #E5E7EB', transition: 'all 0.2s', minWidth: '120px', boxSizing: 'border-box' },
    eventCardActive: { backgroundColor: '#E8F3FF', padding: '16px 20px', borderRadius: '16px', cursor: 'pointer', border: '1.5px solid #3182F6', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.1)', minWidth: '120px', boxSizing: 'border-box' },
    eventNum: { fontSize: '11px', fontWeight: '800', color: '#3182F6', display: 'block', marginBottom: '2px' },
    eventName: { fontSize: '14px', fontWeight: '700', color: '#191F28', display: 'block', wordBreak: 'keep-all', lineHeight: '1.3' },
};

export default GuestScorePage;
