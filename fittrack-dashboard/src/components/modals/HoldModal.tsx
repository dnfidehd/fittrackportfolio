import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { X, PauseCircle, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

const TOSS_BLUE = '#3182F6';
const TOSS_WARN = '#F59E0B';

interface HoldModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const HoldModal: React.FC<HoldModalProps> = ({ onClose, onSuccess }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [holdLimit, setHoldLimit] = useState({ max: 0, used: 0, remaining: 0 });
    const [limitLoading, setLimitLoading] = useState(true);

    useEffect(() => {
        const fetchLimit = async () => {
            try {
                const res = await api.get('/api/members/me/hold-status');
                setHoldLimit({ max: res.data.max_days, used: res.data.used_days, remaining: res.data.remaining_days });
            } catch (e) {
                console.error("홀딩 정보 로드 실패");
            } finally {
                setLimitLoading(false);
            }
        };
        fetchLimit();
    }, []);

    const getDays = () => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = end.getTime() - start.getTime();
        const days = diff / (1000 * 3600 * 24) + 1;
        return days > 0 ? days : 0;
    };

    const requestDays = getDays();
    const isOverLimit = requestDays > holdLimit.remaining;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isOverLimit) { toast.error("잔여 홀딩 일수를 초과했습니다."); return; }
        if (requestDays <= 0) { toast.error("날짜를 올바르게 선택해주세요."); return; }

        if (window.confirm(`총 ${requestDays}일간 홀딩하시겠습니까?\n(회원권이 ${requestDays}일 연장됩니다)`)) {
            setLoading(true);
            try {
                await api.post('/api/members/me/hold', { start_date: startDate, end_date: endDate });
                toast.success("홀딩 처리가 완료되었습니다! 푹 쉬고 오세요 💪");
                onSuccess();
                onClose();
            } catch (error: any) {
                const msg = error.response?.data?.detail || "실패했습니다.";
                toast.error(msg);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                {/* 헤더 */}
                <div style={styles.header}>
                    <div style={styles.headerTitleBox}>
                        <div style={styles.iconBox}><PauseCircle size={24} color="#FFFFFF" /></div>
                        <h3 style={styles.title}>홀딩 신청</h3>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
                </div>

                {/* 잔여 한도 카드 */}
                <div style={styles.limitCard}>
                    {limitLoading ? <div style={styles.spinner}></div> : (
                        <>
                            <div style={styles.limitLabel}>나의 잔여 홀딩 일수</div>
                            <div style={styles.limitValue}>
                                {holdLimit.remaining}<span style={styles.limitUnit}>일</span>
                            </div>
                            <div style={styles.limitSub}>
                                총 {holdLimit.max}일 중 <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>{holdLimit.used}일 사용 완료</span>
                            </div>
                        </>
                    )}
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.dateSection}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>시작일 (내일부터)</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.input} required />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>종료일 (복귀 전날)</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.input} required />
                        </div>
                    </div>

                    {/* 실시간 피드백 */}
                    <div style={{
                        ...styles.feedbackCard,
                        backgroundColor: requestDays > 0 ? (isOverLimit ? 'var(--danger-bg)' : 'var(--primary-bg)') : 'var(--bg-secondary)',
                        borderColor: requestDays > 0 ? (isOverLimit ? 'var(--danger-border)' : 'var(--primary-border)') : 'var(--border-color)',
                        color: requestDays > 0 ? (isOverLimit ? 'var(--danger)' : 'var(--primary)') : 'var(--text-tertiary)'
                    }}>
                        {requestDays > 0 ? (
                            isOverLimit ? (
                                <><AlertCircle size={20} /><span style={styles.feedbackText}>신청 불가! ({requestDays - holdLimit.remaining}일 초과)</span></>
                            ) : (
                                <><CheckCircle size={20} /><span style={styles.feedbackText}>{requestDays}일 홀딩 신청 가능</span></>
                            )
                        ) : (
                            <span style={styles.feedbackText}>날짜를 선택해주세요</span>
                        )}
                    </div>

                    <div style={styles.buttonRow}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn}>취소</button>
                        <button type="submit" disabled={loading || isOverLimit || requestDays <= 0}
                            style={{ ...styles.submitBtn, backgroundColor: (loading || isOverLimit || requestDays <= 0) ? 'var(--bg-secondary)' : TOSS_WARN, color: (loading || isOverLimit || requestDays <= 0) ? 'var(--text-tertiary)' : '#FFFFFF', cursor: (loading || isOverLimit || requestDays <= 0) ? 'not-allowed' : 'pointer', boxShadow: (loading || isOverLimit || requestDays <= 0) ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.2)' }}>
                            {loading ? '처리 중...' : '홀딩 신청하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
    modal: { backgroundColor: 'var(--bg-card)', borderRadius: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', overflow: 'hidden' },

    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' },
    headerTitleBox: { display: 'flex', alignItems: 'center', gap: '12px' },
    iconBox: { width: '40px', height: '40px', borderRadius: '14px', backgroundColor: TOSS_WARN, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    title: { margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px', transition: 'color 0.2s' },

    limitCard: { margin: '24px 24px 0', padding: '32px', backgroundColor: 'var(--warning-bg)', borderRadius: '24px', textAlign: 'center' as const, border: '1px solid var(--warning-border)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' },
    limitLabel: { fontSize: '14px', fontWeight: '600', color: 'var(--warning-text)' },
    limitValue: { fontSize: '42px', fontWeight: '800', color: 'var(--warning-text)', lineHeight: 1, fontFamily: 'monospace' },
    limitUnit: { fontSize: '20px', fontWeight: '700', marginLeft: '4px' },
    limitSub: { fontSize: '13px', color: 'var(--warning-text)', opacity: 0.8, marginTop: '4px' },
    spinner: { width: '24px', height: '24px', border: '3px solid var(--warning-border)', borderTop: '3px solid var(--warning-text)', borderRadius: '50%', animation: 'spin 1s linear infinite' },

    form: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    dateSection: { display: 'flex', gap: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
    label: { fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' },
    input: { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },

    feedbackCard: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', borderRadius: '16px', border: '1px solid', fontWeight: '700', fontSize: '15px', transition: 'all 0.2s' },
    feedbackText: { display: 'flex', alignItems: 'center', gap: '6px' },

    buttonRow: { display: 'flex', gap: '12px', marginTop: '8px' },
    cancelBtn: { flex: 1, padding: '18px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s' },
    submitBtn: { flex: 2, padding: '18px', border: 'none', borderRadius: '18px', fontWeight: '700', fontSize: '16px', transition: 'all 0.2s' },
};

export default HoldModal;