import { useIsMobile } from '../../hooks/useIsMobile';
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '../../contexts/AppContext';
import { getWod, createWod, updateWod, deleteWod, getWeeklyWods, getWodHistoryByTitle, createWodRecord, getMyWodRecords } from '../../services/api';
import { Wod, WodRecord } from '../../types';
import { ChevronLeft, ChevronRight, Youtube, Plus, Trash2, X, Video, Calendar, Clock, Users, Sparkles, GripVertical } from 'lucide-react';
import { generateAiWod } from '../../services/api'; // ✅ API import 추가
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import { hasFullAdminAccess, isUserRole } from '../../utils/roles';

const TOSS_BLUE = '#3182F6';

// === 🏋️‍♂️ 운동 데이터베이스 ===
// === 🏋️‍♂️ 운동 데이터베이스 ===
const MOVEMENT_DB = [
    // --- Weightlifting (역도/웨이트) ---
    { name: 'Deadlift', keywords: ['deadlift', '데드리프트', '데드', 'dl'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Sumo Deadlift', keywords: ['sumo dl', '스모데드'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Clean', keywords: ['clean', '클린', 'squat clean', 'power clean'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Power Clean', keywords: ['power clean', '파워크린'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Hang Clean', keywords: ['hang clean', '행클린'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Squat Clean', keywords: ['squat clean', '스쿼트클린'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Clean and Jerk', keywords: ['clean and jerk', 'c&j', '클린앤저크', '용상'], part: 'full', mechanic: 'push', modality: 'W' },
    { name: 'Snatch', keywords: ['snatch', '스내치', '인상'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Power Snatch', keywords: ['power snatch', '파워스내치'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Hang Snatch', keywords: ['hang snatch', '행스내치'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Squat Snatch', keywords: ['squat snatch', '스쿼트스내치'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Dumbbell Snatch', keywords: ['db snatch', '덤벨스내치'], part: 'full', mechanic: 'pull', modality: 'W' },
    { name: 'Kettlebell Swing', keywords: ['swing', '스윙', 'kbs'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Russian Kettlebell Swing', keywords: ['russian swing', '러시안스윙'], part: 'lower', mechanic: 'pull', modality: 'W' },
    { name: 'Back Squat', keywords: ['back squat', '백스쿼트', '스쿼트', 'bs'], part: 'lower', mechanic: 'push', modality: 'W' },
    { name: 'Front Squat', keywords: ['front squat', '프론트스쿼트', 'fs'], part: 'lower', mechanic: 'push', modality: 'W' },
    { name: 'Overhead Squat', keywords: ['overhead squat', 'ohs', '오버헤드스쿼트'], part: 'lower', mechanic: 'push', modality: 'W' },
    { name: 'Wall Ball Shot', keywords: ['wall ball', '월볼', 'wbs'], part: 'lower', mechanic: 'push', modality: 'W' },
    { name: 'Shoulder Press', keywords: ['shoulder press', 'strict press', '숄더프레스', '프레스'], part: 'upper', mechanic: 'push', modality: 'W' },
    { name: 'Push Press', keywords: ['push press', '푸쉬프레스'], part: 'upper', mechanic: 'push', modality: 'W' },
    { name: 'Push Jerk', keywords: ['push jerk', '푸쉬저크'], part: 'upper', mechanic: 'push', modality: 'W' },
    { name: 'Split Jerk', keywords: ['split jerk', '스플릿저크'], part: 'upper', mechanic: 'push', modality: 'W' },
    { name: 'Thruster', keywords: ['thruster', '쓰러스터'], part: 'full', mechanic: 'push', modality: 'W' },
    { name: 'Cluster', keywords: ['cluster', '클러스터'], part: 'full', mechanic: 'push', modality: 'W' },
    { name: 'Dumbbell Thruster', keywords: ['db thruster', '덤벨쓰러스터'], part: 'full', mechanic: 'push', modality: 'W' },
    { name: 'Man Maker', keywords: ['man maker', '맨메이커'], part: 'full', mechanic: 'push', modality: 'W' },
    { name: 'Bench Press', keywords: ['bench press', '벤치프레스', 'bp'], part: 'upper', mechanic: 'push', modality: 'W' },
    { name: 'Turkish Get-up', keywords: ['tgu', '터키쉬겟업'], part: 'full', mechanic: 'push', modality: 'W' },
    { name: 'Farmer Carry', keywords: ['farmer carry', '파머캐리'], part: 'full', mechanic: 'pull', modality: 'W' },
    { name: 'Overhead Lunge', keywords: ['overhead lunge', 'ohl'], part: 'lower', mechanic: 'push', modality: 'W' },
    { name: 'Walking Lunge', keywords: ['walking lunge', '런지'], part: 'lower', mechanic: 'push', modality: 'W' },

    // --- Gymnastics (체조/맨몸) ---
    { name: 'Pull-up', keywords: ['pull-up', 'pull up', '풀업', '턱걸이'], part: 'upper', mechanic: 'pull', modality: 'G' },
    { name: 'Strict Pull-up', keywords: ['strict pull-up', '스트릭풀업'], part: 'upper', mechanic: 'pull', modality: 'G' },
    { name: 'Chest to Bar', keywords: ['chest to bar', 'ctb', 'c2b'], part: 'upper', mechanic: 'pull', modality: 'G' },
    { name: 'Butterfly Pull-up', keywords: ['butterfly', '버터플라이'], part: 'upper', mechanic: 'pull', modality: 'G' },
    { name: 'Bar Muscle-up', keywords: ['bar muscle', 'bmu', '바머슬업'], part: 'upper', mechanic: 'pull', modality: 'G' },
    { name: 'Ring Muscle-up', keywords: ['ring muscle', 'rmu', '링머슬업'], part: 'upper', mechanic: 'pull', modality: 'G' },
    { name: 'Push-up', keywords: ['push-up', 'push up', '푸쉬업', '팔굽혀펴기'], part: 'upper', mechanic: 'push', modality: 'G' },
    { name: 'Handstand Push-up', keywords: ['hspu', '핸푸', '핸드스탠드푸쉬업'], part: 'upper', mechanic: 'push', modality: 'G' },
    { name: 'Strict HSPU', keywords: ['strict hspu', '스트릭핸푸'], part: 'upper', mechanic: 'push', modality: 'G' },
    { name: 'Ring Dip', keywords: ['ring dip', '링딥'], part: 'upper', mechanic: 'push', modality: 'G' },
    { name: 'Bar Dip', keywords: ['bar dip', '바딥'], part: 'upper', mechanic: 'push', modality: 'G' },
    { name: 'Air Squat', keywords: ['air squat', '에어스쿼트', '맨몸스쿼트'], part: 'lower', mechanic: 'push', modality: 'G' },
    { name: 'Pistol Squat', keywords: ['pistol', '피스톨', '한발스쿼트'], part: 'lower', mechanic: 'push', modality: 'G' },
    { name: 'Burpee', keywords: ['burpee', '버피'], part: 'full', mechanic: 'push', modality: 'G' },
    { name: 'Burpee Over Bar', keywords: ['bob', '버피오버바'], part: 'full', mechanic: 'push', modality: 'G' },
    { name: 'Box Jump', keywords: ['box jump', 'bj', '박스점프'], part: 'lower', mechanic: 'push', modality: 'G' },
    { name: 'Box Jump Over', keywords: ['bjo', '박스점프오버'], part: 'lower', mechanic: 'push', modality: 'G' },
    { name: 'Toes to Bar', keywords: ['toes to bar', 'ttb', '토투바'], part: 'core', mechanic: 'pull', modality: 'G' },
    { name: 'Knees to Elbow', keywords: ['knees to elbow', 'kte'], part: 'core', mechanic: 'pull', modality: 'G' },
    { name: 'Sit-up', keywords: ['sit-up', 'sit up', '싯업', '윗몸일으키기'], part: 'core', mechanic: 'none', modality: 'G' },
    { name: 'GHD Sit-up', keywords: ['ghd'], part: 'core', mechanic: 'none', modality: 'G' },
    { name: 'V-up', keywords: ['v-up', '브이업'], part: 'core', mechanic: 'none', modality: 'G' },
    { name: 'Rope Climb', keywords: ['rope climb', '로프클라임'], part: 'upper', mechanic: 'pull', modality: 'G' },
    { name: 'Handstand Walk', keywords: ['hsw', '핸드스탠드워크', '핸웍'], part: 'upper', mechanic: 'push', modality: 'G' },
    { name: 'Double Under', keywords: ['double under', 'du', '이단줄넘기', '쌩쌩이'], part: 'cardio', mechanic: 'none', modality: 'G' },
    { name: 'Single Under', keywords: ['single under', 'su', '줄넘기'], part: 'cardio', mechanic: 'none', modality: 'G' },
    { name: 'Wall Walk', keywords: ['wall walk', '월워크'], part: 'upper', mechanic: 'push', modality: 'G' },

    // --- Monostructural (유산소/카디오) ---
    { name: 'Run', keywords: ['run', '달리기', '러닝'], part: 'cardio', mechanic: 'none', modality: 'M' },
    { name: 'Row', keywords: ['row', '로잉'], part: 'cardio', mechanic: 'pull', modality: 'M' },
    { name: 'Assault Bike', keywords: ['assault', 'bike', '바이크', '어썰트'], part: 'cardio', mechanic: 'push', modality: 'M' },
    { name: 'Echo Bike', keywords: ['echo bike', '에코바이크'], part: 'cardio', mechanic: 'push', modality: 'M' },
    { name: 'Ski Erg', keywords: ['ski', '스키'], part: 'cardio', mechanic: 'pull', modality: 'M' },
    { name: 'Swim', keywords: ['swim', '수영'], part: 'cardio', mechanic: 'none', modality: 'M' },
];

// === 🏆 벤치마크 와드 ===
const BENCHMARK_DB = [
    // --- The Girls ---
    { name: "Angie", type: "For Time", rounds: "", timeCap: "30", lines: [{ reps: "100", movement: "Pull-up", weightRx: "" }, { reps: "100", movement: "Push-up", weightRx: "" }, { reps: "100", movement: "Sit-up", weightRx: "" }, { reps: "100", movement: "Air Squat", weightRx: "" }] },
    { name: "Barbara", type: "For Time", rounds: "5 Rounds", timeCap: "40", lines: [{ reps: "20", movement: "Pull-up", weightRx: "" }, { reps: "30", movement: "Push-up", weightRx: "" }, { reps: "40", movement: "Sit-up", weightRx: "" }, { reps: "50", movement: "Air Squat", weightRx: "" }, { reps: "3 min", movement: "Rest", weightRx: "" }] },
    { name: "Chelsea", type: "EMRAP", rounds: "30 min", timeCap: "30", lines: [{ reps: "5", movement: "Pull-up", weightRx: "" }, { reps: "10", movement: "Push-up", weightRx: "" }, { reps: "15", movement: "Air Squat", weightRx: "" }] },
    { name: "Cindy", type: "AMRAP", rounds: "", timeCap: "20", lines: [{ reps: "5", movement: "Pull-up", weightRx: "" }, { reps: "10", movement: "Push-up", weightRx: "" }, { reps: "15", movement: "Air Squat", weightRx: "" }] },
    { name: "Diane", type: "For Time", rounds: "21-15-9", timeCap: "10", lines: [{ reps: "21", movement: "Deadlift", weightRx: "225/155" }, { reps: "21", movement: "Handstand Push-up", weightRx: "" }] },
    { name: "Elizabeth", type: "For Time", rounds: "21-15-9", timeCap: "10", lines: [{ reps: "21", movement: "Clean", weightRx: "135/95" }, { reps: "21", movement: "Ring Dip", weightRx: "" }] },
    { name: "Fran", type: "For Time", rounds: "21-15-9", timeCap: "10", lines: [{ reps: "21", movement: "Thruster", weightRx: "95/65" }, { reps: "21", movement: "Pull-up", weightRx: "" }] },
    { name: "Grace", type: "For Time", rounds: "", timeCap: "5", lines: [{ reps: "30", movement: "Clean and Jerk", weightRx: "135/95" }] },
    { name: "Helen", type: "For Time", rounds: "3", timeCap: "15", lines: [{ reps: "400m", movement: "Run", weightRx: "" }, { reps: "21", movement: "Kettlebell Swing", weightRx: "53/35" }, { reps: "12", movement: "Pull-up", weightRx: "" }] },
    { name: "Isabel", type: "For Time", rounds: "", timeCap: "5", lines: [{ reps: "30", movement: "Snatch", weightRx: "135/95" }] },
    { name: "Jackie", type: "For Time", rounds: "", timeCap: "12", lines: [{ reps: "1000m", movement: "Row", weightRx: "" }, { reps: "50", movement: "Thruster", weightRx: "45/35" }, { reps: "30", movement: "Pull-up", weightRx: "" }] },
    { name: "Karen", type: "For Time", rounds: "", timeCap: "15", lines: [{ reps: "150", movement: "Wall Ball Shot", weightRx: "20/14" }] },
    { name: "Linda", type: "For Time", rounds: "10-9-8-7-6-5-4-3-2-1", timeCap: "25", lines: [{ reps: "10", movement: "Deadlift", weightRx: "1.5 BW" }, { reps: "10", movement: "Bench Press", weightRx: "BW" }, { reps: "10", movement: "Clean", weightRx: "0.75 BW" }] },
    { name: "Mary", type: "AMRAP", rounds: "", timeCap: "20", lines: [{ reps: "5", movement: "Handstand Push-up", weightRx: "" }, { reps: "10", movement: "Pistol Squat", weightRx: "" }, { reps: "15", movement: "Pull-up", weightRx: "" }] },
    { name: "Nancy", type: "For Time", rounds: "5 Rounds", timeCap: "20", lines: [{ reps: "400m", movement: "Run", weightRx: "" }, { reps: "15", movement: "Overhead Squat", weightRx: "95/65" }] },

    // --- The Heroes ---
    { name: "Murph", type: "For Time", rounds: "", timeCap: "60", lines: [{ reps: "1 mile", movement: "Run", weightRx: "" }, { reps: "100", movement: "Pull-up", weightRx: "" }, { reps: "200", movement: "Push-up", weightRx: "" }, { reps: "300", movement: "Air Squat", weightRx: "" }, { reps: "1 mile", movement: "Run", weightRx: "" }] },
    { name: "DT", type: "For Time", rounds: "5 Rounds", timeCap: "10", lines: [{ reps: "12", movement: "Deadlift", weightRx: "155/105" }, { reps: "9", movement: "Hang Power Clean", weightRx: "155/105" }, { reps: "6", movement: "Push Jerk", weightRx: "155/105" }] },
    { name: "Hero 1776", type: "For Time", rounds: "Team/Solo", timeCap: "60", lines: [{ reps: "1776m", movement: "Run", weightRx: "" }, { reps: "100", movement: "Kettlebell Swing", weightRx: "53/35" }, { reps: "100", movement: "Box Jump", weightRx: "24/20" }, { reps: "100", movement: "Air Squat", weightRx: "" }, { reps: "100", movement: "Push-up", weightRx: "" }, { reps: "100", movement: "Burpee", weightRx: "" }, { reps: "100", movement: "Pull-up", weightRx: "" }] },
];

interface WodLine { id: number; reps: string; movement: string; weightRx: string; }
// StatsType 클래스 정의 유지
interface StatsType { upperPush: number; upperPull: number; lowerPush: number; lowerPull: number; cardio: number; G: number; W: number; M: number; }

// ✅ [신규] Sortable Item 컴포넌트 - 드래그 가능한 운동 라인
interface SortableItemProps {
    line: WodLine;
    onUpdate: (id: number, field: keyof WodLine, value: string) => void;
    onDelete: (id: number) => void;
}

// ✅ [신규] 운동 선택 컴포넌트 (Autocomplete + Portal)
const MovementSelect: React.FC<{
    value: string;
    onChange: (val: string) => void;
    onBlur: () => void;
    onToggleOpen?: (open: boolean) => void;
}> = ({ value, onChange, onBlur, onToggleOpen }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = React.useRef<HTMLDivElement>(null);

    // 드롭다운 위치 업데이트
    const updatePosition = React.useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, []);

    // 스크롤/리사이즈 시 위치 업데이트 및 닫기
    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, updatePosition]);

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                const target = event.target as HTMLElement;
                if (!target.closest('[data-portal="movement-select"]')) {
                    setIsOpen(false);
                    onToggleOpen?.(false);
                    onBlur();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onBlur, onToggleOpen]);

    // 필터링 및 그룹화 로직
    const filteredMovements = React.useMemo(() => {
        const search = filter.toLowerCase().trim();
        if (!search) return MOVEMENT_DB;
        return MOVEMENT_DB.filter(m =>
            m.name.toLowerCase().includes(search) ||
            m.keywords.some(k => k.includes(search))
        );
    }, [filter]);

    const groupedMovements = React.useMemo(() => {
        const groups: { [key: string]: typeof MOVEMENT_DB } = {
            'Weightlifting (역도/웨이트)': [],
            'Gymnastics (맨몸/체조)': [],
            'Cardio (유산소)': []
        };
        filteredMovements.forEach(m => {
            if (m.modality === 'W') groups['Weightlifting (역도/웨이트)'].push(m);
            else if (m.modality === 'G') groups['Gymnastics (맨몸/체조)'].push(m);
            else if (m.modality === 'M') groups['Cardio (유산소)'].push(m);
        });
        return groups;
    }, [filteredMovements]);

    useEffect(() => {
        if (!isOpen) setFilter(value);
    }, [value, isOpen]);

    return (
        <div ref={containerRef} style={{ position: 'relative', flex: 3 }}>
            <input
                value={isOpen ? filter : value}
                onChange={(e) => {
                    setFilter(e.target.value);
                    onChange(e.target.value);
                    if (!isOpen) { setIsOpen(true); onToggleOpen?.(true); }
                }}
                onFocus={() => {
                    setFilter(value);
                    setIsOpen(true);
                    onToggleOpen?.(true);
                }}
                placeholder="운동 검색 (예: sq, pull)"
                style={{ ...styles.input, width: '100%' }}
            />

            {isOpen && createPortal(
                <div
                    data-portal="movement-select"
                    style={{
                        position: 'absolute',
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                        width: dropdownPosition.width,
                        backgroundColor: '#fff',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                        zIndex: 9999,
                        maxHeight: '300px',
                        overflowY: 'auto',
                        marginTop: '4px'
                    }}
                >
                    {Object.entries(groupedMovements).map(([category, items]) => (
                        items.length > 0 && (
                            <div key={category}>
                                <div style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#F9FAFB',
                                    fontWeight: '600',
                                    fontSize: '12px',
                                    color: '#6B7280',
                                    borderBottom: '1px solid #F3F4F6'
                                }}>
                                    {category}
                                </div>
                                {items.map((m) => (
                                    <div
                                        key={m.name}
                                        onClick={() => {
                                            onChange(m.name);
                                            setIsOpen(false);
                                            onToggleOpen?.(false);
                                            setFilter(m.name);
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            color: '#1F2937',
                                            borderBottom: '1px solid #F3F4F6',
                                            transition: 'background-color 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                    >
                                        <div style={{ fontWeight: '500' }}>{m.name}</div>
                                        <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{m.keywords.join(', ')}</div>
                                    </div>
                                ))}
                            </div>
                        )
                    ))}
                    {filteredMovements.length === 0 && (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                            검색 결과가 없습니다
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

const SortableItem: React.FC<SortableItemProps> = ({ line, onUpdate, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id });
    const [isDropdownActive, setIsDropdownActive] = useState(false); // 드롭다운 활성 상태

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 99 : (isDropdownActive ? 50 : 1), // 드롭다운 열리면 z-index 상승
        position: 'relative' as const, // 드롭다운 z-index 컨텍스트 확보
    };

    return (
        <div ref={setNodeRef} style={style} className="sortable-item">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                {/* 드래그 핸들 */}
                <button {...attributes} {...listeners} style={styles.dragHandle}>
                    <GripVertical size={16} color="#9CA3AF" />
                </button>
                <input placeholder="21" value={line.reps} onChange={e => onUpdate(line.id, 'reps', e.target.value)} style={{ ...styles.input, width: '60px', flex: 'none' }} />

                {/* 커스텀 운동 선택 드롭다운 */}
                <MovementSelect
                    value={line.movement}
                    onChange={(val) => onUpdate(line.id, 'movement', val)}
                    onBlur={() => { }}
                    onToggleOpen={setIsDropdownActive}
                />

                <input placeholder="95/65" value={line.weightRx} onChange={e => onUpdate(line.id, 'weightRx', e.target.value)} style={{ ...styles.input, flex: 2 }} />
                <button onClick={() => { if (window.confirm("삭제하시겠습니까?")) onDelete(line.id); }} style={styles.iconButton}><Trash2 size={16} color="#EF4444" /></button>
            </div>
        </div>
    );
};

const WodBoard: React.FC = () => {
    const isMobile = useIsMobile();
    const { user } = useAppContext();
    const isAdmin = user?.role === 'subcoach' || hasFullAdminAccess(user?.role);
    const isMobileMode = isMobile || isUserRole(user?.role);

    const [currentMonday, setCurrentMonday] = useState(getMonday(new Date()));
    const [weekWods, setWeekWods] = useState<{ [key: string]: Wod }>({});
    // const [loading, setLoading] = useState(false);
    const [, setLoading] = useState(false);
    const [isTeam, setIsTeam] = useState(false); // ✅ 팀 와드 여부 상태
    const [teamSize, setTeamSize] = useState<number | null>(2); // ✅ 팀 인원 수 상태
    const [showModal, setShowModal] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false); // ✅ AI 모달 상태
    const [aiPrompt, setAiPrompt] = useState(''); // ✅ AI 프롬프트 상태
    const [isAiLoading, setIsAiLoading] = useState(false); // ✅ AI 로딩 상태
    const [activeTab, setActiveTab] = useState<'wod' | 'stats'>('wod');
    const [selectedDate, setSelectedDate] = useState("");

    const [isEditMode, setIsEditMode] = useState(false);
    const [wodType, setWodType] = useState('For Time');
    const [rounds, setRounds] = useState('');
    const [timeCap, setTimeCap] = useState('');
    const [videoList, setVideoList] = useState<{ id: number, url: string, comment: string }[]>([{ id: Date.now(), url: '', comment: '' }]);
    const [lines, setLines] = useState<WodLine[]>([{ id: 1, reps: '', movement: '', weightRx: '' }]);
    const [scaleA, setScaleA] = useState('');
    const [scaleB, setScaleB] = useState('');
    const [scaleC, setScaleC] = useState('');
    const [description, setDescription] = useState(''); // ✅ [신규] 참고사항 상태
    const [isRestDay, setIsRestDay] = useState(false);

    // ✅ [신규] 멀티 파트 WOD 상태
    const [partLabels, setPartLabels] = useState<string[]>(['Part A']); // ['Strength', 'Part A', 'Part B']
    const [activePartIndex, setActivePartIndex] = useState(0); // 현재 편집 중인 파트 인덱스
    const [savedParts, setSavedParts] = useState<any[]>([]); // 각 파트의 저장된 데이터

    const [periodDays, setPeriodDays] = useState(14);
    const [todayStats, setTodayStats] = useState<StatsType>({ upperPush: 0, upperPull: 0, lowerPush: 0, lowerPull: 0, cardio: 0, G: 0, W: 0, M: 0 });
    const [historyStats, setHistoryStats] = useState<StatsType>({ upperPush: 0, upperPull: 0, lowerPush: 0, lowerPull: 0, cardio: 0, G: 0, W: 0, M: 0 });
    // const [historyRecords, setHistoryRecords] = useState<WodRecord[]>([]);
    const [, setHistoryRecords] = useState<WodRecord[]>([]);
    const [myWodRecord, setMyWodRecord] = useState<WodRecord | null>(null);
    const [scoreValue, setScoreValue] = useState('');
    const [isRx, setIsRx] = useState(true);
    const [scaleRank, setScaleRank] = useState<string | null>(null); // null(Rx), 'A', 'B', 'C'
    const [isTimeCap, setIsTimeCap] = useState(false);
    const [recordNote, setRecordNote] = useState('');
    // const [showRecordForm, setShowRecordForm] = useState(false);
    const [, setShowRecordForm] = useState(false);

    // ✅ [신규] Drag & Drop 센서 설정
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px 이동해야 드래그 시작 (클릭과 구분)
            },
        })
    );

    // ✅ [신규] 드래그 완료 핸들러
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setLines((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // ✅ [신규] 파트 관리 함수들
    const saveCurrentPart = () => {
        // 현재 파트의 데이터를 저장
        const newSavedParts = [...savedParts];
        newSavedParts[activePartIndex] = {
            label: partLabels[activePartIndex],
            type: wodType,
            rounds,
            timeCap,
            lines: [...lines]
        };
        setSavedParts(newSavedParts);
    };

    const switchPart = (index: number) => {
        // 현재 파트 저장
        saveCurrentPart();

        // 새 파트 로드
        setActivePartIndex(index);
        const partData = savedParts[index];
        if (partData) {
            setWodType(partData.type || 'For Time');
            setRounds(partData.rounds || '');
            setTimeCap(partData.timeCap || '');
            setLines(partData.lines || [{ id: 1, reps: '', movement: '', weightRx: '' }]);
        } else {
            // 새 파트 초기화
            setWodType(partLabels[index] === 'Strength' ? 'Strength' : 'For Time');
            setRounds('');
            setTimeCap('');
            setLines([{ id: 1, reps: '', movement: '', weightRx: '' }]);
        }
    };

    const addPart = () => {
        saveCurrentPart();
        const newLabel = partLabels.length === 0 || partLabels[0] !== 'Strength'
            ? (partLabels.length === 0 ? 'Strength' : `Part ${String.fromCharCode(65 + partLabels.length)}`)
            : `Part ${String.fromCharCode(65 + partLabels.length - 1)}`;
        setPartLabels([...partLabels, newLabel]);
        setActivePartIndex(partLabels.length);
        setWodType(newLabel === 'Strength' ? 'Strength' : 'For Time');
        setRounds('');
        setTimeCap('');
        setLines([{ id: 1, reps: '', movement: '', weightRx: '' }]);
    };

    const deletePart = (index: number) => {
        if (partLabels.length === 1) {
            toast.error('최소 1개의 파트가 필요합니다');
            return;
        }

        // 1. 현재 편집 중인 데이터 임시 저장 (delete 시 index shift 문제 방지)
        const currentPartData = {
            label: partLabels[activePartIndex],
            type: wodType,
            rounds,
            timeCap,
            lines: [...lines]
        };
        const updatedSavedParts = [...savedParts];
        updatedSavedParts[activePartIndex] = currentPartData;

        // 2. 삭제 및 필터링
        const filteredLabels = partLabels.filter((_, i) => i !== index);
        const filteredSaved = updatedSavedParts.filter((_, i) => i !== index);

        // 3. 라벨 재정렬 (A, B, C 순서 보장)
        const newLabels = filteredLabels.map((label, idx) => {
            // 첫 번째가 Strength였으면 유지 (삭제되지 않은 경우)
            if (idx === 0 && label === 'Strength') return 'Strength';

            // Strength가 있으면 그 다음부터 A, Strength가 없으면 A부터
            const hasStrength = filteredLabels[0] === 'Strength';
            const charCode = 65 + (hasStrength ? idx - 1 : idx);
            return `Part ${String.fromCharCode(charCode)}`;
        });

        // 4. 저장된 데이터의 라벨도 업데이트
        const finalSaved = filteredSaved.map((p, i) => p ? { ...p, label: newLabels[i] } : p);

        setPartLabels(newLabels);
        setSavedParts(finalSaved);

        // 5. Active Index 조정 및 데이터 로드
        if (activePartIndex === index) {
            // 현재 보고 있던 파트를 삭제함 -> 인접한 파트로 이동
            const newIndex = Math.min(index, newLabels.length - 1);
            setActivePartIndex(newIndex);

            // 데이터 로드
            const partData = finalSaved[newIndex];
            if (partData) {
                setWodType(partData.type || 'For Time');
                setRounds(partData.rounds || '');
                setTimeCap(partData.timeCap || '');
                setLines(partData.lines || [{ id: Date.now(), reps: '', movement: '', weightRx: '' }]);
            } else {
                // 데이터 없으면 초기화
                setWodType(newLabels[newIndex] === 'Strength' ? 'Strength' : 'For Time');
                setRounds('');
                setTimeCap('');
                setLines([{ id: Date.now(), reps: '', movement: '', weightRx: '' }]);
            }
        } else if (activePartIndex > index) {
            // 앞쪽 파트가 삭제됨 -> 인덱스 1 감소 (데이터는 그대로 유지)
            setActivePartIndex(activePartIndex - 1);
        }
    };

    function getMonday(d: Date) { d = new Date(d); var day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); }
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // ✅ [신규] WOD content를 보기 좋게 표시하는 함수
    const formatWodContent = (content: string): string => {
        try {
            const parsed = JSON.parse(content);
            if (parsed.parts && Array.isArray(parsed.parts)) {
                // 멀티 파트 WOD
                return parsed.parts.map((part: any, idx: number) => {
                    let partText = `${part.label}: ${part.type}`;
                    if (part.rounds) partText += ` - ${part.rounds} Rounds`;
                    if (part.timeCap) partText += ` - TC: ${part.timeCap} min`;
                    partText += '\n';
                    part.lines?.forEach((line: any) => {
                        partText += `${line.reps ? line.reps + ' ' : ''}${line.movement} ${line.weightRx ? `(${line.weightRx})` : ''}\n`;
                    });
                    return partText;
                }).join('\n');
            }
        } catch {
            // JSON이 아니면 원본 그대로 반환
        }
        return content;
    };

    const fetchWeekWods = useCallback(async () => {
        setLoading(true);
        try {
            const startStr = formatDate(currentMonday);
            const endDate = new Date(currentMonday); endDate.setDate(endDate.getDate() + 6);
            const res = await getWeeklyWods(startStr, formatDate(endDate));
            const wodMap: { [key: string]: Wod } = {};
            res.data.forEach((w: Wod) => wodMap[w.date] = w);
            setWeekWods(wodMap);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [currentMonday]);

    useEffect(() => { fetchWeekWods(); }, [fetchWeekWods]);

    const analyzeWodText = (text: string, stats: StatsType) => {
        text.split('\n').forEach(line => {
            const lowerLine = line.toLowerCase();
            const mov = MOVEMENT_DB.find(m => m.keywords.some(k => lowerLine.includes(k)));
            if (mov) {
                if (mov.part === 'upper') { mov.mechanic === 'push' ? stats.upperPush++ : stats.upperPull++; }
                else if (mov.part === 'lower') { mov.mechanic === 'push' ? stats.lowerPush++ : stats.lowerPull++; }
                else if (mov.part === 'full') { stats.lowerPush += 0.5; stats.upperPush += 0.5; stats.cardio += 0.5; }
                else if (mov.part === 'cardio' || mov.part === 'core') { stats.cardio++; }
                if (mov.modality === 'G') stats.G++;
                if (mov.modality === 'W') stats.W++;
                if (mov.modality === 'M') stats.M++;
            }
        });
    };

    const fetchHistory = async (targetDateStr: string) => {
        const tempStats: StatsType = { upperPush: 0, upperPull: 0, lowerPush: 0, lowerPull: 0, cardio: 0, G: 0, W: 0, M: 0 };
        const promises = [];
        const targetDate = new Date(targetDateStr);
        for (let i = 1; i <= periodDays; i++) { const d = new Date(targetDate); d.setDate(d.getDate() - i); promises.push(getWod(formatDate(d)).catch(() => null)); }
        const results = await Promise.all(promises);
        results.forEach(res => { if (res?.data?.content) analyzeWodText(res.data.content, tempStats); });
        setHistoryStats(tempStats);
    };

    useEffect(() => {
        const newStats = { upperPush: 0, upperPull: 0, lowerPush: 0, lowerPull: 0, cardio: 0, G: 0, W: 0, M: 0 };
        lines.forEach(l => analyzeWodText(l.movement, newStats));
        setTodayStats(newStats);
    }, [lines]);

    const fetchWodHistoryRecords = async (title: string) => {
        if (!title) return;
        try { const res = await getWodHistoryByTitle(title.split(' - ')[0]); setHistoryRecords(res.data); }
        catch (err) { setHistoryRecords([]); }
    };

    /*
    const formatTimeDisplay = (raw: string) => {
        const padded = raw.padEnd(4, '0');
        return <span>{padded.slice(0, 2)}:{padded.slice(2, 4)}</span>;
    };
    */
    // 입력 값("9856")을 "98:56" 문자열로 변환
    const getFormattedTimeStr = (raw: string) => {
        const padded = raw.padEnd(4, '0');
        return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
    };

    /*
    const handleKeypadPress = (num: string) => {
        if (num === 'DEL') setScoreValue(prev => prev.slice(0, -1));
        else {
            let maxLength = 6;
            if (currentWod?.score_type === 'time') maxLength = 4;
            if (scoreValue.length < maxLength) setScoreValue(prev => prev + num);
        }
    };
    */

    const [currentWod, setCurrentWod] = useState<Wod | null>(null);

    const openModal = async (dateStr: string, existingWod?: Wod) => {
        setSelectedDate(dateStr); setShowModal(true); fetchHistory(dateStr);
        setActiveTab('wod');
        setShowRecordForm(false);
        setScoreValue('');
        setIsRx(true);
        setScaleRank(null);
        setIsTimeCap(false);
        setIsTimeCap(false);
        setRecordNote('');
        setIsTeam(false);
        setTeamSize(2);
        setScaleA('');
        setScaleB('');
        setScaleC('');
        setDescription(''); // ✅ 초기화
        setIsRestDay(false);

        if (existingWod) {
            setCurrentWod(existingWod);
            setIsEditMode(isAdmin); // Admin is edit mode for the program
            setIsRestDay(existingWod.is_rest_day);
            if (!existingWod.is_rest_day) fetchWodHistoryRecords(existingWod.title); else setHistoryRecords([]);

            // Check for member's record
            if (!isAdmin) {
                try {
                    const res = await getMyWodRecords();
                    const record = res.data.find((r: WodRecord) => r.wod_id === existingWod.id);
                    if (record) {
                        setMyWodRecord(record);
                        setScoreValue(record.record_value.replace(/[^0-9]/g, ''));
                        setIsRx(record.is_rx);
                        setScaleRank(record.scale_rank || null);
                        setIsTimeCap(record.is_time_cap || false);
                        setRecordNote(record.note || '');
                    } else {
                        setMyWodRecord(null);
                    }
                } catch (e) { console.error(e); }
            }

            const titleParts = existingWod.title.split(' - ');

            // ✅ [신규] 멀티 파트 JSON 파싱
            try {
                const parsed = JSON.parse(existingWod.content);
                if (parsed.parts && Array.isArray(parsed.parts)) {
                    // 멀티 파트 WOD
                    setPartLabels(parsed.parts.map((p: any) => p.label));
                    setSavedParts(parsed.parts);
                    setActivePartIndex(0);

                    // 첫 번째 파트 로드
                    const firstPart = parsed.parts[0];
                    setWodType(firstPart.type || 'For Time');
                    setRounds(firstPart.rounds || '');
                    setTimeCap(firstPart.timeCap || '');
                    setLines(firstPart.lines || [{ id: 1, reps: '', movement: '', weightRx: '' }]);
                } else {
                    throw new Error('Not multi-part');
                }
            } catch {
                // 기존 방식 (단일 파트)
                setPartLabels(['Part A']);
                setSavedParts([]);
                setActivePartIndex(0);

                setWodType(titleParts[0] || 'For Time');
                let pRounds = '', pTC = '';
                titleParts.forEach(p => { if (p.includes('Rounds')) pRounds = p.replace('Rounds', '').trim(); if (p.includes('TC:') || p.includes('min')) pTC = p.replace('TC:', '').replace('min', '').trim(); });
                setRounds(pRounds); setTimeCap(pTC);

                const descLines = existingWod.content.split('\n');
                const newLines: WodLine[] = [];
                let tScaleA = '', tScaleB = '', tScaleC = '';
                descLines.forEach((str, idx) => {
                    if (!str.trim() || str.includes('----')) return;
                    if (str.startsWith('Scale A:')) { tScaleA = str.replace('Scale A:', '').trim(); return; }
                    if (str.startsWith('Scale B:')) { tScaleB = str.replace('Scale B:', '').trim(); return; }
                    if (str.startsWith('Scale C:')) { tScaleC = str.replace('Scale C:', '').trim(); return; }
                    let weight = '', content = str, reps = '';
                    const wMatch = str.match(/\((.*?)\s*lb\)/);
                    if (wMatch) { weight = wMatch[1]; content = content.replace(wMatch[0], '').trim(); }
                    const rMatch = content.match(/^(\d+)\s+/);
                    if (rMatch) { reps = rMatch[1]; content = content.replace(rMatch[0], '').trim(); }
                    newLines.push({ id: Date.now() + idx, reps, movement: content, weightRx: weight });
                });
                setLines(newLines.length > 0 ? newLines : [{ id: Date.now(), reps: '', movement: '', weightRx: '' }]);
                setScaleA(tScaleA);
                setScaleB(tScaleB);
                setScaleC(tScaleC);
            }

            setVideoList(existingWod.videos?.length > 0 ? existingWod.videos.map((v, i) => ({ id: Date.now() + i, url: v.url, comment: v.comment || '' })) : [{ id: Date.now(), url: '', comment: '' }]);
            setDescription(existingWod.description || '');
            setIsRestDay(existingWod.is_rest_day || false);
            setIsTeam(existingWod.is_team || false);
            setTeamSize(existingWod.team_size || 2);
        } else { setCurrentWod(null); setMyWodRecord(null); setIsEditMode(false); setHistoryRecords([]); resetForm(); }
    };

    const resetForm = () => {
        setLines([{ id: Date.now(), reps: '', movement: '', weightRx: '' }]); setRounds(''); setTimeCap(''); setScaleA(''); setScaleB(''); setScaleC('');
        setDescription('');
        setWodType('For Time'); setVideoList([{ id: Date.now(), url: '', comment: '' }]); setIsRestDay(false); setIsTeam(false); setTeamSize(2);
        // ✅ [신규] 파트 상태 초기화
        setPartLabels(['Part A']);
        setSavedParts([]);
        setActivePartIndex(0);
    };

    const handleLoadBenchmark = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const bm = BENCHMARK_DB.find(b => b.name === e.target.value);
        if (bm) { setWodType(bm.type); setRounds(bm.rounds); setTimeCap(bm.timeCap); setLines(bm.lines.map((l, i) => ({ id: Date.now() + i, ...l }))); }
        e.target.value = "";
    };

    const addVideo = () => setVideoList([...videoList, { id: Date.now(), url: '', comment: '' }]);
    const updateVideo = (id: number, field: 'url' | 'comment', value: string) => setVideoList(videoList.map(v => v.id === id ? { ...v, [field]: value } : v));
    const removeVideo = (id: number) => videoList.length > 1 ? setVideoList(videoList.filter(v => v.id !== id)) : setVideoList([{ id: Date.now(), url: '', comment: '' }]);

    const handleSubmit = async () => {
        // ✅ [수정] 현재 파트 저장
        saveCurrentPart();

        // ✅ [수정] 멀티 파트 JSON 생성
        const allParts = [...savedParts];
        allParts[activePartIndex] = {
            label: partLabels[activePartIndex],
            type: wodType,
            rounds,
            timeCap,
            lines: [...lines]
        };

        let autoTitle = isRestDay ? "Rest Day (휴무)" : partLabels.map((label, idx) => {
            const part = allParts[idx];
            return `${label}: ${part?.type || 'For Time'}`;
        }).join(' | ');

        let content = '';
        if (!isRestDay) {
            // ✅ [신규] 멀티 파트를 JSON으로 저장
            content = JSON.stringify({ parts: allParts });
        } else {
            content = "오늘은 휴무일입니다. 푹 쉬고 내일 만나요! 👋";
        }

        try {
            const payload = {
                date: selectedDate,
                title: autoTitle,
                content,
                description: description,
                videos: isRestDay ? [] : videoList.filter(v => v.url.trim()).map(v => ({ url: v.url, comment: v.comment })),
                score_type: allParts[0]?.type === 'For Time' ? 'time' : 'reps',
                is_rest_day: isRestDay,
                is_team: isTeam,
                team_size: isTeam ? teamSize : null
            };
            if (isEditMode) await updateWod(selectedDate, payload); else await createWod(payload);
            toast.success(isEditMode ? "수정되었습니다." : "등록되었습니다.");
            setShowModal(false); fetchWeekWods();
        } catch (e) { toast.error("저장 실패"); }
    };

    /*
    const handleSubmitRecord = async () => {
        if (!currentWod) return;
        if (!scoreValue || scoreValue === '0') { toast.error("기록을 입력해주세요"); return; }

        let finalScore = scoreValue;
        if (currentWod.score_type === 'time') {
            finalScore = getFormattedTimeStr(scoreValue);
        }

        setLoading(true);
        try {
            await createWodRecord({
                wod_id: currentWod.id,
                record_value: finalScore,
                is_rx: isRx,
                scale_rank: isRx ? null : scaleRank,
                is_time_cap: isTimeCap,
                note: recordNote
            });
            toast.success(myWodRecord ? "기록이 수정되었습니다." : "기록이 등록되었습니다.");
            setShowRecordForm(false);
            // Refresh modal data
            openModal(selectedDate, currentWod);
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "기록 저장 실패");
        } finally {
            setLoading(false);
        }
    };
    */

    const handleDelete = async () => { if (!window.confirm("삭제하시겠습니까?")) return; try { await deleteWod(selectedDate); toast.success("삭제됨"); setShowModal(false); fetchWeekWods(); } catch (e) { toast.error("오류"); } };

    const addLine = () => setLines([...lines, { id: Date.now(), reps: '', movement: '', weightRx: '' }]);
    const updateLine = (id: number, field: keyof WodLine, value: string) => setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));

    const getEmbedUrl = (url: string) => { if (!url) return null; let vId = ""; if (url.includes("v=")) vId = url.split("v=")[1]?.split("&")[0]; else if (url.includes("youtu.be/")) vId = url.split("youtu.be/")[1]; return vId ? `https://www.youtube.com/embed/${vId}` : null; };

    const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(currentMonday); d.setDate(d.getDate() + i); return { dateObj: d, dateStr: formatDate(d), dayName: ['월', '화', '수', '목', '금', '토', '일'][i] }; });

    const totalG = historyStats.G + todayStats.G, totalW = historyStats.W + todayStats.W, totalM = historyStats.M + todayStats.M;

    return (
        <div style={{ ...styles.container, padding: isMobileMode ? '16px 16px 100px' : '24px' }}>
            <div style={{ ...styles.header, marginBottom: isMobileMode ? '16px' : '24px' }}>
                <div><h1 style={{ ...styles.pageTitle, fontSize: isMobileMode ? '20px' : '24px' }}>WOD 캘린더</h1><p style={styles.subtitle}>주간 운동 프로그램</p></div>
                <div style={{ ...styles.weekNav, padding: isMobileMode ? '8px 12px' : '10px 20px' }}>
                    <button onClick={() => { const d = new Date(currentMonday); d.setDate(d.getDate() - 7); setCurrentMonday(d); }} style={styles.navBtn}><ChevronLeft size={isMobileMode ? 18 : 20} /></button>
                    <div style={{ ...styles.weekLabel, fontSize: isMobileMode ? '14px' : '16px' }}><Calendar size={isMobileMode ? 14 : 16} color={TOSS_BLUE} /><span>{currentMonday.getMonth() + 1}월 {Math.ceil((currentMonday.getDate() + 6 - currentMonday.getDay()) / 7)}주차</span></div>
                    <button onClick={() => { const d = new Date(currentMonday); d.setDate(d.getDate() + 7); setCurrentMonday(d); }} style={styles.navBtn}><ChevronRight size={isMobileMode ? 18 : 20} /></button>
                </div>
            </div>

            {/* 캘린더 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobileMode ? 'repeat(2, 1fr)' : 'repeat(7, 1fr)', gap: '12px' }}>
                {weekDays.map((day) => {
                    const wod = weekWods[day.dateStr];
                    const isToday = formatDate(new Date()) === day.dateStr;
                    const isRest = wod?.is_rest_day;
                    return (
                        <div key={day.dateStr} onClick={() => isAdmin ? openModal(day.dateStr, wod) : (wod && openModal(day.dateStr, wod))}
                            style={{
                                ...styles.dayCard,
                                borderColor: isToday ? TOSS_BLUE : 'var(--border-color)',
                                borderWidth: isToday ? '2px' : '1px',
                                backgroundColor: isRest ? (isToday ? 'var(--primary-bg)' : 'var(--danger-bg)') : 'var(--bg-card)',
                                minHeight: isMobileMode ? '240px' : '380px'
                            }}>
                            <div style={{
                                ...styles.dayHeader,
                                backgroundColor: isToday ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                                padding: isMobileMode ? '12px' : '16px 20px'
                            }}>
                                <span style={{ fontWeight: '700', color: isToday ? TOSS_BLUE : 'var(--text-primary)', fontSize: isMobileMode ? '14px' : '15px' }}>{day.dayName}</span>
                                <span style={{ color: 'var(--text-tertiary)', fontSize: isMobileMode ? '12px' : '13px' }}>{day.dateObj.getDate()}</span>
                            </div>
                            <div style={{
                                ...styles.dayContent,
                                padding: isMobileMode ? '12px' : '20px'
                            }}>
                                {wod ? (isRest ? <div style={styles.restBadge}>⛔ 휴무</div> : (
                                    <>
                                        <div style={{ ...styles.wodTitle, fontSize: isMobileMode ? '14px' : '15px' }}>
                                            {wod.is_team && <span style={styles.teamBadge}>Team of {wod.team_size}</span>}
                                            {wod.title}
                                        </div>
                                        <div style={{ ...styles.wodContent, fontSize: isMobileMode ? '12px' : '14px', WebkitLineClamp: isMobileMode ? 8 : 15 }}>{formatWodContent(wod.content)}</div>
                                        {wod.videos?.length > 0 && <div style={styles.videoBadge}><Youtube size={12} /> {wod.videos.length}</div>}
                                    </>
                                )) : <Plus size={24} color="#D1D5DB" />}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 모달 */}
            {showModal && (
                <div style={styles.modalOverlay}>
                    <div style={{
                        ...styles.modalContent,
                        flexDirection: isMobileMode ? 'column' : 'row',
                        padding: isMobileMode ? '0' : '28px',
                        maxWidth: isMobileMode ? '560px' : '1600px',
                        height: isMobileMode ? '85vh' : '95vh',
                        minHeight: isMobileMode ? '85vh' : 'auto'
                    }}>
                        <div style={isMobileMode ? { padding: '20px 20px 0' } : { flex: 1.2 }}>
                            <div style={styles.modalHeader}>
                                <h3 style={{ margin: 0, fontSize: isMobileMode ? '16px' : '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={18} color={TOSS_BLUE} /> {selectedDate}
                                    {isEditMode && <span style={styles.editBadge}>수정</span>}
                                </h3>
                                <button onClick={() => setShowModal(false)} style={styles.closeBtn}><X size={20} /></button>
                            </div>

                            {/* 모바일 탭 네비게이션 */}
                            {isMobileMode && !isRestDay && (
                                <div style={styles.mobileTabs}>
                                    <button onClick={() => setActiveTab('wod')} style={{ ...styles.mobileTabBtn, borderBottom: activeTab === 'wod' ? `3px solid ${TOSS_BLUE}` : 'none', color: activeTab === 'wod' ? TOSS_BLUE : '#8B95A1' }}>운동 정보</button>
                                    <button onClick={() => setActiveTab('stats')} style={{ ...styles.mobileTabBtn, borderBottom: activeTab === 'stats' ? `3px solid ${TOSS_BLUE}` : 'none', color: activeTab === 'stats' ? TOSS_BLUE : '#8B95A1' }}>데이터 분석</button>
                                </div>
                            )}
                        </div>

                        {/* 왼쪽: 에디터/정보 (모바일에서는 wod 탭일 때만) */}
                        {(!isMobileMode || activeTab === 'wod') && (
                            <div style={isMobileMode ? { padding: '20px', flex: 1 } : { flex: 1.2 }}>
                                {isAdmin ? (
                                    <>
                                        {/* 휴무일 토글 */}
                                        <div style={styles.restDayToggle}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#DC2626', fontWeight: '600' }}>
                                                <input type="checkbox" checked={isRestDay} onChange={e => setIsRestDay(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: '#DC2626' }} />
                                                오늘은 휴무일로 설정
                                            </label>
                                        </div>

                                        {!isRestDay && (
                                            <>
                                                {/* 벤치마크 선택 */}
                                                <select onChange={handleLoadBenchmark} style={styles.benchmarkSelect}>
                                                    <option value="">🏆 벤치마크 와드 불러오기...</option>
                                                    {BENCHMARK_DB.map((b, idx) => <option key={idx} value={b.name}>{b.name}</option>)}
                                                </select>

                                                {/* 팀 와드 설정 */}
                                                <div style={styles.teamSection}>
                                                    <label style={styles.teamToggleLabel}>
                                                        <input type="checkbox" checked={isTeam} onChange={e => setIsTeam(e.target.checked)} style={styles.checkbox} />
                                                        <Users size={18} color={isTeam ? TOSS_BLUE : '#9CA3AF'} />
                                                        <span style={{ color: isTeam ? TOSS_BLUE : '#4B5563', fontWeight: isTeam ? '700' : '500' }}>팀 와드 설정</span>
                                                    </label>
                                                    {isTeam && (
                                                        <select value={teamSize || 2} onChange={e => setTeamSize(Number(e.target.value))} style={styles.teamSizeSelect}>
                                                            <option value={2}>2인 1조</option>
                                                            <option value={3}>3인 1조</option>
                                                            <option value={4}>4인 1조</option>
                                                        </select>
                                                    )}
                                                </div>

                                                {/* ✅ [신규] 파트 탭 */}
                                                {!isRestDay && (
                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                        {partLabels.map((label, idx) => (
                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <button
                                                                    onClick={() => switchPart(idx)}
                                                                    style={{
                                                                        padding: '8px 16px',
                                                                        borderRadius: '8px',
                                                                        border: activePartIndex === idx ? `2px solid ${TOSS_BLUE}` : '1px solid var(--border-color)',
                                                                        backgroundColor: activePartIndex === idx ? '#E8F3FF' : 'var(--bg-secondary)',
                                                                        color: activePartIndex === idx ? TOSS_BLUE : 'var(--text-primary)',
                                                                        fontSize: '14px',
                                                                        fontWeight: activePartIndex === idx ? '700' : '600',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    {label}
                                                                </button>
                                                                {partLabels.length > 1 && (
                                                                    <button
                                                                        onClick={() => deletePart(idx)}
                                                                        style={{
                                                                            padding: '4px 8px',
                                                                            borderRadius: '6px',
                                                                            border: 'none',
                                                                            backgroundColor: '#FEE2E2',
                                                                            color: '#EF4444',
                                                                            fontSize: '12px',
                                                                            fontWeight: '600',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={addPart}
                                                            style={{
                                                                padding: '8px 16px',
                                                                borderRadius: '8px',
                                                                border: `1px dashed ${TOSS_BLUE}`,
                                                                backgroundColor: 'transparent',
                                                                color: TOSS_BLUE,
                                                                fontSize: '14px',
                                                                fontWeight: '600',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            + 파트 추가
                                                        </button>
                                                    </div>
                                                )}

                                                {/* 타입, 라운드, TC */}
                                                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                                                    <select value={wodType} onChange={e => setWodType(e.target.value)} style={{ ...styles.input, flex: 1 }}><option>For Time</option><option>AMRAP</option><option>EMOM</option><option>Strength</option></select>
                                                    <input placeholder="Rounds" value={rounds} onChange={e => setRounds(e.target.value)} style={{ ...styles.input, flex: 1 }} />
                                                    <input placeholder="TC (min)" value={timeCap} onChange={e => setTimeCap(e.target.value)} style={{ ...styles.input, flex: 1 }} />
                                                </div>

                                                {/* 유튜브 섹션 */}
                                                <div style={styles.videoSection}>
                                                    <div style={styles.sectionLabel}><Youtube size={16} color="#EF4444" /> 유튜브 영상</div>
                                                    {videoList.map((v) => (
                                                        <div key={v.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                            <input placeholder="URL" value={v.url} onChange={e => updateVideo(v.id, 'url', e.target.value)} style={{ ...styles.input, flex: 2 }} />
                                                            <input placeholder="코멘트" value={v.comment} onChange={e => updateVideo(v.id, 'comment', e.target.value)} style={{ ...styles.input, flex: 3 }} />
                                                            <button onClick={() => removeVideo(v.id)} style={styles.removeBtn}>×</button>
                                                        </div>
                                                    ))}
                                                    <button onClick={addVideo} style={styles.addVideoBtn}>+ 영상 추가</button>
                                                </div>

                                                {/* 운동 라인 */}
                                                <div style={{ marginBottom: '16px', maxHeight: isMobileMode ? 'none' : '500px', overflowY: isMobileMode ? 'visible' : 'auto' as const }}>
                                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                                        <SortableContext items={lines.map(l => l.id)} strategy={verticalListSortingStrategy}>
                                                            {lines.map((line) => (
                                                                <SortableItem
                                                                    key={line.id}
                                                                    line={line}
                                                                    onUpdate={updateLine}
                                                                    onDelete={(id) => { const newLines = lines.filter(l => l.id !== id); setLines(newLines); }}
                                                                />
                                                            ))}
                                                        </SortableContext>
                                                    </DndContext>
                                                    <datalist id="movement-list">{MOVEMENT_DB.map(m => <option key={m.name} value={m.name} />)}</datalist>
                                                    <button onClick={addLine} style={styles.addLineBtn}>+ 동작 추가</button>
                                                </div>

                                                {/* 스케일 옵션 */}
                                                <div style={styles.scaleSection}>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <input placeholder="Scale A" value={scaleA} onChange={e => setScaleA(e.target.value)} style={{ ...styles.input, flex: 1 }} />
                                                        <input placeholder="Scale B" value={scaleB} onChange={e => setScaleB(e.target.value)} style={{ ...styles.input, flex: 1 }} />
                                                        <input placeholder="Scale C" value={scaleC} onChange={e => setScaleC(e.target.value)} style={{ ...styles.input, flex: 1 }} />
                                                    </div>
                                                </div>

                                                {/* 참고사항 */}
                                                <div style={{ marginTop: '16px' }}>
                                                    <textarea
                                                        placeholder="참고사항 (예: 오늘 와드는 코어 강화에 좋습니다.)"
                                                        value={description}
                                                        onChange={e => setDescription(e.target.value)}
                                                        style={{ ...styles.input, height: '80px', resize: 'vertical' }}
                                                    />
                                                </div>

                                                {/* ✅ AI 추천 버튼 (입력 폼 하단) */}
                                                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                                                    <button onClick={() => setShowAiModal(true)} style={styles.aiButton}>
                                                        <Sparkles size={16} /> AI에게 와드 추천받기
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {/* 버튼 */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                                            {isEditMode && <button onClick={handleDelete} style={styles.deleteBtn}><Trash2 size={16} /> 삭제</button>}
                                            <button onClick={handleSubmit} style={styles.saveBtn}>저장하기</button>
                                        </div>
                                    </>
                                ) : (
                                    /* 회원 뷰 */
                                    <div>
                                        {isRestDay ? (
                                            <h2 style={{ color: '#DC2626', marginBottom: '16px', fontSize: isMobileMode ? '20px' : '24px' }}>⛔ 오늘은 휴무일입니다</h2>
                                        ) : (
                                            <>
                                                {/* ✅ [수정] 멀티 파트 표시 */}
                                                {(() => {
                                                    try {
                                                        const parsed = JSON.parse(currentWod?.content || '{}');
                                                        if (parsed.parts && Array.isArray(parsed.parts)) {
                                                            // 멀티 파트 WOD
                                                            return parsed.parts.map((part: any, idx: number) => (
                                                                <div key={idx} style={{ marginBottom: '24px' }}>
                                                                    <h2 style={{ color: TOSS_BLUE, marginBottom: '12px', fontSize: isMobileMode ? '18px' : '22px' }}>
                                                                        {part.label}: {part.type} {part.rounds && `- ${part.rounds}`} {part.timeCap && `- TC: ${part.timeCap} min`}
                                                                    </h2>
                                                                    <div style={styles.memberWodView}>
                                                                        {part.lines?.map((l: any, lineIdx: number) => (
                                                                            <div key={lineIdx}>{l.reps} {l.movement} {l.weightRx && `(${l.weightRx})`}</div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ));
                                                        }
                                                    } catch { }
                                                    // 기존 방식 (단일 파트)
                                                    return (
                                                        <>
                                                            <h2 style={{ color: TOSS_BLUE, marginBottom: '16px', fontSize: isMobileMode ? '20px' : '24px' }}>
                                                                {wodType} {rounds && `- ${rounds}`} {timeCap && `- TC: ${timeCap}`}
                                                            </h2>
                                                            <div style={styles.memberWodView}>{lines.map(l => <div key={l.id}>{l.reps} {l.movement} {l.weightRx && `(${l.weightRx} lb)`}</div>)}</div>
                                                        </>
                                                    );
                                                })()}
                                                {(scaleA || scaleB || scaleC) && <div style={styles.scaleInfo}>{scaleA && <div>Scale A: {scaleA}</div>}{scaleB && <div>Scale B: {scaleB}</div>}{scaleC && <div>Scale C: {scaleC}</div>}</div>}
                                                {description && <div style={styles.scaleInfo}>참고사항: {description}</div>}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 오른쪽: 통계 (모바일에서는 stats 탭일 때만) */}
                        {!isRestDay && (isMobileMode ? activeTab === 'stats' : true) && (
                            <div style={isMobileMode ? { padding: '20px', flex: 1 } : styles.statsPanel}>
                                <div style={styles.statsCard}>
                                    <div style={styles.statsHeader}>
                                        <div><h4 style={{ margin: 0, color: '#191F28' }}>📈 예상 누적 볼륨</h4><div style={{ fontSize: '12px', color: '#9CA3AF' }}>지난 {periodDays}일 + 오늘</div></div>
                                        <select value={periodDays} onChange={(e) => setPeriodDays(parseInt(e.target.value))} style={styles.periodSelect}><option value={7}>1주</option><option value={14}>2주</option><option value={28}>4주</option></select>
                                    </div>
                                    <StatBar label="상체 밀기" past={historyStats.upperPush} today={todayStats.upperPush} max={periodDays} color="#3182F6" />
                                    <StatBar label="상체 당기기" past={historyStats.upperPull} today={todayStats.upperPull} max={periodDays} color="#8B5CF6" />
                                    <StatBar label="하체 밀기" past={historyStats.lowerPush} today={todayStats.lowerPush} max={periodDays} color="#F59E0B" />
                                    <StatBar label="하체 당기기" past={historyStats.lowerPull} today={todayStats.lowerPull} max={periodDays} color="#EF4444" />
                                    <StatBar label="유산소/코어" past={historyStats.cardio} today={todayStats.cardio} max={periodDays * 1.5} color="#10B981" />
                                </div>

                                <div style={styles.gwmCard}>
                                    <h4 style={{ margin: '0 0 12px', color: '#191F28' }}>⚖️ G-W-M 밸런스</h4>
                                    <div style={styles.gwmBar}><div style={{ flex: totalG || 0.1, backgroundColor: '#10B981' }}></div><div style={{ flex: totalW || 0.1, backgroundColor: TOSS_BLUE }}></div><div style={{ flex: totalM || 0.1, backgroundColor: '#EF4444' }}></div></div>
                                    <div style={styles.gwmLabels}><span style={{ color: '#059669' }}>● G {totalG.toFixed(0)}</span><span style={{ color: TOSS_BLUE }}>● W {totalW.toFixed(0)}</span><span style={{ color: '#DC2626' }}>● M {totalM.toFixed(0)}</span></div>
                                </div>

                                {videoList.filter(v => v.url && getEmbedUrl(v.url)).length > 0 && (
                                    <div>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#191F28', marginBottom: '12px' }}><Video size={16} /> 영상 미리보기</h4>
                                        {videoList.filter(v => v.url && getEmbedUrl(v.url)).map((v, idx) => (
                                            <div key={idx} style={styles.videoPreview}>
                                                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}><iframe title={`video-preview-${idx}`} src={getEmbedUrl(v.url)!} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '10px' }} frameBorder="0" allowFullScreen /></div>
                                                {v.comment && <div style={styles.videoComment}>💡 {v.comment}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ✅ [신규] AI 생성 모달 */}
            {showAiModal && (
                <div style={styles.modalOverlay}>
                    <div style={{ ...styles.modalContent, maxWidth: '500px', flexDirection: 'column' }}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>🤖 AI WOD 어시스턴트</h2>
                            <button onClick={() => setShowAiModal(false)} style={styles.closeBtn}><X size={24} /></button>
                        </div>
                        <div style={styles.modalBody}>
                            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>
                                원하는 WOD 스타일을 입력하면 AI가 구성해줍니다.<br />
                                (예: "하체 강화 20분 AMRAP", "맨몸 운동 위주로", "초보자 친화적으로")
                            </p>
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="요청사항을 입력하세요..."
                                style={{ ...styles.textarea, height: '100px' }}
                            />
                            <button
                                onClick={async () => {
                                    if (!aiPrompt.trim()) return toast.error("요청사항을 입력해주세요.");
                                    setIsAiLoading(true);
                                    try {
                                        const res = await generateAiWod(aiPrompt);
                                        const data = res.data; // { title, content, score_type, comment, target_rounds, time_cap }

                                        // 폼에 데이터 반영
                                        // setAutoTitle(data.title || "AI 추천 WOD"); // title은 자동 생성되므로 별도 상태 없음
                                        setWodType(data.score_type === 'reps' ? 'AMRAP' : 'For Time');

                                        // ✅ [신규] Time Cap 및 Rounds 자동 입력
                                        if (data.target_rounds) setRounds(data.target_rounds);
                                        else setRounds('');

                                        if (data.time_cap) setTimeCap(data.time_cap);
                                        else setTimeCap('');

                                        // 운동 리스트 파싱 (줄바꿈 기준 또는 배열)
                                        // 운동 리스트 파싱 (줄바꿈 기준 또는 배열)
                                        if (data.content) {
                                            let newLines: any[] = [];

                                            if (Array.isArray(data.content)) {
                                                // 배열인 경우 (객체 배열 또는 문자열 배열)
                                                newLines = data.content.map((item: any, idx: number) => {
                                                    if (typeof item === 'object' && item !== null) {
                                                        // ✅ 객체 형태 { movement, reps, weight } - 프롬프트 개선 후 주요 포맷
                                                        return {
                                                            id: Date.now() + idx,
                                                            reps: item.reps || '',
                                                            movement: item.movement || '',
                                                            weightRx: item.weight || ''
                                                        };
                                                    } else {
                                                        // ⚠️ 문자열 형태 (기존 방식 fallback)
                                                        const l = String(item);
                                                        return {
                                                            id: Date.now() + idx,
                                                            reps: l.match(/^\d+/) ? l.match(/^\d+/)![0] : '',
                                                            movement: l.replace(/^\d+\s*/, ''),
                                                            weightRx: ''
                                                        };
                                                    }
                                                });
                                            } else if (typeof data.content === 'string') {
                                                // ⚠️ 줄바꿈 문자열 형태 (기존 방식 fallback)
                                                const cLines = data.content.split('\n').filter((l: string) => l.trim() !== '');
                                                newLines = cLines.map((l: string, idx: number) => ({
                                                    id: Date.now() + idx,
                                                    reps: l.match(/^\d+/) ? l.match(/^\d+/)![0] : '',
                                                    movement: l.replace(/^\d+\s*/, ''),
                                                    weightRx: ''
                                                }));
                                            }

                                            setLines(newLines.length > 0 ? newLines : [{ id: 1, reps: '', movement: '', weightRx: '' }]);
                                        } else {
                                            setLines([{ id: 1, reps: '', movement: '', weightRx: '' }]);
                                        }

                                        // if (data.description) setDescription(data.description); // ❌ [수정] 코치 요청으로 AI 자동 생성 제외

                                        toast.success("AI가 WOD를 생성했습니다! 내용을 확인해주세요.");
                                        if (data.comment) toast(`💡 AI Tip: ${data.comment}`, { duration: 5000, icon: '🤖' });

                                        setShowAiModal(false);
                                    } catch (e) {
                                        toast.error("AI 생성 실패");
                                        console.error(e);
                                    } finally {
                                        setIsAiLoading(false);
                                    }
                                }}
                                style={{ ...styles.saveBtn, width: '100%', marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '8px' }}
                                disabled={isAiLoading}
                            >
                                {isAiLoading ? "생성 중..." : <><Sparkles size={16} /> 생성하기</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatBar = ({ label, past, today, max = 15, color }: { label: string, past: number, today: number, max?: number, color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ width: '90px', fontSize: '13px', fontWeight: '600', color: '#6B7280' }}>{label}</span>
        <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${Math.min((past / max) * 100, 100)}%`, backgroundColor: color, opacity: 0.3 }}></div>
            <div style={{ width: `${Math.min((today / max) * 100, 100 - (past / max) * 100)}%`, backgroundColor: color, transition: 'width 0.3s' }}></div>
        </div>
        <div style={{ width: '55px', textAlign: 'right' as const, fontSize: '12px', fontWeight: '600' }}><span style={{ color: 'var(--text-tertiary)' }}>{past.toFixed(0)}</span>{today > 0 && <span style={{ color }}> +{today.toFixed(0)}</span>}</div>
    </div>
);

const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '24px', minHeight: '100vh', maxWidth: '1400px', margin: '0 auto', backgroundColor: 'var(--bg-main)', transition: 'background-color 0.3s' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' as const, gap: '16px' },
    pageTitle: { fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
    subtitle: { fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '4px' },

    weekNav: { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-card)', padding: '10px 20px', borderRadius: '16px', boxShadow: 'var(--shadow)' },
    navBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' },
    weekLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' },

    dayCard: { backgroundColor: 'var(--bg-card)', borderRadius: '16px', borderStyle: 'solid', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
    dayHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' },
    dayContent: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', justifyContent: 'flex-start', overflow: 'hidden' },
    wodTitle: { fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.4' },
    wodContent: { fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 15, WebkitBoxOrient: 'vertical' as const, whiteSpace: 'pre-wrap' as const },
    videoBadge: { marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger)', fontSize: '12px', fontWeight: '600' },
    restBadge: { color: 'var(--danger)', fontWeight: '700', fontSize: '15px' },

    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--overlay-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
    modalContent: { backgroundColor: 'var(--bg-card)', padding: '28px', borderRadius: '20px', width: '100%', maxWidth: '1600px', maxHeight: '95vh', overflowY: 'auto' as const, display: 'flex', gap: '28px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    editBadge: { fontSize: '12px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' },

    restDayToggle: { padding: '14px', backgroundColor: 'var(--danger-bg)', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--border-color)' },
    benchmarkSelect: { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '16px', fontSize: '14px', cursor: 'pointer' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },

    videoSection: { padding: '16px', backgroundColor: 'var(--danger-bg)', borderRadius: '12px', marginBottom: '16px' },
    sectionLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: 'var(--danger)', marginBottom: '12px', fontSize: '14px' },
    addVideoBtn: { width: '100%', padding: '10px', border: '1px dashed var(--danger)', color: 'var(--danger)', borderRadius: '8px', background: 'none', cursor: 'pointer', fontWeight: '600' },
    addLineBtn: { width: '100%', padding: '10px', border: '1px dashed var(--primary)', color: 'var(--primary)', borderRadius: '8px', background: 'none', cursor: 'pointer', fontWeight: '600' },
    removeBtn: { background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '20px', fontWeight: '700' },

    scaleSection: { padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '16px' },
    deleteBtn: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
    saveBtn: { padding: '14px 32px', backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', marginLeft: 'auto' },

    memberWodView: { whiteSpace: 'pre-wrap' as const, lineHeight: '1.8', fontSize: '16px', color: 'var(--text-primary)', marginBottom: '24px' },
    scaleInfo: { padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '20px', fontSize: '14px', color: 'var(--text-secondary)' },
    historySection: { padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', marginTop: '20px' },
    historyTitle: { display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px', fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' },
    historyItem: { display: 'flex', justifyContent: 'space-between', padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '10px' },
    rxBadge: { display: 'inline-block', padding: '2px 8px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: '6px', fontSize: '11px', fontWeight: '700' },
    scBadge: { display: 'inline-block', padding: '2px 8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderRadius: '6px', fontSize: '11px', fontWeight: '600' },

    statsPanel: { flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: '28px', overflowY: 'auto' as const },
    statsCard: { backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' },
    statsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    periodSelect: { padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },

    gwmCard: { backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: '16px', marginBottom: '20px' },
    gwmBar: { display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' },
    gwmLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600' },

    videoPreview: { backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', border: '1px solid var(--border-color)' },
    videoComment: { padding: '12px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)' },

    recordActionBtn: { width: '100%', padding: '14px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' },
    rxRow: { display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' },
    scaleBtn: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
    radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer' },
    delKey: { padding: '20px', fontSize: '22px', fontWeight: '600', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', cursor: 'pointer' },

    keypad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' },
    numKey: { padding: '20px', fontSize: '22px', fontWeight: '600', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', cursor: 'pointer', boxShadow: 'var(--shadow)', transition: 'background 0.1s' },

    mobileTabs: { display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '10px' },
    mobileTabBtn: { flex: 1, padding: '14px', border: 'none', background: 'none', fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' },

    // ✅ AI 스타일 추가
    aiButton: { backgroundColor: '#E8F3FF', color: TOSS_BLUE, padding: '10px 16px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background-color 0.2s' },
    modalTitle: { fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
    textarea: { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '15px', outline: 'none', resize: 'none' as const, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' as const },

    // ✅ [신규] Drag & Drop 스타일
    dragHandle: { background: 'none', border: 'none', cursor: 'grab', padding: '8px 4px', display: 'flex', alignItems: 'center', transition: 'opacity 0.2s' },
    iconButton: { background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s' },
};

export default WodBoard;
