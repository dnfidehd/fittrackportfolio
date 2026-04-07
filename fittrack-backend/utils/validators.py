# fittrack-backend/utils/validators.py
# 검증 관련 유틸리티 함수들

from datetime import datetime, date
from typing import Union, Tuple
from fastapi import HTTPException


def parse_date(date_str: str) -> date:
    """
    문자열을 date 객체로 변환

    Args:
        date_str: 날짜 문자열 (형식: YYYY-MM-DD)

    Returns:
        date 객체

    Raises:
        HTTPException(400): 잘못된 형식
    """
    if not date_str:
        raise HTTPException(status_code=400, detail="날짜를 입력해주세요.")

    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"잘못된 날짜 형식입니다. (예: 2024-01-15)"
        )


def validate_date_range(
    start_date: Union[str, date],
    end_date: Union[str, date]
) -> Tuple[date, date]:
    """
    날짜 범위 검증

    Args:
        start_date: 시작 날짜
        end_date: 종료 날짜

    Returns:
        (시작 날짜, 종료 날짜) 튜플

    Raises:
        HTTPException(400): 검증 실패
    """
    # 문자열이면 date로 변환
    if isinstance(start_date, str):
        start_date = parse_date(start_date)
    if isinstance(end_date, str):
        end_date = parse_date(end_date)

    # 시작일이 종료일보다 뒤인지 확인
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="시작 날짜가 종료 날짜보다 뒤일 수 없습니다."
        )

    return start_date, end_date


def validate_positive_integer(value: int, field_name: str = "값") -> int:
    """양수 정수 검증"""
    if value <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name}은 0보다 커야 합니다."
        )
    return value


def validate_non_negative_integer(value: int, field_name: str = "값") -> int:
    """음이 아닌 정수 검증"""
    if value < 0:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name}은 음수일 수 없습니다."
        )
    return value


def validate_string_not_empty(value: str, field_name: str = "값") -> str:
    """비어있지 않은 문자열 검증"""
    if not value or not value.strip():
        raise HTTPException(
            status_code=400,
            detail=f"{field_name}을(를) 입력해주세요."
        )
    return value.strip()
