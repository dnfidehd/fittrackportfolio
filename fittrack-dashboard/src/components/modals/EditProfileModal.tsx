import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';
import { X, User, Phone, Target, Lock, Ruler, Weight, Dna } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

interface EditProfileModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose, onSuccess }) => {
    const { refreshUser } = useAppContext();
    const [name, setName] = useState('');
    const [phonePart1, setPhonePart1] = useState('');
    const [phonePart2, setPhonePart2] = useState('');
    const [phonePart3, setPhonePart3] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [gender, setGender] = useState('남성');
    const [workoutGoal, setWorkoutGoal] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        api.get('/api/members/me').then(res => {
            const u = res.data;
            setName(u.name || '');
            if (u.phone) {
                const p = u.phone.replace(/[^0-9]/g, '');
                setPhonePart1(p.slice(0, 3));
                setPhonePart2(p.slice(3, 7));
                setPhonePart3(p.slice(7, 11));
            }
            setHeight(u.height ? String(u.height) : '');
            setWeight(u.weight ? String(u.weight) : '');
            setGender(u.gender || '남성');
            setWorkoutGoal(u.workout_goal || '');
        }).catch(e => console.error(e)).finally(() => setDataLoading(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password && password !== confirmPassword) { toast.error("비밀번호가 일치하지 않습니다."); return; }
        const fullPhone = `${phonePart1}-${phonePart2}-${phonePart3}`;
        if (fullPhone.length < 12) { toast.error("전화번호를 올바르게 입력해주세요."); return; }

        setLoading(true);
        try {
            const payload: any = { name, phone: fullPhone, height: height ? parseFloat(height) : null, weight: weight ? parseFloat(weight) : null, gender, workout_goal: workoutGoal };
            if (password) payload.password = password;
            if (password) payload.password = password;
            await api.put('/api/members/me/profile', payload);
            await refreshUser(); // ✅ 전역 상태 및 로컬 스토리지 동기화
            toast.success("프로필이 업데이트되었습니다! ✨");
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "수정 실패");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <div style={styles.headerTitleBox}>
                        <div style={styles.iconBox}><User size={24} color="#FFFFFF" /></div>
                        <h3 style={styles.title}>내 정보 수정</h3>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
                </div>

                {dataLoading ? <div style={styles.spinner}></div> : (
                    <form onSubmit={handleSubmit} style={styles.form}>
                        <div style={styles.scrollArea}>
                            {/* 기본 정보 */}
                            <div style={styles.sectionHeader}>기본 정보</div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>이름 <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 'normal' }}>(수정 불가)</span></label>
                                <div style={styles.inputWrapper}>
                                    <Lock size={16} color="#9CA3AF" style={styles.inputIcon} />
                                    <input
                                        value={name}
                                        readOnly
                                        style={{ ...styles.inputWithIcon, backgroundColor: '#F3F4F6', color: '#6B7280', cursor: 'not-allowed' }}
                                        title="실명제 정책에 따라 이름은 변경할 수 없습니다."
                                    />
                                </div>
                                <span style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>* 실명제 정책에 따라 이름은 직접 변경할 수 없습니다.</span>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>전화번호</label>
                                <div style={styles.phoneRow}>
                                    <input value={phonePart1} onChange={e => setPhonePart1(e.target.value.slice(0, 3))} style={{ ...styles.input, textAlign: 'center' }} maxLength={3} />
                                    <span style={styles.phoneDash}>-</span>
                                    <input value={phonePart2} onChange={e => setPhonePart2(e.target.value.slice(0, 4))} style={{ ...styles.input, textAlign: 'center' }} maxLength={4} />
                                    <span style={styles.phoneDash}>-</span>
                                    <input value={phonePart3} onChange={e => setPhonePart3(e.target.value.slice(0, 4))} style={{ ...styles.input, textAlign: 'center' }} maxLength={4} />
                                </div>
                            </div>

                            <div style={styles.divider} />

                            {/* AI 코칭 정보 */}
                            <div style={styles.sectionHeader}>
                                AI 코칭 맞춤 정보
                                <span style={styles.badge}>중요</span>
                            </div>
                            <div style={styles.card}>
                                <div style={styles.row}>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.subLabel}><Ruler size={14} /> 키 (cm)</label>
                                        <input type="number" placeholder="예: 175" value={height} onChange={e => setHeight(e.target.value)} style={styles.input} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.subLabel}><Weight size={14} /> 몸무게 (kg)</label>
                                        <input type="number" placeholder="예: 70" value={weight} onChange={e => setWeight(e.target.value)} style={styles.input} />
                                    </div>
                                </div>
                                <div style={styles.row}>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.subLabel}><Dna size={14} /> 성별</label>
                                        <select value={gender} onChange={e => setGender(e.target.value)} style={styles.select}>
                                            <option value="남성">남성</option>
                                            <option value="여성">여성</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.subLabel}><Target size={14} /> 운동 목표</label>
                                        <input placeholder="예: 3대 500" value={workoutGoal} onChange={e => setWorkoutGoal(e.target.value)} style={styles.input} />
                                    </div>
                                </div>
                            </div>

                            <div style={styles.divider} />

                            {/* 비밀번호 변경 */}
                            <div style={styles.sectionHeader}>비밀번호 변경 (선택)</div>
                            <div style={styles.pwSection}>
                                <div style={styles.inputWrapper}>
                                    <Lock size={18} color="var(--text-tertiary)" style={styles.inputIcon} />
                                    <input type="password" placeholder="새 비밀번호 입력" value={password} onChange={e => setPassword(e.target.value)} style={styles.inputWithIcon} />
                                </div>
                                {password && (
                                    <div style={styles.inputWrapper}>
                                        <Lock size={18} color={password === confirmPassword ? TOSS_BLUE : "var(--text-tertiary)"} style={styles.inputIcon} />
                                        <input type="password" placeholder="새 비밀번호 확인" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={styles.inputWithIcon} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 버튼 */}
                        <div style={styles.footer}>
                            <button type="button" onClick={onClose} style={styles.cancelBtn}>취소</button>
                            <button type="submit" disabled={loading} style={styles.submitBtn}>
                                {loading ? '저장 중...' : '저장하기'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
    modal: { backgroundColor: 'var(--bg-card)', borderRadius: '28px', width: '100%', maxWidth: '460px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', overflow: 'hidden' },

    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' },
    headerTitleBox: { display: 'flex', alignItems: 'center', gap: '12px' },
    iconBox: { width: '40px', height: '40px', borderRadius: '14px', backgroundColor: TOSS_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    title: { margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px', transition: 'color 0.2s' },

    form: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
    scrollArea: { padding: '32px', overflowY: 'auto', flex: 1 },
    spinner: { width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTop: `3px solid ${TOSS_BLUE}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '40px auto' },

    sectionHeader: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
    badge: { fontSize: '12px', fontWeight: '600', color: '#D97706', backgroundColor: 'var(--warning-bg)', padding: '4px 8px', borderRadius: '6px' },
    divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '24px 0' },

    formGroup: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
    label: { fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' },
    input: { width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
    select: { width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' },

    inputWrapper: { position: 'relative' as const, width: '100%' },
    inputIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' },
    inputWithIcon: { width: '100%', padding: '14px 14px 14px 44px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', transition: 'all 0.2s' },

    phoneRow: { display: 'flex', alignItems: 'center', gap: '10px' },
    phoneDash: { color: 'var(--text-tertiary)', fontWeight: '700' },

    card: { padding: '20px', backgroundColor: 'var(--warning-bg)', borderRadius: '20px', border: '1px solid var(--warning-border)', display: 'flex', flexDirection: 'column', gap: '16px' },
    row: { display: 'flex', gap: '12px' },
    subLabel: { fontSize: '13px', fontWeight: '600', color: 'var(--warning-text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' },

    pwSection: { display: 'flex', flexDirection: 'column', gap: '12px' },

    footer: { padding: '24px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', backgroundColor: 'var(--bg-card)' },
    cancelBtn: { flex: 1, padding: '18px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s' },
    submitBtn: { flex: 2, padding: '18px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)' },
};

export default EditProfileModal;