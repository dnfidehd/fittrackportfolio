import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AddMemberModal from '../../components/modals/AddMemberModal';
import EditMemberModal from '../../components/modals/EditMemberModal';
import AddSaleModal from '../../components/modals/AddSaleModal';
import { getMembers, deleteMember, batchExtendMembership, extendAllActiveMembers } from '../../services/api';
import { Member } from '../../types';
import toast from 'react-hot-toast';
import { Plus, Search, ChevronLeft, ChevronRight, Edit, Trash2, CreditCard, User, Phone } from 'lucide-react';

const Members: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [attentionFilter, setAttentionFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [payingMember, setPayingMember] = useState<Member | null>(null);

  // ✅ [복구] 일괄 연장 관련 상태
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [extendDays, setExtendDays] = useState<string>('');
  const [allExtendDays, setAllExtendDays] = useState<string>('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchMembers = async () => {
    try {
      setLoading(true);
      // 🔥 페이지네이션 문제 해결: 전체 멤버를 가져와서 클라이언트 사이드에서 처리 (limit: 1000)
      const response = await getMembers({ limit: 1000 });
      // Handle array or object response
      if (Array.isArray(response.data)) {
        setMembers(response.data);
        setFilteredMembers(response.data);
      } else if (response.data && Array.isArray((response.data as any).members)) {
        setMembers((response.data as any).members);
        setFilteredMembers((response.data as any).members);
      } else if (response.data && Array.isArray((response.data as any).data)) {
        setMembers((response.data as any).data);
        setFilteredMembers((response.data as any).data);
      } else {
        console.error("Invalid members response format:", response.data);
        setMembers([]);
        setFilteredMembers([]);
      }
    } catch (error) {
      console.error("회원 목록 로딩 실패:", error);
      toast.error("회원 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  useEffect(() => {
    let result = members;
    if (searchTerm) {
      result = result.filter(m => m.name.includes(searchTerm) || m.phone.includes(searchTerm));
    }
    if (statusFilter !== "all") {
      const now = new Date();
      result = result.filter(m => {
        const endDate = m.end_date ? new Date(m.end_date) : new Date(0);
        if (statusFilter === "active") return endDate >= now;
        if (statusFilter === "expired") return endDate < now;
        return true;
      });
    }
    if (attentionFilter !== "all") {
      result = result.filter((m) => {
        if (attentionFilter === "unpaid") return (m.unpaid_amount || 0) > 0;
        if (attentionFilter === "expiring") return Boolean(m.expiring_soon);
        if (attentionFilter === "inactive30") return (m.days_since_last_attendance ?? -1) >= 30;
        return true;
      });
    }
    setFilteredMembers(result);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, attentionFilter, members]);

  const handlePhoneCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleSms = (phone: string) => {
    window.location.href = `sms:${phone}`;
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredMembers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const handleDelete = async (id: number) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteMember(id);
      toast.success("회원이 삭제되었습니다.");
      fetchMembers();
    } catch (error) {
      toast.error("삭제 실패");
    }
  };

  // ✅ [복구] 선택 처리 로직
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedMemberIds(currentItems.map(m => m.id));
    } else {
      setSelectedMemberIds([]);
    }
  };

  const handleSelectMember = (id: number) => {
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectedList = members.filter(m => selectedMemberIds.includes(m.id));

  // ✅ [복구] 선택 연장 동작
  const handleBatchExtend = async () => {
    if (selectedList.length === 0) {
      toast.error("연장할 회원을 선택해주세요.");
      return;
    }
    const days = parseInt(extendDays, 10);
    if (isNaN(days) || days <= 0) {
      toast.error("올바른 숫자를 입력해주세요.");
      return;
    }
    if (!window.confirm(`선택한 ${selectedList.length}명의 회원을 ${days}일 연장하시겠습니까?`)) return;

    try {
      await batchExtendMembership(selectedList.map(m => m.id), days);
      toast.success("선택한 회원이 연장되었습니다.");
      setSelectedMemberIds([]);
      setExtendDays('');
      fetchMembers();
    } catch (error) {
      toast.error("처리 실패");
    }
  };

  // ✅ [복구] 전체 활성 회원 연장
  const handleExtendAllActive = async () => {
    const days = parseInt(allExtendDays, 10);
    if (isNaN(days) || days <= 0) {
      toast.error("올바른 숫자를 입력해주세요.");
      return;
    }
    if (!window.confirm(`정말로 모든 활성 회원의 기간을 ${days}일 연장하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      const res = await extendAllActiveMembers(days);
      toast.success(res.data.message);
      setAllExtendDays('');
      fetchMembers();
    } catch (error) {
      toast.error("처리 실패");
    }
  };

  // 화면 너비 감지
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ ...styles.container, padding: isMobile ? '16px 0' : '32px 40px' }}>
      <div style={{ ...styles.header, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '16px' : '0' }}>
        <div>
          <h1 style={{ ...styles.pageTitle, fontSize: isMobile ? '24px' : '32px' }}>회원 관리</h1>
          <p style={{ ...styles.subtitle, fontSize: isMobile ? '14px' : '16px' }}>총 {members.length}명의 회원이 있습니다.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ ...styles.addButton, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
          <Plus size={18} /> 회원 등록
        </button>
      </div>

      <div style={{ ...styles.toolbar, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={styles.searchWrapper}>
          <Search size={18} color="var(--text-tertiary)" />
          <input
            type="text"
            placeholder="이름 또는 전화번호 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={{ ...styles.filterWrapper, width: isMobile ? '100%' : 'auto' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ ...styles.filterSelect, width: isMobile ? '100%' : 'auto' }}
          >
            <option value="all">전체 상태</option>
            <option value="active">이용중</option>
            <option value="expired">만료됨</option>
          </select>
        </div>
        <div style={{ ...styles.filterWrapper, width: isMobile ? '100%' : 'auto' }}>
          <select
            value={attentionFilter}
            onChange={(e) => setAttentionFilter(e.target.value)}
            style={{ ...styles.filterSelect, width: isMobile ? '100%' : 'auto' }}
          >
            <option value="all">운영 필터</option>
            <option value="unpaid">미수 있음</option>
            <option value="expiring">만료 임박</option>
            <option value="inactive30">30일 이상 미출석</option>
          </select>
        </div>
      </div>

      {/* ✅ [복구] 일괄 연장 컨트롤 UI */}
      {!isMobile && (
        <div style={{
          display: 'flex', gap: '16px', marginBottom: '16px', padding: '16px',
          backgroundColor: 'var(--bg-card)', borderRadius: '14px',
          boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)',
          alignItems: 'center', flexWrap: 'wrap'
        }}>
          {/* 선택 연장 필드 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>선택 회원 연장:</span>
            <input
              type="number"
              placeholder="일수"
              value={extendDays}
              onChange={e => setExtendDays(e.target.value)}
              style={{ padding: '6px 12px', width: '80px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px' }}
            />
            <button
              onClick={handleBatchExtend}
              disabled={selectedList.length === 0 || !extendDays}
              style={{
                padding: '6px 12px', backgroundColor: (selectedList.length === 0 || !extendDays) ? 'var(--bg-secondary)' : 'var(--primary)',
                color: (selectedList.length === 0 || !extendDays) ? 'var(--text-tertiary)' : '#fff', borderRadius: '8px',
                border: 'none', fontWeight: 'bold', cursor: (selectedList.length === 0 || !extendDays) ? 'not-allowed' : 'pointer', fontSize: '13px'
              }}
            >
              {selectedList.length}명 연장
            </button>
          </div>

          {/* 활성 회원 전체 연장 필드 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>활성 회원 단체 연장:</span>
            <input
              type="number"
              placeholder="일수"
              value={allExtendDays}
              onChange={e => setAllExtendDays(e.target.value)}
              style={{ padding: '6px 12px', width: '80px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px' }}
            />
            <button
              onClick={handleExtendAllActive}
              disabled={!allExtendDays}
              style={{
                padding: '6px 12px', backgroundColor: !allExtendDays ? 'var(--bg-secondary)' : '#029E65',
                color: !allExtendDays ? 'var(--text-tertiary)' : '#fff', borderRadius: '8px',
                border: 'none', fontWeight: 'bold', cursor: !allExtendDays ? 'not-allowed' : 'pointer', fontSize: '13px'
              }}
            >
              전체 연장
            </button>
          </div>
        </div>
      )}

      <div style={{ ...styles.tableCard, overflowX: 'auto' }}>
        <table style={{ ...styles.table, minWidth: isMobile ? '600px' : 'auto' }}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={{ ...styles.th, width: '50px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={currentItems.length > 0 && selectedMemberIds.length === currentItems.length}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={styles.th}>이름</th>
              <th style={styles.th}>전화번호</th>
              <th style={styles.th}>등록일</th>
              <th style={styles.th}>만료일</th>
              <th style={styles.th}>운영 상태</th>
              <th style={styles.th}>상태</th>
              <th style={styles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={styles.loadingCell}>불러오는 중...</td></tr>
            ) : currentItems.length > 0 ? (
              currentItems.map((member) => {
                const isExpired = member.end_date ? new Date(member.end_date) < new Date() : false;
                const hasUnpaid = (member.unpaid_amount || 0) > 0;
                const inactive30 = (member.days_since_last_attendance ?? -1) >= 30;
                return (
                  <tr key={member.id} style={styles.tr}>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={() => handleSelectMember(member.id)}
                        onClick={e => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={styles.td}>
                      <div
                        style={styles.nameCell}
                        onClick={() => navigate(`/members/${member.id}`)}
                        title={`${member.name} 상세 정보 보기`}
                      >
                        <div style={styles.avatar}>{member.name[0]}</div>
                        <span style={styles.nameText}>{member.name}</span>
                      </div>
                    </td>
                    <td style={styles.td}>{member.phone}</td>
                    <td style={styles.td}>{member.start_date?.split('-').slice(1).join('.') || '-'}</td>
                    <td style={styles.td}>{member.end_date?.split('-').slice(1).join('.') || '-'}</td>
                    <td style={styles.td}>
                      <div style={styles.statusFlags}>
                        {hasUnpaid && <span style={styles.unpaidBadge}>미수 {member.unpaid_amount?.toLocaleString()}원</span>}
                        {member.expiring_soon && <span style={styles.expiringBadge}>만료 임박</span>}
                        {inactive30 && <span style={styles.inactiveBadge}>미출석 {member.days_since_last_attendance}일</span>}
                        {!hasUnpaid && !member.expiring_soon && !inactive30 && <span style={styles.normalBadge}>정상</span>}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={isExpired ? styles.expiredBadge : styles.activeBadge}>
                        {isExpired ? '만료' : '이용중'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionButtons}>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/members/${member.id}`); }} style={styles.iconBtn} title="상세">
                          <User size={16} color="#111827" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handlePhoneCall(member.phone); }} style={styles.iconBtn} title="전화">
                          <Phone size={16} color="#059669" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleSms(member.phone); }} style={styles.iconBtn} title="문자">
                          <Phone size={16} color="#7C3AED" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setPayingMember(member); }} style={styles.iconBtn} title="결제">
                          <CreditCard size={16} color="#3182F6" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingMember(member); }} style={styles.iconBtn} title="수정">
                          <Edit size={16} color="#6B7280" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(member.id); }} style={styles.iconBtn} title="삭제">
                          <Trash2 size={16} color="#EF4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={8} style={styles.emptyCell}>결과 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ ...styles.pagination, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '16px' }}>
        <div style={styles.pageInfo}>
          전체 {filteredMembers.length}명
        </div>
        <div style={styles.pageButtons}>
          <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} style={styles.pageBtn}>
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            i + 1 === currentPage || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1) ? (
              <button
                key={i + 1}
                onClick={() => paginate(i + 1)}
                style={currentPage === i + 1 ? styles.pageBtnActive : styles.pageBtn}
              >
                {i + 1}
              </button>
            ) : i + 1 === 1 || i + 1 === totalPages ? (
              <span key={i + 1} style={{ color: 'var(--text-tertiary)' }}>...</span>
            ) : null
          ))}
          <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} style={styles.pageBtn}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onMemberAdded={() => {
            setShowAddModal(false);
            fetchMembers();
          }}
        />
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onMemberUpdated={() => {
            setEditingMember(null);
            fetchMembers();
          }}
        />
      )}

      {payingMember && (
        <AddSaleModal
          member={payingMember}
          onClose={() => setPayingMember(null)}
          onSaleAdded={() => {
            setPayingMember(null);
            fetchMembers();
          }}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: '32px', minHeight: '100vh', backgroundColor: 'var(--bg-main)', fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif', transition: 'background-color 0.3s' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle: { fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, marginBottom: '6px' },
  subtitle: { fontSize: '16px', color: 'var(--text-secondary)', fontWeight: '500' },

  addButton: { display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 20px', backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s', boxShadow: '0 2px 8px rgba(49, 130, 246, 0.3)' },

  toolbar: { display: 'flex', gap: '12px', marginBottom: '16px' },
  searchWrapper: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'var(--bg-card)', borderRadius: '14px', flex: 1, boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' },
  searchInput: { border: 'none', outline: 'none', fontSize: '15px', width: '100%', color: 'var(--text-primary)', background: 'transparent' },
  filterWrapper: { backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '0 12px', display: 'flex', alignItems: 'center', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' },
  filterSelect: { padding: '12px 4px', border: 'none', outline: 'none', fontSize: '14px', color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer', fontWeight: '600' },

  tableCard: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' },
  table: { width: '100%', borderCollapse: 'separate' as const, borderSpacing: 0 },
  tableHeader: { backgroundColor: 'var(--bg-secondary)' },
  th: { padding: '16px 24px', textAlign: 'left' as const, fontSize: '14px', fontWeight: '600', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-color)' },
  tr: { transition: 'background-color 0.2s' },
  td: { padding: '18px 24px', fontSize: '15px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' },

  nameCell: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px', transition: 'background-color 0.2s' },
  avatar: { width: '36px', height: '36px', borderRadius: '14px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' },
  nameText: { fontWeight: '600', color: 'var(--text-primary)' },

  activeBadge: { display: 'inline-block', padding: '6px 10px', backgroundColor: 'rgba(2, 158, 101, 0.1)', color: '#029E65', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
  expiredBadge: { display: 'inline-block', padding: '6px 10px', backgroundColor: 'rgba(233, 0, 97, 0.1)', color: '#E90061', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
  normalBadge: { display: 'inline-block', padding: '6px 10px', backgroundColor: 'rgba(99, 102, 241, 0.08)', color: '#4F46E5', borderRadius: '999px', fontSize: '12px', fontWeight: '700' },
  unpaidBadge: { display: 'inline-block', padding: '6px 10px', backgroundColor: 'rgba(249, 115, 22, 0.12)', color: '#F97316', borderRadius: '999px', fontSize: '12px', fontWeight: '700' },
  expiringBadge: { display: 'inline-block', padding: '6px 10px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#DC2626', borderRadius: '999px', fontSize: '12px', fontWeight: '700' },
  inactiveBadge: { display: 'inline-block', padding: '6px 10px', backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#7C3AED', borderRadius: '999px', fontSize: '12px', fontWeight: '700' },
  statusFlags: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  detailBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },

  loadingCell: { padding: '80px', textAlign: 'center' as const, color: 'var(--text-tertiary)' },
  emptyCell: { padding: '80px', textAlign: 'center' as const, color: 'var(--text-tertiary)' },

  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px', padding: '0 8px' },
  pageInfo: { color: 'var(--text-tertiary)', fontSize: '14px' },
  pageButtons: { display: 'flex', gap: '6px' },
  pageBtn: { width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s' },
  pageBtnActive: { width: '32px', height: '32px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: '600' },

  actionButtons: { display: 'flex', gap: '8px' },
  iconBtn: { width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
};

export default Members;
