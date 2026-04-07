import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Calendar, Clock, Users, ChevronLeft, ChevronRight, CheckCircle, X, Info } from 'lucide-react';
import { getClassSchedules, reserveClass, cancelReservation, getMyReservations } from '../../services/api';
import { ListSkeleton } from '../../components/common/SkeletonLoader';

const TOSS_BLUE = '#3182F6';
const TOSS_GREEN = '#10B981';

interface ClassSchedule {
    id: number;
    title: string;
    date: string;
    time: string;
    max_participants: number;
    status: string;
    current_participants: number;
    is_reserved: boolean;
}

const ReservationPage: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
    const [myReservations, setMyReservations] = useState<ClassSchedule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSchedules();
        fetchMyReservations();
    }, [selectedDate]);

    const fetchSchedules = async () => {
        setLoading(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const res = await getClassSchedules(dateStr);
            setSchedules(res.data);
        } catch (error) {
            console.error(error);
            toast.error('수업 일정을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const fetchMyReservations = async () => {
        try {
            const res = await getMyReservations(true);
            setMyReservations(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleReserve = async (scheduleId: number) => {
        if (!window.confirm('이 수업을 예약하시겠습니까?')) return;
        try {
            await reserveClass(scheduleId);
            toast.success('예약되었습니다! 🎉');
            fetchSchedules();
            fetchMyReservations();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || '예약 실패');
        }
    };

    const handleCancel = async (scheduleId: number) => {
        if (!window.confirm('예약을 취소하시겠습니까?')) return;
        try {
            await cancelReservation(scheduleId);
            toast.success('예약이 취소되었습니다.');
            fetchSchedules();
            fetchMyReservations();
        } catch (error: any) {
            toast.error('취소 실패');
        }
    };

    const changeDate = (days: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
    };

    const isToday = selectedDate.toDateString() === new Date().toDateString();
    const formattedDate = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
    const dayName = selectedDate.toLocaleDateString('ko-KR', { weekday: 'long' });
    const now = new Date();
    const toScheduleDateTime = (item: ClassSchedule) => new Date(`${item.date}T${item.time.length === 5 ? `${item.time}:00` : item.time}`);
    const upcomingReservations = myReservations.filter((reservation) => toScheduleDateTime(reservation) >= now);
    const pastReservations = myReservations.filter((reservation) => toScheduleDateTime(reservation) < now);
    const nextReservation = upcomingReservations[0];
    const selectedDateStart = new Date(selectedDate);
    selectedDateStart.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const selectedDateIsPast = selectedDateStart < todayStart;

    const getScheduleBadge = (schedule: ClassSchedule) => {
        if (schedule.is_reserved) return <span style={styles.successBadge}>예약 완료</span>;
        if (schedule.status === 'cancelled') return <span style={styles.cancelledBadge}>취소된 수업</span>;
        if (schedule.current_participants >= schedule.max_participants) return <span style={styles.fullBadge}>정원 마감</span>;
        return <span style={styles.openBadge}>예약 가능</span>;
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <header style={styles.header}>
                <h1 style={styles.pageTitle}>수업 예약</h1>
            </header>

            {/* Date Navigation */}
            <div style={styles.dateNavCard}>
                <button onClick={() => changeDate(-1)} style={styles.navBtn}><ChevronLeft size={24} /></button>
                <div style={styles.dateInfo}>
                    <div style={styles.dateMain}>
                        {formattedDate}
                        {isToday && <span style={styles.todayBadge}>오늘</span>}
                    </div>
                    <div style={styles.daySub}>{dayName}</div>
                </div>
                <button onClick={() => changeDate(1)} style={styles.navBtn}><ChevronRight size={24} /></button>
            </div>

            {/* My Reservations Alert */}
            {nextReservation && (
                <div style={styles.nextResCard}>
                    <div style={styles.nextResLabel}>다음 예약</div>
                    <div style={styles.nextResTitle}>{nextReservation.title}</div>
                    <div style={styles.nextResMeta}>
                        {nextReservation.date} · {nextReservation.time}
                    </div>
                </div>
            )}

            <div style={styles.policyCard}>
                <div style={styles.policyHeader}>
                    <Info size={16} color={TOSS_BLUE} />
                    <span style={styles.policyTitle}>예약 안내</span>
                </div>
                <div style={styles.policyText}>
                    현재 예약은 이 화면에서 바로 취소할 수 있습니다. 정원이 찬 수업은 예약할 수 없고, 운영자가 취소한 수업은 자동으로 비활성화됩니다.
                </div>
            </div>

            {myReservations.length > 0 && (
                <div style={styles.myResSection}>
                    <div style={styles.sectionTitle}>
                        <CheckCircle size={18} color={TOSS_GREEN} style={{ marginRight: '6px' }} />
                        예정된 예약 <span style={styles.countBadge}>{upcomingReservations.length}</span>
                    </div>
                    {upcomingReservations.length === 0 ? (
                        <div style={styles.emptyInline}>예정된 예약이 없습니다.</div>
                    ) : (
                    <div style={styles.hScroll}>
                        {upcomingReservations.map((res) => (
                            <div key={res.id} style={styles.miniCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={styles.miniTime}>{res.time}</div>
                                    <button
                                        onClick={() => handleCancel(res.id)}
                                        style={styles.miniCancelBtn}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <div style={styles.miniTitle}>{res.title}</div>
                                <div style={styles.miniDate}>{res.date}</div>
                                <div style={styles.miniStatus}>예약 완료</div>
                            </div>
                        ))}
                    </div>
                    )}
                    {pastReservations.length > 0 && (
                        <>
                            <div style={{ ...styles.sectionTitle, marginTop: '20px' }}>
                                <Clock size={18} color="#6B7280" style={{ marginRight: '6px' }} />
                                지난 예약 <span style={styles.pastCountBadge}>{pastReservations.length}</span>
                            </div>
                            <div style={styles.pastList}>
                                {pastReservations.slice(0, 5).map((res) => (
                                    <div key={`past-${res.id}`} style={styles.pastItem}>
                                        <div>
                                            <div style={styles.pastTitle}>{res.title}</div>
                                            <div style={styles.pastMeta}>{res.date} · {res.time}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Schedule List */}
            <div style={styles.scheduleSection}>
                <div style={styles.sectionTitle}>
                    <Clock size={18} color={TOSS_BLUE} style={{ marginRight: '6px' }} />
                    시간표
                </div>

                {loading ? (
                    <ListSkeleton count={3} />
                ) : schedules.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}><Calendar size={32} color="#ADB5BD" /></div>
                        <p style={styles.emptyText}>{selectedDateIsPast ? '선택한 날짜에는 확인할 수 있는 예약 가능한 수업이 없습니다.' : '예정된 수업이 없습니다.'}</p>
                    </div>
                ) : (
                    <div style={styles.cardList}>
                        {schedules.map((schedule) => {
                            const isFull = schedule.current_participants >= schedule.max_participants;
                            const spotsLeft = schedule.max_participants - schedule.current_participants;
                            const isReserved = schedule.is_reserved;
                            const isCancelled = schedule.status === 'cancelled';

                            return (
                                <div key={schedule.id} style={{
                                    ...styles.card,
                                    borderColor: isReserved ? 'var(--success)' : (isCancelled ? '#FECACA' : (isFull ? 'var(--danger-bg)' : 'var(--border-color)')),
                                    backgroundColor: isReserved ? 'var(--success-bg)' : (isCancelled ? '#FEF2F2' : 'var(--bg-card)')
                                }}>
                                    <div style={styles.cardLeft}>
                                        <div style={styles.timeTag}>{schedule.time}</div>
                                        <div style={styles.cardContent}>
                                            <div style={styles.cardTitleRow}>
                                                <div style={styles.cardTitle}>{schedule.title}</div>
                                                {getScheduleBadge(schedule)}
                                            </div>
                                            <div style={styles.metaRow}>
                                                <Users size={14} color="var(--text-tertiary)" />
                                                <span style={styles.metaText}>
                                                    {schedule.current_participants} / {schedule.max_participants}명
                                                </span>
                                                {!isFull && !isCancelled && spotsLeft <= 3 && (
                                                    <span style={styles.urgentBadge}>{spotsLeft}자리 남음!</span>
                                                )}
                                            </div>
                                            <div style={styles.policyHint}>
                                                {isReserved
                                                    ? '예약한 수업입니다. 필요하면 우측 버튼으로 바로 취소할 수 있습니다.'
                                                    : isCancelled
                                                        ? '운영자가 취소한 수업입니다.'
                                                        : isFull
                                                            ? '정원이 모두 차서 더 이상 예약할 수 없습니다.'
                                                            : '예약 후 일정 변경 시 이 화면에서 바로 취소할 수 있습니다.'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={styles.cardRight}>
                                        {isReserved ? (
                                            <button onClick={() => handleCancel(schedule.id)} style={styles.cancelBtn}>
                                                취소
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleReserve(schedule.id)}
                                                disabled={isFull || isCancelled}
                                                style={(isFull || isCancelled) ? styles.fullBtn : styles.reserveBtn}
                                            >
                                                {isCancelled ? '취소됨' : isFull ? '마감' : '예약'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { maxWidth: '100%', padding: '0 24px 100px', backgroundColor: 'var(--bg-card)', minHeight: '100vh', boxSizing: 'border-box' },
    header: { paddingTop: '24px', paddingBottom: '16px' },
    pageTitle: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },

    dateNavCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', marginBottom: '24px', border: '1px solid var(--border-color)' },
    navBtn: { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-primary)', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
    dateInfo: { textAlign: 'center' as const },
    dateMain: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' },
    todayBadge: { fontSize: '12px', fontWeight: '600', color: 'var(--primary)', backgroundColor: 'var(--primary-bg)', padding: '2px 8px', borderRadius: '8px' },
    daySub: { fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '4px' },

    myResSection: { marginBottom: '32px' },
    nextResCard: { marginBottom: '20px', padding: '18px', background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid #BFDBFE', borderRadius: '18px' },
    nextResLabel: { fontSize: '12px', fontWeight: '700', color: TOSS_BLUE, marginBottom: '6px' },
    nextResTitle: { fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' },
    nextResMeta: { fontSize: '13px', color: 'var(--text-secondary)' },
    policyCard: { marginBottom: '20px', padding: '14px 16px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px' },
    policyHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
    policyTitle: { fontSize: '13px', fontWeight: '700', color: '#1E40AF' },
    policyText: { fontSize: '13px', color: '#475569', lineHeight: 1.5 },
    sectionTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center' },
    countBadge: { fontSize: '14px', color: 'var(--success)', backgroundColor: 'var(--success-bg)', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px' },
    pastCountBadge: { fontSize: '14px', color: '#6B7280', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px' },
    hScroll: { display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' },
    miniCard: { minWidth: '140px', padding: '16px', backgroundColor: 'var(--success-bg)', borderRadius: '16px', border: '1px solid var(--success)', display: 'flex', flexDirection: 'column', gap: '4px' },
    miniTime: { fontSize: '18px', fontWeight: '800', color: 'var(--success)' },
    miniTitle: { fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
    miniDate: { fontSize: '12px', color: 'var(--text-tertiary)' },
    miniStatus: { marginTop: '6px', fontSize: '11px', fontWeight: '700', color: TOSS_GREEN },
    emptyInline: { padding: '16px', borderRadius: '14px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: '14px' },
    pastList: { display: 'flex', flexDirection: 'column', gap: '8px' },
    pastItem: { padding: '14px 16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '14px', border: '1px solid var(--border-color)' },
    pastTitle: { fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' },
    pastMeta: { fontSize: '12px', color: 'var(--text-tertiary)' },

    scheduleSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    cardList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    card: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderRadius: '20px', borderWidth: '1px', borderStyle: 'solid', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' },

    cardLeft: { display: 'flex', alignItems: 'center', gap: '16px', flex: 1 },
    timeTag: { fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', minWidth: '60px' },
    cardContent: { display: 'flex', flexDirection: 'column', gap: '4px' },
    cardTitleRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const },
    cardTitle: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' },
    metaRow: { display: 'flex', alignItems: 'center', gap: '6px' },
    metaText: { fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: '500' },
    urgentBadge: { fontSize: '11px', fontWeight: '700', color: 'var(--warning)', backgroundColor: 'var(--warning-bg)', padding: '2px 6px', borderRadius: '6px' },
    policyHint: { fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.4 },
    openBadge: { fontSize: '11px', fontWeight: '700', color: TOSS_BLUE, backgroundColor: '#E8F3FF', padding: '3px 8px', borderRadius: '999px' },
    successBadge: { fontSize: '11px', fontWeight: '700', color: TOSS_GREEN, backgroundColor: 'var(--success-bg)', padding: '3px 8px', borderRadius: '999px' },
    fullBadge: { fontSize: '11px', fontWeight: '700', color: '#DC2626', backgroundColor: '#FEE2E2', padding: '3px 8px', borderRadius: '999px' },
    cancelledBadge: { fontSize: '11px', fontWeight: '700', color: '#991B1B', backgroundColor: '#FEE2E2', padding: '3px 8px', borderRadius: '999px' },

    cardRight: { marginLeft: '12px' },
    reserveBtn: { padding: '10px 20px', backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' },
    fullBtn: { padding: '10px 20px', backgroundColor: 'var(--bg-hover)', color: 'var(--text-tertiary)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'not-allowed' },
    cancelBtn: { padding: '10px 20px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },

    emptyState: { padding: '60px 0', textAlign: 'center' as const, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
    emptyIcon: { width: '64px', height: '64px', borderRadius: '32px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: '15px', color: 'var(--text-tertiary)' },

    miniCancelBtn: {
        background: 'rgba(0,0,0,0.05)',
        border: 'none',
        borderRadius: '50%',
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        transition: 'all 0.2s',
    },
};

export default ReservationPage;
