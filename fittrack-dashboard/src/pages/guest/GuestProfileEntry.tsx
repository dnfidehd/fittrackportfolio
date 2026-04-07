import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

const GuestProfileEntry: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<'phone' | 'profile'>('phone');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [gender, setGender] = useState<'M' | 'F' | ''>('');
    const [gymName, setGymName] = useState(''); // ✅ [신규]
    // ✅ [수정] 전체 체육관 대신 { id, name } 형태의 가벼운 타입 사용
    const [gyms, setGyms] = useState<{ id: number; name: string }[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // 이미 정보가 있다면 자동 입력 (수정 가능)
        const savedName = localStorage.getItem('guest_name');
        if (savedName) setName(savedName);

        const savedInfo = localStorage.getItem('guest_info');
        if (savedInfo) {
            const parsed = JSON.parse(savedInfo);
            if (parsed.phone) {
                setPhone(parsed.phone);
                // 이미 전화번호가 있으면 바로 프로필 단계로 이동
                setStep('profile');
            }
            if (parsed.gender) setGender(parsed.gender);
            if (parsed.gymName) setGymName(parsed.gymName); // ✅ [신규]
        }

        // ✅ [수정] 대회에 참가한 체육관만 가져오기
        fetchCompetitionGyms();
    }, []);

    const fetchCompetitionGyms = async () => {
        try {
            // guest_session에서 대회 ID를 가져와 해당 대회의 체육관만 조회
            const session = localStorage.getItem('guest_session');
            if (!session) return;
            const { competition } = JSON.parse(session);
            if (!competition?.id) return;

            const response = await api.get(`/api/competitions/guest/competition-gyms?competition_id=${competition.id}`);
            setGyms(response.data);
        } catch (error) {
            console.error('대회 체육관 목록 조회 실패:', error);
        }
    };

    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone.trim()) { toast.error('전화번호를 입력해주세요'); return; }
        if (phone.length < 10) { toast.error('올바른 전화번호를 입력해주세요'); return; }

        setLoading(true);
        try {
            // 전화번호로 기존 프로필 조회
            const response = await api.get(`/api/competitions/guest/profile?phone=${phone}`);
            if (response.data) {
                setName(response.data.name);
                setGender(response.data.gender);
                if (response.data.gym_name) setGymName(response.data.gym_name); // ✅ [신규]
                toast.success(`반가워요, ${response.data.name}님! 👋`);
            }
        } catch (error) {
            // 정보가 없으면 신규 입력 (에러 아님)
            // toast('신규 게스트시군요! 프로필을 설정해주세요.');
        } finally {
            setLoading(false);
            setStep('profile');
        }
    };

    const handleProfileSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) { toast.error('이름을 입력해주세요'); return; }
        if (!gender) { toast.error('성별을 선택해주세요'); return; }

        setLoading(true);

        // 로컬 스토리지에 저장
        localStorage.setItem('guest_name', name.trim());
        localStorage.setItem('guest_info', JSON.stringify({
            phone: phone.trim(),
            gender: gender,
            gymName: gymName // ✅ [신규]
        }));

        toast.success('설정 완료! 리더보드로 이동합니다. 🚀');

        // 잠시 후 리더보드로 이동
        setTimeout(() => {
            navigate('/guest/scores');
        }, 500);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.replace(/[^0-9]/g, '');
        if (input.length <= 11) {
            setPhone(input);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.title}>게스트 프로필 설정</h1>
                <p style={styles.subtitle}>
                    {step === 'phone' ? '본인 확인을 위해 전화번호를 입력해주세요.' : '리더보드에 표시될 정보를 확인해주세요.'}
                </p>

                {step === 'phone' ? (
                    <form onSubmit={handlePhoneSubmit} style={styles.form}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>전화번호 (숫자만)</label>
                            <input
                                style={styles.input}
                                placeholder="01012345678"
                                value={phone}
                                onChange={handlePhoneChange}
                                type="tel"
                                autoFocus
                            />
                        </div>
                        <button type="submit" style={styles.submitBtn} disabled={loading}>
                            {loading ? '확인 중...' : '다음'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleProfileSubmit} style={styles.form}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>전화번호</label>
                            <div style={{ ...styles.input, backgroundColor: '#F9FAFB', color: '#8B95A1' }}>
                                {phone}
                                <span onClick={() => setStep('phone')} style={{ float: 'right', fontSize: '13px', color: '#3182F6', cursor: 'pointer', marginTop: '2px' }}>변경</span>
                            </div>
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>이름</label>
                            <input
                                style={styles.input}
                                placeholder="홍길동"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        {/* ✅ [신규] 박스 선택 */}
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>소속 박스</label>
                            <select
                                style={styles.input}
                                value={gymName}
                                onChange={(e) => setGymName(e.target.value)}
                            >
                                <option value="">박스를 선택해주세요 (선택)</option>
                                {gyms.map((gym) => (
                                    <option key={gym.id} value={gym.name}>
                                        {gym.name}
                                    </option>
                                ))}
                                <option value="Other">기타 (목록에 없음)</option>
                            </select>
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>성별</label>
                            <div style={styles.genderContainer}>
                                <button
                                    type="button"
                                    style={gender === 'M' ? styles.genderBtnActive : styles.genderBtn}
                                    onClick={() => setGender('M')}
                                >
                                    👨 남성
                                </button>
                                <button
                                    type="button"
                                    style={gender === 'F' ? styles.genderBtnActive : styles.genderBtn}
                                    onClick={() => setGender('F')}
                                >
                                    👩 여성
                                </button>
                            </div>
                        </div>

                        <button type="submit" style={styles.submitBtn} disabled={loading}>
                            {loading ? '저장 중...' : '입장하기'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#F2F4F6',
        padding: '20px'
    },
    card: {
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
    },
    title: {
        fontSize: '24px',
        fontWeight: '800',
        color: '#191F28',
        marginBottom: '8px',
        textAlign: 'center'
    },
    subtitle: {
        fontSize: '15px',
        color: '#8B95A1',
        marginBottom: '32px',
        textAlign: 'center'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    label: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#4E5968'
    },
    input: {
        padding: '16px',
        fontSize: '16px',
        border: '1px solid #E5E8EB',
        borderRadius: '12px',
        outline: 'none',
        transition: 'border-color 0.2s'
    },
    genderContainer: {
        display: 'flex',
        gap: '12px'
    },
    genderBtn: {
        flex: 1,
        padding: '16px',
        fontSize: '16px',
        fontWeight: '600',
        color: '#8B95A1',
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E8EB',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    genderBtnActive: {
        flex: 1,
        padding: '16px',
        fontSize: '16px',
        fontWeight: '700',
        color: '#3182F6',
        backgroundColor: '#E8F3FF',
        border: '1px solid #3182F6',
        borderRadius: '12px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(49, 130, 246, 0.1)'
    },
    submitBtn: {
        marginTop: '16px',
        width: '100%',
        padding: '18px',
        fontSize: '16px',
        fontWeight: '700',
        color: '#FFFFFF',
        backgroundColor: '#3182F6',
        border: 'none',
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'background 0.2s'
    }
};

export default GuestProfileEntry;
