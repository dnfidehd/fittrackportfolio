# fittrack-backend/schemas/community.py
# Community (Post, Comment) related schemas

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    post_id: int
    author_id: int
    author_name: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PostCreate(BaseModel):
    board_type: str
    title: str
    content: str
    is_popup: bool = False
    popup_expires_at: Optional[datetime] = None


class PostResponse(BaseModel):
    id: int
    board_type: str
    title: str
    content: str
    author_id: int
    author_name: str
    created_at: datetime
    views: int
    is_popup: bool
    popup_expires_at: Optional[datetime] = None
    comments: List[CommentResponse] = []
    model_config = ConfigDict(from_attributes=True)
