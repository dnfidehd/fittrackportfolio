# fittrack-backend/services/base.py
# 기본 Service 클래스 (CRUD 패턴)

from typing import TypeVar, Generic, List, Optional, Type
from sqlalchemy.orm import Session
from sqlalchemy import and_
from utils.errors import get_or_404

ModelType = TypeVar('ModelType')


class BaseService(Generic[ModelType]):
    """
    기본 CRUD 서비스 클래스

    모든 서비스가 상속받아 공통 CRUD 작업을 수행합니다.
    """

    def __init__(self, model: Type[ModelType], db: Session):
        """
        Args:
            model: SQLAlchemy 모델 클래스
            db: 데이터베이스 세션
        """
        self.model = model
        self.db = db

    def create(self, obj_in: dict) -> ModelType:
        """새로운 객체 생성"""
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def get_by_id(self, obj_id: int) -> ModelType:
        """ID로 객체 조회 (없으면 404 에러)"""
        obj = self.db.query(self.model).filter(self.model.id == obj_id).first()
        if not obj:
            raise get_or_404(self.db, self.model, id=obj_id)
        return obj

    def get_by_filters(self, **filters) -> Optional[ModelType]:
        """필터 조건으로 객체 조회 (첫 번째만)"""
        query = self.db.query(self.model)
        for key, value in filters.items():
            if hasattr(self.model, key):
                query = query.filter(getattr(self.model, key) == value)
        return query.first()

    def list(
        self,
        skip: int = 0,
        limit: int = 50,
        **filters
    ) -> tuple[List[ModelType], int]:
        """페이징과 필터링을 포함한 목록 조회"""
        query = self.db.query(self.model)

        # 필터 적용
        for key, value in filters.items():
            if hasattr(self.model, key) and value is not None:
                query = query.filter(getattr(self.model, key) == value)

        # 전체 개수
        total = query.count()

        # 페이징
        items = query.offset(skip).limit(limit).all()

        return items, total

    def update(self, obj_id: int, obj_in: dict) -> ModelType:
        """객체 업데이트"""
        db_obj = self.get_by_id(obj_id)

        for key, value in obj_in.items():
            if hasattr(db_obj, key):
                setattr(db_obj, key, value)

        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, obj_id: int) -> bool:
        """객체 삭제"""
        db_obj = self.get_by_id(obj_id)
        self.db.delete(db_obj)
        self.db.commit()
        return True

    def delete_by_filter(self, **filters) -> int:
        """필터 조건으로 객체 삭제"""
        query = self.db.query(self.model)
        for key, value in filters.items():
            if hasattr(self.model, key):
                query = query.filter(getattr(self.model, key) == value)

        count = query.count()
        query.delete()
        self.db.commit()
        return count

    def exists(self, **filters) -> bool:
        """조건에 맞는 객체 존재 여부 확인"""
        query = self.db.query(self.model)
        for key, value in filters.items():
            if hasattr(self.model, key):
                query = query.filter(getattr(self.model, key) == value)
        return query.first() is not None

    def count(self, **filters) -> int:
        """조건에 맞는 객체 개수"""
        query = self.db.query(self.model)
        for key, value in filters.items():
            if hasattr(self.model, key) and value is not None:
                query = query.filter(getattr(self.model, key) == value)
        return query.count()
