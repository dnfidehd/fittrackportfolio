# fittrack-backend/utils/errors.py
# 에러 처리 유틸리티

from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import Type, TypeVar, Optional

ModelType = TypeVar('ModelType')


def get_or_404(db: Session, model: Type[ModelType], **filters) -> ModelType:
    """
    데이터베이스에서 객체를 가져오거나 없으면 404 에러 반환

    Args:
        db: 데이터베이스 세션
        model: SQLAlchemy 모델 클래스
        **filters: 필터 조건 (예: id=1, name="test")

    Returns:
        찾은 모델 인스턴스

    Raises:
        HTTPException(404): 객체를 찾을 수 없을 경우
    """
    query = db.query(model)
    for key, value in filters.items():
        if hasattr(model, key):
            query = query.filter(getattr(model, key) == value)

    obj = query.first()
    if not obj:
        model_name = model.__name__
        raise HTTPException(status_code=404, detail=f"{model_name}을(를) 찾을 수 없습니다.")
    return obj


def not_found_error(message: str = "요청하신 리소스를 찾을 수 없습니다."):
    """404 에러 발생"""
    raise HTTPException(status_code=404, detail=message)


def forbidden_error(message: str = "접근 권한이 없습니다."):
    """403 에러 발생"""
    raise HTTPException(status_code=403, detail=message)


def bad_request_error(message: str = "잘못된 요청입니다."):
    """400 에러 발생"""
    raise HTTPException(status_code=400, detail=message)


def conflict_error(message: str = "충돌이 발생했습니다."):
    """409 에러 발생"""
    raise HTTPException(status_code=409, detail=message)
