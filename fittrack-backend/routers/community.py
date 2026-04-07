from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
import shutil
import os
import uuid

from database import get_db
from models import Post, Comment, Member, PostLike, Notification, CoachPermission, Permission
from security import get_current_user
from constants import Role
from utils.auth import assert_roles
# ✅ [추가] 복합 쿼리를 위해 or_ 가져오기
from sqlalchemy import or_ 

router = APIRouter(
    tags=["Community"]
)

UPLOAD_DIR = "uploads"
COMMUNITY_STAFF_ROLES = [Role.SUBCOACH, Role.COACH, Role.SUPERADMIN]

# === Pydantic Schemas ===

class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None

class CommentResponse(BaseModel):
    id: int
    post_id: int
    author_id: int
    author_name: str
    content: str
    created_at: datetime
    parent_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

class PostResponse(BaseModel):
    id: int
    gym_id: Optional[int] = None
    board_type: str
    title: str
    content: str
    author_id: int
    author_name: str
    created_at: datetime
    views: int
    image_url: Optional[str] = None
    region: Optional[str] = None
    
    market_status: str
    youtube_url: Optional[str] = None
    wod_record: Optional[str] = None
    
    like_count: int = 0
    is_liked: bool = False
    is_popup: bool = False
    popup_expires_at: Optional[datetime] = None
    comments: List[CommentResponse] = [] 

    model_config = ConfigDict(from_attributes=True)


def has_subcoach_community_permission(current_user: Member, db: Session) -> bool:
    if current_user.role != Role.SUBCOACH:
        return True

    has_perm = db.query(CoachPermission).join(Permission).filter(
        CoachPermission.coach_id == current_user.id,
        CoachPermission.gym_id == current_user.gym_id,
        Permission.name == "community",
    ).first()
    return has_perm is not None


def require_community_staff(current_user: Member, db: Session, detail: str) -> None:
    assert_roles(current_user, COMMUNITY_STAFF_ROLES, detail)
    if current_user.role == Role.SUBCOACH and not has_subcoach_community_permission(current_user, db):
        raise HTTPException(status_code=403, detail="커뮤니티 관리 권한이 없습니다.")


def require_notice_write_access(current_user: Member) -> None:
    assert_roles(current_user, [Role.SUBCOACH, Role.SUPERADMIN], "전체 공지사항은 총 관리자만 작성할 수 있습니다.")


def require_gym_notice_write_access(current_user: Member, db: Session) -> None:
    require_community_staff(current_user, db, "센터 공지사항 작성 권한이 없습니다.")

# ==========================
# API Endpoints
# ==========================

# 0. 활성 팝업 공지 조회 (최상위 App에서 호출)
@router.get("/active-popup", response_model=Optional[PostResponse])
def get_active_popup(db: Session = Depends(get_db)):
    """현재 시각 기준으로 유효한 가장 최신 팝업 공지를 가져옵니다."""
    now = datetime.now()
    popup = db.query(Post).filter(
        Post.is_popup == True,
        or_(Post.popup_expires_at == None, Post.popup_expires_at > now)
    ).order_by(Post.id.desc()).first()
    
    if popup:
        # 응답 스카마 필드 보정 (PostResponse에서 처리되지만 명시적으로 count 등은 넘기지 않음)
        popup.like_count = db.query(PostLike).filter(PostLike.post_id == popup.id).count()
        popup.is_liked = False
    return popup

# 1. 게시글 목록 조회 (공지 분리 로직 적용)
@router.get("/", response_model=List[PostResponse])
def get_posts(
    board_type: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user)
):
    query = db.query(Post)

    # ✅ 필터링 로직 수정
    if board_type:
        if board_type == "gym" and current_user:
            # [우리 체육관]: (일반글 'gym') OR (센터공지 'gym_notice') 둘 다 가져옴
            query = query.filter(
                Post.gym_id == current_user.gym_id,
                or_(Post.board_type == "gym", Post.board_type == "gym_notice")
            )
        elif board_type == "free":
             # [자유 공간]: 'gym' 관련 글 제외하고 다 가져옴 (free, market, question, notice, regional)
             query = query.filter(
                 Post.board_type.in_(["free", "market", "question", "notice", "regional"])
             )
        else:
            # 특정 카테고리(장터 등)만 선택한 경우
            query = query.filter(Post.board_type == board_type)
    
    posts = query.order_by(Post.id.desc()).all()
    
    # 좋아요 및 추가 정보 처리
    results = []
    for p in posts:
        count = db.query(PostLike).filter(PostLike.post_id == p.id).count()
        liked_by_me = False
        if current_user:
            liked_by_me = db.query(PostLike).filter(
                PostLike.post_id == p.id, 
                PostLike.member_id == current_user.id
            ).first() is not None

        p.like_count = count
        p.is_liked = liked_by_me
        results.append(p)

    return results

# 1-1. 게시글 상세 조회 (조회수 증가)
@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

    # 조회수 증가 (단순 증가)
    post.views += 1
    db.commit()
    db.refresh(post)

    # 좋아요 여부 확인
    post.like_count = db.query(PostLike).filter(PostLike.post_id == post.id).count()
    post.is_liked = False
    if current_user:
        post.is_liked = db.query(PostLike).filter(
            PostLike.post_id == post.id, 
            PostLike.member_id == current_user.id
        ).first() is not None

    return post

# 2. 게시글 작성 (권한 체크 강화)
@router.post("/", response_model=PostResponse)
def create_post(
    title: str = Form(...),
    content: str = Form(...),
    board_type: str = Form(...),
    market_status: str = Form("판매중"),
    region: Optional[str] = Form(None),
    youtube_url: Optional[str] = Form(None),
    wod_record: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # ✅ [권한 1] '전체 공지(notice)'는 오직 총 관리자(admin)만 작성 가능
    if board_type == "notice":
        require_notice_write_access(current_user)

    # ✅ [권한 2] '센터 공지(gym_notice)'는 관리자(admin) 또는 코치(staff)만 작성 가능
    if board_type == "gym_notice":
        require_gym_notice_write_access(current_user, db)

    image_url = None
    if file:
        filename = f"{uuid.uuid4()}-{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_url = f"/uploads/{filename}"

    new_post = Post(
        gym_id=current_user.gym_id,
        board_type=board_type,
        title=title,
        content=content,
        author_id=current_user.id,
        author_name=current_user.name,
        image_url=image_url,
        region=region,
        market_status=market_status,
        youtube_url=youtube_url,
        wod_record=wod_record
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    
    new_post.like_count = 0
    new_post.is_liked = False
    return new_post

# 3. 게시글 수정 (권한 체크 강화)
@router.put("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: int,
    title: str = Form(...),
    content: str = Form(...),
    board_type: str = Form(...),
    market_status: str = Form("판매중"),
    region: Optional[str] = Form(None),
    youtube_url: Optional[str] = Form(None),
    wod_record: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    delete_image: str = Form("false"), 
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    # 기본 권한: 본인 or (커뮤니티 권한이 있는 관리자 or 코치)
    if post.author_id != current_user.id:
        require_community_staff(current_user, db, "수정 권한이 없습니다.")

    # ✅ [권한 1] 수정 시 '전체 공지'로 바꾸려면 총 관리자여야 함
    if board_type == "notice":
         assert_roles(current_user, [Role.SUBCOACH, Role.SUPERADMIN], "전체 공지로 변경할 권한이 없습니다.")
    
    # ✅ [권한 2] 수정 시 '센터 공지'로 바꾸려면 관리자/코치여야 함
    if board_type == "gym_notice":
         require_community_staff(current_user, db, "센터 공지로 변경할 권한이 없습니다.")

    post.title = title
    post.content = content
    post.board_type = board_type
    post.market_status = market_status
    post.region = region
    post.youtube_url = youtube_url
    post.wod_record = wod_record

    if delete_image == "true" or file:
        if post.image_url:
            try:
                old_file_path = post.image_url.lstrip("/")
                if os.path.exists(old_file_path):
                    os.remove(old_file_path)
            except Exception as e:
                print(f"기존 이미지 삭제 실패: {e}")
            post.image_url = None

    if file:
        filename = f"{uuid.uuid4()}-{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        post.image_url = f"/uploads/{filename}"

    db.commit()
    db.refresh(post)
    
    post.like_count = db.query(PostLike).filter(PostLike.post_id == post.id).count()
    post.is_liked = db.query(PostLike).filter(PostLike.post_id == post.id, PostLike.member_id == current_user.id).first() is not None
    
    return post

# 4. 게시글 삭제 (기존 유지)
@router.delete("/{post_id}")
def delete_post(
    post_id: int, 
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    
    if post.author_id != current_user.id:
        require_community_staff(current_user, db, "커뮤니티 게시글 삭제 권한이 없습니다.")

    if post.image_url:
        try:
            file_path = post.image_url.lstrip("/")
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"이미지 삭제 중 오류: {e}")
        
    db.delete(post)
    db.commit()
    return {"message": "삭제되었습니다."}

# 5. 좋아요 토글 (기존 유지)
@router.post("/{post_id}/like")
def toggle_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글이 없습니다.")

    existing_like = db.query(PostLike).filter(
        PostLike.post_id == post_id,
        PostLike.member_id == current_user.id
    ).first()

    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {"message": "unliked"}
    else:
        new_like = PostLike(post_id=post_id, member_id=current_user.id)
        db.add(new_like)
        db.commit()
        return {"message": "liked"}

# 6. 댓글 작성 (기존 유지)
@router.post("/{post_id}/comments", response_model=CommentResponse)
def create_comment(
    post_id: int,
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글이 없습니다.")

    if comment_data.parent_id:
        parent = db.query(Comment).filter(Comment.id == comment_data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="원 댓글을 찾을 수 없습니다.")

    new_comment = Comment(
        post_id=post_id,
        author_id=current_user.id,
        author_name=current_user.name,
        content=comment_data.content,
        parent_id=comment_data.parent_id
    )
    db.add(new_comment)
    
    # 알림 생성
    # 1. 원글 작성자에게 알림 (본인이 쓴 댓글이 아닐 경우)
    if post.author_id != current_user.id:
        noti = Notification(
            recipient_id=post.author_id,
            sender_id=current_user.id,
            type="comment",
            title="새 댓글 알림",
            message=f"{current_user.name}님이 회원님의 게시글에 댓글을 남겼습니다.",
            related_link=f"/community" 
        )
        db.add(noti)

    # 2. 대댓글인 경우, 원댓글 작성자에게 알림 (본인이 쓴 대댓글이 아닐 경우)
    if comment_data.parent_id:
        parent_comment = db.query(Comment).filter(Comment.id == comment_data.parent_id).first()
        if parent_comment and parent_comment.author_id != current_user.id and parent_comment.author_id != post.author_id:
            # 원글 작성자와 원댓글 작성자가 다를 때만 별도 알림
            noti_reply = Notification(
                recipient_id=parent_comment.author_id,
                sender_id=current_user.id,
                type="reply",
                title="새 답글 알림",
                message=f"{current_user.name}님이 회원님의 댓글에 답글을 남겼습니다.",
                related_link=f"/community"
            )
            db.add(noti_reply)
            
    db.commit()
    db.refresh(new_comment)
    return new_comment

# 7. 댓글 삭제 (기존 유지)
@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글이 없습니다.")
    
    if comment.author_id != current_user.id:
        assert_roles(current_user, [Role.SUBCOACH, Role.COACH], "삭제 권한이 없습니다.")
        
    db.delete(comment)
    db.commit()
    return {"message": "댓글이 삭제되었습니다."}
