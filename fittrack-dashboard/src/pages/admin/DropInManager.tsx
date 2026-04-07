import React, { useState, useEffect } from 'react';
import { getDropInConversionStats, getGymReservations, updateReservationStatus } from '../../services/api';
import toast from 'react-hot-toast';
import { Check, X, Calendar, User, Clock, Phone, ExternalLink, TrendingUp } from 'lucide-react';

interface Reservation {
    id: number;
    member_name: string;
    member_phone?: string;
    member_id?: number;
    date: string;
    status: 'pending' | 'confirmed' | 'rejected';
    created_at: string;
    first_paid_sale_date?: string | null;
    converted_within_7_days?: boolean;
    converted_within_30_days?: boolean;
    conversion_status?: 'converted_7d' | 'converted_30d' | 'converted_late' | 'not_converted';
}

interface DropInConversionStats {
    total_reservations: number;
    confirmed_reservations: number;
    converted_7d_count: number;
    converted_30d_count: number;
    conversion_rate_7d: number;
    conversion_rate_30d: number;
    pending_recent_followup_count: number;
}

const DropInManager: React.FC = () => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [stats, setStats] = useState<DropInConversionStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchReservations();
    }, []);

    const fetchReservations = async () => {
        setIsLoading(true);
        try {
            const [reservationsRes, statsRes] = await Promise.all([
                getGymReservations(),
                getDropInConversionStats(),
            ]);
            setReservations(reservationsRes.data);
            setStats(statsRes.data);
        } catch (error) {
            console.error(error);
            toast.error('예약 목록을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (id: number, status: 'confirmed' | 'rejected') => {
        if (!window.confirm(status === 'confirmed' ? '예약을 승인하시겠습니까?' : '예약을 거절하시겠습니까?')) return;

        try {
            await updateReservationStatus(id, status);
            toast.success(status === 'confirmed' ? '예약이 승인되었습니다.' : '예약이 거절되었습니다.');
            fetchReservations(); // 목록 갱신
        } catch (error) {
            console.error(error);
            toast.error('상태 변경 실패');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span style={styles.badgePending}>대기 중</span>;
            case 'confirmed':
                return <span style={styles.badgeConfirmed}>승인됨</span>;
            case 'rejected':
                return <span style={styles.badgeRejected}>거절됨</span>;
            default:
                return null;
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    };

    const getConversionBadge = (reservation: Reservation) => {
        switch (reservation.conversion_status) {
            case 'converted_7d':
                return <span style={styles.badgeConvertedStrong}>7일 내 등록</span>;
            case 'converted_30d':
                return <span style={styles.badgeConverted}>30일 내 등록</span>;
            case 'converted_late':
                return <span style={styles.badgeConvertedLate}>후속 등록</span>;
            case 'not_converted':
                return reservation.status === 'confirmed'
                    ? <span style={styles.badgeFollowUp}>후속 필요</span>
                    : null;
            default:
                return null;
        }
    };

    const openSms = (phone?: string) => {
        if (!phone) {
            toast.error('전화번호가 없습니다.');
            return;
        }
        window.location.href = `sms:${phone}`;
    };

    const openCall = (phone?: string) => {
        if (!phone) {
            toast.error('전화번호가 없습니다.');
            return;
        }
        window.location.href = `tel:${phone}`;
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>드랍인 예약 관리</h1>
            <p style={styles.subtitle}>들어온 드랍인 예약 요청을 확인하고 승인하거나 거절하세요. 승인 후에는 등록 전환까지 추적할 수 있습니다.</p>

            {stats && (
                <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                        <div style={styles.statLabel}>확정 드랍인</div>
                        <div style={styles.statValue}>{stats.confirmed_reservations}건</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statLabel}>7일 내 등록률</div>
                        <div style={styles.statValue}>{stats.conversion_rate_7d}%</div>
                        <div style={styles.statSub}>전환 {stats.converted_7d_count}건</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statLabel}>30일 내 등록률</div>
                        <div style={styles.statValue}>{stats.conversion_rate_30d}%</div>
                        <div style={styles.statSub}>전환 {stats.converted_30d_count}건</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statLabel}>후속 필요</div>
                        <div style={styles.statValue}>{stats.pending_recent_followup_count}건</div>
                        <div style={styles.statSub}>최근 7일 확정 기준</div>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div style={styles.loading}>로딩 중...</div>
            ) : reservations.length === 0 ? (
                <div style={styles.emptyState}>
                    <Calendar size={48} color="#9CA3AF" />
                    <p>아직 들어온 예약이 없습니다.</p>
                </div>
            ) : (
                <div style={styles.grid}>
                    {reservations.map((res) => (
                        <div key={res.id} style={styles.card}>
                            <div style={styles.cardHeader}>
                                <div style={styles.userInfo}>
                                    <User size={20} color="#6B7280" />
                                    <span style={styles.userName}>{res.member_name}</span>
                                </div>
                                {getStatusBadge(res.status)}
                            </div>

                            <div style={styles.cardBody}>
                                <div style={styles.infoRow}>
                                    <Calendar size={16} color="#6B7280" />
                                    <span>예약일: {formatDate(res.date)}</span>
                                </div>
                                {res.member_phone && (
                                    <div style={styles.infoRow}>
                                        <Phone size={16} color="#6B7280" />
                                        <span>{res.member_phone}</span>
                                    </div>
                                )}
                                <div style={styles.infoRow}>
                                    <Clock size={16} color="#6B7280" />
                                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>신청일: {new Date(res.created_at).toLocaleString()}</span>
                                </div>
                                {getConversionBadge(res)}
                                {res.first_paid_sale_date && (
                                    <div style={styles.infoRow}>
                                        <TrendingUp size={16} color="#10B981" />
                                        <span>등록일: {new Date(res.first_paid_sale_date).toLocaleDateString('ko-KR')}</span>
                                    </div>
                                )}
                            </div>

                            {res.status === 'pending' && (
                                <div style={styles.cardFooter}>
                                    <button
                                        onClick={() => handleStatusUpdate(res.id, 'confirmed')}
                                        style={styles.approveButton}
                                    >
                                        <Check size={16} /> 승인
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(res.id, 'rejected')}
                                        style={styles.rejectButton}
                                    >
                                        <X size={16} /> 거절
                                    </button>
                                </div>
                            )}

                            {res.status !== 'pending' && (
                                <div style={styles.cardFooter}>
                                    <button onClick={() => openCall(res.member_phone)} style={styles.secondaryButton}>
                                        <Phone size={16} /> 전화
                                    </button>
                                    <button onClick={() => openSms(res.member_phone)} style={styles.secondaryButton}>
                                        <ExternalLink size={16} /> 문자
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
    },
    title: {
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '8px',
        color: 'var(--text-primary)',
    },
    subtitle: {
        color: 'var(--text-secondary)',
        marginBottom: '32px',
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: 'var(--text-secondary)',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
    },
    statCard: {
        backgroundColor: 'var(--bg-card)',
        borderRadius: '14px',
        padding: '18px',
        border: '1px solid var(--border-color)',
    },
    statLabel: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        marginBottom: '8px',
    },
    statValue: {
        fontSize: '28px',
        fontWeight: 700,
        color: 'var(--text-primary)',
    },
    statSub: {
        fontSize: '12px',
        color: '#6B7280',
        marginTop: '4px',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px',
        gap: '16px',
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px',
    },
    card: {
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    userInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    userName: {
        fontWeight: 'bold',
        fontSize: '16px',
        color: 'var(--text-primary)',
    },
    cardBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    infoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'var(--text-secondary)',
        fontSize: '14px',
    },
    cardFooter: {
        display: 'flex',
        gap: '8px',
        marginTop: 'auto',
    },
    approveButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '10px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#10B981', // Green
        color: 'white',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    rejectButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '10px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#EF4444', // Red
        color: 'white',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    secondaryButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'white',
        color: '#374151',
        fontWeight: '600',
        cursor: 'pointer',
    },
    badgePending: {
        padding: '4px 10px',
        borderRadius: '20px',
        backgroundColor: '#FEF3C7',
        color: '#D97706',
        fontSize: '12px',
        fontWeight: '600',
    },
    badgeConfirmed: {
        padding: '4px 10px',
        borderRadius: '20px',
        backgroundColor: '#D1FAE5',
        color: '#059669',
        fontSize: '12px',
        fontWeight: '600',
    },
    badgeRejected: {
        padding: '4px 10px',
        borderRadius: '20px',
        backgroundColor: '#FEE2E2',
        color: '#DC2626',
        fontSize: '12px',
        fontWeight: '600',
    },
    badgeConvertedStrong: {
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        padding: '4px 10px',
        borderRadius: '20px',
        backgroundColor: '#DCFCE7',
        color: '#166534',
        fontSize: '12px',
        fontWeight: '600',
    },
    badgeConverted: {
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        padding: '4px 10px',
        borderRadius: '20px',
        backgroundColor: '#DBEAFE',
        color: '#1D4ED8',
        fontSize: '12px',
        fontWeight: '600',
    },
    badgeConvertedLate: {
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        padding: '4px 10px',
        borderRadius: '20px',
        backgroundColor: '#F3E8FF',
        color: '#7E22CE',
        fontSize: '12px',
        fontWeight: '600',
    },
    badgeFollowUp: {
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        padding: '4px 10px',
        borderRadius: '20px',
        backgroundColor: '#FEF3C7',
        color: '#B45309',
        fontSize: '12px',
        fontWeight: '600',
    },
};

export default DropInManager;
