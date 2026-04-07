# fittrack-backend/utils/pagination.py
# 페이징 관련 유틸리티 함수

from typing import List, TypeVar, Generic, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Query
from math import ceil

ModelType = TypeVar('ModelType')


class PaginationParams:
    """페이징 파라미터"""
    def __init__(self, skip: int = 0, limit: int = 50):
        """
        Args:
            skip: 스킵할 항목 수 (기본값: 0)
            limit: 반환할 최대 항목 수 (기본값: 50)
        """
        self.skip = max(0, skip)
        self.limit = max(1, min(limit, 1000))  # 최대 1000까지

    def get_offset(self) -> int:
        """오프셋 반환"""
        return self.skip

    def get_limit(self) -> int:
        """리밋 반환"""
        return self.limit


class PaginatedResponse(BaseModel):
    """페이징된 응답 구조"""
    total: int
    skip: int
    limit: int
    items: List


def paginate(
    query: Query,
    skip: int = 0,
    limit: int = 50
) -> tuple[List, int]:
    """
    쿼리 결과를 페이징

    Args:
        query: SQLAlchemy 쿼리 객체
        skip: 스킵할 항목 수
        limit: 반환할 최대 항목 수

    Returns:
        (아이템 리스트, 전체 개수) 튜플
    """
    params = PaginationParams(skip=skip, limit=limit)

    # 전체 개수 계산 (COUNT 쿼리 실행 전에 LIMIT 제거)
    total = query.count()

    # 결과 조회
    items = query.offset(params.get_offset()).limit(params.get_limit()).all()

    return items, total


def paginate_with_response(
    query: Query,
    skip: int = 0,
    limit: int = 50,
    response_model=None
) -> dict:
    """
    페이징 결과를 응답 딕셔너리로 반환

    Args:
        query: SQLAlchemy 쿼리 객체
        skip: 스킵할 항목 수
        limit: 반환할 최대 항목 수
        response_model: 응답 모델 (선택사항)

    Returns:
        페이징된 응답 딕셔너리
    """
    items, total = paginate(query, skip, limit)

    # 응답 모델이 있으면 변환
    if response_model:
        items = [response_model.from_orm(item) for item in items]

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": items
    }


def get_page_info(total: int, skip: int, limit: int) -> dict:
    """페이징 정보 생성"""
    total_pages = ceil(total / limit) if limit > 0 else 1
    current_page = (skip // limit) + 1 if limit > 0 else 1

    return {
        "total": total,
        "page": current_page,
        "total_pages": total_pages,
        "skip": skip,
        "limit": limit,
        "has_next": current_page < total_pages,
        "has_previous": current_page > 1
    }
