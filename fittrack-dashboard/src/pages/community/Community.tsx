import { useIsMobile } from '../../hooks/useIsMobile';
import React, { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { api, createPost, toggleLike, updatePost, addComment as apiAddComment, getPosts, getPostDetail, BASE_URL } from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';
import {
    MessageSquare, Send, Trash2, ArrowLeft,
    User, Calendar, Eye, Image as ImageIcon, Heart, Edit, CornerDownRight,
    Youtube, Tag, ShoppingBag, Users, Coffee, X, Search, PenSquare, ChevronRight
} from 'lucide-react';

const TOSS_BLUE = '#3182F6';
const REGIONS = ["전체", "서울", "경기", "인천", "강원", "충북", "충남", "대전", "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주"];

interface Comment {
    id: number;
    post_id: number;
    author_id: number;
    author_name: string;
    content: string;
    created_at: string;
    parent_id?: number | null;
}

interface Post {
    id: number;
    board_type: string;
    title: string;
    content: string;
    author_id: number;
    author_name: string;
    created_at: string;
    views?: number;
    comments?: Comment[];
    image_url?: string;
    region?: string; // ✅ [신규] 지역 정보
    market_status: string;
    youtube_url?: string;
    wod_record?: string;
    like_count: number;
    is_liked: boolean;
}

const Community: React.FC = () => {
    const isMobile = useIsMobile();
    const { user } = useAppContext();

    const [activeTab, setActiveTab] = useState<'gym' | 'free'>('gym');
    const [subFilter, setSubFilter] = useState("전체");
    const [scopeFilter, setScopeFilter] = useState<'all' | 'popular' | 'mine' | 'commented'>('all');
    const [selectedRegion, setSelectedRegion] = useState("전체"); // ✅ [신규] 지역 필터
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);

    const [showWriteModal, setShowWriteModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editPostId, setEditPostId] = useState<number | null>(null);
    const [isImageDeleted, setIsImageDeleted] = useState(false);

    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("free");
    const [writeRegion, setWriteRegion] = useState("서울"); // ✅ [신규] 작성용 지역
    const [isGymNotice, setIsGymNotice] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [marketStatus, setMarketStatus] = useState("판매중");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [wodRecord, setWodRecord] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [commentContent, setCommentContent] = useState("");
    const [replyContent, setReplyContent] = useState("");
    const [replyingTo, setReplyingTo] = useState<number | null>(null);

    useEffect(() => {
        loadPosts();
        if (activeTab === 'free') {
            setSubFilter("전체");
            setScopeFilter('all');
        }
    }, [activeTab]);

    const loadPosts = async () => {
        setLoading(true);
        try {
            const res = await getPosts(activeTab === 'gym' ? 'gym' : 'free');
            const sorted = res.data.sort((a: Post, b: Post) => {
                const isNoticeA = a.board_type === 'notice' || a.board_type === 'gym_notice';
                const isNoticeB = b.board_type === 'notice' || b.board_type === 'gym_notice';
                if (isNoticeA && !isNoticeB) return -1;
                if (!isNoticeA && isNoticeB) return 1;
                return b.id - a.id;
            });
            setPosts(sorted);
            if (selectedPost) {
                const updatedPost = sorted.find((p: Post) => p.id === selectedPost.id);
                if (updatedPost) setSelectedPost(updatedPost);
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setIsImageDeleted(false);
        }
    };

    const handleRemoveImage = () => {
        setSelectedFile(null); setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (isEditing) setIsImageDeleted(true);
    };

    const openWriteModal = () => {
        setIsEditing(false); setEditPostId(null);
        setNewTitle(""); setNewContent("");
        if (activeTab === 'gym') { setSelectedCategory("gym"); setIsGymNotice(false); }
        else { setSelectedCategory("free"); }
        setMarketStatus("판매중"); setYoutubeUrl(""); setWodRecord("");
        setWriteRegion("서울");
        setIsImageDeleted(false); handleRemoveImage(); setShowWriteModal(true);
    };

    const openEditModal = (post: Post) => {
        setIsEditing(true); setEditPostId(post.id);
        setNewTitle(post.title); setNewContent(post.content);
        if (post.board_type === 'gym_notice') { setIsGymNotice(true); setSelectedCategory("gym"); }
        else if (post.board_type === 'notice') { setSelectedCategory("notice"); setIsGymNotice(false); }
        else { setIsGymNotice(false); setSelectedCategory(post.board_type); }
        setMarketStatus(post.market_status || "판매중");
        setWriteRegion(post.region || "서울");
        setYoutubeUrl(post.youtube_url || ""); setWodRecord(post.wod_record || "");
        setIsImageDeleted(false);
        if (post.image_url) setPreviewUrl(`${BASE_URL}${post.image_url}`);
        else handleRemoveImage();
        setShowWriteModal(true);
    };

    const handleSubmitPost = async () => {
        if (!newTitle.trim() || !newContent.trim()) { toast.error("제목과 내용을 입력해주세요."); return; }
        let finalBoardType = activeTab === 'gym' ? (isGymNotice ? 'gym_notice' : 'gym') : selectedCategory;
        const postData = { board_type: finalBoardType, title: newTitle, content: newContent, market_status: marketStatus, region: selectedCategory === 'regional' ? writeRegion : undefined, youtube_url: youtubeUrl, wod_record: wodRecord, file: selectedFile || undefined };
        try {
            if (isEditing && editPostId) { await updatePost(editPostId, { ...postData, deleteImage: isImageDeleted }); toast.success("글이 수정되었습니다."); }
            else { await createPost(postData); toast.success("글이 등록되었습니다."); }
            setShowWriteModal(false); loadPosts();
        } catch (err: any) { toast.error(err.response?.data?.detail || "작업 실패"); }
    };

    const handleDeletePost = async (postId: number) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        try { await api.delete(`/api/community/${postId}`); toast.success("삭제되었습니다."); setSelectedPost(null); loadPosts(); }
        catch (err) { toast.error("권한 없음"); }
    };

    const handleDeleteComment = async (commentId: number) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
        try { await api.delete(`/api/community/comments/${commentId}`); toast.success("삭제되었습니다."); loadPosts(); }
        catch (err) { toast.error("삭제 실패"); }
    };

    const handleLike = async (post: Post) => {
        try {
            const newIsLiked = !post.is_liked;
            const newCount = newIsLiked ? post.like_count + 1 : post.like_count - 1;
            const updatedPosts = posts.map(p => p.id === post.id ? { ...p, is_liked: newIsLiked, like_count: newCount } : p);
            setPosts(updatedPosts);
            if (selectedPost && selectedPost.id === post.id) setSelectedPost({ ...selectedPost, is_liked: newIsLiked, like_count: newCount });
            await toggleLike(post.id); loadPosts();
        } catch (e) { loadPosts(); }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentContent.trim() || !selectedPost) return;
        try { await apiAddComment(selectedPost.id, { content: commentContent }); setCommentContent(""); loadPosts(); }
        catch (err) { toast.error("댓글 등록 실패"); }
    };

    const handleAddReply = async (parentId: number) => {
        if (!replyContent.trim() || !selectedPost) return;
        try { await apiAddComment(selectedPost.id, { content: replyContent, parent_id: parentId }); setReplyContent(""); setReplyingTo(null); loadPosts(); }
        catch (err) { toast.error("답글 등록 실패"); }
    };

    const getEmbedUrl = (url: string) => {
        if (!url) return null;
        let videoId = "";
        if (url.includes("youtube.com/watch?v=")) videoId = url.split("v=")[1]?.split("&")[0];
        else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1];
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    const popularityScore = (post: Post) => (post.like_count || 0) * 3 + (post.comments?.length || 0) * 2 + (post.views || 0);

    const filteredPosts = posts.filter(post => {
        if (activeTab === 'free') {
            if (post.board_type === 'gym' || post.board_type === 'gym_notice') return false;
            if (subFilter !== '전체') {
                if (subFilter === '공지' && post.board_type !== 'notice') return false;
                else if (subFilter === '자유' && post.board_type !== 'free') return false;
                else if (subFilter === '장터' && post.board_type !== 'market') return false;
                else if (subFilter === '질문' && post.board_type !== 'question') return false;
                else if (subFilter === '지역별') {
                    if (post.board_type !== 'regional') return false;
                    if (selectedRegion !== '전체' && post.region !== selectedRegion) return false;
                }
            }
        } else {
            if (['free', 'market', 'question', 'notice', 'regional'].includes(post.board_type)) return false;
        }
        const lowerSearch = searchTerm.toLowerCase();
        const matchesSearch = post.title.toLowerCase().includes(lowerSearch) || post.content.toLowerCase().includes(lowerSearch);
        if (!matchesSearch) return false;

        if (scopeFilter === 'mine') {
            return post.author_id === user?.id;
        }
        if (scopeFilter === 'commented') {
            return Boolean(post.comments?.some((comment) => comment.author_id === user?.id));
        }
        return true;
    });

    const popularPosts = [...filteredPosts]
        .sort((a, b) => popularityScore(b) - popularityScore(a))
        .slice(0, 3);
    const displayedPosts = scopeFilter === 'popular' ? popularPosts : filteredPosts;

    const getBadge = (type: string, status?: string) => {
        const badges: { [key: string]: { bg: string; color: string; label: string } } = {
            notice: { bg: 'var(--danger-bg)', color: 'var(--danger)', label: '📢 공지' },
            gym_notice: { bg: 'var(--primary-bg)', color: 'var(--primary)', label: '📢 센터' },
            free: { bg: 'var(--bg-secondary)', color: 'var(--text-tertiary)', label: '자유' },
            market: { bg: 'var(--success-bg)', color: 'var(--success)', label: '장터' },
            question: { bg: 'var(--primary-bg)', color: 'var(--primary)', label: '질문' },
            regional: { bg: '#E0E7FF', color: '#4F46E5', label: '지역' },
        };
        const badge = badges[type] || { bg: 'var(--bg-secondary)', color: 'var(--text-tertiary)', label: type };
        return <span style={{ ...styles.badge, backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>;
    };

    const getMarketBadge = (status: string) => {
        const colors: { [key: string]: string } = { '판매중': '#10B981', '예약중': '#F59E0B', '판매완료': '#9CA3AF' };
        return <span style={{ ...styles.badge, backgroundColor: colors[status] || '#9CA3AF', color: '#fff', marginLeft: '6px' }}>{status}</span>;
    };

    const getBoardName = (type: string) => {
        const names: { [key: string]: string } = {
            notice: '공지',
            gym_notice: '센터',
            free: '자유',
            market: '장터',
            question: '질문',
            regional: '지역',
        };
        return names[type] || '기타';
    };

    return (
        <div style={styles.container}>
            {/* 탭 */}
            <div style={styles.tabContainer}>
                <button onClick={() => { setActiveTab('gym'); setSelectedPost(null); }} style={activeTab === 'gym' ? styles.tabActive : styles.tab}>
                    <Users size={18} /> 우리 체육관
                </button>
                <button onClick={() => { setActiveTab('free'); setSelectedPost(null); }} style={activeTab === 'free' ? { ...styles.tabActive, backgroundColor: '#10B981' } : styles.tab}>
                    <Coffee size={18} /> 자유 공간
                </button>
            </div>

            {selectedPost ? (
                /* 상세 보기 */
                <div style={styles.detailContainer}>
                    <button onClick={() => setSelectedPost(null)} style={styles.backBtn}>
                        <ArrowLeft size={20} /> 목록으로
                    </button>

                    <article style={styles.article}>
                        <div style={styles.articleHeader}>
                            <div style={styles.badgeRow}>
                                {getBadge(selectedPost.board_type)}
                                {selectedPost.board_type === 'regional' && (
                                    <span style={{ ...styles.badge, backgroundColor: '#E0E7FF', color: '#4F46E5', marginLeft: '6px' }}>{selectedPost.region}</span>
                                )}
                                {selectedPost.board_type === 'market' && getMarketBadge(selectedPost.market_status)}
                            </div>
                            <h1 style={styles.articleTitle}>{selectedPost.title}</h1>
                            <div style={styles.articleMeta}>
                                <span style={styles.authorBadge}><User size={12} /> {selectedPost.author_name}</span>
                                <span style={styles.metaDivider}>•</span>
                                <span>{formatDate(selectedPost.created_at)}</span>
                                <span style={styles.metaDivider}>•</span>
                                <span>조회 {selectedPost.views || 0}</span>
                            </div>
                        </div>

                        {selectedPost.youtube_url && getEmbedUrl(selectedPost.youtube_url) && (
                            <div style={styles.videoContainer}>
                                <iframe src={getEmbedUrl(selectedPost.youtube_url)!} style={styles.iframe} title="YouTube video" frameBorder="0" allowFullScreen />
                            </div>
                        )}

                        {selectedPost.image_url && (
                            <div style={styles.imageContainer}>
                                <img src={`${BASE_URL}${selectedPost.image_url}`} alt="첨부" style={styles.image} onError={(e) => e.currentTarget.style.display = 'none'} />
                            </div>
                        )}

                        <div style={styles.articleContent}>{selectedPost.content}</div>

                        {/* 좋아요 + 액션 */}
                        <div style={styles.actionRow}>
                            <button onClick={() => handleLike(selectedPost)} style={selectedPost.is_liked ? styles.likeActive : styles.likeBtn}>
                                <Heart size={18} fill={selectedPost.is_liked ? "#EF4444" : "none"} />
                                {selectedPost.like_count}
                            </button>
                            {(user?.role === 'subcoach' || user?.role === 'staff' || user?.name === selectedPost.author_name) && (
                                <div style={styles.actionBtns}>
                                    <button onClick={() => openEditModal(selectedPost)} style={styles.editBtn}><Edit size={16} /> 수정</button>
                                    <button onClick={() => handleDeletePost(selectedPost.id)} style={styles.deleteBtn}><Trash2 size={16} /> 삭제</button>
                                </div>
                            )}
                        </div>

                        {/* 댓글 */}
                        <div style={styles.commentSection}>
                            <h3 style={styles.commentTitle}><MessageSquare size={18} /> 댓글 {selectedPost.comments?.length || 0}</h3>
                            <div style={styles.commentList}>
                                {(selectedPost.comments || []).filter(c => !c.parent_id).map(comment => (
                                    <div key={comment.id}>
                                        <div style={styles.commentCard}>
                                            <div style={styles.commentHeader}>
                                                <span style={styles.commentAuthor}>{comment.author_name}</span>
                                                <div style={styles.commentActions}>
                                                    <span style={styles.commentDate}>{formatDate(comment.created_at)}</span>
                                                    {(user?.role === 'subcoach' || user?.role === 'staff' || user?.name === comment.author_name) && (
                                                        <button onClick={() => handleDeleteComment(comment.id)} style={styles.smallDeleteBtn}><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={styles.commentContent}>{comment.content}</div>
                                            <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} style={styles.replyBtn}>
                                                <CornerDownRight size={14} /> 답글
                                            </button>
                                        </div>
                                        {/* 대댓글 */}
                                        {(selectedPost.comments || []).filter(c => c.parent_id === comment.id).map(reply => (
                                            <div key={reply.id} style={styles.replyCard}>
                                                <div style={styles.commentHeader}>
                                                    <span style={styles.replyAuthor}><CornerDownRight size={14} /> {reply.author_name}</span>
                                                    <span style={styles.commentDate}>{formatDate(reply.created_at)}</span>
                                                </div>
                                                <div style={styles.commentContent}>{reply.content}</div>
                                            </div>
                                        ))}
                                        {replyingTo === comment.id && (
                                            <div style={styles.replyInputRow}>
                                                <input autoFocus value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="답글 작성..." style={styles.replyInput} onKeyPress={(e) => e.key === 'Enter' && handleAddReply(comment.id)} />
                                                <button onClick={() => handleAddReply(comment.id)} style={styles.replySubmitBtn}>등록</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleAddComment} style={styles.commentInputRow}>
                                <input value={commentContent} onChange={(e) => setCommentContent(e.target.value)} placeholder="댓글을 남겨보세요..." style={styles.commentInput} />
                                <button type="submit" style={styles.commentSubmitBtn}><Send size={18} /></button>
                            </form>
                        </div>
                    </article>
                </div>
            ) : (
                /* 목록 */
                <>
                    <div style={styles.listHeader}>
                        {activeTab === 'free' ? (
                            <>
                                <div style={styles.filterRow}>
                                    {['전체', '공지', '자유', '장터', '질문', '지역별'].map((type) => (
                                        <button key={type} onClick={() => setSubFilter(type)} style={subFilter === type ? styles.filterActive : styles.filterBtn}>{type}</button>
                                    ))}
                                </div>
                                <div style={{ ...styles.filterRow, marginTop: '-8px' }}>
                                    <button onClick={() => setScopeFilter('all')} style={scopeFilter === 'all' ? styles.scopeActive : styles.scopeBtn}>전체 글</button>
                                    <button onClick={() => setScopeFilter('popular')} style={scopeFilter === 'popular' ? styles.scopeActive : styles.scopeBtn}>인기글</button>
                                    <button onClick={() => setScopeFilter('mine')} style={scopeFilter === 'mine' ? styles.scopeActive : styles.scopeBtn}>내 글</button>
                                    <button onClick={() => setScopeFilter('commented')} style={scopeFilter === 'commented' ? styles.scopeActive : styles.scopeBtn}>내 댓글</button>
                                    <button
                                        onClick={() => {
                                            setSubFilter('장터');
                                            setScopeFilter('all');
                                        }}
                                        style={subFilter === '장터' ? styles.scopeActive : styles.scopeBtn}
                                    >
                                        장터 바로가기
                                    </button>
                                </div>
                                {subFilter === '지역별' && (
                                    <div style={{ ...styles.filterRow, marginTop: '-8px', marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                                        {REGIONS.map((region) => (
                                            <button key={region} onClick={() => setSelectedRegion(region)} style={selectedRegion === region ? { ...styles.filterActive, backgroundColor: '#4F46E5' } : styles.filterBtn}>{region}</button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={styles.gymLabel}>📢 우리 박스 멤버들의 공간</div>
                        )}
                        <div style={styles.searchRow}>
                            <div style={styles.searchWrapper}>
                                <Search size={16} color="#9CA3AF" style={styles.searchIcon} />
                                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="관심있는 내용을 검색해보세요" style={styles.searchInput} />
                            </div>
                            <button onClick={openWriteModal} style={styles.writeBtn}><PenSquare size={18} /> 글쓰기</button>
                        </div>
                    </div>

                    {activeTab === 'free' && scopeFilter === 'popular' && popularPosts.length > 0 && (
                        <div style={styles.popularSection}>
                            <div style={styles.popularHeader}>지금 많이 보는 글</div>
                            <div style={styles.popularGrid}>
                                {popularPosts.map((post) => (
                                    <button
                                        key={`popular-${post.id}`}
                                        style={styles.popularCard}
                                        onClick={async () => {
                                            try {
                                                const res = await getPostDetail(post.id);
                                                setSelectedPost(res.data);
                                                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: res.data.views } : p));
                                            } catch (e) {
                                                setSelectedPost(post);
                                            }
                                        }}
                                    >
                                        <div style={styles.popularBadgeRow}>
                                            <span style={styles.popularBadge}>{getBoardName(post.board_type)}</span>
                                            <span style={styles.popularMetric}>좋아요 {post.like_count}</span>
                                        </div>
                                        <div style={styles.popularTitle}>{post.title}</div>
                                        <div style={styles.popularMeta}>댓글 {post.comments?.length || 0} · 조회 {post.views || 0}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={styles.tableCard}>
                        {displayedPosts.length === 0 ? (
                            <div style={styles.emptyState}>
                                <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)' }}>등록된 게시글이 없습니다</p>
                                <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>가장 먼저 글을 작성해보세요!</p>
                            </div>
                        ) : (
                            <table style={styles.table}>
                                <thead>
                                    <tr style={styles.tableHeader}>
                                        <th style={styles.thBoard}>게시판</th>
                                        <th style={styles.thTitle}>제목</th>
                                        <th style={styles.thAuthor}>글쓴이</th>
                                        <th style={styles.thDate}>날짜</th>
                                        <th style={styles.thViews}>조회</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedPosts.map(post => (
                                        <tr key={post.id} onClick={async () => {
                                            try {
                                                // ✅ 상세 조회 API 호출 (조회수 증가)
                                                const res = await getPostDetail(post.id);
                                                setSelectedPost(res.data);

                                                // 목록의 조회수도 업데이트
                                                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: res.data.views } : p));
                                            } catch (e) {
                                                console.error("게시글 상세 조회 실패", e);
                                                setSelectedPost(post); // 실패 시 기존 데이터라도 보여줌
                                            }
                                        }} style={styles.tr}>
                                            <td style={styles.tdBoard}>
                                                <span style={styles.boardLabel}>{getBoardName(post.board_type)}</span>
                                            </td>
                                            <td style={styles.tdTitle}>
                                                <div style={styles.titleWrapper}>
                                                    {post.is_liked && <span style={styles.hotIcon}>HOT</span>}
                                                    {post.board_type === 'market' && <span style={styles.marketState}>[{post.market_status}]</span>}
                                                    {post.board_type === 'regional' && <span style={{ ...styles.marketState, color: '#4F46E5' }}>[{post.region}]</span>}
                                                    <span style={styles.titleText}>{post.title}</span>
                                                    {post.comments && post.comments.length > 0 && (
                                                        <span style={styles.commentCount}>[{post.comments.length}]</span>
                                                    )}
                                                    {post.image_url && <ImageIcon size={14} color="#8B95A1" />}
                                                    {post.youtube_url && <Youtube size={14} color="#EF4444" />}
                                                </div>
                                            </td>
                                            <td style={styles.tdAuthor}>
                                                <div style={styles.authorWrapper}>
                                                    <span style={styles.authorName}>{post.author_name}</span>
                                                </div>
                                            </td>
                                            <td style={styles.tdDate}>{formatDate(post.created_at)}</td>
                                            <td style={styles.tdViews}>{post.views || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            {/* 글쓰기 모달 */}
            {showWriteModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <h3 style={styles.modalTitle}>{isEditing ? "게시글 수정" : "새 글 작성"}</h3>
                            <button onClick={() => setShowWriteModal(false)} style={styles.modalCloseBtn}><X size={24} /></button>
                        </div>

                        <div style={styles.modalTabLabel}>
                            {activeTab === 'gym' ? '🏟️ 우리 체육관' : '☕ 자유 공간'}에 작성됩니다
                        </div>

                        {activeTab === 'free' && (
                            <div style={styles.formGroup}>
                                <label style={styles.label}>카테고리 선택</label>
                                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={styles.select}>
                                    <option value="free">자유게시판</option>
                                    <option value="market">중고장터</option>
                                    <option value="question">질문게시판</option>
                                    <option value="regional">지역별게시판</option>
                                    {user?.role === 'subcoach' && <option value="notice">📢 전체 공지</option>}
                                </select>
                            </div>
                        )}

                        {activeTab === 'gym' && (user?.role === 'subcoach' || user?.role === 'staff') && (
                            <div style={styles.noticeCheck}>
                                <label style={styles.checkLabel}>
                                    <input type="checkbox" checked={isGymNotice} onChange={(e) => setIsGymNotice(e.target.checked)} />
                                    📢 공지사항으로 등록
                                </label>
                            </div>
                        )}

                        {selectedCategory === 'market' && activeTab === 'free' && (
                            <div style={styles.formGroup}>
                                <label style={styles.label}>판매 상태</label>
                                <select value={marketStatus} onChange={(e) => setMarketStatus(e.target.value)} style={styles.select}>
                                    <option value="판매중">🟢 판매중</option>
                                    <option value="예약중">🟡 예약중</option>
                                    <option value="판매완료">⚫ 판매완료</option>
                                </select>
                            </div>
                        )}

                        {selectedCategory === 'regional' && activeTab === 'free' && (
                            <div style={styles.formGroup}>
                                <label style={styles.label}>지역 선택</label>
                                <select value={writeRegion} onChange={(e) => setWriteRegion(e.target.value)} style={styles.select}>
                                    {REGIONS.filter(r => r !== '전체').map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={styles.formGroup}>
                            <label style={styles.label}>제목</label>
                            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="제목을 입력하세요" style={styles.input} />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>내용</label>
                            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="내용을 입력하세요" rows={5} style={styles.textarea} />
                        </div>

                        <div style={styles.formGroup}>
                            <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} style={{ display: 'none' }} id="file-upload" />
                            <div style={styles.fileRow}>
                                <label htmlFor="file-upload" style={styles.fileLabel}><ImageIcon size={18} /> 사진 첨부</label>
                                {previewUrl && <button type="button" onClick={handleRemoveImage} style={styles.fileRemoveBtn}><Trash2 size={14} /> 삭제</button>}
                            </div>
                            {previewUrl && <img src={previewUrl} alt="미리보기" style={styles.previewImg} />}
                        </div>

                        <div style={styles.modalBtnRow}>
                            <button onClick={() => setShowWriteModal(false)} style={styles.cancelBtn}>취소</button>
                            <button onClick={handleSubmitPost} style={styles.submitBtn}>{isEditing ? "수정완료" : "등록하기"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { maxWidth: '100%', padding: '24px 32px 80px', backgroundColor: 'var(--bg-secondary)', minHeight: '100vh', boxSizing: 'border-box', fontFamily: '"Pretendard", -apple-system, system-ui, sans-serif' },

    // Tabs
    tabContainer: { display: 'flex', gap: '8px', padding: '0 0 24px', maxWidth: '600px' },
    tab: { flex: 1, padding: '16px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-tertiary)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', transition: 'all 0.2s' },
    tabActive: { flex: 1, padding: '16px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: TOSS_BLUE, color: '#FFFFFF', boxShadow: '0 4px 12px rgba(49, 130, 246, 0.3)', transform: 'translateY(-2px)' },

    // List Header
    listHeader: { marginBottom: '24px' },
    filterRow: { display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' as const, paddingBottom: '4px' },
    filterBtn: { padding: '10px 18px', borderRadius: '24px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px', backgroundColor: 'var(--bg-card)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' as const, boxShadow: '0 2px 6px rgba(0,0,0,0.02)', transition: 'all 0.2s' },
    filterActive: { padding: '10px 18px', borderRadius: '24px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px', backgroundColor: '#10B981', color: '#FFFFFF', whiteSpace: 'nowrap' as const, boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' },
    gymLabel: { fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' },
    searchRow: { display: 'flex', gap: '12px' },
    searchWrapper: { flex: 1, position: 'relative' as const },
    searchIcon: { position: 'absolute' as const, left: '16px', top: '50%', transform: 'translateY(-50%)' },
    searchInput: { width: '100%', padding: '14px 14px 14px 44px', borderRadius: '16px', border: '1px solid transparent', fontSize: '15px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', outline: 'none', transition: 'box-shadow 0.2s' },
    writeBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 20px', borderRadius: '16px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--text-primary)', color: 'var(--bg-card)', fontWeight: '600', fontSize: '15px' },
    scopeBtn: { padding: '8px 14px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', backgroundColor: '#EEF2F7', color: 'var(--text-secondary)', whiteSpace: 'nowrap' as const },
    scopeActive: { padding: '8px 14px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: '#191F28', color: '#FFFFFF', whiteSpace: 'nowrap' as const },
    popularSection: { marginBottom: '20px' },
    popularHeader: { fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px' },
    popularGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
    popularCard: { border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '16px', textAlign: 'left' as const, cursor: 'pointer' },
    popularBadgeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' },
    popularBadge: { fontSize: '11px', fontWeight: '700', color: TOSS_BLUE, backgroundColor: 'var(--primary-bg)', borderRadius: '999px', padding: '4px 8px' },
    popularMetric: { fontSize: '11px', color: 'var(--text-tertiary)' },
    popularTitle: { fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '8px', minHeight: '40px' },
    popularMeta: { fontSize: '12px', color: 'var(--text-tertiary)' },

    // Post List
    // Post List (List View Style)
    // Post List (Table View Style)
    tableCard: { backgroundColor: 'var(--bg-card)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' },
    table: { width: '100%', borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const },
    tableHeader: { backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' },

    // Table Header Cells
    thBoard: { padding: '16px 8px', textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', width: '60px' },
    thTitle: { padding: '16px 8px', textAlign: 'left' as const, color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600' },
    thAuthor: { padding: '16px 8px', textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', width: '90px' },
    thDate: { padding: '16px 8px', textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', width: '65px' },
    thViews: { padding: '16px 8px', textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: '600', width: '50px' },

    // Table Row Cells
    tr: { cursor: 'pointer', borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' },
    tdBoard: { padding: '16px 8px', textAlign: 'center' as const },
    boardLabel: { color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' },

    tdTitle: { padding: '16px 8px', textAlign: 'left' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    titleWrapper: { display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' },
    titleText: { fontSize: '15px', color: 'var(--text-primary)', fontWeight: '500', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },

    commentCount: { fontSize: '13px', color: 'var(--danger)', fontWeight: '700', flexShrink: 0 },
    hotIcon: { fontSize: '11px', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', border: '1px solid var(--danger-bg)', flexShrink: 0 },
    marketState: { fontSize: '13px', color: TOSS_BLUE, fontWeight: '600', flexShrink: 0 },

    tdAuthor: { padding: '16px 8px', textAlign: 'center' as const },
    authorWrapper: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', overflow: 'hidden' },
    authorName: { fontSize: '14px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },

    tdDate: { padding: '16px 8px', textAlign: 'center' as const, fontSize: '13px', color: 'var(--text-tertiary)' },
    tdViews: { padding: '16px 8px', textAlign: 'center' as const, fontSize: '13px', color: 'var(--text-tertiary)' },

    // Detail
    detailContainer: { paddingTop: '0', paddingBottom: '100px', maxWidth: '800px', margin: '0 auto' },
    backBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '600', marginBottom: '24px', padding: 0 },
    article: { backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' },
    articleHeader: { paddingBottom: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' },
    badgeRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
    authorBadge: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: 'var(--text-primary)' },
    metaDivider: { color: 'var(--border-color)' },
    articleTitle: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 16px 0', lineHeight: '1.3' },
    articleMeta: { display: 'flex', gap: '8px', fontSize: '14px', color: 'var(--text-tertiary)', alignItems: 'center' },

    videoContainer: { position: 'relative' as const, paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '16px', marginBottom: '24px' },
    iframe: { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%' },
    imageContainer: { marginBottom: '24px', textAlign: 'center' as const, backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', padding: '16px' },
    image: { maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
    articleContent: { fontSize: '16px', color: 'var(--text-primary)', lineHeight: '1.7', whiteSpace: 'pre-wrap' as const, minHeight: '120px' },

    actionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0', borderTop: '1px solid var(--border-color)', marginTop: '40px' },
    likeBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '50px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', fontWeight: '600', transition: 'all 0.2s' },
    likeActive: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '50px', border: 'none', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', fontSize: '15px', fontWeight: '700', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)' },
    actionBtns: { display: 'flex', gap: '12px' },
    editBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' },
    deleteBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '14px', fontWeight: '500' },

    // Comments
    commentSection: { marginTop: '40px', paddingTop: '32px', borderTop: '1px solid var(--border-color)' },
    commentTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 24px 0' },
    commentList: { display: 'flex', flexDirection: 'column' as const, gap: '20px', marginBottom: '32px' },
    commentCard: { backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)' },
    commentHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    commentAuthor: { fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' },
    commentActions: { display: 'flex', alignItems: 'center', gap: '12px' },
    commentDate: { fontSize: '12px', color: 'var(--text-tertiary)' },
    smallDeleteBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 },
    commentContent: { fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.5' },
    replyBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: TOSS_BLUE, fontSize: '13px', fontWeight: '600', marginTop: '12px' },
    replyCard: { marginLeft: '32px', marginTop: '12px', backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', borderLeft: `3px solid ${TOSS_BLUE}` },
    replyAuthor: { display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' },
    replyInputRow: { marginLeft: '32px', marginTop: '12px', display: 'flex', gap: '12px' },
    replyInput: { flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' },
    replySubmitBtn: { padding: '12px 18px', borderRadius: '12px', border: 'none', backgroundColor: TOSS_BLUE, color: '#FFFFFF', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
    commentInputRow: { display: 'flex', gap: '12px', position: 'sticky' as const, bottom: 0, backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' },
    commentInput: { flex: 1, padding: '14px', borderRadius: '14px', border: 'none', fontSize: '15px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' },
    commentSubmitBtn: { padding: '14px 20px', borderRadius: '14px', border: 'none', backgroundColor: 'var(--text-primary)', color: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

    // Modal
    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' },
    modalContent: { backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    modalTitle: { fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 },
    modalCloseBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' },
    modalTabLabel: { fontSize: '14px', fontWeight: '600', color: TOSS_BLUE, marginBottom: '24px', padding: '12px 16px', backgroundColor: 'var(--primary-bg)', borderRadius: '12px', display: 'inline-block' },
    formGroup: { marginBottom: '20px' },
    label: { display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' },
    input: { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '15px', boxSizing: 'border-box' as const, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', transition: 'background 0.2s' },
    select: { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '15px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' },
    textarea: { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)', fontSize: '15px', boxSizing: 'border-box' as const, resize: 'vertical' as const, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', minHeight: '120px' },

    noticeCheck: { backgroundColor: 'var(--primary-bg)', padding: '16px', borderRadius: '16px', marginBottom: '20px' },
    checkLabel: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '700', color: TOSS_BLUE, fontSize: '15px' },

    fileRow: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' },
    fileLabel: { display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 20px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'background 0.2s' },
    fileRemoveBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '8px' },
    previewImg: { marginTop: '16px', maxWidth: '100%', maxHeight: '200px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },

    modalBtnRow: { display: 'flex', gap: '12px', marginTop: '32px' },
    cancelBtn: { flex: 1, padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', fontSize: '16px', fontWeight: '600', color: 'var(--text-secondary)', transition: 'background 0.2s' },
    submitBtn: { flex: 1, padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: TOSS_BLUE, cursor: 'pointer', fontSize: '16px', fontWeight: '700', color: '#FFFFFF', transition: 'background 0.2s' },

    // Badges & Extras
    badge: { padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' },
    hotBadge: { padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: '#FEF2F2', color: '#EF4444', border: '1px solid #FCA5A5' },
    mediaBadge: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: '600' },
    emptyState: { textAlign: 'center' as const, padding: '80px 20px', color: 'var(--text-tertiary)' },
};

export default Community;
