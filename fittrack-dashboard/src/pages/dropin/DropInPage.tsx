import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { getDropInGyms, createDropInReservation } from '../../services/api';
import toast from 'react-hot-toast';
import { MapPin, CreditCard, ChevronLeft, ChevronRight, X, List, Map as MapIcon, Search, Navigation, ArrowUpDown, History } from 'lucide-react';
import { Map, MapMarker, CustomOverlayMap } from 'react-kakao-maps-sdk';

interface Gym {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    drop_in_price: number;
    description: string;
    drop_in_enabled: boolean;
    image_url?: string;
    location?: string;
}

const REGIONS = ['전체', '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const TOSS_BLUE = '#3182F6';

// 지역별 중심 좌표 및 최적 줌 레벨 (지역 전체가 잘 보이는 수준)
const REGION_SETTINGS: { [key: string]: { lat: number, lng: number, level: number } } = {
    '전체': { lat: 36.2, lng: 127.8, level: 13 }, // 한반도 전체
    '서울': { lat: 37.5665, lng: 126.9780, level: 8 },
    '경기': { lat: 37.4138, lng: 127.5183, level: 11 },
    '인천': { lat: 37.4563, lng: 126.7052, level: 9 },
    '부산': { lat: 35.1796, lng: 129.0756, level: 9 },
    '대구': { lat: 35.8714, lng: 128.6014, level: 9 },
    '광주': { lat: 35.1595, lng: 126.8526, level: 8 },
    '대전': { lat: 36.3504, lng: 127.3845, level: 8 },
    '울산': { lat: 35.5384, lng: 129.3114, level: 8 },
    '세종': { lat: 36.4800, lng: 127.2890, level: 8 },
    '강원': { lat: 37.7511, lng: 128.2092, level: 11 },
    '충북': { lat: 36.6350, lng: 127.4914, level: 10 },
    '충남': { lat: 36.5184, lng: 126.8000, level: 10 },
    '전북': { lat: 35.8205, lng: 127.1488, level: 10 },
    '전남': { lat: 34.8160, lng: 126.4629, level: 11 },
    '경북': { lat: 36.4919, lng: 128.8889, level: 11 },
    '경남': { lat: 35.2376, lng: 128.6919, level: 10 },
    '제주': { lat: 33.3617, lng: 126.5292, level: 10 },
};

export const DropInPage: React.FC = () => {
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [selectedRegion, setSelectedRegion] = useState('전체');
    const [allGyms, setAllGyms] = useState<Gym[]>([]); // 전체 데이터 저장
    const [gyms, setGyms] = useState<Gym[]>([]); // 현재 필터링된 데이터
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'distance'>('default');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [recentGymIds, setRecentGymIds] = useState<number[]>([]);

    // 초기 중심 및 줌 레벨 설정 (한반도 전체)
    const [center, setCenter] = useState({ lat: REGION_SETTINGS['전체'].lat, lng: REGION_SETTINGS['전체'].lng });
    const [level, setLevel] = useState(REGION_SETTINGS['전체'].level);

    // 1. 처음 마운트 될 때 전체 데이터를 한 번만 가져옵니다.
    useEffect(() => {
        fetchAllGyms();
        const savedRecent = localStorage.getItem('fittrack_recent_dropin_gyms');
        if (savedRecent) {
            try {
                const parsed = JSON.parse(savedRecent);
                if (Array.isArray(parsed)) {
                    setRecentGymIds(parsed);
                }
            } catch {
                // ignore malformed local storage
            }
        }
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                () => {
                    // ignore denied location
                },
                { enableHighAccuracy: false, timeout: 5000 }
            );
        }
    }, []);

    // 2. 지역이 변경되거나 전체 데이터가 로드되면 필터링을 수행합니다.
    useEffect(() => {
        let filtered = selectedRegion === '전체'
            ? [...allGyms]
            : allGyms.filter(gym =>
                (gym.address && gym.address.includes(selectedRegion)) ||
                (gym.location && gym.location.includes(selectedRegion))
            );

        if (searchTerm.trim()) {
            const keyword = searchTerm.trim().toLowerCase();
            filtered = filtered.filter((gym) =>
                gym.name.toLowerCase().includes(keyword) ||
                gym.address?.toLowerCase().includes(keyword) ||
                gym.location?.toLowerCase().includes(keyword)
            );
        }

        if (sortBy === 'price_asc') {
            filtered.sort((a, b) => a.drop_in_price - b.drop_in_price);
        } else if (sortBy === 'price_desc') {
            filtered.sort((a, b) => b.drop_in_price - a.drop_in_price);
        } else if (sortBy === 'distance' && userLocation) {
            filtered.sort((a, b) => getDistanceKm(a.latitude, a.longitude, userLocation.lat, userLocation.lng) - getDistanceKm(b.latitude, b.longitude, userLocation.lat, userLocation.lng));
        }
        setGyms(filtered);

        // 지도 이동 및 줌 레벨 설정
        const settings = REGION_SETTINGS[selectedRegion];
        if (settings) {
            setCenter({ lat: settings.lat, lng: settings.lng });
            setLevel(settings.level);
        }
    }, [selectedRegion, allGyms, searchTerm, sortBy, userLocation]);

    const fetchAllGyms = async () => {
        setIsDataLoading(true);
        try {
            // 지역 파라미터 없이 전체 목록 요청
            const res = await getDropInGyms();
            const mappedGyms = res.data.map((g: any) => ({
                ...g,
                address: g.address || g.location
            }));
            setAllGyms(mappedGyms);
        } catch (error) {
            console.error(error);
            toast.error('체육관 목록 로드 실패');
        } finally {
            setIsDataLoading(false);
        }
    };

    // 지역별 개수 계산 함수
    const getRegionCount = (region: string) => {
        if (region === '전체') return allGyms.length;
        return allGyms.filter(gym =>
            (gym.address && gym.address.includes(region)) ||
            (gym.location && gym.location.includes(region))
        ).length;
    };

    const handleReservation = async () => {
        if (!selectedGym || !reservationDate) {
            toast.error('날짜를 선택해주세요.');
            return;
        }

        if (!window.confirm(`${selectedGym.name}에 ${reservationDate} 드랍인을 예약하시겠습니까?\n가격: ${selectedGym.drop_in_price.toLocaleString()}원`)) {
            return;
        }

        try {
            await createDropInReservation({
                gym_id: selectedGym.id,
                date: reservationDate
            });
            toast.success('예약 신청이 완료되었습니다!');
            setShowReservationModal(false);
            setReservationDate('');
            setSelectedGym(null);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || '예약 실패');
        }
    };

    const [showReservationModal, setShowReservationModal] = useState(false);
    const [reservationDate, setReservationDate] = useState('');

    const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const toRad = (value: number) => (value * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const trackRecentGym = (gym: Gym) => {
        const nextIds = [gym.id, ...recentGymIds.filter((id) => id !== gym.id)].slice(0, 5);
        setRecentGymIds(nextIds);
        localStorage.setItem('fittrack_recent_dropin_gyms', JSON.stringify(nextIds));
    };

    const openGymReservation = (gym: Gym) => {
        setSelectedGym(gym);
        setShowReservationModal(true);
        trackRecentGym(gym);
    };

    const recentGyms = recentGymIds
        .map((id) => allGyms.find((gym) => gym.id === id))
        .filter((gym): gym is Gym => Boolean(gym));

    const handleScroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 200;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div style={styles.container}>
            {/* 상단 헤더 & 탭 */}
            <header style={styles.header}>
                <div style={styles.headerTop}>
                    <h1 style={styles.pageTitle}>드랍인 예약</h1>
                    <div style={styles.viewToggle}>
                        <button
                            style={viewMode === 'map' ? styles.activeToggle : styles.toggle}
                            onClick={() => setViewMode('map')}
                        >
                            <MapIcon size={16} /> 지도
                        </button>
                        <button
                            style={viewMode === 'list' ? styles.activeToggle : styles.toggle}
                            onClick={() => setViewMode('list')}
                        >
                            <List size={16} /> 리스트
                        </button>
                    </div>
                </div>

                {/* 지역 필터 */}
                <div style={styles.scrollWrapper}>
                    <button
                        style={{ ...styles.scrollBtn, left: 0, background: 'linear-gradient(to right, var(--bg-card) 60%, transparent)' }}
                        onClick={() => handleScroll('left')}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div ref={scrollRef} style={styles.filterScroll}>
                        {REGIONS.map(region => {
                            const count = getRegionCount(region);
                            return (
                                <button
                                    key={region}
                                    onClick={() => setSelectedRegion(region)}
                                    style={selectedRegion === region ? styles.activeFilter : styles.filterChip}
                                >
                                    {region} <span style={{ opacity: 0.6, fontSize: '12px', fontWeight: 'normal' }}>({count})</span>
                                </button>
                            );
                        })}
                    </div>
                    <button
                        style={{ ...styles.scrollBtn, right: 0, background: 'linear-gradient(to left, var(--bg-card) 60%, transparent)' }}
                        onClick={() => handleScroll('right')}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </header>

            {/* 메인 콘텐츠 영역 */}
            <main style={styles.main}>

                {/* 🗺️ 지도 뷰 */}
                {viewMode === 'map' && (
                    <div style={styles.mapContainer}>
                        {!window.kakao && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-secondary)', zIndex: 1, textAlign: 'center' }}>
                                🗺️ 지도를 불러오는 중입니다...<br />
                                (지속될 경우 도메인 등록을 확인해 주세요)
                            </div>
                        )}
                        <Map
                            center={center}
                            level={level}
                            style={{ width: '100%', height: '100%' }}
                            onCenterChanged={(map) => {
                                setCenter({
                                    lat: map.getCenter().getLat(),
                                    lng: map.getCenter().getLng(),
                                });
                            }}
                            onZoomChanged={(map) => {
                                setLevel(map.getLevel());
                            }}
                            onClick={() => setSelectedGym(null)}
                        >
                            {gyms.map((gym) => (
                                <React.Fragment key={gym.id}>
                                    <MapMarker
                                        position={{ lat: gym.latitude, lng: gym.longitude }}
                                        onClick={() => {
                                            setSelectedGym(gym);
                                            setCenter({ lat: gym.latitude, lng: gym.longitude });
                                            setLevel(3); // 마커 클릭 시 개별 체육관 상세 보기로 줌인
                                        }}
                                        image={{
                                            src: 'https://cdn-icons-png.flaticon.com/512/9131/9131546.png', // 눈에 띄는 분홍색 체육관 핀 아이콘
                                            size: { width: 50, height: 50 },
                                            options: { offset: { x: 25, y: 50 } }
                                        }}
                                    />

                                    {selectedGym?.id === gym.id && (
                                        <CustomOverlayMap position={{ lat: gym.latitude, lng: gym.longitude }} yAnchor={1.4}>
                                            <div style={styles.overlayCard}>
                                                <div style={styles.overlayTitle}>{gym.name}</div>
                                                <div style={styles.overlayAddress}>{gym.address}</div>
                                                <div style={styles.overlayPrice}>{gym.drop_in_price.toLocaleString()}원</div>
                                                <button
                                                    onClick={() => setShowReservationModal(true)}
                                                    style={styles.overlayButton}
                                                >
                                                    예약하기
                                                </button>
                                            </div>
                                        </CustomOverlayMap>
                                    )}
                                </React.Fragment>
                            ))}
                        </Map>
                    </div>
                )}

                {/* 📋 리스트 뷰 */}
                {viewMode === 'list' && (
                    <div style={styles.listContainer}>
                        <div style={styles.searchBar}>
                            <Search size={16} color="var(--text-tertiary)" />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="체육관 이름 또는 지역 검색"
                                style={styles.searchInput}
                            />
                        </div>

                        <div style={styles.sortRow}>
                            <div style={styles.sortChipLabel}>
                                <ArrowUpDown size={14} />
                                정렬
                            </div>
                            <button style={sortBy === 'default' ? styles.activeSortChip : styles.sortChip} onClick={() => setSortBy('default')}>기본</button>
                            <button style={sortBy === 'price_asc' ? styles.activeSortChip : styles.sortChip} onClick={() => setSortBy('price_asc')}>가격 낮은순</button>
                            <button style={sortBy === 'price_desc' ? styles.activeSortChip : styles.sortChip} onClick={() => setSortBy('price_desc')}>가격 높은순</button>
                            {userLocation && (
                                <button style={sortBy === 'distance' ? styles.activeSortChip : styles.sortChip} onClick={() => setSortBy('distance')}>가까운순</button>
                            )}
                        </div>

                        {recentGyms.length > 0 && (
                            <div style={styles.recentSection}>
                                <div style={styles.recentHeader}>
                                    <History size={16} color={TOSS_BLUE} />
                                    최근 본 박스
                                </div>
                                <div style={styles.recentChips}>
                                    {recentGyms.map((gym) => (
                                        <button key={`recent-${gym.id}`} style={styles.recentChip} onClick={() => openGymReservation(gym)}>
                                            {gym.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isDataLoading ? (
                            <div style={styles.loading}>로딩 중...</div>
                        ) : gyms.length === 0 ? (
                            <div style={styles.emptyState}>등록된 체육관이 없습니다.</div>
                        ) : (
                            gyms.map(gym => (
                                <div key={gym.id} style={styles.gymCard} onClick={() => {
                                    openGymReservation(gym);
                                }}>
                                    <div style={styles.gymCardContent}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <h3 style={styles.cardTitle}>{gym.name}</h3>
                                            <span style={styles.badge}>Drop-in</span>
                                        </div>
                                        <p style={styles.cardLocation}><MapPin size={14} style={{ marginRight: 4 }} /> {gym.address}</p>
                                        <p style={styles.cardPrice}><CreditCard size={14} style={{ marginRight: 4 }} /> {gym.drop_in_price.toLocaleString()}원</p>
                                        {userLocation && (
                                            <p style={styles.cardDistance}>
                                                <Navigation size={13} style={{ marginRight: 4 }} />
                                                약 {getDistanceKm(gym.latitude, gym.longitude, userLocation.lat, userLocation.lng).toFixed(1)}km
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight size={20} color="#9CA3AF" />
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 📅 예약 모달 (하단 시트) */}
                {showReservationModal && selectedGym && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.bottomSheet}>
                            <div style={styles.sheetHeader}>
                                <h2 style={styles.sheetTitle}>{selectedGym.name} 예약</h2>
                                <button
                                    onClick={() => setShowReservationModal(false)}
                                    style={styles.closeBtn}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={styles.label}>날짜 선택</label>
                                <input
                                    type="date"
                                    value={reservationDate}
                                    onChange={(e) => setReservationDate(e.target.value)}
                                    style={styles.dateInput}
                                />
                            </div>

                            <div style={styles.priceRow}>
                                <span style={{ color: 'var(--text-secondary)' }}>결제 금액</span>
                                <span style={styles.totalPrice}>
                                    {selectedGym.drop_in_price.toLocaleString()}원
                                </span>
                            </div>

                            <button
                                onClick={handleReservation}
                                style={styles.confirmButton}
                            >
                                예약 및 결제하기
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 60px)',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        position: 'relative',
    },
    header: {
        padding: '16px 20px 10px',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        zIndex: 10,
    },
    headerTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
    },
    pageTitle: {
        fontSize: '20px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
    },
    viewToggle: {
        display: 'flex',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        padding: '2px',
    },
    toggle: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        border: 'none',
        background: 'none',
        padding: '6px 12px',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        borderRadius: '6px',
    },
    activeToggle: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        border: 'none',
        background: 'var(--bg-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '6px 12px',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        borderRadius: '6px',
    },
    scrollWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    scrollBtn: {
        position: 'absolute',
        top: 0,
        bottom: 8,
        width: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'pointer',
        zIndex: 2,
        color: 'var(--text-secondary)',
    },
    filterScroll: {
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        paddingLeft: '40px', // ✅ 좌측 버튼 공간 확보
        paddingRight: '40px', // ✅ 우측 버튼 공간 확보
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
    },
    filterChip: {
        flex: '0 0 auto',
        padding: '8px 16px',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-secondary)',
        fontSize: '14px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    activeFilter: {
        flex: '0 0 auto',
        padding: '8px 16px',
        borderRadius: '20px',
        border: `1px solid ${TOSS_BLUE}`,
        backgroundColor: 'rgba(49, 130, 246, 0.1)',
        color: TOSS_BLUE,
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    main: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    mapContainer: {
        width: '100%',
        height: '100%',
        minHeight: '400px', // ✅ 최소 높이 보장
        position: 'relative',
    },
    listContainer: {
        padding: '20px',
        overflowY: 'auto',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
    },
    searchBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: '12px 14px',
        marginBottom: '12px',
    },
    searchInput: {
        flex: 1,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
    },
    sortRow: {
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        marginBottom: '14px',
        paddingBottom: '4px',
    },
    sortChipLabel: {
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        color: 'var(--text-tertiary)',
        padding: '8px 4px',
    },
    sortChip: {
        flex: '0 0 auto',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-secondary)',
        borderRadius: '999px',
        padding: '8px 12px',
        fontSize: '13px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    activeSortChip: {
        flex: '0 0 auto',
        border: `1px solid ${TOSS_BLUE}`,
        backgroundColor: 'rgba(49, 130, 246, 0.12)',
        color: TOSS_BLUE,
        borderRadius: '999px',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: '700',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    recentSection: {
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '14px',
        marginBottom: '14px',
        border: '1px solid var(--border-color)',
    },
    recentHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        marginBottom: '10px',
    },
    recentChips: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap' as const,
    },
    recentChip: {
        border: 'none',
        backgroundColor: '#E8F3FF',
        color: TOSS_BLUE,
        borderRadius: '999px',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    loading: {
        textAlign: 'center',
        padding: '2rem',
        color: 'var(--text-secondary)',
    },
    emptyState: {
        textAlign: 'center',
        padding: '2rem',
        color: 'var(--text-secondary)',
    },
    gymCard: {
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--border-color)',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    },
    gymCardContent: {
        flex: 1,
        marginRight: '16px',
    },
    cardTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
    },
    badge: {
        backgroundColor: 'rgba(49, 130, 246, 0.1)',
        color: TOSS_BLUE,
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.8rem',
        fontWeight: '600',
    },
    cardLocation: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        margin: '4px 0',
        display: 'flex',
        alignItems: 'center',
    },
    cardPrice: {
        fontSize: '14px',
        fontWeight: '600',
        color: TOSS_BLUE,
        margin: 0,
        display: 'flex',
        alignItems: 'center',
    },
    cardDistance: {
        fontSize: '12px',
        color: 'var(--text-tertiary)',
        margin: '6px 0 0 0',
        display: 'flex',
        alignItems: 'center',
    },
    overlayCard: {
        backgroundColor: 'var(--bg-card)',
        padding: '12px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid var(--border-color)',
        minWidth: '200px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    overlayTitle: {
        fontWeight: 'bold',
        fontSize: '1rem',
        color: 'var(--text-primary)',
    },
    overlayAddress: {
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
    },
    overlayPrice: {
        fontSize: '0.9rem',
        color: TOSS_BLUE,
        fontWeight: '600',
        marginBottom: '4px',
    },
    overlayButton: {
        width: '100%',
        padding: '6px',
        backgroundColor: TOSS_BLUE,
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '0.85rem',
        cursor: 'pointer',
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 999,
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--bg-card)',
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        padding: '24px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        zIndex: 1000,
        animation: 'slideUp 0.3s ease-out',
    },
    sheetHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
    },
    sheetTitle: {
        fontSize: '1.25rem',
        fontWeight: 'bold',
        margin: 0,
    },
    closeBtn: {
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
    },
    label: {
        display: 'block',
        marginBottom: '0.5rem',
        fontWeight: '600',
        color: 'var(--text-secondary)',
    },
    dateInput: {
        width: '100%',
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        fontSize: '1rem',
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
    },
    priceRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '10px',
    },
    totalPrice: {
        fontSize: '1.25rem',
        fontWeight: 'bold',
        color: TOSS_BLUE,
    },
    confirmButton: {
        width: '100%',
        padding: '1rem',
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
    },
};
