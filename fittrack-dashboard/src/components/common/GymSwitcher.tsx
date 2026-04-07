import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { ChevronDown } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

const GymSwitcher: React.FC = () => {
    const { user, switchGym } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 외부 클릭 시 드롭다운 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const availableGyms = user?.available_gyms || [];

    // 가입된 체육관이 하나 이하면 스위처를 보여주지 않음
    if (availableGyms.length <= 1) {
        return null;
    }

    const currentGym = availableGyms.find((g: any) => g.id === user?.gym_id) || { name: '알 수 없음' };

    const handleSwitch = async (gymId: number) => {
        if (gymId === user?.gym_id) {
            setIsOpen(false);
            return;
        }

        try {
            await switchGym(gymId);
        } catch (error) {
            alert("체육관 전환에 실패했습니다.");
        }
    };

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    height: '40px',
                }}
            >
                <span style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentGym.name}
                </span>
                <ChevronDown size={16} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    minWidth: '200px',
                    overflow: 'hidden'
                }}>
                    {availableGyms.map((gym: any) => (
                        <div
                            key={gym.id}
                            onClick={() => handleSwitch(gym.id)}
                            style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border-color)',
                                backgroundColor: gym.id === user?.gym_id ? 'var(--bg-secondary)' : 'transparent',
                                color: gym.id === user?.gym_id ? TOSS_BLUE : 'var(--text-primary)',
                                fontWeight: gym.id === user?.gym_id ? 'bold' : '500',
                                transition: 'background-color 0.2s',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                            onMouseEnter={(e) => {
                                if (gym.id !== user?.gym_id) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                            }}
                            onMouseLeave={(e) => {
                                if (gym.id !== user?.gym_id) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <span>{gym.name}</span>
                            {gym.id === user?.gym_id && <span style={{ fontSize: '10px', backgroundColor: TOSS_BLUE, color: 'white', padding: '2px 6px', borderRadius: '4px' }}>현재</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GymSwitcher;
