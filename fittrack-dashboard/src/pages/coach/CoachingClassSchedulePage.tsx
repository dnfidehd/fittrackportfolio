import React, { useEffect, useState, useMemo } from 'react';
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Plus, Trash2, X, Edit2, Settings } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import {
  getCoachingClassCalendar,
  createCoachingClassAssignment,
  deleteCoachingClassAssignment,
  copyCoachingClassAssignmentsByDay,
  copyCoachingClassAssignmentsByWeek,
  getCoachingClassStats,
  getCoachesList,
  getCoachingClasses,
  createCoachingClass,
  updateCoachingClass,
  deleteCoachingClass,
  updateMember,
  autoAssignCoachingClasses,
} from '../../services/api';
import { CoachingClassStats, Member, CoachingClass } from '../../types';

const TOSS_BLUE = '#3182F6';
const TOSS_RED = '#EF4444';

const weekDayLabels = ['일', '월', '화', '수', '목', '금', '토'];
const classDayLabels = ['월', '화', '수', '목', '금', '토', '일'];

const styles: { [key: string]: React.CSSProperties } = {
  container: { maxWidth: '1400px', margin: '0 auto', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  pageTitle: { fontSize: '28px', fontWeight: '700', color: '#1F2937', margin: 0 },
  subtitle: { fontSize: '14px', color: '#6B7280', margin: '4px 0 0 0' },
  btnGroup: { display: 'flex', gap: '8px' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s' },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: TOSS_BLUE, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  calendarCard: { backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', marginBottom: '24px' },
  monthNavCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '8px', display: 'flex', alignItems: 'center' },
  monthText: { fontSize: '18px', fontWeight: '700', color: '#1F2937' },
  dayHeaderRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '12px' },
  dayHeader: { padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#6B7280', backgroundColor: '#F9FAFB', borderRadius: '8px' },
  weekRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' },
  dayCell: { height: '160px', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  dayNumber: { fontSize: '13px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' },
  compactList: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }, // 스크롤바 숨김 처리
  compactItem: { fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#374151', width: '100%', overflow: 'hidden' },
  colorDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #E5E7EB' },
  modalTitle: { fontSize: '18px', fontWeight: '700', color: '#1F2937', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#6B7280', display: 'flex' },
  modalContent: { padding: '20px', flex: 1, overflowY: 'auto' },
  modalFooter: { padding: '16px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '12px', justifyContent: 'flex-end' },
  formGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '6px' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' },
  cancelBtn: { padding: '10px 16px', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', color: '#374151', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  submitBtn: { padding: '10px 16px', border: 'none', backgroundColor: TOSS_BLUE, color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  // Detail Modal Specific
  detailClassCard: { padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px', marginBottom: '12px', borderLeftWidth: '4px' },
  detailClassHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  detailClassTitle: { fontWeight: '700', fontSize: '15px', color: '#1F2937', margin: 0 },
  detailClassTime: { fontSize: '13px', color: '#6B7280' },
  coachBadge: { display: 'inline-flex', alignItems: 'center', backgroundColor: '#F3F4F6', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: '#374151', marginRight: '6px', marginBottom: '6px', border: '1px solid transparent' },
  removeBtn: { background: 'none', border: 'none', color: TOSS_RED, cursor: 'pointer', marginLeft: '6px', display: 'flex', alignItems: 'center' },
  addCoachBtn: { backgroundColor: 'white', border: '1px dashed #D1D5DB', color: '#374151', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s', marginTop: '4px' },

  // Manage Classes Specific
  manageGrid: { display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '12px' },
  manageCard: { border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: '4px' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '4px' },
  dayButtonGroup: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' },
  dayButton: { padding: '10px 8px', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', backgroundColor: 'white', textAlign: 'center' },

  // Stats
  statsCard: { backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', marginBottom: '24px' },
  statBox: { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px' },
  statCoachName: { fontWeight: '700', fontSize: '15px', color: '#1F2937', marginBottom: '8px' },
  statRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', color: '#6B7280' },
  statValue: { fontWeight: '600', color: '#1F2937' },
  wageValue: { color: TOSS_BLUE, fontWeight: '700', fontSize: '14px' },
};

const CoachingClassSchedulePage: React.FC = () => {
  const { user } = useAppContext();
  const gymId = user?.gym_id || 1;

  // View States
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);

  // Data States
  const [calendar, setCalendar] = useState<any>({});
  const [stats, setStats] = useState<CoachingClassStats[]>([]);
  const [coaches, setCoaches] = useState<Member[]>([]);
  const [templateClasses, setTemplateClasses] = useState<CoachingClass[]>([]);

  // Modals States
  const [showManageModal, setShowManageModal] = useState(false);
  const [showClassFormModal, setShowClassFormModal] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);
  const [autoAssignRules, setAutoAssignRules] = useState('');
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isCopyingAssignments, setIsCopyingAssignments] = useState(false);

  // Selection States
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  // Form States - Assign Coach
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const [assignmentMemo, setAssignmentMemo] = useState('');

  // Form States - Class Template
  const [editingClass, setEditingClass] = useState<CoachingClass | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [classFormData, setClassFormData] = useState({
    title: '', start_time: '09:00', end_time: '10:00', days_of_week: '', max_participants: 20, description: '', color: '#3182F6',
  });

  useEffect(() => {
    fetchCoaches();
  }, []);

  useEffect(() => {
    const yearMonth = format(currentMonth, 'yyyy-MM');
    fetchCalendarAndStats(yearMonth);
  }, [currentMonth]);

  const fetchCoaches = async () => {
    try {
      const res = await getCoachesList();
      setCoaches(res.data || []);
    } catch (error) { }
  };

  const fetchCalendarAndStats = async (yearMonth: string) => {
    try {
      setLoading(true);
      const [calRes, statsRes] = await Promise.all([
        getCoachingClassCalendar(yearMonth, gymId),
        getCoachingClassStats(yearMonth, gymId),
      ]);
      setCalendar(calRes.data?.calendar || {});
      setStats(statsRes.data?.stats || []);
    } catch (error) {
      toast.error('데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await getCoachingClasses(gymId);
      setTemplateClasses(res.data || []);
    } catch (error) {
      toast.error('수업 템플릿 조회 실패');
    }
  };

  // Calendar Logic
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const calendarGrid = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) weeks.push(calendarDays.slice(i, i + 7));
    return weeks;
  }, [calendarDays]);

  const getDayClasses = (dateStr: string) => {
    return calendar[dateStr] || [];
  };

  // Handlers - Daily Detail
  const openDailyModal = (dateStr: string) => {
    setSelectedDate(dateStr);
    setShowDailyModal(true);
  };

  const openAssignmentModal = (classId: number) => {
    setSelectedClassId(classId);
    setSelectedCoachId(null);
    setAssignmentMemo('');
    setShowAssignmentModal(true);
  };

  const handleCreateAssignment = async () => {
    if (!selectedCoachId || !selectedDate || !selectedClassId) {
      toast.error('코치를 선택해주세요'); return;
    }
    try {
      await createCoachingClassAssignment({ coaching_class_id: selectedClassId, coach_id: selectedCoachId, date: selectedDate, memo: assignmentMemo || undefined });
      toast.success('코치가 배정되었습니다');
      setShowAssignmentModal(false);
      fetchCalendarAndStats(format(currentMonth, 'yyyy-MM'));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '배정 실패');
    }
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!window.confirm('배정을 취소하시겠습니까?')) return;
    try {
      await deleteCoachingClassAssignment(assignmentId);
      toast.success('배정이 취소되었습니다');
      fetchCalendarAndStats(format(currentMonth, 'yyyy-MM'));
    } catch (error) {
      toast.error('취소 실패');
    }
  };

  const handleCopyPreviousWeekDay = async () => {
    if (!selectedDate) return;

    const sourceDate = format(addDays(new Date(selectedDate), -7), 'yyyy-MM-dd');
    if (!window.confirm(`${sourceDate} 배정을 ${selectedDate}로 복사하시겠습니까? 기존 배정은 취소됩니다.`)) return;

    setIsCopyingAssignments(true);
    try {
      const res = await copyCoachingClassAssignmentsByDay({
        source_date: sourceDate,
        target_date: selectedDate,
      });
      toast.success(res.data?.message || '지난주 배정을 복사했습니다.');
      fetchCalendarAndStats(format(currentMonth, 'yyyy-MM'));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '일간 배정 복사에 실패했습니다.');
    } finally {
      setIsCopyingAssignments(false);
    }
  };

  const handleCopyCurrentWeekToNextWeek = async () => {
    if (!selectedDate) return;

    const sourceWeekStart = startOfWeek(new Date(selectedDate), { weekStartsOn: 0 });
    const targetWeekStart = addDays(sourceWeekStart, 7);
    const sourceWeekLabel = format(sourceWeekStart, 'yyyy-MM-dd');
    const targetWeekLabel = format(targetWeekStart, 'yyyy-MM-dd');

    if (!window.confirm(`${sourceWeekLabel} 시작 주간 배정을 ${targetWeekLabel} 시작 주간으로 복제하시겠습니까? 기존 배정은 취소됩니다.`)) return;

    setIsCopyingAssignments(true);
    try {
      const res = await copyCoachingClassAssignmentsByWeek({
        source_week_start: format(sourceWeekStart, 'yyyy-MM-dd'),
        target_week_start: format(targetWeekStart, 'yyyy-MM-dd'),
      });
      toast.success(res.data?.message || '주간 배정을 복제했습니다.');
      fetchCalendarAndStats(format(currentMonth, 'yyyy-MM'));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '주간 배정 복제에 실패했습니다.');
    } finally {
      setIsCopyingAssignments(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!autoAssignRules.trim()) {
      toast.error('배정 규칙을 입력해주세요.');
      return;
    }
    if (!window.confirm('기존 배정 내역이 모두 초기화됩니다. AI 배정을 시작하시겠습니까?')) return;

    setIsAutoAssigning(true);
    try {
      const ym = format(currentMonth, 'yyyy-MM');
      const res = await autoAssignCoachingClasses({ year_month: ym, rules: autoAssignRules });
      toast.success(res.data?.message || 'AI 자동 배정이 완료되었습니다.');
      setShowAutoAssignModal(false);
      setAutoAssignRules('');
      fetchCalendarAndStats(ym);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '자동 배정에 실패했습니다.');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // Handlers - Manage Templates
  const openManageModal = () => {
    fetchTemplates();
    setShowManageModal(true);
  };

  const openAddClassModal = () => {
    setEditingClass(null);
    setClassFormData({ title: '', start_time: '09:00', end_time: '10:00', days_of_week: '', max_participants: 20, description: '', color: '#3182F6' });
    setSelectedDays([]);
    setShowClassFormModal(true);
  };

  const openEditClassModal = (cls: CoachingClass) => {
    setEditingClass(cls);
    setClassFormData({ title: cls.title, start_time: cls.start_time, end_time: cls.end_time, days_of_week: cls.days_of_week, max_participants: cls.max_participants, description: cls.description || '', color: cls.color });
    setSelectedDays(cls.days_of_week.split(',').map(Number));
    setShowClassFormModal(true);
  };

  const handleSaveClass = async () => {
    if (!classFormData.title || selectedDays.length === 0) {
      toast.error('수업명과 요일을 입력해주세요'); return;
    }
    try {
      const payload = { ...classFormData, days_of_week: selectedDays.join(',') };
      if (editingClass) await updateCoachingClass(editingClass.id, payload);
      else await createCoachingClass(payload);

      toast.success('저장되었습니다');
      setShowClassFormModal(false);
      fetchTemplates();
      fetchCalendarAndStats(format(currentMonth, 'yyyy-MM')); // Update calendar as templates changed
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '저장 실패');
    }
  };

  const handleSaveCoachColor = async (coachId: number, color: string) => {
    try {
      await updateMember(coachId, { color });
      toast.success('색상이 저장되었습니다');
      fetchCoaches(); // 코치 목록 갱신
      fetchCalendarAndStats(format(currentMonth, 'yyyy-MM')); // 캘린더 색상 반영을 위해 갱신
    } catch (error) {
      toast.error('색상 저장 실패');
    }
  };

  const handleDeleteClass = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까? 관련 배정 내역이 영향을 받을 수 있습니다.')) return;
    try {
      await deleteCoachingClass(id);
      toast.success('삭제되었습니다');
      fetchTemplates();
      fetchCalendarAndStats(format(currentMonth, 'yyyy-MM'));
    } catch (error) {
      toast.error('삭제 실패');
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(val);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>수업 관리</h1>
          <p style={styles.subtitle}>수업 템플릿을 설정하고 코치를 배정하세요.</p>
        </div>
        <div style={{ ...styles.btnGroup, display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowAutoAssignModal(true)} style={{ ...styles.secondaryBtn, backgroundColor: '#8B5CF6', color: 'white', borderColor: '#8B5CF6', padding: '8px 16px' }}>
            ✨ AI 자동 배정
          </button>
          <button onClick={() => setShowStats(!showStats)} style={styles.secondaryBtn}>
            📊 {showStats ? '캘린더 보기' : '통계 보기'}
          </button>
          <button onClick={() => setShowColorModal(true)} style={styles.secondaryBtn}>
            🎨 코치 색상 설정
          </button>
          <button onClick={openManageModal} style={styles.primaryBtn}>
            <Settings size={18} /> 수업 템플릿 설정
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ ...styles.calendarCard, textAlign: 'center', padding: '48px' }}>로딩 중...</div>
      ) : showStats ? (
        // 통계 뷰
        <div style={styles.statsCard}>
          <h2 style={{ ...styles.pageTitle, fontSize: '18px', marginBottom: '16px' }}>
            📊 {format(currentMonth, 'yyyy년 MM월', { locale: ko })} 코치별 수업 통계
          </h2>
          {stats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#6B7280' }}>배정된 수업이 없습니다.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
              {stats.map(stat => (
                <div key={stat.coach_id} style={styles.statBox}>
                  <p style={styles.statCoachName}>{stat.coach_name}</p>
                  <div style={styles.statRow}><span>수업 횟수:</span><span style={styles.statValue}>{stat.class_count}회</span></div>
                  {stat.class_wage > 0 && <div style={styles.statRow}><span>수업당 급여:</span><span style={styles.statValue}>{formatCurrency(stat.class_wage)}</span></div>}
                  <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '8px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                    <span style={{ fontSize: '14px', color: '#1F2937', fontWeight: 'bold' }}>예상 총 수당:</span>
                    <span style={styles.wageValue}>{formatCurrency(stat.expected_wage)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // 캘린더 뷰
        <>
          <div style={styles.monthNavCard}>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} style={styles.navBtn}><ChevronLeft size={24} /></button>
            <span style={styles.monthText}>{format(currentMonth, 'yyyy년 M월', { locale: ko })}</span>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} style={styles.navBtn}><ChevronRight size={24} /></button>
          </div>

          <div style={styles.calendarCard}>
            <div style={styles.dayHeaderRow}>
              {weekDayLabels.map(label => <div key={label} style={styles.dayHeader}>{label}</div>)}
            </div>
            {calendarGrid.map((week, weekIdx) => (
              <div key={weekIdx} style={styles.weekRow}>
                {week.map((date, dayIdx) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayClasses = getDayClasses(dateStr);
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  const isToday = isSameDay(date, new Date());

                  return (
                    <div
                      key={dateStr}
                      onClick={() => openDailyModal(dateStr)}
                      style={{
                        ...styles.dayCell,
                        backgroundColor: isToday ? '#FEF3C7' : !isCurrentMonth ? '#FAFAFA' : '#FFFFFF',
                        borderColor: isToday ? '#FBBF24' : '#E5E7EB',
                        opacity: !isCurrentMonth ? 0.5 : 1,
                      }}
                    >
                      <div style={{ ...styles.dayNumber, color: !isCurrentMonth ? '#D1D5DB' : '#1F2937' }}>{date.getDate()}</div>
                      <div style={styles.compactList}>
                        {dayClasses.map(({ coaching_class, assigned_coaches }: any) => {
                          const coachColor = assigned_coaches.length > 0 ? assigned_coaches[0].coach_color : '#E5E7EB';
                          // 배경은 코치 색상의 15% 불투명도, 텍스트는 코치 색상 본래 값
                          return (
                            <div
                              key={coaching_class.id}
                              style={{
                                ...styles.compactItem,
                                backgroundColor: assigned_coaches.length > 0 ? `${coachColor}26` : '#F3F4F6', // 26은 hex로 약 15% opacity
                                color: assigned_coaches.length > 0 ? coachColor : '#6B7280',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                borderLeft: `3px solid ${coachColor}`
                              }}
                            >
                              <span style={{ fontWeight: '600', flexShrink: 0 }}>{coaching_class.start_time}</span>
                              <span style={{
                                fontWeight: '600',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginLeft: '4px',
                                flex: 1
                              }}>
                                {coaching_class.title}{assigned_coaches.length > 0 && ` (${assigned_coaches.map((c: any) => c.coach_name).join(', ')})`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 🟢 일간 상세 모달 (Daily Detail View) */}
      {showDailyModal && selectedDate && (
        <div style={styles.modalOverlay} onClick={() => setShowDailyModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{format(new Date(selectedDate), 'yyyy년 M월 d일')} 수업 명단</h2>
              <button onClick={() => setShowDailyModal(false)} style={styles.closeBtn}><X size={24} /></button>
            </div>
            <div style={styles.modalContent}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleCopyPreviousWeekDay}
                  disabled={isCopyingAssignments}
                  style={{ ...styles.secondaryBtn, padding: '8px 12px', opacity: isCopyingAssignments ? 0.6 : 1 }}
                >
                  지난주 같은 날짜 복사
                </button>
                <button
                  onClick={handleCopyCurrentWeekToNextWeek}
                  disabled={isCopyingAssignments}
                  style={{ ...styles.secondaryBtn, padding: '8px 12px', opacity: isCopyingAssignments ? 0.6 : 1 }}
                >
                  이번 주를 다음 주로 복제
                </button>
              </div>
              {getDayClasses(selectedDate).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#6B7280' }}>등록된 수업이 없습니다.</div>
              ) : (
                getDayClasses(selectedDate).map(({ coaching_class, assigned_coaches }: any) => {
                  const coachColor = assigned_coaches.length > 0 ? assigned_coaches[0].coach_color : '#E5E7EB';
                  return (
                    <div key={coaching_class.id} style={{ ...styles.detailClassCard, borderLeftColor: coachColor }}>
                      <div style={styles.detailClassHeader}>
                        <div>
                          <h3 style={styles.detailClassTitle}>{coaching_class.title}</h3>
                          <div style={styles.detailClassTime}>{coaching_class.start_time} ~ {coaching_class.end_time}</div>
                        </div>
                        <button onClick={() => openAssignmentModal(coaching_class.id)} style={styles.addCoachBtn}>
                          <Plus size={14} style={{ marginRight: '4px' }} /> 배정 추가
                        </button>
                      </div>

                      {/* Assigned Coaches List */}
                      <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {assigned_coaches.length > 0 ? assigned_coaches.map((coach: any) => (
                          <div key={coach.assignment_id} style={{ ...styles.coachBadge, backgroundColor: coach.coach_color + '20', color: coach.coach_color, borderColor: coach.coach_color }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: coach.coach_color, marginRight: '6px' }}></div>
                            {coach.coach_name}
                            <button onClick={() => handleDeleteAssignment(coach.assignment_id)} style={{ ...styles.removeBtn, color: coach.coach_color }} title="배정 취소">
                              <X size={14} />
                            </button>
                          </div>
                        )) : <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>배정된 코치가 없습니다.</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowDailyModal(false)} style={styles.cancelBtn}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 코치 배정(추가) 모달 */}
      {showAssignmentModal && (
        <div style={{ ...styles.modalOverlay, zIndex: 1100 }} onClick={() => setShowAssignmentModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>코치 배정</h2>
              <button onClick={() => setShowAssignmentModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalContent}>
              <div style={styles.formGroup}>
                <label style={styles.label}>배정할 코치 선택</label>
                <select value={selectedCoachId || ''} onChange={e => setSelectedCoachId(parseInt(e.target.value) || null)} style={styles.input}>
                  <option value="">코치를 선택하세요</option>
                  {coaches.map(coach => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name} ({coach.role === 'admin' ? '마스터' : '코치'})
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#6B7280' }}>
                  해당 시간대 근무표가 등록된 코치만 배정할 수 있습니다.
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>메모 (선택)</label>
                <textarea value={assignmentMemo} onChange={e => setAssignmentMemo(e.target.value)} style={{ ...styles.input, minHeight: '80px', fontFamily: 'inherit' } as React.CSSProperties} placeholder="특별한 사항" />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowAssignmentModal(false)} style={styles.cancelBtn}>취소</button>
              <button onClick={handleCreateAssignment} style={styles.submitBtn}>배정 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 🟣 수업 템플릿 관리 모달 */}
      {showManageModal && (
        <div style={styles.modalOverlay} onClick={() => setShowManageModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>수업 템플릿 설정</h2>
              <button onClick={() => setShowManageModal(false)} style={styles.closeBtn}><X size={24} /></button>
            </div>
            <div style={styles.modalContent}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button onClick={openAddClassModal} style={{ ...styles.primaryBtn, padding: '8px 12px', fontSize: '13px' }}>
                  <Plus size={16} /> 새 템플릿 추가
                </button>
              </div>
              {templateClasses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>등록된 수업 템플릿이 없습니다.</div>
              ) : (
                <div style={styles.manageGrid}>
                  {templateClasses.map(cls => (
                    <div key={cls.id} style={{ ...styles.manageCard, borderLeftColor: cls.color }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#1F2937', fontSize: '15px', marginBottom: '4px' }}>{cls.title}</div>
                        <div style={{ fontSize: '13px', color: '#6B7280' }}>
                          {cls.start_time}~{cls.end_time} | {cls.days_of_week.split(',').map(Number).map(d => classDayLabels[d]).join(', ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openEditClassModal(cls)} style={styles.iconBtn}><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteClass(cls.id)} style={{ ...styles.iconBtn, color: TOSS_RED }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowManageModal(false)} style={styles.cancelBtn}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔵 수업 템플릿 추가/수정 폼 모달 */}
      {showClassFormModal && (
        <div style={{ ...styles.modalOverlay, zIndex: 1200 }} onClick={() => setShowClassFormModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingClass ? '수업 수정' : '새 수업 추가'}</h2>
              <button onClick={() => setShowClassFormModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalContent}>
              <div style={styles.formGroup}>
                <label style={styles.label}>수업명</label>
                <input type="text" value={classFormData.title} onChange={e => setClassFormData({ ...classFormData, title: e.target.value })} style={styles.input} placeholder="예: 오전 크로스핏" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={styles.formGroup}><label style={styles.label}>시작 시간</label><input type="time" value={classFormData.start_time} onChange={e => setClassFormData({ ...classFormData, start_time: e.target.value })} style={styles.input} /></div>
                <div style={styles.formGroup}><label style={styles.label}>종료 시간</label><input type="time" value={classFormData.end_time} onChange={e => setClassFormData({ ...classFormData, end_time: e.target.value })} style={styles.input} /></div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>운영 요일</label>
                <div style={styles.dayButtonGroup}>
                  {classDayLabels.map((label, i) => (
                    <button key={i} onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort())}
                      style={{ ...styles.dayButton, backgroundColor: selectedDays.includes(i) ? TOSS_BLUE : 'white', color: selectedDays.includes(i) ? 'white' : '#374151', borderColor: selectedDays.includes(i) ? TOSS_BLUE : '#D1D5DB' }}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={styles.formGroup}><label style={styles.label}>최대 인원</label><input type="number" value={classFormData.max_participants} onChange={e => setClassFormData({ ...classFormData, max_participants: parseInt(e.target.value) })} style={styles.input} min="1" /></div>
                <div style={styles.formGroup}><label style={styles.label}>색상 (구분용)</label><input type="color" value={classFormData.color} onChange={e => setClassFormData({ ...classFormData, color: e.target.value })} style={{ width: '100%', height: '40px', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', padding: '2px' }} /></div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>설명 (선택)</label>
                <textarea value={classFormData.description} onChange={e => setClassFormData({ ...classFormData, description: e.target.value })} style={{ ...styles.input, minHeight: '60px', fontFamily: 'inherit', resize: 'vertical' } as React.CSSProperties} />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowClassFormModal(false)} style={styles.cancelBtn}>취소</button>
              <button onClick={handleSaveClass} style={styles.submitBtn}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 🟣 코치 색상 설정 모달 */}
      {showColorModal && (
        <div style={styles.modalOverlay} onClick={() => setShowColorModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>🎨 코치별 지정 색상 설정</h2>
              <button onClick={() => setShowColorModal(false)} style={styles.closeBtn}><X size={24} /></button>
            </div>
            <div style={styles.modalContent}>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
                캘린더에서 수업 블록의 배경색으로 사용될 코치별 색상을 지정하세요.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {coaches.map(coach => (
                  <div key={coach.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: coach.color || TOSS_BLUE,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {coach.name[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#1F2937' }}>{coach.name}</div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>
                          {coach.role === 'admin' ? '마스터 코치' : '코치'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="color"
                        defaultValue={coach.color || TOSS_BLUE}
                        onBlur={(e) => {
                          if (e.target.value !== coach.color) {
                            handleSaveCoachColor(coach.id, e.target.value);
                          }
                        }}
                        style={{
                          width: '36px',
                          height: '36px',
                          padding: 0,
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: 'transparent'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowColorModal(false)} style={styles.cancelBtn}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ AI 자동 배정 모달 */}
      {showAutoAssignModal && (
        <div style={styles.modalOverlay} onClick={() => !isAutoAssigning && setShowAutoAssignModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>✨ AI 코치 자동 배정 (BETA)</h2>
              <button disabled={isAutoAssigning} onClick={() => setShowAutoAssignModal(false)} style={styles.closeBtn}><X size={24} /></button>
            </div>
            <div style={styles.modalContent}>
              <div style={{ backgroundColor: '#FEF3C7', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #FDE68A' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#92400E', fontWeight: '500' }}>
                  ⚠️ 주의: 실행 시 {format(currentMonth, 'yyyy년 M월', { locale: ko })}의 <strong>기존 코치 배정 내역이 모두 초기화</strong>되고 AI가 새롭게 전체 스케줄을 배정합니다.
                </p>
              </div>
              <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px', fontWeight: '600' }}>
                어떤 방식으로 배정할까요? 코치님들께 지시하듯 편하게 적어주세요.
              </p>
              <textarea
                placeholder="예) A코치는 오전반 위주로 넣고, B코치와 C코치는 오후반을 번갈아가면서 들어가게 해줘. 휴일은 다같이 쉴 수 있게 비워주고 전체 수업 횟수는 공평하게 맞춰줘."
                value={autoAssignRules}
                onChange={(e) => setAutoAssignRules(e.target.value)}
                disabled={isAutoAssigning}
                style={{
                  ...styles.input,
                  minHeight: '120px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  fontSize: '14px',
                  lineHeight: '1.5'
                } as React.CSSProperties}
              />
              {isAutoAssigning && (
                <div style={{ marginTop: '16px', textAlign: 'center', color: '#8B5CF6', fontWeight: 'bold', fontSize: '14px' }}>
                  AI가 수많은 경우의 수를 계산하며 최적의 스케줄을 짜고 있습니다... ⏳
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button disabled={isAutoAssigning} onClick={() => setShowAutoAssignModal(false)} style={styles.cancelBtn}>취소</button>
              <button
                disabled={isAutoAssigning}
                onClick={handleAutoAssign}
                style={{ ...styles.submitBtn, backgroundColor: isAutoAssigning ? '#C4B5FD' : '#8B5CF6' }}
              >
                {isAutoAssigning ? '배정 중...' : '자동 배정 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachingClassSchedulePage;
