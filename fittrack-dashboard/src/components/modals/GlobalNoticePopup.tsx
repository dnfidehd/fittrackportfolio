import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; // ✅ Portal 사용을 위해 추가
import { getActivePopup } from '../../services/api';
import { PostResponse } from '../../types';
import { X, Bell, ExternalLink } from 'lucide-react';

import { useAppContext } from '../../contexts/AppContext';

const GlobalNoticePopup: React.FC = () => {
    const { user } = useAppContext(); // ✅ 유저 정보 가져오기
    const [notice, setNotice] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 비로그인 상태면 팝업 조회 안 함
        if (!user) return;
        // ✅ [수정] 총관리자는 팝업 보지 않음
        if (user.role === 'superadmin') return;

        const fetchActivePopup = async () => {
            try {
                const res = await getActivePopup();
                const activeNotice = res.data;

                if (activeNotice) {
                    // '오늘 하루 보지 않기' 체크
                    const hideUntil = localStorage.getItem(`hide_notice_${activeNotice.id}`);
                    const now = new Date().getTime();

                    if (!hideUntil || now > parseInt(hideUntil)) {
                        setNotice(activeNotice);
                        setIsVisible(true);
                    }
                }
            } catch (error) {
                console.error("팝업 공지 로드 실패:", error);
            }
        };

        fetchActivePopup();
    }, [user]); // user가 변경될 때마다(로그인 시) 실행

    const handleClose = () => {
        setIsVisible(false);
    };

    const handleHideToday = () => {
        if (notice) {
            // 내일 오전 0시까지 숨기기 계산
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            localStorage.setItem(`hide_notice_${notice.id}`, tomorrow.getTime().toString());
            setIsVisible(false);
        }
    };

    if (!isVisible || !notice) return null;

    if (!isVisible || !notice) return null;

    // ✅ Portal을 사용하여 document.body 바로 아래에 렌더링 (z-index 문제 해결)
    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)', // 반투명 배경
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999, // 최상단 보장
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                width: '90%',
                maxWidth: '400px',
                borderRadius: '20px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                position: 'relative',
                animation: 'slideUp 0.3s ease-out'
            }}>
                {/* 헤더 */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px',
                    backgroundColor: '#18181b', // zinc-900
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            backgroundColor: '#facc15', // yellow-400
                            padding: '8px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 6px -1px rgba(250, 204, 21, 0.2)'
                        }}>
                            <Bell size={20} color="#18181b" fill="#18181b" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>시스템 공지</h3>
                            <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa' }}>FitTrack Announcement</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* 본문 */}
                <div style={{
                    padding: '24px',
                    maxHeight: '60vh',
                    overflowY: 'auto'
                }}>
                    <h2 style={{
                        margin: '0 0 12px 0',
                        fontSize: '20px',
                        fontWeight: '800',
                        color: '#18181b'
                    }}>
                        {notice.title}
                    </h2>
                    <div style={{
                        whiteSpace: 'pre-wrap',
                        color: '#52525b', // zinc-600
                        lineHeight: '1.6',
                        fontSize: '15px'
                    }}>
                        {notice.content}
                    </div>

                    {notice.image_url && (
                        <div style={{
                            marginTop: '16px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid #f4f4f5'
                        }}>
                            <img
                                src={notice.image_url.startsWith('http') ? notice.image_url : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${notice.image_url}`}
                                alt="공지 이미지"
                                style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                            />
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div style={{
                    padding: '16px',
                    backgroundColor: '#fafafa', // zinc-50
                    borderTop: '1px solid #f4f4f5',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <button
                        onClick={handleClose}
                        style={{
                            width: '100%',
                            padding: '14px',
                            backgroundColor: '#18181b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'transform 0.1s'
                        }}
                    >
                        확인했습니다
                    </button>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        color: '#a1a1aa',
                        padding: '0 8px'
                    }}>
                        <button
                            onClick={handleHideToday}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#71717a',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                fontSize: '13px'
                            }}
                        >
                            오늘 하루 보지 않기
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            CrossFit FitTrack AI <ExternalLink size={12} />
                        </span>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default GlobalNoticePopup;
