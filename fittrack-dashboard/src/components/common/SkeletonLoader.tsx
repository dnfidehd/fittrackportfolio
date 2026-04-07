// src/components/common/SkeletonLoader.tsx
import React from 'react';

interface SkeletonProps {
    variant?: 'card' | 'text' | 'circle' | 'button';
    width?: string;
    height?: string;
    count?: number;
}

const SkeletonLoader: React.FC<SkeletonProps> = ({
    variant = 'text',
    width,
    height,
    count = 1
}) => {
    const baseStyle: React.CSSProperties = {
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: variant === 'circle' ? '50%' : '8px',
        animation: 'shimmer 1.5s infinite',
        position: 'relative',
        overflow: 'hidden',
    };

    const getSize = () => {
        switch (variant) {
            case 'card':
                return { width: width || '100%', height: height || '120px' };
            case 'text':
                return { width: width || '100%', height: height || '16px' };
            case 'circle':
                return { width: width || '50px', height: height || '50px' };
            case 'button':
                return { width: width || '100px', height: height || '44px' };
            default:
                return { width: width || '100%', height: height || '16px' };
        }
    };

    const shimmerStyle: React.CSSProperties = {
        ...baseStyle,
        ...getSize(),
        marginBottom: variant === 'text' ? '8px' : '0',
    };

    return (
        <>
            <style>
                {`
                    @keyframes shimmer {
                        0% { background-position: -200px 0; }
                        100% { background-position: 200px 0; }
                    }
                    .skeleton-shimmer {
                        background: linear-gradient(
                            90deg,
                            var(--bg-secondary) 0%,
                            var(--bg-hover) 50%,
                            var(--bg-secondary) 100%
                        );
                        background-size: 400px 100%;
                    }
                `}
            </style>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="skeleton-shimmer"
                    style={shimmerStyle}
                />
            ))}
        </>
    );
};

// 대시보드용 스켈레톤 카드
export const DashboardSkeleton: React.FC = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
                backgroundColor: 'var(--bg-card)',
                padding: '1.5rem',
                borderRadius: '16px',
                border: '1px solid var(--border-color)'
            }}>
                <SkeletonLoader variant="text" width="60%" height="20px" />
                <div style={{ marginTop: '1rem' }}>
                    <SkeletonLoader variant="text" width="100%" height="14px" count={2} />
                </div>
            </div>
        ))}
    </div>
);

// 리스트용 스켈레톤
export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{
                backgroundColor: 'var(--bg-card)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
            }}>
                <SkeletonLoader variant="circle" width="40px" height="40px" />
                <div style={{ flex: 1 }}>
                    <SkeletonLoader variant="text" width="70%" height="16px" />
                    <SkeletonLoader variant="text" width="40%" height="12px" />
                </div>
            </div>
        ))}
    </div>
);

export default SkeletonLoader;
