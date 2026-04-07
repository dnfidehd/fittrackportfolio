import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { createMember, createSale, getProducts } from '../../services/api';
import { X, User, Phone, Calendar, CreditCard, Wallet, Check } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

interface AddMemberModalProps {
  onClose: () => void;
  onMemberAdded: () => void;
}

interface Product {
  id: number;
  name: string;
  price: number;
  months: number;
  category: string;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ onClose, onMemberAdded }) => {
  const [name, setName] = useState('');
  const [phone1, setPhone1] = useState('010');
  const [phone2, setPhone2] = useState('');
  const [phone3, setPhone3] = useState('');
  const phone2Ref = useRef<HTMLInputElement>(null);
  const phone3Ref = useRef<HTMLInputElement>(null);

  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [membershipName, setMembershipName] = useState('1개월권');
  const [status] = useState('활성');
  const [birthDate, setBirthDate] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  useEffect(() => {
    getProducts().then(res => {
      const membershipProducts = res.data.filter((p: Product) => p.category === 'membership' || !p.category);
      setProducts(membershipProducts);
    }).catch(err => console.error("상품 로딩 실패", err));
  }, []);

  const handlePhone1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; setPhone1(val);
    if (val.length === 3) phone2Ref.current?.focus();
  };
  const handlePhone2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; setPhone2(val);
    if (val.length === 4) phone3Ref.current?.focus();
  };

  const formatPrice = (value: string | number) => {
    if (!value) return '';
    const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
    return isNaN(num) ? '' : num.toLocaleString();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (!isNaN(Number(rawValue))) setAmount(formatPrice(rawValue));
  };

  const handleDurationClick = (months: number, label: string, price?: number, productId?: number) => {
    setMembershipName(label);
    if (productId !== undefined) setSelectedProductId(productId);
    else setSelectedProductId(null);
    if (price !== undefined) setAmount(formatPrice(price));

    const start = new Date(startDate);
    if (months === 0) setEndDate(startDate);
    else {
      start.setMonth(start.getMonth() + months);
      start.setDate(start.getDate() - 1);
      setEndDate(start.toISOString().split('T')[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fullPhone = `${phone1}-${phone2}-${phone3}`;
    const defaultPassword = phone3;

    if (!phone3) {
      toast.error("전화번호를 입력해주세요");
      setLoading(false);
      return;
    }

    try {
      const memberRes = await createMember({
        name, phone: fullPhone, password: defaultPassword, status,
        membership: membershipName, start_date: startDate, end_date: endDate,
        role: 'user', birth_date: birthDate || null
      });

      const newMemberId = memberRes.data.id;

      if (amount && newMemberId) {
        const cleanAmount = parseInt(amount.replace(/,/g, ''), 10);
        await createSale({
          member_id: newMemberId, item_name: membershipName, amount: cleanAmount,
          category: '회원권', payment_method: paymentMethod, status: 'paid'
        });
      }

      toast.success("회원 등록 및 결제가 완료되었습니다! 🎉");
      onMemberAdded();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* 헤더 */}
        <div style={styles.header}>
          <div style={styles.headerTitleBox}>
            <div style={styles.iconBox}><User size={24} color="#FFFFFF" /></div>
            <h3 style={styles.title}>신규 회원 등록</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.scrollArea}>
            {/* 1. 기본 정보 */}
            <div style={styles.sectionHeader}>기본 정보</div>
            <div style={styles.section}>
              <div style={styles.formGroup}>
                <label style={styles.label}>이름</label>
                <input placeholder="이름을 입력하세요" value={name} onChange={e => setName(e.target.value)} style={styles.input} required />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>전화번호</label>
                <div style={styles.phoneRow}>
                  <input type="text" value={phone1} onChange={handlePhone1Change} style={{ ...styles.input, flex: 1, textAlign: 'center' }} maxLength={3} />
                  <span style={styles.phoneDash}>-</span>
                  <input type="text" value={phone2} onChange={handlePhone2Change} style={{ ...styles.input, flex: 1.2, textAlign: 'center' }} maxLength={4} ref={phone2Ref} />
                  <span style={styles.phoneDash}>-</span>
                  <input type="text" value={phone3} onChange={(e) => setPhone3(e.target.value)} style={{ ...styles.input, flex: 1.2, textAlign: 'center' }} maxLength={4} ref={phone3Ref} />
                </div>
              </div>
            </div>

            <div style={styles.divider} />

            {/* 2. 이용권 선택 */}
            <div style={styles.sectionHeader}>이용권 선택</div>
            <div style={styles.section}>
              <div style={styles.gridBtnGroup}>
                {products.length > 0 ? products.map(p => (
                  <button key={p.id} type="button" onClick={() => handleDurationClick(p.months, p.name, p.price, p.id)}
                    style={selectedProductId === p.id ? styles.activeBtn : styles.btn}>
                    <span style={styles.btnLabel}>{p.name}</span>
                    {selectedProductId === p.id && <Check size={16} />}
                  </button>
                )) : <span style={styles.emptyText}>등록된 상품이 없습니다.</span>}
                <button type="button" onClick={() => handleDurationClick(0, '일일권', 20000)} style={membershipName === '일일권' ? styles.activeBtn : styles.btn}>
                  <span style={styles.btnLabel}>일일권</span>
                  {membershipName === '일일권' && <Check size={16} />}
                </button>
              </div>

              <div style={styles.dateRow}>
                <div style={{ flex: 1 }}>
                  <label style={styles.subLabel}>시작일</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.dateInput} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.subLabel}>만기일</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.dateInput} />
                </div>
              </div>
            </div>

            <div style={styles.divider} />

            {/* 3. 결제 정보 (선택) */}
            <div style={styles.sectionHeader}>
              결제 정보
              <span style={styles.optionalBadge}>선택</span>
            </div>
            <div style={styles.paymentBox}>
              <div style={styles.formGroup}>
                <label style={styles.subLabel}>결제 금액</label>
                <div style={styles.amountInputWrapper}>
                  <input type="text" placeholder="0" value={amount} onChange={handleAmountChange} style={styles.amountInput} />
                  <span style={styles.currency}>원</span>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.subLabel}>결제 수단</label>
                <div style={styles.paymentRow}>
                  {[{ key: 'card', label: '카드' }, { key: 'cash', label: '현금' }, { key: 'transfer', label: '이체' }].map(opt => (
                    <label key={opt.key} style={{ ...styles.radioLabel, ...(paymentMethod === opt.key ? styles.radioLabelActive : {}) }}>
                      <input type="radio" name="pay" checked={paymentMethod === opt.key} onChange={() => setPaymentMethod(opt.key)} style={{ display: 'none' }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 하단 버튼 (고정) */}
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>취소</button>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? '처리중...' : (amount ? `${amount}원 결제 및 등록` : '회원 등록하기')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
  modal: { backgroundColor: 'var(--bg-card)', borderRadius: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', overflow: 'hidden', boxSizing: 'border-box' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' },
  headerTitleBox: { display: 'flex', alignItems: 'center', gap: '12px' },
  iconBox: { width: '40px', height: '40px', borderRadius: '14px', backgroundColor: TOSS_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px', transition: 'color 0.2s' },

  form: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  scrollArea: { padding: '32px', overflowY: 'auto', flex: 1, width: '100%', boxSizing: 'border-box' },

  section: { display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '8px' },
  sectionHeader: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
  optionalBadge: { fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '6px' },

  divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '32px 0' },

  formGroup: { display: 'flex', flexDirection: 'column', gap: '10px' },
  label: { fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' },
  subLabel: { fontSize: '14px', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '8px' },

  input: { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '16px', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' },

  phoneRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  phoneDash: { color: 'var(--text-tertiary)', fontWeight: '700' },

  gridBtnGroup: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px', width: '100%', boxSizing: 'border-box' },
  btn: { padding: '16px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', borderRadius: '16px', cursor: 'pointer', fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  activeBtn: { padding: '16px', border: `1.5px solid ${TOSS_BLUE}`, backgroundColor: 'var(--primary-bg)', color: TOSS_BLUE, borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '20px', paddingRight: '20px' },
  btnLabel: { flex: 1, textAlign: 'center' as const },
  emptyText: { fontSize: '14px', color: 'var(--text-tertiary)', padding: '12px' },

  dateRow: { display: 'flex', gap: '16px' },
  dateInput: { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', boxSizing: 'border-box', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' },

  paymentBox: { padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' },
  amountInputWrapper: { position: 'relative' as const },
  amountInput: { width: '100%', padding: '16px 40px 16px 16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'right', boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--bg-card)' },
  currency: { position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', fontWeight: '600', color: 'var(--text-tertiary)' },

  paymentRow: { display: 'flex', gap: '10px' },
  radioLabel: { flex: 1, padding: '14px', border: '1px solid var(--border-color)', borderRadius: '14px', cursor: 'pointer', fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', textAlign: 'center', transition: 'all 0.2s' },
  radioLabelActive: { border: `1.5px solid ${TOSS_BLUE}`, backgroundColor: 'var(--primary-bg)', color: TOSS_BLUE, fontWeight: '700' },

  footer: { padding: '24px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', backgroundColor: 'var(--bg-card)', width: '100%', boxSizing: 'border-box' },
  cancelBtn: { flex: 1, padding: '18px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s' },
  submitBtn: { flex: 2, padding: '18px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)' },
};

export default AddMemberModal;