import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getDashboardStats, runDailyCrmCheck, addStaffTask, toggleStaffTask, deleteStaffTask, getClassSchedules, getMyStats, getPosts } from '../../services/api';
import { useAppContext } from '../../contexts/AppContext'; // ✅ AppContext 추가
import { DashboardStats } from '../../types';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, DollarSign, TrendingUp, CheckCircle, Calendar, AlertCircle, UserPlus, ClipboardList, Bell, Plus, Trash2, ChevronRight, Check, MessageSquareMore, CreditCard, UserCog } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

interface ClassSchedule {
  id: number;
  title: string;
  time: string;
  max_participants: number;
  current_participants: number;
}

// Inferred types based on the provided code snippet
interface MyStats {
  // Define properties for myStats if known
}

interface Notice {
  id: number;
  title: string;
  // Define other properties for notice if known
}

interface User {
  name: string;
  // Define other properties for user if known
}

const Dashboard: React.FC = () => {
  const { user } = useAppContext(); // ✅ 전역 User 사용

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [crmLoading, setCrmLoading] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [todayClasses, setTodayClasses] = useState<ClassSchedule[]>([]);
  // Inferred states from the provided code
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);

  const fetchStats = async () => { // ✅ 원래 이름 유지
    try {
      const res = await getDashboardStats();
      setStats(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayClasses = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await getClassSchedules(todayStr);
      setTodayClasses(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMyStats = async () => {
    try {
      const res = await getMyStats();
      setMyStats(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchNotices = async () => {
    try {
      const res = await getPosts('notice'); // Assuming getPosts takes a type argument
      setNotices(res.data.slice(0, 3));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchTodayClasses();
    fetchMyStats();
    fetchNotices();
    const interval = setInterval(fetchTodayClasses, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRunCrmCheck = async () => {
    if (crmLoading) return;
    if (!window.confirm("🔔 알림을 전체 발송하시겠습니까?")) return;
    setCrmLoading(true);
    try {
      const res = await runDailyCrmCheck();
      toast.success(`${res.data.alerts_sent}명에게 알림 발송!`);
    } catch (e) {
      toast.error("알림 발송 실패");
    } finally {
      setCrmLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    try {
      await addStaffTask(newTask);
      setNewTask("");
      fetchStats(); // Changed from fetchDashboardStats
      toast.success("할 일이 추가되었습니다.");
    } catch (e) { toast.error("추가 실패"); }
  };

  const handleToggleTask = async (taskId: number) => {
    try { await toggleStaffTask(taskId); fetchStats(); } catch (e) { }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try { await deleteStaffTask(taskId); fetchStats(); toast.success("삭제되었습니다."); } catch (e) { toast.error("삭제 실패"); }
  };

  // 화면 너비 감지 (PC: >1280, Tablet: 768~1280, Mobile: <768)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth <= 1280; // 아이패드 에어 5 (1180px) 대응을 위해 1280으로 확장

  if (loading) return (
    <div style={styles.loadingContainer}>
      <div style={styles.loadingText}>데이터를 불러오는 중...</div>
    </div>
  );
  if (!stats) return null;
  const actionItems = stats.action_items ?? {
    unpaid_members_count: 0,
    unpaid_amount: 0,
    expiring_followups_count: 0,
    dropin_followups_count: 0,
    unread_inquiries_count: 0,
  };

  return (
    <div style={{ ...styles.container, padding: isMobile ? '16px 0' : '32px 40px' }}>
      <header style={{ ...styles.header, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: isMobile ? '16px' : '0' }}>
        <div>
          <h1 style={{ ...styles.pageTitle, fontSize: isMobile ? '24px' : '32px' }}>대시보드</h1>
          <p style={{ ...styles.pageSubtitle, fontSize: isMobile ? '14px' : '16px' }}>오늘의 체육관 현황</p>
        </div>
        <div style={styles.dateBadge}>{new Date().toLocaleDateString()}</div>
      </header>

      {/* 1. 상단 통계 (PC: 4열, 태블릿: 2열, 모바일: 2열 스크롤 지원 고려) */}
      <section style={{
        ...styles.statsGrid,
        gridTemplateColumns: (isMobile || isTablet) ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '12px' : '20px'
      }}>
        <div className="hover-card" style={{ ...styles.statCard, padding: isMobile ? '12px' : (isTablet ? '20px' : '28px'), gap: isMobile ? '8px' : '16px' }}>
          <div style={{ ...styles.statIcon, width: isMobile ? '36px' : (isTablet ? '48px' : '56px'), height: isMobile ? '36px' : (isTablet ? '48px' : '56px'), backgroundColor: '#E8F3FF', color: TOSS_BLUE }}><Users size={isMobile ? 18 : (isTablet ? 22 : 24)} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={styles.statLabel}>활성 회원</div><div style={{ ...styles.statValue, fontSize: isMobile ? '18px' : (isTablet ? '24px' : '26px') }}>{stats.active_members}<span style={styles.statUnit}>명</span></div></div>
        </div>
        <div className="hover-card" style={{ ...styles.statCard, padding: isMobile ? '12px' : (isTablet ? '20px' : '28px'), gap: isMobile ? '8px' : '16px' }}>
          <div style={{ ...styles.statIcon, width: isMobile ? '36px' : (isTablet ? '48px' : '56px'), height: isMobile ? '36px' : (isTablet ? '48px' : '56px'), backgroundColor: '#ECFDF5', color: '#059669' }}><DollarSign size={isMobile ? 18 : (isTablet ? 22 : 24)} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.statLabel}>이번 달 매출</div>
            <div style={{
              ...styles.statValue,
              color: '#059669',
              fontSize: isMobile ? (stats.monthly_sales.toString().length > 7 ? '15px' : '17px') : (isTablet ? (stats.monthly_sales.toString().length > 8 ? '20px' : '24px') : (stats.monthly_sales.toString().length > 8 ? '20px' : stats.monthly_sales.toString().length > 6 ? '22px' : '26px'))
            }}>
              {stats.monthly_sales.toLocaleString()}<span style={styles.statUnit}>원</span>
            </div>
          </div>
        </div>
        <div className="hover-card" style={{ ...styles.statCard, padding: isMobile ? '12px' : (isTablet ? '20px' : '28px'), gap: isMobile ? '8px' : '16px' }}>
          <div style={{ ...styles.statIcon, width: isMobile ? '36px' : (isTablet ? '48px' : '56px'), height: isMobile ? '36px' : (isTablet ? '48px' : '56px'), backgroundColor: '#F3E8FF', color: '#7C3AED' }}><TrendingUp size={isMobile ? 18 : (isTablet ? 22 : 24)} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.statLabel}>예상 MRR</div>
            <div style={{
              ...styles.statValue,
              color: '#7C3AED',
              fontSize: isMobile ? ((stats.estimated_mrr || 0).toString().length > 7 ? '14px' : '16px') : (isTablet ? ((stats.estimated_mrr || 0).toString().length > 8 ? '18px' : '22px') : ((stats.estimated_mrr || 0).toString().length > 8 ? '20px' : (stats.estimated_mrr || 0).toString().length > 6 ? '22px' : '26px'))
            }}>
              {(stats.estimated_mrr || 0).toLocaleString()}<span style={styles.statUnit}>원</span>
            </div>
          </div>
        </div>
        <div className="hover-card" style={{ ...styles.statCard, padding: isMobile ? '12px' : (isTablet ? '20px' : '28px'), gap: isMobile ? '8px' : '16px' }}>
          <div style={{ ...styles.statIcon, width: isMobile ? '36px' : (isTablet ? '48px' : '56px'), height: isMobile ? '36px' : (isTablet ? '48px' : '56px'), backgroundColor: '#FFF7ED', color: '#EA580C' }}><CheckCircle size={isMobile ? 18 : (isTablet ? 22 : 24)} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={styles.statLabel}>오늘 출석</div><div style={{ ...styles.statValue, color: '#EA580C', fontSize: isMobile ? '18px' : (isTablet ? '24px' : '26px') }}>{stats.today_attendance}<span style={styles.statUnit}>명</span></div></div>
        </div>
      </section>

      <section style={{ ...styles.actionGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '16px' }}>
        <Link to="/members" style={{ ...styles.actionWidget, textDecoration: 'none' }}>
          <div style={styles.actionWidgetHeader}>
            <div style={{ ...styles.actionIconBox, backgroundColor: '#FFF7ED', color: '#EA580C' }}><CreditCard size={18} /></div>
            <span style={styles.actionLink}>회원 보기 <ChevronRight size={14} /></span>
          </div>
          <div style={styles.actionValue}>{actionItems.unpaid_members_count}명</div>
          <div style={styles.actionTitle}>미수금 회원</div>
          <div style={styles.actionDescription}>누적 미수 {actionItems.unpaid_amount.toLocaleString()}원</div>
        </Link>

        <Link to="/notifications" style={{ ...styles.actionWidget, textDecoration: 'none' }}>
          <div style={styles.actionWidgetHeader}>
            <div style={{ ...styles.actionIconBox, backgroundColor: '#FEE2E2', color: '#EF4444' }}><Bell size={18} /></div>
            <span style={styles.actionLink}>후속 관리 <ChevronRight size={14} /></span>
          </div>
          <div style={styles.actionValue}>{actionItems.expiring_followups_count}건</div>
          <div style={styles.actionTitle}>재등록 후속 필요</div>
          <div style={styles.actionDescription}>30일 내 만료 회원 중 아직 완료되지 않은 항목</div>
        </Link>

        <Link to="/dropin-manage" style={{ ...styles.actionWidget, textDecoration: 'none' }}>
          <div style={styles.actionWidgetHeader}>
            <div style={{ ...styles.actionIconBox, backgroundColor: '#ECFDF5', color: '#059669' }}><UserCog size={18} /></div>
            <span style={styles.actionLink}>드랍인 관리 <ChevronRight size={14} /></span>
          </div>
          <div style={styles.actionValue}>{actionItems.dropin_followups_count}건</div>
          <div style={styles.actionTitle}>드랍인 후속 필요</div>
          <div style={styles.actionDescription}>최근 7일 확정 예약 중 등록 전환이 아직 없는 인원</div>
        </Link>

        <Link to="/inbox" style={{ ...styles.actionWidget, textDecoration: 'none' }}>
          <div style={styles.actionWidgetHeader}>
            <div style={{ ...styles.actionIconBox, backgroundColor: '#E8F3FF', color: TOSS_BLUE }}><MessageSquareMore size={18} /></div>
            <span style={styles.actionLink}>문의함 <ChevronRight size={14} /></span>
          </div>
          <div style={styles.actionValue}>{actionItems.unread_inquiries_count}건</div>
          <div style={styles.actionTitle}>읽지 않은 문의</div>
          <div style={styles.actionDescription}>현재 계정에 도착한 미확인 메시지</div>
        </Link>
      </section>

      {/* 2. 메인 컨텐츠 (모바일에서는 세로 1열) */}
      <div style={{ ...styles.mainGrid, gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? '16px' : '24px' }}>
        {/* 주간 매출 차트 */}
        <section className="dashboard-card hover-card" style={{ ...styles.card, padding: isMobile ? '20px' : '28px' }}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleRow}>
              <div style={styles.iconBox}><TrendingUp size={20} color={TOSS_BLUE} /></div>
              <h2 style={styles.sectionTitle}>주간 매출 추이</h2>
            </div>
          </div>
          <div style={{ height: isMobile ? '200px' : '280px', width: '100%', minWidth: 0 }}>
            {/* ✅ [수정] Recharts 에러 방지 (minWidth 추가) */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={stats.weekly_sales_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} dy={5} />
                <Tooltip
                  cursor={{ stroke: TOSS_BLUE, strokeWidth: 1, strokeDasharray: '4 4' }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()}원`, '매출']}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    padding: '10px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)'
                  }}
                  itemStyle={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="sales" stroke={TOSS_BLUE} strokeWidth={2} dot={{ fill: '#FFFFFF', stroke: TOSS_BLUE, strokeWidth: 2, r: 3 }} activeDot={{ r: 5, fill: TOSS_BLUE, stroke: '#FFFFFF', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 오늘의 수업 */}
        <section className="dashboard-card hover-card" style={{ ...styles.card, padding: isMobile ? '20px' : '28px' }}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleRow}>
              <div style={{ ...styles.iconBox, backgroundColor: '#E8F3FF' }}><Calendar size={20} color={TOSS_BLUE} /></div>
              <h2 style={styles.sectionTitle}>오늘의 수업</h2>
            </div>
            <Link to="/schedule" style={styles.linkButton}>전체보기 <ChevronRight size={16} /></Link>
          </div>
          <div style={styles.classList}>
            {todayClasses.length === 0 ? (
              <div style={styles.emptyBox}>
                <p>예정된 수업 없음</p>
              </div>
            ) : todayClasses.slice(0, 4).map((cls) => (
              <div key={cls.id} style={{ ...styles.classItemRow, padding: isMobile ? '12px' : '16px' }}>
                <div style={styles.classTimeBadge}>{cls.time}</div>
                <div style={styles.classInfo}>
                  <div style={{ ...styles.classTitle, fontSize: isMobile ? '14px' : '16px' }}>{cls.title}</div>
                  <div style={styles.progressBarBg}>
                    <div style={{ ...styles.progressBarFill, width: `${Math.min((cls.current_participants / cls.max_participants) * 100, 100)}%`, backgroundColor: cls.current_participants >= cls.max_participants ? '#FF3B30' : TOSS_BLUE }} />
                  </div>
                </div>
                <div style={{ ...styles.classCount, color: cls.current_participants >= cls.max_participants ? '#FF3B30' : '#6B7280', fontSize: isMobile ? '12px' : '14px' }}>
                  {cls.current_participants} <span style={{ color: '#AEB5BC' }}>/ {cls.max_participants}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 3. 하단 3열 (모바일에서는 세로 1열) */}
      <div style={{ ...styles.bottomGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '16px' : '24px' }}>
        {/* 만료 임박 */}
        <section className="dashboard-card hover-card" style={{ ...styles.card, padding: isMobile ? '20px' : '28px' }}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleRow}>
              <div style={{ ...styles.iconBox, backgroundColor: '#FEE2E2' }}><AlertCircle size={20} color="#EF4444" /></div>
              <h2 style={styles.sectionTitle}>만료 임박</h2>
              <span style={styles.countBadge}>{stats.expiring_members.length}</span>
            </div>
            <button onClick={handleRunCrmCheck} disabled={crmLoading} style={{ ...styles.actionButton, padding: isMobile ? '6px 10px' : '8px 14px' }}>
              <Bell size={14} /> {crmLoading ? '...' : '알림'}
            </button>
          </div>
          <div style={styles.scrollList}>
            {stats.expiring_members.length === 0 ? (
              <div style={styles.emptyBox}>만료 회원 없음 🎉</div>
            ) : stats.expiring_members.map((m) => (
              <div key={m.id} style={styles.listItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={styles.miniAvatar}>{m.name[0]}</div>
                  <span style={styles.listName}>{m.name}</span>
                </div>
                <span style={styles.dDayBadge}>D-{m.days_left}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 신규 가입 */}
        <section className="dashboard-card hover-card" style={{ ...styles.card, padding: isMobile ? '20px' : '28px' }}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleRow}>
              <div style={{ ...styles.iconBox, backgroundColor: '#ECFDF5' }}><UserPlus size={20} color="#10B981" /></div>
              <h2 style={styles.sectionTitle}>신규 가입</h2>
            </div>
            <Link to="/members" style={styles.linkButton}>목록 <ChevronRight size={16} /></Link>
          </div>
          <div style={styles.scrollList}>
            {stats.recent_members.length === 0 ? (
              <div style={styles.emptyBox}>최근 가입 없음</div>
            ) : stats.recent_members.map((m) => (
              <div key={m.id} style={styles.listItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ ...styles.miniAvatar, backgroundColor: '#ECFDF5', color: '#059669' }}>{m.name[0]}</div>
                  <span style={styles.listName}>{m.name}</span>
                </div>
                <span style={styles.listDate}>{m.join_date.split('-').slice(1).join('/')}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 스태프 업무 */}
        <section className="dashboard-card hover-card" style={{ ...styles.card, padding: isMobile ? '20px' : '28px' }}>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitleRow}>
              <div style={{ ...styles.iconBox, backgroundColor: '#FFFBEB' }}><ClipboardList size={20} color="#F59E0B" /></div>
              <h2 style={styles.sectionTitle}>업무 리스트</h2>
            </div>
          </div>
          <form onSubmit={handleAddTask} style={styles.taskForm}>
            <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="할 일 입력" style={{ ...styles.taskInput, padding: isMobile ? '10px' : '14px' }} />
            <button type="submit" style={{ ...styles.taskAddButton, width: isMobile ? '40px' : '48px', height: isMobile ? '40px' : '48px' }}><Plus size={20} /></button>
          </form>
          <div style={styles.scrollList}>
            {stats.staff_tasks.length === 0 ? (
              <div style={styles.emptyBox}>완료!</div>
            ) : stats.staff_tasks.map(task => (
              <div key={task.id} style={styles.taskItem}>
                <div
                  onClick={() => handleToggleTask(task.id)}
                  style={{ ...styles.checkbox, backgroundColor: task.is_completed ? '#F59E0B' : '#FFFFFF', borderColor: task.is_completed ? '#F59E0B' : '#E5E8EB' }}
                >
                  {task.is_completed && <Check size={12} color="#FFFFFF" />}
                </div>
                <span style={{ ...styles.taskContent, fontSize: isMobile ? '14px' : '15px', textDecoration: task.is_completed ? 'line-through' : 'none', color: task.is_completed ? '#ADB5BD' : '#333D4B' }}>
                  {task.content}
                </span>
                <button onClick={() => handleDeleteTask(task.id)} style={styles.taskDeleteButton}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};


const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: '32px 40px', backgroundColor: 'var(--bg-main)', minHeight: '100vh', fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif', transition: 'background-color 0.3s' },
  loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-main)' },
  loadingText: { color: 'var(--text-tertiary)', fontSize: '16px', fontWeight: '600' },

  header: { marginBottom: '36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  pageTitle: { fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 8px' },
  pageSubtitle: { fontSize: '16px', color: 'var(--text-secondary)', margin: 0 },
  dateBadge: { padding: '8px 16px', backgroundColor: 'var(--bg-card)', borderRadius: '20px', fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', boxShadow: 'var(--shadow)' },

  // Grids
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' },
  actionGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' },
  mainGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' },
  bottomGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' },

  // Cards
  card: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '28px', boxShadow: 'var(--shadow)', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  sectionTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
  iconBox: { width: '36px', height: '36px', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // Stat Cards
  statCard: { display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '24px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', boxSizing: 'border-box', minWidth: 0 },
  statIcon: { borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statLabel: { fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  statValue: { fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  statUnit: { fontSize: '15px', fontWeight: '600', color: 'var(--text-tertiary)', marginLeft: '4px' },
  actionWidget: { display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '22px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)', color: 'var(--text-primary)' },
  actionWidgetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  actionIconBox: { width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionLink: { display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600' },
  actionValue: { fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)' },
  actionTitle: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' },
  actionDescription: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 },

  // List & Items
  classList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  classItemRow: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', transition: 'background 0.2s' },
  classTimeBadge: { padding: '8px 12px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: '12px', fontSize: '14px', fontWeight: '700' },
  classInfo: { flex: 1, minWidth: 0 },
  classTitle: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  progressBarBg: { width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: '4px', transition: 'width 0.5s ease-out' },
  classCount: { fontSize: '14px', fontWeight: '600', minWidth: '40px', textAlign: 'right' as const },

  scrollList: { overflowY: 'auto', maxHeight: '240px', paddingRight: '8px', flex: 1 },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border-color)' },
  miniAvatar: { width: '32px', height: '32px', borderRadius: '12px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700' },
  listName: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' },
  listDate: { fontSize: '14px', color: 'var(--text-tertiary)' },

  countBadge: { backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '13px', fontWeight: '700', padding: '4px 10px', borderRadius: '12px' },
  dDayBadge: { backgroundColor: 'var(--warning-bg)', color: 'var(--warning)', fontSize: '13px', fontWeight: '700', padding: '6px 10px', borderRadius: '12px' },

  // Buttons
  linkButton: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: '600', transition: 'color 0.2s' },
  actionButton: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', padding: '8px 14px', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'background 0.2s', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' },

  emptyBox: { padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' },

  // Staff Tasks
  taskForm: { display: 'flex', gap: '10px', marginBottom: '20px' },
  taskInput: { flex: 1, padding: '14px', fontSize: '15px', border: '1px solid var(--border-color)', borderRadius: '14px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s' },
  taskAddButton: { width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--text-primary)', color: 'var(--bg-card)', border: 'none', borderRadius: '14px', cursor: 'pointer', transition: 'transform 0.1s' },
  taskItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: '1px solid var(--border-color)' },
  checkbox: { width: '22px', height: '22px', borderRadius: '8px', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  taskContent: { flex: 1, fontSize: '15px', fontWeight: '500' },
  taskDeleteButton: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '6px', transition: 'color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default Dashboard;
