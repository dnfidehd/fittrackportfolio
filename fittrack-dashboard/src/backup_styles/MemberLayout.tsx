import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import AIChatFloatingButton from '../components/ai/AIChatFloatingButton';
// ✅ 알림 API 추가
import { getUnreadCount, getMyNotifications, markNotificationRead } from '../services/api';

// ✅ 종 모양 아이콘 (SVG)
const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const MemberLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ 알림 관련 상태 관리
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNoti, setShowNoti] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // 페이지 이동 시, 혹은 처음 로드 시 안 읽은 알림 개수 체크
  useEffect(() => {
    fetchUnreadCount();
  }, [location.pathname]); // 페이지 이동할 때마다 갱신

  const fetchUnreadCount = async () => {
    try {
      const res = await getUnreadCount();
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBellClick = async () => {
    if (!showNoti) {
      // 알림창 열 때 목록 불러오기
      try {
        const res = await getMyNotifications();
        setNotifications(res.data);
      } catch (err) {
        console.error(err);
      }
    }
    setShowNoti(!showNoti);
  };

  const handleRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 사이드바 (기존 유지) */}
      <aside style={{
        width: '250px',
        backgroundColor: '#1f2937',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 100
      }}>
        <div style={{ padding: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold', borderBottom: '1px solid #374151' }}>
          FitTrack <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Member</span>
        </div>

        <nav style={{ flex: 1, padding: '1rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li><Link to="/wod" style={isActive('/wod') ? activeLinkStyle : linkStyle}>🏋️ 오늘의 WOD</Link></li>
            <li><Link to="/my-workouts" style={isActive('/my-workouts') ? activeLinkStyle : linkStyle}>📝 내 운동 기록</Link></li>
            <li><Link to="/mypage" style={isActive('/mypage') ? activeLinkStyle : linkStyle}>🏆 마이 페이지</Link></li>
            <li><Link to="/competition" style={isActive('/competition') ? activeLinkStyle : linkStyle}>🏅 대회 / 랭킹</Link></li>
            <li><Link to="/community" style={isActive('/community') ? activeLinkStyle : linkStyle}>💬 커뮤니티</Link></li>
          </ul>
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid #374151' }}>
          <div style={{ marginBottom: '1rem' }}>
            {user?.name} 님 <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>({user?.membership})</span>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            로그아웃
          </button>
        </div>
      </aside>

      {/* ✅ 메인 콘텐츠 영역 (구조 변경: 헤더 + 콘텐츠) */}
      <main style={{ flex: 1, marginLeft: '250px', display: 'flex', flexDirection: 'column' }}>

        {/* 🔥 [NEW] 상단 알림 바 */}
        <header style={{
          height: '60px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end', // 오른쪽 정렬
          padding: '0 30px',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          {/* 알림 아이콘 영역 */}
          <div style={{ position: 'relative' }}>
            <button onClick={handleBellClick} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '5px', color: '#4b5563' }}>
              <BellIcon />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-2px', right: '-2px', backgroundColor: '#ef4444', color: 'white',
                  borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* 알림 드롭다운 메뉴 */}
            {showNoti && (
              <div style={{
                position: 'absolute', top: '40px', right: '0', width: '320px',
                backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                border: '1px solid #e5e7eb', overflow: 'hidden', zIndex: 101
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', backgroundColor: '#f9fafb' }}>🔔 알림함</div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => !n.is_read && handleRead(n.id)}
                        style={{
                          padding: '12px 16px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: '0.2s',
                          backgroundColor: n.is_read ? 'white' : '#eff6ff',
                          opacity: n.is_read ? 0.6 : 1
                        }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px' }}>
                          {n.title}
                          {!n.is_read && <span style={{ marginLeft: '6px', fontSize: '0.7rem', backgroundColor: '#ef4444', color: 'white', padding: '1px 5px', borderRadius: '4px' }}>N</span>}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>{n.message}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                          {new Date(n.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                      알림이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* 실제 콘텐츠 */}
        <div style={{ padding: '2rem' }}>
          {children}
        </div>
      </main>

      {/* 챗봇 버튼 */}
      <AIChatFloatingButton />

    </div>
  );
};

const linkStyle: React.CSSProperties = {
  display: 'block', padding: '0.8rem 1rem', color: '#d1d5db', textDecoration: 'none', borderRadius: '6px', transition: 'all 0.2s'
};

const activeLinkStyle: React.CSSProperties = {
  ...linkStyle, backgroundColor: '#374151', color: 'white', fontWeight: 'bold'
};

export default MemberLayout;