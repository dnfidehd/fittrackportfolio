import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useAppContext } from './contexts/AppContext';
import AdminLayout from './layouts/AdminLayout';
import MemberLayout from './layouts/MemberLayout';

import LoginPage from './pages/auth/LoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import CheckInPage from './pages/auth/CheckInPage';
import Dashboard from './pages/admin/Dashboard';
import AttendanceStats from './pages/admin/AttendanceStats';
import Members from './pages/members/Members';
import Sales from './pages/sales/Sales';
import AdminWorkoutsPage from './pages/admin/WorkoutsPage';
import MyWorkoutsPage from './pages/user/MyWorkoutsPage';
import Community from './pages/community/Community';

import WodBoard from './pages/wod/WodBoard';
import CompetitionPage from './pages/competition/CompetitionPage';
import PRPage from './pages/user/PRPage';
import MyProfilePage from './pages/user/MyProfilePage';
import MyPage from './pages/members/MyPages';
import UserDashboard from './pages/user/UserDashboard'; // ✅ 추가
import AIReportPage from './pages/user/AIReportPage'; // ✅ AI 리포트 페이지 추가
import { DropInPage } from './pages/dropin/DropInPage'; // ✅ 드랍인 예약 페이지 (Named Import)
import DropInManager from './pages/admin/DropInManager'; // ✅ 드랍인 관리자 페이지 추가
import AdminNotifications from './pages/notifications/AdminNotifications';
import MemberDetail from './pages/admin/MemberDetail';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SettingsPage from './pages/admin/SettingsPage';
import ReservationPage from './pages/reservation/ReservationPage';
import CoachSchedulePage from './pages/coach/CoachSchedulePage';
import CoachingClassSchedulePage from './pages/coach/CoachingClassSchedulePage'; // ✅ 통합 수업 관리 페이지 추가
import CoachChatPage from './pages/chat/CoachChatPage';
import CoachInboxPage from './pages/chat/CoachInboxPage';
import DietLogPage from './pages/diet/DietLog'; // ✅ 식단 페이지 추가
import GlobalNoticePopup from './components/modals/GlobalNoticePopup';
import { isStaffMember, isSuperAdminRole, isUserRole } from './utils/roles';

// 게스트 전용 페이지
import GuestEntryPage from './pages/guest/GuestEntryPage';
import GuestLeaderboardPage from './pages/guest/GuestLeaderboardPage';
import GuestPasscodeAutoEntry from './pages/guest/GuestPasscodeAutoEntry';
import GuestProfileEntry from './pages/guest/GuestProfileEntry'; // ✅ [신규]
import OpenPercentilePage from './pages/tools/OpenPercentilePage';

const MainApp = () => {
  const { user, isInitializing } = useAppContext();

  if (isInitializing) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2rem' }}>로딩 중... ⏳</div>;
  }

  // ✅ 관리자 또는 코치인지 확인하는 헬퍼 함수 (구버전의 'admin' 세션 캐시 호환성 포함)
  const isAdminOrCoach = isStaffMember(user);
  const isSuperAdmin = isSuperAdminRole(user?.role);

  return (
    <Routes>
      {/* 1. 로그인/인증 */}
      <Route path="/login" element={
        !user ? <LoginPage /> : (
          user.must_change_password ? <Navigate to="/change-password" /> :
            (isSuperAdmin ? <Navigate to="/superadmin" /> :
              isAdminOrCoach ? <Navigate to="/" /> : <Navigate to="/dashboard" />)
        )
      } />
      <Route path="/check-in" element={<CheckInPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* 게스트 전용 (로그인 없이 접근) */}
      <Route path="/guest/entry" element={<GuestEntryPage />} />
      <Route path="/guest/scores" element={<GuestLeaderboardPage />} />
      <Route path="/guest/link/:alias" element={<GuestPasscodeAutoEntry />} />
      <Route path="/guest/profile" element={<GuestProfileEntry />} /> {/* ✅ [신규] */}
      <Route path="/open-percentile" element={<OpenPercentilePage />} />

      {/* 2. 공통 기능 (WOD, 대회, 커뮤니티) - ✅ 코치(Staff)도 AdminLayout 사용! */}
      <Route path="/wod" element={
        !user ? <Navigate to="/login" /> : (
          isAdminOrCoach ? <AdminLayout><WodBoard /></AdminLayout> : <MemberLayout><WodBoard /></MemberLayout>
        )
      } />

      <Route path="/competition" element={
        !user ? <Navigate to="/login" /> : (
          isAdminOrCoach ? <AdminLayout><CompetitionPage /></AdminLayout> : <MemberLayout><CompetitionPage /></MemberLayout>
        )
      } />

      {/* ✅ [수정됨] 커뮤니티를 회원 전용에서 -> 공통 기능으로 이동! */}
      <Route path="/community" element={
        !user ? <Navigate to="/login" /> : (
          isAdminOrCoach ? <AdminLayout><Community /></AdminLayout> : <MemberLayout><Community /></MemberLayout>
        )
      } />

      {/* 3. 슈퍼어드민 전용 페이지 (role: 'superadmin') */}
      <Route path="/superadmin" element={
        isSuperAdmin ? <SuperAdminDashboard /> : <Navigate to="/login" />
      } />

      {/* 4. 회원 전용 페이지 (role: 'user') */}
      <Route path="/dashboard" element={user && isUserRole(user.role) ? (<MemberLayout><UserDashboard /></MemberLayout>) : <Navigate to="/login" />} />
      <Route path="/mypage" element={user && isUserRole(user.role) ? (<MemberLayout><MyPage /></MemberLayout>) : <Navigate to="/login" />} />
      <Route path="/my-workouts" element={user && isUserRole(user.role) ? (<MemberLayout><MyWorkoutsPage /></MemberLayout>) : <Navigate to="/login" />} />
      <Route path="/ai-report" element={user && isUserRole(user.role) ? (<MemberLayout><AIReportPage /></MemberLayout>) : <Navigate to="/login" />} />
      <Route path="/pr" element={user && isUserRole(user.role) ? (<MemberLayout><PRPage /></MemberLayout>) : <Navigate to="/login" />} />
      <Route path="/profile" element={user && isUserRole(user.role) ? (<MemberLayout><MyProfilePage /></MemberLayout>) : <Navigate to="/login" />} />
      <Route path="/reservation" element={user && isUserRole(user.role) ? (<MemberLayout><ReservationPage /></MemberLayout>) : <Navigate to="/login" />} />
      <Route path="/dropin" element={user && isUserRole(user.role) ? (<MemberLayout><DropInPage /></MemberLayout>) : <Navigate to="/login" />} />
      <Route path="/diet" element={user && isUserRole(user.role) ? (<MemberLayout><DietLogPage /></MemberLayout>) : <Navigate to="/login" />} />
      <Route path="/chat" element={user && isUserRole(user.role) ? (<MemberLayout><CoachChatPage /></MemberLayout>) : <Navigate to="/login" />} />

      {/* 5. 관리자 & 코치 전용 페이지 (Dashboard 등) */}
      <Route path="/*" element={
        isAdminOrCoach ? (  // ✅ 코치도 접속 허용
          <AdminLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/workouts" element={<AdminWorkoutsPage />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/notifications" element={<AdminNotifications />} />
              <Route path="/dropin-manage" element={<DropInManager />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/schedule" element={<CoachSchedulePage />} />
              <Route path="/attendance" element={<AttendanceStats />} />
              <Route path="/coaching-class-schedule" element={<CoachingClassSchedulePage />} />
              {/* <Route path="/chat" element={<CoachChatPage />} />  <-- 제거: 회원은 MemberLayout에서 접근 */}
              <Route path="/inbox" element={<CoachInboxPage />} />
              <Route path="/members/:id" element={<MemberDetail />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </AdminLayout>
        ) : <Navigate to="/login" />
      } />
    </Routes>
  );
};

function App() {
  return (
    <AppProvider>
      <Router>
        <MainApp />
        <GlobalNoticePopup />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </Router>
    </AppProvider>
  );
}

export default App;
