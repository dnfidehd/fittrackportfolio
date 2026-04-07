import React, { useState } from 'react';
import { getTodayAttendance } from '../../services/api';
import { AttendanceResponse } from '../../types';
import { Users, Clock, RefreshCw } from 'lucide-react';
import { useVisiblePolling } from '../../hooks/useVisiblePolling';

const TOSS_BLUE = '#3182F6';

const AttendanceStats: React.FC = () => {
    const [attendances, setAttendances] = useState<AttendanceResponse[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAttendance = async () => {
        try { const response = await getTodayAttendance(); setAttendances(response.data); }
        catch (error) { console.error("출석 명단 로딩 실패:", error); }
        finally { setLoading(false); }
    };

    useVisiblePolling(fetchAttendance, 10000);

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.pageTitle}>오늘의 출석</h1>
                    <p style={styles.subtitle}>{new Date().toLocaleDateString()} 실시간 현황</p>
                </div>
                <div style={styles.countBadge}>
                    <Users size={20} color={TOSS_BLUE} />
                    <span style={styles.countNumber}>{attendances.length}</span>
                    <span style={styles.countLabel}>명 체크인</span>
                </div>
            </div>

            {/* 실시간 표시 */}
            <div style={styles.liveBar}>
                <div style={styles.liveDot}></div>
                <span>실시간 업데이트 중</span>
                <RefreshCw size={14} style={{ animation: 'spin 2s linear infinite', opacity: 0.6 }} />
            </div>

            {/* 출석 리스트 */}
            <div style={styles.tableCard}>
                <table style={styles.table}>
                    <thead>
                        <tr style={styles.tableHeader}>
                            <th style={styles.th}>회원 정보</th>
                            <th style={styles.th}>체크인 시간</th>
                            <th style={styles.th}>상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attendances.length > 0 ? (
                            attendances.map((attr, idx) => (
                                <tr key={idx} style={styles.tr}>
                                    <td style={styles.td}>
                                        <div style={styles.avatarRow}>
                                            <div style={styles.avatar}>{attr.member_name[0]}</div>
                                            <span style={styles.memberName}>{attr.member_name}</span>
                                        </div>
                                    </td>
                                    <td style={styles.td}>
                                        <div style={styles.timeBox}>
                                            <Clock size={16} color="#8B95A1" />
                                            {new Date(attr.check_in_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td style={styles.td}>
                                        <span style={styles.statusBadge}>출석 완료</span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={3} style={styles.emptyCell}>{loading ? "데이터를 불러오는 중..." : "아직 출석한 회원이 없어요"}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '32px', minHeight: '100vh', backgroundColor: 'var(--bg-main)', fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif', transition: 'background-color 0.3s' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    pageTitle: { fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, marginBottom: '6px' },
    subtitle: { fontSize: '16px', color: 'var(--text-tertiary)', fontWeight: '500' },

    countBadge: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', boxShadow: 'var(--shadow)' },
    countNumber: { fontSize: '24px', fontWeight: '800', color: 'var(--primary)' },
    countLabel: { fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '600' },

    liveBar: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' },
    liveDot: { width: '8px', height: '8px', backgroundColor: '#10B981', borderRadius: '50%', animation: 'pulse 2s infinite' },

    tableCard: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' },
    table: { width: '100%', borderCollapse: 'separate' as const, borderSpacing: 0 },
    tableHeader: { backgroundColor: 'var(--bg-secondary)' },
    th: { padding: '16px 24px', textAlign: 'left' as const, fontSize: '14px', fontWeight: '600', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-color)' },
    tr: { transition: 'background-color 0.2s' },
    td: { padding: '18px 24px', fontSize: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' },

    avatarRow: { display: 'flex', alignItems: 'center', gap: '14px' },
    avatar: { width: '42px', height: '42px', borderRadius: '18px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700' },
    memberName: { fontWeight: '600', color: 'var(--text-primary)' },

    timeBox: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '15px' },
    statusBadge: { padding: '6px 12px', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
    emptyCell: { padding: '80px', textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: '16px' },
};

export default AttendanceStats;
