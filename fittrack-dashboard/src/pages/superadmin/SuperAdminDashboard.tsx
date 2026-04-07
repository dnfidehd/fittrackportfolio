
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppContext } from '../../contexts/AppContext';
import {
  getSuperAdminStats,
  getAllGyms,
  getAllCoaches,
  createGym,
  updateGym,
  deleteGym,
  createCoach,
  updateCoach,
  deleteCoach,
  sendSystemAnnouncement,
  getSystemAnnouncements,
  toggleSystemAnnouncementVisibility,
  getGymStats,
  addCoachToGym, // ✅ [신규] 코치 지점 추가 함수
  api // ✅ [수정] api 모듈 추가 임포트
} from '../../services/api';
import DaumPostcode from 'react-daum-postcode'; // ✅ Daum 우편번호 추가
import {
  Users, UserCog, Building2, Search, Filter, ShieldCheck, Mail, LogOut,
  Settings, Save, MoreVertical, CheckCircle, AlertCircle, Sun, Moon,
  Plus, Edit, Trash2, KeyRound, DollarSign, Send, ChevronUp, ChevronDown, Eye, EyeOff, Trophy,
  Image as ImageIcon, X
} from 'lucide-react';

interface Gym {
  id: number;
  name: string;
  location: string | null;
  member_count: number;
  coach_count: number;
  // ✅ [신규] 구독 정보
  subscription_plan: string;
  subscription_start_date: string;
  next_billing_date: string;
  monthly_fee: number;
  payment_status: string;
  latitude?: number | null;
  longitude?: number | null;
  drop_in_price?: number;
  description?: string | null;
  drop_in_enabled?: boolean;
  last_activity_date?: string | null;
}

interface Coach {
  id: number;
  gym_id: number;
  gym_name: string;
  name: string;
  phone: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
  is_popup: boolean;
  image_url?: string | null;
}

interface Stats {
  total_gyms: number;
  total_members: number;
  total_coaches: number;
  total_revenue: number;
}

interface GymStats {
  gym_name: string;
  total_members: number;
  active_members: number;
  monthly_revenue: number;
  today_attendance: number;
}

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout, isDarkMode, toggleTheme } = useAppContext();
  const [stats, setStats] = useState<Stats | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]); // ✅ [신규] 대회 목록 상태
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 모달 상태
  const [showGymModal, setShowGymModal] = useState(false);
  const [showEditGymModal, setShowEditGymModal] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [showAddCoachToGymModal, setShowAddCoachToGymModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showGymStatsModal, setShowGymStatsModal] = useState(false);
  const [selectedGymStats, setSelectedGymStats] = useState<GymStats | null>(null);
  const [selectedCoachForGymAdd, setSelectedCoachForGymAdd] = useState<Coach | null>(null);
  const [selectedTargetGym, setSelectedTargetGym] = useState<number | null>(null);
  const [selectedGymForEdit, setSelectedGymForEdit] = useState<Gym | null>(null);
  const [coachPasswordDrafts, setCoachPasswordDrafts] = useState<Record<number, string>>({});

  // 폼 상태
  const [gymForm, setGymForm] = useState({
    name: '',
    location: '',
    latitude: 0,
    longitude: 0,
    drop_in_price: 20000,
    description: '',
    drop_in_enabled: true
  });
  const [gymEditForm, setGymEditForm] = useState({
    name: '',
    location: '',
    latitude: 0,
    longitude: 0,
    drop_in_price: 20000,
    description: '',
    drop_in_enabled: true,
    subscription_plan: 'Standard',
    subscription_start_date: '',
    next_billing_date: '',
    monthly_fee: 199000,
    payment_status: 'paid'
  });
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false); // ✅ 주소 검색 모달 상태
  const [coachForm, setCoachForm] = useState({ gym_id: 0, name: '', phone: '010--', password: '', role: 'coach' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', target: 'all' });
  const [announcementFile, setAnnouncementFile] = useState<File | null>(null); // ✅ 이미지 파일
  const [announcementPreview, setAnnouncementPreview] = useState<string | null>(null); // ✅ 미리보기

  // ✅ [신규] 필터 상태
  const [gymSearch, setGymSearch] = useState('');
  const [gymPaymentFilter, setGymPaymentFilter] = useState('all');
  const [coachSearch, setCoachSearch] = useState('');
  const [coachGymFilter, setCoachGymFilter] = useState(0);

  // ✅ [신규] 탭 및 확장 상태
  const [activeTab, setActiveTab] = useState<'gyms' | 'competitions'>('gyms');
  const [expandedGymId, setExpandedGymId] = useState<number | null>(null);

  // ✅ [신규] 필터링된 데이터
  const filteredGyms = gyms.filter(gym => {
    const searchMatch = gym.name.toLowerCase().includes(gymSearch.toLowerCase()) ||
      (gym.location && gym.location.toLowerCase().includes(gymSearch.toLowerCase()));
    const paymentMatch = gymPaymentFilter === 'all' || gym.payment_status === gymPaymentFilter;
    return searchMatch && paymentMatch;
  });

  // 코치 데이터는 특정 체육관이 열렸을 때 해당 체육관의 코치만 필터링하여 사용할 예정입니다.
  const getCoachesForGym = (gymId: number) => {
    return coaches.filter(coach => coach.gym_id === gymId && (
      coach.name.toLowerCase().includes(coachSearch.toLowerCase()) ||
      coach.phone.includes(coachSearch)
    )).sort((a, b) => {
      if (a.role === 'subcoach' && b.role !== 'subcoach') return 1;
      if (a.role !== 'subcoach' && b.role === 'subcoach') return -1;
      return 0;
    });
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, gymsRes, coachesRes, compsRes] = await Promise.all([
        getSuperAdminStats(),
        getAllGyms(),
        getAllCoaches(),
        api.get('/api/competitions') // ✅ [신규] 대회 목록 로드
      ]);
      const announcementsRes = await getSystemAnnouncements();
      setStats(statsRes.data);
      setGyms(gymsRes.data);
      setCoaches(coachesRes.data);
      setAnnouncements(announcementsRes.data);

      // 대회 목록 초기 정렬: sort_order 기준 (없으면 시작일 기준 내림차순 후순위)
      const sortedComps = compsRes.data.sort((a: any, b: any) => {
        if (a.sort_order !== undefined && b.sort_order !== undefined) {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        } else if (a.sort_order !== undefined) return -1;
        else if (b.sort_order !== undefined) return 1;

        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      });
      setCompetitions(sortedComps);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      toast.error('권한이 없거나 데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreateGym = async () => {
    if (!gymForm.name.trim()) {
      toast.error('체육관 이름을 입력하세요.');
      return;
    }
    try {
      await createGym(gymForm);
      toast.success('체육관이 추가되었습니다.');
      setShowGymModal(false);
      setGymForm({
        name: '',
        location: '',
        latitude: 0,
        longitude: 0,
        drop_in_price: 20000,
        description: '',
        drop_in_enabled: true
      });
      fetchAll();
    } catch (error) {
      toast.error('추가 실패');
    }
  };

  const handleDeleteGym = async (gymId: number, gymName: string) => {
    if (!window.confirm(`"${gymName}" 체육관을 삭제하시겠습니까 ?\n\n회원이 있는 체육관은 삭제할 수 없습니다.`)) return;
    try {
      await deleteGym(gymId);
      toast.success('삭제되었습니다.');
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '삭제 실패');
    }
  };

  const openEditGymModal = (gym: Gym) => {
    setSelectedGymForEdit(gym);
    setGymEditForm({
      name: gym.name,
      location: gym.location || '',
      latitude: gym.latitude || 0,
      longitude: gym.longitude || 0,
      drop_in_price: gym.drop_in_price || 20000,
      description: gym.description || '',
      drop_in_enabled: gym.drop_in_enabled ?? true,
      subscription_plan: gym.subscription_plan || 'Standard',
      subscription_start_date: gym.subscription_start_date || '',
      next_billing_date: gym.next_billing_date || '',
      monthly_fee: gym.monthly_fee || 199000,
      payment_status: gym.payment_status || 'paid'
    });
    setShowEditGymModal(true);
  };

  const handleUpdateGym = async () => {
    if (!selectedGymForEdit) return;
    try {
      await updateGym(selectedGymForEdit.id, {
        ...gymEditForm,
        subscription_start_date: gymEditForm.subscription_start_date || null,
        next_billing_date: gymEditForm.next_billing_date || null
      });
      toast.success('체육관 정보가 수정되었습니다.');
      setShowEditGymModal(false);
      setSelectedGymForEdit(null);
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '수정 실패');
    }
  };

  // ✅ Daum 주소 검색 완료 핸들러
  const handleCompleteAddress = async (data: any) => {
    let fullAddress = data.address;
    let extraAddress = '';

    if (data.addressType === 'R') {
      if (data.bname !== '') {
        extraAddress += data.bname;
      }
      if (data.buildingName !== '') {
        extraAddress += (extraAddress !== '' ? `, ${data.buildingName} ` : data.buildingName);
      }
      fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
    }

    // 1. 주소 폼 업데이트
    setGymForm(prev => ({ ...prev, location: fullAddress }));
    setIsAddressModalOpen(false);

    // 2. 자동으로 좌표 변환 요청 (Kakao Client Geocoder)
    try {
      // @ts-ignore
      const geocoder = new window.kakao.maps.services.Geocoder();

      geocoder.addressSearch(fullAddress, (result: any, status: any) => {
        // @ts-ignore
        if (status === window.kakao.maps.services.Status.OK) {
          const lat = parseFloat(result[0].y);
          const lon = parseFloat(result[0].x);

          setGymForm(prev => ({
            ...prev,
            location: fullAddress,
            latitude: lat,
            longitude: lon
          }));
          toast.success('주소 및 좌표 입력 완료!');
        } else {
          // 실패 시 기본 좌표
          console.error("Geocoding failed:", status);
          setGymForm(prev => ({
            ...prev,
            location: fullAddress,
            latitude: 37.5665,
            longitude: 126.9780
          }));
          toast('좌표를 찾을 수 없어 기본 위치(서울)로 설정했습니다.', { icon: '⚠️' });
        }
      });
    } catch (error) {
      console.error("Geocoding JS Error:", error);
      setGymForm(prev => ({
        ...prev,
        location: fullAddress,
        latitude: 37.5665,
        longitude: 126.9780
      }));
      toast('기본 위치(서울)로 설정했습니다.', { icon: '⚠️' });
    }
  };



  const handleViewGymStats = async (gymId: number) => {
    try {
      const res = await getGymStats(gymId);
      setSelectedGymStats(res.data);
      setShowGymStatsModal(true);
    } catch (error) {
      toast.error('통계를 불러올 수 없습니다.');
    }
  };

  const handleCreateCoach = async () => {
    if (!coachForm.name.trim() || coachForm.phone.replace(/[^0-9]/g, '').length < 10 || !coachForm.password.trim() || !coachForm.gym_id) {
      toast.error('모든 필드를 올바르게 입력하세요.');
      return;
    }
    try {
      await createCoach(coachForm);
      toast.success('계정이 생성되었습니다.');
      setShowCoachModal(false);
      setCoachForm({ gym_id: 0, name: '', phone: '010--', password: '', role: 'coach' });
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '생성 실패');
    }
  };

  const handleDeleteCoach = async (coachId: number, coachName: string) => {
    if (!window.confirm(`"${coachName}" 계정을 삭제하시겠습니까 ? `)) return;
    try {
      await deleteCoach(coachId);
      toast.success('삭제되었습니다.');
      fetchAll();
    } catch (error) {
      toast.error('삭제 실패');
    }
  };

  const handleUpdateCoach = async (coachId: number, payload: { role?: string; is_active?: boolean; password?: string }) => {
    try {
      await updateCoach(coachId, payload);
      toast.success('코치 계정이 수정되었습니다.');
      setCoachPasswordDrafts(prev => ({ ...prev, [coachId]: '' }));
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '수정 실패');
    }
  };

  const handleAddCoachToGym = async () => {
    if (!selectedCoachForGymAdd || !selectedTargetGym) {
      toast.error('코치와 지점을 선택해주세요.');
      return;
    }
    try {
      await addCoachToGym(selectedCoachForGymAdd.id, selectedTargetGym);
      toast.success(`${selectedCoachForGymAdd.name} 코치를 지점에 추가했습니다.`);
      setShowAddCoachToGymModal(false);
      setSelectedCoachForGymAdd(null);
      setSelectedTargetGym(null);
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '추가 실패');
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      toast.error('제목과 내용을 입력하세요.');
      return;
    }
    const targetText = announcementForm.target === 'all' ? '전체 사용자' :
      announcementForm.target === 'admins' ? '관리자/코치' : '일반 회원';
    if (!window.confirm(`${targetText}에게 공지를 발송하시겠습니까 ? `)) return;

    try {
      const res = await sendSystemAnnouncement({ ...announcementForm, file: announcementFile || undefined });
      toast.success(res.data.message);
      setShowAnnouncementModal(false);
      setAnnouncementForm({ title: '', message: '', target: 'all' });
      setAnnouncementFile(null);
      setAnnouncementPreview(null);
    } catch (error) {
      toast.error('발송 실패');
    }
  };

  const handleToggleAnnouncementVisibility = async (item: AnnouncementItem) => {
    try {
      await toggleSystemAnnouncementVisibility(item.id, !item.is_popup);
      toast.success(!item.is_popup ? '공지 팝업이 다시 노출됩니다.' : '공지 팝업이 종료되었습니다.');
      fetchAll();
    } catch (error) {
      toast.error('공지 상태 변경 실패');
    }
  };

  // ✅ [신규] 대회 순서 변경 (위/아래)
  const handleMoveCompetition = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === competitions.length - 1) return;

    const newComps = [...competitions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // 위치 스왑
    const temp = newComps[index];
    newComps[index] = newComps[targetIndex];
    newComps[targetIndex] = temp;

    setCompetitions(newComps);
  };

  // ✅ [신규] 대회 노출/숨김 토글
  const handleToggleHideCompetition = async (compId: number, currentHidden: boolean) => {
    try {
      await api.put(`/api/competitions/${compId}`, { is_hidden: !currentHidden });
      setCompetitions(competitions.map(comp =>
        comp.id === compId ? { ...comp, is_hidden: !currentHidden } : comp
      ));
      toast.success(!currentHidden ? '대회가 숨김 처리되었습니다.' : '대회가 다시 노출됩니다.');
    } catch (error) {
      console.error(error);
      toast.error('상태 변경 실패');
    }
  };

  // ✅ [신규] 변경된 대회 순서 일괄 저장
  const handleSaveCompetitionOrder = async () => {
    try {
      const updates = competitions.map((comp, idx) => ({
        id: comp.id,
        sort_order: idx + 1
      }));

      // 개별 업데이트 요청 병렬 실행
      await Promise.all(
        updates.map(update =>
          api.put(`/api/competitions/${update.id}`, { sort_order: update.sort_order })
        )
      );

      toast.success('대회 노출 순서가 저장되었습니다.');
      // 재정렬된 데이터로 로컬 상태 업데이트
      const updatedComps = competitions.map((comp, idx) => ({ ...comp, sort_order: idx + 1 }));
      setCompetitions(updatedComps);
    } catch (error) {
      console.error(error);
      toast.error('순서 저장 실패');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ fontSize: '1.2rem', color: '#6b7280' }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)', transition: 'background-color 0.3s ease' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              🔑 총관리자 대시보드
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>FitTrack 시스템 전체 관리</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleTheme}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: 'var(--bg-secondary)',
                color: isDarkMode ? '#FCD34D' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginRight: '8px'
              }}
              title={isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => navigate('/change-password')}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginRight: '8px'
              }}
              title="비밀번호 변경"
            >
              <KeyRound size={20} />
            </button>
            <button
              onClick={logout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.75rem 1.25rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}
            >
              <LogOut size={18} /> 로그아웃
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <StatCard icon={<Building2 />} label="총 체육관" value={stats?.total_gyms || 0} color="#3b82f6" />
          <StatCard icon={<Users />} label="총 회원 수" value={stats?.total_members || 0} color="#10b981" />
          <StatCard icon={<UserCog />} label="코치/관리자" value={stats?.total_coaches || 0} color="#8b5cf6" />
          <StatCard icon={<DollarSign />} label="💰 이번 달 플랫폼 수익 (예상)" value={formatCurrency(stats?.total_revenue || 0)} color="#f59e0b" isText />
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowGymModal(true)} style={actionButtonStyle('#3b82f6')}>
            <Plus size={18} /> 새 체육관 추가
          </button>
          <button onClick={() => setShowCoachModal(true)} style={actionButtonStyle('#8b5cf6')}>
            <UserCog size={18} /> 코치 계정 생성
          </button>
          <button onClick={() => setShowAnnouncementModal(true)} style={actionButtonStyle('#ef4444')}>
            <Send size={18} /> 시스템 공지 발송
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={gymCardStyle}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>계약 상태</div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={miniStatStyle}><strong>{gyms.filter(g => g.payment_status === 'paid').length}</strong><span>정상 납부</span></div>
              <div style={miniStatStyle}><strong>{gyms.filter(g => g.payment_status === 'pending').length}</strong><span>대기</span></div>
              <div style={miniStatStyle}><strong>{gyms.filter(g => g.payment_status === 'overdue').length}</strong><span>연체</span></div>
            </div>
          </div>
          <div style={gymCardStyle}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>글로벌 팝업 공지</div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={miniStatStyle}><strong>{announcements.filter(item => item.is_popup).length}</strong><span>현재 노출</span></div>
              <div style={miniStatStyle}><strong>{announcements.length}</strong><span>최근 공지</span></div>
            </div>
          </div>
        </div>

        {/* ✅ [신규] 탭 메뉴 */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('gyms')}
            style={{
              padding: '1rem 2rem', border: 'none', background: 'transparent',
              fontSize: '1.05rem', fontWeight: activeTab === 'gyms' ? 'bold' : 'normal',
              color: activeTab === 'gyms' ? '#3b82f6' : 'var(--text-secondary)',
              borderBottom: activeTab === 'gyms' ? '3px solid #3b82f6' : '3px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Building2 size={20} /> 체육관 관리
          </button>
          <button
            onClick={() => setActiveTab('competitions')}
            style={{
              padding: '1rem 2rem', border: 'none', background: 'transparent',
              fontSize: '1.05rem', fontWeight: activeTab === 'competitions' ? 'bold' : 'normal',
              color: activeTab === 'competitions' ? '#8b5cf6' : 'var(--text-secondary)',
              borderBottom: activeTab === 'competitions' ? '3px solid #8b5cf6' : '3px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Trophy size={20} /> 대회 관리 <span style={{ fontSize: '0.8rem', backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '12px' }}>{competitions.length}</span>
          </button>
        </div>

        {/* ✅ 대회 관리 탭 내용 */}
        {activeTab === 'competitions' && (
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={22} color="#8b5cf6" /> 대회 노출 순서 관리
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  대회의 노출 순서를 변경하거나 숨길 수 있습니다. (위쪽일수록 상단 노출)
                </p>
                <button
                  onClick={handleSaveCompetitionOrder}
                  style={{ ...actionButtonStyle('#3182F6'), padding: '0.5rem 1rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
                >
                  순서 정보 변경 저장
                </button>
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={thStyle}>순서 변경</th>
                    <th style={thStyle}>상태(노출여부)</th>
                    <th style={thStyle}>대회명</th>
                    <th style={thStyle}>기간</th>
                    <th style={thStyle}>순위</th>
                  </tr>
                </thead>
                <tbody>
                  {competitions.length > 0 ? competitions.map((comp, index) => (
                    <tr key={comp.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: comp.is_hidden ? 'var(--bg-secondary)' : 'transparent' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleMoveCompetition(index, 'up')}
                            disabled={index === 0}
                            style={{ ...iconButtonStyle(index === 0 ? '#aaa' : '#374151'), padding: '4px' }}
                          >
                            <ChevronUp size={20} />
                          </button>
                          <button
                            onClick={() => handleMoveCompetition(index, 'down')}
                            disabled={index === competitions.length - 1}
                            style={{ ...iconButtonStyle(index === competitions.length - 1 ? '#aaa' : '#374151'), padding: '4px' }}
                          >
                            <ChevronDown size={20} />
                          </button>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleHideCompetition(comp.id, comp.is_hidden)}
                          style={{ ...iconButtonStyle(comp.is_hidden ? '#ef4444' : '#10b981'), margin: '0 auto' }}
                          title={comp.is_hidden ? '현재 숨김 상태 (클릭 시 노출)' : '현재 노출 상태 (클릭 시 숨김)'}
                        >
                          {comp.is_hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <span
                          onClick={() => navigate(`/competition?comp_id=${comp.id}`)}
                          style={{
                            fontWeight: 'bold',
                            color: comp.is_hidden ? 'var(--text-tertiary)' : 'var(--primary)',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                          title="클릭하여 대회 상세 설정(종목 추가 등)으로 이동"
                        >
                          {comp.title}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {comp.start_date.split('T')[0]} ~ {comp.end_date.split('T')[0]}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {comp.sort_order || index + 1}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>대회가 존재하지 않습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ✅ 체육관 관리 탭 내용 */}
        {activeTab === 'gyms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* 🔍 체육관 및 코치 검색 필터 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="체육관 이름 또는 주소 검색..."
                value={gymSearch}
                onChange={(e) => setGymSearch(e.target.value)}
                style={{ ...inputStyle, width: '300px' }}
              />
              <select
                value={gymPaymentFilter}
                onChange={(e) => setGymPaymentFilter(e.target.value)}
                style={{ ...inputStyle, width: '150px' }}
              >
                <option value="all">납부 상태 (전체)</option>
                <option value="paid">정상 납부</option>
                <option value="overdue">연체 중</option>
                <option value="pending">대기 중</option>
              </select>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={thStyle}>체육관명</th>
                    <th style={thStyle}>위치</th>
                    <th style={thStyle}>구독 정보</th>
                    <th style={thStyle}>납부 상태</th>
                    <th style={thStyle}>회원/코치</th>
                    <th style={thStyle}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGyms.length > 0 ? filteredGyms.map(gym => (
                    <React.Fragment key={gym.id}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: expandedGymId === gym.id ? '#f3f4f6' : 'transparent', transition: 'background-color 0.2s' }}>
                        <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => setExpandedGymId(expandedGymId === gym.id ? null : gym.id)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {expandedGymId === gym.id ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
                            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)' }}>{gym.name}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {gym.location || '-'}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontSize: '0.9rem' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{gym.subscription_plan}</span>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatCurrency(gym.monthly_fee)}/월</div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            backgroundColor: gym.payment_status === 'paid' ? '#dcfce7' : (gym.payment_status === 'overdue' ? '#fee2e2' : '#fef3c7'),
                            color: gym.payment_status === 'paid' ? '#166534' : (gym.payment_status === 'overdue' ? '#991b1b' : '#92400e')
                          }}>
                            {gym.payment_status === 'paid' ? '정상 납부' : (gym.payment_status === 'overdue' ? '연체 중' : '미납/대기')}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <div>👥 회원 {gym.member_count}명</div>
                            <div>🏋️ 코치 {gym.coach_count}명</div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => openEditGymModal(gym)} style={iconButtonStyle('#8b5cf6')} title="구독/결제 수정">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleViewGymStats(gym.id)} style={iconButtonStyle('#3b82f6')} title="상세 통계">
                              <Eye size={16} />
                            </button>
                            <button onClick={() => handleDeleteGym(gym.id, gym.name)} style={iconButtonStyle('#ef4444')} title="삭제">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* ✅ 체육관 상세: 코치 목록 (아코디언 형태) */}
                      {expandedGymId === gym.id && (
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <td colSpan={6} style={{ padding: '0' }}>
                            <div style={{ padding: '1rem', borderTop: '1px dashed #e5e7eb', borderBottom: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Users size={16} color="#4b5563" /> 소속 코치 / 서브코치 관리
                                </h4>
                                <button onClick={() => { setCoachForm({ ...coachForm, gym_id: gym.id }); setShowCoachModal(true); }} style={{ ...actionButtonStyle('#8b5cf6'), padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                                  <Plus size={14} /> 코치 추가
                                </button>
                              </div>
                              {getCoachesForGym(gym.id).length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.85rem', color: '#4b5563' }}>이름</th>
                                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.85rem', color: '#4b5563' }}>전화번호</th>
                                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.85rem', color: '#4b5563' }}>역할</th>
                                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.85rem', color: '#4b5563' }}>상태/권한</th>
                                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.85rem', color: '#4b5563' }}>관리</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {getCoachesForGym(gym.id).map(coach => (
                                      <tr key={coach.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '10px 12px', fontSize: '0.9rem', color: '#111827' }}>{coach.name}</td>
                                        <td style={{ padding: '10px 12px', fontSize: '0.9rem', color: '#4b5563' }}>{coach.phone}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
                                            <select
                                              value={coach.role}
                                              onChange={(e) => handleUpdateCoach(coach.id, { role: e.target.value })}
                                              style={{ ...inputStyle, padding: '0.45rem', fontSize: '0.85rem' }}
                                            >
                                              <option value="admin">관리자</option>
                                              <option value="coach">마스터 코치</option>
                                              <option value="subcoach">서브코치</option>
                                            </select>
                                            <button
                                              onClick={() => handleUpdateCoach(coach.id, { is_active: !coach.is_active })}
                                              style={{ ...actionButtonStyle(coach.is_active ? '#10b981' : '#6b7280'), padding: '0.45rem 0.7rem', fontSize: '0.8rem', justifyContent: 'center' }}
                                            >
                                              {coach.is_active ? '활성' : '비활성'}
                                            </button>
                                          </div>
                                        </td>
                                        <td style={{ padding: '10px 12px', display: 'flex', gap: '6px' }}>
                                          <input
                                            type="password"
                                            placeholder="새 비밀번호"
                                            value={coachPasswordDrafts[coach.id] || ''}
                                            onChange={(e) => setCoachPasswordDrafts(prev => ({ ...prev, [coach.id]: e.target.value }))}
                                            style={{ ...inputStyle, width: '120px', padding: '0.45rem', fontSize: '0.8rem' }}
                                          />
                                          <button
                                            onClick={() => handleUpdateCoach(coach.id, { password: coachPasswordDrafts[coach.id] })}
                                            disabled={!coachPasswordDrafts[coach.id]}
                                            style={{ ...iconButtonStyle('#f59e0b'), padding: '4px', opacity: coachPasswordDrafts[coach.id] ? 1 : 0.5 }}
                                            title="비밀번호 초기화"
                                          >
                                            <KeyRound size={16} />
                                          </button>
                                          <button onClick={() => { setSelectedCoachForGymAdd(coach); setShowAddCoachToGymModal(true); }} style={{ ...iconButtonStyle('#3b82f6'), padding: '4px' }} title="지점 추가">
                                            <Plus size={16} />
                                          </button>
                                          <button onClick={() => handleDeleteCoach(coach.id, coach.name)} style={{ ...iconButtonStyle('#ef4444'), padding: '4px' }} title="코치 삭제">
                                            <Trash2 size={16} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'white', borderRadius: '8px', color: '#6b7280', fontSize: '0.9rem' }}>
                                  소속된 코치가 없습니다.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>검색 결과가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>최근 글로벌 공지</h3>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{announcements.filter(item => item.is_popup).length}개 노출 중</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {announcements.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>등록된 글로벌 공지가 없습니다.</div>
            ) : announcements.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', padding: '1rem', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{item.title}</strong>
                    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: item.is_popup ? '#dcfce7' : '#e5e7eb', color: item.is_popup ? '#166534' : '#4b5563' }}>
                      {item.is_popup ? '노출 중' : '비노출'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '680px' }}>
                    {item.content}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                    {new Date(item.created_at).toLocaleString()} · 작성자 {item.author_name}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleAnnouncementVisibility(item)}
                  style={{ ...actionButtonStyle(item.is_popup ? '#ef4444' : '#10b981'), whiteSpace: 'nowrap', padding: '0.6rem 0.9rem' }}
                >
                  {item.is_popup ? '팝업 종료' : '팝업 재노출'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 체육관 추가 모달 */}
        {showGymModal && (
          <Modal title="새 체육관 추가" onClose={() => setShowGymModal(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="text"
                placeholder="체육관 이름 *"
                value={gymForm.name}
                onChange={e => setGymForm({ ...gymForm, name: e.target.value })}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="주소 (예: 서울특별시 강남구 ...)"
                  value={gymForm.location}
                  onChange={e => setGymForm({ ...gymForm, location: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                  readOnly // ✅ 직접 수정 방지 (선택 사항)
                  onClick={() => setIsAddressModalOpen(true)}
                />
                <button
                  onClick={() => setIsAddressModalOpen(true)}
                  style={{
                    ...actionButtonStyle('#10b981'),
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  주소 검색
                </button>
              </div>

              {/* ✅ 모달 안에 또 모달을 띄우는 건 복잡할 수 있으니, 조건부 렌더링으로 처리 */}
              {isAddressModalOpen && (
                <div style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px' }}>
                  <DaumPostcode onComplete={handleCompleteAddress} />
                  <button
                    onClick={() => setIsAddressModalOpen(false)}
                    style={{ marginTop: '5px', padding: '5px 10px', background: '#ccc', border: 'none', cursor: 'pointer' }}
                  >
                    닫기
                  </button>
                </div>
              )}



              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>위도 (Latitude)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="위도 (예: 37.5665)"
                    value={gymForm.latitude}
                    onChange={e => setGymForm({ ...gymForm, latitude: parseFloat(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>경도 (Longitude)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="경도 (예: 126.9780)"
                    value={gymForm.longitude}
                    onChange={e => setGymForm({ ...gymForm, longitude: parseFloat(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <input
                type="number"
                placeholder="드랍인 가격 (원)"
                value={gymForm.drop_in_price}
                onChange={e => setGymForm({ ...gymForm, drop_in_price: parseInt(e.target.value) })}
                style={inputStyle}
              />
              <textarea
                placeholder="체육관 설명 (시설, 장비 등)"
                value={gymForm.description}
                onChange={e => setGymForm({ ...gymForm, description: e.target.value })}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={gymForm.drop_in_enabled}
                  onChange={e => setGymForm({ ...gymForm, drop_in_enabled: e.target.checked })}
                />
                <span style={{ fontSize: '0.95rem', color: '#374151' }}>드랍인 예약 활성화</span>
              </label>
              <button onClick={handleCreateGym} style={submitButtonStyle}>추가하기</button>
            </div>
          </Modal>
        )}

        {showEditGymModal && selectedGymForEdit && (
          <Modal title="체육관 구독/결제 정보 수정" onClose={() => { setShowEditGymModal(false); setSelectedGymForEdit(null); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" value={gymEditForm.name} onChange={e => setGymEditForm({ ...gymEditForm, name: e.target.value })} style={inputStyle} placeholder="체육관 이름" />
              <input type="text" value={gymEditForm.location} onChange={e => setGymEditForm({ ...gymEditForm, location: e.target.value })} style={inputStyle} placeholder="주소" />
              <select value={gymEditForm.subscription_plan} onChange={e => setGymEditForm({ ...gymEditForm, subscription_plan: e.target.value })} style={inputStyle}>
                <option value="Basic">Basic</option>
                <option value="Standard">Standard</option>
                <option value="Premium">Premium</option>
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="date" value={gymEditForm.subscription_start_date} onChange={e => setGymEditForm({ ...gymEditForm, subscription_start_date: e.target.value })} style={inputStyle} />
                <input type="date" value={gymEditForm.next_billing_date} onChange={e => setGymEditForm({ ...gymEditForm, next_billing_date: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" value={gymEditForm.monthly_fee} onChange={e => setGymEditForm({ ...gymEditForm, monthly_fee: parseInt(e.target.value || '0') })} style={inputStyle} placeholder="월 구독료" />
                <select value={gymEditForm.payment_status} onChange={e => setGymEditForm({ ...gymEditForm, payment_status: e.target.value })} style={inputStyle}>
                  <option value="paid">정상 납부</option>
                  <option value="pending">대기</option>
                  <option value="overdue">연체</option>
                </select>
              </div>
              <button onClick={handleUpdateGym} style={submitButtonStyle}>수정 저장</button>
            </div>
          </Modal>
        )}

        {/* 코치 계정 생성 모달 */}
        {showCoachModal && (
          <Modal title="코치/관리자 계정 생성" onClose={() => setShowCoachModal(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <select
                value={coachForm.gym_id}
                onChange={e => setCoachForm({ ...coachForm, gym_id: parseInt(e.target.value) })}
                style={inputStyle}
              >
                <option value={0}>체육관 선택 *</option>
                {gyms.map(gym => (
                  <option key={gym.id} value={gym.id}>{gym.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="이름 *"
                value={coachForm.name}
                onChange={e => setCoachForm({ ...coachForm, name: e.target.value })}
                style={inputStyle}
              />
              {/* ✅ 전화번호 3단 분리 입력 */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={coachForm.phone.split('-')[0]?.trim() || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                    const parts = coachForm.phone.split('-').map(p => p.trim());
                    const newPhone = `${val}-${parts[1] || ''}-${parts[2] || ''}`;
                    setCoachForm({ ...coachForm, phone: newPhone });
                    if (val.length === 3) document.getElementById('phone2')?.focus();
                  }}
                  style={{ ...inputStyle, textAlign: 'center' }}
                  placeholder="010"
                />
                <span>-</span>
                <input
                  id="phone2"
                  type="text"
                  value={coachForm.phone.split('-')[1]?.trim() || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                    const parts = coachForm.phone.split('-').map(p => p.trim());
                    const newPhone = `${parts[0] || ''}-${val}-${parts[2] || ''}`;
                    setCoachForm({ ...coachForm, phone: newPhone });
                    if (val.length === 4) document.getElementById('phone3')?.focus();
                  }}
                  style={{ ...inputStyle, textAlign: 'center' }}
                  placeholder="1234"
                />
                <span>-</span>
                <input
                  id="phone3"
                  type="text"
                  value={coachForm.phone.split('-')[2]?.trim() || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                    const parts = coachForm.phone.split('-').map(p => p.trim());
                    const newPhone = `${parts[0] || ''}-${parts[1] || ''}-${val}`;
                    setCoachForm({ ...coachForm, phone: newPhone });
                  }}
                  style={{ ...inputStyle, textAlign: 'center' }}
                  placeholder="5678"
                />
              </div>
              <input
                type="password"
                placeholder="초기 비밀번호 *"
                value={coachForm.password}
                onChange={e => setCoachForm({ ...coachForm, password: e.target.value })}
                style={inputStyle}
              />
              {/* <select
              value={coachForm.role}
              onChange={e => setCoachForm({ ...coachForm, role: e.target.value })}
              style={inputStyle}
              <option value="coach">체육관 마스터 코치 (전체 메뉴 접근 가능)</option>
            </select> */}
              <div style={{ padding: '0.8rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔒 생성되는 계정 권한: <strong style={{ color: 'var(--text-primary)' }}>체육관 마스터 코치 (전체 메뉴 접근 가능)</strong>
              </div>
              <button onClick={handleCreateCoach} style={submitButtonStyle}>계정 생성</button>
            </div>
          </Modal>
        )}

        {/* 코치 지점 추가 모달 */}
        {showAddCoachToGymModal && (
          <Modal title="코치를 지점에 추가" onClose={() => { setShowAddCoachToGymModal(false); setSelectedCoachForGymAdd(null); setSelectedTargetGym(null); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '4px' }}>코치:</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>
                  {selectedCoachForGymAdd?.name} ({selectedCoachForGymAdd?.phone})
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#374151', fontWeight: '500' }}>추가할 지점 선택 *</label>
                <select
                  value={selectedTargetGym || ''}
                  onChange={e => setSelectedTargetGym(e.target.value ? parseInt(e.target.value) : null)}
                  style={inputStyle}
                >
                  <option value="">지점을 선택해주세요</option>
                  {gyms.map(gym => {
                    const alreadyExists = coaches.some(c => c.phone === selectedCoachForGymAdd?.phone && c.gym_id === gym.id);
                    return (
                      <option key={gym.id} value={gym.id} disabled={alreadyExists}>
                        {gym.name} {alreadyExists ? '(이미 등록됨)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowAddCoachToGymModal(false); setSelectedCoachForGymAdd(null); setSelectedTargetGym(null); }} style={{ ...submitButtonStyle, backgroundColor: '#6b7280' }}>취소</button>
                <button onClick={handleAddCoachToGym} style={submitButtonStyle}>추가</button>
              </div>
            </div>
          </Modal>
        )}

        {/* 시스템 공지 모달 */}
        {showAnnouncementModal && (
          <Modal title="시스템 공지 발송" onClose={() => setShowAnnouncementModal(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <select
                value={announcementForm.target}
                onChange={e => setAnnouncementForm({ ...announcementForm, target: e.target.value })}
                style={inputStyle}
              >
                <option value="all">전체 사용자</option>
                <option value="admins">관리자/코치만</option>
                <option value="users">일반 회원만</option>
              </select>
              <input
                type="text"
                placeholder="공지 제목 *"
                value={announcementForm.title}
                onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                style={inputStyle}
              />
              <textarea
                placeholder="공지 내용 *"
                value={announcementForm.message}
                onChange={e => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
              />

              {/* ✅ 이미지 업로드 (썸네일 미리보기) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                  borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer',
                  backgroundColor: '#f9fafb', color: '#374151', fontSize: '0.9rem'
                }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAnnouncementFile(file);
                        setAnnouncementPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  <ImageIcon size={18} />
                  이미지 첨부 {announcementPreview ? '(변경)' : ''}
                </label>

                {announcementPreview && (
                  <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <img src={announcementPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => { setAnnouncementFile(null); setAnnouncementPreview(null); }}
                      style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                    >
                      <X size={16} color="white" />
                    </button>
                  </div>
                )}
              </div>

              <button onClick={handleSendAnnouncement} style={{ ...submitButtonStyle, backgroundColor: '#ef4444' }}>
                공지 발송
              </button>
            </div>
          </Modal>
        )}

        {/* 체육관 상세 통계 모달 */}
        {showGymStatsModal && selectedGymStats && (
          <Modal title={`📊 ${selectedGymStats.gym_name} 상세 통계`} onClose={() => setShowGymStatsModal(false)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={statsBoxStyle}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>총 회원</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{selectedGymStats.total_members}명</div>
              </div>
              <div style={statsBoxStyle}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>활성 회원</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{selectedGymStats.active_members}명</div>
              </div>
              <div style={statsBoxStyle}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>이번 달 매출</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{formatCurrency(selectedGymStats.monthly_revenue)}</div>
              </div>
              <div style={statsBoxStyle}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>오늘 출석</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>{selectedGymStats.today_attendance}명</div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div >
  );
};

// 통계 카드 컴포넌트
const StatCard = ({ icon, label, value, color, isText = false }: { icon: React.ReactNode, label: string, value: number | string, color: string, isText?: boolean }) => (
  <div style={{
    backgroundColor: 'var(--bg-card)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border-color)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ backgroundColor: `${color}15`, color: color, padding: '10px', borderRadius: '10px' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: isText ? '1.2rem' : '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  </div>
);

// 접이식 섹션 컴포넌트
const CollapsibleSection = ({ title, isExpanded, onToggle, children }: { title: string, isExpanded: boolean, onToggle: () => void, children: React.ReactNode }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <button onClick={onToggle} style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 1.5rem',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: 'bold',
      color: 'var(--text-primary)'
    }}>
      {title}
      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
    </button>
    {isExpanded && (
      <div style={{
        padding: '1.5rem',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderTop: 'none',
        borderRadius: '0 0 12px 12px'
      }}>
        {children}
      </div>
    )}
  </div>
);

// 모달 컴포넌트
const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 1000
  }}>
    <div style={{
      backgroundColor: 'var(--bg-card)',
      borderRadius: '16px',
      padding: '2rem',
      width: '90%',
      maxWidth: '450px',
      boxShadow: 'var(--shadow)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
          <X size={24} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// 스타일
const actionButtonStyle = (color: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '0.75rem 1.25rem',
  backgroundColor: color,
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.9rem'
});

const gymCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: '12px',
  padding: '1.25rem',
  border: '1px solid var(--border-color)',
  boxShadow: 'var(--shadow)'
};

const iconButtonStyle = (color: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  backgroundColor: `${color}15`,
  color: color,
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer'
});

const miniStatStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '0.5rem 1rem',
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: '8px'
};

const thStyle: React.CSSProperties = {
  padding: '1rem',
  textAlign: 'left',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-color)'
};

const tdStyle: React.CSSProperties = {
  padding: '1rem',
  fontSize: '0.9rem',
  color: 'var(--text-primary)'
};

const inputStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  fontSize: '1rem',
  width: '100%',
  backgroundColor: 'var(--bg-input)',
  color: 'var(--text-primary)',
  outline: 'none'
};

const submitButtonStyle: React.CSSProperties = {
  padding: '1rem',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '1rem',
  marginTop: '1rem'
};

const statsBoxStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  padding: '1.5rem',
  borderRadius: '12px',
  textAlign: 'center'
};

export default SuperAdminDashboard;
