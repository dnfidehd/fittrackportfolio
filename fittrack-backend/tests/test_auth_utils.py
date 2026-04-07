from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from constants import AuthMessages, Role
from utils.auth import assert_roles, check_gym_access


def test_assert_roles_allows_permitted_role():
    user = SimpleNamespace(role=Role.COACH, gym_id=1)
    result = assert_roles(user, [Role.COACH, Role.SUBCOACH], AuthMessages.COACH_ONLY)
    assert result is user


def test_assert_roles_blocks_unpermitted_role():
    user = SimpleNamespace(role=Role.USER, gym_id=1)

    with pytest.raises(HTTPException) as exc_info:
        assert_roles(user, [Role.COACH, Role.SUBCOACH], AuthMessages.COACH_ONLY)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == AuthMessages.COACH_ONLY


def test_check_gym_access_allows_superadmin_any_gym():
    user = SimpleNamespace(role=Role.SUPERADMIN, gym_id=None)
    assert check_gym_access(user, 999) is True


def test_check_gym_access_blocks_other_gym_for_non_superadmin():
    user = SimpleNamespace(role=Role.COACH, gym_id=1)
    assert check_gym_access(user, 2) is False
