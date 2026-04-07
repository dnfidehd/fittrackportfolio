import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { sendBroadcast, checkExpiryNotifications, getNotificationTemplates, getExpiryFollowUps, updateExpiryFollowUp } from '../../services/api';
import { Send, Clock, Users, AlertTriangle, CheckCircle2, MessageSquare, Phone, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

const AdminNotifications = () => {
    const navigate = useNavigate();
    const [autoTarget, setAutoTarget] = useState('all');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [templates, setTemplates] = useState<any[]>([]);
    const [followUps, setFollowUps] = useState<any[]>([]);
    const [expandedFollowUpKey, setExpandedFollowUpKey] = useState<string | null>(null);
    const [freeTarget, setFreeTarget] = useState('all');
    const [freeTitle, setFreeTitle] = useState('');
    const [freeMessage, setFreeMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchTemplates();
        fetchFollowUps();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await getNotificationTemplates();
            setTemplates(res.data);
            if (res.data.length > 0) setSelectedTemplate(res.data[0].type);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchFollowUps = async () => {
        try {
            const res = await getExpiryFollowUps();
            setFollowUps(res.data.items || []);
        } catch (err) {
            console.error(err);
        }
    };

    const currentTemplate = templates.find(t => t.type === selectedTemplate);

    const handleAutoSend = async () => {
        if (loading) return;
        if (!window.confirm("만료 임박 회원들에게 알림을 발송하시겠습니까?")) return;

        setLoading(true);
        try {
            const res = await checkExpiryNotifications();
            toast.success(res.data.message);
            fetchFollowUps();
        }
        catch (err) {
            toast.error("오류 발생");
        }
        finally {
            setLoading(false);
        }
    };

    const handleFreeSend = async () => {
        if (!freeTitle || !freeMessage) {
            toast.error("제목과 내용을 입력해주세요.");
            return;
        }
        if (!window.confirm("정말로 발송하시겠습니까?")) return;

        setLoading(true);
        try {
            const res = await sendBroadcast({ target_group: freeTarget, title: freeTitle, message: freeMessage, type: 'coach' });
            toast.success("문자가 발송되었습니다!");
            setFreeTitle('');
            setFreeMessage('');
        } catch (err) {
            console.error(err);
            toast.error("발송 실패!");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateFollowUp = async (item: any, patch: { status?: string; note?: string; contact_method?: string | null }) => {
        try {
            await updateExpiryFollowUp({
                member_id: item.member_id,
                trigger_type: item.trigger_type,
                status: patch.status || item.follow_up_status,
                note: patch.note ?? item.follow_up_note ?? '',
                contact_method: patch.contact_method ?? null
            });
            toast.success('후속 상태 저장됨');
            fetchFollowUps();
        } catch (err) {
            toast.error('저장 실패');
        }
    };

    const handleCall = async (item: any) => {
        await handleUpdateFollowUp(item, { contact_method: 'call', status: item.follow_up_status === 'pending' ? 'contacted' : item.follow_up_status });
        window.location.href = `tel:${item.phone}`;
    };

    const handleSms = async (item: any) => {
        await handleUpdateFollowUp(item, { contact_method: 'sms', status: item.follow_up_status === 'pending' ? 'contacted' : item.follow_up_status });
        window.location.href = `sms:${item.phone}`;
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.pageTitle}>알림 관리</h1>
                <p style={styles.subtitle}>회원들에게 문자를 발송하세요</p>
            </header>

            <div style={styles.contentGrid}>
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <div style={{ ...styles.iconBox, backgroundColor: '#ECFDF5', color: '#059669' }}>
                            <Users size={24} />
                        </div>
                        <div style={styles.headerText}>
                            <h3 style={styles.cardTitle}>만료 예정 회원 후속 관리</h3>
                            <p style={styles.cardDesc}>D-30 이내 회원의 연락 상태와 메모를 관리합니다.</p>
                        </div>
                    </div>

                    <div style={styles.followUpList}>
                        {followUps.length === 0 ? (
                            <div style={styles.emptyState}>만료 예정 회원이 없습니다.</div>
                        ) : followUps.map(item => {
                            const followUpKey = `${item.member_id}-${item.trigger_type}`;
                            const isExpanded = expandedFollowUpKey === followUpKey;

                            return (
                                <div key={followUpKey} style={styles.followUpCard}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedFollowUpKey(isExpanded ? null : followUpKey)}
                                        style={styles.followUpToggle}
                                    >
                                        <div style={styles.followUpSummary}>
                                            <div style={styles.followUpNameRow}>
                                                <span style={styles.followUpName}>{item.member_name}</span>
                                                <span style={styles.followUpStatusBadge}>{item.follow_up_status === 'pending' ? '대기' : item.follow_up_status === 'contacted' ? '연락 완료' : item.follow_up_status === 'completed' ? '재등록 완료' : item.follow_up_status === 'on_hold' ? '보류' : '무응답'}</span>
                                            </div>
                                            <div style={styles.followUpMeta}>{item.membership || '이용권 미지정'} · {item.end_date} · D-{item.days_left}</div>
                                        </div>
                                        <div style={styles.followUpToggleIcon}>
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div style={styles.followUpDetail}>
                                            <div style={styles.followUpHeader}>
                                                <div style={styles.followUpLabel}>후속 상태</div>
                                                <select
                                                    value={item.follow_up_status}
                                                    onChange={(e) => handleUpdateFollowUp(item, { status: e.target.value })}
                                                    style={styles.followUpSelect}
                                                >
                                                    <option value="pending">대기</option>
                                                    <option value="contacted">연락 완료</option>
                                                    <option value="completed">재등록 완료</option>
                                                    <option value="on_hold">보류</option>
                                                    <option value="no_response">무응답</option>
                                                </select>
                                            </div>

                                            <div style={styles.followUpActions}>
                                                <button onClick={() => handleCall(item)} style={styles.smallActionBtn}><Phone size={14} /> 전화</button>
                                                <button onClick={() => handleSms(item)} style={styles.smallActionBtn}><MessageSquare size={14} /> 문자</button>
                                                <button onClick={() => navigate(`/members/${item.member_id}`)} style={styles.smallActionBtn}><FileText size={14} /> 상세</button>
                                            </div>

                                            <textarea
                                                defaultValue={item.follow_up_note || ''}
                                                placeholder="후속 메모 입력"
                                                style={styles.followUpNote}
                                                onBlur={(e) => {
                                                    if (e.target.value !== (item.follow_up_note || '')) {
                                                        handleUpdateFollowUp(item, { note: e.target.value });
                                                    }
                                                }}
                                            />
                                            <div style={styles.followUpFooter}>
                                                최근 연락: {item.last_contacted_at ? new Date(item.last_contacted_at).toLocaleString() : '없음'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 자동 문자 */}
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <div style={{ ...styles.iconBox, backgroundColor: '#FFF7E6', color: '#F59E0B' }}>
                            <Clock size={24} />
                        </div>
                        <div style={styles.headerText}>
                            <h3 style={styles.cardTitle}>자동 문자 보내기</h3>
                            <p style={styles.cardDesc}>템플릿을 선택하여 조건에 맞는 회원들에게 자동으로 발송합니다.</p>
                        </div>
                    </div>

                    <div style={styles.formSection}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>템플릿 선택</label>
                            <select
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                style={styles.input}
                            >
                                {templates.map(t => (
                                    <option key={t.id} value={t.type}>
                                        {t.type === 'expiry_7days' && '회원권 만료 7일 전'}
                                        {t.type === 'expiry_3days' && '회원권 만료 3일 전'}
                                        {t.type === 'inactivity_7days' && '7일 이상 미출석'}
                                        {t.type === 'inactivity_no_checkin' && '가입 후 미출석'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {currentTemplate && (
                            <div style={styles.previewBox}>
                                <div style={styles.previewLabel}>미리보기</div>
                                <div style={styles.previewTitle}>{currentTemplate.title}</div>
                                <div style={styles.previewMessage}>{currentTemplate.message}</div>
                            </div>
                        )}

                        <button
                            onClick={handleAutoSend}
                            disabled={loading || !selectedTemplate}
                            style={{ ...styles.actionBtn, backgroundColor: loading ? '#F2F4F6' : '#FFF7E6', color: loading ? '#B0B8C1' : '#B45309', opacity: !selectedTemplate ? 0.5 : 1 }}
                        >
                            {loading ? <div style={styles.spinner} /> : <AlertTriangle size={18} />}
                            {loading ? '처리 중...' : '템플릿 적용하여 발송'}
                        </button>
                    </div>
                </div>

                {/* 자유로운 문자 작성 */}
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <div style={{ ...styles.iconBox, backgroundColor: '#E8F3FF', color: TOSS_BLUE }}>
                            <MessageSquare size={24} />
                        </div>
                        <div style={styles.headerText}>
                            <h3 style={styles.cardTitle}>자유로운 문자 작성</h3>
                            <p style={styles.cardDesc}>자신이 원하는 내용을 직접 작성하여 발송합니다.</p>
                        </div>
                    </div>

                    <div style={styles.formSection}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>받는 사람</label>
                            <div style={styles.targetRow}>
                                {[
                                    { value: 'all', label: '전체 회원', icon: <Users size={16} /> },
                                    { value: 'active', label: '활성 회원', icon: <CheckCircle2 size={16} /> },
                                    { value: 'inactive', label: '만료 회원', icon: <Clock size={16} /> }
                                ].map((t) => (
                                    <button
                                        key={t.value}
                                        onClick={() => setFreeTarget(t.value)}
                                        style={freeTarget === t.value ? styles.targetActive : styles.targetInactive}
                                    >
                                        {t.icon}
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>제목</label>
                            <input
                                type="text"
                                placeholder="예: 11월 이벤트 안내"
                                value={freeTitle}
                                onChange={(e) => setFreeTitle(e.target.value)}
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>내용</label>
                            <textarea
                                placeholder="전달할 내용을 입력해주세요..."
                                rows={6}
                                value={freeMessage}
                                onChange={(e) => setFreeMessage(e.target.value)}
                                style={styles.textarea}
                            />
                        </div>

                        <button
                            onClick={handleFreeSend}
                            disabled={loading}
                            style={{ ...styles.sendBtn, backgroundColor: loading ? '#B0B8C1' : TOSS_BLUE }}
                        >
                            {loading ? '발송 중...' : '문자 발송하기'}
                            {!loading && <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '40px 24px', minHeight: '100vh', maxWidth: '640px', margin: '0 auto', fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif', transition: 'background-color 0.3s' },
    header: { marginBottom: '40px', textAlign: 'center' as const },
    pageTitle: { fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 12px 0' },
    subtitle: { fontSize: '16px', color: 'var(--text-secondary)', margin: 0 },

    contentGrid: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },

    card: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', transition: 'all 0.3s' },
    cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '24px' },
    iconBox: { width: '52px', height: '52px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1 },
    cardTitle: { fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px 0' },
    cardDesc: { fontSize: '15px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 },

    actionBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '18px', borderRadius: '16px', border: 'none', fontWeight: '700', fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s' },
    spinner: { width: '20px', height: '20px', border: '3px solid var(--border-color)', borderTop: '3px solid currentColor', borderRadius: '50%', animation: 'spin 1s linear infinite' },

    formSection: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },
    formGroup: { display: 'flex', flexDirection: 'column' as const, gap: '10px' },
    label: { fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' },
    input: { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' as const, outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
    textarea: { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' as const, outline: 'none', resize: 'vertical' as const, minHeight: '120px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit' },

    targetRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' as const },
    targetActive: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', borderRadius: '12px', border: 'none', backgroundColor: '#E8F3FF', color: TOSS_BLUE, fontSize: '15px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 0 1px #3182F6 inset' },
    targetInactive: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },

    sendBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '18px', borderRadius: '16px', border: 'none', color: '#FFFFFF', fontWeight: '700', fontSize: '17px', cursor: 'pointer', transition: 'all 0.2s', marginTop: '12px', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)' },

    previewBox: { backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', marginTop: '12px', marginBottom: '12px', borderLeft: '4px solid var(--primary)' },
    previewLabel: { fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase' as const },
    previewTitle: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' },
    previewMessage: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 },
    followUpList: { display: 'flex', flexDirection: 'column' as const, gap: '14px' },
    followUpCard: { backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' },
    followUpToggle: { width: '100%', border: 'none', backgroundColor: 'transparent', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' as const },
    followUpSummary: { flex: 1, minWidth: 0 },
    followUpNameRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const },
    followUpName: { fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' },
    followUpStatusBadge: { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '700' },
    followUpMeta: { fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' },
    followUpToggleIcon: { color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    followUpDetail: { padding: '0 16px 16px 16px', borderTop: '1px solid var(--border-color)' },
    followUpHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginTop: '14px' },
    followUpLabel: { fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' },
    followUpSelect: { padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: '600' },
    followUpActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginTop: '14px', marginBottom: '12px' },
    smallActionBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: '700', cursor: 'pointer' },
    followUpNote: { width: '100%', minHeight: '84px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', padding: '12px', boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'inherit' },
    followUpFooter: { marginTop: '8px', fontSize: '12px', color: 'var(--text-tertiary)' },
    emptyState: { padding: '20px', borderRadius: '14px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', textAlign: 'center' as const },
};

export default AdminNotifications;
