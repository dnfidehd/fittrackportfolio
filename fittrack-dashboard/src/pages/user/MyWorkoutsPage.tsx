import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ 추가
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import toast from 'react-hot-toast';
import {
  getMyWorkouts, deleteWorkout, getWod, saveWodRecord,
  getMyWodRecords, deleteWodRecord
} from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';
import AddWorkoutModal from '../../components/modals/AddWorkoutModal';
import '../../assets/styles/Calendar.css';
import { Calendar as CalendarIcon, Dumbbell, Flame, Check, Edit2, Trash2, Clock, Plus } from 'lucide-react';

// 토스 스타일 색상
const TOSS_BLUE = '#3182F6';
const TOSS_RED = '#EF4444';

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MyWorkoutsPage: React.FC = () => {
  // JSON 형식인지 확인하는 함수
  const isJsonString = (str: string) => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  // WOD 내용 포맷팅 함수
  const formatWodContent = (content: string) => {
    if (!content) return null;
    if (isJsonString(content)) {
      try {
        const parsed = JSON.parse(content);

        // 최상단이 객체이면서 parts 배열을 포함하는 경우 (멀티 파트)
        if (parsed.parts && Array.isArray(parsed.parts)) {
          const validParts = parsed.parts.filter((p: any) =>
            p.lines && p.lines.length > 0 &&
            p.lines.some((l: any) => l.movement && l.movement.trim() !== "" && l.movement.trim() !== "-")
          );
          if (validParts.length === 0) return null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {validParts.map((partData: any, idx: number) => (
                <div key={idx}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary)' }}>{partData.label || `Part ${String.fromCharCode(65 + idx)}`}</div>
                  {partData.lines?.map((line: any, lineIdx: number) => {
                    if (!line.movement || line.movement.trim() === "" || line.movement.trim() === "-") return null;
                    return (
                      <div key={lineIdx} style={{ marginLeft: '8px' }}>
                        - {line.reps} {line.movement} {line.weightRx ? `(${line.weightRx})` : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        }

        // 단일 파트
        if (parsed.type && parsed.lines) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {parsed.lines.map((line: any, idx: number) => {
                if (!line.movement || line.movement.trim() === "" || line.movement.trim() === "-") return null;
                return (
                  <div key={idx}>- {line.reps} {line.movement} {line.weightRx ? `(${line.weightRx})` : ''}</div>
                );
              })}
            </div>
          );
        }

        // 이전 하위 호환을 위한 멀티 파트 (A, B, C...)
        if (typeof parsed === 'object') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(parsed).map(([partName, partData]: [string, any]) => (
                <div key={partName}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary)' }}>{partData.label || partName}</div>
                  {partData.lines?.map((line: any, idx: number) => (
                    <div key={idx} style={{ marginLeft: '8px' }}>
                      - {line.reps} {line.movement} {line.weightRx ? `(${line.weightRx})` : ''}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        }
      } catch (e) {
        console.error("WOD 파싱 에러:", e);
        return content;
      }
    }
    return content;
  };

  const { user } = useAppContext();
  const [date, setDate] = useState(new Date());

  const [workouts, setWorkouts] = useState<any[]>([]);
  const [wodRecords, setWodRecords] = useState<any[]>([]);
  const [boxWod, setBoxWod] = useState<any>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWodModalOpen, setIsWodModalOpen] = useState(false); // ✅ WOD 기록 입력 모달

  const [inputMinutes, setInputMinutes] = useState('');
  const [inputSeconds, setInputSeconds] = useState('');
  const [inputGeneral, setInputGeneral] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('Rx');
  const [isEditing, setIsEditing] = useState(false);
  const [inputTab, setInputTab] = useState<'record' | 'cap'>('record');

  // 탭 상태 추가
  const [activeTab, setActiveTab] = useState<'box' | 'self'>('box');
  const [editingWorkout, setEditingWorkout] = useState<any>(null); // ✅ 수정할 운동 데이터

  const navigate = useNavigate(); // ✅ 추가

  const fetchAllData = async () => {
    if (!user) return;
    try {
      const [workoutsRes, wodRecordsRes] = await Promise.all([
        getMyWorkouts(),
        getMyWodRecords()
      ]);
      setWorkouts(Array.isArray(workoutsRes.data) ? workoutsRes.data : []);
      setWodRecords(Array.isArray(wodRecordsRes.data) ? wodRecordsRes.data : []);
    } catch (e) {
      console.error("데이터 로딩 실패", e);
    }
  };

  useEffect(() => { fetchAllData(); }, [user]);

  useEffect(() => {
    const fetchBoxWod = async () => {
      try {
        const dateStr = getLocalDateString(date);
        setBoxWod(null);
        resetForm();
        const res = await getWod(dateStr);
        if (res.data) setBoxWod(res.data);
      } catch (e) {
        setBoxWod(null);
      }
    };
    fetchBoxWod();
  }, [date]);

  const resetForm = () => {
    setInputMinutes('');
    setInputSeconds('');
    setInputGeneral('');
    setSelectedLevel('Rx');
    setIsEditing(false);
    setInputTab('record');
  };

  const handleWodSubmit = async () => {
    if (!boxWod) return;
    let finalRecordValue = "";
    if (boxWod.score_type === 'time') {
      if (!inputMinutes && !inputSeconds) {
        toast.error("기록(분/초)을 입력해주세요!");
        return;
      }
      const mm = inputMinutes.padStart(2, '0') || "00";
      const ss = inputSeconds.padStart(2, '0') || "00";
      finalRecordValue = `${mm}:${ss}`;
    } else {
      if (!inputGeneral) {
        toast.error("기록을 입력해주세요!");
        return;
      }
      finalRecordValue = inputGeneral;
    }

    const actionText = isEditing ? "수정" : "등록";
    if (window.confirm(`[${selectedLevel}] ${finalRecordValue} 기록으로 ${actionText}하시겠습니까?`)) {
      try {
        const isRx = selectedLevel === 'Rx';
        const isTimeCap = boxWod.score_type === 'time' && inputTab === 'cap';
        const scaleRank = isRx ? null : selectedLevel.replace('Scale ', '');
        const note = isRx ? "Rx 수행" : `${selectedLevel} 수행`;

        let recordToSave = finalRecordValue;
        if (isTimeCap) {
          recordToSave = `CAP + ${inputGeneral}`; // 타임캡일 경우 inputGeneral에 랩수 입력
        }

        await saveWodRecord({
          wod_id: boxWod.id,
          record_value: recordToSave,
          is_rx: isRx,
          scale_rank: scaleRank,
          is_time_cap: isTimeCap,
          note: note
        });
        toast.success(`기록이 ${actionText}되었습니다! 🎉`);
        fetchAllData();
        setIsEditing(false);
        setIsWodModalOpen(false); // ✅ 모달 닫기
      } catch (error) {
        toast.error("저장에 실패했습니다.");
      }
    }
  };

  const handleDeleteWodRecord = async (recordId: number) => {
    if (window.confirm("정말 이 WOD 기록을 삭제하시겠습니까?")) {
      try {
        await deleteWodRecord(recordId);
        toast.success("삭제되었습니다.");
        fetchAllData();
        resetForm();
      } catch (e) {
        toast.error("삭제 실패");
      }
    }
  };

  const handleEditClick = (record: any) => {
    setIsEditing(true);
    if (record.is_rx) setSelectedLevel('Rx');
    else {
      const level = record.note?.replace(" 수행", "") || 'Scale A';
      setSelectedLevel(level);
    }
    if (boxWod.score_type === 'time') {
      if (record.record_value.includes('CAP') || record.is_time_cap) {
        setInputTab('cap');
        setInputGeneral(record.record_value.replace(/[^0-9]/g, ''));
      } else {
        setInputTab('record');
        const [mm, ss] = record.record_value.split(':');
        setInputMinutes(String(parseInt(mm)));
        setInputSeconds(String(parseInt(ss)));
      }
    } else {
      setInputGeneral(record.record_value);
    }
    // setWodModalDate(date); // 이 줄은 제거하거나 필요한 경우 복구
    setIsWodModalOpen(true);
  };

  const selectedDateStr = getLocalDateString(date);
  const myWodRecord = boxWod ? wodRecords.find(r => r.wod_id === boxWod.id) : null;
  const selectedDayWorkouts = workouts.filter(w => w.date === selectedDateStr);
  const recentWorkouts = [...workouts]
    .sort((a, b) => new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime())
    .slice(0, 3);

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <header style={{ ...styles.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={styles.title}>{user?.name || '회원'}님의 운동 기록</h1>
        <button onClick={() => navigate('/ai-report')} style={{
          backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '8px 12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px'
        }}>
          🤖 AI 분석
        </button>
      </header>

      {/* 캘린더 섹션 */}
      <section style={styles.calendarSection}>
        <Calendar
          onChange={setDate as any}
          value={date}
          formatDay={(locale, date) => date.getDate().toString()}
          tileContent={({ date }) => {
            const dateStr = getLocalDateString(date);
            const hasPersonal = workouts.some(w => w.date === dateStr);
            const hasWodRecord = wodRecords.some(r => r.wod_date === dateStr);

            return (
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                {hasWodRecord && <div style={{ ...styles.dot, backgroundColor: TOSS_RED }}></div>}
                {hasPersonal && <div style={{ ...styles.dot, backgroundColor: TOSS_BLUE }}></div>}
              </div>
            );
          }}
        />
      </section>

      {/* 선택 날짜 표시 */}
      <section style={styles.dateSection}>
        <CalendarIcon size={18} color={TOSS_BLUE} />
        <span style={styles.dateText}>
          {date.getFullYear()}년 {date.getMonth() + 1}월 {date.getDate()}일
        </span>
      </section>

      <section style={styles.summarySection}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>박스 와드</div>
          <div style={styles.summaryValue}>{myWodRecord ? '기록 완료' : (boxWod ? '기록 전' : '없음')}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>개인 운동</div>
          <div style={styles.summaryValue}>{selectedDayWorkouts.length}개</div>
        </div>
      </section>

      {/* 탭 네비게이션 */}
      <nav style={styles.tabNav}>
        <button
          onClick={() => setActiveTab('box')}
          style={activeTab === 'box' ? styles.activeTab : styles.tab}
        >
          박스 와드
        </button>
        <button
          onClick={() => setActiveTab('self')}
          style={activeTab === 'self' ? styles.activeTab : styles.tab}
        >
          개인 운동
        </button>
      </nav>

      <div style={styles.contentArea}>
        {activeTab === 'box' ? (
          /* 박스 와드 탭 */
          boxWod ? (
            <section style={styles.wodCard}>
              <div style={styles.wodHeader}>
                <Flame size={20} color="#EF4444" />
                <span style={styles.wodTitle}>오늘의 WOD</span>
              </div>
              <div style={styles.wodTitleText}>{boxWod.title}</div>
              <div style={styles.wodContent}>{formatWodContent(boxWod.content)}</div>

              {/* 기록 완료 */}
              {myWodRecord && !isEditing ? (
                <div style={styles.completedBox}>
                  <div style={styles.completedHeader}>
                    <div style={styles.completedBadge}>
                      <Check size={14} />
                      오운완!
                    </div>
                    <div style={styles.actionBtns}>
                      <button onClick={() => handleEditClick(myWodRecord)} style={styles.editBtn}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteWodRecord(myWodRecord.id)} style={styles.deleteBtn}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={styles.recordValue}>
                    {boxWod?.score_type === 'time' && myWodRecord.record_value && !myWodRecord.record_value.includes(':')
                      ? `${myWodRecord.record_value.slice(0, -2).padStart(2, '0')}:${myWodRecord.record_value.slice(-2)}`
                      : myWodRecord.record_value}
                  </div>
                  <div style={styles.recordLevel}>
                    {myWodRecord.is_rx ? 'Rx' : myWodRecord.note}
                  </div>
                </div>
              ) : (
                /* 기록 입력 버튼 */
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--warning)', paddingTop: '16px' }}>
                  <div style={styles.inlineActionRow}>
                    <button onClick={() => navigate('/wod')} style={styles.secondaryBtn}>WOD 보기</button>
                    <button
                      onClick={() => { resetForm(); setIsWodModalOpen(true); }}
                      style={styles.submitBtn}
                    >
                      ✏️ 기록 입력
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section style={styles.emptyState}>
              <Clock size={48} color="#E5E7EB" />
              <p style={styles.emptyText}>오늘은 등록된 와드가 없어요</p>
              <button onClick={() => navigate('/wod')} style={styles.secondaryBtn}>WOD 보러 가기</button>
            </section>
          )
        ) : (
          /* 개인 운동 탭 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <button
              onClick={() => {
                setEditingWorkout(null); // ✅ 초기화 (새 기록)
                setIsModalOpen(true);
              }}
              style={styles.addSelfWorkoutBtn}
            >
              <Plus size={18} /> 새 운동 기록하기
            </button>

            {selectedDayWorkouts.length > 0 ? (
              selectedDayWorkouts
                .map((workout) => (
                  <section key={workout.id} style={styles.workoutCard}>
                    <div style={styles.cardHeader}>
                      <div style={styles.cardTitleRow}>
                        <Dumbbell size={18} color={TOSS_BLUE} />
                        <span style={styles.cardTitle}>Self Workout</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setEditingWorkout(workout); // ✅ 수정 모드
                            setIsModalOpen(true);
                          }}
                          style={styles.editBtn}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm("삭제하시겠습니까?")) {
                              await deleteWorkout(workout.id);
                              fetchAllData();
                            }
                          }}
                          style={styles.deleteBtn}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={styles.workoutTitle}>{workout.workout}</div>
                    <div style={styles.workoutInfoBox}>
                      {workout.time.includes('[기록:') ? (
                        <>
                          <div style={styles.workoutRecordText}>
                            {workout.time.match(/\[기록: (.*?)\]/)?.[1] || ""}
                          </div>
                          {workout.time.includes('[내용:') && (
                            <div style={styles.workoutContentText}>
                              {workout.time.match(/\[내용: (.*?)\]/)?.[1] || ""}
                            </div>
                          )}
                          {workout.time.includes('메모:') && (
                            <div style={styles.workoutMemoText}>
                              {workout.time.split('메모:')[1].trim()}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={styles.workoutTime}>{workout.time}</div>
                      )}
                    </div>
                  </section>
                ))
            ) : (
              <>
                <section style={styles.emptyState}>
                  <Dumbbell size={48} color="#E5E7EB" />
                  <p style={styles.emptyText}>선택한 날짜에 기록된 개인 운동이 없어요</p>
                </section>
                {recentWorkouts.length > 0 && (
                  <section style={styles.recentSection}>
                    <div style={styles.recentHeader}>최근 개인 운동</div>
                    <div style={styles.recentList}>
                      {recentWorkouts.map((workout) => (
                        <button
                          key={workout.id}
                          onClick={() => setDate(new Date(`${workout.date}T00:00:00`))}
                          style={styles.recentItem}
                        >
                          <div style={styles.recentItemTitle}>{workout.workout}</div>
                          <div style={styles.recentItemMeta}>{workout.date}</div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <AddWorkoutModal
          onClose={() => {
            setIsModalOpen(false);
            setEditingWorkout(null); // ✅ 닫을 때 초기화
          }}
          onWorkoutAdded={fetchAllData}
          userName={user?.name}
          initialDate={date}
          isPersonalRecord={activeTab === 'self'}
          initialData={editingWorkout} // ✅ 수정 데이터 전달
        />
      )}

      {/* ✅ WOD 기록 입력 모달 */}
      {isWodModalOpen && boxWod && (
        <div style={styles.modalOverlay} onClick={() => { setIsWodModalOpen(false); setIsEditing(false); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{isEditing ? '기록 수정' : '기록 입력'}</h3>
              <button
                onClick={() => { setIsWodModalOpen(false); setIsEditing(false); }}
                style={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>

            {/* 시간 기록일 경우 완주/타임캡 선택 */}
            {boxWod.score_type === 'time' && (
              <div style={{ ...styles.tabRow, marginBottom: '16px' }}>
                <button
                  onClick={() => setInputTab('record')}
                  style={inputTab === 'record' ? styles.inputTabActive : styles.inputTab}
                >
                  ⏱️ 완주
                </button>
                <button
                  onClick={() => setInputTab('cap')}
                  style={inputTab === 'cap' ? { ...styles.inputTabActive, borderColor: 'var(--danger)', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)' } : styles.inputTab}
                >
                  🚫 TIME CAP
                </button>
              </div>
            )}

            {/* 레벨 선택 */}
            <div style={styles.levelGrid}>
              {['Rx', 'Scale A', 'Scale B', 'Scale C'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  style={selectedLevel === lvl ? styles.levelBtnActive : styles.levelBtn}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* 입력 필드 - 모달 안에서는 충분한 공간 확보 */}
            {boxWod.score_type === 'time' && inputTab === 'record' ? (
              <div style={styles.modalInputRow}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={inputMinutes}
                  onChange={(e) => setInputMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                  style={styles.modalInput}
                />
                <span style={styles.inputLabel}>분</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={inputSeconds}
                  onChange={(e) => setInputSeconds(e.target.value.replace(/[^0-9]/g, ''))}
                  style={styles.modalInput}
                />
                <span style={styles.inputLabel}>초</span>
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={boxWod.score_type === 'time' && inputTab === 'cap' ? "미완주 랩 수 (Reps)" : (boxWod.score_type === 'reps' ? "라운드 / 렙스" : "무게 (lb)")}
                  value={inputGeneral}
                  onChange={(e) => setInputGeneral(e.target.value)}
                  style={{ ...styles.modalInput, width: '100%' }}
                />
              </div>
            )}

            {/* 버튼 */}
            <div style={styles.btnRow}>
              <button
                onClick={() => { setIsWodModalOpen(false); setIsEditing(false); }}
                style={styles.cancelBtn}
              >
                취소
              </button>
              <button onClick={handleWodSubmit} style={styles.submitBtn}>
                {isEditing ? '수정 완료' : '기록 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '0 20px 100px',
    backgroundColor: 'var(--bg-card)',
    minHeight: '100vh',
  },
  header: {
    paddingTop: '24px',
    paddingBottom: '8px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },

  // Calendar
  calendarSection: {
    padding: '20px 0',
    borderBottom: '8px solid var(--bg-secondary)',
  },
  dot: {
    height: '12px',
    width: '12px',
    backgroundColor: '#3182F6',
    borderRadius: '50%',
    marginTop: '4px',
  },

  // Tabs
  tabNav: {
    display: 'flex',
    marginTop: '24px',
    padding: '4px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '14px',
    gap: '4px',
  },
  tab: {
    flex: 1,
    padding: '12px',
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeTab: {
    flex: 1,
    padding: '12px',
    fontSize: '15px',
    fontWeight: '700',
    color: TOSS_BLUE,
    backgroundColor: 'var(--bg-card)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
  },
  contentArea: {
    paddingBottom: '20px',
  },
  addSelfWorkoutBtn: {
    width: '100%',
    padding: '16px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: TOSS_BLUE,
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '16px',
    boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)',
  },
  inlineActionRow: {
    display: 'flex',
    gap: '8px',
  },

  // Date display
  dateSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 0',
    borderBottom: '1px solid var(--border-color)',
  },
  dateText: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  summarySection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginTop: '16px',
  },
  summaryCard: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '14px',
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    minHeight: '78px',
  },
  summaryLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: '15px',
    color: 'var(--text-primary)',
    fontWeight: '700',
  },

  // Workout card
  workoutCard: {
    padding: '16px',
    marginTop: '16px',
    backgroundColor: 'var(--primary-bg)',
    borderRadius: '16px',
    borderLeft: `4px solid var(--primary)`,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: TOSS_BLUE,
  },
  workoutTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  workoutTime: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  workoutInfoBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  workoutRecordText: {
    fontSize: '20px',
    fontWeight: '800',
    color: TOSS_BLUE,
  },
  workoutContentText: {
    fontSize: '15px',
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap' as const,
    marginTop: '4px',
    lineHeight: '1.5',
  },
  workoutMemoText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '10px 12px',
    borderRadius: '10px',
    marginTop: '6px',
    lineHeight: '1.4',
    borderLeft: '3px solid var(--border-color)',
  },

  // WOD card
  wodCard: {
    marginTop: '16px',
    padding: '20px',
    backgroundColor: 'var(--warning-bg)',
    borderRadius: '16px',
    border: '1px solid var(--warning)',
    overflow: 'hidden', // ✅ 자식 요소 넘침 방지
  },
  wodHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  wodTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--danger)',
  },
  wodTitleText: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  wodContent: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-card)',
    padding: '14px',
    borderRadius: '12px',
    whiteSpace: 'pre-wrap' as const,
    lineHeight: '1.6',
    marginBottom: '16px',
  },

  // Completed
  completedBox: {
    backgroundColor: 'var(--success-bg)',
    borderRadius: '12px',
    padding: '16px',
  },
  completedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  completedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--success)',
  },
  actionBtns: {
    display: 'flex',
    gap: '8px',
  },
  editBtn: {
    padding: '8px',
    backgroundColor: '#E0F2FE',
    color: TOSS_BLUE,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '8px',
    backgroundColor: '#FEE2E2',
    color: '#EF4444',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  recordValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  recordLevel: {
    fontSize: '13px',
    color: 'var(--success)',
    marginTop: '4px',
  },

  // Form
  formSection: {
    borderTop: '1px solid var(--warning)',
    paddingTop: '16px',
    overflow: 'hidden', // ✅ 입력 필드 넘침 방지
  },
  formTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  levelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginBottom: '16px',
  },
  levelBtn: {
    padding: '10px',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  levelBtnActive: {
    padding: '10px',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--primary)',
    backgroundColor: 'var(--primary-bg)',
    border: `2px solid var(--primary)`,
    borderRadius: '10px',
    cursor: 'pointer',
  },
  inputGrid: {
    display: 'flex', // ✅ Flex로 변경 (모바일 Safari 호환성)
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    width: '100%',
    maxWidth: '100%', // ✅ 부모 너비 초과 방지
    boxSizing: 'border-box' as const,
  },
  input: {
    flex: '1 1 0%', // ✅ 균등 분배 + 축소 허용
    minWidth: '0', // ✅ Flex 아이템 축소 허용
    maxWidth: 'calc(50% - 20px)', // ✅ 절대 절반 이상 차지 못하게 제한
    padding: '12px 8px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    textAlign: 'center' as const,
    boxSizing: 'border-box' as const,
  },
  inputLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  btnRow: {
    display: 'flex',
    gap: '12px',
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-hover)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 2,
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: TOSS_BLUE,
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: '14px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    cursor: 'pointer',
  },

  // Empty
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    marginTop: '20px',
  },
  emptyText: {
    fontSize: '15px',
    color: '#9CA3AF',
    marginTop: '16px',
    marginBottom: '16px',
  },
  recentSection: {
    padding: '16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '16px',
  },
  recentHeader: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  recentItem: {
    width: '100%',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-card)',
    borderRadius: '12px',
    padding: '12px',
    textAlign: 'left' as const,
    cursor: 'pointer',
  },
  recentItemTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  recentItemMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  tabRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' },
  inputTab: { padding: '14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '2px solid transparent', borderRadius: '14px', cursor: 'pointer', transition: 'all 0.1s' },
  inputTabActive: { padding: '14px', fontSize: '15px', fontWeight: '700', color: 'var(--primary)', backgroundColor: 'var(--primary-bg)', border: `2px solid var(--primary)`, borderRadius: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.1)' },

  // 모달 스타일
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '20px',
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
    boxSizing: 'border-box' as const,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  modalInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  },
  modalInput: {
    flex: 1,
    minWidth: 0,
    padding: '14px 12px',
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    textAlign: 'center' as const,
    boxSizing: 'border-box' as const,
  },
};

export default MyWorkoutsPage;// Force build after root directory change
