import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Calendar, Trash2, Save, MoreHorizontal, Plus, Pause, X, Clock, AlertCircle } from 'lucide-react';
import { getMemberDetail, updateMemberMemo, updateMemberTags, deleteMember, batchExtendMembership, createHoldByAdmin, PREDEFINED_TAGS } from '../../services/api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
const TOSS_BLUE = '#3182F6';

const MemberDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [memo, setMemo] = useState('');
    const [activeTab, setActiveTab] = useState<'attendance' | 'sales' | 'records'>('attendance');
    const [isEditingMemo, setIsEditingMemo] = useState(false);
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [holdStartDate, setHoldStartDate] = useState('');
    const [holdEndDate, setHoldEndDate] = useState('');
    const [memberTags, setMemberTags] = useState<string[]>([]);

    const fetchDetail = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const res = await getMemberDetail(parseInt(id));
            setData(res.data);
            setMemo(res.data.member.memo || '');
            setMemberTags(res.data.member.tags ? res.data.member.tags.split(',').filter(Boolean) : []);
        } catch (e) {
            toast.error("회원 정보를 불러오지 못했습니다.");
            navigate('/members');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDetail(); }, [id]);

    const handleSaveMemo = async () => {
        if (!id) return;
        try {
            await updateMemberMemo(parseInt(id), memo);
            toast.success("메모가 저장되었습니다.");
            setIsEditingMemo(false);
        } catch (e) { toast.error("저장 실패"); }
    };

    const handleToggleTag = async (tag: string) => {
        if (!id) return;
        const newTags = memberTags.includes(tag) ? memberTags.filter(t => t !== tag) : [...memberTags, tag];
        try {
            await updateMemberTags(parseInt(id), newTags.join(','));
            setMemberTags(newTags);
            toast.success(`태그 ${memberTags.includes(tag) ? '제거됨' : '추가됨'}`);
        } catch (e) { toast.error("태그 저장 실패"); }
    };

    const handleExtend = async () => {
        const daysStr = prompt("몇 일 연장할까요?");
        if (!daysStr || !id) return;
        const days = parseInt(daysStr);
        if (isNaN(days)) { toast.error("숫자를 입력해주세요."); return; }
        if (window.confirm(`${days}일 연장하시겠습니까?`)) {
            try {
                await batchExtendMembership([parseInt(id)], days);
                toast.success("연장되었습니다.");
                fetchDetail();
            } catch (e) { toast.error("오류 발생"); }
        }
    };

    const handleSubmitHold = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !holdStartDate || !holdEndDate) return;
        if (new Date(holdEndDate) < new Date(holdStartDate)) { toast.error("종료일이 시작일보다 빨라요!"); return; }
        if (window.confirm(`${holdStartDate} ~ ${holdEndDate} 홀딩 적용?`)) {
            try {
                await createHoldByAdmin(parseInt(id), { start_date: holdStartDate, end_date: holdEndDate });
                toast.success("홀딩 처리 완료!");
                setShowHoldModal(false);
                fetchDetail();
            } catch (e) { toast.error("홀딩 처리 실패"); }
        }
    };

    // 화면 너비 감지
    const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 1024);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleDelete = async () => {
        if (!id) return;
        if (window.confirm("정말 이 회원을 삭제하시겠습니까?")) {
            try {
                await deleteMember(parseInt(id));
                toast.success("삭제되었습니다.");
                navigate('/members');
            } catch (e) { toast.error("삭제 실패"); }
        }
    };

    const getDaysLeft = (endDateStr: string) => {
        if (!endDateStr) return -999;
        const diff = new Date(endDateStr).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    if (loading) return <div style={styles.loading}>로딩 중...</div>;
    if (!data) return null;

    const { member, sales, attendances, recent_records } = data;
    const daysLeft = getDaysLeft(member.end_date);
    const chartData = attendances && attendances.length > 0
        ? attendances.slice(0, 7).reverse().map((a: any) => ({ date: a.date.substring(5), val: 1 }))
        : [];

    return (
        <div style={{ ...styles.container, padding: isMobile ? '16px 0' : '32px 40px' }}>
            <button onClick={() => navigate('/members')} style={styles.backBtn}><ArrowLeft size={16} /> 목록으로</button>

            <div style={{ ...styles.grid, gridTemplateColumns: isMobile ? '1fr' : 'minmax(320px, 1fr) 2.5fr', gap: isMobile ? '16px' : '24px' }}>
                {/* Left Column: Profile, Actions, Tags, Memo */}
                <div style={styles.leftCol}>
                    <div style={{ ...styles.profileCard, padding: isMobile ? '24px' : '32px' }}>
                        <div style={{ ...styles.avatar, width: isMobile ? '72px' : '88px', height: isMobile ? '72px' : '88px', fontSize: isMobile ? '24px' : '32px' }}>{member.name[0]}</div>
                        <h2 style={{ ...styles.memberName, fontSize: isMobile ? '20px' : '24px' }}>{member.name}</h2>
                        <p style={styles.memberPhone}><Phone size={14} /> {member.phone}</p>
                        <span style={daysLeft > 0 ? styles.activeBadge : styles.expiredBadge}>
                            {daysLeft > 0 ? `D-${daysLeft}` : '기간 만료'}
                        </span>
                    </div>

                    <div style={styles.infoCard}>
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>등록일</span>
                            <strong style={styles.infoValue}>{member.join_date}</strong>
                        </div>
                        <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>만료일</span>
                            <strong style={{ ...styles.infoValue, color: daysLeft <= 7 ? '#E90061' : '#191F28' }}>{member.end_date}</strong>
                        </div>
                    </div>

                    <div style={{ ...styles.actionCard, flexDirection: isMobile ? 'row' : 'column' }}>
                        <button onClick={handleExtend} style={{ ...styles.primaryBtn, padding: isMobile ? '12px' : '14px' }}><Calendar size={16} /> <span style={{ display: isMobile ? 'none' : 'inline' }}>기간</span> 연장</button>
                        <button onClick={() => setShowHoldModal(true)} style={{ ...styles.secondaryBtn, padding: isMobile ? '12px' : '14px' }}><Pause size={16} /> 홀딩</button>
                        <button onClick={handleDelete} style={{ ...styles.dangerBtn, padding: isMobile ? '12px' : '14px' }}><Trash2 size={16} /> 삭제</button>
                    </div>

                    <div style={styles.tagCard}>
                        <h4 style={styles.cardLabel}>🏷️ 태그</h4>
                        <div style={styles.tagRow}>
                            {PREDEFINED_TAGS.map(tag => (
                                <button key={tag} onClick={() => handleToggleTag(tag)} style={memberTags.includes(tag) ? styles.tagActive : styles.tagInactive}>
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={styles.memoCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={styles.cardLabel}>📝 메모</h4>
                            {isEditingMemo && <button onClick={handleSaveMemo} style={styles.saveBtn}><Save size={14} /> 저장</button>}
                        </div>
                        <textarea
                            value={memo}
                            onChange={(e) => { setMemo(e.target.value); setIsEditingMemo(true); }}
                            placeholder="메모 입력..."
                            style={styles.memoArea}
                        />
                    </div>
                </div>

                {/* Right Column: Tabs & Content */}
                <div style={styles.rightCol}>
                    <div style={styles.tabRow}>
                        {['attendance', 'sales', 'records'].map(t => (
                            <button key={t} onClick={() => setActiveTab(t as any)} style={{ ... (activeTab === t ? styles.tabActive : styles.tabInactive), fontSize: isMobile ? '14px' : '16px' }}>
                                {t === 'attendance' ? '출석' : t === 'sales' ? '결제' : '운동'}
                            </button>
                        ))}
                    </div>

                    <div style={{ ...styles.tabContent, padding: isMobile ? '20px' : '32px' }}>
                        {activeTab === 'attendance' && (
                            <>
                                <h3 style={styles.sectionTitle}>최근 7일</h3>
                                <div style={{ height: isMobile ? '160px' : '200px', marginBottom: '32px' }}>
                                    <ResponsiveContainer>
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)', color: 'var(--text-primary)' }} />
                                            <Bar dataKey="val" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={isMobile ? 20 : 32} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <h3 style={styles.sectionTitle}>출석 로그</h3>
                                <div style={styles.logList}>
                                    {attendances && attendances.length > 0 ? attendances.map((a: any) => (
                                        <div key={a.id} style={styles.logItem}>
                                            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{a.date}</span>
                                            <span style={styles.logBadge}>출석</span>
                                        </div>
                                    )) : <div style={styles.emptyState}>기록 없음</div>}
                                </div>
                            </>
                        )}
                        {activeTab === 'sales' && (
                            <>
                                <h3 style={styles.sectionTitle}>결제 히스토리</h3>
                                <div style={styles.salesList}>
                                    {sales && sales.length > 0 ? sales.map((s: any) => (
                                        <div key={s.id} style={{ ...styles.salesItem, padding: isMobile ? '16px' : '20px' }}>
                                            <div>
                                                <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: isMobile ? '14px' : '16px' }}>{s.item_name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{s.payment_date}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: '700', color: 'var(--text-secondary)', fontSize: isMobile ? '14px' : '16px' }}>{s.amount.toLocaleString()}원</div>
                                                <div style={{ marginTop: '4px' }}>
                                                    <span style={s.status === 'paid' ? styles.paidBadge : styles.pendingBadge}>
                                                        {s.status === 'paid' ? '완료' : '미수'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )) : <div style={styles.emptyState}>내역 없음</div>}
                                </div>
                            </>
                        )}
                        {activeTab === 'records' && (
                            <>
                                <h3 style={styles.sectionTitle}>운동 기록</h3>
                                <div style={styles.recordList}>
                                    {recent_records && recent_records.length > 0 ? recent_records.map((r: any) => (
                                        <div key={r.id} style={{ ...styles.recordItem, padding: isMobile ? '16px' : '20px' }}>
                                            <div>
                                                <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: isMobile ? '14px' : '16px' }}>{r.created_at.substring(0, 10)}</div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Record: {r.record_value}</div>
                                            </div>
                                            <span style={r.is_rx ? styles.rxBadge : styles.scBadge}>{r.is_rx ? 'Rx' : 'Scaled'}</span>
                                        </div>
                                    )) : <div style={styles.emptyState}>기록 없음</div>}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Hold Modal */}
            {showHoldModal && (
                <div style={styles.modalOverlay}>
                    <div style={{ ...styles.modalContent, width: isMobile ? '90%' : '380px', padding: isMobile ? '24px' : '32px' }}>
                        <div style={styles.modalHeader}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>홀딩 신청</h3>
                            <button onClick={() => setShowHoldModal(false)} style={styles.closeBtn}><X size={20} /></button>
                        </div>
                        <p style={styles.modalDesc}>만료일이 자동으로 연장됩니다.</p>
                        <form onSubmit={handleSubmitHold}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>시작 날짜</label>
                                <input type="date" value={holdStartDate} onChange={e => setHoldStartDate(e.target.value)} style={styles.input} required />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>종료 날짜</label>
                                <input type="date" value={holdEndDate} onChange={e => setHoldEndDate(e.target.value)} style={styles.input} required />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                                <button type="button" onClick={() => setShowHoldModal(false)} style={styles.modalSecondaryBtn}>취소</button>
                                <button type="submit" style={styles.modalPrimaryBtn}>적용</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '32px', minHeight: '100vh', backgroundColor: 'var(--bg-main)', fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif', transition: 'background-color 0.3s' },
    loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--text-tertiary)' },
    backBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '20px', fontWeight: '600', padding: 0 },

    grid: { display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2.5fr', gap: '24px', alignItems: 'start' },
    leftCol: { display: 'flex', flexDirection: 'column' as const, gap: '20px' },
    rightCol: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' },

    profileCard: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '32px', textAlign: 'center' as const, boxShadow: 'var(--shadow)' },
    avatar: { width: '88px', height: '88px', borderRadius: '36px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', fontSize: '32px', fontWeight: '700', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 16px' },
    memberName: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px' },
    memberPhone: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '16px' },
    activeBadge: { display: 'inline-block', padding: '6px 14px', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '24px', fontSize: '14px', fontWeight: '700' },
    expiredBadge: { display: 'inline-block', padding: '6px 14px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '24px', fontSize: '14px', fontWeight: '700' },

    infoCard: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '24px', boxShadow: 'var(--shadow)' },
    infoRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '15px' },
    infoLabel: { color: 'var(--text-tertiary)', fontWeight: '500' },
    infoValue: { color: 'var(--text-primary)', fontWeight: '600' },

    actionCard: { display: 'flex', flexDirection: 'column' as const, gap: '10px', backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '20px', boxShadow: 'var(--shadow)' },
    primaryBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, padding: '14px', backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none', borderRadius: '16px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s' },
    secondaryBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, padding: '14px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '16px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s' },
    dangerBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, padding: '14px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: 'none', borderRadius: '16px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s' },

    memoCard: { backgroundColor: 'var(--warning-bg)', borderRadius: '24px', padding: '24px', border: '1px solid var(--warning-border)' },
    cardLabel: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
    memoArea: { width: '100%', height: '120px', padding: '16px', borderRadius: '12px', border: 'none', resize: 'none' as const, outline: 'none', fontSize: '15px', backgroundColor: 'rgba(255,255,255,0.1)', boxSizing: 'border-box' as const, color: 'var(--text-primary)', lineHeight: '1.5' },
    saveBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'var(--warning)', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' },

    tagCard: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '24px', boxShadow: 'var(--shadow)' },
    tagRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '8px' },
    tagActive: { padding: '8px 14px', borderRadius: '24px', border: 'none', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
    tagInactive: { padding: '8px 14px', borderRadius: '24px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },

    tabRow: { display: 'flex', borderBottom: '1px solid var(--border-color)' },
    tabActive: { flex: 1, padding: '18px', border: 'none', borderBottom: `2px solid var(--primary)`, background: 'var(--bg-card)', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', fontSize: '16px', transition: 'all 0.2s' },
    tabInactive: { flex: 1, padding: '18px', border: 'none', background: 'var(--bg-card)', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '16px', transition: 'all 0.2s', borderBottom: '2px solid transparent' },
    tabContent: { padding: '32px' },
    sectionTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 20px' },

    logList: { display: 'flex', flexDirection: 'column' as const, gap: '10px' },
    logItem: { display: 'flex', justifyContent: 'space-between', padding: '14px 18px', backgroundColor: 'var(--bg-secondary)', borderRadius: '14px', fontSize: '15px', alignItems: 'center' },
    logBadge: { padding: '6px 12px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: '10px', fontSize: '13px', fontWeight: '700' },

    salesList: { display: 'flex', flexDirection: 'column' as const, gap: '14px' },
    salesItem: { display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', alignItems: 'center' },
    paidBadge: { padding: '6px 12px', backgroundColor: 'var(--success-bg)', color: 'var(--success)', borderRadius: '10px', fontSize: '13px', fontWeight: '700' },
    pendingBadge: { padding: '6px 12px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '10px', fontSize: '13px', fontWeight: '700' },

    recordList: { display: 'flex', flexDirection: 'column' as const, gap: '14px' },
    recordItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px' },
    rxBadge: { padding: '6px 12px', backgroundColor: 'var(--text-primary)', color: 'var(--bg-card)', borderRadius: '10px', fontSize: '13px', fontWeight: '700' },
    scBadge: { padding: '6px 12px', backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)', borderRadius: '10px', fontSize: '13px', fontWeight: '600' },

    emptyState: { textAlign: 'center' as const, padding: '60px 0', color: '#B0B8C1', fontSize: '15px' },

    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' },
    modalContent: { backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '28px', width: '380px', boxShadow: 'var(--shadow)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    modalDesc: { color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '24px', lineHeight: '1.4' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px' },
    formGroup: { marginBottom: '20px' },
    label: { display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' },
    input: { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' as const, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' },
    modalPrimaryBtn: { flex: 1, padding: '16px', backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none', borderRadius: '16px', fontWeight: '700', fontSize: '16px', cursor: 'pointer' },
    modalSecondaryBtn: { flex: 1, padding: '16px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '16px', fontWeight: '600', fontSize: '16px', cursor: 'pointer' },
};

export default MemberDetail;