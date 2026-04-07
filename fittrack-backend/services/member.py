# fittrack-backend/services/member.py
# 회원 관련 비즈니스 로직

from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional, Tuple
from datetime import date, datetime
import re

from models import Member, Sale, WodRecord, MembershipHold
from .base import BaseService


class MemberService(BaseService[Member]):
    """회원 관련 비즈니스 로직 서비스"""

    def __init__(self, db: Session):
        super().__init__(Member, db)

    def get_members_by_gym(
        self,
        gym_id: int,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        status: Optional[str] = None,
        gender: Optional[str] = None,
        sort: str = "name",
        role: str = "user"
    ) -> Tuple[List[Member], int]:
        """
        특정 박스의 회원 목록을 필터링, 정렬, 페이징하여 조회

        Args:
            gym_id: 박스 ID
            skip: 스킵할 항목 수
            limit: 반환할 최대 항목 수
            search: 검색어 (이름, 전화번호)
            status: 회원 상태 (활성, 만료, 일시정지)
            gender: 성별
            sort: 정렬 방식 (name: 자연정렬, expiry: 만료일순)
            role: 회원 역할 (user, coach, etc.)

        Returns:
            (회원 리스트, 전체 개수)
        """
        query = self.db.query(Member).filter(
            Member.gym_id == gym_id,
            Member.role == role
        )

        # 검색 필터
        if search:
            search_fmt = f"%{search}%"
            query = query.filter(
                or_(
                    Member.name.like(search_fmt),
                    Member.phone.like(search_fmt)
                )
            )

        # 상태 필터
        if status and status != "all":
            query = query.filter(Member.status == status)

        # 성별 필터
        if gender and gender != "all":
            query = query.filter(Member.gender == gender)

        # 정렬
        if sort == "expiry":
            # DB 레벨 정렬
            query = query.filter(Member.end_date != None).order_by(Member.end_date.asc())
            total = query.count()
            members = query.offset(skip).limit(limit).all()
        else:
            # 자연정렬 (이름순)
            # 현재는 전체 데이터 로드 후 Python에서 정렬
            # TODO: DB 레벨 자연정렬로 개선 필요
            all_members = query.all()
            total = len(all_members)

            # Natural Sort
            all_members.sort(key=self._natural_key)

            # Python 리스트 슬라이싱으로 페이징
            members = all_members[skip:skip + limit]

        return members, total

    def _natural_key(self, member: Member) -> list:
        """자연 정렬용 키 생성 함수"""
        return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', member.name)]

    def update_member_name_cascade(self, member_id: int, new_name: str) -> Member:
        """
        회원 이름 변경 (관련 테이블 모두 업데이트 - 트랜잭션)

        Args:
            member_id: 회원 ID
            new_name: 새로운 이름

        Returns:
            업데이트된 회원 객체

        Note:
            이 함수는 원자적으로(all or nothing) 실행되어야 합니다.
            현재는 구현만 하고, Phase 5에서 @transactional 데코레이터를 추가합니다.
        """
        try:
            member = self.get_by_id(member_id)

            # 1. 회원 이름 업데이트
            member.name = new_name
            self.db.add(member)

            # 2. 관련 테이블 업데이트
            # - Sales 테이블의 sale_by_name
            sales = self.db.query(Sale).filter(Sale.sold_by == member.name).all()
            for sale in sales:
                sale.sold_by = new_name
                self.db.add(sale)

            # - WodRecord의 멤버 참조는 FK로 연결되어 있으므로 자동 반영

            # - MembershipHold의 멤버 참조는 FK로 연결되어 있으므로 자동 반영

            # 모든 변경 사항 커밋
            self.db.commit()
            self.db.refresh(member)

            return member

        except Exception as e:
            self.db.rollback()
            raise e

    def is_active(self, member: Member) -> bool:
        """회원이 활성 상태인지 확인"""
        return member.status == "활성"

    def is_expired(self, member: Member) -> bool:
        """회원이 만료 상태인지 확인"""
        return member.status == "만료"

    def get_by_phone(self, phone: str, gym_id: Optional[int] = None) -> Optional[Member]:
        """
        전화번호로 회원 조회

        Args:
            phone: 전화번호
            gym_id: 박스 ID (선택사항)

        Returns:
            회원 객체 또는 None
        """
        query = self.db.query(Member).filter(Member.phone == phone)

        if gym_id:
            query = query.filter(Member.gym_id == gym_id)

        return query.first()

    def get_active_members_by_gym(self, gym_id: int) -> List[Member]:
        """특정 박스의 활성 회원 목록 조회"""
        return self.db.query(Member).filter(
            Member.gym_id == gym_id,
            Member.status == "활성",
            Member.role == "user"
        ).all()

    def get_coaches_by_gym(self, gym_id: int) -> List[Member]:
        """특정 박스의 코치/관리자 목록 조회"""
        return self.db.query(Member).filter(
            Member.gym_id == gym_id,
            Member.role.in_(["coach", "subcoach", "admin"])
        ).all()

    def count_active_members_by_gym(self, gym_id: int) -> int:
        """특정 박스의 활성 회원 수"""
        return self.db.query(Member).filter(
            Member.gym_id == gym_id,
            Member.status == "활성",
            Member.role == "user"
        ).count()

    def search_members(
        self,
        gym_id: int,
        query_str: str,
        limit: int = 20
    ) -> List[Member]:
        """
        회원 검색 (이름 또는 전화번호)

        Args:
            gym_id: 박스 ID
            query_str: 검색어
            limit: 최대 결과 개수

        Returns:
            검색 결과 회원 목록
        """
        search_fmt = f"%{query_str}%"
        return self.db.query(Member).filter(
            Member.gym_id == gym_id,
            Member.role == "user",
            or_(
                Member.name.like(search_fmt),
                Member.phone.like(search_fmt)
            )
        ).limit(limit).all()
