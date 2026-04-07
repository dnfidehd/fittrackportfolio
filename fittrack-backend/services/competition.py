# fittrack-backend/services/competition.py
# 대회 관련 비즈니스 로직

from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional, Tuple
from datetime import datetime

from models import Competition, CompetitionGym, CompetitionRegistration, Member, CompetitionEvent, CompetitionScore
from schemas import CompetitionResponse
from utils.helpers import parse_score, anonymize_name
from utils.errors import get_or_404
from .base import BaseService


class CompetitionService(BaseService[Competition]):
    """대회 관련 비즈니스 로직 서비스"""

    def __init__(self, db: Session):
        super().__init__(Competition, db)

    def get_visible_competitions_for_user(self, user: Member) -> List[Competition]:
        """
        사용자가 볼 수 있는 대회 목록 조회

        Args:
            user: 현재 사용자

        Returns:
            사용자가 접근 가능한 대회 목록
        """
        all_comps = self.db.query(Competition).order_by(Competition.start_date.desc()).all()

        # 총관리자와 관리자는 모든 대회 볼 수 있음
        if user.role in ['superadmin', 'admin']:
            return all_comps

        # 일반 사용자는 공개 대회 + 자신의 박스가 참여 중인 비공개 대회만
        visible_comps = []
        for comp in all_comps:
            # 공개 대회면 무조건 추가
            if not comp.is_private:
                visible_comps.append(comp)
                continue

            # 비공개 대회인 경우, 자신의 박스가 참여 중인지 확인
            if user.gym_id:
                is_participating = self.db.query(CompetitionGym).filter(
                    CompetitionGym.competition_id == comp.id,
                    CompetitionGym.gym_id == user.gym_id
                ).first()

                if is_participating:
                    visible_comps.append(comp)

        return visible_comps

    def enrich_with_admins(self, comp: Competition) -> dict:
        """
        대회 정보에 관리자/코치 이름 추가

        Args:
            comp: 대회 객체

        Returns:
            관리자 이름이 추가된 대회 딕셔너리
        """
        comp_dict = CompetitionResponse.model_validate(comp).model_dump()

        # 참여 중인 박스들의 관리자/코치 목록 조회
        gym_ids = [g.gym_id for g in comp.participating_gyms if g.status == 'accepted']

        if gym_ids:
            admins = self.db.query(Member.name).filter(
                Member.gym_id.in_(gym_ids),
                Member.role.in_(['subcoach', 'coach', 'admin', 'superadmin'])
            ).all()
            comp_dict['admin_names'] = [a[0] for a in admins]
        else:
            comp_dict['admin_names'] = []

        return comp_dict

    def add_host_gym(self, competition_id: int, gym_id: int) -> CompetitionGym:
        """호스트 박스를 대회에 등록"""
        host_gym = CompetitionGym(
            competition_id=competition_id,
            gym_id=gym_id,
            status="accepted"
        )
        self.db.add(host_gym)
        self.db.commit()
        return host_gym

    def add_invited_gyms(self, competition_id: int, gym_ids: List[int], host_gym_id: Optional[int] = None):
        """초대 박스들을 대회에 등록"""
        if not gym_ids:
            return

        for gid in gym_ids:
            # 호스트 박스는 이미 등록되어 있으므로 스킵
            if host_gym_id and gid == host_gym_id:
                continue

            # 중복 체크
            exists = self.db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == competition_id,
                CompetitionGym.gym_id == gid
            ).first()

            if not exists:
                invited_gym = CompetitionGym(
                    competition_id=competition_id,
                    gym_id=gid,
                    status="accepted"
                )
                self.db.add(invited_gym)

        self.db.commit()

    def get_pending_registration_count_for_user(self, user: Member) -> Tuple[int, dict]:
        """
        사용자가 승인해야 할 대회 참가 신청 건수

        Args:
            user: 현재 사용자

        Returns:
            (전체 건수, {대회ID: 건수} 딕셔너리)
        """
        # 사용자가 볼 수 있는 대회 ID 조회
        target_comp_ids = []

        if user.role == 'superadmin':
            # 총관리자: 모든 대회
            target_comp_ids = [c.id for c in self.db.query(Competition.id).all()]
        else:
            # 일반 관리자/코치: 생성한 대회 + 공개 대회 + 참여 중인 대회
            all_comps = self.db.query(Competition).all()

            for comp in all_comps:
                # 내가 생성한 대회
                if comp.creator_id == user.id:
                    target_comp_ids.append(comp.id)
                    continue

                # 공개 대회
                if not comp.is_private:
                    target_comp_ids.append(comp.id)
                    continue

                # 내 박스가 참여 중인 대회
                if user.gym_id:
                    is_participating = self.db.query(CompetitionGym).filter(
                        CompetitionGym.competition_id == comp.id,
                        CompetitionGym.gym_id == user.gym_id
                    ).first()
                    if is_participating:
                        target_comp_ids.append(comp.id)

        if not target_comp_ids:
            return 0, {}

        # Pending 참가 신청 건수 조회
        query = self.db.query(
            CompetitionRegistration.competition_id,
            func.count(CompetitionRegistration.id).label("count")
        ).filter(
            CompetitionRegistration.competition_id.in_(target_comp_ids),
            CompetitionRegistration.status == 'pending'
        )

        # 슈퍼관리자가 아닌 경우 추가 필터링
        if user.role != 'superadmin':
            query = query.join(Member, CompetitionRegistration.member_id == Member.id)
            query = query.join(
                Competition,
                CompetitionRegistration.competition_id == Competition.id
            )
            query = query.filter(
                or_(
                    Competition.creator_id == user.id,
                    Member.gym_id == user.gym_id
                )
            )

        pending_counts = query.group_by(CompetitionRegistration.competition_id).all()

        comp_counts = {pc.competition_id: pc.count for pc in pending_counts}
        total_pending = sum(comp_counts.values())

        return total_pending, comp_counts

    def parse_and_validate_score(self, score_str: str, score_type: str) -> float:
        """
        점수 문자열 파싱 및 검증

        Args:
            score_str: 점수 문자열
            score_type: 점수 유형 (time, weight, reps)

        Returns:
            파싱된 점수
        """
        return parse_score(score_str, score_type)

    def anonymize_leaderboard_if_needed(self, comp: Competition, leaderboard: List[dict]) -> List[dict]:
        """
        필요시 리더보드에서 이름 익명화

        Args:
            comp: 대회 객체
            leaderboard: 리더보드 데이터

        Returns:
            처리된 리더보드
        """
        if not comp.anonymize_for_all:
            return leaderboard

        for item in leaderboard:
            if 'member_name' in item:
                item['member_name'] = anonymize_name(item['member_name'])

        return leaderboard

    def is_competition_accessible(self, comp: Competition, user: Member) -> bool:
        """
        사용자가 대회에 접근 가능한지 확인

        Args:
            comp: 대회 객체
            user: 사용자 객체

        Returns:
            접근 가능 여부
        """
        # 공개 대회
        if not comp.is_private:
            return True

        # 총관리자
        if user.role == 'superadmin':
            return True

        # 대회 생성자
        if comp.creator_id == user.id:
            return True

        # 박스가 참여 중인 경우
        if user.gym_id:
            is_participating = self.db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == comp.id,
                CompetitionGym.gym_id == user.gym_id
            ).first()
            if is_participating:
                return True

        return False
