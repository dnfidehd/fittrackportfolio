import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getWod, createWorkout, updateWorkout } from '../../services/api';
import { WOD_TYPES } from '../../constants/workouts';
import { X, Flame, Calendar, Clock, Target, CheckCircle, Dumbbell, Repeat, Timer, Check, Edit2 } from 'lucide-react';

const TOSS_BLUE = '#3182F6';
const TOSS_RED = '#EF4444';

interface AddWorkoutModalProps {
  onClose: () => void;
  onWorkoutAdded: () => void;
  userName?: string;
  initialDate: Date;
  isPersonalRecord?: boolean;
  initialData?: any; // ✅ 수정용 데이터
}

const AddWorkoutModal: React.FC<AddWorkoutModalProps> = ({ onClose, onWorkoutAdded, userName = '나', initialDate, isPersonalRecord = false, initialData }) => {
  const [date, setDate] = useState(() => {
    // 수정 모드라면 initialData의 날짜 사용
    if (initialData?.date) {
      return initialData.date.split('T')[0];
    }
    const offset = initialDate.getTimezoneOffset() * 60000;
    const localDate = new Date(initialDate.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  });

  const [officialWod, setOfficialWod] = useState<any>(null);
  const [useOfficial, setUseOfficial] = useState(true);
  const [wodType, setWodType] = useState(WOD_TYPES[0].label);

  const [isTimeCap, setIsTimeCap] = useState(false);
  const [timeValue, setTimeValue] = useState("");
  const [rounds, setRounds] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [memo, setMemo] = useState("");

  // Custom WOD fields
  const [customTitle, setCustomTitle] = useState("");
  const [customContent, setCustomContent] = useState("");

  // Time input split
  const [inputMinutes, setInputMinutes] = useState("");
  const [inputSeconds, setInputSeconds] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDailyWod = async () => {
      try {
        const res = await getWod(date);
        if (res.data) {
          setOfficialWod(res.data);
          setUseOfficial(true);
          const typeStr = res.data.score_type.toLowerCase();
          if (typeStr.includes("time")) setWodType("For Time");
          else if (typeStr.includes("amrap")) setWodType("AMRAP");
          else if (typeStr.includes("emom")) setWodType("EMOM");
          else if (typeStr.includes("weight") || typeStr.includes("load")) setWodType("Strength");
          else setWodType("Custom");
        } else {
          setOfficialWod(null);
          setUseOfficial(false);
          setWodType("For Time");
        }

        // 개인 운동 기록 모드라면 강제로 커스텀 모드 설정
        if (isPersonalRecord) {
          setUseOfficial(false);
        }
      } catch (e) {
        setOfficialWod(null);
        setUseOfficial(false);
      }
    };
    fetchDailyWod();
  }, [date, isPersonalRecord]);

  // ✅ [수정 모드] 데이터 파싱 및 폼 초기화
  useEffect(() => {
    if (initialData) {
      setUseOfficial(false); // 수정 시 기본적으로 커스텀 모드로 간주 (단순화)

      // 1. 제목 파싱
      setCustomTitle(initialData.workout || "");

      const timeStr = initialData.time || "";

      // 2. 기록/내용/메모 파싱
      const recordMatch = timeStr.match(/\[기록: (.*?)\]/);
      const contentMatch = timeStr.match(/\[내용: (.*?)\]/);
      const memoMatch = timeStr.split('메모:')[1];

      const recordValue = recordMatch ? recordMatch[1] : timeStr; // 포맷 안맞으면 전체 문자열
      const contentValue = contentMatch ? contentMatch[1] : "";

      setCustomContent(contentValue);
      if (memoMatch) setMemo(memoMatch.trim());

      // 3. WOD 타입 추론 및 값 설정
      if (recordValue.includes("분") && recordValue.includes("초")) {
        setWodType("For Time");
        const mm = recordValue.match(/(\d+)분/)?.[1] || "0";
        const ss = recordValue.match(/(\d+)초/)?.[1] || "0";
        setInputMinutes(mm);
        setInputSeconds(ss);
        setIsTimeCap(false);
      } else if (recordValue.includes("Time Cap")) {
        setWodType("For Time");
        setIsTimeCap(true);
        // "Time Cap (33 Reps)" -> 33
        const repsVal = recordValue.match(/\((\d+) Reps\)/)?.[1] || "";
        setReps(repsVal);
      } else if (recordValue.includes("lb")) {
        setWodType("Strength");
        const weightVal = recordValue.replace("lb", "").trim();
        setWeight(weightVal);
      } else if (recordValue.includes("R") || (contentValue && (contentValue.includes("AMRAP") || contentValue.includes("EMOM")))) {
        // "5R + 10" or "10R"
        setWodType("AMRAP");
        if (recordValue.includes("R")) {
          const parts = recordValue.split("R");
          setRounds(parts[0].trim());
          if (parts[1] && parts[1].includes("+")) {
            setReps(parts[1].replace("+", "").trim());
          }
        }
      } else {
        setWodType("Custom");
        setReps(recordValue); // Custom type usually just handles simple text or reps
      }
    }
  }, [initialData]);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'min' | 'sec') => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (type === 'min') setInputMinutes(val);
    else {
      if (parseInt(val) > 59) return; // 초는 59초까지만
      setInputSeconds(val);
    }
  };

  const formatTimeDisplay = (val: string) => {
    if (!val) return "";
    const padded = val.padStart(4, "0");
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalScore = "";
    if (wodType.includes("For Time")) {
      if (isTimeCap) {
        finalScore = `Time Cap (${reps ? reps + ' Reps' : 'DNF'})`;
      } else if (inputMinutes || inputSeconds) {
        const mm = inputMinutes.padStart(2, "0") || "00";
        const ss = inputSeconds.padStart(2, "0") || "00";
        finalScore = `${parseInt(mm)}분 ${ss}초`;
      } else {
        finalScore = "기록 없음";
      }
    } else if (wodType.includes("AMRAP") || wodType.includes("EMOM")) {
      finalScore = `${rounds ? rounds + 'R' : ''} ${reps ? '+ ' + reps : ''}`.trim() || "0R";
    } else if (wodType.includes("Strength")) {
      finalScore = weight ? `${weight}lb` : "0lb";
    } else {
      finalScore = reps || "완료";
    }

    setLoading(true);
    try {
      let finalTitle = "";
      let description = "";

      if (useOfficial && officialWod) {
        finalTitle = officialWod.title;
      } else {
        // 커스텀 제목이 있으면 사용, 없으면 타입 기반 제목
        finalTitle = customTitle.trim() || `${wodType} Workout`;
      }

      // [기록: ...] | [내용: ...] | [메모: ...] 형식을 유지하여 파싱하기 쉽게 저장
      const parts = [];
      parts.push(`[기록: ${finalScore}]`);

      if (!useOfficial) {
        if (customContent.trim()) parts.push(`[내용: ${customContent.trim()}]`);
      } else {
        parts.push(`(Box WOD) ${officialWod.description}`);
      }

      if (memo.trim()) parts.push(`메모: ${memo.trim()}`);

      const timeString = parts.join(' | ');

      if (initialData) {
        await updateWorkout(initialData.id, {
          date,
          workout: finalTitle,
          time: timeString
        });
        toast.success("수정되었습니다!");
      } else {
        await createWorkout({ memberName: userName, date, workout: finalTitle, time: timeString });
        toast.success("저장되었습니다!");
      }

      onWorkoutAdded();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('저장 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* 헤더 */}
        <div style={styles.header}>
          <div style={styles.headerTitleBox}>
            <div style={styles.iconBox}><Flame size={24} color="#FFFFFF" /></div>
            <h3 style={styles.title}>{initialData ? '운동 기록 수정' : '운동 기록'}</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.scrollArea}>
            <div style={styles.formGroup}>
              <label style={styles.label}><Calendar size={14} /> 날짜 선택</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
            </div>

            {officialWod && !isPersonalRecord && (
              <div style={styles.wodCard}>
                <div style={styles.wodCardHeader}>
                  <div style={styles.wodBadge}>TODAY'S WOD</div>
                  <label style={styles.checkboxLabel}>
                    <div style={{ ...styles.checkbox, backgroundColor: useOfficial ? TOSS_BLUE : 'var(--bg-secondary)' }}>
                      {useOfficial && <Check size={12} color="#FFFFFF" />}
                    </div>
                    <input type="checkbox" checked={useOfficial} onChange={(e) => setUseOfficial(e.target.checked)} style={{ display: 'none' }} />
                    <span style={styles.checkboxText}>이 와드로 기록</span>
                  </label>
                </div>
                {useOfficial ? (
                  <div style={styles.wodContent}>
                    <div style={styles.wodTitle}>{officialWod.title}</div>
                    <div style={styles.wodDesc}>{officialWod.description}</div>
                  </div>
                ) : (
                  <div style={styles.customWodText}>나만의 운동 기록을 직접 입력합니다.</div>
                )}
              </div>
            )}

            <div style={styles.divider} />

            {/* Custom WOD Content Input (Only when NOT using official WOD) */}
            {!useOfficial && (
              <div style={styles.customSection}>
                <label style={styles.sectionHeader}><Edit2 size={18} /> 와드 구성 (직접 입력)</label>
                <div style={styles.formGroup}>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="운동 제목 (예: 오늘의 개인 와드)"
                    style={styles.input}
                  />
                  <textarea
                    value={customContent}
                    onChange={(e) => setCustomContent(e.target.value)}
                    placeholder="와드 내용을 입력하세요 (예: 21-15-9 Thrusters, Pull-ups...)"
                    style={{ ...styles.textarea, minHeight: '80px', marginTop: '8px' }}
                  />
                </div>
                <div style={styles.divider} />
              </div>
            )}

            <div style={styles.scoreSection}>
              <label style={styles.sectionHeader}><Target size={18} /> 기록 입력</label>

              {/* For Time Input */}
              {wodType.includes("For Time") && (
                <div style={styles.scoreContainer}>
                  <div style={styles.tabContainer}>
                    <button type="button" onClick={() => setIsTimeCap(false)} style={!isTimeCap ? styles.activeTab : styles.tab}>
                      <Clock size={16} /> 완주 (Time)
                    </button>
                    <button type="button" onClick={() => setIsTimeCap(true)} style={isTimeCap ? styles.activeTab : styles.tab}>
                      <Timer size={16} /> 타임캡 (Time Cap)
                    </button>
                  </div>

                  {!isTimeCap ? (
                    <div style={styles.timeInputRow}>
                      <div style={styles.timeInputWrapper}>
                        <input
                          type="tel"
                          value={inputMinutes}
                          onChange={(e) => handleTimeChange(e, 'min')}
                          placeholder="00"
                          style={styles.timeInput}
                          maxLength={3}
                        />
                        <span style={styles.timeLabel}>분</span>
                      </div>
                      <div style={styles.timeSeparator}>:</div>
                      <div style={styles.timeInputWrapper}>
                        <input
                          type="tel"
                          value={inputSeconds}
                          onChange={(e) => handleTimeChange(e, 'sec')}
                          placeholder="00"
                          style={styles.timeInput}
                          maxLength={2}
                        />
                        <span style={styles.timeLabel}>초</span>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.singleInputBox}>
                      <input type="number" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="0" style={styles.largeInput} />
                      <span style={styles.unitText}>Reps (완료 횟수)</span>
                    </div>
                  )}
                </div>
              )}

              {/* AMRAP / EMOM Input */}
              {(wodType.includes("AMRAP") || wodType.includes("EMOM")) && (
                <div style={styles.amrapContainer}>
                  <div style={styles.scoreBox}>
                    <input type="number" value={rounds} onChange={(e) => setRounds(e.target.value)} placeholder="0" style={styles.largeInput} />
                    <span style={styles.unitText}>Rounds</span>
                  </div>
                  <div style={styles.plusIcon}>+</div>
                  <div style={styles.scoreBox}>
                    <input type="number" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="0" style={styles.largeInput} />
                    <span style={styles.unitText}>Reps</span>
                  </div>
                </div>
              )}

              {/* Strength Input */}
              {wodType.includes("Strength") && (
                <div style={styles.singleInputBox}>
                  <Dumbbell size={24} color={TOSS_BLUE} style={{ marginBottom: '8px' }} />
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" style={styles.largeInput} />
                  <span style={styles.unitText}>Weight (lb)</span>
                </div>
              )}

              {/* Memo Input */}
              <div style={{ marginTop: '20px' }}>
                <label style={styles.label}><CheckCircle size={14} /> 오늘의 피드백 (메모)</label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="오늘 운동은 어땠나요? 컨디션이나 보완할 점을 적어보세요."
                  style={styles.textarea}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>취소</button>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? '저장 중...' : (initialData ? '수정 완료' : '기록 저장하기')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
  modal: { backgroundColor: 'var(--bg-card)', borderRadius: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', overflow: 'hidden' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' },
  headerTitleBox: { display: 'flex', alignItems: 'center', gap: '12px' },
  iconBox: { width: '40px', height: '40px', borderRadius: '14px', backgroundColor: TOSS_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px', transition: 'color 0.2s' },

  form: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  scrollArea: { padding: '32px', overflowY: 'auto', flex: 1 },

  formGroup: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' },
  label: { fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' },
  input: { padding: '14px 16px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', outline: 'none', boxSizing: 'border-box', width: '100%', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
  textarea: {
    padding: '14px 16px',
    borderRadius: '14px',
    border: '1px solid var(--border-color)',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    minHeight: '100px',
    marginTop: '8px',
    resize: 'none',
    lineHeight: '1.5'
  },

  wodCard: { padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' },
  wodCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  wodBadge: { fontSize: '12px', fontWeight: '800', color: 'var(--warning)', backgroundColor: 'var(--bg-card)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
  checkbox: { width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', border: '1px solid var(--border-color)' },
  checkboxText: { fontSize: '14px', fontWeight: '600', color: 'var(--warning)' },
  wodContent: { backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' },
  wodTitle: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' },
  wodDesc: { fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' as const, lineHeight: '1.5' },
  customWodText: { fontSize: '14px', color: 'var(--text-tertiary)', padding: '12px', textAlign: 'center' as const },

  divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '24px 0' },

  scoreSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
  sectionHeader: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' },

  scoreContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  tabContainer: { display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '14px', border: '1px solid var(--border-color)' },
  tab: { flex: 1, padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  activeTab: { flex: 1, padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--bg-card)', color: TOSS_BLUE, fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },

  timeInputRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)' },
  timeInputWrapper: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  timeInput: { fontSize: '32px', fontWeight: '800', textAlign: 'center' as const, width: '80px', border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)' },
  timeLabel: { fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)', marginTop: '4px' },
  timeSeparator: { fontSize: '32px', fontWeight: '800', color: 'var(--text-tertiary)', paddingBottom: '20px' },

  customSection: { display: 'flex', flexDirection: 'column', gap: '16px' },

  singleInputBox: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)' },
  amrapContainer: { display: 'flex', alignItems: 'center', gap: '12px' },
  scoreBox: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)' },
  largeInput: { fontSize: '32px', fontWeight: '800', textAlign: 'center' as const, border: 'none', background: 'transparent', width: '100%', outline: 'none', color: 'var(--text-primary)' },
  unitText: { fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)', marginTop: '4px' },
  plusIcon: { fontSize: '24px', fontWeight: '800', color: 'var(--text-tertiary)' },

  footer: { padding: '24px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', backgroundColor: 'var(--bg-card)' },
  cancelBtn: { flex: 1, padding: '18px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s' },
  submitBtn: { flex: 2, padding: '18px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', border: 'none', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)' },
};

export default AddWorkoutModal;