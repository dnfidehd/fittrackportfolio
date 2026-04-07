import React, { useState, useEffect, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Camera, X, Flame, CheckCircle2, History } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getDietLogs, getRecentDietLogs, createDietLog, updateDietLog, deleteDietLog, analyzeDietImage, DietLog, BASE_URL } from '../../services/api';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Toss Colors
const TOSS_BLUE = '#3182F6';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const MEAL_TYPES = [
    { id: 'Breakfast', label: '아침', icon: '🌅' },
    { id: 'Lunch', label: '점심', icon: '☀️' },
    { id: 'Dinner', label: '저녁', icon: '🌙' },
    { id: 'Snack', label: '간식', icon: '🍪' },
];

const DietLogPage: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [logs, setLogs] = useState<DietLog[]>([]);
    const [recentLogs, setRecentLogs] = useState<DietLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<DietLog | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Form State
    const [selectedMealType, setSelectedMealType] = useState('Breakfast');
    const [content, setContent] = useState('');
    const [calories, setCalories] = useState<number | ''>('');
    const [carbs, setCarbs] = useState<number | ''>('');
    const [protein, setProtein] = useState<number | ''>('');
    const [fat, setFat] = useState<number | ''>('');

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchLogs();
    }, [selectedDate]);

    useEffect(() => {
        fetchRecentLogs();
    }, []);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const res = await getDietLogs(dateStr);
            setLogs(res.data);
        } catch (error) {
            console.error(error);
            toast.error('식단 기록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRecentLogs = async () => {
        try {
            const res = await getRecentDietLogs(30);
            setRecentLogs(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleDateChange = (days: number) => {
        setSelectedDate(prev => addDays(prev, days));
    };

    const openModal = (mealType: string, log?: DietLog) => {
        setSelectedMealType(mealType);
        if (log) {
            setEditingLog(log);
            setContent(log.content);
            setCalories(log.calories || '');
            setCarbs(log.carbs || '');
            setProtein(log.protein || '');
            setFat(log.fat || '');
            setPreviewUrl(log.image_url ? `${BASE_URL}${log.image_url}` : null);
        } else {
            setEditingLog(null);
            setContent('');
            setCalories('');
            setCarbs('');
            setProtein('');
            setFat('');
            setPreviewUrl(null);
        }
        setImageFile(null);
        setIsModalOpen(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!content.trim()) {
            toast.error('식단 내용을 입력해주세요.');
            return;
        }

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const formData = {
            date: dateStr,
            meal_type: selectedMealType,
            content,
            calories: calories === '' ? undefined : Number(calories),
            carbs: carbs === '' ? undefined : Number(carbs),
            protein: protein === '' ? undefined : Number(protein),
            fat: fat === '' ? undefined : Number(fat),
            file: imageFile || undefined,
        };

        try {
            if (editingLog) {
                await updateDietLog(editingLog.id, { ...formData, deleteImage: !previewUrl && !imageFile });
                toast.success('식단이 수정되었습니다.');
            } else {
                await createDietLog(formData);
                toast.success('식단이 등록되었습니다.');
            }
            setIsModalOpen(false);
            fetchLogs();
            fetchRecentLogs();
        } catch (error) {
            console.error(error);
            toast.error('저장에 실패했습니다.');
        }
    };

    const handleAIAnalysis = async () => {
        if (!imageFile) {
            toast.error('먼저 식단 사진을 선택해주세요.');
            return;
        }

        setIsAnalyzing(true);
        const loadingToast = toast.loading('AI가 식단을 분석하고 있어요...');
        try {
            const res = await analyzeDietImage(imageFile);
            const { menu_name, calories, carbs, protein, fat, comment } = res.data;

            const formattedContent = `${menu_name}`; // 내용은 심플하게 메뉴명만

            setContent(formattedContent);
            setCalories(calories);
            setCarbs(carbs);
            setProtein(protein);
            setFat(fat);

            toast.success(comment, { duration: 5000, icon: '💪' });
        } catch (error) {
            console.error(error);
            toast.error('AI 분석에 실패했습니다. 직접 입력해주세요.');
        } finally {
            setIsAnalyzing(false);
            toast.dismiss(loadingToast);
        }
    };

    const handleDelete = async () => {
        if (!editingLog) return;
        if (!window.confirm('정말 삭제하시겠습니까?')) return;

        try {
            await deleteDietLog(editingLog.id);
            toast.success('삭제되었습니다.');
            setIsModalOpen(false);
            fetchLogs();
            fetchRecentLogs();
        } catch (error) {
            console.error(error);
            toast.error('삭제에 실패했습니다.');
        }
    };

    // Calculate total calories
    const totalCalories = logs.reduce((sum, log) => sum + (log.calories || 0), 0);

    // Chart Data for Modal
    const chartData = [
        { name: '탄수화물', value: Number(carbs) || 0 },
        { name: '단백질', value: Number(protein) || 0 },
        { name: '지방', value: Number(fat) || 0 },
    ].filter(item => item.value > 0);

    const completedMealsCount = MEAL_TYPES.filter(type => logs.some(log => log.meal_type === type.id)).length;
    const recent7Days = recentLogs.filter(log => {
        const diff = (new Date().getTime() - new Date(log.date).getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff < 7;
    });
    const activeDietDays = new Set(recent7Days.map(log => log.date)).size;
    const frequentMenus = Object.values(
        recentLogs.reduce<Record<string, { content: string; count: number }>>((acc, log) => {
            const key = log.content.trim();
            if (!key) return acc;
            if (!acc[key]) acc[key] = { content: key, count: 0 };
            acc[key].count += 1;
            return acc;
        }, {})
    )
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    const handleQuickFill = (menu: string) => {
        setContent(menu);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            {/* Header & Date Picker */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>식단 일지</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <button onClick={() => handleDateChange(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                    <span style={{ fontSize: '16px', fontWeight: '600' }}>
                        {format(selectedDate, 'M월 d일 (E)', { locale: ko })}
                    </span>
                    <button onClick={() => handleDateChange(1)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><ChevronRight size={20} /></button>
                </div>
            </div>

            {/* Summary Card */}
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '20px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div>
                    <div style={{ fontSize: '14px', color: '#6B7684', marginBottom: '4px' }}>오늘 먹은 칼로리</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#191F28' }}>
                        {totalCalories.toLocaleString()} <span style={{ fontSize: '16px', fontWeight: 'normal' }}>kcal</span>
                    </div>
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF4040' }}>
                    <Flame size={24} fill="#FF4040" />
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '24px'
            }}>
                <div style={{
                    backgroundColor: '#fff',
                    borderRadius: '18px',
                    padding: '18px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <CheckCircle2 size={18} color={TOSS_BLUE} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#191F28' }}>오늘 기록</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#191F28' }}>{completedMealsCount}/4</div>
                    <div style={{ fontSize: '12px', color: '#6B7684', marginTop: '4px' }}>아침, 점심, 저녁, 간식 기준</div>
                </div>
                <div style={{
                    backgroundColor: '#fff',
                    borderRadius: '18px',
                    padding: '18px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <History size={18} color="#10B981" />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#191F28' }}>최근 7일</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#191F28' }}>{activeDietDays}일</div>
                    <div style={{ fontSize: '12px', color: '#6B7684', marginTop: '4px' }}>식단을 기록한 날</div>
                </div>
            </div>

            {frequentMenus.length > 0 && (
                <div style={{
                    backgroundColor: '#fff',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                    marginBottom: '24px'
                }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#191F28', marginBottom: '12px' }}>자주 먹는 메뉴</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {frequentMenus.map((item) => (
                            <button
                                key={item.content}
                                onClick={() => {
                                    setSelectedMealType('Breakfast');
                                    setEditingLog(null);
                                    setCalories('');
                                    setCarbs('');
                                    setProtein('');
                                    setFat('');
                                    setPreviewUrl(null);
                                    setImageFile(null);
                                    handleQuickFill(item.content);
                                    setIsModalOpen(true);
                                }}
                                style={{
                                    border: 'none',
                                    borderRadius: '999px',
                                    padding: '10px 14px',
                                    backgroundColor: '#F2F4F6',
                                    color: '#191F28',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                {item.content} · {item.count}회
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Meal Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {MEAL_TYPES.map(type => {
                    const typeLogs = logs.filter(l => l.meal_type === type.id);

                    return (
                        <div key={type.id} style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: typeLogs.length > 0 ? '16px' : '0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: '700' }}>
                                    <span>{type.icon}</span>
                                    <span>{type.label}</span>
                                </div>
                                {typeLogs.length === 0 && (
                                    <button
                                        onClick={() => openModal(type.id)}
                                        style={{
                                            backgroundColor: '#E8F3FF',
                                            color: TOSS_BLUE,
                                            border: 'none',
                                            padding: '8px 16px',
                                            borderRadius: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        기록하기
                                    </button>
                                )}
                            </div>

                            {typeLogs.map(log => (
                                <div
                                    key={log.id}
                                    onClick={() => openModal(type.id, log)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        {log.image_url && (
                                            <img
                                                src={`${BASE_URL}${log.image_url}`}
                                                alt="Meal"
                                                style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover' }}
                                            />
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '16px', lineHeight: '1.5', color: '#333D4B', marginBottom: '4px' }}>{log.content}</p>
                                            {log.calories && (
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '13px', color: '#8B95A1', backgroundColor: '#F2F4F6', padding: '4px 8px', borderRadius: '6px' }}>
                                                        {log.calories} kcal
                                                    </span>
                                                    {/* 탄단지 정보 간략 표시 */}
                                                    {(log.carbs || log.protein || log.fat) && (
                                                        <span style={{ fontSize: '12px', color: '#6B7684' }}>
                                                            탄 {log.carbs || 0}g · 단 {log.protein || 0}g · 지 {log.fat || 0}g
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {typeLogs.length > 0 && (
                                <button
                                    onClick={() => openModal(type.id)}
                                    style={{
                                        width: '100%',
                                        marginTop: '12px',
                                        backgroundColor: '#fff',
                                        color: '#8B95A1',
                                        border: '1px dashed #E5E8EB',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Plus size={16} /> 추가하기
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        backgroundColor: '#fff', width: '90%', maxWidth: '400px', borderRadius: '24px',
                        padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            style={{ position: 'absolute', top: '20px', right: '20px', border: 'none', background: 'none', cursor: 'pointer' }}
                        >
                            <X size={24} color="#333" />
                        </button>

                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '24px' }}>
                            {editingLog ? '식단 수정' : '식단 기록'}
                        </h2>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#6B7684', marginBottom: '8px' }}>
                                언제 드셨나요?
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {MEAL_TYPES.map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setSelectedMealType(type.id)}
                                        style={{
                                            flex: 1,
                                            padding: '10px 0',
                                            borderRadius: '12px',
                                            border: selectedMealType === type.id ? `1px solid ${TOSS_BLUE}` : '1px solid #E5E8EB',
                                            backgroundColor: selectedMealType === type.id ? '#E8F3FF' : '#fff',
                                            color: selectedMealType === type.id ? TOSS_BLUE : '#6B7684',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#6B7684', marginBottom: '8px' }}>
                                무엇을 드셨나요?
                            </label>
                            {frequentMenus.length > 0 && !editingLog && (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                    {frequentMenus.map((item) => (
                                        <button
                                            key={`quick-${item.content}`}
                                            onClick={() => handleQuickFill(item.content)}
                                            style={{
                                                border: 'none',
                                                borderRadius: '999px',
                                                padding: '6px 10px',
                                                backgroundColor: '#E8F3FF',
                                                color: TOSS_BLUE,
                                                fontSize: '12px',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {item.content}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="예: 닭가슴살 샐러드, 아이스 아메리카노"
                                style={{
                                    width: '100%', height: '80px', padding: '16px', borderRadius: '16px',
                                    border: '1px solid #E5E8EB', fontSize: '16px', resize: 'none',
                                    backgroundColor: '#F9FAFB'
                                }}
                            />
                        </div>

                        {/* AI 분석 결과 차트 영역 */}
                        {chartData.length > 0 && (
                            <div style={{ marginBottom: '20px', backgroundColor: '#F9FAFB', borderRadius: '16px', padding: '16px' }}>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#6B7684', marginBottom: '12px', textAlign: 'center' }}>
                                    영양소 분석
                                </div>
                                <div style={{ width: '100%', height: '200px', display: 'flex', justifyContent: 'center' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={70}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6B7684', marginBottom: '4px' }}>
                                    칼로리 (kcal)
                                </label>
                                <input
                                    type="number"
                                    value={calories}
                                    onChange={e => setCalories(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="0"
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E5E8EB', backgroundColor: '#F9FAFB' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6B7684', marginBottom: '4px' }}>
                                    탄수화물 (g)
                                </label>
                                <input
                                    type="number"
                                    value={carbs}
                                    onChange={e => setCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="0"
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E5E8EB', backgroundColor: '#F9FAFB' }}
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6B7684', marginBottom: '4px' }}>
                                    단백질 (g)
                                </label>
                                <input
                                    type="number"
                                    value={protein}
                                    onChange={e => setProtein(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="0"
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E5E8EB', backgroundColor: '#F9FAFB' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6B7684', marginBottom: '4px' }}>
                                    지방 (g)
                                </label>
                                <input
                                    type="number"
                                    value={fat}
                                    onChange={e => setFat(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="0"
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E5E8EB', backgroundColor: '#F9FAFB' }}
                                />
                            </div>
                        </div>


                        <div style={{ marginBottom: '32px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#6B7684', marginBottom: '8px' }}>
                                사진
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: '100%', height: '160px', borderRadius: '16px',
                                    border: '1px dashed #E5E8EB', backgroundColor: '#F9FAFB',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', overflow: 'hidden', position: 'relative'
                                }}
                            >
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <>
                                        <Camera size={32} color="#8B95A1" />
                                        <span style={{ fontSize: '14px', color: '#8B95A1', marginTop: '8px' }}>사진 첨부하기</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                                {previewUrl && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewUrl(null);
                                            setImageFile(null);
                                        }}
                                        style={{
                                            position: 'absolute', top: '8px', right: '8px',
                                            backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%',
                                            padding: '4px', border: 'none', cursor: 'pointer'
                                        }}
                                    >
                                        <X size={16} color="#fff" />
                                    </button>
                                )}
                            </div>
                            {imageFile && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAIAnalysis();
                                    }}
                                    disabled={isAnalyzing}
                                    style={{
                                        width: '100%',
                                        marginTop: '12px',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        backgroundColor: '#E8F3FF',
                                        color: TOSS_BLUE,
                                        border: 'none',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {isAnalyzing ? '분석 중...' : 'AI로 자동 분석하기 ✨'}
                                </button>
                            )}
                        </div>

                        <button
                            onClick={handleSubmit}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '16px',
                                backgroundColor: TOSS_BLUE, color: '#fff', fontSize: '16px', fontWeight: 'bold',
                                border: 'none', cursor: 'pointer', marginBottom: editingLog ? '12px' : '0'
                            }}
                        >
                            {editingLog ? '수정하기' : '등록하기'}
                        </button>

                        {editingLog && (
                            <button
                                onClick={handleDelete}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: '16px',
                                    backgroundColor: '#FFF0F0', color: '#FF4040', fontSize: '16px', fontWeight: 'bold',
                                    border: 'none', cursor: 'pointer'
                                }}
                            >
                                삭제하기
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DietLogPage;
