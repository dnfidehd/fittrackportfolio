import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { createOrUpdatePR } from '../../services/api';
import { X, Trophy, Dumbbell, Calendar, Medal } from 'lucide-react';

const TOSS_GOLD = '#F59E0B';
const TOSS_BLUE = '#3182F6';

interface AddPRModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const AddPRModal: React.FC<AddPRModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [exercise, setExercise] = useState('Back Squat');
    const [recordValue, setRecordValue] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    const commonExercises = [
        'Back Squat', 'Front Squat', 'Overhead Squat',
        'Deadlift', 'Clean', 'Jerk', 'Clean & Jerk', 'Snatch',
        'Bench Press', 'Strict Press', 'Push Press'
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recordValue) { toast.error("기록을 입력해주세요."); return; }

        setLoading(true);
        try {
            await createOrUpdatePR({ exercise_name: exercise, record_value: recordValue, recorded_date: date });
            toast.success("기록이 저장되었습니다! 🎉");
            onSuccess();
            onClose();
            setRecordValue('');
        } catch (error) {
            console.error("PR 저장 실패:", error);
            toast.error("저장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                {/* 헤더 */}
                <div style={styles.header}>
                    <div style={styles.headerTitleBox}>
                        <div style={styles.iconBox}><Trophy size={24} color="#FFFFFF" /></div>
                        <h3 style={styles.title}>신기록 달성!</h3>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.content}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}><Dumbbell size={16} /> 종목 선택</label>
                            <select value={exercise} onChange={(e) => setExercise(e.target.value)} style={styles.select}>
                                {commonExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                            </select>
                        </div>

                        <div style={styles.recordCard}>
                            <label style={styles.cardLabel}>새로운 기록 (PR)</label>
                            <div style={styles.inputWrapper}>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={recordValue}
                                    onChange={(e) => setRecordValue(e.target.value)}
                                    placeholder="0"
                                    style={styles.largeInput}
                                    required
                                />
                                <span style={styles.unitText}>kg</span>
                            </div>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}><Calendar size={16} /> 달성 날짜</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.dateInput} required />
                        </div>
                    </div>

                    <div style={styles.footer}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn}>취소</button>
                        <button type="submit" disabled={loading} style={styles.submitBtn}>
                            {loading ? '저장 중...' : '기록 저장하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
    modal: { backgroundColor: 'var(--bg-card)', borderRadius: '28px', width: '100%', maxWidth: '400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', overflow: 'hidden' },

    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' },
    headerTitleBox: { display: 'flex', alignItems: 'center', gap: '12px' },
    iconBox: { width: '40px', height: '40px', borderRadius: '14px', backgroundColor: TOSS_GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    title: { margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px', transition: 'color 0.2s' },

    form: { display: 'flex', flexDirection: 'column', flex: 1 },
    content: { padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' },

    formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' },
    select: { width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '16px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', appearance: 'none' },

    recordCard: { backgroundColor: 'var(--warning-bg)', borderRadius: '20px', padding: '24px', textAlign: 'center' as const, border: `1px solid var(--warning-border)` },
    cardLabel: { fontSize: '13px', fontWeight: '700', color: 'var(--warning-text)', display: 'block', marginBottom: '8px' },
    inputWrapper: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
    largeInput: { fontSize: '48px', fontWeight: '800', color: 'var(--warning-text)', width: '140px', textAlign: 'center' as const, border: 'none', background: 'transparent', outline: 'none' },
    unitText: { fontSize: '24px', fontWeight: '700', color: 'var(--warning-text)', marginTop: '12px' },

    dateInput: { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },

    footer: { padding: '24px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', backgroundColor: 'var(--bg-card)' },
    cancelBtn: { flex: 1, padding: '18px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s' },
    submitBtn: { flex: 2, padding: '18px', backgroundColor: TOSS_GOLD, color: '#FFFFFF', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' },
};

export default AddPRModal;