import React, { useState, useRef, useEffect } from 'react';

interface ScrollAnimationProps {
    goal: string;
}

const ScrollAnimation: React.FC<ScrollAnimationProps> = ({ goal }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [contentHeight, setContentHeight] = useState(350);
    const textRef = useRef<HTMLDivElement>(null);

    // 족자 색상 테마
    const woodColor = 'linear-gradient(to right, #4a3b2a, #8b5a2b, #4a3b2a)';
    const paperColor = '#fffdf5';
    const paperTexture = 'url("https://www.transparenttextures.com/patterns/cream-paper.png")';

    // 텍스트 길이에 따라 높이 계산
    useEffect(() => {
        if (textRef.current) {
            const textHeight = textRef.current.getBoundingClientRect().height;
            const calculatedHeight = Math.max(350, Math.min(textHeight + 200, 800));
            setContentHeight(calculatedHeight);
        }
    }, [goal]);

    const scrollWidth = 120;
    const rodWidth = 150;

    return (
        <div
            className="scroll-banner"
            style={{
                width: `${rodWidth}px`
            }}
            onClick={() => setIsOpen(!isOpen)}
        >
            {/* 1. 상단 족자 봉 */}
            <div style={{
                width: `${rodWidth}px`, height: '28px',
                background: woodColor,
                borderRadius: '14px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                zIndex: 12,
                position: 'relative'
            }}>
                {/* 끈 (고리) */}
                <div style={{
                    position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
                    width: '6px', height: '24px', backgroundColor: '#8b0000',
                    zIndex: -1
                }}></div>
                <div style={{
                    position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
                    width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#333',
                    border: '3px solid #8b0000'
                }}></div>
            </div>

            {/* 2. 족자 본문 */}
            <div style={{
                width: `${scrollWidth}px`,
                height: isOpen ? `${contentHeight}px` : '0px',
                backgroundColor: paperColor,
                backgroundImage: paperTexture,
                overflow: 'hidden',
                transition: 'height 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                zIndex: 11,
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
                borderLeft: '1px solid #e0d0b0',
                borderRight: '1px solid #e0d0b0',
            }}>
                {/* 텍스트 컨테이너 */}
                <div
                    ref={textRef}
                    style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'upright',
                        fontFamily: "'Gowun Batang', 'Batang', serif",
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#2c2c2c',
                        letterSpacing: '0.4rem',
                        lineHeight: '1.5',
                        opacity: isOpen ? 1 : 0,
                        transition: 'opacity 0.5s ease-in 0.3s',
                        marginTop: '50px',
                        marginLeft: '20px',
                        marginRight: 'auto',
                        whiteSpace: 'nowrap',
                        height: 'auto',
                        alignSelf: 'flex-start'
                    }}
                >
                    {goal}
                </div>

                {/* 낙관 - 오른쪽 하단 */}
                <div style={{
                    position: 'absolute', bottom: '30px', right: '15px',
                    width: '40px', height: '40px',
                    border: '3px solid #bf2626',
                    borderRadius: '6px',
                    color: '#bf2626',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: '14px', fontWeight: 'bold',
                    opacity: isOpen ? 0.8 : 0,
                    transition: 'opacity 0.5s ease-in 0.5s',
                    writingMode: 'horizontal-tb',
                    backgroundColor: 'rgba(255, 255, 255, 0.5)'
                }}>
                    필승
                </div>
            </div>

            {/* 3. 하단 족자 봉 */}
            <div style={{
                width: `${rodWidth}px`, height: '28px',
                background: woodColor,
                borderRadius: '14px',
                boxShadow: '0 -2px 4px rgba(0,0,0,0.2)',
                zIndex: 12,
                marginTop: '-4px'
            }}></div>
        </div>
    );
};

export default ScrollAnimation;
