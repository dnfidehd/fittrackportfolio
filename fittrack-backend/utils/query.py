# fittrack-backend/utils/query.py
# 쿼리 관련 헬퍼 함수들

from sqlalchemy.orm import Query, Session
from sqlalchemy import and_
from datetime import datetime, date
from typing import Optional


def filter_by_gym(query: Query, model, gym_id: int) -> Query:
    """
    특정 체육관으로 쿼리 필터링

    Args:
        query: SQLAlchemy 쿼리
        model: 쿼리할 모델 클래스
        gym_id: 체육관 ID

    Returns:
        필터링된 쿼리
    """
    if hasattr(model, 'gym_id'):
        return query.filter(model.gym_id == gym_id)
    return query


def filter_active_members(query: Query, model) -> Query:
    """
    활성 회원만 필터링

    Args:
        query: SQLAlchemy 쿼리
        model: 회원 모델 클래스

    Returns:
        필터링된 쿼리
    """
    if hasattr(model, 'status'):
        return query.filter(model.status == "활성")
    return query


def filter_by_date_range(
    query: Query,
    model,
    date_field: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> Query:
    """
    날짜 범위로 필터링

    Args:
        query: SQLAlchemy 쿼리
        model: 쿼리할 모델 클래스
        date_field: 필터링할 날짜 필드명
        start_date: 시작 날짜 (선택사항)
        end_date: 종료 날짜 (선택사항)

    Returns:
        필터링된 쿼리
    """
    if not hasattr(model, date_field):
        return query

    field = getattr(model, date_field)

    if start_date and end_date:
        return query.filter(and_(field >= start_date, field <= end_date))
    elif start_date:
        return query.filter(field >= start_date)
    elif end_date:
        return query.filter(field <= end_date)

    return query


def filter_by_status(
    query: Query,
    model,
    status: str,
    status_field: str = "status"
) -> Query:
    """
    상태로 필터링

    Args:
        query: SQLAlchemy 쿼리
        model: 쿼리할 모델 클래스
        status: 필터링할 상태값
        status_field: 상태 필드명 (기본값: "status")

    Returns:
        필터링된 쿼리
    """
    if not hasattr(model, status_field):
        return query

    return query.filter(getattr(model, status_field) == status)


def filter_by_boolean(
    query: Query,
    model,
    field_name: str,
    value: bool
) -> Query:
    """
    불린 필드로 필터링

    Args:
        query: SQLAlchemy 쿼리
        model: 쿼리할 모델 클래스
        field_name: 필터링할 필드명
        value: 필터링할 값

    Returns:
        필터링된 쿼리
    """
    if not hasattr(model, field_name):
        return query

    return query.filter(getattr(model, field_name) == value)


def count_total(query: Query) -> int:
    """
    쿼리 결과의 전체 개수 반환 (LIMIT 전에 실행)

    Args:
        query: SQLAlchemy 쿼리

    Returns:
        전체 개수
    """
    return query.count()
