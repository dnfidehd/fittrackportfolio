import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { estimateOpenPercentile } from '../../services/api';

const YEARS = [2026, 2025, 2024];
const EVENTS = [1, 2, 3];

const EVENT_DETAILS: Record<number, Record<number, { title: string; cap: string; workout: string[] }>> = {
  2026: {
    1: {
      title: 'Open 26.1',
      cap: 'Time cap: 12 minutes',
      workout: [
        '20 wall-ball shots',
        '18 box jump-overs',
        '30 wall-ball shots',
        '18 box jump-overs',
        '40 wall-ball shots',
        '18 medicine-ball box step-overs',
        '66 wall-ball shots',
        '18 medicine-ball box step-overs',
        '40 wall-ball shots',
        '18 box jump-overs',
        '30 wall-ball shots',
        '18 box jump-overs',
        '20 wall-ball shots',
      ],
    },
    2: {
      title: 'Open 26.2',
      cap: 'Time cap: 15 minutes',
      workout: [
        '80-foot dumbbell overhead walking lunge',
        '20 alternating dumbbell snatches',
        '20 pull-ups',
        '80-foot dumbbell overhead walking lunge',
        '20 alternating dumbbell snatches',
        '20 chest-to-bar pull-ups',
        '80-foot dumbbell overhead walking lunge',
        '20 alternating dumbbell snatches',
        '20 muscle-ups',
      ],
    },
    3: {
      title: 'Open 26.3',
      cap: 'Time cap: 16 minutes',
      workout: [
        '2 rounds of:',
        '12 burpees over the bar',
        '12 cleans, weight 1',
        '12 burpees over the bar',
        '12 thrusters, weight 1',
        '2 rounds of:',
        '12 burpees over the bar',
        '12 cleans, weight 2',
        '12 burpees over the bar',
        '12 thrusters, weight 2',
        '2 rounds of:',
        '12 burpees over the bar',
        '12 cleans, weight 3',
        '12 burpees over the bar',
        '12 thrusters, weight 3',
      ],
    },
  },
  2025: {
    1: {
      title: 'Open 25.1',
      cap: 'AMRAP 15 minutes',
      workout: [
        '3 lateral burpees over the dumbbell',
        '3 dumbbell hang clean-to-overheads',
        '30-foot walking lunge (2 x 15 feet)',
        '* After completing each round, add 3 reps to the burpees and hang clean-to-overheads.',
      ],
    },
    2: {
      title: 'Open 25.2',
      cap: 'Time cap: 12 minutes',
      workout: [
        '(22.3 repeat)',
        '21 pull-ups',
        '42 double-unders',
        '21 thrusters (weight 1)',
        '18 chest-to-bar pull-ups',
        '36 double-unders',
        '18 thrusters (weight 2)',
        '15 bar muscle-ups',
        '30 double-unders',
        '15 thrusters (weight 3)',
      ],
    },
    3: {
      title: 'Open 25.3',
      cap: 'Time cap: 20 minutes',
      workout: [
        '5 wall walks',
        '50-calorie row',
        '5 wall walks',
        '25 deadlifts',
        '5 wall walks',
        '25 cleans',
        '5 wall walks',
        '25 snatches',
        '5 wall walks',
        '50-calorie row',
      ],
    },
  },
  2024: {
    1: {
      title: 'Open 24.1',
      cap: 'Time cap: 15 minutes',
      workout: [
        '21 dumbbell snatches, arm 1',
        '21 lateral burpees over dumbbell',
        '21 dumbbell snatches, arm 2',
        '21 lateral burpees over dumbbell',
        '15 dumbbell snatches, arm 1',
        '15 lateral burpees over dumbbell',
        '15 dumbbell snatches, arm 2',
        '15 lateral burpees over dumbbell',
        '9 dumbbell snatches, arm 1',
        '9 lateral burpees over dumbbell',
        '9 dumbbell snatches, arm 2',
        '9 lateral burpees over dumbbell',
      ],
    },
    2: {
      title: 'Open 24.2',
      cap: 'AMRAP 20 minutes',
      workout: [
        '300-meter row',
        '10 deadlifts',
        '50 double-unders',
      ],
    },
    3: {
      title: 'Open 24.3',
      cap: 'Time cap: 15 minutes',
      workout: [
        'All for time:',
        '5 rounds of:',
        '10 thrusters, weight 1',
        '10 chest-to-bar pull-ups',
        'Rest 1 minute, then:',
        '5 rounds of:',
        '7 thrusters, weight 2',
        '7 bar muscle-ups',
      ],
    },
  },
};

const OpenPercentilePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [isMobile, setIsMobile] = useState(false);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [year, setYear] = useState<number>(2026);
  const [event, setEvent] = useState<number>(1);
  const [scoreMode, setScoreMode] = useState<'time' | 'reps'>('reps');
  const [scoreValue, setScoreValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const inputPlaceholder = useMemo(() => {
    return scoreMode === 'time' ? '예: 09:21' : '예: 190 reps';
  }, [scoreMode]);

  const selectedEventDetail = EVENT_DETAILS[year][event];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const yearParam = Number(searchParams.get('year'));
    const eventParam = Number(searchParams.get('event'));
    const genderParam = searchParams.get('gender');

    if ([2024, 2025, 2026].includes(yearParam)) {
      setYear(yearParam);
    }
    if ([1, 2, 3].includes(eventParam)) {
      setEvent(eventParam);
    }
    if (genderParam === 'male' || genderParam === 'female') {
      setGender(genderParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await estimateOpenPercentile({
        year,
        event,
        gender,
        is_rx: true,
        country: 'KR',
        score_mode: scoreMode,
        score_value: scoreValue,
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || '순위 추정에 실패했습니다.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <div style={styles.container}>
        <div style={{ ...styles.heroCard, ...(isMobile ? styles.heroCardMobile : {}) }}>
          <div style={styles.heroBadge}>오픈 퍼센타일 실험실</div>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>내 점수로 한국 기준 위치를 빠르게 확인해보세요</h1>
          <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>
            게스트 리더보드처럼 가볍게 보는 실험 기능입니다. CrossFit Games KR 리더보드 샘플을 이용해 근사 순위를 계산합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ ...styles.sectionCard, ...(isMobile ? styles.sectionCardMobile : {}) }}>
          <div style={styles.sectionTitleRow}>
            <div>
              <div style={styles.sectionTitle}>기본 조건 선택</div>
              <div style={styles.sectionDesc}>성별, 연도, 이벤트를 고르면 해당 조건 기준으로 비교합니다.</div>
            </div>
          </div>

          <div style={{ ...styles.selectionLayout, ...(isMobile ? styles.selectionLayoutMobile : {}) }}>
            <div style={styles.leftColumn}>
              <div style={styles.filterGroup}>
                <div style={styles.label}>성별</div>
                <div style={styles.toggleRow}>
                  {(['male', 'female'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGender(value)}
                      style={{
                        ...styles.toggleBtn,
                        ...(gender === value ? styles.toggleBtnActive : {}),
                      }}
                    >
                      {value === 'male' ? '남자' : '여자'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.filterGroup}>
                <div style={styles.label}>연도</div>
                <div style={{ ...styles.eventRow, ...(isMobile ? styles.eventRowMobile : {}) }}>
                  {YEARS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setYear(value)}
                      style={{
                        ...styles.eventPill,
                        ...(isMobile ? styles.eventPillMobile : {}),
                        ...(year === value ? styles.eventPillActive : {}),
                      }}
                    >
                      <div style={styles.eventPillTitle}>{value}</div>
                      <div style={styles.eventPillSub}>Open</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.filterGroup}>
                <div style={styles.label}>이벤트</div>
                <div style={{ ...styles.eventRow, ...(isMobile ? styles.eventRowMobile : {}) }}>
                  {EVENTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEvent(value)}
                      style={{
                        ...styles.eventPill,
                        ...(isMobile ? styles.eventPillMobile : {}),
                        ...(event === value ? styles.eventPillActive : {}),
                      }}
                    >
                      <div style={styles.eventPillTitle}>{year}.{value}</div>
                      <div style={styles.eventPillSub}>KR RX</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ ...styles.inlineInputCard, ...(isMobile ? styles.inlineInputCardMobile : {}) }}>
                <div style={styles.sectionTitle}>내 점수 입력</div>
                <div style={styles.sectionDesc}>리더보드와 비교할 점수 형식을 고르고 기록을 입력하세요.</div>

                <div style={{ ...styles.toggleRow, ...(isMobile ? styles.toggleRowMobile : {}), marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setScoreMode('time')}
                    style={{
                      ...styles.modeBtn,
                      ...(isMobile ? styles.modeBtnMobile : {}),
                      ...(scoreMode === 'time' ? styles.modeBtnActive : {}),
                    }}
                  >
                    완료 시간
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoreMode('reps')}
                    style={{
                      ...styles.modeBtn,
                      ...(isMobile ? styles.modeBtnMobile : {}),
                      ...(scoreMode === 'reps' ? styles.modeBtnActive : {}),
                    }}
                  >
                    타임캡 / 렙수
                  </button>
                </div>

                <input
                  value={scoreValue}
                  onChange={(e) => setScoreValue(e.target.value)}
                  placeholder={inputPlaceholder}
                  style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }}
                />

                <button type="submit" disabled={loading} style={{ ...styles.submitBtn, ...(isMobile ? styles.submitBtnMobile : {}) }}>
                  {loading ? '순위 계산 중...' : '예상 순위 확인'}
                </button>

                <div style={{ ...styles.inlineResultCard, ...(isMobile ? styles.inlineResultCardMobile : {}) }}>
                  <div style={{ ...styles.inlineResultHeader, ...(isMobile ? styles.inlineResultHeaderMobile : {}) }}>
                    <div style={styles.inlineResultTitle}>예상 결과</div>
                    <div style={styles.inlineResultSub}>현재 입력값 기준</div>
                  </div>

                  {result ? (
                    <>
                      <div style={{ ...styles.inlineResultPercent, ...(isMobile ? styles.inlineResultPercentMobile : {}) }}>상위 {result.top_percent}%</div>
                      <div style={styles.inlineResultRank}>
                        약 {result.estimated_rank}위 / {result.total_competitors.toLocaleString()}명
                      </div>
                    </>
                  ) : (
                    <div style={styles.inlineResultEmpty}>점수를 입력하면 여기에서 바로 결과를 확인할 수 있습니다.</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ ...styles.eventDetailCard, ...(isMobile ? styles.eventDetailCardMobile : {}) }}>
              <div style={{ ...styles.eventDetailHeader, ...(isMobile ? styles.eventDetailHeaderMobile : {}) }}>
                <div>
                  <div style={{ ...styles.eventDetailTitle, ...(isMobile ? styles.eventDetailTitleMobile : {}) }}>{selectedEventDetail.title}</div>
                  <div style={styles.eventDetailSubtitle}>{gender === 'male' ? '남자' : '여자'} · {year} · KR RX</div>
                </div>
                <div style={{ ...styles.eventDetailBadge, ...(isMobile ? styles.eventDetailBadgeMobile : {}) }}>{selectedEventDetail.cap}</div>
              </div>

              <div key={`${year}-${event}`} style={{ ...styles.workoutBlock, ...(isMobile ? styles.workoutBlockMobile : {}) }}>
                {selectedEventDetail.workout.map((line, index) => (
                  <div key={`${year}-${event}-${index}`} style={{ ...styles.workoutLine, ...(isMobile ? styles.workoutLineMobile : {}) }}>
                    {line}
                  </div>
                ))}
              </div>

              <div style={{ ...styles.noticeCard, ...(isMobile ? styles.noticeCardMobile : {}) }}>
                <div style={styles.noticeTitle}>안내</div>
                <div style={styles.noticeText}>
                  본 결과는 CrossFit Games KR 리더보드 샘플을 바탕으로 산출한 참고용 추정치이며, 실제 순위와 차이가 있을 수 있습니다.
                </div>
                <div style={styles.noticeText}>
                  현재 타이브레이크는 반영되지 않으므로, 비슷한 기록 구간에서는 실제 순위와 차이가 더 크게 발생할 수 있습니다.
                </div>
              </div>
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    padding: '24px 16px 100px',
  },
  pageMobile: {
    padding: '16px 12px 72px',
    overflowX: 'hidden',
  },
  container: {
    maxWidth: 980,
    margin: '0 auto',
  },
  heroCard: {
    background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--primary-bg) 100%)',
    border: '1px solid var(--border-color)',
    borderRadius: 28,
    padding: '28px 24px',
    boxShadow: '0 10px 32px rgba(49, 130, 246, 0.08)',
    marginBottom: 20,
  },
  heroCardMobile: {
    borderRadius: 22,
    padding: '22px 18px',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(49, 130, 246, 0.1)',
    color: 'var(--primary)',
    padding: '8px 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 14,
  },
  title: {
    fontSize: 32,
    lineHeight: 1.3,
    margin: 0,
  },
  titleMobile: {
    fontSize: 24,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    marginTop: 12,
    fontSize: 15,
    lineHeight: 1.6,
  },
  subtitleMobile: {
    fontSize: 14,
  },
  sectionCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 6px 24px rgba(15, 23, 42, 0.04)',
    marginBottom: 20,
  },
  sectionCardMobile: {
    padding: 16,
    borderRadius: 20,
  },
  sectionTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  sectionDesc: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginTop: 4,
    lineHeight: 1.5,
  },
  filterGroup: {
    marginBottom: 20,
  },
  selectionLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.1fr)',
    gap: 20,
    alignItems: 'stretch',
  },
  selectionLayoutMobile: {
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: 16,
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 10,
    fontWeight: 700,
  },
  toggleRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  eventRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  eventRowMobile: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  toggleBtn: {
    padding: '12px 16px',
    borderRadius: 14,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 700,
    minWidth: 88,
  },
  toggleBtnActive: {
    background: 'var(--primary-bg)',
    color: 'var(--primary)',
    border: '1px solid var(--primary)',
  },
  eventPill: {
    minWidth: 110,
    padding: '16px 14px',
    borderRadius: 18,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
  },
  eventPillMobile: {
    minWidth: 0,
    width: '100%',
  },
  eventPillActive: {
    background: 'var(--primary-bg)',
    border: '1px solid var(--primary)',
    boxShadow: '0 8px 20px rgba(49, 130, 246, 0.14)',
    transform: 'translateY(-1px)',
  },
  eventPillTitle: {
    fontWeight: 800,
    fontSize: 16,
    color: 'var(--text-primary)',
  },
  eventPillSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  eventDetailCard: {
    borderRadius: 24,
    border: '1px solid var(--border-color)',
    background: 'linear-gradient(180deg, #ffffff 0%, var(--bg-secondary) 100%)',
    padding: '20px 18px',
    minHeight: 280,
    boxSizing: 'border-box',
  },
  eventDetailCardMobile: {
    padding: '16px 14px',
    minHeight: 0,
    minWidth: 0,
  },
  eventDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  eventDetailHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  eventDetailTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  eventDetailTitleMobile: {
    fontSize: 20,
  },
  eventDetailSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: 'var(--text-secondary)',
  },
  eventDetailBadge: {
    background: 'var(--primary-bg)',
    color: 'var(--primary)',
    border: '1px solid var(--primary)',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  eventDetailBadgeMobile: {
    alignSelf: 'flex-start',
    whiteSpace: 'normal',
  },
  workoutBlock: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '16px',
    borderRadius: 16,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
  },
  workoutBlockMobile: {
    padding: '14px',
  },
  workoutLine: {
    fontSize: 15,
    lineHeight: 1.7,
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  workoutLineMobile: {
    fontSize: 14,
    lineHeight: 1.6,
  },
  noticeCard: {
    marginTop: 16,
    padding: '16px',
    borderRadius: 18,
    background: '#FFF4F1',
    border: '1px solid #FBC7BC',
  },
  noticeCardMobile: {
    padding: '14px',
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#C2410C',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 1.7,
    color: '#7C2D12',
  },
  inlineInputCard: {
    marginTop: 'auto',
    padding: '20px 18px',
    borderRadius: 20,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
  },
  inlineInputCardMobile: {
    marginTop: 0,
    padding: '16px 14px',
  },
  inputCard: {
    marginTop: 20,
    padding: '20px 18px',
    borderRadius: 20,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
  },
  modeBtn: {
    padding: '12px 16px',
    borderRadius: 14,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  modeBtnMobile: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    padding: '12px 10px',
  },
  toggleRowMobile: {
    flexWrap: 'nowrap',
  },
  modeBtnActive: {
    background: 'var(--primary-bg)',
    color: 'var(--primary)',
    border: '1px solid var(--primary)',
  },
  input: {
    width: '100%',
    marginTop: 14,
    padding: '18px 18px',
    borderRadius: 16,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 22,
    fontWeight: 700,
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  inputMobile: {
    fontSize: 18,
    padding: '16px 14px',
  },
  submitBtn: {
    width: '100%',
    marginTop: 16,
    padding: '18px 20px',
    borderRadius: 16,
    border: 'none',
    background: 'var(--primary)',
    color: '#FFFFFF',
    fontWeight: 800,
    fontSize: 16,
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(49, 130, 246, 0.2)',
  },
  submitBtnMobile: {
    padding: '16px 18px',
    fontSize: 15,
  },
  error: {
    marginTop: 14,
    color: '#DC2626',
    fontSize: 14,
  },
  resultCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 24,
    padding: '24px',
    boxShadow: '0 6px 24px rgba(15, 23, 42, 0.04)',
  },
  resultHero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(260px, 1fr)',
    gap: 16,
    alignItems: 'stretch',
  },
  resultPercentBlock: {
    background: 'linear-gradient(135deg, rgba(49, 130, 246, 0.08) 0%, rgba(49, 130, 246, 0.16) 100%)',
    borderRadius: 24,
    padding: '28px 20px',
    border: '1px solid rgba(49, 130, 246, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  resultLabel: {
    color: 'var(--text-secondary)',
    fontSize: 15,
    marginBottom: 10,
  },
  resultValue: {
    color: 'var(--primary)',
    fontSize: 52,
    fontWeight: 900,
    lineHeight: 1,
  },
  resultSub: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  resultMetaCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 24,
    padding: '20px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    justifyContent: 'center',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  metaValue: {
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 700,
  },
  resultNote: {
    marginTop: 18,
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.6,
  },
  emptyState: {
    background: 'var(--bg-secondary)',
    borderRadius: 20,
    padding: '28px 20px',
    border: '1px dashed var(--border-color)',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  emptyText: {
    marginTop: 8,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  inlineResultCard: {
    marginTop: 16,
    padding: '18px 16px',
    borderRadius: 18,
    background: 'linear-gradient(135deg, rgba(49, 130, 246, 0.08) 0%, rgba(49, 130, 246, 0.16) 100%)',
    border: '1px solid rgba(49, 130, 246, 0.18)',
  },
  inlineResultCardMobile: {
    padding: '16px 14px',
  },
  inlineResultHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineResultHeaderMobile: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 4,
  },
  inlineResultTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  inlineResultSub: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  inlineResultPercent: {
    marginTop: 14,
    fontSize: 34,
    fontWeight: 900,
    color: 'var(--primary)',
    lineHeight: 1,
  },
  inlineResultPercentMobile: {
    fontSize: 28,
  },
  inlineResultRank: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  inlineResultEmpty: {
    marginTop: 14,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
};

export default OpenPercentilePage;
