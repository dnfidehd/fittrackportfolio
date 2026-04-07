import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { createExpense } from '../../services/api';
import { X, Receipt, Calendar, CreditCard, FileText, Banknote, Landmark } from 'lucide-react';

const TOSS_RED = '#EF4444';

interface AddExpenseModalProps {
    onClose: () => void;
    onExpenseAdded: () => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ onClose, onExpenseAdded }) => {
    const [itemName, setItemName] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('고정지출');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [method, setMethod] = useState('card');
    const [memo, setMemo] = useState('');
    const [loading, setLoading] = useState(false);

    const formatPrice = (value: string | number) => {
        if (!value) return '';
        const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
        return isNaN(num) ? '' : num.toLocaleString();
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/,/g, '');
        if (!isNaN(Number(rawValue))) setAmount(formatPrice(rawValue));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName || !amount) {
            toast.error("항목명과 금액을 입력해주세요.");
            return;
        }

        setLoading(true);
        try {
            const cleanAmount = parseInt(amount.replace(/,/g, ''), 10);
            await createExpense({ item_name: itemName, amount: cleanAmount, category, date, method, memo });
            toast.success("지출이 등록되었습니다! 💸");
            onExpenseAdded();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("등록 실패");
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        { value: '고정지출', label: '고정지출', icon: '🏢' },
        { value: '운영비', label: '운영비', icon: '⚡' },
        { value: '인건비', label: '인건비', icon: '👥' },
        { value: '비품/장비', label: '비품/장비', icon: '🏋️' },
        { value: '마케팅', label: '마케팅', icon: '📢' },
        { value: '회식/식대', label: '회식/식대', icon: '🍕' },
        { value: '기타', label: '기타', icon: '🎸' },
    ];

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                {/* 헤더 */}
                <div style={styles.header}>
                    <div style={styles.headerTitleBox}>
                        <div style={styles.iconBox}><Receipt size={24} color="#FFFFFF" /></div>
                        <h3 style={styles.title}>지출 등록</h3>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.scrollArea}>
                        {/* 1. 기본 정보 */}
                        <div style={styles.sectionHeader}>날짜 및 분류</div>
                        <div style={styles.row}>
                            <div style={{ flex: 1 }}>
                                <label style={styles.subLabel}>지출 날짜</label>
                                <div style={styles.inputWrapper}>
                                    <Calendar size={18} color="var(--text-tertiary)" style={styles.inputIcon} />
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={styles.inputWithIcon} />
                                </div>
                            </div>
                        </div>

                        <div style={{ ...styles.formGroup, marginTop: '16px' }}>
                            <label style={styles.subLabel}>카테고리</label>
                            <div style={styles.categoryGrid}>
                                {categories.map(cat => (
                                    <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                                        style={category === cat.value ? styles.activeCatBtn : styles.catBtn}>
                                        <span style={styles.catIcon}>{cat.icon}</span>
                                        <span style={styles.catLabel}>{cat.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={styles.divider} />

                        {/* 2. 지출 상세 */}
                        <div style={styles.sectionHeader}>지출 상세</div>
                        <div style={styles.card}>
                            <div style={styles.formGroup}>
                                <label style={styles.subLabel}>지출 내역</label>
                                <input placeholder="예: 1월 월세, 쿠팡 생수 구입" value={itemName} onChange={e => setItemName(e.target.value)} style={styles.input} required />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.subLabel}>지출 금액</label>
                                <div style={styles.amountInputWrapper}>
                                    <input type="text" value={amount} onChange={handleAmountChange} style={styles.amountInput} placeholder="0" required />
                                    <span style={styles.currency}>원</span>
                                </div>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.subLabel}>결제 수단</label>
                                <div style={styles.paymentRow}>
                                    {[
                                        { key: 'card', label: '카드', icon: <CreditCard size={18} /> },
                                        { key: 'transfer', label: '이체', icon: <Landmark size={18} /> },
                                        { key: 'cash', label: '현금', icon: <Banknote size={18} /> }
                                    ].map(opt => (
                                        <label key={opt.key} style={{ ...styles.radioLabel, ...(method === opt.key ? styles.radioLabelActive : {}) }}>
                                            <input type="radio" checked={method === opt.key} onChange={() => setMethod(opt.key)} style={{ display: 'none' }} />
                                            <div style={styles.payIconBox}>{opt.icon}</div>
                                            {opt.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.subLabel}>메모 (선택)</label>
                                <input value={memo} onChange={e => setMemo(e.target.value)} style={styles.input} placeholder="특이사항 입력" />
                            </div>
                        </div>
                    </div>

                    {/* 버튼 */}
                    <div style={styles.footer}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn}>취소</button>
                        <button type="submit" disabled={loading} style={styles.submitBtn}>
                            {loading ? '처리 중...' : '지출 등록 완료'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
    modal: { backgroundColor: 'var(--bg-card)', borderRadius: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', overflow: 'hidden' },

    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' },
    headerTitleBox: { display: 'flex', alignItems: 'center', gap: '12px' },
    iconBox: { width: '40px', height: '40px', borderRadius: '14px', backgroundColor: TOSS_RED, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    title: { margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px', transition: 'color 0.2s' },

    form: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
    scrollArea: { padding: '32px', overflowY: 'auto', flex: 1 },

    sectionHeader: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
    divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '32px 0' },

    row: { display: 'flex', gap: '16px' },
    subLabel: { fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '6px', display: 'block' },

    inputWrapper: { position: 'relative' as const, width: '100%' },
    inputIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' },
    inputWithIcon: { width: '100%', padding: '14px 14px 14px 44px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', transition: 'all 0.2s' },

    categoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' },
    catBtn: { padding: '12px 6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', borderRadius: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.2s', color: 'var(--text-secondary)' },
    activeCatBtn: { padding: '12px 6px', border: `1.5px solid ${TOSS_RED}`, backgroundColor: 'var(--danger-bg)', borderRadius: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--danger)' },
    catIcon: { fontSize: '20px' },
    catLabel: { fontSize: '12px', fontWeight: '600' },

    card: { padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    input: { padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '16px', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' },

    amountInputWrapper: { position: 'relative' as const },
    amountInput: { width: '100%', padding: '16px 40px 16px 16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '20px', fontWeight: '700', color: 'var(--danger)', textAlign: 'right', boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--bg-card)' },
    currency: { position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', fontWeight: '600', color: 'var(--text-tertiary)' },

    paymentRow: { display: 'flex', gap: '10px' },
    radioLabel: { flex: 1, padding: '14px', border: '1px solid var(--border-color)', borderRadius: '14px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', textAlign: 'center', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    radioLabelActive: { border: `1.5px solid ${TOSS_RED}`, backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', fontWeight: '700' },
    payIconBox: { display: 'flex', alignItems: 'center' },

    footer: { padding: '24px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', backgroundColor: 'var(--bg-card)' },
    cancelBtn: { flex: 1, padding: '18px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s' },
    submitBtn: { flex: 2, padding: '18px', backgroundColor: TOSS_RED, color: '#FFFFFF', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' },
};

export default AddExpenseModal;