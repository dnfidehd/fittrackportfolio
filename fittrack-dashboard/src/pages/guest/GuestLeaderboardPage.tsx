import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useIsMobile } from '../../hooks/useIsMobile';
import { api } from '../../services/api';
import { Competition, CompetitionEvent, CompLeaderboardItem, OverallLeaderboardItem } from '../../types';
import { Trophy, ArrowLeft, Users, Clock, Check, X, Edit, Trash2, Plus, ChevronDown, ChevronUp, Calendar, Info, Settings, Search, MessageSquare } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

const parseCompetitionScore = (scoreStr: string, scoreType: string) => {
    if (!scoreStr) return 0;
    const cleanScore = scoreStr.toUpperCase().replace('LB', '').replace('KG', '').replace('REPS', '').trim();

    if (scoreType === 'time') {
        if (cleanScore.includes('CAP')) {
            try {
                const extraReps = cleanScore.includes('+')
                    ? parseInt(cleanScore.split('+')[1].replace(/[^0-9]/g, '') || '0', 10)
                    : 0;
                return 1000000 - extraReps;
            } catch {
                return 1000000;
            }
        }
        try {
            if (cleanScore.includes(':')) {
                const [m, s] = cleanScore.split(':');
                return parseInt(m, 10) * 60 + parseInt(s, 10);
            }
            return parseInt(cleanScore, 10);
        } catch {
            return 999999;
        }
    }

    try {
        return parseFloat(cleanScore);
    } catch {
        return 0;
    }
};

const compareLeaderboardItems = (a: any, b: any, scoreType: string) => {
    const rxA = a.is_rx ? 1 : 0;
    const rxB = b.is_rx ? 1 : 0;
    if (rxA !== rxB) return rxB - rxA;

    const scaleWeights: Record<string, number> = { A: 3, B: 2, C: 1 };
    const scaleA = a.is_rx ? 0 : (scaleWeights[a.scale_rank || ''] || 0);
    const scaleB = b.is_rx ? 0 : (scaleWeights[b.scale_rank || ''] || 0);
    if (scaleA !== scaleB) return scaleB - scaleA;

    const scoreA = parseCompetitionScore(a.score_value, scoreType);
    const scoreB = parseCompetitionScore(b.score_value, scoreType);
    if (scoreType === 'time') {
        if (scoreA !== scoreB) return scoreA - scoreB;
    } else {
        if (scoreA !== scoreB) return scoreB - scoreA;
    }

    const tieA = a.tie_break ? parseCompetitionScore(a.tie_break, 'time') : 999999;
    const tieB = b.tie_break ? parseCompetitionScore(b.tie_break, 'time') : 999999;
    return tieA - tieB;
};

const rankLeaderboardItems = (items: any[], scoreType: string) => {
    const sorted = [...items].sort((a, b) => compareLeaderboardItems(a, b, scoreType));
    return sorted.reduce<any[]>((acc, item, idx) => {
        if (idx === 0) {
            acc.push({ ...item, rank: 1 });
            return acc;
        }
        const prev = sorted[idx - 1];
        const isTie = compareLeaderboardItems(item, prev, scoreType) === 0 && compareLeaderboardItems(prev, item, scoreType) === 0;
        acc.push({ ...item, rank: isTie ? acc[idx - 1].rank : idx + 1 });
        return acc;
    }, []);
};

const getOpenPercentileHref = (
    competition: Competition,
    events: CompetitionEvent[],
    selectedEvent: CompetitionEvent | null,
    guestGender: 'M' | 'F' | ''
) => {
    const competitionYear = new Date(competition.start_date).getFullYear();
    const supportedYear = [2024, 2025, 2026].includes(competitionYear) ? competitionYear : 2026;
    const selectedIndex = selectedEvent ? events.findIndex((event) => event.id === selectedEvent.id) + 1 : 1;
    const supportedEvent = selectedIndex >= 1 && selectedIndex <= 3 ? selectedIndex : 1;
    const gender = guestGender === 'F' ? 'female' : 'male';
    return `/open-percentile?year=${supportedYear}&event=${supportedEvent}&gender=${gender}`;
};

const GuestLeaderboardPage: React.FC = () => {
    const navigate = useNavigate();
    const isActualMobile = useIsMobile(); // ✅ [신규] 실제 화면 크기 감지
    const isMobile = true; // 대외적으로는 모바일 뷰 UI 유지

    // 게스트 정보 (세션)
    const [guestName, setGuestName] = useState<string>('');
    const [guestPhone, setGuestPhone] = useState<string>(''); // ✅ [신규]
    const [guestGender, setGuestGender] = useState<'M' | 'F' | ''>(''); // ✅ [신규]
    const [guestGym, setGuestGym] = useState<string>(''); // ✅ [신규]
    const [isGuest, setIsGuest] = useState(true);

    const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL'); // ✅ [신규] 필터 상태
    const [scaleFilter, setScaleFilter] = useState<'ALL' | 'RX' | 'A' | 'B' | 'C'>('ALL'); // ✅ [신규] 스케일 필터 상태
    const [gymFilter, setGymFilter] = useState<string>('ALL'); // ✅ [신규] 체육관 필터 상태
    const [searchTerm, setSearchTerm] = useState<string>(''); // ✅ [신규] 이름 검색 상태

    // ✅ [신규] 페이징 상태
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
    const [events, setEvents] = useState<CompetitionEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CompetitionEvent | null>(null);
    const [leaderboard, setLeaderboard] = useState<CompLeaderboardItem[]>([]);
    const [overallLeaderboard, setOverallLeaderboard] = useState<OverallLeaderboardItem[]>([]);
    const [activeTab, setActiveTab] = useState<'events' | 'overall'>('events');
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const [participants, setParticipants] = useState<any[]>([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false); // 게스트는 항상 false지만 UI 구조 유지를 위해

    const [showInputModal, setShowInputModal] = useState(false);

    // ✅ [신규] 동명이인 감지 알림 상태
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
    const [pendingScoreData, setPendingScoreData] = useState<any>(null);

    // 기록 입력 폼 상태
    const [scoreValue, setScoreValue] = useState('');
    const [tieBreakValue, setTieBreakValue] = useState('');
    const [isRx, setIsRx] = useState(true);
    const [scaleRank, setScaleRank] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);
    const [isFinished, setIsFinished] = useState(true);

    // 분:초 분리 입력 상태
    const [scoreMin, setScoreMin] = useState('');
    const [scoreSec, setScoreSec] = useState('');
    const [tbMin, setTbMin] = useState('');
    const [tbSec, setTbSec] = useState('');
    const [scoreReps, setScoreReps] = useState(''); // reps/weight/미완주 렙수용

    // 초기화: 로컬스토리지에서 세션 불러오기
    useEffect(() => {
        const session = localStorage.getItem('guest_session');
        if (!session) {
            navigate('/guest/entry');
            return;
        }
        const parsed = JSON.parse(session);
        setSelectedComp(parsed.competition);
        setEvents(parsed.events);
        if (parsed.events.length > 0) {
            setSelectedEvent(parsed.events[0]);
        }

        const savedName = localStorage.getItem('guest_name');
        const savedInfo = localStorage.getItem('guest_info'); // ✅ [신규]

        if (!savedName || !savedInfo) {
            toast.error('프로필 정보를 먼저 입력해주세요');
            navigate('/guest/profile'); // ✅ [신규] 프로필 없으면 리다이렉트
            return;
        }

        if (savedName) setGuestName(savedName);
        if (savedInfo) {
            const parsedInfo = JSON.parse(savedInfo);
            setGuestPhone(parsedInfo.phone);
            setGuestGender(parsedInfo.gender);
            if (parsedInfo.gymName) setGuestGym(parsedInfo.gymName); // ✅ [신규]
        }
    }, [navigate]);

    // 리더보드 주기적 갱신
    useEffect(() => {
        if (selectedEvent && activeTab === 'events') {
            fetchEventLeaderboard(selectedEvent.id);
        }
    }, [selectedEvent, activeTab]);

    useEffect(() => {
        if (selectedComp && activeTab === 'overall') {
            fetchOverallLeaderboard();
        }
    }, [activeTab, selectedComp]);

    const fetchEventLeaderboard = async (eventId: number, showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            // is_guest_viewer=true 추가
            const res = await api.get(`/api/competitions/events/${eventId}/leaderboard?is_guest_viewer=true`);
            setLeaderboard(res.data);
            setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch (e) {
            console.error(e);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const fetchOverallLeaderboard = async (showLoading = true) => {
        if (!selectedComp) return;
        if (showLoading) setLoading(true);
        try {
            // is_guest_viewer=true 추가
            const res = await api.get(`/api/competitions/${selectedComp.id}/overall?is_guest_viewer=true`);
            setOverallLeaderboard(res.data);
            setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch (e) {
            console.error(e);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    // ✅ [신규] 헬퍼 함수: 자신의 기록인지 확인 (이름 + 전화번호)
    const isMyRecord = (item: CompLeaderboardItem | OverallLeaderboardItem): boolean => {
        return item.member_name === guestName &&
            (item.guest_phone === guestPhone || !guestPhone);
    };

    // ✅ [신규] 이름과 전화번호 뒷자리 포맷팅
    const getDisplayName = (name: string, phone?: string | null): string => {
        if (!phone) return name;
        const lastTwo = phone.slice(-2);
        return `${name} (**${lastTwo})`;
    };

    // ✅ [수정] 내 기록 찾기 (이름 + 전화번호 기반)
    const myRecord = leaderboard.length > 0 ? leaderboard.find(item =>
        item.member_name === guestName &&
        (item.guest_phone === guestPhone || !guestPhone)  // 전화번호가 있으면 반드시 일치해야 함
    ) : null;

    useEffect(() => {
        if (myRecord && selectedEvent) {
            setIsEditMode(true);
            setIsRx(myRecord.is_rx);
            setScaleRank(myRecord.scale_rank || null);
            setNote(myRecord.note || '');

            // 타이브레이크 복원
            if (myRecord.tie_break) {
                const tb = myRecord.tie_break.replace(/[^0-9]/g, '').padEnd(4, '0');
                setTbMin(tb.slice(0, 2));
                setTbSec(tb.slice(2, 4));
            } else {
                setTbMin(''); setTbSec('');
            }

            if (myRecord.score_value.includes('CAP') || myRecord.is_time_cap) {
                setIsFinished(false);
                const reps = myRecord.score_value.replace(/[^0-9]/g, '');
                setScoreReps(reps);
                setScoreMin(''); setScoreSec('');
            } else if (selectedEvent.score_type === 'time') {
                setIsFinished(true);
                const digits = myRecord.score_value.replace(/[^0-9]/g, '').padEnd(4, '0');
                setScoreMin(digits.slice(0, 2));
                setScoreSec(digits.slice(2, 4));
                setScoreReps('');
            } else {
                setScoreReps(myRecord.score_value.replace(/[^0-9]/g, ''));
                setScoreMin(''); setScoreSec('');
            }
        } else {
            resetForm();
        }
    }, [leaderboard, guestName, guestPhone, selectedEvent]);

    const resetForm = () => {
        setIsEditMode(false);
        setScoreMin(''); setScoreSec('');
        setTbMin(''); setTbSec('');
        setScoreReps('');
        setIsRx(true);
        setScaleRank(null);
        setNote('');
        setIsFinished(true);
    };

    // 분:초를 4자리 문자열로 변환
    const buildTimeStr = (min: string, sec: string) => {
        const m = min.padStart(2, '0');
        const s = sec.padStart(2, '0');
        return `${m}${s}`;
    };

    const handleSubmitScore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvent) return;
        if (!guestName.trim()) { toast.error('게스트 성함 오류'); return; }

        let finalScore = '';
        if (selectedEvent.score_type === 'time') {
            if (isFinished) {
                if (!scoreMin && !scoreSec) { toast.error('기록을 입력해주세요'); return; }
                const timeStr = buildTimeStr(scoreMin || '0', scoreSec || '0');
                const inputMin = parseInt(scoreMin || '0');
                const inputSec = parseInt(scoreSec || '0');
                const totalInputSec = inputMin * 60 + inputSec;
                if (selectedEvent.time_cap && totalInputSec > selectedEvent.time_cap) {
                    const lm = Math.floor(selectedEvent.time_cap / 60);
                    const ls = selectedEvent.time_cap % 60;
                    const limitStr = ls > 0 ? `${lm}분 ${ls}초` : `${lm}분`;
                    toast.error(`설정된 타임캡(${limitStr})을 초과했습니다.`);
                    return;
                }
                finalScore = timeStr;
            } else {
                if (!scoreReps) { toast.error('완료 렙수를 입력해주세요'); return; }
                finalScore = `CAP + ${scoreReps} reps`;
            }
        } else {
            if (!scoreReps) { toast.error('기록을 입력해주세요'); return; }
            finalScore = scoreReps;
        }

        if (!window.confirm('기록을 제출하시겠습니까?')) return;

        const tbStr = (tbMin || tbSec) ? buildTimeStr(tbMin || '0', tbSec || '0') : '';
        const scoreData = {
            member_name: guestName,
            score_value: finalScore,
            is_rx: isRx,
            scale_rank: isRx ? null : scaleRank,
            is_time_cap: (selectedEvent.score_type === 'time' && !isFinished),
            tie_break: tbStr,
            note: note,
            guest_gender: guestGender,
            guest_phone: guestPhone,
            guest_gym: guestGym
        };

        setLoading(true);
        try {
            const res = await api.post(`/api/competitions/guest/scores?event_id=${selectedEvent.id}`, scoreData);

            // ✅ [신규] 동명이인 감지 응답 처리
            if (res.data.status === 'duplicate_found') {
                setDuplicateInfo(res.data);
                setPendingScoreData(scoreData);
                setShowDuplicateDialog(true);
                setLoading(false);
                return;
            }

            toast.success("기록 제출 완료!");
            setShowInputModal(false);
            fetchEventLeaderboard(selectedEvent.id);
        } catch (err: any) {
            const errorMsg = err.response?.data?.detail || err.message || "기록 제출 중 오류가 발생했습니다.";
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // ✅ [신규] 동명이인 확인 - 예 (기존 기록 수정)
    const handleDuplicateYes = async () => {
        if (!pendingScoreData || !duplicateInfo) return;

        setLoading(true);
        try {
            // 전화번호 저장 후 재제출
            const updatedData = {
                ...pendingScoreData,
                guest_phone: pendingScoreData.guest_phone || ""
            };

            const res = await api.post(
                `/api/competitions/guest/scores?event_id=${selectedEvent!.id}`,
                updatedData
            );

            toast.success("기록 제출 완료!");
            setShowDuplicateDialog(false);
            setDuplicateInfo(null);
            setPendingScoreData(null);
            setShowInputModal(false);
            fetchEventLeaderboard(selectedEvent!.id);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "기록 제출 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ [신규] 동명이인 확인 - 아니오 (새로운 이름으로 신규 입력)
    const handleDuplicateNo = async () => {
        if (!pendingScoreData) return;

        // 이름 뒤에 'B' 추가
        const newName = pendingScoreData.member_name + 'B';

        setLoading(true);
        try {
            const updatedData = {
                ...pendingScoreData,
                member_name: newName
            };

            const res = await api.post(
                `/api/competitions/guest/scores?event_id=${selectedEvent!.id}`,
                updatedData
            );

            toast.success("새로운 기록으로 등록되었습니다.");
            setShowDuplicateDialog(false);
            setDuplicateInfo(null);
            setPendingScoreData(null);
            setShowInputModal(false);
            fetchEventLeaderboard(selectedEvent!.id);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "기록 제출 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if (!window.confirm("모든 정보(이름, 세션 등)를 삭제하고 로그아웃하시겠습니까?\n공용 PC라면 반드시 로그아웃해주세요.")) return;
        localStorage.removeItem('guest_session');
        localStorage.removeItem('guest_name');
        localStorage.removeItem('guest_info');
        toast.success("정보가 초기화되었습니다.");
        navigate('/guest/entry');
    };

    const getUnitLabel = (type: string) => (type === 'weight' ? 'lb' : type === 'reps' ? 'reps' : '');

    const getRankBadge = (rank: number) => {
        if (rank === 1) return <div style={{ ...styles.rankBadge, backgroundColor: '#FFF7E6', color: '#B45309' }}>🥇</div>;
        if (rank === 2) return <div style={{ ...styles.rankBadge, backgroundColor: '#F3F4F6', color: '#4B5563' }}>🥈</div>;
        if (rank === 3) return <div style={{ ...styles.rankBadge, backgroundColor: '#FFEDD5', color: '#C2410C' }}>🥉</div>;
        return <div style={{ ...styles.rankBadge, backgroundColor: '#F9FAFB', color: '#6B7280' }}>{rank}</div>;
    };

    // ✅ [신규] 성별 필터 후 독립 순위 재계산 (이벤트 리더보드)
    const reRankEventLeaderboard = (items: CompLeaderboardItem[]) => {
        const result: CompLeaderboardItem[] = [];
        items.forEach((item, idx) => {
            if (idx === 0) { result.push({ ...item, rank: 1 }); return; }
            const prev = items[idx - 1];
            const prevRanked = result[idx - 1];
            const isTie =
                item.score_value === prev.score_value &&
                (item.tie_break || '') === (prev.tie_break || '');
            result.push({ ...item, rank: isTie ? prevRanked.rank : idx + 1 });
        });
        return result;
    };

    // ✅ [수정] 필터 후 종목별 포인트 재계산 + 종합 순위 재계산
    // 성별/체육관 필터 시) 각 종목의 순위를 필터된 그룹 내에서 1, 2, 3...으로 재배정
    const reRankOverallLeaderboard = (items: OverallLeaderboardItem[]) => {
        if (items.length === 0) return items;

        // 1) 모든 이벤트명 수집
        const allEventNames = new Set<string>();
        items.forEach(item => {
            Object.keys(item.event_details || {}).forEach(name => allEventNames.add(name));
        });

        // 2) 고유 키 생성 (member_id가 null인 게스트 대비)
        const getKey = (item: OverallLeaderboardItem, idx: number) =>
            item.member_id ? `m_${item.member_id}` : `g_${idx}_${item.member_name}`;

        // 3) 각 이벤트별로 그룹 내 순위 재계산
        const newEventDetails: Record<string, Record<string, number>> = {};
        items.forEach((item, idx) => { newEventDetails[getKey(item, idx)] = {}; });

        allEventNames.forEach(eventName => {
            const participants = items
                .map((item, idx) => ({ item, idx, origRank: item.event_details?.[eventName] }))
                .filter(p => p.origRank != null)
                .sort((a, b) => (a.origRank || 999) - (b.origRank || 999));

            let newRank = 1;
            participants.forEach((p, i) => {
                if (i > 0 && p.origRank !== participants[i - 1].origRank) {
                    newRank = i + 1;
                }
                newEventDetails[getKey(p.item, p.idx)][eventName] = newRank;
            });

            // 기록 없는 참가자는 (현재 필터링된 전체 참가자 수 + 1) 부여
            const noRecordRank = items.length + 1; // ✅ [수정] участников.length + 1 에서 items.length + 1 로 변경
            items.forEach((item, idx) => {
                if (item.event_details?.[eventName] == null) {
                    newEventDetails[getKey(item, idx)][eventName] = noRecordRank;
                }
            });
        });

        // 4) 새 total_points 계산 + 정렬
        const recalculated = items.map((item, idx) => {
            const key = getKey(item, idx);
            return {
                ...item,
                event_details: newEventDetails[key],
                total_points: Object.values(newEventDetails[key]).reduce((sum, r) => sum + r, 0),
            };
        }).sort((a, b) => a.total_points - b.total_points);

        // 5) 최종 순위 배정 (동점 동순위)
        const result: OverallLeaderboardItem[] = [];
        recalculated.forEach((item, idx) => {
            if (idx === 0) { result.push({ ...item, rank: 1 }); return; }
            const isTie = item.total_points === recalculated[idx - 1].total_points;
            result.push({ ...item, rank: isTie ? result[idx - 1].rank : idx + 1 });
        });
        return result;
    };

    const formatLeaderboardScore = (score: string, type: string) => {
        if (!score) return '-';
        if (type === 'time') {
            if (score.includes('CAP') || score.includes('reps')) return score;
            const digits = score.replace(/[^0-9]/g, '');
            if (digits.length === 4) {
                return `${digits.slice(0, 2)}:${digits.slice(2)}`;
            } else if (digits.length === 3) {
                return `0${digits.slice(0, 1)}:${digits.slice(1)}`;
            } else if (digits.length === 2) {
                return `00:${digits}`;
            } else if (digits.length === 1) {
                return `00:0${digits}`;
            }
        }
        return score;
    };

    const previewSubmission = useMemo(() => {
        if (!selectedEvent) return null;

        let finalScore = '';
        if (selectedEvent.score_type === 'time') {
            if (isFinished) {
                if (!scoreMin && !scoreSec) return null;
                const inputMin = parseInt(scoreMin || '0', 10);
                const inputSec = parseInt(scoreSec || '0', 10);
                const totalInputSec = inputMin * 60 + inputSec;
                if (selectedEvent.time_cap && totalInputSec > selectedEvent.time_cap) return null;
                finalScore = buildTimeStr(scoreMin || '0', scoreSec || '0');
            } else {
                if (!scoreReps) return null;
                finalScore = `CAP + ${scoreReps} reps`;
            }
        } else {
            if (!scoreReps) return null;
            finalScore = scoreReps;
        }

        return {
            score_value: finalScore,
            tie_break: (tbMin || tbSec) ? buildTimeStr(tbMin || '0', tbSec || '0') : '',
            is_time_cap: selectedEvent.score_type === 'time' && !isFinished,
            is_rx: isRx,
            scale_rank: isRx ? null : scaleRank,
        };
    }, [selectedEvent, isFinished, scoreMin, scoreSec, scoreReps, tbMin, tbSec, isRx, scaleRank]);

    const predictedRank = useMemo(() => {
        if (!selectedEvent || !previewSubmission) return null;

        const candidate = {
            member_name: guestName,
            guest_phone: guestPhone,
            gym_name: guestGym,
            gender: guestGender,
            note,
            ...previewSubmission,
            __predicted: true,
        };

        const withoutMyCurrentRecord = leaderboard.filter(item => !isMyRecord(item));
        const ranked = rankLeaderboardItems([...withoutMyCurrentRecord, candidate], selectedEvent.score_type);
        const predictedItem = ranked.find(item => item.__predicted);
        if (!predictedItem) return null;

        const totalCount = ranked.length;
        let percentile = Math.ceil((predictedItem.rank / totalCount) * 100);
        if (predictedItem.rank === 1) percentile = 1;

        return {
            rank: predictedItem.rank,
            totalCount,
            percentile,
        };
    }, [selectedEvent, previewSubmission, leaderboard, guestName, guestPhone, guestGym, guestGender, note]);

    const renderMyRankCard = (myRankData: any, totalCount: number, type: 'event' | 'overall', currentGenderFilter: string, userGender?: string, currentGymFilter?: string, userGym?: string) => {
        if (currentGenderFilter !== 'ALL' && userGender && currentGenderFilter !== userGender) {
            return (
                <div style={{ ...styles.myRankCard, width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ ...styles.myRankContent, padding: isMobile ? '16px' : '32px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                        <span style={{ color: '#FFFFFF', fontSize: isMobile ? '13px' : '16px', fontWeight: '600', textAlign: 'center' }}>
                            {currentGenderFilter === 'M' ? '남자 선수들의 순위만 표시됩니다.' : '여자 선수들의 순위만 표시됩니다.'}
                        </span>
                    </div>
                </div>
            );
        }

        if (currentGymFilter && currentGymFilter !== 'ALL' && userGym && currentGymFilter !== userGym) {
            return (
                <div style={styles.myRankCard}>
                    <div style={{ ...styles.myRankContent, padding: isMobile ? '24px' : '32px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ color: '#FFFFFF', fontSize: isMobile ? '14px' : '16px', fontWeight: '600' }}>
                            선택한 체육관 소속 선수들의 순위만 표시됩니다.
                        </span>
                    </div>
                </div>
            );
        }

        if (!myRankData) return null;
        const rank = myRankData.rank;
        let percentile = Math.ceil((rank / totalCount) * 100);
        if (rank === 1) percentile = 1;
        let scoreDisplay = "";
        if (type === 'event' && selectedEvent) {
            const unit = getUnitLabel(selectedEvent.score_type);
            if (selectedEvent.score_type !== 'time' && !myRankData.score_value.includes("CAP")) {
                scoreDisplay = `${myRankData.score_value} ${unit}`;
            } else {
                scoreDisplay = formatLeaderboardScore(myRankData.score_value, selectedEvent.score_type);
            }
        } else scoreDisplay = `${myRankData.total_points}점`;
        return (
            <div style={{ ...styles.myRankCard, width: '100%', boxSizing: 'border-box' }}>
                <div style={{ ...styles.myRankContent, padding: isMobile ? '16px' : '32px', width: '100%', boxSizing: 'border-box' }}>
                    <div style={styles.myRankInfo}>
                        <span style={styles.myRankLabel}>{type === 'overall' ? '현재 종합 순위' : '현재 종목 순위'}</span>
                        <span style={{ ...styles.myRankValue, fontSize: isMobile ? '24px' : '32px' }}>{rank === 1 && '👑 '}{rank}위 <span style={styles.myRankTotal}>/ {totalCount}명</span></span>
                    </div>
                    <div style={styles.myRankRight}>
                        <span style={{ ...styles.myRankScore, fontSize: isMobile ? '20px' : '24px' }}>{scoreDisplay}</span>
                        <span style={styles.percentBadge}>상위 {percentile}%</span>
                    </div>
                </div>
            </div>
        );
    };

    if (!selectedComp) return null;

    // ✅ [수정] 유니크 체육관 목록 추출: 기록 유무와 상관없이 대회에 참가 중인(accepted) 모든 박스 노출
    const uniqueGyms = selectedComp.participating_gyms
        ? Array.from(new Set(
            selectedComp.participating_gyms
                .filter(g => g.status === 'accepted')
                .map(g => g.gym_name)
                .filter(Boolean)
        )).sort() as string[]
        : [];

    // ✅ [신규] 스케일 필터 매칭 함수
    const matchesScaleFilter = (item: any) => {
        if (scaleFilter === 'ALL') return true;
        if (scaleFilter === 'RX') return item.is_rx === true;
        return item.is_rx === false && item.scale_rank === scaleFilter;
    };

    // ✅ [신규] 필터링 로직 수정 (성별 + 스케일 + 체육관 + 이름 검색 반영)
    const filteredEventBoard = leaderboard.filter(item =>
        (genderFilter === 'ALL' || item.gender === genderFilter) &&
        matchesScaleFilter(item) &&
        (gymFilter === 'ALL' || item.gym_name === gymFilter) &&
        (searchTerm === '' || item.member_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const rankedEventBoard = (genderFilter === 'ALL' && scaleFilter === 'ALL' && gymFilter === 'ALL' && searchTerm === '') ? filteredEventBoard : reRankEventLeaderboard([...filteredEventBoard]);
    const myRankedEventRecord = rankedEventBoard.find(item => isMyRecord(item)) ?? null;

    const filteredOverallBoard = overallLeaderboard.filter(item =>
        (genderFilter === 'ALL' || item.gender === genderFilter) &&
        (gymFilter === 'ALL' || item.gym_name === gymFilter) &&
        (searchTerm === '' || item.member_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const rankedOverallBoard = (genderFilter === 'ALL' && scaleFilter === 'ALL' && gymFilter === 'ALL' && searchTerm === '') ? filteredOverallBoard : reRankOverallLeaderboard([...filteredOverallBoard]);
    const myRankedOverallRecord = rankedOverallBoard.find(item => isMyRecord(item)) ?? null;

    // ✅ [신규] 필터 바 렌더링 함수
    const renderFilterBar = () => (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginBottom: '20px', alignItems: 'center', marginTop: '16px', width: '100%' }}>
            <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#F2F4F6', borderRadius: '12px', width: 'fit-content' }}>
                {['ALL', 'M', 'F'].map((g) => (
                    <button
                        key={g}
                        onClick={() => { setGenderFilter(g as any); setCurrentPage(1); }}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            backgroundColor: genderFilter === g ? '#FFFFFF' : 'transparent',
                            color: genderFilter === g ? '#191F28' : '#8B95A1',
                            boxShadow: genderFilter === g ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        {g === 'ALL' ? '전체 성별' : g === 'M' ? '남자' : '여자'}
                    </button>
                ))}
            </div>
            {/* ✅ [신규] 스케일 필터 버튼 그룹 */}
            <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#F2F4F6', borderRadius: '12px', width: 'fit-content' }}>
                {['ALL', 'RX', 'A', 'B', 'C'].map((s) => (
                    <button
                        key={s}
                        onClick={() => { setScaleFilter(s as any); setCurrentPage(1); }}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            backgroundColor: scaleFilter === s ? '#FFFFFF' : 'transparent',
                            color: scaleFilter === s ? '#191F28' : '#8B95A1',
                            boxShadow: scaleFilter === s ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        {s === 'ALL' ? '전체' : s === 'RX' ? 'Rx' : `S${s}`}
                    </button>
                ))}
            </div>
            {uniqueGyms.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F2F4F6', borderRadius: '12px', padding: '4px 8px', height: 'fit-content' }}>
                    <select
                        value={gymFilter}
                        onChange={(e) => { setGymFilter(e.target.value); setCurrentPage(1); }}
                        style={{ border: 'none', background: 'transparent', fontSize: '13px', fontWeight: '600', color: '#333D4B', outline: 'none', padding: '4px', cursor: 'pointer' }}
                    >
                        <option value="ALL">전체 체육관</option>
                        {uniqueGyms.map(gym => (
                            <option key={gym} value={gym}>{gym}</option>
                        ))}
                    </select>
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F2F4F6', borderRadius: '12px', padding: '4px 12px', height: 'fit-content', flex: '1 1 auto', minWidth: '120px' }}>
                <Search size={14} color="#8B95A1" style={{ marginRight: '6px' }} />
                <input
                    placeholder="이름 검색"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    style={{ border: 'none', background: 'transparent', fontSize: '13px', color: '#191F28', outline: 'none', width: '100%', padding: '6px 0' }}
                />
            </div>
        </div>
    );

    return (
        <div style={{ ...styles.container, padding: isMobile ? '0 8px 100px' : '0 24px 100px' }}>
            {loading && <div style={styles.overlay}><div style={styles.spinner}></div></div>}

            {/* 대회 상세 (단일 뷰) */}
            <div style={{ ...styles.detailContainer, width: '100%', boxSizing: 'border-box' }}>
                <div style={{ ...styles.detailGrid, gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '360px minmax(0, 1fr)', gap: isMobile ? '24px' : '40px' }}>

                    {/* 좌측 사이드바: 대회 정보 */}
                    <div style={{ ...styles.leftSide, position: isMobile ? 'static' : 'sticky' as const, minWidth: 0 }}>
                        <div style={{ ...styles.compInfoCard, padding: isMobile ? '20px 16px' : '32px' }}>
                            <button style={styles.backBtn} onClick={() => navigate('/guest/entry')}>
                                <ArrowLeft size={16} /> 나가기
                            </button>
                            <h1 style={{ ...styles.detailTitle, fontSize: isMobile ? '22px' : '26px' }}>{selectedComp.title}</h1>
                            <p style={styles.detailDesc}>{selectedComp.description}</p>

                            {selectedComp.admin_names && selectedComp.admin_names.length > 0 && (
                                <div style={{ marginTop: '16px', fontSize: '13px', color: '#6B7684', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ backgroundColor: '#F2F4F6', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #E5E8EB' }}>대회 관리자(코치)</span>
                                    <span style={{ fontWeight: '500' }}>{selectedComp.admin_names.join(', ')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 우측 메인 컨텐츠 */}
                    <div style={{ ...styles.rightSide, minWidth: 0, width: '100%' }}>
                        {/* 탭 */}
                        <div style={{ ...styles.tabContainer, width: '100%' }}>
                            <button onClick={() => { setActiveTab('events'); setCurrentPage(1); }} style={{ ...(activeTab === 'events' ? styles.tabActive : styles.tab), padding: isMobile ? '12px' : '16px', fontSize: isMobile ? '14px' : '16px', minWidth: 0, wordBreak: 'keep-all' }}>🏋️‍♂️ 종목별 기록</button>
                            <button onClick={() => { setActiveTab('overall'); setCurrentPage(1); }} style={{ ...(activeTab === 'overall' ? styles.tabActive : styles.tab), padding: isMobile ? '12px' : '16px', fontSize: isMobile ? '14px' : '16px', minWidth: 0, wordBreak: 'keep-all' }}>🏆 종합 순위</button>
                        </div>
                    </div>

                    {activeTab === 'events' ? (
                        <div style={{ ...styles.eventsSection, minWidth: 0, width: '100%' }}>
                            {/* 종목 리스트 (이벤트 카드) */}
                            <div style={{ ...styles.eventList, gap: isMobile ? '10px' : '16px', width: '100%' }}>
                                {events.map((event, index) => (
                                    <div key={event.id} onClick={() => { setSelectedEvent(event); setCurrentPage(1); }} style={{ ...(selectedEvent?.id === event.id ? styles.eventCardActive : styles.eventCard), minWidth: isMobile ? '110px' : '160px', padding: isMobile ? '14px' : '20px' }}>
                                        <span style={styles.eventNum}>Event {index + 1}</span>
                                        <span style={{ ...styles.eventName, fontSize: isMobile ? '14px' : '16px' }}>{event.title}</span>
                                    </div>
                                ))}
                            </div>

                            {/* ✅ 필터 바 (이벤트 카드 바로 아래) */}
                            {renderFilterBar()}

                            {/* 종목 상세 */}
                            {selectedEvent ? (
                                <div style={{ ...styles.eventDetail, padding: isMobile ? '20px 16px' : '40px', boxSizing: 'border-box', width: '100%' }}>
                                    <div style={styles.eventDetailHeader}>
                                        <h3 style={{ ...styles.eventDetailTitle, fontSize: isMobile ? '18px' : '24px', wordBreak: 'keep-all' }}>Event {events.findIndex(e => e.id === selectedEvent.id) + 1}: {selectedEvent.title}</h3>
                                    </div>
                                    <div style={{ ...styles.eventDesc, padding: isMobile ? '16px' : '24px', fontSize: isMobile ? '14px' : '16px' }}>{selectedEvent.description}</div>

                                    <button
                                        style={{ ...styles.predictBtn, padding: isMobile ? '13px 14px' : '14px 18px', fontSize: isMobile ? '14px' : '15px' }}
                                        onClick={() => navigate(getOpenPercentileHref(selectedComp, events, selectedEvent, guestGender))}
                                    >
                                        순위 예측해보기
                                    </button>

                                    <button style={{ ...styles.recordBtn, padding: isMobile ? '14px' : '18px', fontSize: isMobile ? '16px' : '18px' }} onClick={() => setShowInputModal(true)}>
                                        {isEditMode ? "내 기록 수정하기" : "기록 입력하기"}
                                    </button>

                                    {/* 내 기록 카드 */}
                                    {renderMyRankCard(myRankedEventRecord, rankedEventBoard.length, 'event', genderFilter, guestGender, gymFilter, guestGym)}

                                    {/* 리더보드 */}
                                    <div style={{ overflowX: 'auto', width: '100%' }}>
                                        {/* 테이블 헤더 */}
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '35px minmax(100px, 1fr) 75px 75px' : '50px minmax(160px, 2fr) 110px 110px', gap: '6px', padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '8px', fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, minWidth: isMobile ? '300px' : '100%' }}>
                                            <span style={{ textAlign: 'center' as const }}>등수</span>
                                            <span>이름 / 소속</span>
                                            <span style={{ textAlign: 'right' as const }}>기록</span>
                                            <span style={{ textAlign: 'right' as const }}>타이브레이크</span>
                                        </div>
                                        {/* 테이블 바디 */}
                                        {(() => {
                                            if (rankedEventBoard.length === 0) return <div style={styles.emptyListText}>조건에 맞는 기록이 없어요</div>;
                                            const totalPages = Math.ceil(rankedEventBoard.length / itemsPerPage);
                                            const currentData = rankedEventBoard.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                                            return (
                                                <>
                                                    {currentData.map((item, idx) => (
                                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: isMobile ? '35px minmax(100px, 1fr) 75px 75px' : '50px minmax(160px, 2fr) 110px 110px', gap: '6px', padding: isMobile ? '12px' : '14px 16px', borderRadius: '14px', marginBottom: '6px', backgroundColor: isMyRecord(item) ? 'var(--primary-bg)' : 'var(--bg-secondary)', alignItems: 'center', border: isMyRecord(item) ? '1.5px solid var(--primary)' : '1.5px solid transparent', minWidth: isMobile ? '300px' : '100%' }}>
                                                            <div style={{ textAlign: 'center' as const }}>{getRankBadge(item.rank)}</div>
                                                            <div style={{ overflow: 'hidden' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' as const }}>
                                                                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'keep-all', lineHeight: '1.4' }}>{getDisplayName(item.member_name, item.guest_phone)}</span>
                                                                    {/* {item.note && (
                                                                        <span
                                                                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.7 }}
                                                                            title={item.note}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toast(item.note as string, { icon: '📝', duration: 3000 });
                                                                            }}
                                                                        >
                                                                            <MessageSquare size={14} color="var(--primary)" />
                                                                        </span>
                                                                    )} */}
                                                                    {isMyRecord(item) && <span style={styles.meTag}>ME</span>}
                                                                    {(item.status === 'approved' || item.status === 'pending') && <span style={{ fontSize: '13px', marginLeft: '2px' }} title="기록 완료">✅</span>}
                                                                    {item.status === 'rejected' && <span style={{ fontSize: '13px', marginLeft: '2px' }} title="반려됨">❌</span>}
                                                                    {item.is_rx === false && <span style={styles.rxTag}>{item.scale_rank ? `S${item.scale_rank}` : 'Sc'}</span>}
                                                                </div>
                                                                {item.gym_name && (
                                                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', wordBreak: 'keep-all', lineHeight: '1.3' }}>{item.gym_name}</div>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'right' as const }}>
                                                                {formatLeaderboardScore(item.score_value, selectedEvent.score_type)}
                                                                {item.is_time_cap && <span style={{ fontSize: '11px', color: 'var(--danger)', marginLeft: '4px' }}>TC</span>}
                                                            </div>
                                                            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'right' as const }}>
                                                                {item.tie_break ? formatLeaderboardScore(item.tie_break, 'time') : '-'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {totalPages > 1 && (
                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                                                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: currentPage === 1 ? '#f9fafb' : 'white', color: currentPage === 1 ? '#9ca3af' : 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}>이전</button>
                                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                                <button key={page} onClick={() => setCurrentPage(page)} style={{ width: '30px', height: '30px', border: page === currentPage ? 'none' : '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: page === currentPage ? 'var(--primary)' : 'white', color: page === currentPage ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{page}</button>
                                                            ))}
                                                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white', color: currentPage === totalPages ? '#9ca3af' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}>다음</button>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <div style={styles.emptySelection}>
                                    <Info size={40} color="#B0B8C1" style={{ marginBottom: '16px' }} />
                                    <p style={{ color: '#8B95A1', fontSize: '15px' }}>위 리스트에서 종목을 선택해주세요</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 종합 순위 */
                        <div style={{ ...styles.overallSection, minWidth: 0, width: '100%' }}>
                            <div style={{ ...styles.liveIndicator, fontSize: isMobile ? '12px' : '14px', padding: isMobile ? '8px 12px' : '12px 16px' }}>
                                <span style={styles.liveDot}></span>
                                {isMobile ? `실시간 (${lastUpdated})` : `실시간 자동 갱신 중 (${lastUpdated})`}
                            </div>

                            {/* ✅ 필터 바 (종합 순위에서도 인디케이터 바로 아래 노출) */}
                            {renderFilterBar()}

                            {/* 종합 순위 내 기록 */}
                            {overallLeaderboard.length > 0 && renderMyRankCard(myRankedOverallRecord, rankedOverallBoard.length, 'overall', genderFilter, guestGender, gymFilter, guestGym)}

                            {/* 종합 순위 테이블 (가로 스와이프 가능) */}
                            <div style={{ overflowX: 'auto', paddingBottom: '10px', width: '100%' }}>
                                {(() => {
                                    const eventCols = events.map(() => isMobile ? '55px' : '80px').join(' ');
                                    const gridCols = isMobile ? `35px minmax(100px, 1fr) 65px ${eventCols}` : `50px minmax(160px, 2fr) 90px ${eventCols}`;
                                    const baseWidth = isMobile ? (35 + 100 + 65 + (events.length * 55) + 32) : 100;
                                    const minWidthStyle = isMobile ? `${baseWidth}px` : '100%';
                                    return (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '6px', padding: isMobile ? '10px' : '10px 16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '8px', fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, alignItems: 'center', minWidth: minWidthStyle }}>
                                                <span style={{ textAlign: 'center' as const }}>등수</span>
                                                <span>이름 / 소속</span>
                                                <span style={{ textAlign: 'center' as const }}>총포인트</span>
                                                {events.map(ev => (
                                                    <span key={ev.id} style={{ textAlign: 'center' as const, wordBreak: 'keep-all', lineHeight: '1.2' }} title={ev.title}>
                                                        {ev.title}
                                                    </span>
                                                ))}
                                            </div>
                                            {(() => {
                                                if (rankedOverallBoard.length === 0) return <div style={styles.emptyListText}>조건에 맞는 기록이 없어요</div>;
                                                const totalPages = Math.ceil(rankedOverallBoard.length / itemsPerPage);
                                                const currentData = rankedOverallBoard.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                                                return (
                                                    <>
                                                        {currentData.map((item) => (
                                                            <div key={item.member_id} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '6px', padding: isMobile ? '12px 10px' : '14px 16px', borderRadius: '14px', marginBottom: '6px', backgroundColor: isMyRecord(item) ? 'var(--primary-bg)' : 'var(--bg-secondary)', alignItems: 'center', border: isMyRecord(item) ? '1.5px solid var(--primary)' : '1.5px solid transparent', minWidth: minWidthStyle }}>
                                                                <div style={{ textAlign: 'center' as const }}>{getRankBadge(item.rank)}</div>
                                                                <div style={{ overflow: 'hidden', minWidth: '80px', paddingRight: '8px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' as const }}>
                                                                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'keep-all', lineHeight: '1.4' }}>{getDisplayName(item.member_name, item.guest_phone)}</span>
                                                                        {item.event_details && Object.values(item.event_details).some(v => false) /* Overall note is from individual scores, we might need a different approach for overall if needed, but let's check one event note for now if available in data structure */}
                                                                        {/* For overall, let's show if there's any note in any of their scores if we can get it, but let's stick to event leaderboard first for better UX */}
                                                                        {isMyRecord(item) && <span style={styles.meTag}>ME</span>}
                                                                    </div>
                                                                    {item.gym_name && (
                                                                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', wordBreak: 'keep-all', lineHeight: '1.3' }}>{item.gym_name}</div>
                                                                    )}
                                                                </div>
                                                                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary)', textAlign: 'center' as const }}>
                                                                    {item.total_points}점
                                                                </div>
                                                                {events.map(ev => (
                                                                    <div key={ev.id} style={{ textAlign: 'center' as const, fontSize: '14px', fontWeight: '600', color: (item.event_details[ev.title] && item.event_details[ev.title] <= rankedOverallBoard.length) ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                                                        {(item.event_details[ev.title] && item.event_details[ev.title] <= rankedOverallBoard.length) ? `#${item.event_details[ev.title]}` : '-'}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                        {totalPages > 1 && (
                                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                                                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: currentPage === 1 ? '#f9fafb' : 'white', color: currentPage === 1 ? '#9ca3af' : 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}>이전</button>
                                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                                    <button key={page} onClick={() => setCurrentPage(page)} style={{ width: '30px', height: '30px', border: page === currentPage ? 'none' : '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: page === currentPage ? 'var(--primary)' : 'white', color: page === currentPage ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{page}</button>
                                                                ))}
                                                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white', color: currentPage === totalPages ? '#9ca3af' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}>다음</button>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </>
                                    );
                                })()}
                            </div>
                            <p style={styles.ruleText}>* 크로스핏 룰: 각 종목 순위가 점수 (총점 낮을수록 우승)</p>
                        </div>
                    )}
                </div>
            </div>
            {/* 기록 입력 모달 */}
            {showInputModal && selectedEvent && (
                <div style={styles.modalOverlay}>
                    <div style={{
                        ...styles.modalContent,
                        padding: isActualMobile ? '20px 16px' : '40px',
                        maxWidth: isActualMobile ? '100%' : '520px',
                        maxHeight: isActualMobile ? '100%' : '85vh',
                        borderRadius: isActualMobile ? '0' : '32px',
                        minWidth: 0,
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ ...styles.modalHeader, marginBottom: isMobile ? '20px' : '32px' }}>
                            <h2 style={{ ...styles.modalTitle, fontSize: isMobile ? '20px' : '24px' }}>{isEditMode ? '기록 수정' : '기록 입력'}</h2>
                            <button onClick={() => setShowInputModal(false)} style={styles.modalClose}><X size={24} /></button>
                        </div>

                        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            작성자: <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{guestName}</span>
                        </div>

                        <form onSubmit={handleSubmitScore} style={styles.form}>
                            {selectedEvent.score_type === 'time' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', backgroundColor: isFinished ? 'var(--primary-bg)' : '#FEF2F2', borderRadius: '16px', cursor: 'pointer', border: `2px solid ${isFinished ? 'var(--primary)' : '#EF4444'}`, marginBottom: '20px', userSelect: 'none' as const }}>
                                    <input
                                        type="checkbox"
                                        checked={isFinished}
                                        onChange={e => { setIsFinished(e.target.checked); setScoreMin(''); setScoreSec(''); setScoreReps(''); }}
                                        style={{ width: '20px', height: '20px', accentColor: isFinished ? 'var(--primary)' : '#EF4444', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '15px', fontWeight: '700', color: isFinished ? 'var(--primary)' : '#EF4444' }}>
                                        {isFinished ? '✅ 완주 (Finished)' : '🚫 미완주 - 타임캡 (Time Cap)'}
                                    </span>
                                </label>
                            )}

                            {/* 메인 기록 입력 */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    {selectedEvent.score_type === 'time'
                                        ? (isFinished ? '완주 기록' : '완료 렙수 (Reps)')
                                        : `메인 기록 (${getUnitLabel(selectedEvent.score_type)})`}
                                </label>

                                {selectedEvent.score_type === 'time' && isFinished ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="99"
                                                placeholder="분"
                                                value={scoreMin}
                                                onChange={e => setScoreMin(e.target.value)}
                                                style={{ ...styles.timeInput, textAlign: 'center' as const }}
                                            />
                                            <span style={{ textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>분</span>
                                        </div>
                                        <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', paddingBottom: '18px' }}>:</span>
                                        <div style={{ display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                placeholder="초"
                                                value={scoreSec}
                                                onChange={e => setScoreSec(e.target.value)}
                                                style={{ ...styles.timeInput, textAlign: 'center' as const }}
                                            />
                                            <span style={{ textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>초</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder={selectedEvent.score_type === 'time' ? '렙 수 입력' : '기록 입력'}
                                            value={scoreReps}
                                            onChange={e => setScoreReps(e.target.value)}
                                            style={{ ...styles.timeInput, flex: 1 }}
                                        />
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', minWidth: '36px' }}>
                                            {selectedEvent.score_type === 'time' ? 'reps' : getUnitLabel(selectedEvent.score_type)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Tie Break 입력 */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>Tie Break (선택)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
                                        <input
                                            type="number"
                                            min="0"
                                            max="99"
                                            placeholder="분"
                                            value={tbMin}
                                            onChange={e => setTbMin(e.target.value)}
                                            style={{ ...styles.timeInput, textAlign: 'center' as const }}
                                        />
                                        <span style={{ textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>분</span>
                                    </div>
                                    <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', paddingBottom: '18px' }}>:</span>
                                    <div style={{ display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            placeholder="초"
                                            value={tbSec}
                                            onChange={e => setTbSec(e.target.value)}
                                            style={{ ...styles.timeInput, textAlign: 'center' as const }}
                                        />
                                        <span style={{ textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>초</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ ...styles.rxRow, gap: isMobile ? '8px' : '12px', padding: isMobile ? '12px' : '16px', flexWrap: 'wrap' as const }}>
                                <button
                                    type="button"
                                    onClick={() => { setIsRx(true); setScaleRank(null); }}
                                    style={{ ...styles.scaleBtn, backgroundColor: isRx ? 'var(--primary-bg)' : 'var(--bg-secondary)', color: isRx ? 'var(--primary)' : 'var(--text-tertiary)', borderColor: isRx ? 'var(--primary)' : 'var(--border-color)' }}
                                >Rx</button>
                                <button
                                    type="button"
                                    onClick={() => { setIsRx(false); setScaleRank('A'); }}
                                    style={{ ...styles.scaleBtn, backgroundColor: !isRx && scaleRank === 'A' ? 'var(--primary-bg)' : 'var(--bg-secondary)', color: !isRx && scaleRank === 'A' ? 'var(--primary)' : 'var(--text-tertiary)', borderColor: !isRx && scaleRank === 'A' ? 'var(--primary)' : 'var(--border-color)' }}
                                >Scale A</button>
                                <button
                                    type="button"
                                    onClick={() => { setIsRx(false); setScaleRank('B'); }}
                                    style={{ ...styles.scaleBtn, backgroundColor: !isRx && scaleRank === 'B' ? 'var(--primary-bg)' : 'var(--bg-secondary)', color: !isRx && scaleRank === 'B' ? 'var(--primary)' : 'var(--text-tertiary)', borderColor: !isRx && scaleRank === 'B' ? 'var(--primary)' : 'var(--border-color)' }}
                                >Scale B</button>
                                <button
                                    type="button"
                                    onClick={() => { setIsRx(false); setScaleRank('C'); }}
                                    style={{ ...styles.scaleBtn, backgroundColor: !isRx && scaleRank === 'C' ? 'var(--primary-bg)' : 'var(--bg-secondary)', color: !isRx && scaleRank === 'C' ? 'var(--primary)' : 'var(--text-tertiary)', borderColor: !isRx && scaleRank === 'C' ? 'var(--primary)' : 'var(--border-color)' }}
                                >Scale C</button>
                            </div>

                            {predictedRank && (
                                <div style={{
                                    marginBottom: '20px',
                                    padding: '16px',
                                    borderRadius: '16px',
                                    backgroundColor: 'var(--primary-bg)',
                                    border: '1px solid rgba(49,130,246,0.2)'
                                }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px' }}>
                                        현재 입력값 기준 예상 순위
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' as const }}>
                                        <div>
                                            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                                {predictedRank.rank}위
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                                                전체 {predictedRank.totalCount}명 중
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '8px 12px',
                                            borderRadius: '999px',
                                            backgroundColor: '#FFFFFF',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            color: 'var(--primary)'
                                        }}>
                                            상위 {predictedRank.percentile}%
                                        </div>
                                    </div>
                                </div>
                            )}

                            <input placeholder="메모를 남겨주세요 (선택)" value={note} onChange={e => setNote(e.target.value)} style={{ ...styles.input, padding: isMobile ? '14px' : '16px' }} />
                            <button type="submit" style={{ ...styles.submitBtn, padding: isMobile ? '16px' : '18px', fontSize: isMobile ? '16px' : '18px' }}>{isEditMode ? '수정 완료' : '기록 제출하기'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* ✅ [신규] 동명이인 확인 다이얼로그 */}
            {showDuplicateDialog && duplicateInfo && (
                <div style={styles.overlay} onClick={() => setShowDuplicateDialog(false)}>
                    <div
                        style={{
                            backgroundColor: 'var(--bg-card)',
                            borderRadius: '24px',
                            padding: '32px',
                            maxWidth: '440px',
                            width: '90%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                            textAlign: 'center'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px' }}>
                            동명이인 확인
                        </h3>

                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            다음 기록이 있는 사람과 같으신가요?
                        </p>

                        <div
                            style={{
                                backgroundColor: 'var(--bg-secondary)',
                                padding: '16px',
                                borderRadius: '16px',
                                marginBottom: '24px',
                                border: '2px solid var(--primary)'
                            }}
                        >
                            <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                                {duplicateInfo.duplicates[0]?.masked_phone}
                            </p>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>
                                {duplicateInfo.duplicates[0]?.name}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' as const }}>
                            <button
                                onClick={handleDuplicateYes}
                                disabled={loading}
                                style={{
                                    padding: '14px',
                                    backgroundColor: '#10B981',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    fontSize: '15px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.6 : 1
                                }}
                            >
                                예, 같은 사람입니다 (기록 수정)
                            </button>

                            <button
                                onClick={handleDuplicateNo}
                                disabled={loading}
                                style={{
                                    padding: '14px',
                                    backgroundColor: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    border: '2px solid var(--border-color)',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    fontSize: '15px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.6 : 1
                                }}
                            >
                                아니요, 다른 사람입니다
                            </button>
                        </div>

                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '16px', marginBottom: 0 }}>
                            아니오를 선택하면 성명이 '<strong>{pendingScoreData?.member_name}B</strong>'로 변경되어 새로운 기록으로 등록됩니다.
                        </p>
                    </div>
                </div>
            )}

            {/* 우측 하단 고정 로그아웃 버튼 (라운드 스타일) */}
            <button
                onClick={handleLogout}
                style={styles.logoutFab}
            >
                정보 삭제 로그아웃
            </button>
        </div>
    );
};

// 스타일은 CompetitionPage.tsx와 동일 (일부 불필요한 것 제외하고 유지)
const styles: { [key: string]: React.CSSProperties } = {
    container: { maxWidth: '800px', margin: '0 auto', padding: '0 16px 100px', backgroundColor: 'var(--bg-card)', minHeight: '100vh', fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif', width: '100%', overflowX: 'hidden', boxSizing: 'border-box' as const },
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' },
    spinner: { width: '40px', height: '40px', border: '4px solid var(--border-color)', borderTop: `4px solid ${TOSS_BLUE}`, borderRadius: '50%', animation: 'spin 1s linear infinite' },

    // Detail Grid
    detailContainer: { paddingTop: '24px', maxWidth: '1300px', margin: '0 auto' },
    detailGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '40px', alignItems: 'start' },
    leftSide: { position: 'sticky' as const, top: '24px', display: 'flex', flexDirection: 'column' as const, gap: '24px' },
    rightSide: { minWidth: 0 },

    compInfoCard: { backgroundColor: 'var(--bg-card)', padding: '24px 16px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid var(--border-color)', width: '100%', boxSizing: 'border-box' as const },
    backBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '15px', fontWeight: '600', cursor: 'pointer', padding: 0 },
    detailTitle: { fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 16px 0', lineHeight: 1.3 },
    detailDesc: { fontSize: '16px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 },

    // Tabs
    tabContainer: { display: 'flex', gap: '8px', marginBottom: '20px' },
    tab: { flex: 1, padding: '16px', fontSize: '16px', fontWeight: '600', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s' },
    tabActive: { flex: 1, padding: '16px', fontSize: '16px', fontWeight: '700', color: '#FFFFFF', backgroundColor: TOSS_BLUE, border: `1px solid ${TOSS_BLUE}`, borderRadius: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(49, 130, 246, 0.25)' },

    // Events
    eventsSection: {},
    eventList: { display: 'flex', gap: '16px', overflowX: 'auto' as const, marginBottom: '20px', paddingBottom: '4px', paddingTop: '10px', scrollbarWidth: 'none' as const },
    eventCard: { minWidth: '110px', padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '20px', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.2s', boxShadow: '0 2px 12px rgba(0,0,0,0.02)', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column' as const },
    eventCardActive: { minWidth: '110px', padding: '16px', backgroundColor: 'var(--primary-bg)', borderRadius: '20px', cursor: 'pointer', border: `1px solid ${TOSS_BLUE}`, boxShadow: '0 4px 16px rgba(49, 130, 246, 0.15)', transform: 'translateY(-2px)', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column' as const },
    eventNum: { fontSize: '13px', fontWeight: '800', color: TOSS_BLUE, display: 'block', marginBottom: '6px' },
    eventName: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', wordBreak: 'keep-all', lineHeight: '1.3', flex: 1 },

    eventDetail: { backgroundColor: 'var(--bg-card)', padding: '24px 16px', borderRadius: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', border: '1px solid var(--border-color)', marginTop: '20px', width: '100%', boxSizing: 'border-box' as const },
    eventDetailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    eventDetailTitle: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },
    eventDesc: { fontSize: '16px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '20px', whiteSpace: 'pre-wrap' as const, lineHeight: '1.6', marginBottom: '32px', border: '1px solid var(--border-color)' },
    recordBtn: { width: '100%', padding: '18px', fontSize: '18px', fontWeight: '700', color: '#FFFFFF', backgroundColor: TOSS_BLUE, border: 'none', borderRadius: '20px', cursor: 'pointer', marginBottom: '32px', boxShadow: '0 8px 20px rgba(49, 130, 246, 0.25)', transition: 'transform 0.1s' },
    predictBtn: { width: '100%', padding: '14px 18px', fontSize: '15px', fontWeight: '700', color: TOSS_BLUE, backgroundColor: 'var(--primary-bg)', border: `1px solid ${TOSS_BLUE}`, borderRadius: '18px', cursor: 'pointer', marginBottom: '14px', transition: 'transform 0.1s' },

    myRankCard: { marginBottom: '24px', width: '100%', boxSizing: 'border-box' as const },
    myRankContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg, ${TOSS_BLUE} 0%, #5E9EFF 100%)`, color: '#FFFFFF', padding: '20px 16px', borderRadius: '20px', boxShadow: '0 8px 24px rgba(49, 130, 246, 0.25)', border: '1px solid rgba(255,255,255,0.1)', width: '100%', boxSizing: 'border-box' as const },
    myRankInfo: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
    myRankLabel: { fontSize: '14px', opacity: 0.9, fontWeight: '600' },
    myRankValue: { fontSize: '32px', fontWeight: '800' },
    myRankTotal: { fontSize: '18px', opacity: 0.8, fontWeight: '500' },
    myRankRight: { textAlign: 'right' as const },
    myRankScore: { display: 'block', fontSize: '24px', fontWeight: '700', marginBottom: '10px' },
    percentBadge: { padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF', borderRadius: '14px', fontSize: '14px', fontWeight: '700', backdropFilter: 'blur(4px)' },

    leaderboard: { display: 'flex', flexDirection: 'column' as const, gap: '10px', width: '100%', boxSizing: 'border-box' as const },
    leaderboardItem: { display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderRadius: '16px', width: '100%', boxSizing: 'border-box' as const, minWidth: 0 },
    leaderboardRank: { width: '40px', flexShrink: 0, marginTop: '2px' },
    leaderboardName: { flex: 1, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' as const, gap: '4px', minWidth: 0, paddingRight: '12px' },
    leaderboardScore: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'right' as const, flexShrink: 0, marginTop: '4px' },
    scoreText: { marginRight: '6px' },
    rxTag: { fontSize: '12px', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border-color)' },
    rankBadge: { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', fontSize: '16px', fontWeight: '700' },
    meTag: { padding: '2px 6px', backgroundColor: '#10B981', color: '#FFFFFF', borderRadius: '6px', fontSize: '11px', fontWeight: '700' },
    gymTag: { marginLeft: '4px', fontSize: '11px', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', fontWeight: '500', display: 'inline-block' },

    emptySelection: { textAlign: 'center' as const, padding: '80px 20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', marginTop: '20px' },
    emptyListText: { padding: '32px', textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: '14px' },

    // Overall
    overallSection: {},
    liveIndicator: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'var(--danger-bg)', borderRadius: '12px', fontSize: '14px', fontWeight: '600', color: 'var(--danger)', marginBottom: '16px', width: 'fit-content' as const },
    liveDot: { width: '8px', height: '8px', backgroundColor: 'var(--danger)', borderRadius: '50%' },
    overallList: { display: 'flex', flexDirection: 'column' as const, gap: '10px', width: '100%', boxSizing: 'border-box' as const },
    overallItem: { display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderRadius: '16px', width: '100%', boxSizing: 'border-box' as const, minWidth: 0 },
    overallRank: { width: '40px', flexShrink: 0, marginTop: '2px' },
    overallInfo: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: '6px' },
    overallName: { display: 'block', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'keep-all', lineHeight: '1.4' },
    overallEvents: { display: 'flex', gap: '6px' },
    eventPoint: { fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '500' },
    overallTotal: { fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
    ruleText: { fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center' as const, marginTop: '32px' },

    // Modal
    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
    modalContent: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '24px 16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.1)', boxSizing: 'border-box' as const },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
    modalTitle: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },
    modalClose: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' },
    form: { display: 'flex', flexDirection: 'column' as const, gap: '16px' },
    formGroup: { marginBottom: '8px' },
    label: { display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' },
    input: { width: '100%', padding: '16px', fontSize: '15px', border: '1px solid var(--border-color)', borderRadius: '16px', boxSizing: 'border-box' as const, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' },
    submitBtn: { padding: '18px', fontSize: '16px', fontWeight: '700', color: '#FFFFFF', backgroundColor: TOSS_BLUE, border: 'none', borderRadius: '16px', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)' },

    // Score Input
    timeInput: { width: '100%', padding: '16px', fontSize: '22px', fontWeight: '700', border: '2px solid var(--border-color)', borderRadius: '16px', boxSizing: 'border-box' as const, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', textAlign: 'center' as const, fontFamily: 'monospace', letterSpacing: '2px', transition: 'border-color 0.15s' },

    rxRow: { display: 'flex', justifyContent: 'center', gap: '12px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', marginBottom: '24px' },
    scaleBtn: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const },

    // Logout Fixed Button (Rounded Rectangle)
    logoutFab: {
        position: 'fixed' as const,
        bottom: '24px',
        right: '24px',
        padding: '12px 20px',
        borderRadius: '12px',
        backgroundColor: 'var(--danger)',
        color: '#FFFFFF',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
        zIndex: 1000,
        transition: 'all 0.2s ease-in-out',
        fontSize: '14px',
        fontWeight: 'bold',
    },
};

export default GuestLeaderboardPage;
