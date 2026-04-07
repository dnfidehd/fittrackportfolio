import React, { useRef, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { LayoutDashboard, CalendarDays, FileText, Users, DollarSign, Dumbbell, MessageSquare, Trophy, Bell, Settings, Sun, Moon, LogOut, ExternalLink, Menu, X } from 'lucide-react';
import AIChatFloatingButton from '../components/ai/AIChatFloatingButton';
import OneRepMaxFloatingButton from '../components/tools/OneRepMaxFloatingButton';
import NotificationDropdown from '../components/common/NotificationDropdown';
import GymSwitcher from '../components/common/GymSwitcher';
import { getDropInPendingCount, getCompetitionsPendingCount, getUnreadMessageCount } from '../services/api';
import { hasFullAdminAccess } from '../utils/roles';
import { useVisiblePolling } from '../hooks/useVisiblePolling';
import '../App.css';

const TOSS_BLUE = '#3182F6';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  badge?: number; // ✅ 배지 (숫자) 추가
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, isActive, badge }) => (
  <Link to={to} style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    textDecoration: 'none',
    color: isActive ? TOSS_BLUE : '#6B7280',
    backgroundColor: isActive ? '#E8F3FF' : 'transparent',
    borderRadius: '12px',
    fontWeight: isActive ? '600' : '500',
    fontSize: '14px',
    transition: 'all 0.2s',
    position: 'relative', // 배지 위치 잡기 위해 추가
  }}>
    {icon}
    <span style={{ flex: 1 }}>{label}</span>
    {badge !== undefined && badge > 0 && (
      <span style={{
        backgroundColor: '#EF4444',
        color: 'white',
        fontSize: '11px',
        fontWeight: 'bold',
        padding: '2px 6px',
        borderRadius: '10px',
        minWidth: '18px',
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}>
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </Link>
);

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isDarkMode, toggleTheme } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
  const [dropInCount, setDropInCount] = useState(0); // ✅ 드랍인 대기 건수 상태
  const [compPendingCount, setCompPendingCount] = useState(0); // ✅ 대회 참가 대기 건수 상태
  const [msgUnreadCount, setMsgUnreadCount] = useState(0); // ✅ 메시지 안 읽은 건수

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo(0, 0);
    window.scrollTo(0, 0);
    setIsMobileSidebarOpen(false); // 페이지 이동 시 사이드바 닫기
    document.title = '핏트랙 관리자'; // ✅ 관리자 타이틀 설정
  }, [location.pathname]);

  // ✅ 주기적으로 드랍인 대기 건수 확인 (1분마다 or 페이지 이동 시)
  const fetchCounts = async () => {
    if (!user) return;

    try {
      const [dropInRes, compRes, msgRes] = await Promise.allSettled([
        getDropInPendingCount(),
        getCompetitionsPendingCount(),
        getUnreadMessageCount()
      ]);

      if (dropInRes.status === 'fulfilled') {
        setDropInCount(dropInRes.value.data.count);
      }

      if (compRes.status === 'fulfilled') {
        const total = compRes.value.data.total_pending || 0;
        setCompPendingCount(total);
      }

      if (msgRes.status === 'fulfilled') {
        setMsgUnreadCount(msgRes.value.data);
      }
    } catch (error: any) {
      if (error.response?.status !== 401) {
        console.error("카운트 조회 실패", error);
      }
    }
  };

  useVisiblePolling(fetchCounts, 30000, [location.pathname, user?.id], {
    enabled: !!user,
  });

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      logout();
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // ✅ [추가] 권한 확인 함수
  const hasPermission = (permissionName: string): boolean => {
    if (!user || hasFullAdminAccess(user.role)) {
      return true;
    }

    if (user.role === 'subcoach') {
      const userPermissions = (user as any).permissions || [];
      return userPermissions.some((p: any) => p.name === permissionName);
    }

    return false; // 기타 role은 접근 불가
  };

  // ✅ [수정] 전체 메뉴 정의 (권한과 매핑)
  const allNavItems = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: '대시보드', permission: null }, // 모든 관리자 접근 가능
    { to: '/inbox', icon: <MessageSquare size={20} />, label: '회원 문의함', badge: msgUnreadCount, permission: 'member_sms' },
    { to: '/attendance', icon: <Users size={20} />, label: '출석 현황', permission: 'members' },
    { to: '/schedule', icon: <CalendarDays size={20} />, label: '수업 현황/예약', permission: 'classes' },
    { to: '/coaching-class-schedule', icon: <CalendarDays size={20} />, label: '코치 배정 관리', permission: 'classes' },
    { to: '/wod', icon: <FileText size={20} />, label: 'WOD 관리', permission: 'wods' },
    { to: '/members', icon: <Users size={20} />, label: '회원 관리', permission: 'members' },
    { to: '/sales', icon: <DollarSign size={20} />, label: '매출 관리', permission: 'sales' },
    { to: '/workouts', icon: <Dumbbell size={20} />, label: '기록 조회', permission: 'records' },
    { to: '/community', icon: <MessageSquare size={20} />, label: '커뮤니티', permission: 'community' },
    { to: compPendingCount > 0 ? '/competition?filter=pending' : '/competition', icon: <Trophy size={20} />, label: '대회 관리', badge: compPendingCount, permission: 'competitions' },
    { to: '/notifications', icon: <Bell size={20} />, label: '알림 관리', permission: 'notifications' },
    { to: '/dropin-manage', icon: <CalendarDays size={20} />, label: '드랍인 관리', badge: dropInCount, permission: 'dropin' },
    { to: '/settings', icon: <Settings size={20} />, label: '환경 설정', permission: 'settings' },
  ];

  // ✅ [추가] 부코치는 권한이 있는 메뉴만 표시, 코치/슈퍼어드민은 모든 메뉴 표시
  const navItems = allNavItems.filter(item => {
    if (!item.permission) return true; // 권한 제한이 없는 메뉴
    return hasPermission(item.permission);
  });

  // 화면 너비 감지 (사이드바 숨김 여부 결정)
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: isDarkMode ? '#1A1A1A' : '#F2F4F6',
    }}>
      {/* 상단 바 (데스크탑 및 모바일 공통) */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: isMobile ? 0 : '240px',
        right: 0,
        height: '64px',
        backgroundColor: 'var(--bg-card)',
        borderBottom: `1px solid var(--border-color)`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        zIndex: 100,
        justifyContent: 'space-between',
        transition: 'left 0.3s ease',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isMobile && (
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Menu size={24} />
            </button>
          )}
          {!isMobile && <div />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GymSwitcher />
          <button
            onClick={toggleTheme}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: 'var(--bg-secondary)',
              color: isDarkMode ? '#FCD34D' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title={isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <NotificationDropdown />
        </div>
      </header>

      {/* 오버레이 (모바일 사이드바 열렸을 때) */}
      {isMobile && isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 102,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* 사이드바 (데스크탑: 고정, 모바일: 드로어) */}
      <aside style={{
        width: '240px',
        backgroundColor: isDarkMode ? '#252525' : '#FFFFFF',
        borderRight: `1px solid ${isDarkMode ? '#333' : '#E5E7EB'}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 103,
        transition: 'transform 0.3s ease',
        transform: isMobile ? (isMobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
      }}>
        {/* 로고 */}
        <div style={{
          padding: '20px',
          borderBottom: `1px solid ${isDarkMode ? '#333' : '#E5E7EB'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: '700', color: TOSS_BLUE }}>FitTrack</span>
            <span style={{
              fontSize: '10px',
              fontWeight: '600',
              backgroundColor: TOSS_BLUE,
              color: '#FFFFFF',
              padding: '2px 8px',
              borderRadius: '4px',
            }}>ADMIN</span>
          </Link>
          {isMobile && (
            <button onClick={() => setIsMobileSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF' }}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* 네비게이션 */}
        <nav style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              isActive={isActive(item.to)}
              badge={item.badge}
            />
          ))}
        </nav>

        {/* 하단 - 출석체크 & 사용자 정보 */}
        <div style={{ padding: '16px', borderTop: `1px solid ${isDarkMode ? '#333' : '#E5E7EB'}` }}>
          <a
            href="/check-in"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#E8F3FF',
              color: TOSS_BLUE,
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px',
              marginBottom: '12px',
            }}
          >
            <ExternalLink size={16} />
            출석체크 모드
          </a>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>관리자</div>
            </div>
          </div>

          <button onClick={handleLogout} style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            border: 'none',
            borderRadius: '10px',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
          }}>
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main ref={mainRef} style={{
        flex: 1,
        marginLeft: isMobile ? 0 : '240px',
        paddingTop: '64px',
        minHeight: '100vh',
        overflowY: 'auto' as const,
        backgroundColor: 'var(--bg-main)',
        transition: 'margin-left 0.3s ease, background-color 0.3s',
      }}>
        <div style={{
          maxWidth: '100%',
          padding: isMobile ? '20px 16px' : '32px 40px',
          boxSizing: 'border-box'
        }}>
          {children}
        </div>
      </main>

      {/* 플로팅 버튼 (모바일에서도 사용 가능하도록 조정) */}
      <OneRepMaxFloatingButton />
      <AIChatFloatingButton />
    </div>
  );
};

export default AdminLayout;
