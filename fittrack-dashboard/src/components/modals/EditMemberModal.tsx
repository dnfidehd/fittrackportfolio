import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { updateMember } from '../../services/api';
import { Member } from '../../types';
import { X, User, Phone, Settings, Activity, Calendar, Gauge } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

interface EditMemberModalProps {
  member: Member;
  onClose: () => void;
  onMemberUpdated: () => void;
}

const EditMemberModal: React.FC<EditMemberModalProps> = ({ member, onClose, onMemberUpdated }) => {
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [status, setStatus] = useState(member.status);
  const [role, setRole] = useState(member.role || 'user');
  const [gender, setGender] = useState(member.gender || '');
  const [birthDate, setBirthDate] = useState(member.birth_date || '');
  const [height, setHeight] = useState(member.height || '');
  const [weight, setWeight] = useState(member.weight || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateMember(member.id, {
        name, phone, status, role,
        gender: gender || null,
        birth_date: birthDate || null,
        height: height ? parseFloat(String(height)) : null,
        weight: weight ? parseFloat(String(weight)) : null
      });
      toast.success("회원 정보가 수정되었습니다.");
      onMemberUpdated();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("수정 실패");
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
            <div style={styles.iconBox}><Settings size={24} color="#FFFFFF" /></div>
            <h3 style={styles.title}>회원 정보 수정</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.scrollArea}>
            {/* 기본 정보 */}
            <div style={styles.sectionHeader}>기본 정보</div>
            <div style={styles.section}>
              <div style={styles.formGroup}>
                <label style={styles.label}>이름</label>
                <div style={styles.inputWrapper}>
                  <User size={18} color="#9CA3AF" style={styles.inputIcon} />
                  <input value={name} onChange={e => setName(e.target.value)} style={styles.inputWithIcon} required />
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>전화번호</label>
                <div style={styles.inputWrapper}>
                  <Phone size={18} color="#9CA3AF" style={styles.inputIcon} />
                  <input value={phone} onChange={e => setPhone(e.target.value)} style={styles.inputWithIcon} required />
                </div>
              </div>
            </div>

            <div style={styles.divider} />

            {/* 관리 설정 */}
            <div style={styles.sectionHeader}>관리 설정</div>
            <div style={styles.card}>
              <div style={styles.row}>
                <div style={{ flex: 1 }}>
                  <label style={styles.subLabel}>상태</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={styles.select}>
                    <option value="활성">🟢 활성</option>
                    <option value="비활성">⚪ 비활성</option>
                    <option value="만료">🔴 만료</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.subLabel}>권한</label>
                  <select value={role} onChange={e => setRole(e.target.value)} style={styles.select}>
                    <option value="user">일반 회원</option>
                    <option value="subcoach">서브코치</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={styles.divider} />

            {/* 상세 정보 */}
            <div style={styles.sectionHeader}>
              상세 정보
              <span style={styles.optionalBadge}>선택</span>
            </div>
            <div style={styles.card}>
              <div style={styles.row}>
                <div style={{ flex: 1 }}>
                  <label style={styles.subLabel}>성별</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} style={styles.select}>
                    <option value="">선택 안함</option>
                    <option value="M">남성</option>
                    <option value="F">여성</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.subLabel}>생년월일</label>
                  <div style={styles.inputWrapper}>
                    <Calendar size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={styles.inputWithIcon} />
                  </div>
                </div>
              </div>

              <div style={styles.row}>
                <div style={{ flex: 1 }}>
                  <label style={styles.subLabel}>키 (cm)</label>
                  <div style={styles.inputWrapper}>
                    <Gauge size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <input type="number" placeholder="175" value={height} onChange={e => setHeight(e.target.value)} style={styles.inputWithIcon} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.subLabel}>몸무게 (kg)</label>
                  <div style={styles.inputWrapper}>
                    <Gauge size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <input type="number" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} style={styles.inputWithIcon} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>취소</button>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
  modal: { backgroundColor: 'var(--bg-card)', borderRadius: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', overflow: 'hidden' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' },
  headerTitleBox: { display: 'flex', alignItems: 'center', gap: '12px' },
  iconBox: { width: '40px', height: '40px', borderRadius: '14px', backgroundColor: TOSS_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px', transition: 'color 0.2s' },

  form: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  scrollArea: { padding: '32px', overflowY: 'auto', flex: 1 },

  section: { display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '8px' },
  sectionHeader: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
  optionalBadge: { fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '6px' },

  divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '32px 0' },

  formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' },
  subLabel: { fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '6px', display: 'block' },

  inputWrapper: { position: 'relative' as const, width: '100%' },
  inputIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' },
  inputWithIcon: { width: '100%', padding: '14px 14px 14px 44px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', transition: 'all 0.2s' },

  select: { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', backgroundColor: 'var(--bg-card)', boxSizing: 'border-box', color: 'var(--text-primary)', outline: 'none' },

  card: { padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid var(--border-color)' },
  row: { display: 'flex', gap: '16px' },

  footer: { padding: '24px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', backgroundColor: 'var(--bg-card)' },
  cancelBtn: { flex: 1, padding: '18px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s' },
  submitBtn: { flex: 2, padding: '18px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)' },
};

export default EditMemberModal;