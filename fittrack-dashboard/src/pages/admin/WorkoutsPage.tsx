import React, { useEffect, useMemo, useState } from 'react';
import { getWorkouts } from '../../services/api';
import { Workout } from '../../types';
import { Dumbbell, Calendar, User, Activity, Search, X, Clock, FileText } from 'lucide-react';
import { ListSkeleton } from '../../components/common/SkeletonLoader';

const TOSS_BLUE = '#3182F6';

const WorkoutsPage: React.FC = () => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [memberFilter, setMemberFilter] = useState('전체');
  const [workoutFilter, setWorkoutFilter] = useState('전체');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    fetchWorkouts();
  }, [memberFilter, workoutFilter, dateFrom, dateTo]);

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      const response = await getWorkouts({
        limit: 500,
        member_name: memberFilter !== '전체' ? memberFilter : undefined,
        workout_name: workoutFilter !== '전체' ? workoutFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setWorkouts(response.data || []);
    } catch (error) {
      console.error('운동 기록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const memberOptions = useMemo(() => {
    return ['전체', ...Array.from(new Set(workouts.map((w) => w.member_name).filter(Boolean))).sort()];
  }, [workouts]);

  const workoutOptions = useMemo(() => {
    return ['전체', ...Array.from(new Set(workouts.map((w) => w.workout).filter(Boolean))).sort()];
  }, [workouts]);

  const filteredWorkouts = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return workouts.filter((w) => (
      w.member_name?.toLowerCase().includes(lowerSearch) ||
      w.workout.toLowerCase().includes(lowerSearch) ||
      (w.description || '').toLowerCase().includes(lowerSearch)
    ));
  }, [workouts, searchTerm]);

  const resetFilters = () => {
    setSearchTerm('');
    setMemberFilter('전체');
    setWorkoutFilter('전체');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>운동 기록 조회</h1>
        <p style={styles.subtitle}>날짜, 회원, 운동 종류 기준으로 기록을 좁혀서 보고 상세 내용까지 확인하세요.</p>
      </div>

      <div style={styles.filterCard}>
        <div style={styles.filterGrid}>
          <div style={styles.searchBox}>
            <Search size={18} color="var(--text-tertiary)" />
            <input
              placeholder="회원명, 운동명, 메모 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} style={styles.select}>
            {memberOptions.map((member) => (
              <option key={member} value={member}>{member === '전체' ? '전체 회원' : member}</option>
            ))}
          </select>

          <select value={workoutFilter} onChange={(e) => setWorkoutFilter(e.target.value)} style={styles.select}>
            {workoutOptions.map((workout) => (
              <option key={workout} value={workout}>{workout === '전체' ? '전체 운동' : workout}</option>
            ))}
          </select>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={styles.dateInput} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={styles.dateInput} />

          <button onClick={resetFilters} style={styles.resetBtn}>필터 초기화</button>
        </div>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryChip}>조회 결과 {filteredWorkouts.length}건</div>
        {dateFrom || dateTo ? <div style={styles.summaryChipMuted}>{dateFrom || '시작일'} ~ {dateTo || '종료일'}</div> : null}
      </div>

      <div style={styles.listContainer}>
        {loading ? (
          <ListSkeleton count={5} />
        ) : filteredWorkouts.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}><Dumbbell size={32} color="var(--text-tertiary)" /></div>
            <p style={styles.emptyText}>조건에 맞는 운동 기록이 없습니다.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredWorkouts.map((workout) => (
              <button key={workout.id} style={styles.card} onClick={() => setSelectedWorkout(workout)}>
                <div style={styles.cardHeader}>
                  <div style={styles.userInfo}>
                    <div style={styles.avatar}>
                      <User size={16} color="#FFFFFF" />
                    </div>
                    <div>
                      <div style={styles.userName}>{workout.member_name || '알 수 없음'}</div>
                      <div style={styles.dateText}>{workout.date}</div>
                    </div>
                  </div>
                  <div style={styles.workoutBadge}>{workout.workout}</div>
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.scoreRow}>
                    <Activity size={16} color={TOSS_BLUE} />
                    <span style={styles.scoreText}>{workout.time}</span>
                  </div>
                  {workout.description && (
                    <div style={styles.previewText}>{workout.description}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedWorkout && (
        <div style={styles.modalOverlay} onClick={() => setSelectedWorkout(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalBadge}>{selectedWorkout.workout}</div>
                <h2 style={styles.modalTitle}>{selectedWorkout.member_name}</h2>
              </div>
              <button onClick={() => setSelectedWorkout(null)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalContent}>
              <div style={styles.detailRow}><Calendar size={16} color="#6B7280" /><span>{selectedWorkout.date}</span></div>
              <div style={styles.detailRow}><Clock size={16} color="#6B7280" /><span>{selectedWorkout.time}</span></div>
              <div style={styles.detailRow}><Dumbbell size={16} color="#6B7280" /><span>{selectedWorkout.workout}</span></div>
              {selectedWorkout.type && (
                <div style={styles.detailRow}><Activity size={16} color="#6B7280" /><span>{selectedWorkout.type}</span></div>
              )}
              {selectedWorkout.created_at && (
                <div style={styles.detailRow}><FileText size={16} color="#6B7280" /><span>{new Date(selectedWorkout.created_at).toLocaleString('ko-KR')}</span></div>
              )}
              <div style={styles.descriptionBox}>
                <div style={styles.descriptionLabel}>상세 메모</div>
                <div style={styles.descriptionText}>{selectedWorkout.description || '기록된 추가 메모가 없습니다.'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: { maxWidth: '100%', padding: '32px 24px 100px', backgroundColor: 'var(--bg-main)', minHeight: '100vh', boxSizing: 'border-box' },
  header: { marginBottom: '24px' },
  pageTitle: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },
  subtitle: { fontSize: '15px', color: 'var(--text-secondary)', marginTop: '6px' },
  filterCard: { backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '20px', marginBottom: '16px', boxShadow: 'var(--shadow)' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(2, minmax(140px, 1fr)) repeat(2, minmax(140px, 1fr)) auto', gap: '12px', alignItems: 'center' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' },
  searchInput: { border: 'none', background: 'transparent', fontSize: '15px', color: 'var(--text-primary)', width: '100%', outline: 'none' },
  select: { height: '46px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: '0 12px', fontSize: '14px', color: 'var(--text-primary)' },
  dateInput: { height: '46px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: '0 12px', fontSize: '14px', color: 'var(--text-primary)' },
  resetBtn: { height: '46px', borderRadius: '12px', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', padding: '0 14px', fontSize: '14px', fontWeight: '700', color: '#374151', cursor: 'pointer' },
  summaryRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  summaryChip: { padding: '8px 12px', borderRadius: '999px', backgroundColor: '#E8F3FF', color: TOSS_BLUE, fontSize: '13px', fontWeight: '700' },
  summaryChipMuted: { padding: '8px 12px', borderRadius: '999px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' },
  listContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  card: { backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '20px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'left' as const },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  avatar: { width: '36px', height: '36px', borderRadius: '14px', backgroundColor: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' },
  dateText: { fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px' },
  workoutBadge: { fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: '8px', maxWidth: '140px', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  cardBody: { backgroundColor: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' },
  scoreRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  scoreText: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' },
  previewText: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  emptyState: { padding: '60px 0', textAlign: 'center' as const, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  emptyIcon: { width: '64px', height: '64px', borderRadius: '32px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: '15px', color: 'var(--text-tertiary)' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' },
  modal: { width: '100%', maxWidth: '520px', backgroundColor: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 20px 16px', borderBottom: '1px solid var(--border-color)' },
  modalBadge: { display: 'inline-flex', padding: '6px 10px', borderRadius: '999px', backgroundColor: '#E8F3FF', color: TOSS_BLUE, fontSize: '12px', fontWeight: '700', marginBottom: '10px' },
  modalTitle: { margin: 0, fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)' },
  closeBtn: { width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' },
  modalContent: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  detailRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-primary)' },
  descriptionBox: { marginTop: '8px', padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' },
  descriptionLabel: { fontSize: '12px', fontWeight: '700', color: '#6B7280', marginBottom: '8px' },
  descriptionText: { fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const },
};

export default WorkoutsPage;
