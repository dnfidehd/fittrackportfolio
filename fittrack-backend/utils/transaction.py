# fittrack-backend/utils/transaction.py
# 트랜잭션 관련 유틸리티 및 데코레이터

from functools import wraps
from typing import Callable, Any
from sqlalchemy.orm import Session
from sqlalchemy import event
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger(__name__)


def transactional(func: Callable) -> Callable:
    """
    함수를 트랜잭션으로 감싸는 데코레이터

    Usage:
        @transactional
        def critical_operation(db: Session):
            # DB 작업 수행
            # 예외 발생시 자동 롤백
            pass

    Note:
        - db 파라미터는 Session 타입이어야 함
        - 모든 DB 작업이 성공해야 커밋됨 (All or Nothing)
        - 예외 발생시 자동 롤백
    """

    @wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        # kwargs에서 db 세션 찾기
        db: Session = kwargs.get('db')

        if db is None:
            # 위치 인자에서 Session 타입 찾기
            for arg in args:
                if isinstance(arg, Session):
                    db = arg
                    break

        if db is None:
            raise ValueError(
                f"@transactional decorator requires a 'db' parameter of type Session"
            )

        try:
            result = func(*args, **kwargs)
            db.commit()
            logger.info(f"✓ Transaction committed: {func.__name__}")
            return result

        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"✗ Transaction rolled back: {func.__name__} - {str(e)}")
            raise

        except Exception as e:
            db.rollback()
            logger.error(f"✗ Transaction rolled back: {func.__name__} - {str(e)}")
            raise

    return wrapper


class TransactionContext:
    """
    Context manager for database transactions

    Usage:
        with TransactionContext(db) as tx:
            # 여러 작업 수행
            # 예외 발생시 자동 롤백
            pass
    """

    def __init__(self, db: Session):
        self.db = db
        self.is_committed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            # 예외 발생시 롤백
            self.db.rollback()
            logger.error(f"Transaction rolled back due to: {exc_val}")
            return False  # 예외를 re-raise

        if not self.is_committed:
            # 정상 종료시 커밋
            try:
                self.db.commit()
                self.is_committed = True
                logger.info("✓ Transaction committed")
            except SQLAlchemyError as e:
                self.db.rollback()
                logger.error(f"Transaction commit failed: {str(e)}")
                raise

        return True

    def commit(self):
        """명시적 커밋"""
        if not self.is_committed:
            self.db.commit()
            self.is_committed = True
            logger.info("✓ Transaction committed explicitly")

    def rollback(self):
        """명시적 롤백"""
        self.db.rollback()
        logger.warning("⚠ Transaction rolled back explicitly")


def with_transaction(db: Session):
    """
    Context manager를 위한 헬퍼 함수

    Usage:
        def operation(db: Session):
            with with_transaction(db) as tx:
                # DB 작업 수행
                pass
    """
    return TransactionContext(db)


class SavePoint:
    """
    Savepoint 관리 (부분 롤백)

    Usage:
        savepoint = SavePoint(db)
        savepoint.create("my_savepoint")
        try:
            # 작업 수행
            pass
        except:
            savepoint.rollback("my_savepoint")  # 부분 롤백
    """

    def __init__(self, db: Session):
        self.db = db
        self.savepoints = {}

    def create(self, name: str) -> str:
        """Savepoint 생성"""
        sp = self.db.begin_nested()
        self.savepoints[name] = sp
        logger.info(f"✓ Savepoint created: {name}")
        return name

    def rollback(self, name: str):
        """특정 Savepoint로 롤백"""
        if name not in self.savepoints:
            raise ValueError(f"Savepoint '{name}' does not exist")

        sp = self.savepoints[name]
        sp.rollback()
        del self.savepoints[name]
        logger.info(f"⚠ Rolled back to savepoint: {name}")

    def commit(self, name: str):
        """특정 Savepoint 커밋"""
        if name not in self.savepoints:
            raise ValueError(f"Savepoint '{name}' does not exist")

        sp = self.savepoints[name]
        sp.commit()
        del self.savepoints[name]
        logger.info(f"✓ Savepoint committed: {name}")


class TransactionLogger:
    """
    트랜잭션 로깅 (디버깅용)

    Usage:
        logger = TransactionLogger(db)
        logger.log_all_statements()
        # 모든 SQL 문장이 로깅됨
    """

    def __init__(self, db: Session):
        self.db = db
        self.statements = []

    def log_all_statements(self):
        """모든 SQL 문장 로깅"""
        @event.listens_for(self.db.get_bind(), "before_cursor_execute")
        def receive_before_cursor_execute(conn, cursor, statement, params, context, executemany):
            self.statements.append({
                "statement": statement,
                "params": params,
                "type": "execute"
            })
            logger.debug(f"SQL: {statement}")
            logger.debug(f"PARAMS: {params}")

    def get_statements(self):
        """기록된 모든 문장 반환"""
        return self.statements

    def clear(self):
        """기록 초기화"""
        self.statements = []


# 흔한 트랜잭션 패턴들

def atomic_update(db: Session, model, filters: dict, updates: dict):
    """
    원자적 업데이트 (All or Nothing)

    Usage:
        atomic_update(
            db,
            Member,
            {"id": 1},
            {"name": "New Name"}
        )
    """
    with with_transaction(db):
        obj = db.query(model).filter_by(**filters).first()
        if not obj:
            raise ValueError(f"Object not found with filters: {filters}")

        for key, value in updates.items():
            setattr(obj, key, value)
        db.add(obj)


def atomic_bulk_update(db: Session, model, records: list):
    """
    여러 레코드 원자적 업데이트

    Usage:
        atomic_bulk_update(db, Member, [
            {"id": 1, "name": "Name1"},
            {"id": 2, "name": "Name2"},
        ])
    """
    with with_transaction(db):
        for record in records:
            obj = db.query(model).filter_by(id=record["id"]).first()
            if obj:
                for key, value in record.items():
                    if key != "id":
                        setattr(obj, key, value)
                db.add(obj)


def atomic_delete_cascade(db: Session, model, filters: dict):
    """
    원자적 삭제 (관련 레코드도 함께 삭제)

    Usage:
        atomic_delete_cascade(db, Member, {"id": 1})
    """
    with with_transaction(db):
        query = db.query(model)
        for key, value in filters.items():
            query = query.filter(getattr(model, key) == value)
        query.delete()


# 트랜잭션 상태 확인

def is_in_transaction(db: Session) -> bool:
    """현재 트랜잭션 진행 중인지 확인"""
    return db.in_transaction()


def get_transaction_status(db: Session) -> dict:
    """트랜잭션 상태 조회"""
    return {
        "in_transaction": db.in_transaction(),
        "is_modified": bool(db.dirty | db.new | db.deleted),
        "dirty_count": len(db.dirty),
        "new_count": len(db.new),
        "deleted_count": len(db.deleted),
    }
