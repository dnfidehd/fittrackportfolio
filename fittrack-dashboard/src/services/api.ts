import axios from 'axios';
import {
  DashboardStats,
  Wod,
  WodRecord,
  Competition,
  CompetitionEvent,
  CompLeaderboardItem,
  PersonalRecord,
  OverallLeaderboardItem,
  AttendanceResponse
} from '../types';

// API 서버 주소 (환경변수에서 읽기)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const BASE_URL = API_BASE_URL; // 이미지 경로 등 외부에서 필요할 때 사용

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터 (토큰 자동 첨부)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ✅ 응답 인터셉터 (401 에러 자동 처리)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("세션이 만료되었거나 권한이 없습니다. 로그아웃 처리합니다.");

      // 로그아웃 처리 (로컬 스토리지 비우기)
      // window.location.href 사용 시 무한 루프 주의 (이미 /login 이면 이동 안 함)
      // ✅ [수정] 게스트 페이지에서는 401이 발생해도 로그인 창으로 보내지 않음 (패스코드 틀림 등)
      if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/guest')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==========================================
// 1. 기본 & 회원 관련
// ==========================================
export const healthCheck = () => api.get('/health');
export const getDashboardStats = (): Promise<{ data: DashboardStats }> => api.get('/api/dashboard/stats');
export const runDailyCrmCheck = () => api.post('/api/crm/run-daily-check'); // ✅ CRM 체크 실행

// ✅ 회원 리스트 조회 (params optional)
export const getMembers = (params: {
  skip?: number;
  limit?: number;
  search?: string;
  status?: string;
  gender?: string;
  sort?: string;
} = {}) => {
  return api.get('/api/members', { params });
};
export const PREDEFINED_TAGS = ['우수회원', '신규회원', '장기미출석', '부상주의', 'PT회원', '요주의'];
export const createMember = (data: any) => api.post('/api/members/', data);
export const deleteMember = (id: number) => api.delete(`/api/members/${id}/`);
export const updateMember = (id: number, data: any) => api.put(`/api/members/${id}/`, data);
export const getMyInfo = () => api.get('/api/members/me');
export const updateMyProfile = (data: any) => api.put('/api/members/me/profile', data);

export const getMyStats = () => api.get('/api/members/me/stats');
export const getMyHoldStatus = () => api.get('/api/members/me/hold-status');
export const getMyBadges = () => api.get('/api/badges/');
export const getMemberDetail = (id: number) => api.get(`/api/members/${id}/detail`);
export const getCoachesList = () => api.get<any[]>('/api/members/list/coaches'); // ✅ 코치 목록 조회 추가 (이름 변경)


// ==========================================
// 2. 운동 기록 & WOD
// ==========================================
export const getWorkouts = (params?: any) => api.get('/api/workouts/admin', { params });
export const createWorkout = (data: any) => api.post('/api/workouts', data);
export const updateWorkout = (id: number, data: any) => api.put(`/api/workouts/${id}`, data);
export const deleteWorkout = (id: number) => api.delete(`/api/workouts/${id}`);
export const getMyWorkouts = () => api.get('/api/workouts/me');
export const getMyWodRecords = () => api.get('/api/wods/records/me');
export const deleteWodRecord = (id: number) => api.delete(`/api/wods/records/${id}`);
export const getWodHistoryByTitle = (title: string): Promise<{ data: WodRecord[] }> =>
  api.get('/api/wods/history/by-title', { params: { title } });

export const getWod = (dateStr: string): Promise<{ data: Wod }> => api.get(`/api/wods/daily/${dateStr}`);

// 주간 WOD 조회 (달력용)
export const getWeeklyWods = (startDate: string, endDate: string) =>
  api.get('/api/wods/weekly', { params: { start_date: startDate, end_date: endDate } });

export const createWod = (data: any): Promise<{ data: Wod }> => api.post('/api/wods', data);
export const createWodRecord = (data: { wod_id: number; record_value: string; is_rx: boolean; scale_rank?: string | null; is_time_cap?: boolean; note?: string }): Promise<{ data: WodRecord }> => api.post('/api/wods/records', data);

export const saveWodRecord = (data: { wod_id: number; record_value: string; is_rx: boolean; scale_rank?: string | null; is_time_cap?: boolean; note?: string }) => {
  return api.post('/api/wods/records', data);
};

export const getLeaderboard = (wodId: number): Promise<{ data: WodRecord[] }> => api.get(`/api/wods/${wodId}/leaderboard`);
export const updateWod = (date: string, data: any) => api.put(`/api/wods/${date}`, data);
export const deleteWod = (date: string) => api.delete(`/api/wods/${date}`);


// ==========================================
// 3. 커뮤니티 & AI (✅ 수정됨: 필터링 기능)
// ==========================================

interface PostData {
  title: string;
  content: string;
  board_type: string;
  market_status?: string;
  region?: string;
  youtube_url?: string;
  wod_record?: string;
  file?: File;
  deleteImage?: boolean;
}

// ✅ [수정] board_type 파라미터를 백엔드로 전달
export const getPosts = (boardType?: string) =>
  api.get('/api/community/', { params: { board_type: boardType } });

// ✅ [신규] 게시글 상세 조회 (조회수 증가)
export const getPostDetail = (postId: number) => api.get(`/api/community/${postId}`);

export const createPost = (data: PostData) => {
  const formData = new FormData();
  formData.append('title', data.title);
  formData.append('content', data.content);
  formData.append('board_type', data.board_type); // ✅ 게시판 타입 전송

  formData.append('market_status', data.market_status || "판매중");
  if (data.region) formData.append('region', data.region);
  if (data.youtube_url) formData.append('youtube_url', data.youtube_url);
  if (data.wod_record) formData.append('wod_record', data.wod_record);

  if (data.file) {
    formData.append('file', data.file);
  }

  return api.post('/api/community/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const updatePost = (postId: number, data: PostData) => {
  const formData = new FormData();
  formData.append('title', data.title);
  formData.append('content', data.content);
  formData.append('board_type', data.board_type);

  formData.append('market_status', data.market_status || "판매중");
  if (data.region) formData.append('region', data.region);

  if (data.youtube_url) formData.append('youtube_url', data.youtube_url);
  else formData.append('youtube_url', "");

  if (data.wod_record) formData.append('wod_record', data.wod_record);
  else formData.append('wod_record', "");

  if (data.file) formData.append('file', data.file);
  if (data.deleteImage) formData.append('delete_image', "true");

  return api.put(`/api/community/${postId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const deletePost = (id: number) => api.delete(`/api/community/${id}`);

export const addComment = (postId: number, data: { content: string, parent_id?: number }) =>
  api.post(`/api/community/${postId}/comments`, data);

export const deleteComment = (commentId: number) => api.delete(`/api/community/comments/${commentId}`);
export const toggleLike = (postId: number) => api.post(`/api/community/${postId}/like`);

// ✅ [신규] 활성 팝업 공지 조회
export const getActivePopup = () => api.get('/api/community/active-popup');

export const getAIRecommendation = () => api.get('/api/ai/recommendation');
export const chatWithAI = (message: string, history: { role: string, content: string }[] = []) =>
  api.post('/api/ai/chat', { message, history });
export const getAIAnalysis = () => api.post('/api/ai/analyze'); // ✅ 성과 분석 API
export const generateAiWod = (prompt: string, environment: string = 'box') => api.post('/api/ai/generate-wod', { prompt, environment }); // ✅ AI WOD 생성 API


// ==========================================
// 4. 개인 최고 기록 (PR)
// ==========================================
export const getMyPRs = (): Promise<{ data: PersonalRecord[] }> => api.get('/api/records/me');
export const createOrUpdatePR = (data: { exercise_name: string; record_value: string; recorded_date: string }) =>
  api.post('/api/records/', {
    ...data,
    record_value: parseFloat(data.record_value)
  });
export const deletePR = (id: number) => api.delete(`/api/records/${id}`);


// ==========================================
// 5. 🏆 대회 (Competitions)
// ==========================================
export const getCompetitions = (): Promise<{ data: Competition[] }> => api.get('/api/competitions');
export const getCompetitionsPendingCount = (): Promise<{ data: { total_pending: number, competitions: { [key: number]: number } } }> =>
  api.get('/api/competitions/pending-count');
export const createCompetition = (data: any) => api.post('/api/competitions', data);
export const updateCompetition = (compId: number, data: any) => api.put(`/api/competitions/${compId}`, data);
export const deleteCompetition = (compId: number) => api.delete(`/api/competitions/${compId}`);
export const getCompetitionDetail = (compId: number): Promise<{ data: { competition: Competition, events: CompetitionEvent[] } }> =>
  api.get(`/api/competitions/${compId}`);
export const createCompetitionEvent = (compId: number, data: { title: string, description: string, score_type: string, time_cap?: number | null, max_reps?: number | null }) =>
  api.post(`/api/competitions/${compId}/events`, data);
export const submitCompetitionScore = (eventId: number, data: { score_value: string, is_rx: boolean, scale_rank?: string | null, is_time_cap?: boolean, tie_break?: string, note?: string }) =>
  api.post(`/api/competitions/events/${eventId}/scores`, { ...data, event_id: eventId });
export const getEventLeaderboard = (eventId: number): Promise<{ data: CompLeaderboardItem[] }> =>
  api.get(`/api/competitions/events/${eventId}/leaderboard`);
export const getOverallLeaderboard = (compId: number): Promise<{ data: OverallLeaderboardItem[] }> =>
  api.get(`/api/competitions/${compId}/overall`);
export const mergeCompetitionParticipants = (
  compId: number,
  data: {
    source: { member_id?: number | null; member_name: string; guest_phone?: string | null };
    target: { member_id?: number | null; member_name: string; guest_phone?: string | null };
  }
) => api.post(`/api/competitions/${compId}/merge-participants`, data);
export const registerCompetition = (compId: number) => api.post(`/api/competitions/${compId}/register`);
export const checkRegistrationStatus = (compId: number) => api.get(`/api/competitions/${compId}/my-status`);
export const getCompetitionRegistrations = (compId: number) => api.get(`/api/competitions/${compId}/registrations`);
export const updateRegistrationStatus = (compId: number, memberId: number, status: string) =>
  api.put(`/api/competitions/${compId}/registrations/${memberId}`, { status });
export const updateCompetitionEvent = (eventId: number, data: { title: string, description: string, score_type: string, time_cap?: number | null, max_reps?: number | null }) =>
  api.put(`/api/competitions/events/${eventId}`, data);
export const deleteCompetitionEvent = (eventId: number) => api.delete(`/api/competitions/events/${eventId}`);

// ✅ [신규] 엑셀 내보내기/가져오기 API 추가
export const exportEventExcel = (eventId: number) =>
  api.get(`/api/competitions/events/${eventId}/export-excel`, { responseType: 'blob' });
export const exportEventTemplate = (eventId: number) =>
  api.get(`/api/competitions/events/${eventId}/export-template`, { responseType: 'blob' });
export const importEventExcel = (eventId: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/api/competitions/events/${eventId}/import-excel`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// ✅ [신규] 코치 검증 API
export const getMyGymMembersRecords = (compId: number, eventId?: number): Promise<{ data: any[] }> =>
  eventId ? api.get(`/api/competitions/${compId}/my-gym-members?event_id=${eventId}`) : api.get(`/api/competitions/${compId}/my-gym-members`);
export const updateScoreStatus = (scoreId: number, status: string) =>
  api.patch(`/api/competitions/scores/${scoreId}/status`, { status });
export const deleteScore = (scoreId: number) =>
  api.delete(`/api/competitions/scores/${scoreId}`);
export const coachSubmitScore = (
  eventId: number,
  data: {
    member_id: number | null,
    guest_name?: string,
    guest_phone?: string,
    guest_gender?: string,
    score_value: string,
    is_rx: boolean,
    scale_rank?: string | null,
    is_time_cap?: boolean,
    tie_break?: string,
    note?: string
  }
) => api.post(`/api/competitions/events/${eventId}/coach-submit`, data);

export const coachSubmitBulkScore = (
  eventId: number,
  data: Array<{
    member_id: number | null;
    guest_name?: string;
    guest_phone?: string;
    guest_gender?: string;
    score_value: string;
    is_rx: boolean;
    scale_rank?: string | null;
    is_time_cap?: boolean;
    tie_break?: string;
    note?: string;
  }>
) => api.post(`/api/competitions/events/${eventId}/bulk-submit`, data);


// ==========================================
// 6. 📅 출석 (Attendance)
// ==========================================
export const checkIn = (data: { phone_last4: string }) => api.post('/api/attendance/check-in', data);
export const getTodayAttendance = (): Promise<{ data: AttendanceResponse[] }> => api.get('/api/attendance/today');


// ==========================================
// 7. 💰 매출 (Sales)
// ==========================================
export const getSales = () => api.get('/api/sales/');
export const createSale = (data: any) => api.post('/api/sales/', data);
export const createSaleWithExtension = (data: any) => api.post('/api/sales/with-extension/', data);
export const deleteSale = (id: number) => api.delete(`/api/sales/${id}`);
export const updateMemberMemo = (id: number, memo: string) => api.put(`/api/members/${id}/memo`, { memo });
export const updateMemberTags = (id: number, tags: string) => api.put(`/api/members/${id}/tags`, { tags });
export const batchExtendMembership = (memberIds: number[], days: number) =>
  api.post(`/api/members/batch-extend`, { member_ids: memberIds, days });
export const extendAllActiveMembers = (days: number) => api.post(`/api/members/extend-all-active`, { days });


// ==========================================
// 8. 💸 지출 (Expenses)
// ==========================================
export const getExpenses = () => api.get('/api/expenses');
export const createExpense = (data: any) => api.post('/api/expenses', data);
export const deleteExpense = (id: number) => api.delete(`/api/expenses/${id}`);


// ==========================================
// 9. 🔔 알림 & 대시보드
// ==========================================
export const getMyNotifications = () => api.get('/api/notifications/');
export const getUnreadCount = () => api.get('/api/notifications/unread-count');
export const markNotificationRead = (id: number) => api.put(`/api/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.put('/api/notifications/read-all');

export const sendNotification = (data: any) => api.post('/api/notifications', data);
export const checkExpiryNotifications = () => api.post('/api/crm/run-daily-check');
export const getExpiryFollowUps = () => api.get('/api/crm/expiry-followups');
export const updateExpiryFollowUp = (data: { member_id: number; trigger_type: string; status: string; note?: string; contact_method?: string | null }) =>
  api.put('/api/crm/expiry-followups', data);
export const sendBroadcast = (data: { target_group: string, title: string, message: string, type: string }) =>
  api.post('/api/notifications/broadcast', data);
export const addStaffTask = (content: string) => api.post('/api/dashboard/tasks', { content });
export const toggleStaffTask = (taskId: number) => api.put(`/api/dashboard/tasks/${taskId}/toggle`);
export const deleteStaffTask = (taskId: number) => api.delete(`/api/dashboard/tasks/${taskId}`);
export const createHoldByAdmin = (memberId: number, data: { start_date: string, end_date: string }) =>
  api.post(`/api/members/${memberId}/hold`, data);

// 드랍인 예약 대기 건수 (배지용)
export const getPendingDropInCount = () => api.get('/api/dropin/pending-count');


// ==========================================
// 10. 🎯 목표 설정 (Goals)
// ==========================================
export const getMyGoals = () => api.get('/api/goals/');
export const createGoal = (data: { title: string, category: string, target_value: number, current_value?: number, unit?: string, deadline?: string }) =>
  api.post('/api/goals/', data);
export const updateGoal = (id: number, data: { current_value?: number, status?: string }) =>
  api.put(`/api/goals/${id}`, data);
export const deleteGoal = (id: number) => api.delete(`/api/goals/${id}`);

// ==========================================
// 10. 🔑 총관리자 (Super Admin)
// ==========================================

// 대시보드 통계
export const getSuperAdminStats = () => api.get('/api/superadmin/stats');

// 체육관(지점) 관리
export const getAllGyms = () => api.get('/api/superadmin/gyms');
export const createGym = (data: { name: string, location?: string }) => api.post('/api/superadmin/gyms', data);
export const updateGym = (gymId: number, data: any) =>
  api.put(`/api/superadmin/gyms/${gymId}`, data);
export const deleteGym = (gymId: number) => api.delete(`/api/superadmin/gyms/${gymId}`);
export const getGymStats = (gymId: number) => api.get(`/api/superadmin/gyms/${gymId}/stats`);

// 코치/관리자 계정 관리
export const getAllCoaches = () => api.get('/api/superadmin/coaches');
export const createCoach = (data: { gym_id: number, name: string, phone: string, password: string, role: string }) =>
  api.post('/api/superadmin/coaches', data);
export const updateCoach = (coachId: number, data: { role?: string; is_active?: boolean; password?: string }) =>
  api.put(`/api/superadmin/coaches/${coachId}`, data);
export const deleteCoach = (coachId: number) => api.delete(`/api/superadmin/coaches/${coachId}`);
export const addCoachToGym = (coachId: number, targetGymId: number) =>
  api.post(`/api/members/${coachId}/add-to-gym/${targetGymId}`, {});

// 시스템 공지
export const sendSystemAnnouncement = (data: { title: string, message: string, target: string, file?: File }) => {
  const formData = new FormData();
  formData.append('title', data.title);
  formData.append('message', data.message);
  formData.append('target', data.target);
  if (data.file) formData.append('file', data.file);

  return api.post('/api/superadmin/announcements', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
export const getSystemAnnouncements = () => api.get('/api/superadmin/announcements');
export const toggleSystemAnnouncementVisibility = (postId: number, is_popup: boolean) =>
  api.put(`/api/superadmin/announcements/${postId}/visibility`, { is_popup });


// ==========================================
// 11. ⚙️ 설정 (Membership Settings)
// ==========================================
export const getProducts = () => api.get('/api/settings/products');
export const createProduct = (data: { name: string, price: number, months?: number, category?: string }) => api.post('/api/settings/products', data);
export const deleteProduct = (id: number) => api.delete(`/api/settings/products/${id}`);

// Sub-Coaches
export const getSubCoaches = () => api.get('/api/settings/sub-coaches');
export const createSubCoach = (data: { name: string, phone: string, password: string, hourly_wage: number, class_wage: number, color: string, permission_ids: number[] }) =>
  api.post('/api/settings/sub-coaches', data);
export const deleteSubCoach = (id: number) => api.delete(`/api/settings/sub-coaches/${id}`);
export const updateSubCoach = (id: number, data: { name?: string, phone?: string, password?: string, hourly_wage?: number, class_wage?: number, color?: string, permission_ids?: number[] }) =>
  api.put(`/api/settings/sub-coaches/${id}`, data);
export const getAllPermissions = () => api.get('/api/settings/permissions');

// Notification Templates
export const getNotificationTemplates = () => api.get('/api/settings/notification-templates');
export const createNotificationTemplate = (data: { type: string, title: string, message: string }) =>
  api.post('/api/settings/notification-templates', data);
export const updateNotificationTemplate = (id: number, data: { title?: string, message?: string }) =>
  api.put(`/api/settings/notification-templates/${id}`, data);
export const resetNotificationTemplate = (templateType: string) =>
  api.post(`/api/settings/notification-templates/reset/${templateType}`);


// ==========================================
// 12. 📅 수업 예약 (Classes)
// ==========================================
export const getClassSchedules = (date: string) => api.get('/api/classes/', { params: { date_str: date } });
export const createClassSchedule = (data: { title: string, date: string, time: string, max_participants: number }) => api.post('/api/classes/', data);
export const reserveClass = (scheduleId: number) => api.post(`/api/classes/${scheduleId}/reserve`);
export const cancelReservation = (scheduleId: number) => api.delete(`/api/classes/${scheduleId}/reserve`);
export const getClassReservations = (scheduleId: number) => api.get(`/api/classes/${scheduleId}/reservations`);
export const getMyReservations = (includePast = false) =>
  api.get('/api/classes/my', { params: { include_past: includePast } });

// 🔄 고정 스케줄 (템플릿)
export const getClassTemplates = () => api.get('/api/classes/templates');
export const createClassTemplate = (data: { title: string, time: string, max_participants: number, days_of_week: string }) => api.post('/api/classes/templates', data);
export const deleteClassTemplate = (id: number) => api.delete(`/api/classes/templates/${id}`);

// ==========================================
// 13. 유틸리티 (Utility)
// ==========================================
export const geocodeAddress = (address: string) => api.post('/api/superadmin/geocode', { address });

// ==========================================
// 14. 🏋️ 드랍인 (Drop-In)
// ==========================================
export const getDropInGyms = (region?: string) => api.get('/api/dropin/gyms', { params: { region } });
export const createDropInReservation = (data: { gym_id: number, date: string }) => api.post('/api/dropin/reservations', data);
export const getMyDropInReservations = () => api.get('/api/dropin/my-reservations');

// ✅ [신규] 관리자용 드랍인 예약 관리
export const getGymReservations = () => api.get('/api/dropin/manage');
export const updateReservationStatus = (reservationId: number, status: string) =>
  api.put(`/api/dropin/${reservationId}/status`, { status });
export const getDropInPendingCount = () => api.get('/api/dropin/pending-count');
export const getDropInConversionStats = () => api.get('/api/dropin/conversion-stats');

// ✅ [신규] 대회 - 박스 연합 API
export const searchGyms = (query: string) => api.get('/api/dropin/gyms', { params: { query } });
export const addGymToCompetition = (compId: number, gymId: number) => api.post(`/api/competitions/${compId}/gyms`, { gym_id: gymId });
export const getParticipatingGyms = (compId: number) => api.get(`/api/competitions/${compId}/gyms`);
export const removeGymFromCompetition = (compId: number, gymId: number) => api.delete(`/api/competitions/${compId}/gyms/${gymId}`);


// ==========================================
// 15. 🥗 식단 (Diet)
// ==========================================
export interface DietLog {
  id: number;
  member_id: number;
  date: string;
  meal_type: string;
  content: string;
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  image_url?: string;
  created_at: string;
}

export const getDietLogs = (date: string): Promise<{ data: DietLog[] }> => api.get('/api/diet', { params: { date_str: date } });
export const getRecentDietLogs = (days: number = 30): Promise<{ data: DietLog[] }> => api.get('/api/diet/recent', { params: { days } });

export const createDietLog = (data: { date: string, meal_type: string, content: string, calories?: number, carbs?: number, protein?: number, fat?: number, file?: File }) => {
  const formData = new FormData();
  formData.append('date', data.date);
  formData.append('meal_type', data.meal_type);
  formData.append('content', data.content);
  if (data.calories) formData.append('calories', data.calories.toString());
  if (data.carbs) formData.append('carbs', data.carbs.toString());
  if (data.protein) formData.append('protein', data.protein.toString());
  if (data.fat) formData.append('fat', data.fat.toString());
  if (data.file) formData.append('file', data.file);

  return api.post('/api/diet', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const updateDietLog = (id: number, data: { date?: string, meal_type?: string, content?: string, calories?: number, carbs?: number, protein?: number, fat?: number, file?: File, deleteImage?: boolean }) => {
  const formData = new FormData();
  if (data.date) formData.append('date', data.date);
  if (data.meal_type) formData.append('meal_type', data.meal_type);
  if (data.content) formData.append('content', data.content);
  if (data.calories !== undefined) formData.append('calories', data.calories ? data.calories.toString() : "");
  if (data.carbs !== undefined) formData.append('carbs', data.carbs ? data.carbs.toString() : "");
  if (data.protein !== undefined) formData.append('protein', data.protein ? data.protein.toString() : "");
  if (data.fat !== undefined) formData.append('fat', data.fat ? data.fat.toString() : "");
  if (data.file) formData.append('file', data.file);
  if (data.deleteImage) formData.append('delete_image', "true");

  return api.put(`/api/diet/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const deleteDietLog = (id: number) => api.delete(`/api/diet/${id}`);

export const analyzeDietImage = (file: File): Promise<{ data: { menu_name: string, calories: number, carbs: number, protein: number, fat: number, comment: string } }> => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/diet/analyze-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export interface OpenPercentileEstimateRequest {
  year: number;
  event: number;
  gender: 'male' | 'female';
  is_rx?: boolean;
  country?: string;
  score_mode: 'time' | 'reps';
  score_value: string;
}

export interface OpenPercentileEstimateResponse {
  year: number;
  event: number;
  gender: 'male' | 'female';
  is_rx: boolean;
  country: string;
  total_competitors: number;
  estimated_rank: number;
  percentile: number;
  top_percent: number;
  sampled_rows: number;
  sampled_at: string;
  note: string;
}

export const estimateOpenPercentile = (data: OpenPercentileEstimateRequest): Promise<{ data: OpenPercentileEstimateResponse }> =>
  api.post('/api/open-percentile/estimate', data);

export const generateDailyReport = (date: string): Promise<{ data: { score: number, summary: string, advice: string } }> => {
  return api.post('/api/ai/daily-report', { date });
};


// ===================================
// 12. 메시지 (1:1 DM)
// ===================================
export const sendMessage = (receiver_id: number, message: string) => api.post('/api/messages/', { receiver_id, message });
export const getConversations = () => api.get<any[]>('/api/messages/conversations');
export const getMessages = (partner_id: number) => api.get<any[]>(`/api/messages/${partner_id}`);
export const getUnreadMessageCount = () => api.get<number>('/api/messages/unread/count');


// ===================================
// 14. 수업 배정 (Coaching Class)
// ===================================
export const getCoachingClasses = (gymId?: number) =>
  api.get('/api/coaching-classes/', { params: { gym_id: gymId } });

export const createCoachingClass = (data: {
  title: string;
  start_time: string;
  end_time: string;
  days_of_week: string;
  max_participants?: number;
  description?: string;
  color?: string;
}) => api.post('/api/coaching-classes/', data);

export const updateCoachingClass = (id: number, data: {
  title?: string;
  start_time?: string;
  end_time?: string;
  days_of_week?: string;
  max_participants?: number;
  description?: string;
  color?: string;
  is_active?: boolean;
}) => api.put(`/api/coaching-classes/${id}`, data);

export const deleteCoachingClass = (id: number) =>
  api.delete(`/api/coaching-classes/${id}`);

export const getCoachingClassCalendar = (yearMonth: string, gymId?: number) =>
  api.get('/api/coaching-classes/calendar/monthly', {
    params: { year_month: yearMonth, gym_id: gymId }
  });

export const createCoachingClassAssignment = (data: {
  coaching_class_id: number;
  coach_id: number;
  date: string;
  memo?: string;
}) => api.post('/api/coaching-classes/assignments', data);

export const deleteCoachingClassAssignment = (id: number) =>
  api.delete(`/api/coaching-classes/assignments/${id}`);

export const copyCoachingClassAssignmentsByDay = (data: {
  source_date: string;
  target_date: string;
}) => api.post('/api/coaching-classes/assignments/copy-day', data);

export const copyCoachingClassAssignmentsByWeek = (data: {
  source_week_start: string;
  target_week_start: string;
}) => api.post('/api/coaching-classes/assignments/copy-week', data);

export const getCoachingClassStats = (yearMonth: string, gymId?: number) =>
  api.get('/api/coaching-classes/stats/monthly', {
    params: { year_month: yearMonth, gym_id: gymId }
  });

export const autoAssignCoachingClasses = (data: {
  year_month: string;
  rules: string;
}) => api.post('/api/coaching-classes/auto-assign', data);


export default api;
