import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Calendar, Clock, Users, ChevronLeft, ChevronRight, Plus, Trash2, X, Settings, List, CheckCircle, Repeat } from 'lucide-react';
import { getClassSchedules, createClassSchedule, getClassReservations, getClassTemplates, createClassTemplate, deleteClassTemplate } from '../../services/api';

const TOSS_BLUE = '#3182F6';
const TOSS_RED = '#EF4444';

interface ClassSchedule { id: number; title: string; date: string; time: string; max_participants: number; status: string; current_participants: number; }
interface Reservation { id: number; member_name: string; status: string; created_at: string; }
interface ClassTemplate { id: number; title: string; time: string; max_participants: number; days_of_week: string; }

const CoachSchedulePage: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [newTitle, setNewTitle] = useState("Group PT");
    const [newTime, setNewTime] = useState("10:00");
    const [newMax, setNewMax] = useState(20);

    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templates, setTemplates] = useState<ClassTemplate[]>([]);
    const [tmplTitle, setTmplTitle] = useState("Daily WOD");
    const [tmplTime, setTmplTime] = useState("19:00");
    const [tmplMax, setTmplMax] = useState(20);
    const [selectedDays, setSelectedDays] = useState<number[]>([]);

    const [selectedStatsClass, setSelectedStatsClass] = useState<number | null>(null);
    const [participants, setParticipants] = useState<Reservation[]>([]);

    const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

    useEffect(() => { fetchSchedules(); }, [selectedDate]);

    const fetchSchedules = async () => {
        setLoading(true);
        try { const res = await getClassSchedules(format(selectedDate, 'yyyy-MM-dd')); setSchedules(res.data); }
        catch (error) { toast.error('불러오기 실패'); }
        finally { setLoading(false); }
    };

    const fetchTemplates = async () => {
        try { const res = await getClassTemplates(); setTemplates(res.data); }
        catch (error) { console.error(error); }
    };

    const handleCreateClass = async () => {
        try {
            await createClassSchedule({ title: newTitle, date: format(selectedDate, 'yyyy-MM-dd'), time: newTime, max_participants: newMax });
            toast.success('수업이 생성되었습니다.');
            setShowModal(false); fetchSchedules();
        } catch (error) { toast.error('생성 실패'); }
    };

    const handleViewParticipants = async (classId: number) => {
        if (selectedStatsClass === classId) { setSelectedStatsClass(null); return; }
        try { const res = await getClassReservations(classId); setParticipants(res.data); setSelectedStatsClass(classId); }
        catch (error) { toast.error('참여자 목록 불러오기 실패'); }
    };

    const changeDate = (days: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
        setSelectedStatsClass(null);
    };

    const toggleDay = (day: number) => {
        if (selectedDays.includes(day)) { setSelectedDays(selectedDays.filter(d => d !== day)); }
        else { setSelectedDays([...selectedDays, day].sort()); }
    };

    const handleCreateTemplate = async () => {
        if (selectedDays.length === 0) { toast.error('요일을 선택해주세요.'); return; }
        try {
            await createClassTemplate({ title: tmplTitle, time: tmplTime, max_participants: tmplMax, days_of_week: selectedDays.join(',') });
            toast.success('고정 스케줄이 추가되었습니다.');
            setTmplTitle("Daily WOD"); setTmplTime("19:00"); setTmplMax(20); setSelectedDays([]);
            fetchTemplates();
        } catch (error: any) { toast.error(error.response?.data?.detail || '템플릿 생성 실패'); }
    };

    const handleDeleteTemplate = async (id: number) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;
        try { await deleteClassTemplate(id); toast.success('삭제되었습니다.'); fetchTemplates(); }
        catch (error) { toast.error('삭제 실패'); }
    };

    const openTemplateModal = () => { fetchTemplates(); setShowTemplateModal(true); };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.pageTitle}>수업 관리</h1>
                    <p style={styles.subtitle}>오늘의 수업 스케줄을 관리합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={openTemplateModal} style={styles.secondaryBtn}><Repeat size={16} /> 고정 스케줄</button>
                    <button onClick={() => setShowModal(true)} style={styles.primaryBtn}><Plus size={16} /> 수업 추가</button>
                </div>
            </div>

            {/* Date Nav */}
            <div style={styles.dateNavCard}>
                <button onClick={() => changeDate(-1)} style={styles.navBtn}><ChevronLeft size={24} /></button>
                <div style={styles.dateInfo}>
                    <div style={styles.dateMain}>{selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일</div>
                    <div style={styles.dateSub}>{selectedDate.toLocaleDateString('ko-KR', { weekday: 'long' })}</div>
                </div>
                <button onClick={() => changeDate(1)} style={styles.navBtn}><ChevronRight size={24} /></button>
            </div>

            {/* Schedule List */}
            <div style={styles.listContainer}>
                {loading ? <div style={styles.loading}>로딩 중...</div> :
                    schedules.length === 0 ? (
                        <div style={styles.emptyState}>
                            <div style={styles.emptyIcon}><Calendar size={32} color="#ADB5BD" /></div>
                            <p style={styles.emptyText}>등록된 수업이 없습니다.</p>
                        </div>
                    ) : (
                        schedules.map((item) => (
                            <div key={item.id} style={styles.card}>
                                <div style={styles.cardHeader} onClick={() => handleViewParticipants(item.id)}>
                                    <div style={styles.cardLeft}>
                                        <div style={styles.timeTag}>{item.time}</div>
                                        <div style={styles.cardContent}>
                                            <div style={styles.classTitle}>{item.title}</div>
                                            <div style={styles.metaRow}>
                                                <Users size={14} color="#6B7280" />
                                                <span style={styles.metaText}>정원 {item.max_participants}명</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={styles.cardRight}>
                                        <div style={{ ...styles.participantBadge, color: item.current_participants > 0 ? TOSS_BLUE : '#ADB5BD' }}>
                                            <span style={styles.participantCount}>{item.current_participants}</span>명 신청
                                        </div>
                                        <ChevronRight size={20} color="#B0B8C1" style={{ transform: selectedStatsClass === item.id ? 'rotate(90deg)' : 'none', transition: 'all 0.2s' }} />
                                    </div>
                                </div>

                                {selectedStatsClass === item.id && (
                                    <div style={styles.detailPanel}>
                                        <div style={styles.detailHeader}>
                                            <List size={16} color="#6B7280" />
                                            <span style={styles.detailTitle}>예약자 명단</span>
                                        </div>
                                        {participants.length === 0 ? (
                                            <div style={styles.emptyDetail}>아직 신청한 회원이 없습니다.</div>
                                        ) : (
                                            <div style={styles.userGrid}>
                                                {participants.map((p) => (
                                                    <div key={p.id} style={styles.userTag}>
                                                        <div style={styles.userAvatar}><Users size={12} color="#FFFFFF" /></div>
                                                        {p.member_name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
            </div>

            {/* Create Class Modal */}
            {showModal && (
                <div style={styles.overlay}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div style={styles.headerTitleBox}>
                                <div style={styles.iconBox}><Clock size={24} color="#FFFFFF" /></div>
                                <h3 style={styles.modalTitle}>새 수업 개설</h3>
                            </div>
                            <button onClick={() => setShowModal(false)} style={styles.closeBtn}><X size={24} /></button>
                        </div>
                        <div style={styles.modalBody}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>수업명</label>
                                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={styles.input} placeholder="예: Group PT" />
                            </div>
                            <div style={styles.row}>
                                <div style={{ flex: 1 }}>
                                    <label style={styles.label}>시간</label>
                                    <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={styles.input} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={styles.label}>정원</label>
                                    <input type="number" value={newMax} onChange={e => setNewMax(Number(e.target.value))} style={styles.input} />
                                </div>
                            </div>
                            <button onClick={handleCreateClass} style={styles.submitBtn}>수업 만들기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Modal */}
            {showTemplateModal && (
                <div style={styles.overlay}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div style={styles.headerTitleBox}>
                                <div style={{ ...styles.iconBox, backgroundColor: '#6B7280' }}><Settings size={24} color="#FFFFFF" /></div>
                                <h3 style={styles.modalTitle}>고정 스케줄 관리</h3>
                            </div>
                            <button onClick={() => setShowTemplateModal(false)} style={styles.closeBtn}><X size={24} /></button>
                        </div>

                        <div style={styles.modalScroll}>
                            <div style={styles.templateForm}>
                                <h4 style={styles.sectionTitle}>새 스케줄 추가</h4>
                                <div style={styles.formGroup}>
                                    <input type="text" placeholder="수업명" value={tmplTitle} onChange={e => setTmplTitle(e.target.value)} style={styles.input} />
                                </div>
                                <div style={styles.row}>
                                    <input type="time" value={tmplTime} onChange={e => setTmplTime(e.target.value)} style={styles.input} />
                                    <input type="number" placeholder="정원" value={tmplMax} onChange={e => setTmplMax(Number(e.target.value))} style={styles.input} />
                                </div>
                                <div style={{ marginTop: '12px' }}>
                                    <label style={styles.label}>반복 요일</label>
                                    <div style={styles.dayRow}>
                                        {dayLabels.map((day, idx) => (
                                            <button key={idx} onClick={() => toggleDay(idx)} style={selectedDays.includes(idx) ? styles.dayActive : styles.dayInactive}>{day}</button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={handleCreateTemplate} style={styles.addBtn}>스케줄 추가</button>
                            </div>

                            <div style={styles.listSection}>
                                <h4 style={styles.sectionTitle}>등록된 스케줄 ({templates.length})</h4>
                                <div style={styles.templateList}>
                                    {templates.length === 0 ? <div style={styles.emptyDetail}>등록된 스케줄이 없습니다</div> :
                                        templates.map((tmpl) => (
                                            <div key={tmpl.id} style={styles.templateItem}>
                                                <div>
                                                    <div style={styles.tmplTitle}>{tmpl.title}</div>
                                                    <div style={styles.tmplMeta}>{tmpl.time} / {tmpl.max_participants}명</div>
                                                    <div style={styles.tmplDays}>
                                                        {tmpl.days_of_week.split(',').map(d => dayLabels[Number(d)]).join(', ')}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteTemplate(tmpl.id)} style={styles.iconBtn}><Trash2 size={16} /></button>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { maxWidth: '100%', padding: '32px 24px 100px', backgroundColor: 'var(--bg-main)', minHeight: '100vh', boxSizing: 'border-box', transition: 'background-color 0.3s' },

    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
    pageTitle: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },
    subtitle: { fontSize: '15px', color: 'var(--text-secondary)', marginTop: '6px' },

    primaryBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', border: 'none', borderRadius: '14px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)' },
    secondaryBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' },

    dateNavCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '20px', marginBottom: '24px', boxShadow: 'var(--shadow)' },
    navBtn: { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', border: 'none', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-secondary)' },
    dateInfo: { textAlign: 'center' as const },
    dateMain: { fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' },
    dateSub: { fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px' },

    listContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
    card: { backgroundColor: 'var(--bg-card)', borderRadius: '20px', overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', transition: 'all 0.3s' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', cursor: 'pointer', transition: 'background 0.1s' },

    cardLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
    timeTag: { fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', minWidth: '60px' },
    cardContent: { display: 'flex', flexDirection: 'column', gap: '4px' },
    classTitle: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' },
    metaRow: { display: 'flex', alignItems: 'center', gap: '6px' },
    metaText: { fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' },

    cardRight: { display: 'flex', alignItems: 'center', gap: '12px' },
    participantBadge: { display: 'flex', alignItems: 'center', gap: '2px', fontSize: '13px', fontWeight: '600' },
    participantCount: { fontSize: '18px', fontWeight: '800' },

    detailPanel: { backgroundColor: 'var(--bg-secondary)', padding: '20px', borderTop: '1px solid var(--border-color)' },
    detailHeader: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' },
    detailTitle: { fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' },
    emptyDetail: { fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' },

    userGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: '8px' },
    userTag: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '10px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' },
    userAvatar: { width: '16px', height: '16px', borderRadius: '50%', backgroundColor: TOSS_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' },

    loading: { textAlign: 'center' as const, padding: '40px', color: 'var(--text-tertiary)' },
    emptyState: { padding: '60px 0', textAlign: 'center' as const, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
    emptyIcon: { width: '64px', height: '64px', borderRadius: '32px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: '15px', color: 'var(--text-tertiary)' },

    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--overlay-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
    modal: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', width: '100%', maxWidth: '420px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow)', overflow: 'hidden', border: '1px solid var(--border-color)' },
    modalScroll: { overflowY: 'auto' as const, padding: '24px' },

    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' },
    headerTitleBox: { display: 'flex', alignItems: 'center', gap: '12px' },
    iconBox: { width: '40px', height: '40px', borderRadius: '14px', backgroundColor: TOSS_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalTitle: { margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '8px' },

    modalBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    formGroup: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' },
    input: { width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid var(--border-color)', fontSize: '15px', boxSizing: 'border-box' as const, outline: 'none', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
    itemRow: { display: 'flex', gap: '12px' },
    row: { display: 'flex', gap: '12px' },

    submitBtn: { width: '100%', padding: '16px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', border: 'none', borderRadius: '16px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' },

    templateForm: { padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--border-color)', marginBottom: '24px' },
    sectionTitle: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 16px' },
    dayRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
    dayActive: { padding: '8px 12px', borderRadius: '12px', border: 'none', backgroundColor: TOSS_BLUE, color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
    dayInactive: { padding: '8px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
    addBtn: { width: '100%', padding: '14px', backgroundColor: 'var(--text-primary)', color: 'var(--bg-card)', border: 'none', borderRadius: '14px', marginTop: '16px', fontWeight: '700', cursor: 'pointer' },

    listSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
    templateList: { display: 'flex', flexDirection: 'column', gap: '10px' },
    templateItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' },
    tmplTitle: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' },
    tmplMeta: { fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' },
    tmplDays: { fontSize: '12px', fontWeight: '600', color: TOSS_BLUE, marginTop: '4px' },
    iconBtn: { background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '8px' },
};

export default CoachSchedulePage;
