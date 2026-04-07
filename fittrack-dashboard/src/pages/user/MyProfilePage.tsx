import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getMyInfo, updateMyProfile } from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Ruler, Scale, Target, ChevronRight, Lock, Sparkles } from 'lucide-react';

// 토스 스타일 색상
const TOSS_BLUE = '#3182F6';

const MyProfilePage: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        gender: '남성',
        height: '',
        weight: '',
        activity_level: '보통',
        workout_goal: '근력증가'
    });
    const { refreshUser } = useAppContext();
    const navigate = useNavigate();

    useEffect(() => {
        loadMyInfo();
    }, []);

    const loadMyInfo = async () => {
        try {
            const res = await getMyInfo();
            const m = res.data;
            setFormData({
                name: m.name,
                phone: m.phone,
                gender: m.gender || '남성',
                height: m.height ? m.height.toString() : '',
                weight: m.weight ? m.weight.toString() : '',
                activity_level: m.activity_level || '보통',
                workout_goal: m.workout_goal || '근력증가'
            });
        } catch (e) {
            console.error(e);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateMyProfile({
                ...formData,
                height: formData.height ? Number(formData.height) : null,
                weight: formData.weight ? Number(formData.weight) : null,
            });
            await refreshUser(); // ✅ 전역 상태 갱신
            toast.success("정보가 수정되었습니다! 📝");
        } catch (error) {
            toast.error("수정 실패");
        }
    };

    return (
        <div style={styles.container}>
            {/* 헤더 */}
            <header style={styles.header}>
                <h1 style={styles.title}>내 정보 수정</h1>
            </header>

            <form onSubmit={handleSubmit}>
                {/* 기본 정보 섹션 */}
                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>기본 정보</h2>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>
                            <User size={18} color="#9CA3AF" />
                            이름
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>
                            <Phone size={18} color="#9CA3AF" />
                            전화번호 (아이디)
                        </label>
                        <input
                            type="tel"
                            inputMode="tel"
                            name="phone"
                            value={formData.phone}
                            style={{ ...styles.input, backgroundColor: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}
                            disabled
                        />
                    </div>
                </section>

                {/* AI 코칭 정보 */}
                <section style={styles.section}>
                    <div style={styles.aiHeader}>
                        <Sparkles size={20} color={TOSS_BLUE} />
                        <h2 style={styles.sectionTitle}>AI 코칭 정보</h2>
                    </div>
                    <p style={styles.aiSubtitle}>
                        신체 정보를 입력하면 AI 코치가 맞춤 조언을 제공해요
                    </p>

                    <div style={styles.rowGrid}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>
                                <Ruler size={18} color="#9CA3AF" />
                                키 (cm)
                            </label>
                            <input
                                type="number"
                                inputMode="decimal"
                                name="height"
                                value={formData.height}
                                onChange={handleChange}
                                placeholder="175"
                                style={styles.input}
                            />
                        </div>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>
                                <Scale size={18} color="#9CA3AF" />
                                몸무게 (kg)
                            </label>
                            <input
                                type="number"
                                inputMode="decimal"
                                name="weight"
                                value={formData.weight}
                                onChange={handleChange}
                                placeholder="70"
                                style={styles.input}
                            />
                        </div>
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>성별</label>
                        <div style={styles.selectWrapper}>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                style={styles.select}
                            >
                                <option value="남성">남성</option>
                                <option value="여성">여성</option>
                            </select>
                            <ChevronRight size={18} color="#9CA3AF" style={styles.selectIcon} />
                        </div>
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>
                            <Target size={18} color="#9CA3AF" />
                            운동 목표
                        </label>
                        <div style={styles.selectWrapper}>
                            <select
                                name="workout_goal"
                                value={formData.workout_goal}
                                onChange={handleChange}
                                style={styles.select}
                            >
                                <option value="다이어트">다이어트</option>
                                <option value="근력증가">근력 증가</option>
                                <option value="체력증진">체력 증진</option>
                                <option value="바디프로필">바디프로필 준비</option>
                            </select>
                            <ChevronRight size={18} color="#9CA3AF" style={styles.selectIcon} />
                        </div>
                    </div>
                </section>

                {/* 버튼 영역 */}
                <div style={styles.buttonSection}>
                    <button type="submit" style={styles.saveButton}>
                        저장하기
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/change-password')}
                        style={styles.passwordButton}
                    >
                        <Lock size={18} />
                        비밀번호 변경
                        <ChevronRight size={18} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                    </button>
                </div>
            </form>
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
        fontSize: '24px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
    },
    section: {
        paddingTop: '24px',
        paddingBottom: '8px',
    },
    sectionTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
        marginBottom: '16px',
    },
    aiHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
    },
    aiSubtitle: {
        fontSize: '14px',
        color: 'var(--text-secondary)',
        margin: '0 0 20px 0',
    },
    inputGroup: {
        marginBottom: '16px',
    },
    label: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        fontWeight: '500',
        color: 'var(--text-secondary)',
        marginBottom: '8px',
    },
    input: {
        width: '100%',
        padding: '16px',
        fontSize: '16px',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-primary)',
        boxSizing: 'border-box' as const,
        outline: 'none',
    },
    rowGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
    },
    selectWrapper: {
        position: 'relative' as const,
    },
    select: {
        width: '100%',
        padding: '16px',
        paddingRight: '40px',
        fontSize: '16px',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-primary)',
        boxSizing: 'border-box' as const,
        appearance: 'none' as const,
        cursor: 'pointer',
    },
    selectIcon: {
        position: 'absolute' as const,
        right: '16px',
        top: '50%',
        transform: 'translateY(-50%) rotate(90deg)',
        pointerEvents: 'none' as const,
    },
    buttonSection: {
        paddingTop: '24px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    saveButton: {
        width: '100%',
        padding: '16px',
        fontSize: '16px',
        fontWeight: '600',
        color: '#FFFFFF',
        backgroundColor: TOSS_BLUE,
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
    },
    passwordButton: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        fontSize: '15px',
        fontWeight: '500',
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-secondary)',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
    },
};

export default MyProfilePage;