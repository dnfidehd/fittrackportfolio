import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import '../App.css';

const NavItem = ({ to, icon, label, isMobile = false }: { to: string; icon: string; label: string, isMobile?: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  if (isMobile) {
    return (
      <Link to={to} className={`bottom-nav-item ${isActive ? 'active' : ''}`}>
        <span>{icon}</span>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link to={to} className={`nav-item ${isActive ? 'active' : ''}`}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
};

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout, user } = useAppContext();

  return (
    <div className="layout-container">
      {/* PC 사이드바 */}
      <div className="sidebar">
        <h1 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '2.5rem', color: '#111827', paddingLeft: '0.5rem', letterSpacing: '-0.5px' }}>
          FitTrack<span style={{ color: '#2563eb' }}>.AI</span>
          <span style={{ fontSize: '0.7rem', backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', color: '#6b7280', verticalAlign: 'middle' }}>ADMIN</span>
        </h1>

        <nav style={{ flex: 1 }}>
          <NavItem to="/" icon="📊" label="대시보드" />
          <NavItem to="/wod" icon="📝" label="WOD 관리" />
          <NavItem to="/members" icon="👥" label="회원 관리" />
          <NavItem to="/sales" icon="💰" label="매출 관리" />
          <NavItem to="/workouts" icon="💪" label="기록 조회" />
          <NavItem to="/community" icon="💬" label="커뮤니티" />
          <NavItem to="/competition" icon="🏆" label="대회 관리" />
          <NavItem to="/notifications" icon="📢" label="알림 관리" />
        </nav>

        {/* 키오스크 모드 바로가기 버튼 */}
        <div style={{ padding: '0 0.5rem 1.5rem 0.5rem' }}>
          <Link
            to="/check-in"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '0.8rem',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              textDecoration: 'none',
              transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <span style={{ marginRight: '8px', fontSize: '1.1rem' }}>🖥️</span>
            출석체크 모드
          </Link>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', marginTop: '6px', marginBottom: 0 }}>
            *클릭 시 새 창이 열립니다
          </p>
        </div>

        {/* 사용자 프로필 영역 */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem' }}>
          <div style={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#1f2937' }}>{user?.name}</p>
            <button onClick={logout} style={{ fontSize: '0.8rem', color: '#ef4444', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginTop: '4px' }}>로그아웃</button>
          </div>
        </div>
      </div>

      {/* 모바일 하단 탭바 */}
      <div className="bottom-nav">
        <NavItem to="/" icon="📊" label="홈" isMobile />
        <NavItem to="/wod" icon="📝" label="WOD" isMobile />
        <NavItem to="/members" icon="👥" label="회원" isMobile />
        <NavItem to="/sales" icon="💰" label="매출" isMobile />
        <NavItem to="/community" icon="💬" label="소통" isMobile />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="main-content">
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;