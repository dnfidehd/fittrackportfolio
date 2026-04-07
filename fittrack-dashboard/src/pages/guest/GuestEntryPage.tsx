import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { ChevronRight, Calendar, ArrowLeft } from 'lucide-react';

interface AvailableComp {
    id: number;
    title: string;
    start_date: string;
    end_date: string;
    gym_id: number;
}

const GuestEntryPage: React.FC = () => {
    const navigate = useNavigate();
    const [competitions, setCompetitions] = useState<AvailableComp[]>([]);
    const [selectedComp, setSelectedComp] = useState<AvailableComp | null>(null);
    const [passcode, setPasscode] = useState('');
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    useEffect(() => {
        loadAvailableCompetitions();
    }, []);

    const loadAvailableCompetitions = async () => {
        try {
            const res = await api.get('/api/competitions/guest/available');

            // ✅ [수정] 1. 숨김 처리된 대회(is_hidden === true) 제외
            const visibleComps = res.data.filter((comp: any) => !comp.is_hidden);

            // ✅ [수정] 2. 정렬 로직: sort_order 최우선 (오름차순), 없거나 같으면 시작일 내림차순
            const sortedComps = visibleComps.sort((a: any, b: any) => {
                // 총관리자 지정 순서가 둘 다 있는 경우
                if (a.sort_order !== undefined && b.sort_order !== undefined) {
                    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
                }
                // 하나만 있는 경우 있는 걸 먼저 보여줌
                else if (a.sort_order !== undefined) return -1;
                else if (b.sort_order !== undefined) return 1;

                // 순서 정보가 없는 경우 시작일 최신순 정렬
                const dateA = new Date(a.start_date).getTime();
                const dateB = new Date(b.start_date).getTime();
                if (dateB !== dateA) return dateB - dateA;
                return b.id - a.id; // 시작일이 같으면 최신 ID 순
            });
            setCompetitions(sortedComps);
        } catch (error) {
            console.error("대회 목록을 불러오지 못했습니다.", error);
        } finally {
            setPageLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passcode.trim() || !selectedComp) return;

        setLoading(true);
        try {
            const res = await api.post('/api/competitions/guest/verify', {
                competition_id: selectedComp.id,
                passcode
            });
            // 성공하면 대회 정보를 state로 넘기거나 로컬스토리지에 잠시 저장
            localStorage.setItem('guest_session', JSON.stringify({
                passcode,
                competition_id: selectedComp.id,
                competition: res.data.competition,
                events: res.data.events
            }));
            toast.success('인증되었습니다!');
            navigate('/guest/scores');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || '올바르지 않은 패스코드입니다.');
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <div style={styles.container}>
                <div style={styles.spinner}></div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                {!selectedComp ? (
                    <>
                        <h2 style={styles.title}>참가할 대회를 선택해주세요</h2>
                        <p style={styles.subtitle}>현재 진행 중인 대회의 기록실에 입장합니다.</p>

                        {competitions.length === 0 ? (
                            <div style={{ padding: '40px 0', color: '#8B95A1' }}>현재 진행 중인 대회가 없습니다.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                                {competitions.map(comp => (
                                    <div
                                        key={comp.id}
                                        onClick={() => setSelectedComp(comp)}
                                        style={styles.compCard}
                                    >
                                        <div style={{ textAlign: 'left' }}>
                                            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#191F28' }}>{comp.title}</h3>
                                            <p style={{ margin: 0, fontSize: '13px', color: '#8B95A1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={13} /> {comp.start_date.split('T')[0]} ~ {comp.end_date.split('T')[0]}
                                            </p>
                                        </div>
                                        <ChevronRight size={20} color="#B0B8C1" />
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                backgroundColor: '#F2F4F6',
                                border: 'none',
                                color: '#4E5968',
                                marginTop: '30px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '12px 20px',
                                borderRadius: '12px',
                                fontWeight: '700',
                                transition: 'all 0.2s'
                            }}
                        >
                            로그인 화면으로 돌아가기
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => { setSelectedComp(null); setPasscode(''); }}
                            style={{ background: 'none', border: 'none', color: '#4E5968', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, marginBottom: '24px', fontSize: '14px', fontWeight: 'bold' }}
                        >
                            <ArrowLeft size={16} /> 목록으로 돌아가기
                        </button>

                        <h2 style={styles.title}>{selectedComp.title}</h2>
                        <p style={styles.subtitle}>체육관에서 안내받은 비밀번호를 입력해주세요.</p>

                        <form onSubmit={handleVerify} style={styles.form}>
                            <input
                                type="password"
                                placeholder="비밀번호 입력"
                                value={passcode}
                                onChange={(e) => setPasscode(e.target.value)}
                                style={styles.input}
                                autoFocus
                            />
                            <button type="submit" disabled={loading} style={styles.button}>
                                {loading ? '확인 중...' : '입장하기'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '20px'
    },
    card: {
        width: '100%', maxWidth: '440px', padding: '40px 32px',
        backgroundColor: '#FFFFFF', borderRadius: '24px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
        textAlign: 'center'
    },
    compCard: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB',
        backgroundColor: '#F9FAFB', cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    title: { fontSize: '24px', fontWeight: '800', color: '#191F28', marginBottom: '8px' },
    subtitle: { fontSize: '15px', color: '#4E5968', marginBottom: '12px' },
    form: { display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' },
    input: {
        padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB',
        fontSize: '18px', textAlign: 'center', backgroundColor: '#F9FAFB', outline: 'none'
    },
    button: {
        padding: '16px', borderRadius: '14px', border: 'none',
        backgroundColor: '#3182F6', color: 'white', fontWeight: 'bold',
        fontSize: '16px', cursor: 'pointer', transition: '0.2s'
    },
    spinner: {
        width: '40px', height: '40px',
        border: '4px solid #E5E7EB',
        borderTop: '4px solid #3182F6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    }
};

export default GuestEntryPage;
