import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { checkIn, getMyInfo } from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';

// ✅ 환영 메시지용 데이터 타입
interface WelcomeData {
  name: string;
  daysRemaining: number | null;
  endDate: string | null;
}

const CheckInPage: React.FC = () => {
  const { user, setUser } = useAppContext();
  const navigate = useNavigate();

  const [phoneLast4, setPhoneLast4] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [welcomeData, setWelcomeData] = useState<WelcomeData | null>(null);

  // ✅ 중복 회원 처리용 상태
  const [duplicateMembers, setDuplicateMembers] = useState<any[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // 1. 보안 및 유저 정보 복구
  useEffect(() => {
    const initialize = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error("관리자 로그인이 필요합니다.");
        navigate('/login');
        return;
      }
      if (!user) {
        try {
          const response = await getMyInfo();
          setUser(response.data);
        } catch (error) {
          toast.error("로그인 세션이 만료되었습니다.");
          navigate('/login');
        }
      }
      setInitializing(false);
    };
    initialize();
  }, [user, navigate, setUser]);

  // ✅ 10초 타이머
  useEffect(() => {
    if (welcomeData) {
      const timer = setTimeout(() => {
        setWelcomeData(null);
        setPhoneLast4('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [welcomeData]);

  // --- 핸들러 ---
  const handleNumberClick = (num: string) => {
    if (phoneLast4.length < 4) setPhoneLast4((prev) => prev + num);
  };

  const handleDelete = () => setPhoneLast4((prev) => prev.slice(0, -1));

  const handleClear = () => {
    setPhoneLast4('');
    setWelcomeData(null);
  };

  const handleCheckIn = async (memberId?: number) => {
    if (phoneLast4.length !== 4) return;
    setLoading(true);

    try {
      // memberId가 있으면(재요청) 포함해서 보냄
      const payload = memberId
        ? { phone_last4: phoneLast4, member_id: memberId }
        : { phone_last4: phoneLast4 };

      const response = await checkIn(payload);

      setWelcomeData({
        name: response.data.member_name,
        daysRemaining: response.data.days_remaining,
        endDate: response.data.end_date
      });
      setPhoneLast4('');
      setShowDuplicateModal(false); // 모달 닫기
      setDuplicateMembers([]);

    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 404) {
        toast.error("회원 정보를 찾을 수 없습니다.");
        setPhoneLast4('');
      } else if (err.response?.status === 409) {
        // ✅ 중복 회원 발생
        setDuplicateMembers(err.response.data.duplicates);
        setShowDuplicateModal(true);
      } else {
        toast.error(err.response?.data?.detail || "출석 체크 실패. 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ 상태별 색상 (Light Mode)
  const getStatusInfo = (days: number | null) => {
    if (days === null) return { color: '#B0B8C1', text: '기간 정보 없음' };
    if (days < 0) return { color: '#EF4444', text: `만료됨 (D+${Math.abs(days)})` };
    if (days <= 7) return { color: '#F59E0B', text: `만료 임박 (D-${days})` };
    return { color: '#10B981', text: `이용 중 (D-${days})` };
  };

  if (initializing) return <div style={{ height: '100vh', background: '#F2F4F6', color: '#191F28', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>로딩 중...</div>;
  if (!user) return null;

  return (
    <div style={styles.container}>

      {/* 왼쪽: 키패드 영역 */}
      <div style={styles.leftPanel}>
        <div style={styles.leftPanelContent}>
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', margin: 0, color: '#191F28', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              FitTrack<span style={{ color: '#3182F6' }}>.AI</span>
            </h1>
            <p style={{ color: '#8B95A1', marginTop: '4px', fontSize: '15px' }}>
              {user.name} 코치님의 지점
            </p>
          </div>

          {/* 번호 표시 화면 */}
          <div style={styles.inputDisplay}>
            <span style={{ fontSize: '48px', fontWeight: '700', letterSpacing: '12px', color: '#333D4B' }}>
              {phoneLast4 ? phoneLast4 : <span style={{ color: '#E5E8EB' }}>••••</span>}
            </span>
          </div>

          {/* 키패드 그리드 */}
          <div style={styles.keypadGrid}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button key={num} onClick={() => handleNumberClick(num.toString())} style={styles.keyButton}>{num}</button>
            ))}
            <button onClick={handleClear} style={{ ...styles.keyButton, color: '#EF4444', backgroundColor: '#FEF2F2', borderColor: '#FEE2E2', fontSize: '18px' }}>전체삭제</button>
            <button onClick={() => handleNumberClick('0')} style={styles.keyButton}>0</button>
            <button onClick={handleDelete} style={{ ...styles.keyButton, color: '#F59E0B', backgroundColor: '#FFFBEB', borderColor: '#FEF3C7', fontSize: '24px' }}>⌫</button>
          </div>

          {/* 출석 버튼 */}
          {/* 출석 버튼 */}
          <button
            onClick={() => handleCheckIn()}
            disabled={phoneLast4.length !== 4 || loading}
            style={{
              ...styles.actionButton,
              backgroundColor: phoneLast4.length === 4 ? '#3182F6' : '#E5E8EB',
              color: phoneLast4.length === 4 ? 'white' : '#B0B8C1',
              cursor: phoneLast4.length === 4 ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? '처리 중...' : '출석하기'}
          </button>
        </div>
      </div>

      {/* 오른쪽: 정보 표시 영역 */}
      <div style={styles.rightPanel}>
        {welcomeData ? (
          // ✅ [CASE 1] 환영 카드
          <div style={styles.welcomeCard}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>👋</div>
            <h2 style={{ fontSize: '40px', fontWeight: '800', marginBottom: '32px', lineHeight: '1.3', color: '#191F28' }}>
              <span style={{ color: '#3182F6' }}>{welcomeData.name}</span> 회원님,<br />반갑습니다!
            </h2>

            <div style={styles.statusBox}>
              <div style={styles.statusRow}>
                <span>상태</span>
                <span style={{
                  fontWeight: '700',
                  color: getStatusInfo(welcomeData.daysRemaining).color,
                  fontSize: '24px'
                }}>
                  {getStatusInfo(welcomeData.daysRemaining).text}
                </span>
              </div>
              {welcomeData.endDate && (
                <div style={styles.statusRow}>
                  <span>만기일</span>
                  <span style={{ color: '#6B7280', fontWeight: '500' }}>{welcomeData.endDate}</span>
                </div>
              )}
            </div>
            <p style={{ color: '#8B95A1', fontSize: '15px', marginTop: '24px' }}>10초 후 초기화됩니다...</p>
          </div>
        ) : (
          // ✅ [CASE 2] 대기 화면
          <div style={styles.quoteContainer}>
            <h2 style={styles.quoteText}>"오늘의 한계가</h2>
            <h2 style={styles.quoteText}>내일의 워밍업이다."</h2>
          </div>
        )}
      </div>

      {/* ✅ 중복 회원 선택 모달 */}
      {showDuplicateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', textAlign: 'center' }}>
              앗! 뒷번호가 같은 회원이 있어요 😅
            </h3>
            <p style={{ textAlign: 'center', color: '#6B7280', marginBottom: '24px' }}>
              본인의 이름을 선택해주세요.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {duplicateMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleCheckIn(member.id)}
                  style={styles.duplicateItem}
                >
                  <span style={{ fontWeight: '600', fontSize: '16px' }}>{member.name}</span>
                  <span style={{ fontSize: '14px', color: '#6B7280' }}>
                    {member.phone}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowDuplicateModal(false);
                setDuplicateMembers([]);
              }}
              style={{ ...styles.actionButton, backgroundColor: '#F3F4F6', color: '#4B5563', marginTop: '24px', padding: '16px' }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 🎨 스타일 정의 (Toss Light Mode)
const styles: { [key: string]: React.CSSProperties } = {
  container: { display: 'flex', height: '100vh', backgroundColor: '#F2F4F6', fontFamily: '"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif' },

  // 왼쪽 패널
  leftPanel: {
    flex: '0 0 500px',
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E5E8EB',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  leftPanelContent: {
    width: '100%',
    maxWidth: '380px',
    padding: '40px'
  },
  inputDisplay: {
    backgroundColor: '#F9FAFB',
    borderRadius: '20px',
    marginBottom: '32px',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #E5E8EB',
  },
  keypadGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  keyButton: {
    backgroundColor: '#FFFFFF',
    color: '#333D4B',
    border: '1px solid #E5E8EB',
    borderRadius: '20px',
    padding: '24px 0',
    fontSize: '28px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
    transition: 'all 0.1s active',
  },
  actionButton: {
    width: '100%',
    marginTop: '32px',
    padding: '20px',
    border: 'none',
    borderRadius: '20px',
    fontSize: '20px',
    fontWeight: '700',
    transition: 'all 0.2s',
  },

  // 오른쪽 패널
  rightPanel: {
    flex: 1,
    backgroundColor: '#F2F4F6',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px'
  },

  // 대기 화면
  quoteContainer: {
    textAlign: 'center',
    opacity: 0.6
  },
  quoteText: { fontSize: '48px', margin: '8px 0', fontWeight: '800', color: '#8B95A1', lineHeight: '1.2' },

  // 환영 화면
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    padding: '60px',
    borderRadius: '32px',
    width: '100%',
    maxWidth: '640px',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.05)',
    animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  statusBox: { backgroundColor: '#F9FAFB', padding: '32px', borderRadius: '24px', marginBottom: '20px', border: '1px solid #E5E8EB' },
  statusRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '20px', color: '#6B7280' },

  // ✅ 모달 스타일
  modalOverlay: {
    position: 'fixed' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '32px',
    borderRadius: '24px',
    width: '90%',
    maxWidth: '400px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  },
  duplicateItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E8EB',
    borderRadius: '12px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'all 0.2s',
  }
};

export default CheckInPage;