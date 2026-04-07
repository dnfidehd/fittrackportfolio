import React, { useRef, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { Home, Dumbbell, Calendar, ClipboardList, TrendingUp, Trophy, MapPinned, User, Sun, Moon, LogOut, Menu, X, MessageSquare, Utensils, MessageCircle } from 'lucide-react';
import AIChatFloatingButton from '../components/ai/AIChatFloatingButton';
import OneRepMaxFloatingButton from '../components/tools/OneRepMaxFloatingButton';
import NotificationDropdown from '../components/common/NotificationDropdown';
import GymSwitcher from '../components/common/GymSwitcher';
import { getUnreadMessageCount, getCompetitionsPendingCount } from '../services/api';
import { isStaffRole } from '../utils/roles';
import { useVisiblePolling } from '../hooks/useVisiblePolling';

// 토스 스타일 색상
const TOSS_BLUE = '#3182F6';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  badge?: number;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, isActive, badge, onClick }) => {
  return (
    <Link to={to} onClick={onClick} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      textDecoration: 'none',
      color: isActive ? TOSS_BLUE : '#4E5968',
      padding: '12px 16px',
      borderRadius: '12px',
      backgroundColor: isActive ? '#E8F3FF' : 'transparent',
      transition: 'all 0.2s',
      marginBottom: '4px',
    }}>
      <div style={{ opacity: isActive ? 1 : 0.7 }}>{icon}</div>
      <span style={{ flex: 1, fontSize: '15px', fontWeight: isActive ? '600' : '500' }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          backgroundColor: '#EF4444',
          color: '#FFFFFF',
          fontSize: '11px',
          fontWeight: '700',
          padding: '2px 6px',
          borderRadius: '999px',
          minWidth: '18px',
          textAlign: 'center',
          lineHeight: '1.2'
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
};



// ... (existing imports)

const MemberLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isDarkMode, toggleTheme } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [msgUnreadCount, setMsgUnreadCount] = useState(0); // ✅ 메시지 안 읽은 건수

  // ✅ 주기적으로 메시지 안 읽은 건수 확인
  const fetchMessageCount = async () => {
    if (!user) return;

    try {
      const res = await getUnreadMessageCount();
      setMsgUnreadCount(res.data);
    } catch (error: any) {
      if (error.response?.status !== 401) {
        console.error("Failed to fetch message count", error);
      }
    }
  };

  useVisiblePolling(fetchMessageCount, 30000, [location.pathname, user?.id], {
    enabled: !!user,
  });

  const [pendingCount, setPendingCount] = useState(0);

  // 페이지 전환 시 스크롤 맨 위로 및 사이드바 닫기
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
    window.scrollTo(0, 0);
    setIsSidebarOpen(false);
    document.title = '핏트랙'; // ✅ 회원용 타이틀 설정
  }, [location.pathname]);

  // 대회 신청 대기 건수 조회 (코치/관리자)
  const fetchPendingCount = async () => {
    if (user && isStaffRole(user.role)) {
      try {
        const res = await getCompetitionsPendingCount();
        setPendingCount(res.data.total_pending);
      } catch (e) {
        console.error("Failed to fetch pending count", e);
      }
    }
  };

  useVisiblePolling(fetchPendingCount, 60000, [user?.id, user?.role], {
    enabled: !!user && isStaffRole(user.role),
  });

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      logout();
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // 메뉴 아이템 정의
  const navItems = [
    { to: '/dashboard', icon: <Home size={20} />, label: '홈' },
    { to: '/wod', icon: <Dumbbell size={20} />, label: 'WOD' },
    { to: '/dropin', icon: <MapPinned size={20} />, label: '드랍인' },
    { to: '/reservation', icon: <Calendar size={20} />, label: '예약' },
    { to: '/my-workouts', icon: <ClipboardList size={20} />, label: '기록' },
    { to: '/pr', icon: <TrendingUp size={20} />, label: 'PR' },
    { to: '/diet', icon: <Utensils size={20} />, label: '식단' }, // ✅ 추가됨
    { to: '/competition', icon: <Trophy size={20} />, label: '대회', badge: pendingCount },
    { to: '/community', icon: <MessageSquare size={20} />, label: '커뮤니티' },
    { to: '/chat', icon: <MessageCircle size={20} />, label: '코치 문의', badge: msgUnreadCount },
    { to: '/mypage', icon: <User size={20} />, label: '내 정보' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: isDarkMode ? '#1A1A1A' : '#FAFAFB',
      color: isDarkMode ? '#FFFFFF' : '#191F28',
      maxWidth: '560px',
      margin: '0 auto',
      position: 'relative',
      boxShadow: '0 0 40px rgba(0,0,0,0.1)',
      overflow: isSidebarOpen ? 'hidden' : 'initial',
    }}>
      {/* 사이드바 메뉴 */}
      <div
        onClick={() => setIsSidebarOpen(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 1000,
          opacity: isSidebarOpen ? 1 : 0,
          visibility: isSidebarOpen ? 'visible' : 'hidden',
          transition: 'all 0.3s ease-in-out',
        }}
      />
      <aside style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '280px',
        backgroundColor: isDarkMode ? '#252525' : '#FFFFFF',
        zIndex: 1001,
        transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease-in-out',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '10px 0 20px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <Link to="/dashboard" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '20px', fontWeight: '800', color: TOSS_BLUE }}>FitTrack</div>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#8B95A1' }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {navItems.map((item) => (
            <div key={item.to} style={{ position: 'relative' }}>
              <NavItem
                to={item.to}
                icon={item.icon}
                label={item.label}
                isActive={isActive(item.to)}
                badge={(item as any).badge}
                onClick={() => setIsSidebarOpen(false)}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', padding: '20px 0', borderTop: `1px solid ${isDarkMode ? '#333' : '#F2F4F6'}` }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#EF4444',
              fontSize: '15px',
              fontWeight: '500',
              borderRadius: '12px',
              transition: 'all 0.2s',
            }}
          >
            <LogOut size={20} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 상단 헤더 */}
      <header style={{
        height: '56px',
        backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF',
        borderBottom: `1px solid ${isDarkMode ? '#333' : '#F3F4F6'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsSidebarOpen(true)}
            style={{
              width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isDarkMode ? '#FFFFFF' : '#191F28',
            }}
          >
            <Menu size={24} />
          </button>
          <Link to="/dashboard" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: TOSS_BLUE, letterSpacing: '-0.5px' }}>
              FitTrack
            </div>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <GymSwitcher />
          <button
            onClick={toggleTheme}
            style={{
              width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isDarkMode ? '#FCD34D' : '#6B7280',
            }}
            title={isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <NotificationDropdown />
        </div>
      </header >

      {/* 메인 콘텐츠 */}
      < main ref={mainRef} style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: '40px',
        backgroundColor: isDarkMode ? '#1A1A1A' : '#FAFAFB',
      }}>
        {children}
      </main >

      {/* 플로팅 버튼 */}
      < OneRepMaxFloatingButton />
      <AIChatFloatingButton />
    </div >
  );
};

export default MemberLayout;
