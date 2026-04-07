# fittrack-backend/utils/auth.py
# 권한 체크 관련 유틸리티 함수들

from fastapi import Depends, HTTPException
from constants import AuthMessages, Role
from security import get_current_user


def assert_roles(current_user, allowed_roles: list[str], detail: str = AuthMessages.NOT_AUTHORIZED):
    """허용된 역할인지 확인하고, 아니면 403 예외를 발생시킴"""
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=detail)
    return current_user


def require_superadmin(current_user=Depends(get_current_user)):
    """총관리자(superadmin) 권한 확인"""
    return assert_roles(current_user, [Role.SUPERADMIN], AuthMessages.SUPERADMIN_ONLY)


def require_admin(current_user=Depends(get_current_user)):
    """관리자(admin) 또는 총관리자(superadmin) 권한 확인"""
    return assert_roles(current_user, [Role.ADMIN, Role.SUPERADMIN], AuthMessages.ADMIN_ONLY)


def require_coach(current_user=Depends(get_current_user)):
    """코치(coach) 또는 총관리자(superadmin) 권한 확인"""
    return assert_roles(current_user, [Role.COACH, Role.SUPERADMIN], AuthMessages.COACH_ONLY)


def require_coach_or_subcoach(current_user=Depends(get_current_user)):
    """코치(coach) 또는 서브코치(subcoach) 권한 확인"""
    return assert_roles(
        current_user,
        [Role.COACH, Role.SUBCOACH],
        AuthMessages.COACH_ONLY,
    )


def require_admin_or_coach(current_user=Depends(get_current_user)):
    """관리자(admin), 코치(coach) 또는 총관리자(superadmin) 권한 확인"""
    return assert_roles(
        current_user,
        [Role.ADMIN, Role.COACH, Role.SUPERADMIN],
        AuthMessages.ADMIN_OR_COACH,
    )


def require_admin_or_coach_or_subcoach(current_user=Depends(get_current_user)):
    """관리자, 코치, 서브코치 또는 총관리자 권한 확인"""
    return assert_roles(
        current_user,
        [Role.ADMIN, Role.COACH, Role.SUPERADMIN, Role.SUBCOACH],
        AuthMessages.ADMIN_OR_COACH,
    )


def check_gym_access(current_user, gym_id: int):
    """사용자가 특정 체육관에 접근 권한이 있는지 확인"""
    if current_user.role == Role.SUPERADMIN:
        # 총관리자는 모든 체육관 접근 가능
        return True
    if current_user.gym_id == gym_id:
        # 해당 체육관의 사용자면 접근 가능
        return True
    return False


def assert_gym_access(current_user, gym_id: int):
    """체육관 접근 권한 확인 (없으면 예외 발생)"""
    if not check_gym_access(current_user, gym_id):
        raise HTTPException(status_code=403, detail=AuthMessages.GYM_ACCESS_DENIED)
