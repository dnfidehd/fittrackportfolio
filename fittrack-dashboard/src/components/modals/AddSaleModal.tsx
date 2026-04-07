import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createSale, updateMember, getProducts, createSaleWithExtension } from '../../services/api';
import { Member } from '../../types';
import { X, ShoppingBag, Calendar, CreditCard, AlertTriangle, Check, Wallet, Banknote, Landmark } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

interface AddSaleModalProps {
  member: Member;
  onClose: () => void;
  onSaleAdded: () => void;
}

interface Product {
  id: number;
  name: string;
  price: number;
  months: number;
  category?: string;
}

const AddSaleModal: React.FC<AddSaleModalProps> = ({ member, onClose, onSaleAdded }) => {
  const [category, setCategory] = useState('membership');
  const [itemName, setItemName] = useState('1개월 회원권');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isPending, setIsPending] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    getProducts().then(res => setProducts(res.data)).catch(err => console.error("상품 로딩 실패", err));
  }, []);

  useEffect(() => {
    if (member.end_date) {
      const end = new Date(member.end_date);
      const today = new Date();
      if (end >= today) { end.setDate(end.getDate() + 1); setStartDate(end.toISOString().split('T')[0]); }
      else setStartDate(today.toISOString().split('T')[0]);
    } else setStartDate(new Date().toISOString().split('T')[0]);
  }, [member]);

  const formatPrice = (value: string | number) => {
    if (!value) return '';
    const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
    return isNaN(num) ? '' : num.toLocaleString();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (!isNaN(Number(rawValue))) setAmount(formatPrice(rawValue));
  };

  const handlePresetClick = (months: number, label: string, price?: number) => {
    setSelectedPreset(months);
    setItemName(label);
    if (price !== undefined) setAmount(formatPrice(price));
    calculateEndDateByMonth(months, startDate);
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setSelectedPreset(-1);
    if (type === 'start') setStartDate(value);
    else setEndDate(value);
  };

  const calculateEndDateByMonth = (months: number, startStr: string) => {
    if (!startStr) return;
    const start = new Date(startStr);
    if (months === 0) setEndDate(startStr);
    else { start.setMonth(start.getMonth() + months); start.setDate(start.getDate() - 1); setEndDate(start.toISOString().split('T')[0]); }
  };

  useEffect(() => {
    if (selectedPreset !== -1 && selectedPreset !== 0) calculateEndDateByMonth(selectedPreset, startDate);
  }, [startDate, selectedPreset]); // eslint-disable-line

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalStatus = isPending ? 'pending' : 'paid';
      const cleanAmount = parseInt(amount.replace(/,/g, ''), 10);

      let categoryLabel = '기타';
      if (category === 'membership') categoryLabel = '회원권';
      else if (category === 'goods') categoryLabel = '운동용품';
      else if (category === 'food') categoryLabel = '음료/간식';

      // -------------------------------------------------------------
      // ✅ [신규] 카드 결제 시: 자동 연장 API 사용 (POS 모드)
      // -------------------------------------------------------------
      if (paymentMethod === 'card' && category === 'membership' && !isPending && selectedPreset > 0) {
        await createSaleWithExtension({
          member_id: member.id,
          item_name: itemName,
          amount: cleanAmount || 0,
          category: categoryLabel,
          payment_method: paymentMethod,
          status: finalStatus,
          extension_months: selectedPreset // 선택된 개월 수 전달
        });
        toast.success(`💳 카드 결제 확인!\n멤버십이 자동으로 ${selectedPreset}개월 연장되었습니다.`);
      }
      // -------------------------------------------------------------
      // ⏪ [기존] 현금/이체/수동/기타: 기존 로직 유지
      // -------------------------------------------------------------
      else {
        await createSale({ member_id: member.id, item_name: itemName, amount: cleanAmount || 0, category: categoryLabel, payment_method: paymentMethod, status: finalStatus });

        // 회원권 연장 (수동 날짜 입력값 신뢰)
        if (category === 'membership' && !isPending) {
          await updateMember(member.id, { membership: itemName, start_date: startDate, end_date: endDate, status: '활성' });
          if (paymentMethod !== 'card') toast.success("현금/이체 등록이 완료되었습니다."); // 카드 외 메시지
        } else if (category === 'membership' && isPending) {
          toast("⚠️ 외상 처리되었습니다.\n(회원권은 자동 연장되지 않았습니다.)");
        } else {
          toast.success("등록되었습니다.");
        }
      }

      onSaleAdded();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("등록 실패: " + (error as any).response?.data?.detail || "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (category === 'membership') return p.category === 'membership' || !p.category;
    return p.category === category;
  });

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* 헤더 */}
        <div style={styles.header}>
          <div style={styles.headerTitleBox}>
            <div style={styles.iconBox}><ShoppingBag size={24} color="#FFFFFF" /></div>
            <h3 style={styles.title}>결제 및 연장</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.scrollArea}>
            {/* 1. 카테고리 선택 */}
            <div style={styles.sectionHeader}>어떤 항목을 결제할까요?</div>
            <div style={styles.categoryGrid}>
              {[
                { id: 'membership', label: '회원권 연장', icon: '🎫' },
                { id: 'goods', label: '운동 용품', icon: '🏋️' },
                { id: 'food', label: '음료/간식', icon: '🥤' },
                { id: 'etc', label: '기타 결제', icon: '🎸' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setCategory(cat.id); setItemName(''); setAmount(''); setSelectedPreset(-1); }}
                  style={category === cat.id ? styles.categoryBtnActive : styles.categoryBtn}
                >
                  <span style={styles.catIcon}>{cat.icon}</span>
                  <span style={styles.catLabel}>{cat.label}</span>
                </button>
              ))}
            </div>

            <div style={styles.divider} />

            {/* 2. 상품 선택 (회원권인 경우) */}
            {category === 'membership' && (
              <>
                <div style={styles.sectionHeader}>이용권 선택</div>
                <div style={styles.gridBtnGroup}>
                  {filteredProducts.length > 0 ? filteredProducts.map(p => (
                    <button key={p.id} type="button" onClick={() => handlePresetClick(p.months || 0, p.name, p.price)}
                      style={itemName === p.name ? styles.activeBtn : styles.btn}>
                      <span style={styles.btnLabel}>{p.name}</span>
                      {itemName === p.name && <Check size={16} />}
                    </button>
                  )) : <div style={styles.emptyText}>등록된 상품이 없습니다.</div>}
                  <button type="button" onClick={() => handlePresetClick(0, '일일권', 20000)} style={itemName === '일일권' ? styles.activeBtn : styles.btn}>
                    <span style={styles.btnLabel}>일일권</span>
                    {itemName === '일일권' && <Check size={16} />}
                  </button>
                </div>
                <div style={styles.dateRow}>
                  <div style={{ flex: 1 }}><label style={styles.subLabel}>시작일</label><input type="date" value={startDate} onChange={e => handleDateChange('start', e.target.value)} style={styles.dateInput} /></div>
                  <div style={{ flex: 1 }}><label style={styles.subLabel}>만기일</label><input type="date" value={endDate} onChange={e => handleDateChange('end', e.target.value)} style={{ ...styles.dateInput, borderColor: selectedPreset === -1 ? TOSS_BLUE : 'var(--border-color)' }} /></div>
                </div>
                <div style={styles.divider} />
              </>
            )}

            {/* 3. 결제 정보 */}
            <div style={styles.sectionHeader}>결제 정보</div>
            <div style={styles.paymentBox}>
              <div style={styles.formGroup}>
                <label style={styles.subLabel}>상품명</label>
                <input value={itemName} onChange={e => setItemName(e.target.value)} style={styles.input} placeholder={category === 'membership' ? "상품을 선택하세요" : "상품명을 입력하세요"} />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.subLabel}>결제 금액</label>
                <div style={styles.amountInputWrapper}>
                  <input type="text" value={amount} onChange={handleAmountChange} style={styles.amountInput} placeholder="0" />
                  <span style={styles.currency}>원</span>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.subLabel}>결제 수단</label>
                <div style={styles.paymentRow}>
                  {[
                    { key: 'card', label: '카드', icon: <CreditCard size={18} /> },
                    { key: 'cash', label: '현금', icon: <Banknote size={18} /> },
                    { key: 'transfer', label: '이체', icon: <Landmark size={18} /> }
                  ].map(opt => (
                    <label key={opt.key} style={{ ...styles.radioLabel, ...(paymentMethod === opt.key ? styles.radioLabelActive : {}) }}>
                      <input type="radio" checked={paymentMethod === opt.key} onChange={() => setPaymentMethod(opt.key)} style={{ display: 'none' }} />
                      <div style={styles.payIconBox}>{opt.icon}</div>
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* 외상 체크 */}
              <label style={{ ...styles.warningLabel, backgroundColor: isPending ? '#FEF2F2' : '#F9FAFB', borderColor: isPending ? '#FECACA' : 'transparent' }}>
                <input type="checkbox" checked={isPending} onChange={e => setIsPending(e.target.checked)} style={styles.checkbox} />
                <span style={{ flex: 1 }}>외상 (미수금)으로 처리하기</span>
                {isPending && <AlertTriangle size={16} color="#DC2626" />}
              </label>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>취소</button>
            <button type="submit" disabled={loading}
              style={{
                ...styles.submitBtn,
                backgroundColor: (paymentMethod === 'card' && category === 'membership' && !isPending) ? '#3182F6' : '#111827'
              }}
            >
              {loading ? '처리 중...' :
                isPending ? '외상 등록완료' :
                  (paymentMethod === 'card' && category === 'membership') ? '💳 카드 결제 확인 (자동 연장)' : '등록 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
  modal: { backgroundColor: 'var(--bg-card)', borderRadius: '28px', width: '100%', maxWidth: '540px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', overflow: 'hidden' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' },
  headerTitleBox: { display: 'flex', alignItems: 'center', gap: '12px' },
  iconBox: { width: '40px', height: '40px', borderRadius: '14px', backgroundColor: TOSS_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px', transition: 'color 0.2s' },

  form: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  scrollArea: { padding: '32px', overflowY: 'auto', flex: 1 },

  sectionHeader: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
  divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '32px 0' },

  categoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' },
  categoryBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-secondary)' },
  categoryBtnActive: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 10px', backgroundColor: 'var(--primary-bg)', border: `1.5px solid ${TOSS_BLUE}`, borderRadius: '16px', cursor: 'pointer', color: TOSS_BLUE },
  catIcon: { fontSize: '24px', marginBottom: '8px' },
  catLabel: { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' },

  gridBtnGroup: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' },
  btn: { padding: '16px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', borderRadius: '16px', cursor: 'pointer', fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  activeBtn: { padding: '16px', border: `1.5px solid ${TOSS_BLUE}`, backgroundColor: 'var(--primary-bg)', color: TOSS_BLUE, borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '20px', paddingRight: '20px' },
  btnLabel: { flex: 1, textAlign: 'center' as const },
  emptyText: { fontSize: '14px', color: 'var(--text-tertiary)', gridColumn: '1 / -1', padding: '12px', textAlign: 'center' },

  dateRow: { display: 'flex', gap: '16px' },
  dateInput: { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', boxSizing: 'border-box', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' },
  subLabel: { fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '6px', display: 'block' },

  paymentBox: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  input: { padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '16px', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },

  amountInputWrapper: { position: 'relative' as const },
  amountInput: { width: '100%', padding: '16px 40px 16px 16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'right', boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--bg-card)' },
  currency: { position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', fontWeight: '600', color: 'var(--text-tertiary)' },

  paymentRow: { display: 'flex', gap: '10px' },
  radioLabel: { flex: 1, padding: '14px', border: '1px solid var(--border-color)', borderRadius: '14px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', textAlign: 'center', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  radioLabelActive: { border: `1.5px solid ${TOSS_BLUE}`, backgroundColor: 'var(--primary-bg)', color: TOSS_BLUE, fontWeight: '700' },
  payIconBox: { display: 'flex', alignItems: 'center' },

  warningLabel: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '16px', border: '1px solid transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '15px', transition: 'all 0.2s' },
  checkbox: { width: '20px', height: '20px', accentColor: '#DC2626', cursor: 'pointer' },

  footer: { padding: '24px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', backgroundColor: 'var(--bg-card)' },
  cancelBtn: { flex: 1, padding: '18px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s' },
  submitBtn: { flex: 2, padding: '18px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)' },
};

export default AddSaleModal;