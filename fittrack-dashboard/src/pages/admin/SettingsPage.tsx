import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getProducts, createProduct, deleteProduct, getNotificationTemplates, createNotificationTemplate, updateNotificationTemplate, resetNotificationTemplate, getSubCoaches, createSubCoach, deleteSubCoach, getAllPermissions, updateSubCoach } from '../../services/api';
import { Settings, Plus, Package, CreditCard, Coffee, Tag, Trash2, MessageSquare, Bell, RotateCcw, Edit2, Check, X, Users, Lock } from 'lucide-react';

const TOSS_BLUE = '#3182F6';

interface Product { id: number; name: string; price: number; months?: number; category: string; is_active: boolean; }
interface NotificationTemplate { id: number; type: string; title: string; message: string; created_at: string; updated_at: string; }

const SettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'products' | 'notifications' | 'sub-coaches'>('products');
    const [products, setProducts] = useState<Product[]>([]);
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('membership');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [months, setMonths] = useState('1');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editMessage, setEditMessage] = useState('');
    const [showAddTemplate, setShowAddTemplate] = useState(false);
    const [newTemplateType, setNewTemplateType] = useState('');
    const [newTemplateTitle, setNewTemplateTitle] = useState('');
    const [newTemplateMessage, setNewTemplateMessage] = useState('');
    const [selectedVariable, setSelectedVariable] = useState<string>('member_name');
    const [subCoaches, setSubCoaches] = useState<any[]>([]);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [showAddCoachModal, setShowAddCoachModal] = useState(false);
    const [showEditPermissionsModal, setShowEditPermissionsModal] = useState(false);
    const [editingCoachId, setEditingCoachId] = useState<number | null>(null);
    const [coachName, setCoachName] = useState('');
    const [coachPhonePart1, setCoachPhonePart1] = useState('010');
    const [coachPhonePart2, setCoachPhonePart2] = useState('');
    const [coachPhonePart3, setCoachPhonePart3] = useState('');
    const [coachPassword, setCoachPassword] = useState('');
    const [coachHourlyWage, setCoachHourlyWage] = useState<number>(0);
    const [coachClassWage, setCoachClassWage] = useState<number>(0);
    const [coachColor, setCoachColor] = useState(TOSS_BLUE);


    const [editingCoachName, setEditingCoachName] = useState('');
    const [editingCoachPhonePart1, setEditingCoachPhonePart1] = useState('010');
    const [editingCoachPhonePart2, setEditingCoachPhonePart2] = useState('');
    const [editingCoachPhonePart3, setEditingCoachPhonePart3] = useState('');
    const [editingCoachPassword, setEditingCoachPassword] = useState('');
    const [editingCoachHourlyWage, setEditingCoachHourlyWage] = useState<number>(0);
    const [editingCoachClassWage, setEditingCoachClassWage] = useState<number>(0);
    const [editingCoachColor, setEditingCoachColor] = useState(TOSS_BLUE);


    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
    const [editingPermissions, setEditingPermissions] = useState<number[]>([]);

    useEffect(() => {
        fetchProducts();
        fetchTemplates();
        fetchSubCoaches();
        fetchPermissions();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await getProducts();
            setProducts(res.data);
        } catch (e: any) {
            if (e?.response?.status !== 403) {
                toast.error("상품 목록을 불러올 수 없습니다.");
            }
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await getNotificationTemplates();
            setTemplates(res.data);
        } catch (e: any) {
            if (e?.response?.status !== 403) {
                toast.error("알림 템플릿을 불러올 수 없습니다.");
            }
            setTemplates([]);
        }
    };

    const handleCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !price) return;
        try {
            await createProduct({ category, name, price: parseInt(price), months: category === 'membership' ? parseInt(months) : undefined });
            toast.success("상품이 추가되었습니다.");
            setName('');
            setPrice('');
            setMonths('1');
            setCategory('membership');
            fetchProducts();
        } catch (e) {
            toast.error("상품 추가 실패");
        }
    };

    const handleDeleteProduct = async (id: number) => {
        if (!window.confirm("정말 이 상품을 삭제하시겠습니까?")) return;
        try {
            await deleteProduct(id);
            toast.success("삭제되었습니다.");
            fetchProducts();
        } catch (e) {
            toast.error("삭제 실패");
        }
    };

    const handleEditTemplate = (template: NotificationTemplate) => {
        setEditingId(template.id);
        setEditTitle(template.title);
        setEditMessage(template.message);
    };

    const handleSaveTemplate = async (id: number) => {
        try {
            await updateNotificationTemplate(id, { title: editTitle, message: editMessage });
            toast.success("템플릿이 저장되었습니다.");
            setEditingId(null);
            fetchTemplates();
        } catch (e) {
            toast.error("저장 실패");
        }
    };

    const handleResetTemplate = async (templateType: string) => {
        if (!window.confirm("기본값으로 초기화하시겠습니까?")) return;
        try {
            await resetNotificationTemplate(templateType);
            toast.success("초기화되었습니다.");
            fetchTemplates();
        } catch (e) {
            toast.error("초기화 실패");
        }
    };

    const handleAddTemplate = async () => {
        if (!newTemplateType || !newTemplateTitle || !newTemplateMessage) {
            toast.error("모든 필드를 입력해주세요.");
            return;
        }
        try {
            await createNotificationTemplate({ type: newTemplateType, title: newTemplateTitle, message: newTemplateMessage });
            toast.success("템플릿이 추가되었습니다.");
            setNewTemplateType('');
            setNewTemplateTitle('');
            setNewTemplateMessage('');
            setShowAddTemplate(false);
            fetchTemplates();
        } catch (e) {
            toast.error("추가 실패");
        }
    };

    const insertVariable = (variable: string) => {
        setNewTemplateMessage(newTemplateMessage + `{${variable}}`);
    };

    const fetchSubCoaches = async () => {
        try {
            const res = await getSubCoaches();
            setSubCoaches(res.data);
        } catch (e: any) {
            if (e?.response?.status !== 403) {
                toast.error("부코치 목록을 불러올 수 없습니다.");
            }
            setSubCoaches([]);
        }
    };

    const fetchPermissions = async () => {
        try {
            const res = await getAllPermissions();
            setPermissions(res.data);
        } catch (e: any) {
            if (e?.response?.status !== 403) {
                toast.error("권한 목록을 불러올 수 없습니다.");
            }
            setPermissions([]);
        }
    };

    const handleCreateSubCoach = async () => {
        if (!coachName || !coachPhonePart2 || !coachPhonePart3 || !coachPassword || selectedPermissions.length === 0) {
            toast.error("모든 정보를 입력해주세요.");
            return;
        }
        const fullPhone = `${coachPhonePart1}-${coachPhonePart2}-${coachPhonePart3}`;
        try {
            await createSubCoach({
                name: coachName,
                phone: fullPhone,
                password: coachPassword,
                hourly_wage: coachHourlyWage,
                class_wage: coachClassWage,
                color: coachColor,
                permission_ids: selectedPermissions
            });
            toast.success("부코치가 생성되었습니다.");
            setCoachName('');
            setCoachPhonePart1('010');
            setCoachPhonePart2('');
            setCoachPhonePart3('');
            setCoachPassword('');
            setCoachHourlyWage(0);
            setCoachClassWage(0);
            setCoachColor(TOSS_BLUE);
            setSelectedPermissions([]);
            setShowAddCoachModal(false);
            fetchSubCoaches();
        } catch (e) {
            toast.error("생성 실패");
        }
    };

    const openEditSubCoachModal = (coach: any) => {
        setEditingCoachId(coach.id);
        setEditingCoachName(coach.name);

        const phoneParts = coach.phone ? coach.phone.split('-') : ['010', '', ''];
        setEditingCoachPhonePart1(phoneParts[0] || '010');
        setEditingCoachPhonePart2(phoneParts[1] || '');
        setEditingCoachPhonePart3(phoneParts[2] || '');

        setEditingCoachHourlyWage(coach.hourly_wage || 0);
        setEditingCoachClassWage(coach.class_wage || 0);
        setEditingCoachColor(coach.color || TOSS_BLUE);
        setEditingCoachPassword('');
        setEditingPermissions(coach.permissions ? coach.permissions.map((p: any) => p.id) : []);
        setShowEditPermissionsModal(true);
    };

    const handleSaveSubCoachInfo = async () => {
        if (!editingCoachId) return;

        const fullPhone = `${editingCoachPhonePart1}-${editingCoachPhonePart2}-${editingCoachPhonePart3}`;

        try {
            await updateSubCoach(editingCoachId, {
                name: editingCoachName,
                phone: fullPhone,
                password: editingCoachPassword ? editingCoachPassword : undefined,
                hourly_wage: editingCoachHourlyWage,
                class_wage: editingCoachClassWage,
                color: editingCoachColor,
                permission_ids: editingPermissions
            });
            toast.success("부코치 정보가 저장되었습니다.");
            setShowEditPermissionsModal(false);
            setEditingCoachId(null);
            fetchSubCoaches();
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "저장 실패");
        }
    };

    const handleDeleteSubCoach = async (coachId: number) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        try {
            await deleteSubCoach(coachId);
            toast.success("삭제되었습니다.");
            fetchSubCoaches();
        } catch (e) {
            toast.error("삭제 실패");
        }
    };

    const toggleEditingPermission = (permissionId: number) => {
        if (editingPermissions.includes(permissionId)) {
            setEditingPermissions(editingPermissions.filter(id => id !== permissionId));
        } else {
            setEditingPermissions([...editingPermissions, permissionId]);
        }
    };

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'membership': return <CreditCard size={14} />;
            case 'goods': return <Package size={14} />;
            case 'food': return <Coffee size={14} />;
            default: return <Tag size={14} />;
        }
    };

    const getCategoryLabel = (cat: string) => {
        switch (cat) {
            case 'membership': return '회원권';
            case 'goods': return '용품';
            case 'food': return '음료';
            default: return '기타';
        }
    };

    const getTemplateLabel = (type: string) => {
        const labels: { [key: string]: string } = {
            'expiry_7days': '회원권 만료 7일 전',
            'expiry_3days': '회원권 만료 3일 전',
            'inactivity_7days': '7일 이상 미출석',
            'inactivity_no_checkin': '가입 후 미출석',
        };
        return labels[type] || type;
    };

    const getTemplateVariables = (type: string): string[] => {
        const variables: { [key: string]: string[] } = {
            'expiry_7days': ['member_name', 'days_left'],
            'expiry_3days': ['member_name', 'days_left'],
            'inactivity_7days': ['member_name', 'days_since'],
            'inactivity_no_checkin': ['member_name', 'days_since_join'],
        };
        return variables[type] || [];
    };

    if (loading) return <div style={styles.loading}>로딩 중...</div>;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.pageTitle}>환경 설정</h1>
                <p style={styles.subtitle}>체육관 설정을 관리합니다</p>
            </div>

            {/* 탭 네비게이션 */}
            <div style={styles.tabContainer}>
                <button
                    style={{
                        ...styles.tabButton,
                        ...(activeTab === 'products' ? styles.tabButtonActive : styles.tabButtonInactive),
                    }}
                    onClick={() => setActiveTab('products')}
                >
                    <Package size={16} /> 상품 관리
                </button>
                <button
                    style={{
                        ...styles.tabButton,
                        ...(activeTab === 'notifications' ? styles.tabButtonActive : styles.tabButtonInactive),
                    }}
                    onClick={() => setActiveTab('notifications')}
                >
                    <MessageSquare size={16} /> 문자 설정
                </button>
                <button
                    style={{
                        ...styles.tabButton,
                        ...(activeTab === 'sub-coaches' ? styles.tabButtonActive : styles.tabButtonInactive),
                    }}
                    onClick={() => setActiveTab('sub-coaches')}
                >
                    <Users size={16} /> 부코치 관리
                </button>
            </div>

            {/* 상품 관리 탭 */}
            {activeTab === 'products' && (
                <div style={styles.grid}>
                    {/* 상품 추가 */}
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <div style={styles.iconBox}><Plus size={24} color={TOSS_BLUE} /></div>
                            <h3 style={styles.cardTitle}>새 상품 추가</h3>
                        </div>
                        <form onSubmit={handleCreateProduct}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>카테고리</label>
                                <div style={styles.catRow}>
                                    {['membership', 'goods', 'food', 'etc'].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setCategory(c)}
                                            style={category === c ? styles.catActive : styles.catInactive}
                                        >
                                            {getCategoryIcon(c)} {getCategoryLabel(c)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>상품명</label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="예: 3개월 이벤트, 단백질 쉐이크"
                                    style={styles.input}
                                    required
                                />
                            </div>
                            <div style={styles.row}>
                                <div style={{ flex: 1 }}>
                                    <label style={styles.label}>가격 (원)</label>
                                    <input
                                        type="number"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                        placeholder="150000"
                                        style={styles.input}
                                        required
                                    />
                                </div>
                                {category === 'membership' && (
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.label}>기간 (개월)</label>
                                        <input
                                            type="number"
                                            value={months}
                                            onChange={e => setMonths(e.target.value)}
                                            style={styles.input}
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                            <button type="submit" style={styles.submitBtn}>
                                <Plus size={16} /> 등록하기
                            </button>
                        </form>
                    </div>

                    {/* 상품 목록 */}
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <div style={{ ...styles.iconBox, backgroundColor: '#F3F4F6' }}>
                                <Settings size={24} color="#6B7280" />
                            </div>
                            <h3 style={styles.cardTitle}>등록된 상품 ({products.length})</h3>
                        </div>
                        <div style={styles.productList}>
                            {products.length === 0 ? (
                                <div style={styles.emptyBox}>등록된 상품이 없습니다</div>
                            ) : (
                                products.map(p => (
                                    <div key={p.id} style={styles.productItem}>
                                        <div style={{ flex: 1 }}>
                                            <div style={styles.productRow}>
                                                <span
                                                    style={{
                                                        ...styles.categoryBadge,
                                                        backgroundColor: p.category === 'membership' ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                                                        color: p.category === 'membership' ? 'var(--primary)' : 'var(--text-secondary)',
                                                    }}
                                                >
                                                    {getCategoryIcon(p.category)} {getCategoryLabel(p.category)}
                                                </span>
                                                <span style={styles.productName}>{p.name}</span>
                                            </div>
                                            <div style={styles.productPrice}>
                                                {p.category === 'membership' && p.months ? `${p.months}개월 / ` : ''}{p.price.toLocaleString()}원
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteProduct(p.id)} style={styles.deleteBtn}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 문자 설정 탭 */}
            {activeTab === 'notifications' && (
                <div>
                    {!showAddTemplate && (
                        <button
                            onClick={() => setShowAddTemplate(true)}
                            style={{ ...styles.submitBtn, marginBottom: '20px', backgroundColor: TOSS_BLUE }}
                        >
                            <Plus size={16} /> 새 템플릿 추가
                        </button>
                    )}

                    {showAddTemplate && (
                        <div style={styles.card}>
                            <div style={styles.cardHeader}>
                                <h3 style={styles.cardTitle}>새 템플릿 추가</h3>
                            </div>
                            <div style={styles.formSection}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>템플릿 타입 (예: custom_event)</label>
                                    <input
                                        value={newTemplateType}
                                        onChange={e => setNewTemplateType(e.target.value)}
                                        placeholder="템플릿 고유 이름"
                                        style={styles.input}
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>제목</label>
                                    <input
                                        value={newTemplateTitle}
                                        onChange={e => setNewTemplateTitle(e.target.value)}
                                        placeholder="템플릿 제목"
                                        style={styles.input}
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>메시지</label>
                                    <textarea
                                        value={newTemplateMessage}
                                        onChange={e => setNewTemplateMessage(e.target.value)}
                                        placeholder="메시지 내용"
                                        style={{ ...styles.input, minHeight: '100px', fontFamily: 'monospace', fontSize: '12px' }}
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>변수 삽입</label>
                                    <div style={styles.variableInsertRow}>
                                        <select
                                            value={selectedVariable}
                                            onChange={e => setSelectedVariable(e.target.value)}
                                            style={{ ...styles.input, flex: 1 }}
                                        >
                                            <option value="member_name">회원 이름 - {`{member_name}`}</option>
                                            <option value="days_left">남은 일수 - {`{days_left}`}</option>
                                            <option value="days_since">경과 일수 - {`{days_since}`}</option>
                                            <option value="days_since_join">가입 후 경과 일수 - {`{days_since_join}`}</option>
                                        </select>
                                        <button
                                            onClick={() => insertVariable(selectedVariable)}
                                            style={{ ...styles.submitBtn, width: 'auto', padding: '12px 14px', marginLeft: '8px' }}
                                        >
                                            <Plus size={14} /> 삽입
                                        </button>
                                    </div>
                                </div>
                                <div style={styles.editActions}>
                                    <button
                                        onClick={handleAddTemplate}
                                        style={styles.saveBtn}
                                    >
                                        <Check size={14} /> 저장
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAddTemplate(false);
                                            setNewTemplateType('');
                                            setNewTemplateTitle('');
                                            setNewTemplateMessage('');
                                        }}
                                        style={styles.cancelBtn}
                                    >
                                        <X size={14} /> 취소
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={styles.notificationGrid}>
                        {templates.map(template => (
                            <div key={template.id} style={styles.templateCard}>
                                <div style={styles.templateHeader}>
                                    <div style={styles.templateTypeRow}>
                                        <Bell size={16} color={TOSS_BLUE} />
                                        <span style={styles.templateType}>{getTemplateLabel(template.type)}</span>
                                    </div>
                                    {editingId !== template.id && (
                                        <div style={styles.templateActions}>
                                            <button
                                                onClick={() => handleEditTemplate(template)}
                                                style={styles.templateEditBtn}
                                                title="수정"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleResetTemplate(template.type)}
                                                style={styles.templateResetBtn}
                                                title="초기화"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {editingId === template.id ? (
                                    // 편집 모드
                                    <div style={styles.editMode}>
                                        <div style={styles.formGroup}>
                                            <label style={styles.label}>제목</label>
                                            <input
                                                value={editTitle}
                                                onChange={e => setEditTitle(e.target.value)}
                                                style={styles.input}
                                            />
                                        </div>
                                        <div style={styles.formGroup}>
                                            <label style={styles.label}>메시지</label>
                                            <textarea
                                                value={editMessage}
                                                onChange={e => setEditMessage(e.target.value)}
                                                style={{
                                                    ...styles.input,
                                                    minHeight: '100px',
                                                    fontFamily: 'monospace',
                                                    fontSize: '12px',
                                                }}
                                            />
                                        </div>
                                        <div style={styles.variableBadges}>
                                            <span style={styles.variableLabel}>사용 가능한 변수:</span>
                                            {getTemplateVariables(template.type).map(v => (
                                                <span key={v} style={styles.variableBadge}>{`{${v}}`}</span>
                                            ))}
                                        </div>
                                        <div style={styles.editActions}>
                                            <button
                                                onClick={() => handleSaveTemplate(template.id)}
                                                style={styles.saveBtn}
                                            >
                                                <Check size={14} /> 저장
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                style={styles.cancelBtn}
                                            >
                                                <X size={14} /> 취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // 미리보기 모드
                                    <div style={styles.previewMode}>
                                        <div style={styles.previewSection}>
                                            <span style={styles.previewLabel}>제목</span>
                                            <p style={styles.previewTitle}>{template.title}</p>
                                        </div>
                                        <div style={styles.previewSection}>
                                            <span style={styles.previewLabel}>메시지</span>
                                            <p style={styles.previewMessage}>{template.message}</p>
                                        </div>
                                        <div style={styles.variableBadges}>
                                            <span style={styles.variableLabel}>변수:</span>
                                            {getTemplateVariables(template.type).map(v => (
                                                <span key={v} style={styles.variableBadge}>{`{${v}}`}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 부코치 관리 탭 */}
            {activeTab === 'sub-coaches' && (
                <div>
                    <button
                        onClick={() => {
                            setCoachName('');
                            setCoachPhonePart1('010');
                            setCoachPhonePart2('');
                            setCoachPhonePart3('');
                            setCoachPassword('');
                            setSelectedPermissions([]);
                            setShowAddCoachModal(true);
                        }}
                        style={{ ...styles.submitBtn, marginBottom: '20px', backgroundColor: TOSS_BLUE }}
                    >
                        <Plus size={16} /> 새 부코치 추가
                    </button>

                    <div style={styles.coachesContainer}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
                            등록된 부코치 ({subCoaches.length})
                        </h3>
                        {subCoaches.length === 0 ? (
                            <div style={styles.emptyBox}>등록된 부코치가 없습니다</div>
                        ) : (
                            <div style={styles.coachesList}>
                                {subCoaches.map(coach => (
                                    <div key={coach.id} style={styles.coachCard}>
                                        <div style={styles.coachInfo}>
                                            <div style={styles.coachNamePhone}>
                                                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                                    {coach.name}
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    {coach.phone}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#6B7280' }}>
                                                    <CreditCard size={14} />
                                                    <span>
                                                        시급 {coach.hourly_wage ? coach.hourly_wage.toLocaleString() : 0}원
                                                        {coach.class_wage && coach.class_wage > 0 ? ` | 수업료 ${coach.class_wage.toLocaleString()}원` : ''}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: coach.color || TOSS_BLUE }}></div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                        권한: {coach.permissions && coach.permissions.length > 0 ? coach.permissions.length : 0}개
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => openEditSubCoachModal(coach)}
                                                style={{ ...styles.submitBtn, width: 'auto', padding: '10px 16px', marginTop: 0, fontSize: '14px' }}
                                            >
                                                <Edit2 size={14} /> 정보 및 권한 수정
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSubCoach(coach.id)}
                                                style={styles.deleteBtn}
                                                title="삭제"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 새 부코치 추가 모달 */}
            {showAddCoachModal && (
                <div style={styles.modalOverlay} onClick={() => setShowAddCoachModal(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h3 style={styles.modalTitle}>새 부코치 추가</h3>
                            <button
                                onClick={() => setShowAddCoachModal(false)}
                                style={styles.modalCloseBtn}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>이름</label>
                                <input
                                    value={coachName}
                                    onChange={e => setCoachName(e.target.value)}
                                    placeholder="부코치 이름"
                                    style={styles.input}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>전화번호</label>
                                <div style={styles.phoneInputRow}>
                                    <input
                                        type="text"
                                        value={coachPhonePart1}
                                        disabled
                                        style={{ ...styles.phoneInput, backgroundColor: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
                                    />
                                    <span style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-secondary)' }}>-</span>
                                    <input
                                        type="number"
                                        value={coachPhonePart2}
                                        onChange={e => {
                                            if (e.target.value.length <= 4) {
                                                setCoachPhonePart2(e.target.value);
                                                if (e.target.value.length === 4) {
                                                    (document.getElementById('coachPhonePart3') as HTMLInputElement)?.focus();
                                                }
                                            }
                                        }}
                                        maxLength={4}
                                        placeholder="1234"
                                        style={styles.phoneInput}
                                    />
                                    <span style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-secondary)' }}>-</span>
                                    <input
                                        id="coachPhonePart3"
                                        type="number"
                                        value={coachPhonePart3}
                                        onChange={e => {
                                            if (e.target.value.length <= 4) {
                                                setCoachPhonePart3(e.target.value);
                                            }
                                        }}
                                        maxLength={4}
                                        placeholder="5678"
                                        style={styles.phoneInput}
                                    />
                                </div>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>비밀번호</label>
                                <input
                                    type="password"
                                    value={coachPassword}
                                    onChange={e => setCoachPassword(e.target.value)}
                                    placeholder="비밀번호"
                                    style={styles.input}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>예상 시급 (원)</label>
                                    <input
                                        type="text"
                                        value={coachHourlyWage === 0 ? '' : coachHourlyWage}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setCoachHourlyWage(val ? parseInt(val) : 0);
                                        }}
                                        placeholder="예: 15000"
                                        style={styles.input}
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>수업 1회당 급여 (원)</label>
                                    <input
                                        type="text"
                                        value={coachClassWage === 0 ? '' : coachClassWage}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setCoachClassWage(val ? parseInt(val) : 0);
                                        }}
                                        placeholder="예: 30000"
                                        style={styles.input}
                                    />
                                </div>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>권한 설정</label>
                                <div style={styles.permissionCheckboxes}>
                                    {permissions.map(perm => (
                                        <label key={perm.id} style={styles.permissionLabel}>
                                            <input
                                                type="checkbox"
                                                checked={selectedPermissions.includes(perm.id)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setSelectedPermissions([...selectedPermissions, perm.id]);
                                                    } else {
                                                        setSelectedPermissions(selectedPermissions.filter(id => id !== perm.id));
                                                    }
                                                }}
                                                style={styles.checkbox}
                                            />
                                            <span>{perm.display_name || perm.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button
                                onClick={handleCreateSubCoach}
                                style={styles.saveBtn}
                            >
                                <Check size={14} /> 생성
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddCoachModal(false);
                                    setCoachName('');
                                    setCoachPhonePart1('010');
                                    setCoachPhonePart2('');
                                    setCoachPhonePart3('');
                                    setCoachPassword('');
                                    setSelectedPermissions([]);
                                }}
                                style={styles.cancelBtn}
                            >
                                <X size={14} /> 취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 권한 수정 모달 */}
            {showEditPermissionsModal && (
                <div style={styles.modalOverlay} onClick={() => setShowEditPermissionsModal(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h3 style={styles.modalTitle}>정보 및 권한 수정</h3>
                            <button
                                onClick={() => setShowEditPermissionsModal(false)}
                                style={styles.modalCloseBtn}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>이름</label>
                                <input
                                    value={editingCoachName}
                                    onChange={e => setEditingCoachName(e.target.value)}
                                    placeholder="부코치 이름"
                                    style={styles.input}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>전화번호</label>
                                <div style={styles.phoneInputRow}>
                                    <input
                                        type="text"
                                        value={editingCoachPhonePart1}
                                        disabled
                                        style={{ ...styles.phoneInput, backgroundColor: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
                                    />
                                    <span style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-secondary)' }}>-</span>
                                    <input
                                        type="text"
                                        value={editingCoachPhonePart2}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            if (val.length <= 4) setEditingCoachPhonePart2(val);
                                        }}
                                        maxLength={4}
                                        style={styles.phoneInput}
                                    />
                                    <span style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-secondary)' }}>-</span>
                                    <input
                                        type="text"
                                        value={editingCoachPhonePart3}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            if (val.length <= 4) setEditingCoachPhonePart3(val);
                                        }}
                                        maxLength={4}
                                        style={styles.phoneInput}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>예상 시급 (원)</label>
                                    <input
                                        type="text"
                                        value={editingCoachHourlyWage === 0 ? '' : editingCoachHourlyWage}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setEditingCoachHourlyWage(val ? parseInt(val) : 0);
                                        }}
                                        style={styles.input}
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>수업 1회당 급여 (원)</label>
                                    <input
                                        type="text"
                                        value={editingCoachClassWage === 0 ? '' : editingCoachClassWage}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setEditingCoachClassWage(val ? parseInt(val) : 0);
                                        }}
                                        style={styles.input}
                                    />
                                </div>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>비밀번호 변경 (변경할 경우만 입력)</label>
                                <input
                                    type="password"
                                    value={editingCoachPassword}
                                    onChange={e => setEditingCoachPassword(e.target.value)}
                                    placeholder="새 비밀번호"
                                    style={styles.input}
                                />
                            </div>


                            <div style={{ marginTop: '20px', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>권한 설정</div>
                            <div style={styles.permissionCheckboxes}>
                                {permissions.map(perm => (
                                    <label key={perm.id} style={styles.permissionLabel}>
                                        <input
                                            type="checkbox"
                                            checked={editingPermissions.includes(perm.id)}
                                            onChange={() => toggleEditingPermission(perm.id)}
                                            style={styles.checkbox}
                                        />
                                        <span>{perm.display_name || perm.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button
                                onClick={handleSaveSubCoachInfo}
                                style={styles.saveBtn}
                            >
                                <Check size={14} /> 저장
                            </button>
                            <button
                                onClick={() => setShowEditPermissionsModal(false)}
                                style={styles.cancelBtn}
                            >
                                <X size={14} /> 취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '16px', minHeight: '100vh', backgroundColor: 'var(--bg-main)', transition: 'background-color 0.3s' },
    loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--text-tertiary)' },
    header: { marginBottom: '24px' },
    pageTitle: { fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
    subtitle: { fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '4px' },

    // 탭 네비게이션
    tabContainer: { display: 'flex', gap: '0px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)' },
    tabButton: { padding: '14px 20px', border: 'none', backgroundColor: 'transparent', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' },
    tabButtonActive: { color: 'var(--primary)', borderBottom: '3px solid var(--primary)', marginBottom: '-1px' },
    tabButtonInactive: { color: 'var(--text-secondary)', borderBottom: '3px solid transparent', marginBottom: '-1px' },

    // 그리드
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' },
    notificationGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },

    // 카드
    card: { backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' },
    templateCard: { backgroundColor: 'var(--bg-card)', borderRadius: '10px', padding: '12px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', minWidth: 0 },
    cardHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
    iconBox: { width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },

    // 템플릿 헤더
    templateHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' },
    templateTypeRow: { display: 'flex', alignItems: 'center', gap: '6px' },
    templateType: { fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' },
    templateActions: { display: 'flex', gap: '6px' },
    templateEditBtn: { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--primary-bg)', border: 'none', borderRadius: '6px', color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s' },
    templateResetBtn: { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', border: 'none', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' },

    // 폼 그룹
    formGroup: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '14px', boxSizing: 'border-box' as const, outline: 'none', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
    phoneInputRow: { display: 'flex', alignItems: 'center', gap: '8px' },
    phoneInput: { flex: 1, padding: '12px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '14px', textAlign: 'center' as const, outline: 'none', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' },
    row: { display: 'flex', gap: '12px', marginBottom: '16px' },

    // 카테고리
    catRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const },
    catActive: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFFFFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
    catInactive: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },

    // 버튼
    submitBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFFFFF', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginTop: '8px' },
    saveBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFFFFF', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
    cancelBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },

    // 상품 목록
    productList: { display: 'flex', flexDirection: 'column' as const, gap: '12px' },
    productItem: { display: 'flex', alignItems: 'center', padding: '14px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' },
    productRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
    categoryBadge: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' },
    productName: { fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' },
    productPrice: { fontSize: '13px', color: 'var(--text-secondary)' },
    deleteBtn: { width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--danger-bg)', border: 'none', borderRadius: '8px', color: 'var(--danger)', cursor: 'pointer' },
    emptyBox: { padding: '40px', textAlign: 'center' as const, color: 'var(--text-tertiary)' },

    // 편집/미리보기 모드
    editMode: { backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px', marginBottom: '0px' },
    previewMode: { backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px', marginBottom: '0px' },

    previewSection: { marginBottom: '8px' },
    previewLabel: { display: 'block', fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '2px', textTransform: 'uppercase' as const, letterSpacing: '0.3px' },
    previewTitle: { fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, lineHeight: '1.3' },
    previewMessage: { fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' },

    variableBadges: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' as const, marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' },
    variableLabel: { fontSize: '9px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.3px' },
    variableBadge: { display: 'inline-block', padding: '3px 6px', borderRadius: '4px', backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'monospace', fontWeight: '600' },

    editActions: { display: 'flex', gap: '8px', marginTop: '16px' },
    formSection: { display: 'flex', flexDirection: 'column' as const, gap: '16px' },
    variableInsertRow: { display: 'flex', gap: '8px', alignItems: 'center' },

    // 부코치 관리
    permissionCheckboxes: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px' },
    permissionLabel: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' },
    checkbox: { width: '18px', height: '18px', cursor: 'pointer', accentColor: TOSS_BLUE },
    coachesContainer: { marginTop: '20px' },
    coachesList: { display: 'flex', flexDirection: 'column' as const, gap: '12px' },
    coachCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' },
    coachInfo: { display: 'flex', alignItems: 'center', flex: 1 },
    coachNamePhone: { flex: 1 },

    // 모달
    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
    modalContent: { backgroundColor: 'var(--bg-card)', borderRadius: '16px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid var(--border-color)' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
    modalCloseBtn: { width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', border: 'none', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' },
    modalBody: { padding: '24px', borderBottom: '1px solid var(--border-color)' },
    modalFooter: { display: 'flex', gap: '8px', padding: '24px', justifyContent: 'flex-end' },
};

export default SettingsPage;
