# models/community.py
# Post and Comment models

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, backref
from database import Base
from datetime import datetime


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    board_type = Column(String, index=True, default="free")
    title = Column(String, index=True)
    content = Column(Text)

    author_id = Column(Integer, ForeignKey("members.id"))
    author_name = Column(String)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=True)

    image_url = Column(String, nullable=True)
    region = Column(String, nullable=True) # ✅ [신규] 지역별 필터링용
    market_status = Column(String, default="판매중")
    youtube_url = Column(String, nullable=True)
    wod_record = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.now)
    views = Column(Integer, default=0)

    # ✅ [신규] 팝업 공지 관련 필드
    is_popup = Column(Boolean, default=False)
    popup_expires_at = Column(DateTime, nullable=True)

    author = relationship("Member", back_populates="posts")
    gym = relationship("Gym", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"))
    author_id = Column(Integer, ForeignKey("members.id"))
    author_name = Column(String)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True)
    post = relationship("Post", back_populates="comments")
    author = relationship("Member", back_populates="comments")
    replies = relationship(
        "Comment",
        backref=backref('parent', remote_side=[id]),
        cascade="all, delete"
    )


class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"))
    member_id = Column(Integer, ForeignKey("members.id"))
