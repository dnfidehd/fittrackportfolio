import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Check, Shield, Globe, EyeOff, Users, Trash2 } from 'lucide-react';
import { searchGyms, addGymToCompetition, getParticipatingGyms, removeGymFromCompetition, updateCompetition, deleteCompetition } from '../../services/api';
import toast from 'react-hot-toast';

interface CompSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    competition: any;
    onUpdate: () => void;
}

const CompSettingsModal: React.FC<CompSettingsModalProps> = ({ isOpen, onClose, competition, onUpdate }) => {
    // 1. 보안 옵션 상태
    const [isPrivate, setIsPrivate] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(true);
    const [showWod, setShowWod] = useState(true);
    const [anonymize, setAnonymize] = useState(false);
    const [guestPasscode, setGuestPasscode] = useState('');
    const [allowInvitedGymSettings, setAllowInvitedGymSettings] = useState(false);
    const [compTitle, setCompTitle] = useState(''); // ✅ [신규] 대회명 수정을 위한 상태

    // 2. 박스 검색 및 연합 상태
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [participatingGyms, setParticipatingGyms] = useState<any[]>([]);

    useEffect(() => {
        if (competition) {
            setIsPrivate(competition.is_private ?? false);
            setShowLeaderboard(competition.show_leaderboard_to_all ?? true);
            setShowWod(competition.show_wod_to_all ?? true);
            setAnonymize(competition.anonymize_for_all ?? false);
            setGuestPasscode(competition.guest_passcode || '');
            setAllowInvitedGymSettings(competition.allow_invited_gym_settings ?? false);
            setCompTitle(competition.title || ''); // ✅ [신규]
            fetchParticipatingGyms();
        }
    }, [competition]);

    const fetchParticipatingGyms = async () => {
        if (!competition) return;
        try {
            const res = await getParticipatingGyms(competition.id);
            setParticipatingGyms(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        try {
            const res = await searchGyms(searchQuery);
            setSearchResults(res.data);
        } catch (err) {
            console.error(err);
            toast.error("체육관 검색 실패");
        }
    };

    const handleAddGym = async (gymId: number) => {
        try {
            await addGymToCompetition(competition.id, gymId);
            toast.success("박스가 연합에 추가되었습니다.");
            fetchParticipatingGyms();
            setSearchResults(prev => prev.filter(gym => gym.id !== gymId));
        } catch (err: any) {
            console.error(err);
            if (err.response?.status === 400) {
                toast.error(err.response.data.detail || "이미 참여 중인 박스입니다.");
            } else {
                toast.error("박스 추가 실패");
            }
        }
    };

    const handleRemoveGym = async (gymId: number) => {
        if (!window.confirm("정말 이 박스를 대회에서 제외하시겠습니까?")) return;
        try {
            await removeGymFromCompetition(competition.id, gymId);
            toast.success("박스가 제외되었습니다.");
            fetchParticipatingGyms();
        } catch (err) {
            console.error(err);
            toast.error("박스 제외 실패");
        }
    };

    const handleUpdateOption = async (key: string, value: boolean) => {
        try {
            await updateCompetition(competition.id, { [key]: value });
            toast.success("설정이 저장되었습니다.");
            onUpdate();

            if (key === 'is_private') setIsPrivate(value);
            if (key === 'show_leaderboard_to_all') setShowLeaderboard(value);
            if (key === 'show_wod_to_all') setShowWod(value);
            if (key === 'anonymize_for_all') setAnonymize(value);
            if (key === 'allow_invited_gym_settings') setAllowInvitedGymSettings(value); // ✅ [신규]
        } catch (e) {
            console.error(e);
            toast.error("설정 변경 실패");
        }
    };

    const handleUpdatePasscode = async () => {
        try {
            await updateCompetition(competition.id, { guest_passcode: guestPasscode });
            toast.success("게스트 패스코드가 저장되었습니다.");
            onUpdate();
        } catch (e) {
            console.error(e);
            toast.error("패스코드 저장 실패");
        }
    };

    // ✅ [신규] 대회명 수정 함수
    const handleUpdateTitle = async () => {
        if (!compTitle.trim()) {
            toast.error("대회명을 입력해주세요.");
            return;
        }
        try {
            await updateCompetition(competition.id, { title: compTitle });
            toast.success("대회명이 수정되었습니다.");
            onUpdate();
        } catch (e) {
            console.error(e);
            toast.error("대회명 수정 실패");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("⚠️ 경고: 대회를 정말 삭제하시겠습니까? 모든 관련 데이터가 영구 삭제됩니다.")) return;
        try {
            await deleteCompetition(competition.id);
            toast.success("대회가 삭제되었습니다.");
            onClose();
            onUpdate();
        } catch (e) {
            console.error(e);
            toast.error("대회 삭제 실패");
        }
    };

    if (!isOpen || !competition) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>대회 설정 및 박스 연합</h2>
                    <button onClick={onClose} style={styles.closeButton}><X size={24} /></button>
                </div>

                <div style={styles.body}>
                    {/* ✅ [신규] 섹션 0: 대회 기본 정보 수정 */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>
                            <Globe size={18} /> 대회 기본 정보
                        </h3>
                        <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>대회명</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="대회 이름 입력"
                                    value={compTitle}
                                    onChange={(e) => setCompTitle(e.target.value)}
                                    style={{ ...styles.searchInput, flex: 1 }}
                                />
                                <button
                                    onClick={handleUpdateTitle}
                                    style={{ ...styles.searchButton, backgroundColor: '#3182F6' }}
                                >
                                    변경
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* 섹션 1: 공개/보안 설정 */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>
                            <Shield size={18} /> 공개 및 보안 설정
                        </h3>
                        <div style={styles.settingGrid}>
                            <SettingItem
                                label="프라이빗 대회 (지정 박스만)"
                                value={isPrivate}
                                icon={<Users size={16} />}
                                description="초대된 박스의 회원만 대회를 볼 수 있습니다."
                                onClick={() => handleUpdateOption('is_private', !isPrivate)}
                            />
                            <SettingItem
                                label="외부인에게 리더보드 공개"
                                value={showLeaderboard}
                                icon={<Globe size={16} />}
                                description="참여하지 않는 유저도 순위를 볼 수 있습니다."
                                onClick={() => handleUpdateOption('show_leaderboard_to_all', !showLeaderboard)}
                            />
                            <SettingItem
                                label="외부인에게 WOD 공개"
                                value={showWod}
                                icon={<Globe size={16} />}
                                description="참여하지 않는 유저도 WOD 내용을 볼 수 있습니다."
                                onClick={() => handleUpdateOption('show_wod_to_all', !showWod)}
                            />
                            <SettingItem
                                label="이름 익명화 (마스킹)"
                                value={anonymize}
                                icon={<EyeOff size={16} />}
                                description="외부인에게는 이름이 '김*수' 처럼 가려져서 보입니다."
                                onClick={() => handleUpdateOption('anonymize_for_all', !anonymize)}
                            />
                            {/* ✅ [신규] 초대된 박스 어드민 설정 허용 옵션 */}
                            <SettingItem
                                label="초대된 박스 어드민도 설정 변경 허용"
                                value={allowInvitedGymSettings}
                                icon={<Users size={16} />}
                                description="켜면 초대된 모든 박스의 어드민이 대회 설정을 변경할 수 있습니다."
                                onClick={() => handleUpdateOption('allow_invited_gym_settings', !allowInvitedGymSettings)}
                            />
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                            * 각 항목을 클릭하여 즉시 설정을 변경할 수 있습니다.
                        </p>

                        <div style={{ marginTop: '20px', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🔑 게스트 패스코드 (오픈 대회 테스트용)
                            </h4>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="패스코드 입력 (예: 1234)"
                                    value={guestPasscode}
                                    onChange={(e) => setGuestPasscode(e.target.value)}
                                    style={{ ...styles.searchInput, flex: 1 }}
                                />
                                <button
                                    onClick={handleUpdatePasscode}
                                    style={{ ...styles.searchButton, backgroundColor: '#3182F6' }}
                                >
                                    저장
                                </button>
                            </div>
                            <p style={{ fontSize: '11px', color: '#8B95A1', marginTop: '8px' }}>
                                * 이 코드를 입력하면 로그인 없이 기록을 제출할 수 있는 페이지로 입장 가능합니다.
                            </p>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* 섹션 2: 연합 박스 관리 */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>
                            <Users size={18} /> 연합 박스 관리
                        </h3>

                        {/* 검색창 */}
                        <div style={styles.searchBox}>
                            <input
                                type="text"
                                placeholder="초대할 박스 이름 검색..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={styles.searchInput}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button onClick={handleSearch} style={styles.searchButton}>
                                <Search size={18} />
                            </button>
                        </div>

                        {/* 검색 결과 */}
                        {searchResults.length > 0 && (
                            <div style={styles.listContainer}>
                                <h4 style={styles.subTitle}>검색 결과</h4>
                                {searchResults.map(gym => (
                                    <div key={gym.id} style={styles.gymItem}>
                                        <span>{gym.name} <span style={{ fontSize: '12px', color: '#888' }}>({gym.location || '위치 미정'})</span></span>
                                        <button
                                            onClick={() => handleAddGym(gym.id)}
                                            style={styles.addButton}
                                        >
                                            <Plus size={16} /> 초대
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 참여 중인 박스 목록 */}
                        <div style={styles.listContainer}>
                            <h4 style={styles.subTitle}>참여 중인 박스 ({participatingGyms.length})</h4>
                            {participatingGyms.length === 0 ? (
                                <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', padding: '10px' }}>아직 초대된 박스가 없습니다.</p>
                            ) : (
                                participatingGyms.map(pg => (
                                    <div key={pg.gym_id} style={styles.gymItem}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                                            {pg.gym_name}
                                            {pg.status === 'accepted' && <Check size={14} color="#10B981" />}
                                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>({pg.status})</span>
                                        </span>
                                        <button
                                            onClick={() => handleRemoveGym(pg.gym_id)}
                                            style={styles.deleteButton}
                                            title="대회에서 제외"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* 섹션 3: 대회 삭제 (위험 구역) */}
                    <div style={{ ...styles.section, marginTop: '40px', padding: '20px', backgroundColor: 'var(--danger-bg)', borderRadius: '12px', border: '1px solid var(--danger)' }}>
                        <h3 style={{ ...styles.sectionTitle, color: 'var(--danger)', marginBottom: '8px' }}>위험 구역</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                            대회를 삭제하면 모든 종목(WOD), 기록, 참가자 정보가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                        </p>
                        <button
                            onClick={handleDelete}
                            style={styles.fullDeleteButton}
                        >
                            <Trash2 size={18} /> 대회 영구 삭제
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingItem = ({ label, value, icon, description, onClick }: any) => (
    <div style={{ ...styles.settingItem, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {icon}
            <span style={{ fontWeight: 'bold', color: value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{label}</span>
            <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: value ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                color: value ? 'var(--primary)' : 'var(--text-tertiary)',
                fontWeight: 'bold'
            }}>
                {value ? 'ON' : 'OFF'}
            </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{description}</p>
    </div>
);

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    },
    modal: {
        backgroundColor: 'var(--bg-card)', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', color: 'var(--text-primary)'
    },
    header: {
        padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    title: { fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' },
    closeButton: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' },
    body: { padding: '20px' },
    section: { marginBottom: '24px' },
    sectionTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' },
    settingGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    settingItem: { backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' },
    divider: { height: '1px', backgroundColor: 'var(--border-color)', margin: '20px 0' },
    searchBox: { display: 'flex', gap: '8px', marginBottom: '16px' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' },
    searchButton: { padding: '0 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', cursor: 'pointer' },
    listContainer: { marginBottom: '16px' },
    subTitle: { fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px' },
    gymItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '8px', color: 'var(--text-primary)' },
    addButton: { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
    deleteButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer' },
    fullDeleteButton: { width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--danger)', color: 'white', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
};

export default CompSettingsModal;
