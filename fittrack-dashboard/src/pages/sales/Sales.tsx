import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { api, getExpenses, deleteExpense } from '../../services/api';
import AddSaleModal from '../../components/modals/AddSaleModal';
import AddExpenseModal from '../../components/modals/AddExpenseModal';
import { Member } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, TrendingUp, ArrowDownCircle, AlertCircle, Download, Plus, Trash2, CalendarClock, RefreshCw, UserPlus, Receipt, CreditCard } from 'lucide-react';
import { ListSkeleton } from '../../components/common/SkeletonLoader';

const TOSS_BLUE = '#3182F6';
const TOSS_RED = '#EF4444';
const TOSS_GREEN = '#10B981';
const COLORS = [TOSS_BLUE, TOSS_GREEN, '#F59E0B', TOSS_RED, '#8B5CF6'];

interface Sale { id: number; member_id: number; member_name: string; item_name: string; amount: number; payment_date: string; category: string; payment_method: string; status: string; }
interface Expense { id: number; item_name: string; amount: number; category: string; date: string; method: string; memo: string; }
interface SalesStats { byCategory: { name: string; value: number }[]; byMonth: { name: string; revenue: number }[]; totalRevenue: number; }
interface ExpiringMember {
  id: number;
  name: string;
  phone?: string;
  membership?: string;
  end_date: string;
  days_left: number;
  status: string;
}
interface SalesSummary {
  month_revenue: number;
  previous_month_revenue: number;
  month_over_month_change_pct: number;
  unpaid_amount: number;
  monthly_unpaid_amount: number;
  refund_amount: number;
  active_members: number;
  arpu: number;
  new_member_revenue: number;
  renewal_revenue: number;
  expiring_members: ExpiringMember[];
}

const Sales: React.FC = () => {
  const navigate = useNavigate();
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [summary, setSummary] = useState<SalesSummary>({
    month_revenue: 0,
    previous_month_revenue: 0,
    month_over_month_change_pct: 0,
    unpaid_amount: 0,
    monthly_unpaid_amount: 0,
    refund_amount: 0,
    active_members: 0,
    arpu: 0,
    new_member_revenue: 0,
    renewal_revenue: 0,
    expiring_members: [],
  });
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'expenses'>('sales');
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  useEffect(() => { fetchFinancialData(); }, []);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [listRes, statsRes, summaryRes] = await Promise.all([
        api.get('/api/sales'),
        api.get('/api/sales/stats/advanced'),
        api.get('/api/sales/stats/summary')
      ]);
      setSalesList(listRes.data);
      setStats(statsRes.data);
      setSummary(summaryRes.data);
    } catch (error) { console.error("매출 데이터 로딩 실패:", error); }

    try {
      const expenseRes = await getExpenses();
      const expenses: Expense[] = expenseRes.data;
      setExpenseList(expenses);
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyExpenseSum = expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).reduce((sum, e) => sum + e.amount, 0);
      setTotalExpense(monthlyExpenseSum);
    } catch (error) { console.error("지출 데이터 로딩 실패:", error); }

    setLoading(false);
  };

  const handleMarkAsPaid = async (saleId: number) => {
    if (!window.confirm("결제 완료 처리하시겠습니까?")) return;
    try { await api.put(`/api/sales/${saleId}/status`, { status: 'paid' }); toast.success("처리되었습니다!"); fetchFinancialData(); }
    catch (error) { toast.error("오류 발생"); }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm("이 지출 내역을 삭제하시겠습니까?")) return;
    try { await deleteExpense(id); toast.success("삭제되었습니다."); fetchFinancialData(); }
    catch (error) { toast.error("삭제 실패"); }
  };

  const handleDownloadExcel = async () => {
    try {
      const response = await api.get('/api/sales/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Financial_Report.xlsx`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { toast.error("다운로드 실패"); }
  };

  const openMemberDetail = (memberId?: number) => {
    if (!memberId) {
      toast.error('회원 정보가 없습니다.');
      return;
    }
    navigate(`/members/${memberId}`);
  };

  const callMember = (member?: { phone?: string; name?: string }) => {
    if (!member?.phone) {
      toast.error('전화번호가 없습니다.');
      return;
    }
    window.location.href = `tel:${member.phone}`;
  };

  // 화면 너비 감지
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const netProfit = summary.month_revenue - totalExpense;
  const monthChangePositive = summary.month_over_month_change_pct >= 0;
  const revenueMix = [
    { label: '신규 등록', value: summary.new_member_revenue, color: TOSS_BLUE, icon: <UserPlus size={16} color={TOSS_BLUE} /> },
    { label: '재등록', value: summary.renewal_revenue, color: TOSS_GREEN, icon: <RefreshCw size={16} color={TOSS_GREEN} /> },
  ];

  return (
    <div style={{ ...styles.container, padding: isMobile ? '16px 0' : '32px 40px' }}>
      {/* Header */}
      <div style={{ ...styles.header, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '16px' : '0' }}>
        <div>
          <h1 style={{ ...styles.pageTitle, fontSize: isMobile ? '24px' : '32px' }}>매출 관리</h1>
          <p style={{ ...styles.subtitle, fontSize: isMobile ? '14px' : '16px' }}>센터 운영 현황</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={() => setIsExpenseModalOpen(true)} style={{ ...styles.dangerBtn, flex: 1, justifyContent: 'center' }}><Plus size={16} /> 지출</button>
          <button onClick={handleDownloadExcel} style={{ ...styles.successBtn, flex: 1, justifyContent: 'center' }}><Download size={16} /> 엑셀</button>
        </div>
      </div>

      {loading ? <ListSkeleton count={3} /> : (
        <>
          {/* Summary Cards */}
          <div style={{
            ...styles.summaryGrid,
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '12px' : '24px'
          }}>
            <div style={{ ...styles.summaryCard, padding: isMobile ? '16px' : '24px' }}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.iconBox, width: isMobile ? '32px' : '48px', height: isMobile ? '32px' : '48px', backgroundColor: '#E8F3FF' }}><DollarSign size={isMobile ? 18 : 24} color={TOSS_BLUE} /></div>
                <span style={{ ...styles.cardLabel, fontSize: isMobile ? '12px' : '14px' }}>이번 달 매출</span>
              </div>
              <div style={{
                ...styles.cardValue,
                fontSize: isMobile ? '18px' : (summary.month_revenue.toString().length > 8 ? '20px' : summary.month_revenue.toString().length > 6 ? '24px' : '28px')
              }}>
                {summary.month_revenue.toLocaleString()}<span style={styles.unit}>원</span>
              </div>
              <div style={{ ...styles.subMetric, color: monthChangePositive ? TOSS_GREEN : TOSS_RED }}>
                {monthChangePositive ? '▲' : '▼'} 전월 대비 {Math.abs(summary.month_over_month_change_pct).toFixed(1)}%
              </div>
            </div>
            <div style={{ ...styles.summaryCard, padding: isMobile ? '16px' : '24px' }}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.iconBox, width: isMobile ? '32px' : '48px', height: isMobile ? '32px' : '48px', backgroundColor: '#ECFDF5' }}><UserPlus size={isMobile ? 18 : 24} color={TOSS_BLUE} /></div>
                <span style={{ ...styles.cardLabel, fontSize: isMobile ? '12px' : '14px' }}>신규 등록 매출</span>
              </div>
              <div style={{
                ...styles.cardValue,
                fontSize: isMobile ? '18px' : (summary.new_member_revenue.toString().length > 8 ? '20px' : summary.new_member_revenue.toString().length > 6 ? '24px' : '28px')
              }}>
                {summary.new_member_revenue.toLocaleString()}<span style={styles.unit}>원</span>
              </div>
              <div style={styles.subMetric}>이번 달 첫 결제 기준</div>
            </div>
            <div style={{ ...styles.summaryCard, padding: isMobile ? '16px' : '24px' }}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.iconBox, width: isMobile ? '32px' : '48px', height: isMobile ? '32px' : '48px', backgroundColor: '#ECFDF5' }}>
                  <RefreshCw size={isMobile ? 18 : 24} color={TOSS_GREEN} />
                </div>
                <span style={{ ...styles.cardLabel, fontSize: isMobile ? '12px' : '14px' }}>재등록 매출</span>
              </div>
              <div style={{
                ...styles.cardValue,
                color: TOSS_GREEN,
                fontSize: isMobile ? '18px' : (summary.renewal_revenue.toString().length > 8 ? '20px' : summary.renewal_revenue.toString().length > 6 ? '24px' : '28px')
              }}>
                {summary.renewal_revenue.toLocaleString()}<span style={styles.unit}>원</span>
              </div>
              <div style={styles.subMetric}>기존 결제 이력 회원 기준</div>
            </div>
            <div style={{ ...styles.summaryCard, padding: isMobile ? '16px' : '24px' }}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.iconBox, width: isMobile ? '32px' : '48px', height: isMobile ? '32px' : '48px', backgroundColor: '#FFF7ED' }}><AlertCircle size={isMobile ? 18 : 24} color="#F97316" /></div>
                <span style={{ ...styles.cardLabel, fontSize: isMobile ? '12px' : '14px' }}>미수금 / 환불</span>
              </div>
              <div style={{
                ...styles.cardValue,
                color: '#F97316',
                fontSize: isMobile ? '18px' : (summary.unpaid_amount.toString().length > 8 ? '20px' : summary.unpaid_amount.toString().length > 6 ? '24px' : '28px')
              }}>
                {summary.unpaid_amount.toLocaleString()}<span style={styles.unit}>원</span>
              </div>
              <div style={styles.subMetric}>이번 달 환불 {summary.refund_amount.toLocaleString()}원</div>
            </div>
          </div>

          <div style={{ ...styles.summaryGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '12px' : '24px', marginBottom: '24px' }}>
            <div style={{ ...styles.summaryCard, padding: isMobile ? '16px' : '24px' }}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.iconBox, backgroundColor: '#FEE2E2' }}><ArrowDownCircle size={isMobile ? 18 : 24} color={TOSS_RED} /></div>
                <span style={styles.cardLabel}>이번 달 지출</span>
              </div>
              <div style={styles.cardValue}>{totalExpense.toLocaleString()}<span style={styles.unit}>원</span></div>
              <div style={styles.subMetric}>순수익 {netProfit.toLocaleString()}원</div>
            </div>
            <div style={{ ...styles.summaryCard, padding: isMobile ? '16px' : '24px' }}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.iconBox, backgroundColor: '#F4F4F5' }}><Receipt size={isMobile ? 18 : 24} color="#52525B" /></div>
                <span style={styles.cardLabel}>객단가</span>
              </div>
              <div style={styles.cardValue}>{summary.arpu.toLocaleString()}<span style={styles.unit}>원</span></div>
              <div style={styles.subMetric}>활성 회원 {summary.active_members}명</div>
            </div>
            <div style={{ ...styles.summaryCard, padding: isMobile ? '16px' : '24px' }}>
              <div style={styles.cardHeader}>
                <div style={{ ...styles.iconBox, backgroundColor: '#EEF2FF' }}><CreditCard size={isMobile ? 18 : 24} color="#4F46E5" /></div>
                <span style={styles.cardLabel}>이번 달 미수금</span>
              </div>
              <div style={styles.cardValue}>{summary.monthly_unpaid_amount.toLocaleString()}<span style={styles.unit}>원</span></div>
              <div style={styles.subMetric}>누적 미수금 {summary.unpaid_amount.toLocaleString()}원</div>
            </div>
          </div>

          {/* Charts (모바일 세로 1열) */}
          {stats && (
            <div style={{
              ...styles.chartRow,
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '16px' : '24px'
            }}>
              <div style={styles.chartCard}>
                <div style={styles.chartHeader}>
                  <h3 style={styles.chartTitle}>월별 매출 추이</h3>
                </div>
                <div style={{ width: '100%', height: isMobile ? 180 : 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.byMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'var(--bg-secondary)' }}
                        contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)', padding: '8px' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                        labelStyle={{ color: 'var(--text-secondary)' }}
                        formatter={(v: any) => `${v.toLocaleString()}원`}
                      />
                      <Bar dataKey="revenue" fill={TOSS_BLUE} radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={styles.chartCard}>
                <div style={styles.chartHeader}>
                  <h3 style={styles.chartTitle}>이번 달 상품별 매출 비중</h3>
                </div>
                <div style={{ width: '100%', height: isMobile ? 180 : 240 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={stats.byCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={isMobile ? 40 : 60}
                        outerRadius={isMobile ? 60 : 80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.byCategory.map((_, i) => (
                          <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)', padding: '8px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div style={{ ...styles.chartRow, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '24px', marginBottom: '32px' }}>
            <div style={styles.chartCard}>
              <div style={styles.chartHeader}>
                <h3 style={styles.chartTitle}>신규 / 재등록 매출 분리</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {revenueMix.map((item) => {
                  const ratio = summary.month_revenue > 0 ? (item.value / summary.month_revenue) * 100 : 0;
                  return (
                    <div key={item.label} style={styles.mixRow}>
                      <div style={styles.mixHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{item.icon}<span style={styles.mixLabel}>{item.label}</span></div>
                        <div style={styles.mixValue}>{item.value.toLocaleString()}원</div>
                      </div>
                      <div style={styles.mixTrack}>
                        <div style={{ ...styles.mixFill, width: `${ratio}%`, backgroundColor: item.color }} />
                      </div>
                      <div style={styles.mixPercent}>{ratio.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={styles.chartCard}>
              <div style={styles.chartHeader}>
                <h3 style={styles.chartTitle}>만료 예정 회원</h3>
              </div>
              <div style={styles.expiryList}>
                {summary.expiring_members.length === 0 ? (
                  <div style={styles.emptyExpiry}>30일 내 만료 예정 회원이 없습니다.</div>
                ) : (
                  summary.expiring_members.slice(0, 8).map((member) => (
                    <div key={member.id} style={styles.expiryItem}>
                      <div>
                        <div style={styles.expiryName}>{member.name}</div>
                        <div style={styles.expiryMeta}>{member.membership || '이용권 미지정'} · {member.end_date}</div>
                      </div>
                      <div style={styles.expiryActions}>
                        <div style={member.days_left <= 7 ? styles.expiryBadgeUrgent : styles.expiryBadge}>
                          D-{member.days_left}
                        </div>
                        <button onClick={() => callMember(member)} style={styles.inlineActionBtn}>전화</button>
                        <button onClick={() => openMemberDetail(member.id)} style={styles.inlineActionBtn}>상세</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div style={styles.listSection}>
            <div style={{ ...styles.tabs, overflowX: 'auto' }}>
              <button onClick={() => setActiveTab('sales')} style={activeTab === 'sales' ? styles.activeTab : styles.tab}>
                📥 매출
              </button>
              <button onClick={() => setActiveTab('expenses')} style={activeTab === 'expenses' ? styles.activeTab : styles.tab}>
                📤 지출
              </button>
            </div>

            <div style={{ ...styles.tableCard, overflowX: 'auto' }}>
              {activeTab === 'sales' ? (
                <table style={{ ...styles.table, minWidth: isMobile ? '500px' : 'auto' }}>
                  <thead><tr style={styles.trHead}><th style={styles.th}>날짜</th><th style={styles.th}>회원</th><th style={styles.th}>항목</th><th style={styles.thRight}>금액</th><th style={styles.thCenter}>상태</th><th style={styles.thCenter}>수납</th><th style={styles.thCenter}>액션</th></tr></thead>
                  <tbody>
                    {salesList.length === 0 ? <tr><td colSpan={7} style={styles.emptyCell}>내역 없음</td></tr> : salesList.map((sale) => (
                      <tr key={sale.id} style={styles.tr}>
                        <td style={styles.td}>{new Date(sale.payment_date).toLocaleDateString().split('.').slice(1, 3).join('.')}</td>
                        <td style={{ ...styles.td, fontWeight: '600' }}>{sale.member_name}</td>
                        <td style={styles.td}>{sale.item_name}</td>
                        <td style={styles.tdRight}>+{sale.amount.toLocaleString()}</td>
                        <td style={styles.tdCenter}>
                          {sale.status === 'pending' ? <span style={styles.badgePending}>미수</span> : <span style={styles.badgePaid}>완료</span>}
                        </td>
                        <td style={styles.tdCenter}>
                          {sale.status === 'pending' && <button onClick={() => handleMarkAsPaid(sale.id)} style={styles.miniBtn}>OK</button>}
                        </td>
                        <td style={styles.tdCenter}>
                          <div style={styles.rowActions}>
                            <button onClick={() => openMemberDetail(sale.member_id)} style={styles.inlineActionBtn}>상세</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table style={{ ...styles.table, minWidth: isMobile ? '600px' : 'auto' }}>
                  <thead><tr style={styles.trHead}><th style={styles.th}>날짜</th><th style={styles.th}>항목</th><th style={styles.th}>분류</th><th style={styles.thRight}>금액</th><th style={styles.thCenter}>수단</th><th style={styles.th}>메모</th><th style={styles.thCenter}>삭제</th></tr></thead>
                  <tbody>
                    {expenseList.length === 0 ? <tr><td colSpan={7} style={styles.emptyCell}>지출 없음</td></tr> : expenseList.map((expense) => (
                      <tr key={expense.id} style={styles.tr}>
                        <td style={styles.td}>{expense.date.split('-').slice(1).join('.')}</td>
                        <td style={{ ...styles.td, fontWeight: '600' }}>{expense.item_name}</td>
                        <td style={styles.td}><span style={styles.badgeCategory}>{expense.category}</span></td>
                        <td style={{ ...styles.tdRight, color: TOSS_RED }}>-{expense.amount.toLocaleString()}</td>
                        <td style={styles.tdCenter}>
                          {expense.method === 'card' ? '카드' : '현금'}
                          {expense.method === 'transfer' && '이체'}
                          {expense.method === 'cash' && '현금'}
                        </td>
                        <td style={{ ...styles.td, color: '#6B7280' }}>{expense.memo || '-'}</td>
                        <td style={styles.tdCenter}>
                          <button onClick={() => handleDeleteExpense(expense.id)} style={styles.iconBtn}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {isExpenseModalOpen && <AddExpenseModal onClose={() => setIsExpenseModalOpen(false)} onExpenseAdded={fetchFinancialData} />}
      {isSaleModalOpen && selectedMember && <AddSaleModal member={selectedMember} onClose={() => setIsSaleModalOpen(false)} onSaleAdded={() => { fetchFinancialData(); setIsSaleModalOpen(false); }} />}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: { maxWidth: '100%', padding: '32px 24px 100px', backgroundColor: 'var(--bg-main)', minHeight: '100vh', boxSizing: 'border-box', transition: 'background-color 0.3s' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  pageTitle: { fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },
  subtitle: { fontSize: '15px', color: 'var(--text-secondary)', marginTop: '8px' },

  dangerBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', backgroundColor: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '14px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.1)' },
  successBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', backgroundColor: '#ECFDF5', color: '#059669', border: 'none', borderRadius: '14px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)' },

  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' },
  summaryCard: { backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '24px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', transition: 'all 0.3s' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  iconBox: { width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' },
  cardValue: { fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  unit: { fontSize: '16px', fontWeight: '600', color: 'var(--text-tertiary)', marginLeft: '2px' },
  subMetric: { marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' },

  chartRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '32px' },
  chartCard: { backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '24px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', transition: 'all 0.3s' },
  chartHeader: { marginBottom: '24px' },
  chartTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
  mixRow: { display: 'flex', flexDirection: 'column' as const, gap: '8px' },
  mixHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  mixLabel: { fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' },
  mixValue: { fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' },
  mixTrack: { width: '100%', height: '10px', borderRadius: '999px', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' },
  mixFill: { height: '100%', borderRadius: '999px' },
  mixPercent: { fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' as const },
  expiryList: { display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  expiryItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' },
  expiryActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, justifyContent: 'flex-end' as const },
  expiryName: { fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' },
  expiryMeta: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' },
  expiryBadge: { padding: '6px 10px', borderRadius: '999px', backgroundColor: '#E8F3FF', color: TOSS_BLUE, fontSize: '12px', fontWeight: '800' },
  expiryBadgeUrgent: { padding: '6px 10px', borderRadius: '999px', backgroundColor: '#FEE2E2', color: TOSS_RED, fontSize: '12px', fontWeight: '800' },
  emptyExpiry: { padding: '24px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)', textAlign: 'center' as const, color: 'var(--text-secondary)', fontSize: '14px' },

  listSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
  tabs: { display: 'flex', gap: '12px' },
  tab: { padding: '12px 20px', borderRadius: '14px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-tertiary)', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  activeTab: { padding: '12px 20px', borderRadius: '14px', border: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: 'var(--shadow)' },

  tableCard: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  trHead: { backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' },
  th: { padding: '16px 24px', textAlign: 'left' as const, fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' },
  thRight: { padding: '16px 24px', textAlign: 'right' as const, fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' },
  thCenter: { padding: '16px 24px', textAlign: 'center' as const, fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' },

  tr: { borderBottom: '1px solid var(--border-color)', transition: 'background 0.1s' },
  td: { padding: '20px 24px', fontSize: '15px', color: 'var(--text-primary)' },
  tdRight: { padding: '20px 24px', textAlign: 'right' as const, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' },
  tdCenter: { padding: '20px 24px', textAlign: 'center' as const, fontSize: '15px', color: 'var(--text-primary)' },

  badgePending: { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' },
  badgePaid: { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' },
  badgeCategory: { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' },

  miniBtn: { padding: '8px 14px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' },
  inlineActionBtn: { padding: '8px 10px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' },
  rowActions: { display: 'flex', justifyContent: 'center', gap: '8px' },
  iconBtn: { background: 'none', border: 'none', color: '#ADB5BD', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyCell: { padding: '60px', textAlign: 'center' as const, color: '#ADB5BD', fontSize: '15px' },
};

export default Sales;
