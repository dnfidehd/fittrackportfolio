import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useSearchParams } from 'react-router-dom';
import {
    getCompetitions, getCompetitionDetail, createCompetition,
    createCompetitionEvent, submitCompetitionScore, getEventLeaderboard,
    getOverallLeaderboard, getMyInfo,
    registerCompetition,
    checkRegistrationStatus,
    getCompetitionRegistrations,
    updateRegistrationStatus,
    deleteCompetitionEvent,
    updateCompetitionEvent,

    searchGyms,
    getCompetitionsPendingCount,
    getMyGymMembersRecords, // ✅ [신규]
    updateScoreStatus, // ✅ [신규]
    coachSubmitScore, // ✅ [신규]
    coachSubmitBulkScore, // ✅ [신규]
    deleteScore, // ✅ [신규]
    mergeCompetitionParticipants
} from '../../services/api';
import { Competition, CompetitionEvent, CompLeaderboardItem, Member, OverallLeaderboardItem } from '../../types';
import { Trophy, ArrowLeft, Users, Clock, Check, X, Edit, Trash2, Plus, ChevronDown, ChevronUp, Calendar, Info, Settings, Search, Download, Upload, MessageSquare } from 'lucide-react';
import CompSettingsModal from '../../components/admin/CompSettingsModal';
import { exportLeaderboardToExcel, downloadScoreTemplate, parseScoreExcel } from '../../utils/excelUtils';
import { isStaffRole, isSuperAdminRole, isUserRole } from '../../utils/roles';

const TOSS_BLUE = '#3182F6';

interface BulkEntryRow {
    id: string; // 로컬 ID
    member_id: number | null;
    guest_name: string;
    guest_gender: 'M' | 'F';
    score_value: string;
    tie_break: string;
    is_rx: boolean;
    scale_rank: string | null;
    is_time_cap: boolean;
    note: string;
}

const CompetitionPage: React.FC = () => {
    const isMobile = useIsMobile();
    const [user, setUser] = useState<Member | null>(null);
    const isMobileMode = isMobile || isUserRole(user?.role);
    const [searchParams, setSearchParams] = useSearchParams();
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
    const [events, setEvents] = useState<CompetitionEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CompetitionEvent | null>(null);
    const [leaderboard, setLeaderboard] = useState<CompLeaderboardItem[]>([]);
    const [overallLeaderboard, setOverallLeaderboard] = useState<OverallLeaderboardItem[]>([]);
    const [activeTab, setActiveTab] = useState<'events' | 'overall' | 'coach'>('events'); // ✅ [수정] 코치 탭 추가
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const [myStatus, setMyStatus] = useState<string | null>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [showDuplicateNamesOnly, setShowDuplicateNamesOnly] = useState(false);
    const [mergeTargetByName, setMergeTargetByName] = useState<Record<string, string>>({});
    const [mergeLoadingKey, setMergeLoadingKey] = useState<string | null>(null);

    // ✅ [신규] 코치 탭 관련 상태
    const [myGymMembers, setMyGymMembers] = useState<any[]>([]);
    const isCoachOrAdmin = isStaffRole(user?.role);


    const [showCreateCompForm, setShowCreateCompForm] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showInputModal, setShowInputModal] = useState(false);
    const [showEditEventModal, setShowEditEventModal] = useState(false);
    const [showAddEventModal, setShowAddEventModal] = useState(false);

    // ✅ [신규] 코치 대리 입력 폼 상태
    const [showCoachSubmitModal, setShowCoachSubmitModal] = useState(false);
    const [coachSubmitTarget, setCoachSubmitTarget] = useState<any>(null);
    const [coachScoreValue, setCoachScoreValue] = useState('');
    const [coachIsRx, setCoachIsRx] = useState(true);
    const [coachScaleRank, setCoachScaleRank] = useState<string | null>(null);
    const [coachIsTimeCap, setCoachIsTimeCap] = useState(false);
    const [coachTieBreak, setCoachTieBreak] = useState('');
    const [coachScoreMin, setCoachScoreMin] = useState('');
    const [coachScoreSec, setCoachScoreSec] = useState('');
    const [coachTieBreakMin, setCoachTieBreakMin] = useState('');
    const [coachTieBreakSec, setCoachTieBreakSec] = useState('');
    const [coachNote, setCoachNote] = useState('');
    const [coachGuestName, setCoachGuestName] = useState('');
    const [coachGuestPhone, setCoachGuestPhone] = useState('');
    const [coachGuestGender, setCoachGuestGender] = useState<'M' | 'F'>('M');

    // ✅ [신규] Bulk Entry 상태
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkRows, setBulkRows] = useState<BulkEntryRow[]>([]);
    const [showBulkDuplicateDialog, setShowBulkDuplicateDialog] = useState(false);
    const [bulkDuplicates, setBulkDuplicates] = useState<any[]>([]);

    const [newCompTitle, setNewCompTitle] = useState('');
    const [newCompDesc, setNewCompDesc] = useState('');
    const [newCompStartDate, setNewCompStartDate] = useState('');
    const [newCompEndDate, setNewCompEndDate] = useState('');

    // 보안 옵션 상태
    const [isPrivate, setIsPrivate] = useState(false);
    const [showLeaderboardToAll, setShowLeaderboardToAll] = useState(true);
    const [showWodToAll, setShowWodToAll] = useState(true);
    const [anonymizeForAll, setAnonymizeForAll] = useState(false);

    // 박스 초대 상태
    const [invitedGyms, setInvitedGyms] = useState<any[]>([]);
    const [gymSearchQuery, setGymSearchQuery] = useState('');
    const [gymSearchResults, setGymSearchResults] = useState<any[]>([]);
    const [isSearchingGym, setIsSearchingGym] = useState(false);
    const [newCompGuestPasscode, setNewCompGuestPasscode] = useState('');
    const [allowInvitedGymSettings, setAllowInvitedGymSettings] = useState(false); // ✅ [신규] 초대 박스 어드민 설정 당염 허용

    const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL'); // ✅ [신규] 성별 필터
    const [scaleFilter, setScaleFilter] = useState<'ALL' | 'RX' | 'A' | 'B' | 'C'>('ALL'); // ✅ [신규] 스케일 필터
    const [gymFilter, setGymFilter] = useState<string>('ALL'); // ✅ [신규] 체육관 필터
    const [searchTerm, setSearchTerm] = useState<string>(''); // ✅ [신규] 이름 검색어

    // ✅ [신규] 페이징 상태
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDesc, setNewEventDesc] = useState('');
    const [newEventScoreType, setNewEventScoreType] = useState('time');
    const [newEventTimeLimit, setNewEventTimeLimit] = useState(''); // 기존 AMRAP 설명용

    // ✅ [신규] 기록 제한 입력용 state
    const [newTimeCapMin, setNewTimeCapMin] = useState('');
    const [newTimeCapSec, setNewTimeCapSec] = useState('');
    const [newMaxReps, setNewMaxReps] = useState('');

    const [scoreValue, setScoreValue] = useState('');
    const [tieBreakValue, setTieBreakValue] = useState('');
    const [isRx, setIsRx] = useState(true);
    const [scaleRank, setScaleRank] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);
    const [isFinished, setIsFinished] = useState(true);
    // 일반 텍스트 입력 상태 (score)
    const [scoreMin, setScoreMin] = useState('');
    const [scoreSec, setScoreSec] = useState('');
    const [tbMin, setTbMin] = useState('');
    const [tbSec, setTbSec] = useState('');
    const [scoreReps, setScoreReps] = useState('');

    const [pendingCounts, setPendingCounts] = useState<{ [key: number]: number }>({});

    useEffect(() => { loadMyInfo(); loadCompetitions(); }, []);

    // 대기 인원 조회 (코치 이상)
    useEffect(() => {
        const fetchPendingCounts = async () => {
            if (user && isStaffRole(user.role)) {
                try {
                    const res = await getCompetitionsPendingCount();
                    setPendingCounts(res.data.competitions);
                } catch (e) {
                    // console.error(e);
                }
            }
        };
        fetchPendingCounts();
    }, [user]);
    useEffect(() => { if (selectedEvent) loadLeaderboard(selectedEvent.id); }, [selectedEvent]);

    useEffect(() => {
        if (selectedComp && activeTab === 'overall') {
            loadOverallLeaderboard(selectedComp.id);
            const interval = setInterval(() => loadOverallLeaderboard(selectedComp.id, false), 30000);
            return () => clearInterval(interval);
        }
    }, [activeTab, selectedComp]);

    const myRecord = user && leaderboard.length > 0 ? leaderboard.find(item => item.member_name === user.name) : null;

    useEffect(() => {
        if (myRecord && selectedEvent) {
            setIsEditMode(true);
            setIsRx(myRecord.is_rx);
            setScaleRank(myRecord.scale_rank || null);
            setNote(myRecord.note || '');
            if (myRecord.tie_break) {
                const tb = myRecord.tie_break.replace(/[^0-9]/g, '').padEnd(4, '0');
                setTbMin(tb.slice(0, 2));
                setTbSec(tb.slice(2, 4));
            } else { setTbMin(''); setTbSec(''); }
            if (myRecord.score_value.includes('CAP') || myRecord.is_time_cap) {
                setIsFinished(false);
                setScoreReps(myRecord.score_value.replace(/[^0-9]/g, ''));
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
        } else { resetForm(); }
    }, [leaderboard, user, selectedEvent]);

    const resetForm = () => {
        setIsEditMode(false);
        setScoreMin(''); setScoreSec('');
        setTbMin(''); setTbSec('');
        setScoreReps('');
        setIsRx(true); setScaleRank(null); setNote(''); setIsFinished(true);
    };

    // ✅ [신규] 이름과 전화번호 뒷자리 포맷팅
    const getDisplayName = (name: string, phone?: string | null): string => {
        if (!phone) return name;
        const lastTwo = phone.slice(-2);
        return `${name} (**${lastTwo})`;
    };

    const getOverallParticipantKey = (item: OverallLeaderboardItem): string =>
        item.member_id
            ? `member:${item.member_id}`
            : `guest:${item.member_name}:${item.guest_phone || ''}:${item.gym_name || ''}`;

    const getOverallParticipantRef = (item: OverallLeaderboardItem) => ({
        member_id: item.member_id,
        member_name: item.member_name,
        guest_phone: item.guest_phone || null,
    });

    const loadMyInfo = async () => { try { const res = await getMyInfo(); setUser(res.data); } catch (e) { } };
    const loadCompetitions = async () => { setLoading(true); try { const res = await getCompetitions(); setCompetitions(res.data); } catch (e) { } finally { setLoading(false); } };

    const handleCompClick = async (comp: Competition) => {
        setLoading(true);
        try {
            const res = await getCompetitionDetail(comp.id);
            setSelectedComp(res.data.competition); setEvents(res.data.events);
            setSelectedEvent(null); setLeaderboard([]); setActiveTab('events');
            const statusRes = await checkRegistrationStatus(comp.id);
            setMyStatus(statusRes.data.registered ? statusRes.data.status : null);
            const partsRes = await getCompetitionRegistrations(comp.id);
            setParticipants(partsRes.data);
        } catch (err) { toast.error("로딩 실패"); } finally { setLoading(false); }
    };

    const handleRegister = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedComp) return;
        if (!window.confirm(`'${selectedComp.title}' 대회에 참가 신청하시겠습니까?`)) return;

        const loadingToast = toast.loading("참가 신청 중...");
        setLoading(true);
        try {
            await registerCompetition(selectedComp.id);
            toast.success("참가 신청 완료!", { id: loadingToast });

            // 상태 즉시 갱신
            const statusRes = await checkRegistrationStatus(selectedComp.id);
            setMyStatus(statusRes.data.registered ? statusRes.data.status : null);
            const partsRes = await getCompetitionRegistrations(selectedComp.id);
            setParticipants(partsRes.data);
        }
        catch (e: any) {
            const errorMsg = e.response?.data?.detail || "참가 신청에 실패했습니다.";
            toast.error(errorMsg, { id: loadingToast });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (memberId: number, newStatus: string) => {
        if (!selectedComp) return;
        if (!window.confirm(`${newStatus === 'approved' ? '승인' : '거절'} 하시겠습니까?`)) return;
        try { await updateRegistrationStatus(selectedComp.id, memberId, newStatus); const partsRes = await getCompetitionRegistrations(selectedComp.id); setParticipants(partsRes.data); toast.success(`상태 변경 완료`); }
        catch (e) { toast.error("상태 변경 실패"); }
    };

    const loadLeaderboard = async (eventId: number) => { try { const res = await getEventLeaderboard(eventId); setLeaderboard(res.data); } catch (e) { } };

    const loadOverallLeaderboard = async (compId: number, showLoading = true) => {
        if (showLoading) setLoading(true);
        try { const res = await getOverallLeaderboard(compId); setOverallLeaderboard(res.data); setLastUpdated(new Date().toLocaleTimeString()); }
        catch (e) { } finally { if (showLoading) setLoading(false); }
    };

    const handleMergeParticipants = async (name: string, source: OverallLeaderboardItem, target: OverallLeaderboardItem) => {
        if (!selectedComp) return;
        if (!window.confirm(`'${getDisplayName(source.member_name, source.guest_phone)}' 기록을 '${getDisplayName(target.member_name, target.guest_phone)}' 쪽으로 병합할까요? 겹치는 종목은 자동으로 덮어쓰지 않습니다.`)) {
            return;
        }

        const mergeKey = `${name}:${getOverallParticipantKey(source)}:${getOverallParticipantKey(target)}`;
        setMergeLoadingKey(mergeKey);
        try {
            const res = await mergeCompetitionParticipants(selectedComp.id, {
                source: getOverallParticipantRef(source),
                target: getOverallParticipantRef(target),
            });

            const payload = res.data;
            const conflictText = payload.conflict_events?.length
                ? ` 겹치는 종목은 그대로 남겼어요: ${payload.conflict_events.join(', ')}`
                : '';
            toast.success(`${payload.moved_count}개 기록을 병합했어요.${conflictText}`);

            await loadOverallLeaderboard(selectedComp.id, false);
            if (selectedEvent) {
                await loadLeaderboard(selectedEvent.id);
            }
        } catch (e: any) {
            toast.error(e.response?.data?.detail || '참가자 병합에 실패했습니다.');
        } finally {
            setMergeLoadingKey(null);
        }
    };

    // ✅ [신규] 우리 박스 회원 기록 조회
    const loadMyGymMembers = async () => {
        if (!selectedComp || !selectedEvent) return;
        setLoading(true);
        try {
            const res = await getMyGymMembersRecords(selectedComp.id, selectedEvent.id);
            setMyGymMembers(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'coach' && selectedComp && selectedEvent) {
            loadMyGymMembers();
        }
    }, [activeTab, selectedComp, selectedEvent]);

    const handleCreateCompetition = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCompTitle) return;
        setLoading(true);
        try {
            await createCompetition({
                title: newCompTitle,
                description: newCompDesc,
                start_date: newCompStartDate,
                end_date: newCompEndDate,
                // 옵션 전달
                anonymize_for_all: anonymizeForAll,
                allow_invited_gym_settings: allowInvitedGymSettings, // ✅ [신규]
                invited_gym_ids: invitedGyms.map(g => g.id),
                guest_passcode: newCompGuestPasscode
            });
            toast.success("생성 완료");
            setShowCreateCompForm(false);
            // 초기화
            setNewCompTitle(''); setNewCompDesc(''); setNewCompStartDate(''); setNewCompEndDate('');
            setNewCompGuestPasscode('');
            setIsPrivate(false); setShowLeaderboardToAll(true); setShowWodToAll(true); setAnonymizeForAll(false); setAllowInvitedGymSettings(false);
            setInvitedGyms([]); setGymSearchQuery(''); setGymSearchResults([]);

            loadCompetitions();
        }
        catch (e: any) { toast.error("실패"); } finally { setLoading(false); }
    };

    // 박스 검색 핸들러
    const handleSearchGyms = async () => {
        if (!gymSearchQuery.trim()) return;
        setIsSearchingGym(true);
        try {
            const res = await searchGyms(gymSearchQuery);
            setGymSearchResults(res.data);
        } catch (e: any) {
            console.error(e);
            toast.error("박스 검색 실패");
        } finally {
            setIsSearchingGym(false);
        }
    };

    const handleAddInvitedGym = (gym: any) => {
        if (invitedGyms.find(g => g.id === gym.id)) {
            toast.error("이미 추가된 박스입니다.");
            return;
        }
        setInvitedGyms([...invitedGyms, gym]);
        setGymSearchResults([]); // 검색 결과 초기화
        setGymSearchQuery('');
    };

    const handleRemoveInvitedGym = (gymId: number) => {
        setInvitedGyms(invitedGyms.filter(g => g.id !== gymId));
    };


    const handleAddEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        // ✅ [수정] AMRAP 시 운동 시간 필수 검증
        if (newEventScoreType === 'reps' && !newEventTimeLimit) { toast.error('AMRAP은 운동 시간(분)을 입력해주세요.'); return; }
        setLoading(true);
        try {
            let finalDesc = newEventDesc;
            finalDesc = finalDesc.replace(/(\n\n)?⏱️ (Time Cap:|AMRAP).*/g, '').trim();
            if (newEventScoreType === 'time' && (parseInt(newTimeCapMin) > 0 || parseInt(newTimeCapSec) > 0)) {
                const min = parseInt(newTimeCapMin) || 0;
                const sec = parseInt(newTimeCapSec) || 0;
                const timeStr = sec > 0 ? `${min} min ${sec} sec` : `${min} min`;
                finalDesc += `\n\n⏱️ Time Cap: ${timeStr}`;
            } else if (newEventScoreType === 'reps' && newEventTimeLimit) {
                finalDesc += `\n\n⏱️ AMRAP ${newEventTimeLimit} min`;
            }

            // ✅ [신규] time_cap 및 max_reps 계산
            let time_cap = null;
            let max_reps = null;
            if (newEventScoreType === 'time') {
                const min = parseInt(newTimeCapMin) || 0;
                const sec = parseInt(newTimeCapSec) || 0;
                if (min > 0 || sec > 0) time_cap = min * 60 + sec;
            } else if (newEventScoreType === 'reps') {
                const val = parseInt(newMaxReps);
                if (val > 0) max_reps = val;
            }

            await createCompetitionEvent(selectedComp!.id, {
                title: newEventTitle,
                description: finalDesc,
                score_type: newEventScoreType,
                time_cap,
                max_reps
            });
            toast.success("종목 추가 완료!");
            setNewEventTitle(''); setNewEventDesc(''); setNewEventTimeLimit('');
            setNewTimeCapMin(''); setNewTimeCapSec(''); setNewMaxReps('');
            setShowAddEventModal(false);
            const res = await getCompetitionDetail(selectedComp!.id);
            setEvents(res.data.events);
        } catch (e) { toast.error("실패"); } finally { setLoading(false); }
    };

    const handleDeleteEvent = async () => {
        if (!selectedEvent) return;
        if (!window.confirm(`정말 삭제하시겠습니까?`)) return;
        setLoading(true);
        try { await deleteCompetitionEvent(selectedEvent.id); toast.success("삭제 완료"); setSelectedEvent(null); const res = await getCompetitionDetail(selectedComp!.id); setEvents(res.data.events); }
        catch (e) { toast.error("삭제 실패"); } finally { setLoading(false); }
    };

    const openAddEventModal = () => { setNewEventTitle(''); setNewEventDesc(''); setNewEventScoreType('time'); setNewEventTimeLimit(''); setNewTimeCapMin(''); setNewTimeCapSec(''); setNewMaxReps(''); setShowAddEventModal(true); };
    const openEditEventModal = () => {
        if (!selectedEvent) return;
        setNewEventTitle(selectedEvent.title);
        setNewEventDesc(selectedEvent.description);
        setNewEventScoreType(selectedEvent.score_type);
        setNewEventTimeLimit('');
        setNewTimeCapMin(selectedEvent.time_cap ? String(Math.floor(selectedEvent.time_cap / 60)) : '');
        setNewTimeCapSec(selectedEvent.time_cap ? String(selectedEvent.time_cap % 60) : '');
        setNewMaxReps(selectedEvent.max_reps ? String(selectedEvent.max_reps) : '');
        setShowEditEventModal(true);
    };

    const handleUpdateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvent) return;
        // ✅ [수정] AMRAP 시 운동 시간 필수 검증
        if (newEventScoreType === 'reps' && !newEventTimeLimit) { toast.error('AMRAP은 운동 시간(분)을 입력해주세요.'); return; }
        setLoading(true);
        try {
            let finalDesc = newEventDesc;
            finalDesc = finalDesc.replace(/(\n\n)?⏱️ (Time Cap:|AMRAP).*/g, '').trim();
            if (newEventScoreType === 'time' && (parseInt(newTimeCapMin) > 0 || parseInt(newTimeCapSec) > 0)) {
                const min = parseInt(newTimeCapMin) || 0;
                const sec = parseInt(newTimeCapSec) || 0;
                const timeStr = sec > 0 ? `${min} min ${sec} sec` : `${min} min`;
                finalDesc += `\n\n⏱️ Time Cap: ${timeStr}`;
            } else if (newEventScoreType === 'reps' && newEventTimeLimit) {
                finalDesc += `\n\n⏱️ AMRAP ${newEventTimeLimit} min`;
            }

            // ✅ [신규] time_cap 및 max_reps 계산
            let time_cap = null;
            let max_reps = null;
            if (newEventScoreType === 'time') {
                const min = parseInt(newTimeCapMin) || 0;
                const sec = parseInt(newTimeCapSec) || 0;
                if (min > 0 || sec > 0) time_cap = min * 60 + sec;
            } else if (newEventScoreType === 'reps') {
                const val = parseInt(newMaxReps);
                if (val > 0) max_reps = val;
            }

            await updateCompetitionEvent(selectedEvent.id, {
                title: newEventTitle,
                description: finalDesc,
                score_type: newEventScoreType,
                time_cap,
                max_reps
            });
            toast.success("수정 완료!");
            setShowEditEventModal(false);
            const res = await getCompetitionDetail(selectedComp!.id);
            setEvents(res.data.events);
            const updatedEvent = res.data.events.find(ev => ev.id === selectedEvent.id);
            setSelectedEvent(updatedEvent || null);
        } catch (e) { toast.error("수정 실패"); } finally { setLoading(false); }
    };

    const buildTimeStr = (min: string, sec: string) => min.padStart(2, '0') + sec.padStart(2, '0');
    const getFormattedTimeStr = (raw: string) => raw.padEnd(4, '0');

    const handleSubmitScore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvent) return;

        let finalScore = '';
        if (selectedEvent.score_type === 'time') {
            if (isFinished) {
                if (!scoreMin && !scoreSec) { toast.error('기록을 입력해주세요'); return; }
                const inputMin = parseInt(scoreMin || '0');
                const inputSec = parseInt(scoreSec || '0');
                const totalInputSec = inputMin * 60 + inputSec;
                if (selectedEvent.time_cap && totalInputSec > selectedEvent.time_cap) {
                    const lm = Math.floor(selectedEvent.time_cap / 60);
                    const ls = selectedEvent.time_cap % 60;
                    toast.error(`입력한 기록이 타임캡(${lm}분 ${ls}초)을 초과합니다. 완주하지 못했다면 미완주(CAP)를 선택해주세요.`);
                    return;
                }
                finalScore = buildTimeStr(scoreMin || '0', scoreSec || '0');
            } else {
                if (!scoreReps) { toast.error('완료 렙수를 입력해주세요'); return; }
                finalScore = `CAP + ${scoreReps} reps`;
            }
        } else {
            if (!scoreReps) { toast.error('기록을 입력해주세요'); return; }
            if (selectedEvent.score_type === 'reps' && selectedEvent.max_reps) {
                if (parseInt(scoreReps) > selectedEvent.max_reps) {
                    toast.error(`최대 제한 렙수(${selectedEvent.max_reps}회)를 초과하여 입력할 수 없습니다.`);
                    return;
                }
            }
            finalScore = scoreReps;
        }

        if (!window.confirm(isEditMode ? '수정하시겠습니까?' : '제출하시겠습니까?')) return;

        const tbStr = (tbMin || tbSec) ? buildTimeStr(tbMin || '0', tbSec || '0') : '';
        setLoading(true);
        try {
            await submitCompetitionScore(selectedEvent.id, {
                score_value: finalScore,
                is_rx: isRx,
                scale_rank: isRx ? null : scaleRank,
                is_time_cap: (selectedEvent.score_type === 'time' && !isFinished), // ✅ [수정]
                tie_break: tbStr,
                note: note
            });
            toast.success(isEditMode ? "수정 완료!" : "제출 완료!");
            setShowInputModal(false);
            loadLeaderboard(selectedEvent.id);
        } catch (e: any) {
            const errorMsg = e.response?.data?.detail || e.message || "기록 제출 중 오류가 발생했습니다.";
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // ✅ [신규] 코치 대리 입력 제출 핸들러
    const openBulkModal = () => {
        setBulkRows([{
            id: Date.now().toString(),
            member_id: null,
            guest_name: '',
            guest_gender: 'M',
            score_value: '',
            tie_break: '',
            is_rx: true,
            scale_rank: 'A',
            is_time_cap: false,
            note: ''
        }]);
        setIsBulkModalOpen(true);
    };

    const handleAddBulkRow = () => {
        setBulkRows(prev => [...prev, {
            id: Date.now().toString() + Math.random(),
            member_id: null,
            guest_name: '',
            guest_gender: 'M',
            score_value: '',
            tie_break: '',
            is_rx: true,
            scale_rank: 'A',
            is_time_cap: false,
            note: ''
        }]);
    };

    const handleRemoveBulkRow = (id: string) => {
        setBulkRows(prev => prev.filter(row => row.id !== id));
    };

    const handleBulkRowChange = (id: string, field: keyof BulkEntryRow, value: any) => {
        setBulkRows(prev => prev.map(row => {
            if (row.id === id) {
                // Auto-colon logic
                let processedValue = value;
                if (field === 'score_value' && selectedEvent?.score_type === 'time' && typeof value === 'string' && !row.is_time_cap) {
                    const digits = value.replace(/[^0-9]/g, '');
                    if (digits.length >= 3 && value.length === digits.length) {
                        processedValue = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
                    }
                }
                if (field === 'tie_break' && typeof value === 'string') {
                    const digits = value.replace(/[^0-9]/g, '');
                    if (digits.length >= 3 && value.length === digits.length) {
                        processedValue = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
                    }
                }
                return { ...row, [field]: processedValue };
            }
            return row;
        }));
    };

    const handleBulkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvent) return;

        const validRows = bulkRows.filter(row => row.guest_name.trim() !== '' && row.score_value.trim() !== '');
        if (validRows.length === 0) {
            toast.error("최소한 1개 이상의 올바른 기록을 입력해주세요.");
            return;
        }

        // ✅ [신규] 기록 일괄 등록 유효성 검증
        for (let idx = 0; idx < validRows.length; idx++) {
            const row = validRows[idx];
            if (selectedEvent.score_type === 'time' && selectedEvent.time_cap && !row.is_time_cap) {
                const timeStr = getFormattedTimeStr(row.score_value.replace(/[^0-9]/g, ''));
                const min = parseInt(timeStr.slice(0, 2)) || 0;
                const sec = parseInt(timeStr.slice(2, 4)) || 0;
                const recordSeconds = min * 60 + sec;
                if (recordSeconds > selectedEvent.time_cap) {
                    toast.error(`${idx + 1}번째 행: 타임캡(${Math.floor(selectedEvent.time_cap / 60)}분 ${selectedEvent.time_cap % 60}초)을 초과합니다. 미완주(CAP)를 체크해주세요.`);
                    return;
                }
            } else if (selectedEvent.score_type === 'reps' && selectedEvent.max_reps) {
                const recordReps = parseInt(row.score_value.replace(/[^0-9]/g, '')) || 0;
                if (recordReps > selectedEvent.max_reps) {
                    toast.error(`${idx + 1}번째 행: 최대 제한 렙수(${selectedEvent.max_reps}회)를 초과했습니다.`);
                    return;
                }
            }
        }

        const formattedData = validRows.map(row => {
            let finalScore = row.score_value;
            if (selectedEvent.score_type === 'time') {
                if (row.is_time_cap) {
                    finalScore = `CAP + ${row.score_value.replace(/[^0-9]/g, '')} reps`;
                } else {
                    finalScore = getFormattedTimeStr(row.score_value.replace(/[^0-9]/g, ''));
                }
            }

            let finalTieBreak = "";
            if (row.tie_break) {
                finalTieBreak = getFormattedTimeStr(row.tie_break.replace(/[^0-9]/g, ''));
            }

            return {
                member_id: row.member_id,
                guest_name: row.guest_name,
                guest_gender: row.guest_gender,
                score_value: finalScore,
                is_rx: row.is_rx,
                scale_rank: row.is_rx ? null : row.scale_rank,
                is_time_cap: row.is_time_cap,
                tie_break: finalTieBreak,
                note: row.note
            };
        });

        setLoading(true);
        try {
            const res = await coachSubmitBulkScore(selectedEvent.id, formattedData);

            // ✅ [신규] 동명이인 감지 응답 처리
            if (res.data.status === 'duplicates_found' && res.data.duplicates.length > 0) {
                setBulkDuplicates(res.data.duplicates);
                setShowBulkDuplicateDialog(true);
                toast(`${res.data.duplicates.length}건의 동명이인이 발견되었습니다.`, {
                    icon: '⚠️'
                });
                setLoading(false);
                return;
            }

            toast.success(res.data.message || "일괄 등록 완료!");
            setIsBulkModalOpen(false);
            setBulkRows([]);
            if (activeTab === 'coach') {
                loadMyGymMembers();
            }
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "일괄 등록 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleCoachSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvent) return;

        if (!coachSubmitTarget && !coachGuestName.trim()) {
            toast.error("게스트 이름을 입력해주세요.");
            return;
        }

        let isScoreEmpty = false;
        if (selectedEvent.score_type === 'time' && !coachIsTimeCap) {
            if (!coachScoreMin && !coachScoreSec) isScoreEmpty = true;
        } else {
            if (!coachScoreValue || coachScoreValue === '0') isScoreEmpty = true;
        }

        if (isScoreEmpty) {
            toast.error("기록을 입력해주세요.");
            return;
        }

        let finalScore = coachScoreValue;
        if (selectedEvent.score_type === 'time') {
            const mm = (coachScoreMin || '0').padStart(2, '0');
            const ss = (coachScoreSec || '0').padStart(2, '0');
            const timeStr = mm + ss;
            finalScore = !coachIsTimeCap ? getFormattedTimeStr(timeStr) : `CAP + ${coachScoreValue} reps`;
        }

        let finalTieBreak = "";
        if (selectedEvent.score_type === 'time' && (coachTieBreakMin || coachTieBreakSec)) {
            const mm = (coachTieBreakMin || '0').padStart(2, '0');
            const ss = (coachTieBreakSec || '0').padStart(2, '0');
            finalTieBreak = getFormattedTimeStr(mm + ss);
        } else if (coachTieBreak) {
            finalTieBreak = getFormattedTimeStr(coachTieBreak);
        }
        setLoading(true);
        try {
            await coachSubmitScore(selectedEvent.id, {
                member_id: coachSubmitTarget?.member_id || null,
                guest_name: coachSubmitTarget?.member_id ? undefined : coachGuestName,
                guest_phone: coachSubmitTarget?.member_id ? undefined : (coachSubmitTarget?.guest_phone || coachGuestPhone || ''),
                guest_gender: coachSubmitTarget?.member_id ? undefined : (coachSubmitTarget?.guest_gender || coachGuestGender),
                score_value: finalScore,
                is_rx: coachIsRx,
                scale_rank: coachIsRx ? null : coachScaleRank,
                is_time_cap: (selectedEvent.score_type === 'time' && coachIsTimeCap),
                tie_break: finalTieBreak,
                note: coachNote
            });
            toast.success("대리 등록 및 승인이 완료되었습니다.");
            setShowCoachSubmitModal(false);
            loadMyGymMembers();
            loadLeaderboard(selectedEvent.id);
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "기록 등록에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ [수정] 크로스핏 용어로 단위 레이블 변경
    const getUnitLabel = (type: string) => (type === 'weight' ? 'kg' : type === 'reps' ? 'reps' : '');

    const getRankBadge = (rank: number) => {
        if (rank === 1) return <div style={{ ...styles.rankBadge, backgroundColor: '#FFF7E6', color: '#B45309' }}>🥇</div>;
        if (rank === 2) return <div style={{ ...styles.rankBadge, backgroundColor: '#F3F4F6', color: '#4B5563' }}>🥈</div>;
        if (rank === 3) return <div style={{ ...styles.rankBadge, backgroundColor: '#FFEDD5', color: '#C2410C' }}>🥉</div>;
        return <div style={{ ...styles.rankBadge, backgroundColor: '#F9FAFB', color: '#6B7280' }}>{rank}</div>;
    };

    // ✅ [신규] 시간 기록 포맷팅 (숫자를 MM:SS 변환)
    const formatLeaderboardScore = (score: string, type: string) => {
        if (!score) return '-';
        if (type === 'time') {
            if (score.includes('CAP') || score.includes('reps')) return score;
            // 숫자만 추출
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

    // ✅ [신규] 성별 필터 후 순위 재계산 (이벤트 리더보드)
    // score_value와 tie_break가 모두 같으면 동순위, 아니면 현재 인덱스+1로 밀림
    const reRankEventLeaderboard = (items: typeof leaderboard) => {
        const result: typeof leaderboard = [];
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
    const reRankOverallLeaderboard = (items: typeof overallLeaderboard) => {
        if (items.length === 0) return items;

        // 1) 모든 이벤트명 수집
        const allEventNames = new Set<string>();
        items.forEach(item => {
            Object.keys(item.event_details || {}).forEach(name => allEventNames.add(name));
        });

        // 2) 고유 키 생성 (member_id가 null인 게스트 대비)
        const getKey = (item: typeof items[0], idx: number) =>
            item.member_id ? `m_${item.member_id}` : `g_${idx}_${item.member_name}`;

        // 3) 각 이벤트별로 그룹 내 순위 재계산
        const newEventDetails: Record<string, Record<string, number>> = {};
        items.forEach((item, idx) => { newEventDetails[getKey(item, idx)] = {}; });

        allEventNames.forEach(eventName => {
            // 해당 이벤트에 기록이 있는 참가자만 추출 + 원래 인덱스 보존
            const participants = items
                .map((item, idx) => ({ item, idx, origRank: item.event_details?.[eventName] }))
                .filter(p => p.origRank != null)
                .sort((a, b) => (a.origRank || 999) - (b.origRank || 999));

            // 순위 재배정 (동일 원래 순위 = 동순위)
            let newRank = 1;
            participants.forEach((p, i) => {
                if (i > 0 && p.origRank !== participants[i - 1].origRank) {
                    newRank = i + 1;
                }
                newEventDetails[getKey(p.item, p.idx)][eventName] = newRank;
            });

            // 기록 없는 참가자는 (참가자 수 + 1) 부여
            // 기록 없는 참가자는 (현재 필터링된 전체 참가자 수 + 1) 부여
            const noRecordRank = items.length + 1; // ✅ [수정] participants.length + 1 에서 items.length + 1 로 변경
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
        const result: typeof overallLeaderboard = [];
        recalculated.forEach((item, idx) => {
            if (idx === 0) { result.push({ ...item, rank: 1 }); return; }
            const isTie = item.total_points === recalculated[idx - 1].total_points;
            result.push({ ...item, rank: isTie ? result[idx - 1].rank : idx + 1 });
        });
        return result;
    };

    const renderStatusBadge = () => {
        // 초대된 박스인지 확인
        const isInvited = selectedComp?.participating_gyms?.some(
            pg => pg.gym_id === user?.gym_id && pg.status === 'accepted'
        );

        if (!myStatus) {
            if (!isInvited) {
                return (
                    <div style={{ ...styles.statusBadge, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)', border: '1px solid var(--border-color)' }}>
                        <Info size={16} /> 우리 박스는 초대되지 않은 대회입니다
                    </div>
                );
            }
            return <button type="button" onClick={handleRegister} disabled={loading} style={{ ...styles.registerBtn, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}><Plus size={16} /> 참가 신청하기</button>;
        }
        if (myStatus === 'pending') return <div style={{ ...styles.statusBadge, backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}><Clock size={16} /> 승인 대기중</div>;
        if (myStatus === 'approved') return <div style={{ ...styles.statusBadge, backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}><Check size={16} /> 참가 확정</div>;
        if (myStatus === 'rejected') return <div style={{ ...styles.statusBadge, backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}><X size={16} /> 참가 거절됨</div>;
    };

    const renderMyRankCard = (myRankData: any, totalCount: number, type: 'event' | 'overall', currentGenderFilter: string, userGender?: string, currentGymFilter?: string, userGym?: string) => {
        if (currentGenderFilter !== 'ALL' && userGender && currentGenderFilter !== userGender) {
            return (
                <div style={styles.myRankCard}>
                    <div style={{ ...styles.myRankContent, padding: isMobileMode ? '24px' : '32px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ color: '#FFFFFF', fontSize: isMobileMode ? '14px' : '16px', fontWeight: '600' }}>
                            {currentGenderFilter === 'M' ? '남자 선수들의 순위만 표시됩니다.' : '여자 선수들의 순위만 표시됩니다.'}
                        </span>
                    </div>
                </div>
            );
        }

        if (currentGymFilter && currentGymFilter !== 'ALL' && userGym && currentGymFilter !== userGym) {
            return (
                <div style={styles.myRankCard}>
                    <div style={{ ...styles.myRankContent, padding: isMobileMode ? '24px' : '32px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ color: '#FFFFFF', fontSize: isMobileMode ? '14px' : '16px', fontWeight: '600' }}>
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
            if (selectedEvent.score_type !== 'time' && !myRankData.score_value.includes("CAP")) scoreDisplay = `${myRankData.score_value} ${unit}`;
            else scoreDisplay = formatLeaderboardScore(myRankData.score_value, selectedEvent.score_type);
        } else scoreDisplay = `${myRankData.total_points}점`;
        return (
            <div style={styles.myRankCard}>
                <div style={{ ...styles.myRankContent, padding: isMobileMode ? '24px' : '32px' }}>
                    <div style={styles.myRankInfo}>
                        <span style={styles.myRankLabel}>{type === 'overall' ? '현재 종합 순위' : '현재 종목 순위'}</span>
                        <span style={{ ...styles.myRankValue, fontSize: isMobileMode ? '24px' : '32px' }}>{rank === 1 && '👑 '}{rank}위 <span style={styles.myRankTotal}>/ {totalCount}명</span></span>
                    </div>
                    <div style={styles.myRankRight}>
                        <span style={{ ...styles.myRankScore, fontSize: isMobileMode ? '20px' : '24px' }}>{scoreDisplay}</span>
                        <span style={styles.percentBadge}>상위 {percentile}%</span>
                    </div>
                </div>
            </div>
        );
    };

    // ✅ [신규] 엑셀 내보내기 핸들러
    const handleExportExcel = async () => {
        if (!selectedComp) return;
        try {
            setLoading(true);
            // 종목별 리더보드 가져오기
            const eventLeaderboards = await Promise.all(
                events.map(async (event) => {
                    const res = await getEventLeaderboard(event.id);
                    return { event, leaderboard: res.data };
                })
            );
            const result = exportLeaderboardToExcel(selectedComp.title, overallLeaderboard, eventLeaderboards);
            if (result.success) {
                toast.success('엑셀 파일이 다운로드되었습니다');
            } else {
                toast.error('엑셀 내보내기 실패');
            }
        } catch (error) {
            toast.error('엑셀 내보내기 중 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    // ✅ [신규] 양식 다운로드 핸들러
    const handleDownloadTemplate = () => {
        if (!selectedComp) return;
        const result = downloadScoreTemplate(selectedComp.title, events);
        if (result.success) {
            toast.success('양식 파일이 다운로드되었습니다');
        } else {
            toast.error('양식 다운로드 실패');
        }
    };

    // ✅ [신규] 엑셀 가져오기 핸들러
    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedComp) return;
        try {
            setLoading(true);
            const sheets = await parseScoreExcel(file);
            let totalImported = 0;

            for (const sheet of sheets) {
                // 시트 이름으로 이벤트 매칭
                const matchEvent = events.find(ev => ev.title.substring(0, 28) === sheet.sheetName);
                if (!matchEvent || sheet.rows.length === 0) continue;

                const bulkData = sheet.rows.map(row => ({
                    member_id: null,
                    guest_name: row.guest_name,
                    guest_gender: row.guest_gender,
                    score_value: row.score_value,
                    is_rx: row.is_rx,
                    scale_rank: row.scale_rank,
                    is_time_cap: row.is_time_cap,
                    tie_break: row.tie_break,
                    note: row.note,
                }));

                await coachSubmitBulkScore(matchEvent.id, bulkData);
                totalImported += sheet.rows.length;
            }

            if (totalImported > 0) {
                toast.success(`${totalImported}건의 기록이 등록되었습니다`);
                if (selectedEvent) {
                    loadLeaderboard(selectedEvent.id);
                }
                loadOverallLeaderboard(selectedComp.id);
            } else {
                toast.error('가져올 수 있는 기록이 없습니다. 시트 이름이 종목명과 일치하는지 확인해주세요.');
            }
        } catch (error) {
            toast.error('엑셀 가져오기 중 오류가 발생했습니다');
        } finally {
            setLoading(false);
            e.target.value = ''; // 파일 input 초기화
        }
    };

    const currentEventIndex = selectedEvent ? events.findIndex(e => e.id === selectedEvent.id) + 1 : 0;

    // ✅ [신규] 내 순위 계산 로직 (성별 및 체육관 필터 반영)
    // ✅ [수정] 초대된 체육관 목록을 기반으로 필터 드롭다운 구성 (기록 유무 상관없이 노출)
    const uniqueGyms = Array.from(new Set([
        ...(selectedComp?.participating_gyms?.filter(pg => pg.status === 'accepted').map(pg => pg.gym_name) || []),
        ...leaderboard.map(item => item.gym_name),
        ...overallLeaderboard.map(item => item.gym_name)
    ].filter(Boolean))).sort() as string[];

    const userRawEventRecord = user ? leaderboard.find(item => item.member_name === user.name) : null;
    const userGym = userRawEventRecord?.gym_name;

    // ✅ [신규] 스케일 필터 매칭 함수
    const matchesScaleFilter = (item: any) => {
        if (scaleFilter === 'ALL') return true;
        if (scaleFilter === 'RX') return item.is_rx === true;
        return item.is_rx === false && item.scale_rank === scaleFilter;
    };

    const filteredEventBoard = leaderboard.filter(item =>
        (genderFilter === 'ALL' || item.gender === genderFilter) &&
        matchesScaleFilter(item) &&
        (gymFilter === 'ALL' || item.gym_name === gymFilter) &&
        (searchTerm === '' || item.member_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const rankedEventBoard = (genderFilter === 'ALL' && scaleFilter === 'ALL' && gymFilter === 'ALL') ? filteredEventBoard : reRankEventLeaderboard([...filteredEventBoard]);
    const myRankedEventRecord = user ? rankedEventBoard.find(item => item.member_name === user.name) : null;

    const duplicateGroups = Object.entries(
        overallLeaderboard.reduce((acc, item) => {
            const nameKey = item.member_name.trim();
            if (!acc[nameKey]) acc[nameKey] = [];
            acc[nameKey].push(item);
            return acc;
        }, {} as Record<string, OverallLeaderboardItem[]>)
    )
        .filter(([, items]) => items.length > 1)
        .map(([name, items]) => ({
            name,
            items: [...items].sort((a, b) => {
                if (a.member_id && !b.member_id) return -1;
                if (!a.member_id && b.member_id) return 1;
                return a.total_points - b.total_points;
            }),
        }));

    const duplicateNameSet = new Set(duplicateGroups.map(group => group.name));
    const isSuperadminOnlyToolVisible = isSuperAdminRole(user?.role);

    const filteredOverallBoard = overallLeaderboard.filter(item =>
        (genderFilter === 'ALL' || item.gender === genderFilter) &&
        (gymFilter === 'ALL' || item.gym_name === gymFilter) &&
        (searchTerm === '' || item.member_name.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (!showDuplicateNamesOnly || duplicateNameSet.has(item.member_name.trim()))
    );
    const rankedOverallBoard = (genderFilter === 'ALL' && scaleFilter === 'ALL' && gymFilter === 'ALL') ? filteredOverallBoard : reRankOverallLeaderboard([...filteredOverallBoard]);
    const myRankedOverallRecord = user ? rankedOverallBoard.find(item => item.member_name === user.name) : null;

    return (
        <div style={{ ...styles.container, padding: isMobileMode ? '0 8px 100px' : '0 24px 100px' }}>
            {loading && <div style={styles.overlay}><div style={styles.spinner}></div></div>}

            {!selectedComp ? (
                /* 대회 목록 */
                <div style={styles.listContainer}>
                    <header style={styles.header}>
                        <h1 style={{ ...styles.title, fontSize: isMobileMode ? '22px' : '28px' }}><Trophy size={isMobileMode ? 24 : 28} color={TOSS_BLUE} fill={TOSS_BLUE} /> 진행 중인 대회</h1>
                        {isCoachOrAdmin && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setShowCreateCompForm(!showCreateCompForm)} style={styles.addBtn}>
                                    {showCreateCompForm ? <X size={20} /> : <Plus size={20} />}
                                </button>
                            </div>
                        )}
                    </header>

                    {showCreateCompForm && (
                        <div style={{ ...styles.formCard, padding: isMobileMode ? '24px' : '32px' }}>
                            <h3 style={styles.formTitle}>새로운 대회 만들기</h3>
                            <form onSubmit={handleCreateCompetition} style={styles.form}>
                                <input placeholder="대회 이름을 입력해주세요" value={newCompTitle} onChange={e => setNewCompTitle(e.target.value)} style={styles.input} />
                                <input placeholder="간단한 설명을 적어주세요" value={newCompDesc} onChange={e => setNewCompDesc(e.target.value)} style={styles.input} />
                                <div style={{ ...styles.dateRow, gridTemplateColumns: isMobileMode ? '1fr' : '1fr 1fr' }}>
                                    <div style={styles.dateGroup}>
                                        <label style={styles.dateLabel}>시작일</label>
                                        <input type="date" value={newCompStartDate} onChange={e => setNewCompStartDate(e.target.value)} style={styles.input} />
                                    </div>
                                    <div style={styles.dateGroup}>
                                        <label style={styles.dateLabel}>종료일</label>
                                        <input type="date" value={newCompEndDate} onChange={e => setNewCompEndDate(e.target.value)} style={styles.input} />
                                    </div>
                                </div>

                                {/* 보안 옵션 UI */}
                                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                                    <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>🔒 공개 및 보안 설정</h4>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={styles.checkboxLabel}>
                                            <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
                                            <span>프라이빗 대회 (지정 박스만 참여 가능)</span>
                                        </label>

                                        <label style={styles.checkboxLabel}>
                                            <input type="checkbox" checked={showLeaderboardToAll} onChange={e => setShowLeaderboardToAll(e.target.checked)} />
                                            <span>비참여 유저에게 리더보드 공개</span>
                                        </label>

                                        <label style={styles.checkboxLabel}>
                                            <input type="checkbox" checked={showWodToAll} onChange={e => setShowWodToAll(e.target.checked)} />
                                            <span>비참여 유저에게 WOD 공개</span>
                                        </label>

                                        <label style={styles.checkboxLabel}>
                                            <input type="checkbox" checked={anonymizeForAll} onChange={e => setAnonymizeForAll(e.target.checked)} />
                                            <span>비참여 유저에게 이름 마스킹 (익명화)</span>
                                        </label>

                                        <label style={styles.checkboxLabel}>
                                            <input type="checkbox" checked={allowInvitedGymSettings} onChange={e => setAllowInvitedGymSettings(e.target.checked)} />
                                            <span>초대된 박스 관리자의 대회 설정 수정 허용</span>
                                        </label>

                                        <div style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                                            <label style={{ ...styles.dateLabel, marginBottom: '8px', display: 'block' }}>🔑 게스트 패스코드 (선택)</label>
                                            <input
                                                placeholder="예: 1234 (입력 시 게스트 모드 활성화)"
                                                value={newCompGuestPasscode}
                                                onChange={e => setNewCompGuestPasscode(e.target.value)}
                                                style={styles.input}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 박스 초대 UI */}
                                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
                                    <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>🏠 참여 박스 초대</h4>

                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                        <input
                                            type="text"
                                            value={gymSearchQuery}
                                            onChange={(e) => setGymSearchQuery(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault(); // ✅ [수정] 대회 생성 폼 제출 방지
                                                    handleSearchGyms();
                                                }
                                            }}
                                            placeholder="박스 이름 검색..."
                                            style={{ ...styles.input, flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSearchGyms}
                                            disabled={isSearchingGym || gymSearchQuery.trim().length === 0}
                                            style={{
                                                ...styles.addEventBtn,
                                                backgroundColor: (isSearchingGym || gymSearchQuery.trim().length === 0) ? 'var(--bg-secondary)' : (gymSearchResults.length > 0 ? 'var(--primary)' : 'var(--primary)'),
                                                color: (isSearchingGym || gymSearchQuery.trim().length === 0) ? 'var(--text-tertiary)' : 'white',
                                                borderColor: (isSearchingGym || gymSearchQuery.trim().length === 0) ? 'var(--border-color)' : 'var(--primary)',
                                                opacity: isSearchingGym ? 0.6 : 1,
                                                cursor: (isSearchingGym || gymSearchQuery.trim().length === 0) ? 'not-allowed' : 'pointer',
                                                minWidth: '70px'
                                            }}
                                        >
                                            {isSearchingGym ? '검색중' : '검색'}
                                        </button>
                                    </div>

                                    {/* 검색 결과 */}
                                    {gymSearchResults.length > 0 && (
                                        <div style={{ maxHeight: '150px', overflowY: 'auto', backgroundColor: '#fff', borderRadius: '8px', padding: '8px', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
                                            {gymSearchResults.map(gym => (
                                                <div key={gym.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #eee' }}>
                                                    <span style={{ fontSize: '14px', color: '#333' }}>{gym.name}</span>
                                                    <button type="button" onClick={() => handleAddInvitedGym(gym)} style={{ ...styles.addEventBtn, minWidth: '50px', padding: '4px 8px', fontSize: '12px' }}>추가</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 추가된 박스 목록 */}
                                    {invitedGyms.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {invitedGyms.map(gym => (
                                                <div key={gym.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#E8F3FF', borderRadius: '20px', fontSize: '13px', color: '#3182F6', fontWeight: 'bold' }}>
                                                    {gym.name}
                                                    <button type="button" onClick={() => handleRemoveInvitedGym(gym.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center' }}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button type="submit" style={styles.submitBtn}>대회 생성하기</button>
                            </form>
                        </div>
                    )}

                    <div style={{ ...styles.compList, gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))' }}>

                        {/* 필터링 상태 안내 및 해제 버튼 */}
                        {searchParams.get('filter') === 'pending' && (
                            <div style={{
                                gridColumn: '1 / -1',
                                backgroundColor: '#E8F3FF',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '16px',
                                color: '#3182F6',
                                fontWeight: '600',
                                fontSize: '14px'
                            }}>
                                <span>🚀 대기 중인 신청이 있는 대회만 보는 중입니다</span>
                                <button
                                    onClick={() => setSearchParams({})}
                                    style={{
                                        border: 'none',
                                        background: 'white',
                                        color: '#3182F6',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        fontSize: '12px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    전체 보기
                                </button>
                            </div>
                        )}

                        {(searchParams.get('filter') === 'pending'
                            ? competitions.filter(c => (pendingCounts[c.id] || 0) > 0)
                            : competitions
                        ).length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIconBox}><Trophy size={40} color="#B0B8C1" /></div>
                                <p style={styles.emptyText}>
                                    {searchParams.get('filter') === 'pending'
                                        ? "대기 중인 신청이 있는 대회가 없습니다"
                                        : "현재 진행 중인 대회가 없어요"}
                                </p>
                                {searchParams.get('filter') === 'pending' && (
                                    <button
                                        onClick={() => setSearchParams({})}
                                        style={{ ...styles.addBtn, marginTop: '12px', backgroundColor: '#6B7280' }}
                                    >
                                        전체 목록 보기
                                    </button>
                                )}
                            </div>
                        ) : (
                            (searchParams.get('filter') === 'pending'
                                ? competitions.filter(c => (pendingCounts[c.id] || 0) > 0)
                                : competitions
                            ).map(comp => {
                                const pendingCount = pendingCounts[comp.id] || 0;
                                return (
                                    <div key={comp.id} style={styles.compCard} onClick={() => handleCompClick(comp)}>
                                        <div style={styles.compCardContent}>
                                            <h3 style={{ ...styles.compTitle, fontSize: isMobileMode ? '18px' : '20px' }}>
                                                {comp.title}
                                                {pendingCount > 0 && (
                                                    <span style={{
                                                        backgroundColor: '#EF4444',
                                                        color: 'white',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        padding: '2px 5px',
                                                        borderRadius: '8px',
                                                        marginLeft: '6px',
                                                        verticalAlign: 'middle',
                                                        display: 'inline-block'
                                                    }}>
                                                        +{pendingCount}
                                                    </span>
                                                )}
                                            </h3>
                                            <p style={styles.compDesc}>{comp.description}</p>
                                            <div style={styles.compDate}><Calendar size={14} /> {comp.start_date} ~ {comp.end_date}</div>
                                        </div>
                                        <div style={styles.arrowBox}><ChevronDown size={20} style={{ transform: 'rotate(-90deg)' }} /></div>
                                    </div>
                                );
                            }))}


                    </div>
                </div>
            ) : (
                /* 대회 상세 */
                <div style={styles.detailContainer}>
                    <div style={{ ...styles.detailGrid, gridTemplateColumns: isMobileMode ? '1fr' : '360px 1fr', gap: isMobileMode ? '24px' : '40px' }}>
                        {/* 좌측 사이드바: 대회 정보 및 참가자 */}
                        <div style={{ ...styles.leftSide, position: isMobileMode ? 'static' : 'sticky' as const }}>
                            <div style={{ ...styles.compInfoCard, padding: isMobileMode ? '24px' : '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <button style={styles.backBtn} onClick={() => setSelectedComp(null)}>
                                        <ArrowLeft size={16} /> 목록으로
                                    </button>
                                    {/* ✅ [수정] 설정 버튼 노출 조건:
                                         - 대회 생성자(creator_id)
                                         - superadmin
                                         - allow_invited_gym_settings=true이고 초대된 박스
                                    */}
                                    {(() => {
                                        const isCreator = user?.id === selectedComp?.creator_id;
                                        const isSuperAdmin = isSuperAdminRole(user?.role);
                                        const isInvited = selectedComp?.participating_gyms?.some(
                                            pg => pg.gym_id === user?.gym_id
                                        );
                                        const isInvitedAndAllowed = isInvited && selectedComp?.allow_invited_gym_settings;
                                        const canSettings = isCreator || isSuperAdmin || isInvitedAndAllowed;
                                        return canSettings ? (
                                            <button onClick={() => setShowSettingsModal(true)} style={styles.iconBtn}>
                                                <Settings size={20} />
                                            </button>
                                        ) : null;
                                    })()}
                                </div>
                                <h1 style={{ ...styles.detailTitle, fontSize: isMobileMode ? '22px' : '26px' }}>{selectedComp.title}</h1>
                                <p style={styles.detailDesc}>{selectedComp.description}</p>

                                {selectedComp.admin_names && selectedComp.admin_names.length > 0 && (
                                    <div style={{ marginTop: '16px', marginBottom: '16px', fontSize: '13px', color: '#6B7684', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ backgroundColor: '#F2F4F6', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #E5E8EB' }}>대회 관리자(코치)</span>
                                        <span style={{ fontWeight: '500' }}>{selectedComp.admin_names.join(', ')}</span>
                                    </div>
                                )}

                                <div style={styles.statusRow}>{renderStatusBadge()}</div>
                            </div>

                            {/* 참가자 현황 */}
                            <div style={styles.participantSection}>
                                <div onClick={() => setShowAdminPanel(!showAdminPanel)} style={styles.participantHeader}>
                                    <div style={styles.participantInfo}>
                                        <Users size={18} color={TOSS_BLUE} />
                                        <span>참가자 현황</span>
                                        <span style={styles.countBadge}>
                                            {participants.length}명
                                            {participants.filter(p => p.status === 'pending').length > 0 && (
                                                <span style={{ color: 'var(--warning)', marginLeft: '4px', fontSize: '13px' }}>
                                                    (대기 {participants.filter(p => p.status === 'pending').length}명)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {showAdminPanel ? <ChevronUp size={20} color="#B0B8C1" /> : <ChevronDown size={20} color="#B0B8C1" />}
                                </div>
                                {showAdminPanel && (
                                    <div style={styles.participantList}>
                                        {participants.length === 0 ? <p style={styles.emptyListText}>아직 신청자가 없습니다</p> : (
                                            participants.map(p => (
                                                <div key={p.id} style={styles.participantItem}>
                                                    <span style={styles.participantName}>{p.member_name}</span>
                                                    <div style={styles.participantActions}>
                                                        {p.status === 'pending' && isCoachOrAdmin ? (
                                                            <div style={styles.adminBtns}>
                                                                <button onClick={() => handleUpdateStatus(p.member_id, 'approved')} style={styles.approveBtn}><Check size={14} /> 승인</button>
                                                                <button onClick={() => handleUpdateStatus(p.member_id, 'rejected')} style={styles.rejectBtn}><X size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <span style={{
                                                                ...styles.statusTag,
                                                                backgroundColor: p.status === 'approved' ? 'var(--success-bg)' : p.status === 'pending' ? 'var(--warning-bg)' : 'var(--danger-bg)',
                                                                color: p.status === 'approved' ? 'var(--success)' : p.status === 'pending' ? 'var(--warning)' : 'var(--danger)'
                                                            }}>
                                                                {p.status === 'approved' ? '승인됨' : p.status === 'pending' ? '대기중' : '거절됨'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 우측 메인 컨텐츠: 탭 및 정보 */}
                        <div style={styles.rightSide}>
                            {/* 탭 */}
                            <div style={{ ...styles.tabContainer, gap: isMobileMode ? '8px' : '12px', marginBottom: isMobileMode ? '16px' : '24px' }}>
                                <button onClick={() => { setActiveTab('events'); setCurrentPage(1); }} style={{ ...(activeTab === 'events' ? styles.tabActive : styles.tab), padding: isMobileMode ? '12px' : '16px', fontSize: isMobileMode ? '14px' : '16px' }}>🏋️‍♂️ 종목별 기록</button>
                                <button onClick={() => { setActiveTab('overall'); setCurrentPage(1); }} style={{ ...(activeTab === 'overall' ? styles.tabActive : styles.tab), padding: isMobileMode ? '12px' : '16px', fontSize: isMobileMode ? '14px' : '16px' }}>🏆 종합 순위</button>
                                {isCoachOrAdmin && (
                                    <button onClick={() => { setActiveTab('coach'); setCurrentPage(1); }} style={{ ...(activeTab === 'coach' ? styles.tabActive : styles.tab), padding: isMobileMode ? '12px' : '16px', fontSize: isMobileMode ? '14px' : '16px', backgroundColor: activeTab === 'coach' ? '#10B981' : 'var(--bg-card)', borderColor: activeTab === 'coach' ? '#10B981' : 'var(--border-color)', boxShadow: activeTab === 'coach' ? '0 4px 16px rgba(16, 185, 129, 0.25)' : 'none', color: activeTab === 'coach' ? '#FFFFFF' : 'var(--text-tertiary)' }}>📋 박스 기록 관리</button>
                                )}
                            </div>

                            {/* ✅ 엑셀 도구 모음 (코치/관리자용) - 내보내기만 노출 */}
                            {isCoachOrAdmin && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    <button onClick={handleExportExcel} style={{ padding: '8px 14px', backgroundColor: '#10B981', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Download size={14} /> 엑셀 내보내기
                                    </button>
                                </div>
                            )}

                            {/* ✅ [삭제] 기존 필터 바 위치 (종목 카드 아래로 이동됨) */}

                            {activeTab === 'events' && (
                                <div style={styles.eventsSection}>
                                    {/* 종목 리스트 */}
                                    <div style={{ ...styles.eventList, gap: isMobileMode ? '10px' : '16px' }}>
                                        {events.map((event, index) => (
                                            <div key={event.id} onClick={() => setSelectedEvent(event)} style={{ ...(selectedEvent?.id === event.id ? styles.eventCardActive : styles.eventCard), minWidth: isMobileMode ? '130px' : '160px', padding: isMobileMode ? '14px' : '20px' }}>
                                                <span style={styles.eventNum}>Event {index + 1}</span>
                                                <span style={{ ...styles.eventName, fontSize: isMobileMode ? '14px' : '16px' }}>{event.title}</span>
                                            </div>
                                        ))}
                                        {isCoachOrAdmin && (
                                            <button onClick={openAddEventModal} style={{ ...styles.addEventBtn, minWidth: isMobileMode ? '80px' : '100px', fontSize: isMobileMode ? '12px' : '14px' }}><Plus size={16} /> 종목 추가</button>
                                        )}
                                    </div>

                                    {/* ✅ [삭제] 필터 바 삭제 (리더보드 테이블 바로 위로 이동) */}

                                    {/* 종목 상세 */}
                                    {selectedEvent ? (
                                        <div style={{ ...styles.eventDetail, padding: isMobileMode ? '24px' : '40px' }}>
                                            <div style={styles.eventDetailHeader}>
                                                <h3 style={{ ...styles.eventDetailTitle, fontSize: isMobileMode ? '20px' : '24px' }}>Event {events.findIndex(e => e.id === selectedEvent.id) + 1}: {selectedEvent.title}</h3>
                                                {isCoachOrAdmin && (
                                                    <div style={styles.eventActions}>
                                                        <button onClick={openEditEventModal} style={styles.editBtn}><Edit size={16} /></button>
                                                        <button onClick={handleDeleteEvent} style={styles.deleteBtn}><Trash2 size={16} /></button>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ ...styles.eventDesc, padding: isMobileMode ? '16px' : '24px', fontSize: isMobileMode ? '14px' : '16px' }}>{selectedEvent.description}</div>

                                            {myStatus === 'approved' && (
                                                <button style={{ ...styles.recordBtn, padding: isMobileMode ? '14px' : '18px', fontSize: isMobileMode ? '16px' : '18px' }} onClick={() => setShowInputModal(true)}>
                                                    {leaderboard.find(item => item.member_name === user?.name) ? "내 기록 수정하기" : "기록 입력하기"}
                                                </button>
                                            )}

                                            {/* ✅ [신규/이동] 필터 바 (기록 입력 하단, 리더보드 테이블 직전) */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', alignItems: 'center', marginTop: '16px' }}>
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
                                                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F2F4F6', borderRadius: '12px', padding: '4px 12px', height: 'fit-content', flex: isMobileMode ? '1 1 100%' : 'none', minWidth: isMobileMode ? 'none' : '180px' }}>
                                                    <Search size={14} color="#8B95A1" style={{ marginRight: '6px' }} />
                                                    <input
                                                        placeholder="이름 검색"
                                                        value={searchTerm}
                                                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                                        style={{ border: 'none', background: 'transparent', fontSize: '13px', color: '#191F28', outline: 'none', width: '100%', padding: '6px 0' }}
                                                    />
                                                </div>
                                            </div>

                                            {user && leaderboard.length > 0 && renderMyRankCard(myRankedEventRecord, rankedEventBoard.length, 'event', genderFilter, user?.gender, gymFilter, userGym)}

                                            {/* 리더보드 */}
                                            {/* ✅ [수정] 종목별 리더보드 테이블 - 4컬럼 (소속→이름 서브텍스트로 이동) */}
                                            <div style={{ overflowX: 'auto' }}>
                                                {/* 테이블 헤더 */}
                                                <div style={{ display: 'grid', gridTemplateColumns: isMobileMode ? '35px minmax(100px, 1fr) 75px 75px' : '50px minmax(160px, 2fr) 110px 110px', gap: '6px', padding: isMobileMode ? '10px 12px' : '10px 16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '8px', fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, minWidth: isMobileMode ? '300px' : '100%' }}>
                                                    <span style={{ textAlign: 'center' as const }}>등수</span>
                                                    <span>이름 / 소속</span>
                                                    <span style={{ textAlign: 'right' as const }}>기록</span>
                                                    <span style={{ textAlign: 'right' as const }}>타이브레이크</span>
                                                </div>
                                                {/* 테이블 바디 */}
                                                {(() => {
                                                    // ✅ [수정] 성별/체육관 연계 독립 순위 재계산
                                                    if (leaderboard.length === 0) return <div style={styles.emptyListText}>아직 등록된 기록이 없어요</div>;
                                                    const totalPages = Math.ceil(rankedEventBoard.length / itemsPerPage);
                                                    const currentData = rankedEventBoard.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                                                    return (
                                                        <>
                                                            {currentData.map((item, idx) => (
                                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: isMobileMode ? '35px minmax(100px, 1fr) 75px 75px' : '50px minmax(160px, 2fr) 110px 110px', gap: '6px', padding: isMobileMode ? '12px' : '14px 16px', borderRadius: '14px', marginBottom: '6px', backgroundColor: user && item.member_name === user.name ? 'var(--primary-bg)' : 'var(--bg-secondary)', alignItems: 'center', border: user && item.member_name === user.name ? '1.5px solid var(--primary)' : '1.5px solid transparent', minWidth: isMobileMode ? '300px' : '100%' }}>
                                                                    {/* 등수 */}
                                                                    <div style={{ textAlign: 'center' as const }}>{getRankBadge(item.rank)}</div>
                                                                    {/* 이름 + 소속 (2줄) */}
                                                                    <div style={{ overflow: 'hidden' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{getDisplayName(item.member_name, item.guest_phone)}</span>
                                                                            {/* {item.note && (
                                                                                <span
                                                                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.7, marginLeft: '4px' }}
                                                                                    title={item.note}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        toast(item.note as string, { icon: '📝', duration: 3000 });
                                                                                    }}
                                                                                >
                                                                                    <MessageSquare size={14} color="var(--primary)" />
                                                                                </span>
                                                                            )} */}
                                                                            {user && item.member_name === user.name && <span style={styles.meTag}>ME</span>}
                                                                            {item.status === 'pending' && <span style={{ fontSize: '13px', marginLeft: '2px' }} title="승인 대기중">⏳</span>}
                                                                            {item.status === 'approved' && <span style={{ fontSize: '13px', marginLeft: '2px' }} title="승인됨">✅</span>}
                                                                            {item.status === 'rejected' && <span style={{ fontSize: '13px', marginLeft: '2px' }} title="반려됨">❌</span>}
                                                                            {item.is_rx === false && <span style={styles.rxTag}>{item.scale_rank ? `S${item.scale_rank}` : 'Sc'}</span>}
                                                                        </div>
                                                                        {item.gym_name && (
                                                                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.gym_name}</div>
                                                                        )}
                                                                    </div>
                                                                    {/* 기록 */}
                                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'right' as const }}>
                                                                        {selectedEvent ? formatLeaderboardScore(item.score_value, selectedEvent.score_type) : item.score_value}
                                                                        {item.is_time_cap && <span style={{ fontSize: '11px', color: 'var(--danger)', marginLeft: '4px' }}>TC</span>}
                                                                    </div>
                                                                    {/* 타이브레이크 */}
                                                                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'right' as const }}>
                                                                        {item.tie_break ? formatLeaderboardScore(item.tie_break, 'time') : '-'}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {/* ✅ [신규] 페이지네이션 UI (종목별 순위) */}
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
                                            <p style={{ color: '#8B95A1', fontSize: '15px' }}>왼쪽 리스트에서 종목을 선택해주세요</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'overall' && (
                                /* 종합 순위 */
                                <div style={styles.overallSection}>
                                    <div style={{ ...styles.liveIndicator, fontSize: isMobileMode ? '12px' : '14px', padding: isMobileMode ? '8px 12px' : '12px 16px' }}>
                                        <span style={styles.liveDot}></span>
                                        {isMobileMode ? `실시간 (${lastUpdated})` : `실시간 자동 갱신 중 (${lastUpdated})`}
                                    </div>

                                    {/* ✅ [신규] 종합 순위에서도 필터 바 노출 */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', alignItems: 'center', marginTop: '16px' }}>
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
                                        {/* ✅ [신규] 이름 검색창 */}
                                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F2F4F6', borderRadius: '12px', padding: '4px 12px', height: 'fit-content', flex: isMobileMode ? '1 1 100%' : 'none', minWidth: isMobileMode ? 'none' : '180px' }}>
                                            <Search size={14} color="#8B95A1" style={{ marginRight: '6px' }} />
                                            <input
                                                placeholder="이름 검색"
                                                value={searchTerm}
                                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                                style={{ border: 'none', background: 'transparent', fontSize: '13px', color: '#191F28', outline: 'none', width: '100%', padding: '6px 0' }}
                                            />
                                        </div>
                                        {isSuperadminOnlyToolVisible && (
                                            <button
                                                onClick={() => { setShowDuplicateNamesOnly(prev => !prev); setCurrentPage(1); }}
                                                style={{
                                                    padding: '10px 14px',
                                                    borderRadius: '12px',
                                                    border: showDuplicateNamesOnly ? '1px solid #2563EB' : '1px solid #D1D6DB',
                                                    backgroundColor: showDuplicateNamesOnly ? '#EFF6FF' : '#FFFFFF',
                                                    color: showDuplicateNamesOnly ? '#2563EB' : '#4B5563',
                                                    fontSize: '13px',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                동명이인만 보기 ({duplicateGroups.length})
                                            </button>
                                        )}
                                    </div>

                                    {isSuperadminOnlyToolVisible && duplicateGroups.length > 0 && (
                                        <div style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '18px', padding: isMobileMode ? '16px' : '20px', marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                                <div>
                                                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#9A3412' }}>총관리자 전용 중복 참가자 정리</div>
                                                    <div style={{ fontSize: '13px', color: '#9A3412', marginTop: '4px' }}>
                                                        같은 이름으로 집계된 참가자만 모아 보여줍니다. 병합 시 겹치는 종목 기록은 자동으로 덮어쓰지 않습니다.
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gap: '12px' }}>
                                                {duplicateGroups.map(group => {
                                                    const defaultTarget = group.items.find(item => item.member_id) || group.items[0];
                                                    const selectedTargetKey = mergeTargetByName[group.name] || getOverallParticipantKey(defaultTarget);

                                                    return (
                                                        <div key={group.name} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: isMobileMode ? '14px' : '16px', border: '1px solid #F3E8D3' }}>
                                                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>
                                                                {group.name} · {group.items.length}건
                                                            </div>

                                                            <div style={{ display: 'grid', gap: '10px' }}>
                                                                {group.items.map(item => {
                                                                    const participantKey = getOverallParticipantKey(item);
                                                                    const isTarget = participantKey === selectedTargetKey;
                                                                    const mergeKey = `${group.name}:${participantKey}:${selectedTargetKey}`;

                                                                    return (
                                                                        <div key={participantKey} style={{ border: isTarget ? '1px solid #2563EB' : '1px solid #E5E7EB', borderRadius: '14px', padding: '12px', backgroundColor: isTarget ? '#EFF6FF' : '#FFFFFF' }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                                                <div style={{ minWidth: 0 }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>
                                                                                            {getDisplayName(item.member_name, item.guest_phone)}
                                                                                        </span>
                                                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: isTarget ? '#2563EB' : '#6B7280', backgroundColor: isTarget ? '#DBEAFE' : '#F3F4F6', borderRadius: '999px', padding: '4px 8px' }}>
                                                                                            {item.member_id ? '회원 기록' : '게스트 기록'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>
                                                                                        {item.gym_name || '소속 미입력'} · 총 {item.total_points}점
                                                                                    </div>
                                                                                    <div style={{ fontSize: '12px', color: '#4B5563', marginTop: '8px', lineHeight: 1.6 }}>
                                                                                        {events.map(ev => `${ev.title} ${item.event_details[ev.title] ? `#${item.event_details[ev.title]}` : '-'}`).join(' · ')}
                                                                                    </div>
                                                                                </div>

                                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                                    <button
                                                                                        onClick={() => setMergeTargetByName(prev => ({ ...prev, [group.name]: participantKey }))}
                                                                                        style={{
                                                                                            padding: '8px 12px',
                                                                                            borderRadius: '10px',
                                                                                            border: isTarget ? '1px solid #2563EB' : '1px solid #D1D5DB',
                                                                                            backgroundColor: isTarget ? '#2563EB' : '#FFFFFF',
                                                                                            color: isTarget ? '#FFFFFF' : '#374151',
                                                                                            fontSize: '12px',
                                                                                            fontWeight: 700,
                                                                                            cursor: 'pointer',
                                                                                        }}
                                                                                    >
                                                                                        {isTarget ? '병합 대상' : '대상으로 선택'}
                                                                                    </button>

                                                                                    {!isTarget && (
                                                                                        <button
                                                                                            onClick={() => handleMergeParticipants(group.name, item, group.items.find(candidate => getOverallParticipantKey(candidate) === selectedTargetKey) || defaultTarget)}
                                                                                            disabled={mergeLoadingKey === mergeKey}
                                                                                            style={{
                                                                                                padding: '8px 12px',
                                                                                                borderRadius: '10px',
                                                                                                border: 'none',
                                                                                                backgroundColor: mergeLoadingKey === mergeKey ? '#BFDBFE' : '#111827',
                                                                                                color: '#FFFFFF',
                                                                                                fontSize: '12px',
                                                                                                fontWeight: 700,
                                                                                                cursor: mergeLoadingKey === mergeKey ? 'wait' : 'pointer',
                                                                                            }}
                                                                                        >
                                                                                            {mergeLoadingKey === mergeKey ? '병합 중...' : '선택 대상에 병합'}
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {user && overallLeaderboard.length > 0 && renderMyRankCard(myRankedOverallRecord, rankedOverallBoard.length, 'overall', genderFilter, user?.gender, gymFilter, userGym)}

                                    {/* ✅ [수정] 동적 컬럼 종합 순위 테이블 */}
                                    <div style={{ overflowX: 'auto' }}>
                                        {(() => {
                                            // 종목 수에 따라 동적으로 grid 컬럼 계산
                                            const eventCols = events.map(() => isMobileMode ? '60px' : '80px').join(' ');
                                            const gridCols = isMobileMode ? `35px minmax(100px, 1fr) 70px ${eventCols}` : `50px minmax(160px, 2fr) 90px ${eventCols}`;
                                            const baseWidth = isMobileMode ? (35 + 100 + 70 + (events.length * 60) + 32) : 100;
                                            const minWidthStyle = isMobileMode ? `${baseWidth}px` : '100%';
                                            return (
                                                <>
                                                    {/* 헤더 */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '6px', padding: isMobileMode ? '10px' : '10px 16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '8px', fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, alignItems: 'center', minWidth: minWidthStyle }}>
                                                        <span style={{ textAlign: 'center' as const }}>등수</span>
                                                        <span>이름 / 소속</span>
                                                        <span style={{ textAlign: 'center' as const }}>총포인트</span>
                                                        {events.map(ev => (
                                                            <span key={ev.id} style={{ textAlign: 'center' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }} title={ev.title}>
                                                                {ev.title.length > 6 ? ev.title.slice(0, 6) + '…' : ev.title}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {/* 바디 */}
                                                    {(() => {
                                                        // ✅ [수정] 성별/체육관 연계 독립 순위 재계산
                                                        if (overallLeaderboard.length === 0) return <div style={styles.emptyListText}>아직 집계된 기록이 없어요</div>;
                                                        const totalPages = Math.ceil(rankedOverallBoard.length / itemsPerPage);
                                                        const currentData = rankedOverallBoard.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                                                        return (
                                                            <>
                                                                {currentData.map((item) => (
                                                                    <div key={getOverallParticipantKey(item)} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '6px', padding: isMobileMode ? '12px 10px' : '14px 16px', borderRadius: '14px', marginBottom: '6px', backgroundColor: user?.name === item.member_name ? 'var(--primary-bg)' : 'var(--bg-secondary)', alignItems: 'center', border: user?.name === item.member_name ? '1.5px solid var(--primary)' : '1.5px solid transparent', minWidth: minWidthStyle }}>
                                                                        {/* 등수 */}
                                                                        <div style={{ textAlign: 'center' as const }}>{getRankBadge(item.rank)}</div>
                                                                        {/* 이름 + 소속 (2줄) */}
                                                                        <div style={{ overflow: 'hidden' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{getDisplayName(item.member_name, item.guest_phone)}</span>
                                                                                {user?.name === item.member_name && <span style={styles.meTag}>ME</span>}
                                                                            </div>
                                                                            {item.gym_name && (
                                                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.gym_name}</div>
                                                                            )}
                                                                        </div>
                                                                        {/* 총포인트 */}
                                                                        <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary)', textAlign: 'center' as const }}>
                                                                            {item.total_points}점
                                                                        </div>
                                                                        {/* 종목별 순위 (동적) */}
                                                                        {events.map(ev => (
                                                                            <div key={ev.id} style={{ textAlign: 'center' as const, fontSize: '14px', fontWeight: '600', color: (item.event_details[ev.title] && item.event_details[ev.title] <= rankedOverallBoard.length) ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                                                                {(item.event_details[ev.title] && item.event_details[ev.title] <= rankedOverallBoard.length) ? `#${item.event_details[ev.title]}` : '-'}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ))}
                                                                {/* ✅ [신규] 페이지네이션 UI (종합 순위) */}
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

                            {activeTab === 'coach' && isCoachOrAdmin && (
                                <div style={styles.eventsSection}>
                                    {/* 종목 리스트 (코치용) */}
                                    <div style={{ ...styles.eventList, gap: isMobileMode ? '10px' : '16px' }}>
                                        {events.map((event, index) => (
                                            <div key={event.id} onClick={() => setSelectedEvent(event)} style={{ ...(selectedEvent?.id === event.id ? styles.eventCardActive : styles.eventCard), minWidth: isMobileMode ? '130px' : '160px', padding: isMobileMode ? '14px' : '20px' }}>
                                                <span style={styles.eventNum}>Event {index + 1}</span>
                                                <span style={{ ...styles.eventName, fontSize: isMobileMode ? '14px' : '16px' }}>{event.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {selectedEvent ? (
                                        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: isMobileMode ? '24px' : '32px', border: '1px solid var(--border-color)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                                                <h4 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                                                    📋 {selectedEvent?.title}
                                                    <span style={{ fontSize: '15px', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>(소속 박스 회원 관리)</span>
                                                </h4>
                                                <button onClick={openBulkModal} style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Plus size={16} /> 일괄 등록
                                                </button>
                                            </div>

                                            {loading ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div style={styles.spinner}></div></div>
                                            ) : myGymMembers.length === 0 ? (
                                                <div style={styles.emptyState}>
                                                    <div style={styles.emptyIconBox}><Users size={32} color="#B0B8C1" /></div>
                                                    <p style={styles.emptyText}>참가 중인 소속 회원이 없습니다.</p>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    {myGymMembers.map((member, idx) => (
                                                        <div key={member.member_id ?? `guest-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#E5E8EB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                                    {member.profile_image ? <img src={member.profile_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={24} color="#8B95A1" />}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {member.member_name}
                                                                        {member.is_guest && <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#EFF6FF', color: '#2563EB', borderRadius: '4px', fontWeight: '600' }}>게스트</span>}
                                                                    </div>
                                                                    {member.score ? (
                                                                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span>기록: <strong style={{ color: 'var(--text-primary)' }}>{selectedEvent ? formatLeaderboardScore(member.score.score_value, selectedEvent.score_type) : member.score.score_value}</strong> {member.score.is_rx ? '(Rx)' : `(Sc ${member.score.scale_rank || ''})`}</span>
                                                                            {member.score.status === 'pending' && <span style={{ padding: '4px 8px', backgroundColor: '#D1FAE5', color: '#059669', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>✅ 승인됨</span>}
                                                                            {member.score.status === 'approved' && <span style={{ padding: '4px 8px', backgroundColor: '#D1FAE5', color: '#059669', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>✅ 승인됨</span>}
                                                                            {member.score.status === 'rejected' && <span style={{ padding: '4px 8px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>❌ 반려됨</span>}
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ fontSize: '14px', color: '#EF4444', marginTop: '4px', fontWeight: '600' }}>기록 미제출</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                {!member.score ? (
                                                                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>기록 없음</div>
                                                                ) : (
                                                                    member.score.status !== 'rejected' && (
                                                                        <button onClick={async () => {
                                                                            if (window.confirm('기록을 반려하시겠습니까? (회원은 다시 제출해야 합니다)')) {
                                                                                try {
                                                                                    await updateScoreStatus(member.score.id, 'rejected');
                                                                                    toast.success('기록이 반려되었습니다.');
                                                                                    loadMyGymMembers();
                                                                                    if (selectedEvent) loadLeaderboard(selectedEvent.id);
                                                                                } catch (e: any) {
                                                                                    toast.error('반려에 실패했습니다.');
                                                                                }
                                                                            }
                                                                        }} style={{ padding: '8px 12px', backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FCD34D', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>반려</button>
                                                                    )
                                                                )}
                                                                {/* ✅ 수정 버튼 */}
                                                                <button
                                                                    onClick={() => {
                                                                        setCoachSubmitTarget(member);
                                                                        // 기존 기록 미리 채우기
                                                                        if (member.score) {
                                                                            const sv = member.score.score_value || '';
                                                                            if (selectedEvent?.score_type === 'time' && !sv.includes('CAP')) {
                                                                                const digits = sv.replace(/[^0-9]/g, '');
                                                                                setCoachScoreMin(digits.length >= 4 ? digits.slice(0, digits.length - 2) : '0');
                                                                                setCoachScoreSec(digits.length >= 2 ? digits.slice(-2) : digits);
                                                                                setCoachIsTimeCap(false);
                                                                                setCoachScoreValue('');
                                                                            } else if (sv.includes('CAP')) {
                                                                                const reps = sv.replace(/[^0-9]/g, '');
                                                                                setCoachScoreValue(reps);
                                                                                setCoachIsTimeCap(true);
                                                                                setCoachScoreMin('');
                                                                                setCoachScoreSec('');
                                                                            } else {
                                                                                setCoachScoreValue(sv);
                                                                                setCoachIsTimeCap(false);
                                                                                setCoachScoreMin('');
                                                                                setCoachScoreSec('');
                                                                            }
                                                                            setCoachIsRx(member.score.is_rx ?? true);
                                                                            setCoachScaleRank(member.score.scale_rank || null);
                                                                            // 타이브레이크 분/초 분리
                                                                            const tbDigits = (member.score.tie_break || '').replace(/[^0-9]/g, '');
                                                                            setCoachTieBreakMin(tbDigits.length >= 4 ? tbDigits.slice(0, tbDigits.length - 2) : (tbDigits.length >= 2 ? '0' : ''));
                                                                            setCoachTieBreakSec(tbDigits.length >= 2 ? tbDigits.slice(-2) : tbDigits);
                                                                            setCoachNote(member.score.note || '');
                                                                        } else {
                                                                            setCoachScoreValue('');
                                                                            setCoachScoreMin('');
                                                                            setCoachScoreSec('');
                                                                            setCoachIsRx(true);
                                                                            setCoachScaleRank(null);
                                                                            setCoachIsTimeCap(false);
                                                                            setCoachTieBreakMin('');
                                                                            setCoachTieBreakSec('');
                                                                            setCoachNote('');
                                                                        }
                                                                        if (member.is_guest) {
                                                                            setCoachGuestName(member.member_name || '');
                                                                            setCoachGuestPhone(member.guest_phone || '');
                                                                            setCoachGuestGender(member.guest_gender || 'M');
                                                                        }
                                                                        setShowCoachSubmitModal(true);
                                                                    }}
                                                                    style={{ padding: '8px 14px', backgroundColor: '#3182F6', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    <Edit size={14} /> {member.score ? '기록 수정' : '기록 입력'}
                                                                </button>
                                                                {/* ✅ 삭제 버튼 */}
                                                                {member.score && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (!window.confirm(`${member.member_name}의 기록을 삭제하시겠습니까?`)) return;
                                                                            try {
                                                                                await deleteScore(member.score.id);
                                                                                toast.success('기록이 삭제되었습니다.');
                                                                                loadMyGymMembers();
                                                                                if (selectedEvent) loadLeaderboard(selectedEvent.id);
                                                                            } catch (e: any) {
                                                                                toast.error(e.response?.data?.detail || '삭제에 실패했습니다.');
                                                                            }
                                                                        }}
                                                                        style={{ padding: '8px 12px', backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #DC2626', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                    >
                                                                        <Trash2 size={14} /> 삭제
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={styles.emptyState}>
                                            <p style={styles.emptyText}>이벤트를 선택해주세요.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 설정 모달 */}
            <CompSettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                competition={competitions.find(c => c.id === selectedComp?.id) || null}
                onUpdate={loadCompetitions}
            />

            {/* 종목 추가 모달 */}
            {showAddEventModal && (
                <div style={styles.modalOverlay}>
                    <div style={{ ...styles.modalContent, padding: isMobileMode ? '24px' : '40px', maxWidth: isMobileMode ? '560px' : '440px' }}>
                        <div style={{ ...styles.modalHeader, marginBottom: isMobileMode ? '24px' : '32px' }}>
                            <h2 style={{ ...styles.modalTitle, fontSize: isMobileMode ? '20px' : '24px' }}>새로운 종목 추가</h2>
                            <button onClick={() => setShowAddEventModal(false)} style={styles.modalClose}><X size={24} /></button>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>종목 이름</label>
                            <input placeholder="예: Snatch 1RM" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} style={styles.input} />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>종목 설명</label>
                            <textarea placeholder="측정 방식 및 룰을 입력해주세요" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} style={styles.textarea} />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>채점 방식</label>
                            <select value={newEventScoreType} onChange={e => setNewEventScoreType(e.target.value)} style={styles.select}>
                                <option value="time">⏱️ For Time (타임캡)</option>
                                <option value="reps">🔄 AMRAP (최다 횟수)</option>
                                <option value="weight">🏋️ 무게 (Weight)</option>
                            </select>
                        </div>
                        {/* ✅ [수정] For Time 타임캡 입력 */}
                        {newEventScoreType === 'time' && (
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={styles.label}>⏱️ 타임캡 분 (선택)</label>
                                    <input type="number" placeholder="분" value={newTimeCapMin} onChange={e => setNewTimeCapMin(e.target.value)} style={styles.input} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={styles.label}>초</label>
                                    <input type="number" placeholder="초" value={newTimeCapSec} onChange={e => setNewTimeCapSec(e.target.value)} style={styles.input} />
                                </div>
                            </div>
                        )}
                        {/* ✅ [수정] AMRAP 운동 시간 및 최대 렙수 입력 */}
                        {newEventScoreType === 'reps' && (
                            <>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>⏱️ 운동 시간 (분) *필수</label>
                                    <input type="number" placeholder="예: 20 (AMRAP 20분)" value={newEventTimeLimit} onChange={e => setNewEventTimeLimit(e.target.value)} style={styles.input} />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>🔄 최대 렙수 제한 (선택)</label>
                                    <input type="number" placeholder="제한이 없으시면 비워두세요" value={newMaxReps} onChange={e => setNewMaxReps(e.target.value)} style={styles.input} />
                                </div>
                            </>
                        )}
                        <button onClick={handleAddEvent} style={{ ...styles.submitBtn, width: '100%' }}>종목 만들기</button>
                    </div>
                </div>
            )}

            {/* 종목 수정 모달 */}
            {
                showEditEventModal && (
                    <div style={styles.modalOverlay}>
                        <div style={{ ...styles.modalContent, padding: isMobileMode ? '24px' : '40px', maxWidth: isMobileMode ? '560px' : '440px' }}>
                            <div style={{ ...styles.modalHeader, marginBottom: isMobileMode ? '24px' : '32px' }}>
                                <h3 style={{ ...styles.modalTitle, fontSize: isMobileMode ? '20px' : '24px' }}>종목 수정</h3>
                                <button onClick={() => setShowEditEventModal(false)} style={styles.modalClose}><X size={24} /></button>
                            </div>
                            <form onSubmit={handleUpdateEvent} style={styles.form}>
                                <div style={styles.formGroup}><label style={styles.label}>종목명</label><input value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} style={styles.input} /></div>
                                <div style={styles.formGroup}><label style={styles.label}>설명</label><textarea value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} style={styles.textarea} /></div>
                                <div style={styles.formGroup}><label style={styles.label}>채점 방식</label><select value={newEventScoreType} onChange={e => setNewEventScoreType(e.target.value)} style={styles.select}><option value="time">⏱️ For Time (타임캡)</option><option value="reps">🔄 AMRAP (최다 횟수)</option><option value="weight">🏋️ 무게 (Weight)</option></select></div>
                                {/* ✅ [수정] For Time 타임캡 입력 */}
                                {newEventScoreType === 'time' && (
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={styles.label}>⏱️ 타임캡 분 (선택)</label>
                                            <input type="number" placeholder="분" value={newTimeCapMin} onChange={e => setNewTimeCapMin(e.target.value)} style={styles.input} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={styles.label}>초</label>
                                            <input type="number" placeholder="초" value={newTimeCapSec} onChange={e => setNewTimeCapSec(e.target.value)} style={styles.input} />
                                        </div>
                                    </div>
                                )}
                                {/* ✅ [수정] AMRAP 운동 시간 및 최대 렙수 입력 */}
                                {newEventScoreType === 'reps' && (
                                    <>
                                        <div style={styles.formGroup}>
                                            <label style={styles.label}>⏱️ 운동 시간 (분) *필수</label>
                                            <input type="number" placeholder="예: 20 (AMRAP 20분)" value={newEventTimeLimit} onChange={e => setNewEventTimeLimit(e.target.value)} style={styles.input} />
                                        </div>
                                        <div style={styles.formGroup}>
                                            <label style={styles.label}>🔄 최대 렙수 제한 (선택)</label>
                                            <input type="number" placeholder="제한이 없으시면 비워두세요" value={newMaxReps} onChange={e => setNewMaxReps(e.target.value)} style={styles.input} />
                                        </div>
                                    </>
                                )}
                                <button type="submit" style={styles.submitBtn}>수정 완료</button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* 기록 입력 모달 */}
            {showInputModal && selectedEvent && (
                <div style={styles.modalOverlay}>
                    <div style={{ ...styles.modalContent, padding: isMobileMode ? '24px' : '40px', maxWidth: isMobileMode ? '560px' : '440px', maxHeight: isMobileMode ? '100%' : '90vh' }}>
                        <div style={{ ...styles.modalHeader, marginBottom: isMobileMode ? '24px' : '32px' }}>
                            <h2 style={{ ...styles.modalTitle, fontSize: isMobileMode ? '20px' : '24px' }}>{isEditMode ? '기록 수정' : '기록 입력'}</h2>
                            <button onClick={() => setShowInputModal(false)} style={styles.modalClose}><X size={24} /></button>
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

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    {selectedEvent.score_type === 'time'
                                        ? (isFinished ? '완주 기록' : '완료 렙수 (Reps)')
                                        : `메인 기록 (${getUnitLabel(selectedEvent.score_type)})`}
                                </label>

                                {selectedEvent.score_type === 'time' && isFinished ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
                                            <input type="number" min="0" max="99" placeholder="분" value={scoreMin} onChange={e => setScoreMin(e.target.value)} style={{ ...styles.timeInput, textAlign: 'center' as const }} />
                                            <span style={{ textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>분</span>
                                        </div>
                                        <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', paddingBottom: '18px' }}>:</span>
                                        <div style={{ display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
                                            <input type="number" min="0" max="59" placeholder="초" value={scoreSec} onChange={e => setScoreSec(e.target.value)} style={{ ...styles.timeInput, textAlign: 'center' as const }} />
                                            <span style={{ textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>초</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input type="number" min="0" placeholder={selectedEvent.score_type === 'time' ? '렙 수 입력' : '기록 입력'} value={scoreReps} onChange={e => setScoreReps(e.target.value)} style={{ ...styles.timeInput, flex: 1 }} />
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', minWidth: '36px' }}>
                                            {selectedEvent.score_type === 'time' ? 'reps' : getUnitLabel(selectedEvent.score_type)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>Tie Break (선택)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
                                        <input type="number" min="0" max="99" placeholder="분" value={tbMin} onChange={e => setTbMin(e.target.value)} style={{ ...styles.timeInput, textAlign: 'center' as const }} />
                                        <span style={{ textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>분</span>
                                    </div>
                                    <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', paddingBottom: '18px' }}>:</span>
                                    <div style={{ display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
                                        <input type="number" min="0" max="59" placeholder="초" value={tbSec} onChange={e => setTbSec(e.target.value)} style={{ ...styles.timeInput, textAlign: 'center' as const }} />
                                        <span style={{ textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>초</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ ...styles.rxRow, gap: isMobileMode ? '8px' : '12px', padding: isMobileMode ? '12px' : '16px', flexWrap: 'wrap' as const }}>
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

                            <input placeholder="메모를 남겨주세요 (선택)" value={note} onChange={e => setNote(e.target.value)} style={{ ...styles.input, padding: isMobileMode ? '14px' : '16px' }} />
                            <button type="submit" style={{ ...styles.submitBtn, padding: isMobileMode ? '16px' : '18px', fontSize: isMobileMode ? '16px' : '18px' }}>{isEditMode ? '수정 완료' : '기록 제출하기'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* ✅ [신규] 일괄 등록 (Bulk Entry) 모달 */}
            {isBulkModalOpen && selectedEvent && (
                <div style={styles.overlay} onClick={(e) => {
                    if (e.target === e.currentTarget) setIsBulkModalOpen(false);
                }}>
                    <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', width: '90%', maxWidth: '1000px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
                                📋 {selectedEvent.title} - 기록 일괄 등록
                            </h3>
                            <button onClick={() => setIsBulkModalOpen(false)} style={styles.iconBtn}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            이름과 기록을 차례대로 입력하세요. 시간 입력 시 <code>1230</code> 이라고 치면 <code>12:30</code> 으로 자동 변환됩니다. <br />
                            마지막 칸에서 <code>Tab</code> 키를 누르면 다음 행으로 이동하며, 모자라면 아래 <b>[+ 행 추가]</b> 버튼을 누르세요.
                        </p>

                        <form onSubmit={handleBulkSubmit}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                                    <thead style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                        <tr>
                                            <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)' }}>이름</th>
                                            <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)', width: '70px' }}>성별</th>
                                            {selectedEvent.score_type === 'time' && <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)', width: '80px', textAlign: 'center' }}>미완주<br />(TimeCap)</th>}
                                            <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)', width: '120px' }}>기록 ({selectedEvent.score_type})</th>
                                            <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)', width: '120px' }}>타이브레이크</th>
                                            <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)', width: '130px' }}>Rx/Scale</th>
                                            <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)', width: '180px' }}>비고</th>
                                            <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)', width: '60px', textAlign: 'center' }}>삭제</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulkRows.map((row, index) => (
                                            <tr key={row.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                <td style={{ padding: '8px' }}>
                                                    <input
                                                        style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                        placeholder="이름"
                                                        value={row.guest_name}
                                                        onChange={e => handleBulkRowChange(row.id, 'guest_name', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px' }}>
                                                    <select
                                                        style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                        value={row.guest_gender}
                                                        onChange={e => handleBulkRowChange(row.id, 'guest_gender', e.target.value)}
                                                    >
                                                        <option value="M">남</option>
                                                        <option value="F">여</option>
                                                    </select>
                                                </td>
                                                {selectedEvent.score_type === 'time' && (
                                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={row.is_time_cap}
                                                            onChange={e => handleBulkRowChange(row.id, 'is_time_cap', e.target.checked)}
                                                            style={{ transform: 'scale(1.3)' }}
                                                        />
                                                    </td>
                                                )}
                                                <td style={{ padding: '8px' }}>
                                                    <input
                                                        style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                        placeholder={selectedEvent.score_type === 'time' ? (row.is_time_cap ? 'Reps' : '분:초') : '기록'}
                                                        value={row.score_value}
                                                        onChange={e => handleBulkRowChange(row.id, 'score_value', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px' }}>
                                                    <input
                                                        style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                        placeholder="타브"
                                                        value={row.tie_break}
                                                        onChange={e => handleBulkRowChange(row.id, 'tie_break', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px' }}>
                                                    <select
                                                        style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                        value={row.is_rx ? 'rx' : row.scale_rank || 'A'}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            if (val === 'rx') {
                                                                handleBulkRowChange(row.id, 'is_rx', true);
                                                                handleBulkRowChange(row.id, 'scale_rank', null);
                                                            } else {
                                                                handleBulkRowChange(row.id, 'is_rx', false);
                                                                handleBulkRowChange(row.id, 'scale_rank', val);
                                                            }
                                                        }}
                                                    >
                                                        <option value="rx">Rx'd</option>
                                                        <option value="A">Scale A</option>
                                                        <option value="B">Scale B</option>
                                                        <option value="C">Scale C</option>
                                                    </select>
                                                </td>
                                                <td style={{ padding: '8px' }}>
                                                    <input
                                                        style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                        placeholder="메모"
                                                        value={row.note}
                                                        onChange={e => handleBulkRowChange(row.id, 'note', e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Tab' && !e.shiftKey && index === bulkRows.length - 1) {
                                                                e.preventDefault();
                                                                handleAddBulkRow();
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                                    <button type="button" onClick={() => handleRemoveBulkRow(row.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '8px' }}>
                                                        <Trash2 size={18} color="#EF4444" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                                <button type="button" onClick={handleAddBulkRow} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 20px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                    <Plus size={16} /> 행 추가하기
                                </button>

                                <button type="submit" disabled={loading} style={{ padding: '14px 28px', backgroundColor: '#3182f6', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', transition: '0.2s' }}>
                                    {loading ? '처리 중...' : '기록 모두 저장'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ✅ [신규] 코치 일괄 입력 - 동명이인 알림 다이얼로그 */}
            {showBulkDuplicateDialog && bulkDuplicates.length > 0 && (
                <div style={styles.modalOverlay}>
                    <div style={{ ...styles.modalContent, maxWidth: '560px' }}>
                        <div style={{ ...styles.modalHeader, marginBottom: '24px' }}>
                            <h3 style={{ ...styles.modalTitle, fontSize: '20px', margin: 0 }}>
                                동명이인 발견
                            </h3>
                            <button
                                onClick={() => setShowBulkDuplicateDialog(false)}
                                style={styles.modalClose}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            다음 항목들에서 동명이인이 발견되었습니다. 각 항목을 확인하고 처리해주세요.
                        </p>

                        <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                            {bulkDuplicates.map((dup, idx) => (
                                <div key={idx} style={{ padding: '16px', borderBottom: idx < bulkDuplicates.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                        {idx + 1}행: {dup.guest_name}
                                    </p>
                                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                                        {dup.duplicates.map((d: any, didx: number) => (
                                            <p key={didx} style={{ margin: '4px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                • {d.masked_phone} - {d.name}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', padding: '12px', borderRadius: '12px', marginBottom: '20px' }}>
                            <p style={{ margin: 0, fontSize: '13px', color: '#78350F', fontWeight: '600' }}>
                                💡 안내: 동명이인이 있는 항목은 성명 뒤에 'B'를 붙여서 새로운 기록으로 등록하면 됩니다. 예: "김철수" → "김철수B"
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => {
                                    setShowBulkDuplicateDialog(false);
                                    setIsBulkModalOpen(true); // 다시 입력 폼으로 돌아가기
                                }}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    backgroundColor: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    fontSize: '15px',
                                    cursor: 'pointer'
                                }}
                            >
                                다시 수정하기
                            </button>
                            <button
                                onClick={() => setShowBulkDuplicateDialog(false)}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    backgroundColor: TOSS_BLUE,
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    fontSize: '15px',
                                    cursor: 'pointer'
                                }}
                            >
                                확인했습니다
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ [수정] 코치 기록 수정 모달 */}
            {showCoachSubmitModal && coachSubmitTarget && selectedEvent && (
                <div style={styles.modalOverlay}>
                    <div style={{ ...styles.modalContent, padding: isMobileMode ? '24px' : '36px', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ ...styles.modalHeader, marginBottom: '24px' }}>
                            <h3 style={{ ...styles.modalTitle, fontSize: '20px' }}>
                                {coachSubmitTarget.score ? '기록 수정' : '기록 입력'}
                                <span style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: 'normal', marginLeft: '8px' }}>{coachSubmitTarget.member_name}</span>
                            </h3>
                            <button onClick={() => setShowCoachSubmitModal(false)} style={styles.modalClose}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCoachSubmit} style={styles.form}>
                            {/* 게스트인 경우 이름 수정 가능 */}
                            {coachSubmitTarget.is_guest && (
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>이름</label>
                                    <input value={coachGuestName} onChange={e => setCoachGuestName(e.target.value)} style={styles.input} />
                                </div>
                            )}

                            {/* Rx / Scale */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                {['RX', 'Scale A', 'Scale B', 'Scale C'].map(opt => {
                                    const isRxOpt = opt === 'RX';
                                    const scaleVal = isRxOpt ? null : opt.split(' ')[1];
                                    const isActive = isRxOpt ? coachIsRx : (!coachIsRx && coachScaleRank === scaleVal);
                                    return (
                                        <button key={opt} type="button" onClick={() => { setCoachIsRx(isRxOpt); setCoachScaleRank(isRxOpt ? null : scaleVal); }}
                                            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `2px solid ${isActive ? '#3182F6' : 'var(--border-color)'}`, backgroundColor: isActive ? '#EFF6FF' : 'var(--bg-card)', color: isActive ? '#3182F6' : 'var(--text-secondary)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 기록 입력 */}
                            {selectedEvent.score_type === 'time' ? (
                                <>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', backgroundColor: coachIsTimeCap ? '#FEF2F2' : 'var(--primary-bg)', borderRadius: '12px', cursor: 'pointer', border: `2px solid ${coachIsTimeCap ? '#EF4444' : 'var(--primary)'}`, userSelect: 'none' as const }}>
                                        <input type="checkbox" checked={!coachIsTimeCap} onChange={e => setCoachIsTimeCap(!e.target.checked)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: coachIsTimeCap ? '#EF4444' : 'var(--primary)' }}>
                                            {coachIsTimeCap ? '타임캡 (미완주)' : '완주 (Finished)'}
                                        </span>
                                    </label>
                                    {!coachIsTimeCap ? (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input type="number" min="0" max="99" placeholder="분" value={coachScoreMin} onChange={e => setCoachScoreMin(e.target.value)} style={{ ...styles.input, textAlign: 'center' as const }} />
                                            <span style={{ fontWeight: '700' }}>:</span>
                                            <input type="number" min="0" max="59" placeholder="초" value={coachScoreSec} onChange={e => setCoachScoreSec(e.target.value)} style={{ ...styles.input, textAlign: 'center' as const }} />
                                        </div>
                                    ) : (
                                        <input type="number" placeholder="렙수" value={coachScoreValue} onChange={e => setCoachScoreValue(e.target.value)} style={styles.input} />
                                    )}
                                </>
                            ) : (
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>기록 ({selectedEvent.score_type === 'weight' ? 'kg' : 'reps'})</label>
                                    <input type="number" value={coachScoreValue} onChange={e => setCoachScoreValue(e.target.value)} style={styles.input} />
                                </div>
                            )}

                            {/* 타이브레이크 (분:초 입력) */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>타이브레이크 (선택)</label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input type="number" min="0" max="99" placeholder="분" value={coachTieBreakMin} onChange={e => setCoachTieBreakMin(e.target.value)} style={{ ...styles.input, textAlign: 'center' as const }} />
                                    <span style={{ fontWeight: '700', flexShrink: 0 }}>:</span>
                                    <input type="number" min="0" max="59" placeholder="초" value={coachTieBreakSec} onChange={e => setCoachTieBreakSec(e.target.value)} style={{ ...styles.input, textAlign: 'center' as const }} />
                                </div>
                            </div>

                            {/* 메모 */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>메모 (선택)</label>
                                <input value={coachNote} onChange={e => setCoachNote(e.target.value)} style={styles.input} />
                            </div>

                            <button type="submit" disabled={loading} style={{ ...styles.submitBtn, marginTop: '8px' }}>
                                {loading ? '저장 중...' : '저장'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { maxWidth: '100%', padding: '0 24px 100px', backgroundColor: 'var(--bg-card)', minHeight: '100vh', fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif' },
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' },
    spinner: { width: '40px', height: '40px', border: '4px solid var(--border-color)', borderTop: `4px solid ${TOSS_BLUE}`, borderRadius: '50%', animation: 'spin 1s linear infinite' },

    // List
    listContainer: { paddingTop: '24px', maxWidth: '1200px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
    title: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },
    addBtn: { width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none', borderRadius: '16px', cursor: 'pointer', transition: 'background 0.2s' },
    iconBtn: { padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' },

    formCard: { backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '32px', marginBottom: '32px' },
    formTitle: { fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 20px 0' },
    form: { display: 'flex', flexDirection: 'column' as const, gap: '16px' },
    dateRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    dateGroup: { display: 'flex', flexDirection: 'column' as const, gap: '8px' },
    dateLabel: { fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)' },
    input: { width: '100%', padding: '16px', fontSize: '15px', border: '1px solid var(--border-color)', borderRadius: '16px', boxSizing: 'border-box' as const, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' },
    textarea: { width: '100%', padding: '16px', fontSize: '15px', border: '1px solid var(--border-color)', borderRadius: '16px', minHeight: '120px', resize: 'vertical' as const, boxSizing: 'border-box' as const, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' },
    select: { width: '100%', padding: '16px', fontSize: '15px', border: '1px solid var(--border-color)', borderRadius: '16px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' },
    submitBtn: { padding: '18px', fontSize: '16px', fontWeight: '700', color: '#FFFFFF', backgroundColor: TOSS_BLUE, border: 'none', borderRadius: '16px', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)' },

    compList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' },
    compCard: { padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    compCardContent: { flex: 1 },
    compTitle: { fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 8px 0' },
    compDesc: { fontSize: '15px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    compDate: { fontSize: '13px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' },
    arrowBox: { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '50%', color: 'var(--text-tertiary)' },

    emptyState: { textAlign: 'center' as const, padding: '100px 20px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '20px' },
    emptyIconBox: { width: '80px', height: '80px', borderRadius: '30px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: '16px', color: 'var(--text-tertiary)', margin: 0 },

    // Detail Grid
    detailContainer: { paddingTop: '24px', maxWidth: '1300px', margin: '0 auto' },
    detailGrid: { display: 'grid', gridTemplateColumns: '360px 1fr', gap: '40px', alignItems: 'start' },
    leftSide: { position: 'sticky' as const, top: '24px', display: 'flex', flexDirection: 'column' as const, gap: '24px' },
    rightSide: { minWidth: 0 },

    compInfoCard: { backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid var(--border-color)' },
    backBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '15px', fontWeight: '600', cursor: 'pointer', padding: 0 },
    detailTitle: { fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 16px 0', lineHeight: 1.3 },
    detailDesc: { fontSize: '16px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 },
    statusRow: { marginTop: '24px' },

    registerBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' },
    statusBadge: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', borderRadius: '16px', fontSize: '16px', fontWeight: '700' },

    // Participants
    participantSection: { borderRadius: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' },
    participantHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', backgroundColor: 'var(--bg-card)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' },
    participantInfo: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' },
    countBadge: { color: 'var(--text-tertiary)', fontSize: '14px', fontWeight: '500' },
    participantList: { padding: '12px 0', maxHeight: '400px', overflowY: 'auto' as const },
    participantItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px' },
    participantName: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' },
    participantActions: { display: 'flex', alignItems: 'center', gap: '8px' },
    statusTag: { padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' },
    emptyListText: { padding: '32px', textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: '14px' },

    adminBtns: { display: 'flex', gap: '8px' },
    approveBtn: { padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#ECFDF5', color: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
    rejectBtn: { padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },

    // Tabs
    tabContainer: { display: 'flex', gap: '12px', marginBottom: '24px' },
    tab: { flex: 1, padding: '16px', fontSize: '16px', fontWeight: '600', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s' },
    tabActive: { flex: 1, padding: '16px', fontSize: '16px', fontWeight: '700', color: '#FFFFFF', backgroundColor: TOSS_BLUE, border: `1px solid ${TOSS_BLUE}`, borderRadius: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(49, 130, 246, 0.25)' },

    // Events
    eventsSection: {},
    eventList: { display: 'flex', gap: '16px', overflowX: 'auto' as const, marginBottom: '24px', paddingBottom: '4px', paddingTop: '10px', scrollbarWidth: 'none' as const },
    eventCard: { minWidth: '160px', padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: '20px', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.2s', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' },
    eventCardActive: { minWidth: '160px', padding: '20px', backgroundColor: 'var(--primary-bg)', borderRadius: '20px', cursor: 'pointer', border: `1px solid ${TOSS_BLUE}`, boxShadow: '0 4px 16px rgba(49, 130, 246, 0.15)', transform: 'translateY(-2px)' },
    eventNum: { fontSize: '13px', fontWeight: '800', color: TOSS_BLUE, display: 'block', marginBottom: '6px' },
    eventName: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
    addEventBtn: { minWidth: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', cursor: 'pointer', border: 'none', fontSize: '14px', color: 'var(--text-tertiary)', fontWeight: '600' },

    eventDetail: { backgroundColor: 'var(--bg-card)', padding: '40px', borderRadius: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', border: '1px solid var(--border-color)' },
    eventDetailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    eventDetailTitle: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },
    eventActions: { display: 'flex', gap: '8px' },
    editBtn: { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)', border: 'none', borderRadius: '12px', cursor: 'pointer' },
    deleteBtn: { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: 'none', borderRadius: '12px', cursor: 'pointer' },
    eventDesc: { fontSize: '16px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '20px', whiteSpace: 'pre-wrap' as const, lineHeight: '1.6', marginBottom: '32px', border: '1px solid var(--border-color)' },
    recordBtn: { width: '100%', padding: '18px', fontSize: '18px', fontWeight: '700', color: '#FFFFFF', backgroundColor: TOSS_BLUE, border: 'none', borderRadius: '20px', cursor: 'pointer', marginBottom: '32px', boxShadow: '0 8px 20px rgba(49, 130, 246, 0.25)', transition: 'transform 0.1s' },

    myRankCard: { marginBottom: '24px' },
    myRankContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg, ${TOSS_BLUE} 0%, #5E9EFF 100%)`, color: '#FFFFFF', padding: '32px', borderRadius: '24px', boxShadow: '0 8px 24px rgba(49, 130, 246, 0.25)', border: '1px solid rgba(255,255,255,0.1)' },
    myRankLeft: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
    myRankLabel: { fontSize: '14px', opacity: 0.9, fontWeight: '600' },
    myRankValue: { fontSize: '32px', fontWeight: '800' },
    myRankTotal: { fontSize: '18px', opacity: 0.8, fontWeight: '500' },
    myRankRight: { textAlign: 'right' as const },
    myRankScore: { display: 'block', fontSize: '24px', fontWeight: '700', marginBottom: '10px' },
    percentBadge: { padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF', borderRadius: '14px', fontSize: '14px', fontWeight: '700', backdropFilter: 'blur(4px)' },

    leaderboard: { display: 'flex', flexDirection: 'column' as const, gap: '10px' },
    leaderboardItem: { display: 'flex', alignItems: 'center', padding: '16px 20px', borderRadius: '16px' },
    leaderboardRank: { width: '48px' },
    leaderboardName: { flex: 1, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' },
    leaderboardScore: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'right' as const },
    scoreText: { marginRight: '6px' },
    rxTag: { fontSize: '12px', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border-color)' },
    rankBadge: { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', fontSize: '16px', fontWeight: '700' },
    meTag: { padding: '2px 6px', backgroundColor: '#10B981', color: '#FFFFFF', borderRadius: '6px', fontSize: '11px', fontWeight: '700' },
    gymTag: { marginLeft: '6px', fontSize: '11px', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }, // ✅ [신규]

    emptySelection: { textAlign: 'center' as const, padding: '80px 20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '24px' },

    // Overall
    overallSection: {},
    liveIndicator: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'var(--danger-bg)', borderRadius: '12px', fontSize: '14px', fontWeight: '600', color: 'var(--danger)', marginBottom: '24px', width: 'fit-content' as const },
    liveDot: { width: '8px', height: '8px', backgroundColor: 'var(--danger)', borderRadius: '50%' },
    overallList: { display: 'flex', flexDirection: 'column' as const, gap: '10px' },
    overallItem: { display: 'flex', alignItems: 'center', padding: '16px 20px', borderRadius: '16px' },
    overallRank: { width: '48px' },
    overallInfo: { flex: 1 },
    overallName: { display: 'block', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' },
    overallEvents: { display: 'flex', gap: '6px' },
    eventPoint: { fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '500' },
    overallTotal: { fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' },
    ruleText: { fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center' as const, marginTop: '32px' },

    // Modal
    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px', backdropFilter: 'blur(4px)' },
    modalContent: { backgroundColor: 'var(--bg-card)', borderRadius: '32px', padding: '40px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.1)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
    modalTitle: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },
    modalClose: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' },
    formGroup: { marginBottom: '20px' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    label: { display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' },

    // Score Input
    tabRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' },

    timeInput: { width: '100%', padding: '16px', fontSize: '22px', fontWeight: '700', border: '2px solid var(--border-color)', borderRadius: '16px', boxSizing: 'border-box' as const, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', textAlign: 'center' as const, fontFamily: 'monospace', letterSpacing: '2px', transition: 'border-color 0.15s' },

    rxRow: { display: 'flex', justifyContent: 'center', gap: '32px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', marginBottom: '24px' },
    scaleBtn: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const },
    radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '600', color: '#333D4B', cursor: 'pointer' },
};

export default CompetitionPage;
