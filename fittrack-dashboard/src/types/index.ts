// src/types/index.ts

export interface Member {
  id: number;
  name: string;
  phone: string;
  status: string;
  membership: string;
  join_date: string;
  role?: string;
  gym_id?: number;
  must_change_password?: boolean;
  memo?: string;
  color?: string; // ✅ [추가] 코치 고유 색상
  start_date?: string;
  end_date?: string;
  unpaid_amount?: number;
  unpaid_sales_count?: number;
  last_attendance_date?: string;
  days_since_last_attendance?: number | null;
  expiring_soon?: boolean;

  // 신체 정보
  gender?: string;
  birth_date?: string;   // 'YYYY-MM-DD'
  height?: number;
  weight?: number;
  activity_level?: string;
  workout_goal?: string;

  // 멀티 박스 지원 필드
  available_gyms?: any[];
}

export interface Comment {
  id: number;
  post_id: number;
  author_id: number;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Gym {
  id: number;
  name: string;
}

export interface Workout {
  id: number;
  member_id: number;
  member_name: string;
  date: string;
  workout: string;
  time: string;
  type?: string;
  description?: string;
  created_at?: string;
  notes?: string;
}

// 대시보드 그래프용
export interface ChartData {
  date: string;
  value: number;
}

export interface DashboardStats {
  active_members: number;
  monthly_sales: number;
  today_attendance: number;
  action_items: {
    unpaid_members_count: number;
    unpaid_amount: number;
    expiring_followups_count: number;
    dropin_followups_count: number;
    unread_inquiries_count: number;
  };

  expiring_members: {
    id: number;
    name: string;
    days_left: number;
    end_date: string;
  }[];

  recent_members: {
    id: number;
    name: string;
    join_date: string;
  }[];

  weekly_sales_data: {
    date: string;
    sales: number;
  }[];

  // ✅ [필수 추가] 이 부분이 없어서 에러가 났던 겁니다!
  staff_tasks: {
    id: number;
    content: string;
    is_completed: boolean;
    created_at: string;
  }[];

  // ✅ [신규] MRR 추가
  estimated_mrr: number;

  // 🗑️ (삭제해도 되지만 에러 방지용으로 ? 남겨둠)
  staff_memo?: any;
  wod_ranking?: any[];
}

export interface MemberFormData {
  name: string;
  phone: string;
  status: string;
  membership: string;
}

export interface Sale {
  id: number;
  member_id: number;
  item_name: string;
  category: string;
  amount: number;
  payment_method: string;
  status: string;
  payment_date: string;
  member_name: string;
}

export interface WodVideo {
  url: string;
  comment?: string;
}

export interface Wod {
  id: number;
  gym_id: number;
  date: string;
  title: string;
  content: string;
  description?: string; // ✅ 추가: 참고사항/코치 가이드
  videos: WodVideo[]; // ✅ youtube_url 대신 이거 사용
  created_at: string;
  score_type: string;
  is_rest_day: boolean;
  is_team?: boolean; // ✅ 추가: 팀 와드 여부
  team_size?: number; // ✅ 추가: 팀 인원 수
}

export interface WodRecord {
  id: number;
  wod_id: number;
  member_id: number;
  member_name: string;
  record_value: string;
  is_rx: boolean;
  scale_rank?: string; // ✅ 추가
  is_time_cap?: boolean; // ✅ 추가
  note: string;
  created_at: string;
  wod_date?: string; // ✅ 추가됨
}

export interface PersonalRecord {
  id: number;
  exercise_name: string;
  record_value: string;
  recorded_date: string;
}

export interface Goal {
  id: number;
  member_id: number;
  title: string;
  category: string;  // pr, attendance, body, wod
  target_value: number;
  current_value: number;
  unit: string;
  deadline?: string;
  status: string;  // 진행중, 달성, 포기
  created_at: string;
  completed_at?: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
  category: string;
  author_id: number;
  comments?: Comment[];
}

export interface Competition {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  creator_id?: number;
  is_private: boolean;
  show_leaderboard_to_all: boolean;
  show_wod_to_all: boolean;
  anonymize_for_all: boolean;
  guest_passcode?: string;
  allow_invited_gym_settings: boolean; // ✅ [신규] 초대된 박스 어드민 설정 허용
  participating_gyms: CompetitionGym[];
  admin_names?: string[]; // ✅ [신규] 대회 관리자(코치) 이름 목록
  sort_order?: number;    // ✅ [신규] 노출 순서 (총관리자 제어용)
  is_hidden?: boolean;    // ✅ [신규] 숨김 여부 (게스트 페이지 노출 안 함)
}

export interface CompetitionGym {
  id: number;
  competition_id: number;
  gym_id: number;
  gym_name?: string; // ✅ [신규]
  status: 'pending' | 'accepted' | 'rejected';
}

export interface CompetitionEvent {
  id: number;
  competition_id: number;
  title: string;
  description: string;
  score_type: 'time' | 'weight' | 'reps';
  time_cap?: number; // ✅ 초 단위 타임캡 (예: 1200)
  max_reps?: number; // 최대 렙수
}

export interface CompLeaderboardItem {
  rank: number;
  member_name: string;
  score_value: string;
  is_rx: boolean;
  scale_rank?: string; // ✅ 추가
  is_time_cap?: boolean; // ✅ 추가
  tie_break?: string;
  note?: string;
  gender?: string; // ✅ [신규]
  gym_name?: string; // ✅ [신규] 소속 박스명
  status?: string; // ✅ [신규] 기록 상태 (pending/approved/rejected)
  guest_phone?: string; // ✅ [신규] 게스트 전화번호 (동명이인 구분)
}

export interface OverallLeaderboardItem {
  rank: number;
  member_id: number | null;
  member_name: string;
  total_points: number;
  event_details: { [key: string]: number };
  gender?: string; // ✅ [신규]
  gym_name?: string; // ✅ [신규] 소속 박스명
  guest_phone?: string; // ✅ [신규] 게스트 전화번호 (동명이인 구분)
}

export interface AttendanceResponse {
  member_name: string;
  check_in_time: string;
}

// ▼▼▼ [신규 추가] 마이페이지 통계 데이터 타입
export interface MyStats {
  attendance_history: {
    month: string; // "2026-01"
    count: number; // 출석 횟수
  }[];
  pr_history: {
    date: string;  // 기록 날짜
    exercise_name: string; // 종목 (예: Deadlift)
    record_value: number;  // 무게 (kg)
  }[];
}

export interface PostResponse {
  id: number;
  gym_id?: number;
  board_type: string;
  title: string;
  content: string;
  author_id: number;
  author_name: string;
  created_at: string;
  views: number;
  image_url?: string;
  region?: string;
  market_status: string;
  youtube_url?: string;
  wod_record?: string;
  like_count: number;
  is_liked: boolean;
  is_popup: boolean;
  popup_expires_at?: string;
  comments: Comment[];
}

// ✅ Coaching Class (수업 배정)
export interface CoachingClass {
  id: number;
  gym_id: number;
  title: string;
  start_time: string;
  end_time: string;
  days_of_week: string; // "0,1,2,3,4" (월~금)
  max_participants: number;
  description?: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CoachingClassAssignment {
  id: number;
  coaching_class_id: number;
  coaching_class_title: string;
  coach_id: number;
  coach_name: string;
  date: string;
  status: string; // scheduled, completed, cancelled
  memo?: string;
  created_at: string;
}

export interface CoachingClassCalendarDay {
  coaching_class: CoachingClass;
  assigned_coaches: {
    assignment_id: number;
    coach_id: number;
    coach_name: string;
    status: string;
  }[];
}

export interface CoachingClassStats {
  coach_id: number;
  coach_name: string;
  class_count: number;
  class_wage: number;
  expected_wage: number;
}
