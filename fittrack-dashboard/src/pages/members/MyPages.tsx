import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyStats, getMyBadges, getMyHoldStatus } from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';
import HoldModal from '../../components/modals/HoldModal';
import EditProfileModal from '../../components/modals/EditProfileModal';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardSkeleton } from '../../components/common/SkeletonLoader';
import { User, Phone, Building, Calendar, Settings, Pause, Award, TrendingUp, Flame, Dumbbell, ChevronRight, Trophy, MessageSquare, LogOut, CreditCard, Clock3, ClipboardList } from 'lucide-react';

// 토스 스타일 색상
const TOSS_BLUE = '#3182F6';

const MyPage: React.FC = () => {
    const { user, logout } = useAppContext();
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [badges, setBadges] = useState<any[]>([]);
    const [holdStatus, setHoldStatus] = useState<{ max_days: number; used_days: number; remaining_days: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchStats = async () => {
        try {
            const [statsRes, badgeRes, holdRes] = await Promise.all([
                getMyStats(),
                getMyBadges(),
                getMyHoldStatus(),
            ]);
            setStats(statsRes.data);
            setBadges(badgeRes.data);
            setHoldStatus(holdRes.data);
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) return (
        <div style={styles.container}>
            <DashboardSkeleton />
        </div>
    );
    if (!user) return null;

    const membershipInfo = stats?.membership_info;
    const nextReservation = stats?.next_reservation;
    const todayWod = stats?.today_wod;
    const remainingDays = membershipInfo?.remaining_days ?? 0;
    const expiryTone =
        remainingDays <= 7 ? '#EF4444'
        : remainingDays <= 30 ? '#F59E0B'
        : TOSS_BLUE;

    return (
        <div style={styles.container}>
            {/* 1. 프로필 섹션 */}
            <section style={styles.profileSection}>
                <div style={styles.profileHeader}>
                    <div style={styles.avatar}>
                        <User size={28} color="#FFFFFF" />
                    </div>
                    <div style={styles.profileInfo}>
                        <h1 style={styles.userName}>{user.name}</h1>
                        <p style={styles.userMembership}>{user.membership || '회원권 없음'}</p>
                    </div>
                    <button style={styles.editButton} onClick={() => setIsEditModalOpen(true)}>
                        <Settings size={18} />
                    </button>
                </div>

                {/* 회원 정보 리스트 */}
                <div style={styles.infoList}>
                    <div style={styles.infoItem}>
                        <Phone size={18} color="#9CA3AF" />
                        <span style={styles.infoText}>{user.phone}</span>
                    </div>
                    <div style={styles.infoItem}>
                        <Building size={18} color="#9CA3AF" />
                        <span style={styles.infoText}>{user.gym_id}호점</span>
                    </div>
                    {user.end_date && (
                        <div style={styles.infoItem}>
                            <Calendar size={18} color={TOSS_BLUE} />
                            <span style={{ ...styles.infoText, color: TOSS_BLUE, fontWeight: '600' }}>
                                {user.end_date} 만료
                            </span>
                        </div>
                    )}
                </div>

                {/* 홀딩 신청 버튼 */}
                <button style={styles.holdButton} onClick={() => setIsHoldModalOpen(true)}>
                    <Pause size={18} />
                    회원권 일시정지 (홀딩)
                    <ChevronRight size={18} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                </button>
            </section>

            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <CreditCard size={20} color={TOSS_BLUE} />
                    <h2 style={styles.sectionTitle}>회원권 상태</h2>
                </div>
                <div style={styles.membershipCard}>
                    <div style={styles.membershipTopRow}>
                        <div>
                            <div style={styles.membershipType}>{membershipInfo?.type || user.membership || '회원권 없음'}</div>
                            <div style={styles.membershipPeriod}>
                                {membershipInfo?.start_date || user.start_date || '-'} ~ {membershipInfo?.end_date || user.end_date || '-'}
                            </div>
                        </div>
                        <div style={{ ...styles.remainingBadge, color: expiryTone, borderColor: `${expiryTone}33`, backgroundColor: `${expiryTone}14` }}>
                            {membershipInfo?.end_date ? `D-${remainingDays}` : '미등록'}
                        </div>
                    </div>
                    <div style={styles.membershipMetaGrid}>
                        <div style={styles.membershipMetaCard}>
                            <div style={styles.membershipMetaLabel}>남은 기간</div>
                            <div style={{ ...styles.membershipMetaValue, color: expiryTone }}>
                                {membershipInfo?.end_date ? `${remainingDays}일` : '-'}
                            </div>
                        </div>
                        <div style={styles.membershipMetaCard}>
                            <div style={styles.membershipMetaLabel}>홀딩 가능</div>
                            <div style={styles.membershipMetaValue}>{holdStatus ? `${holdStatus.remaining_days}일` : '-'}</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. 통계 카드 */}
            <section style={styles.statsSection}>
                <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>
                            <Flame size={22} color={TOSS_BLUE} />
                        </div>
                        <div style={styles.statLabel}>이번 달 출석</div>
                        <div style={styles.statValue}>
                            {stats?.attendance_count || 0}
                            <span style={styles.statUnit}>일</span>
                        </div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>
                            <Dumbbell size={22} color="#10B981" />
                        </div>
                        <div style={styles.statLabel}>총 운동</div>
                        <div style={{ ...styles.statValue, color: '#10B981' }}>
                            {stats?.total_workouts || 0}
                            <span style={styles.statUnit}>회</span>
                        </div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>
                            <TrendingUp size={22} color="#FF6B35" />
                        </div>
                        <div style={styles.statLabel}>연속 출석</div>
                        <div style={{ ...styles.statValue, color: '#FF6B35' }}>
                            {stats?.current_streak || 0}
                            <span style={styles.statUnit}>일</span>
                        </div>
                    </div>
                </div>
            </section>

            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <Clock3 size={20} color={TOSS_BLUE} />
                    <h2 style={styles.sectionTitle}>바로 확인할 정보</h2>
                </div>
                <div style={styles.quickGrid}>
                    <button style={styles.quickCard} onClick={() => navigate('/reservation')}>
                        <div style={styles.quickCardHeader}>
                            <Calendar size={18} color={TOSS_BLUE} />
                            <span style={styles.quickCardLabel}>다음 수업</span>
                        </div>
                        <div style={styles.quickCardValue}>{nextReservation ? nextReservation.title : '예약 없음'}</div>
                        <div style={styles.quickCardMeta}>
                            {nextReservation ? `${nextReservation.date} · ${nextReservation.time}` : '수업 예약하러 가기'}
                        </div>
                    </button>
                    <button style={styles.quickCard} onClick={() => navigate(todayWod ? '/my-workouts' : '/wod')}>
                        <div style={styles.quickCardHeader}>
                            <ClipboardList size={18} color="#10B981" />
                            <span style={styles.quickCardLabel}>오늘의 WOD</span>
                        </div>
                        <div style={styles.quickCardValue}>{todayWod ? todayWod.title : '등록 없음'}</div>
                        <div style={styles.quickCardMeta}>
                            {todayWod ? '운동 기록하러 가기' : 'WOD 보러 가기'}
                        </div>
                    </button>
                </div>
            </section>

            {/* 3. 배지 섹션 */}
            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <Award size={20} color={TOSS_BLUE} />
                    <h2 style={styles.sectionTitle}>획득한 배지</h2>
                </div>
                {badges.length > 0 ? (
                    <div style={styles.badgeGrid}>
                        {badges.map((badge: any, index: number) => (
                            <div key={index} style={styles.badgeItem}>
                                <div style={styles.badgeIcon}>{badge.icon || '🏅'}</div>
                                <div style={styles.badgeName}>{badge.name}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={styles.emptyBadge}>
                        <Award size={40} color="#E5E7EB" />
                        <p style={styles.emptyText}>아직 획득한 배지가 없어요</p>
                        <p style={styles.emptySubtext}>꾸준히 운동해서 배지를 모아보세요!</p>
                    </div>
                )}
            </section>

            {/* 4. 출석 차트 */}
            <section style={styles.section}>
                <div style={styles.sectionHeader}>
                    <TrendingUp size={20} color={TOSS_BLUE} />
                    <h2 style={styles.sectionTitle}>월별 출석 추이</h2>
                </div>
                <div style={styles.chartCard}>
                    {stats?.attendance_history && stats.attendance_history.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={stats.attendance_history}>
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-card)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                        color: 'var(--text-primary)'
                                    }}
                                    itemStyle={{ color: 'var(--text-primary)' }}
                                    cursor={{ fill: 'var(--bg-secondary)' }}
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
                    ) : (
                        <div style={styles.emptyChart}>
                            <p>아직 출석 기록이 없어요</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 5. 더보기 메뉴 */}
            <section style={styles.section}>
                <h2 style={{ ...styles.sectionTitle, margin: '0 0 16px 0' }}>더보기</h2>
                <div style={styles.menuList}>
                    <Link to="/pr" style={styles.menuItem}>
                        <TrendingUp size={20} color={TOSS_BLUE} />
                        <span style={styles.menuLabel}>PR / 1RM 기록</span>
                        <ChevronRight size={18} color="#9CA3AF" />
                    </Link>
                    <Link to="/competition" style={styles.menuItem}>
                        <Trophy size={20} color="#F59E0B" />
                        <span style={styles.menuLabel}>대회 / 랭킹</span>
                        <ChevronRight size={18} color="#9CA3AF" />
                    </Link>
                    <Link to="/chat" style={styles.menuItem}>
                        <MessageSquare size={20} color="#8B5CF6" />
                        <span style={styles.menuLabel}>코치 문의</span>
                        <ChevronRight size={18} color="#9CA3AF" />
                    </Link>
                    <Link to="/community" style={styles.menuItem}>
                        <MessageSquare size={20} color="#10B981" />
                        <span style={styles.menuLabel}>커뮤니티</span>
                        <ChevronRight size={18} color="#9CA3AF" />
                    </Link>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        style={{ ...styles.menuItem, backgroundColor: '#FEF2F2', border: 'none', cursor: 'pointer', width: '100%' }}
                    >
                        <LogOut size={20} color="#EF4444" />
                        <span style={{ ...styles.menuLabel, color: '#EF4444' }}>로그아웃</span>
                        <ChevronRight size={18} color="#EF4444" />
                    </button>
                </div>
            </section>

            {/* 모달들 */}
            {isHoldModalOpen && <HoldModal onClose={() => setIsHoldModalOpen(false)} onSuccess={() => window.location.reload()} />}
            {isEditModalOpen && <EditProfileModal onClose={() => setIsEditModalOpen(false)} onSuccess={() => console.log("Profile Updated!")} />}
        </div>
    );
};

// 토스 스타일
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        maxWidth: '560px',
        margin: '0 auto',
        padding: '0 20px 100px',
        backgroundColor: 'var(--bg-card)',
        minHeight: '100vh',
    },

    // 프로필 섹션
    profileSection: {
        paddingTop: '24px',
        paddingBottom: '24px',
        borderBottom: '8px solid var(--bg-secondary)',
    },
    profileHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
    },
    avatar: {
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: TOSS_BLUE,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileInfo: {
        flex: 1,
    },
    userName: {
        fontSize: '20px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
    },
    userMembership: {
        fontSize: '14px',
        color: 'var(--text-tertiary)',
        margin: '4px 0 0 0',
    },
    editButton: {
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-secondary)',
        border: 'none',
        borderRadius: '50%',
        cursor: 'pointer',
        color: 'var(--text-tertiary)',
    },
    infoList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
        marginBottom: '20px',
    },
    infoItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    infoText: {
        fontSize: '15px',
        color: 'var(--text-secondary)',
    },
    holdButton: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'var(--danger-bg)',
        border: 'none',
        borderRadius: '12px',
        fontSize: '15px',
        fontWeight: '500',
        color: 'var(--danger)',
        cursor: 'pointer',
    },
    membershipCard: {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '18px',
        padding: '18px',
    },
    membershipTopRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '16px',
    },
    membershipType: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '6px',
    },
    membershipPeriod: {
        fontSize: '13px',
        color: 'var(--text-tertiary)',
    },
    remainingBadge: {
        fontSize: '13px',
        fontWeight: '700',
        padding: '8px 12px',
        borderRadius: '999px',
        border: '1px solid',
        whiteSpace: 'nowrap' as const,
    },
    membershipMetaGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
    },
    membershipMetaCard: {
        backgroundColor: 'var(--bg-card)',
        borderRadius: '14px',
        padding: '14px',
    },
    membershipMetaLabel: {
        fontSize: '12px',
        color: 'var(--text-tertiary)',
        marginBottom: '6px',
    },
    membershipMetaValue: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
    },

    // 통계 섹션
    statsSection: {
        padding: '24px 0',
        borderBottom: '8px solid var(--bg-secondary)',
    },
    statsGrid: {
        display: 'flex',
        gap: '12px',
    },
    statCard: {
        flex: 1,
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
        color: 'var(--text-tertiary)',
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

    // 일반 섹션
    section: {
        padding: '24px 0',
        borderBottom: '8px solid var(--bg-secondary)',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
    },
    sectionTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
    },
    quickGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
    },
    quickCard: {
        backgroundColor: 'var(--bg-secondary)',
        border: 'none',
        borderRadius: '16px',
        padding: '16px',
        textAlign: 'left' as const,
        cursor: 'pointer',
    },
    quickCardHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
    },
    quickCardLabel: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        fontWeight: '600',
    },
    quickCardValue: {
        fontSize: '16px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '4px',
        wordBreak: 'keep-all' as const,
    },
    quickCardMeta: {
        fontSize: '12px',
        color: 'var(--text-tertiary)',
    },

    // 배지
    badgeGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
    },
    badgeItem: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '8px',
    },
    badgeIcon: {
        width: '56px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '28px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
    },
    badgeName: {
        fontSize: '12px',
        fontWeight: '600',
        color: 'var(--text-secondary)',
        textAlign: 'center' as const,
    },
    emptyBadge: {
        textAlign: 'center' as const,
        padding: '40px 20px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
    },
    emptyText: {
        fontSize: '15px',
        color: 'var(--text-tertiary)',
        marginTop: '16px',
        marginBottom: '4px',
    },
    emptySubtext: {
        fontSize: '13px',
        color: 'var(--text-tertiary)',
        margin: 0,
    },

    // 차트
    chartCard: {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '20px',
    },
    emptyChart: {
        textAlign: 'center' as const,
        padding: '40px',
        color: '#9CA3AF',
        fontSize: '14px',
    },

    // 더보기 메뉴
    menuList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    },
    menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '12px',
        textDecoration: 'none',
    },
    menuLabel: {
        flex: 1,
        fontSize: '15px',
        fontWeight: '500',
        color: 'var(--text-primary)',
    },
};

export default MyPage;
