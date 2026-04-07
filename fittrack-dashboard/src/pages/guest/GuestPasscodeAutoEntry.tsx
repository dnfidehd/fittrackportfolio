import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

const GuestPasscodeAutoEntry: React.FC = () => {
    const navigate = useNavigate();
    const { alias } = useParams();

    useEffect(() => {
        const autoVerify = async () => {
            // alias가 'open2026'이면 실제 패스코드로 변환 (보안보다는 편의성 목적)
            let passcode = '';
            let keyword = '';

            if (alias === 'open2026') {
                passcode = 'daegaopen2026';
                keyword = '대가오픈';
            } else if (alias === 'test') {
                passcode = '123456';
                keyword = '테스트';
            }

            if (!passcode) {
                navigate('/guest/entry');
                return;
            }

            const loadingToast = toast.loading('대회 정보 불러오는 중...');
            try {
                // 추가: 대회 목록을 먼저 조회하여 ID를 확보
                const compRes = await api.get('/api/competitions/guest/available');
                const comps = compRes.data;
                const targetComp = comps.find((c: any) => c.title.includes(keyword));

                if (!targetComp) throw new Error("대회를 찾을 수 없습니다.");

                const res = await api.post('/api/competitions/guest/verify', {
                    competition_id: targetComp.id,
                    passcode
                });

                localStorage.setItem('guest_session', JSON.stringify({
                    passcode,
                    competition_id: targetComp.id,
                    competition: res.data.competition,
                    events: res.data.events
                }));
                toast.success('어서오세요! 🏋️‍♂️', { id: loadingToast });
                navigate('/guest/profile'); // ✅ [수정] 프로필 입력으로 이동
            } catch (error) {
                toast.error('대회 접속에 실패했습니다.', { id: loadingToast });
                navigate('/guest/entry');
            }
        };

        autoVerify();
    }, [alias, navigate]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F2F4F6' }}>
            <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ marginBottom: '20px' }}></div>
                <p style={{ color: '#8B95A1', fontWeight: 'bold' }}>대회 리더보드로 연결 중...</p>
            </div>
        </div>
    );
};

export default GuestPasscodeAutoEntry;
