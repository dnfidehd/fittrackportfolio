from pathlib import Path
import sys
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

import models  # noqa: F401 - ensure SQLAlchemy models are registered
from database import Base, get_db
from models import ClassSchedule, Competition, CompetitionEvent, CompetitionScore, Gym, Member, MembershipProduct
from routers import attendance, auth, classes, competitions, notifications, work_schedules, dropin, sales
from security import get_password_hash


SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
    app.include_router(classes.router, prefix="/api/classes", tags=["Classes"])
    app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
    app.include_router(competitions.router, prefix="/api/competitions", tags=["Competitions"])
    app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
    app.include_router(work_schedules.router, prefix="/api/work-schedules", tags=["WorkSchedules"])
    app.include_router(dropin.router)
    app.include_router(sales.router, prefix="/api/sales", tags=["Sales"])
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def seed_gym_and_members():
    db = TestingSessionLocal()
    try:
        gym = Gym(name="테스트짐", location="대전")
        db.add(gym)
        db.flush()

        user = Member(
            phone="010-1234-5678",
            name="일반회원",
            hashed_password=get_password_hash("pass1234"),
            role="user",
            gym_id=gym.id,
            must_change_password=False,
            status="활성",
        )
        coach = Member(
            phone="010-9999-8888",
            name="코치회원",
            hashed_password=get_password_hash("coach1234"),
            role="coach",
            gym_id=gym.id,
            must_change_password=False,
            status="활성",
        )
        db.add_all([user, coach])
        db.commit()
        db.refresh(user)
        db.refresh(coach)
        db.refresh(gym)
        return gym, user, coach
    finally:
        db.close()


def login_and_get_headers(client: TestClient, phone: str, password: str):
    response = client.post(
        "/api/auth/login",
        data={"username": phone, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_login_returns_token_for_valid_member(client: TestClient):
    seed_gym_and_members()

    response = client.post(
        "/api/auth/login",
        data={"username": "01012345678", "password": "pass1234"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert "access_token" in payload


def test_member_can_reserve_class_after_login(client: TestClient):
    gym, user, _coach = seed_gym_and_members()

    db = TestingSessionLocal()
    try:
        class_schedule = ClassSchedule(
            gym_id=gym.id,
            title="오전 클래스",
            date=date.today(),
            time="09:00",
            max_participants=12,
            status="open",
        )
        db.add(class_schedule)
        db.commit()
        db.refresh(class_schedule)
        schedule_id = class_schedule.id
    finally:
        db.close()

    headers = login_and_get_headers(client, user.phone, "pass1234")
    response = client.post(f"/api/classes/{schedule_id}/reserve", headers=headers)

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["member_id"] == user.id
    assert payload["member_name"] == user.name
    assert payload["status"] == "reserved"


def test_member_can_cancel_reserved_class(client: TestClient):
    gym, user, _coach = seed_gym_and_members()

    db = TestingSessionLocal()
    try:
        class_schedule = ClassSchedule(
            gym_id=gym.id,
            title="저녁 클래스",
            date=date.today(),
            time="19:00",
            max_participants=12,
            status="open",
        )
        db.add(class_schedule)
        db.commit()
        db.refresh(class_schedule)
        schedule_id = class_schedule.id
    finally:
        db.close()

    headers = login_and_get_headers(client, user.phone, "pass1234")
    reserve_response = client.post(f"/api/classes/{schedule_id}/reserve", headers=headers)
    assert reserve_response.status_code == 200, reserve_response.text

    cancel_response = client.delete(f"/api/classes/{schedule_id}/reserve", headers=headers)
    assert cancel_response.status_code == 200, cancel_response.text
    assert cancel_response.json()["message"] == "Reservation cancelled"


def test_guest_verify_returns_competition_and_events(client: TestClient):
    db = TestingSessionLocal()
    try:
        competition = Competition(
            title="오픈 테스트전",
            description="게스트 테스트용",
            start_date="2026-03-01",
            end_date="2026-03-31",
            is_active=True,
            guest_passcode="2468",
        )
        db.add(competition)
        db.flush()

        event = CompetitionEvent(
            competition_id=competition.id,
            title="26.1",
            description="For time",
            score_type="time",
        )
        db.add(event)
        db.commit()
        db.refresh(competition)
    finally:
        db.close()

    response = client.post(
        "/api/competitions/guest/verify",
        json={"competition_id": competition.id, "passcode": "2468"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["competition"]["id"] == competition.id
    assert len(payload["events"]) == 1
    assert payload["events"][0]["title"] == "26.1"


def test_guest_can_submit_score_and_view_guest_leaderboard(client: TestClient):
    db = TestingSessionLocal()
    try:
        competition = Competition(
            title="게스트 리더보드 테스트전",
            description="점수 제출 테스트",
            start_date="2026-03-01",
            end_date="2026-03-31",
            is_active=True,
            guest_passcode="1357",
            show_leaderboard_to_all=True,
        )
        db.add(competition)
        db.flush()

        event = CompetitionEvent(
            competition_id=competition.id,
            title="26.2",
            description="For time",
            score_type="time",
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        event_id = event.id
    finally:
        db.close()

    submit_response = client.post(
        f"/api/competitions/guest/scores?event_id={event_id}",
        json={
            "member_name": "게스트참가자",
            "score_value": "09:21",
            "is_rx": True,
            "scale_rank": None,
            "is_time_cap": False,
            "tie_break": None,
            "note": "테스트 제출",
            "guest_gender": "F",
            "guest_phone": "010-7777-8888",
            "guest_gym": "테스트짐",
        },
    )

    assert submit_response.status_code == 200, submit_response.text
    assert submit_response.json()["status"] == "success"

    leaderboard_response = client.get(
        f"/api/competitions/events/{event_id}/leaderboard?is_guest_viewer=true"
    )

    assert leaderboard_response.status_code == 200, leaderboard_response.text
    payload = leaderboard_response.json()
    assert len(payload) == 1
    assert payload[0]["member_name"] == "게스트참가자"
    assert payload[0]["score_value"] == "09:21"
    assert payload[0]["guest_phone"] == "010-7777-8888"


def test_attendance_today_requires_coach_or_subcoach(client: TestClient):
    _gym, user, coach = seed_gym_and_members()

    member_headers = login_and_get_headers(client, user.phone, "pass1234")
    coach_headers = login_and_get_headers(client, coach.phone, "coach1234")

    forbidden_response = client.get("/api/attendance/today", headers=member_headers)
    assert forbidden_response.status_code == 403

    allowed_response = client.get("/api/attendance/today", headers=coach_headers)
    assert allowed_response.status_code == 200


def test_notification_broadcast_requires_staff_role(client: TestClient):
    _gym, user, _coach = seed_gym_and_members()
    member_headers = login_and_get_headers(client, user.phone, "pass1234")

    response = client.post(
        "/api/notifications/broadcast",
        json={"title": "공지", "message": "회원 공지 테스트"},
        headers=member_headers,
    )

    assert response.status_code == 403


def test_coach_can_broadcast_notification_to_active_members(client: TestClient):
    _gym, _user, coach = seed_gym_and_members()
    coach_headers = login_and_get_headers(client, coach.phone, "coach1234")

    response = client.post(
        "/api/notifications/broadcast",
        json={"title": "공지", "message": "회원 공지 테스트"},
        headers=coach_headers,
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["count"] == 2


def test_member_can_read_monthly_work_schedules_for_own_gym(client: TestClient):
    gym, user, coach = seed_gym_and_members()

    db = TestingSessionLocal()
    try:
        db.add(
            models.WorkSchedule(
                gym_id=gym.id,
                coach_id=coach.id,
                date=date(2026, 3, 17),
                start_time="09:00",
                end_time="12:00",
                shift_type="regular",
                status="scheduled",
            )
        )
        db.commit()
    finally:
        db.close()

    member_headers = login_and_get_headers(client, user.phone, "pass1234")
    response = client.get("/api/work-schedules/?year_month=2026-03", headers=member_headers)

    assert response.status_code == 200, response.text
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["coach_id"] == coach.id


def test_member_cannot_create_work_schedule(client: TestClient):
    _gym, user, coach = seed_gym_and_members()
    member_headers = login_and_get_headers(client, user.phone, "pass1234")

    response = client.post(
        "/api/work-schedules/",
        json={
            "coach_id": coach.id,
            "date": "2026-03-17",
            "start_time": "09:00",
            "end_time": "12:00",
            "shift_type": "regular",
            "memo": "권한 체크 테스트",
        },
        headers=member_headers,
    )

    assert response.status_code == 403


def test_member_cannot_create_competition(client: TestClient):
    _gym, user, _coach = seed_gym_and_members()
    member_headers = login_and_get_headers(client, user.phone, "pass1234")

    response = client.post(
        "/api/competitions/",
        json={
            "title": "회원 생성 테스트전",
            "description": "권한 체크",
            "start_date": "2026-03-20",
            "end_date": "2026-03-21",
            "is_private": False,
            "show_leaderboard_to_all": True,
            "show_wod_to_all": True,
            "anonymize_for_all": False,
            "guest_passcode": "1234",
            "allow_invited_gym_settings": False,
            "invited_gym_ids": [],
        },
        headers=member_headers,
    )

    assert response.status_code == 403


def test_coach_can_create_competition(client: TestClient):
    gym, _user, coach = seed_gym_and_members()
    coach_headers = login_and_get_headers(client, coach.phone, "coach1234")

    response = client.post(
        "/api/competitions/",
        json={
            "title": "코치 생성 테스트전",
            "description": "권한 체크",
            "start_date": "2026-03-20",
            "end_date": "2026-03-21",
            "is_private": False,
            "show_leaderboard_to_all": True,
            "show_wod_to_all": True,
            "anonymize_for_all": False,
            "guest_passcode": "1234",
            "allow_invited_gym_settings": False,
            "invited_gym_ids": [],
        },
        headers=coach_headers,
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["title"] == "코치 생성 테스트전"

    db = TestingSessionLocal()
    try:
        linked = db.query(models.CompetitionGym).filter(
            models.CompetitionGym.competition_id == payload["id"],
            models.CompetitionGym.gym_id == gym.id,
        ).first()
        assert linked is not None
        assert linked.status == "accepted"
    finally:
        db.close()


def test_dropin_pending_count_is_role_aware(client: TestClient):
    gym, user, coach = seed_gym_and_members()

    db = TestingSessionLocal()
    try:
        reservation = models.DropInReservation(
            gym_id=gym.id,
            member_id=user.id,
            date=date(2026, 3, 17),
            status="pending",
        )
        db.add(reservation)
        db.commit()
    finally:
        db.close()

    member_headers = login_and_get_headers(client, user.phone, "pass1234")
    coach_headers = login_and_get_headers(client, coach.phone, "coach1234")

    member_response = client.get("/api/dropin/pending-count", headers=member_headers)
    coach_response = client.get("/api/dropin/pending-count", headers=coach_headers)

    assert member_response.status_code == 200
    assert member_response.json() == {"count": 0}
    assert coach_response.status_code == 200
    assert coach_response.json() == {"count": 1}


def test_membership_sale_amount_is_server_calculated_from_product_price(client: TestClient):
    gym, user, coach = seed_gym_and_members()

    db = TestingSessionLocal()
    try:
        db.add(
            MembershipProduct(
                gym_id=gym.id,
                category="membership",
                name="무제한 1개월",
                price=150000,
                months=1,
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()

    coach_headers = login_and_get_headers(client, coach.phone, "coach1234")
    response = client.post(
        "/api/sales/",
        json={
            "member_id": user.id,
            "item_name": "무제한 1개월",
            "amount": 100,
            "category": "membership",
            "payment_method": "card",
            "status": "paid",
        },
        headers=coach_headers,
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["amount"] == 150000


def test_membership_extension_sale_uses_product_price_and_updates_end_date(client: TestClient):
    gym, user, coach = seed_gym_and_members()

    db = TestingSessionLocal()
    try:
        db.add(
            MembershipProduct(
                gym_id=gym.id,
                category="membership",
                name="주3회 3개월",
                price=330000,
                months=3,
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()

    coach_headers = login_and_get_headers(client, coach.phone, "coach1234")
    response = client.post(
        "/api/sales/with-extension",
        json={
            "member_id": user.id,
            "item_name": "주3회 3개월",
            "amount": 100,
            "category": "membership",
            "payment_method": "card",
            "status": "paid",
            "extension_months": 3,
        },
        headers=coach_headers,
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["amount"] == 330000

    db = TestingSessionLocal()
    try:
        refreshed_user = db.query(Member).filter(Member.id == user.id).first()
        assert refreshed_user.membership == "주3회 3개월"
        assert refreshed_user.end_date is not None
    finally:
        db.close()


def test_superadmin_can_merge_duplicate_competition_participants(client: TestClient):
    gym, user, _coach = seed_gym_and_members()

    db = TestingSessionLocal()
    try:
        superadmin = Member(
            phone="010-5555-4444",
            name="총관리자",
            hashed_password=get_password_hash("super1234"),
            role="superadmin",
            gym_id=gym.id,
            must_change_password=False,
            status="활성",
        )
        db.add(superadmin)
        db.flush()

        competition = Competition(
            title="병합 테스트전",
            description="동일인 병합 테스트",
            start_date="2026-03-01",
            end_date="2026-03-31",
            is_active=True,
            show_leaderboard_to_all=True,
            creator_id=superadmin.id,
        )
        db.add(competition)
        db.flush()

        event_1 = CompetitionEvent(competition_id=competition.id, title="26.1", description="A", score_type="time")
        event_2 = CompetitionEvent(competition_id=competition.id, title="26.2", description="B", score_type="time")
        event_3 = CompetitionEvent(competition_id=competition.id, title="26.3", description="C", score_type="time")
        db.add_all([event_1, event_2, event_3])
        db.flush()

        db.add_all([
            CompetitionScore(
                event_id=event_1.id,
                member_id=user.id,
                member_name="정의빈",
                score_value="08:30",
                is_rx=True,
            ),
            CompetitionScore(
                event_id=event_2.id,
                member_id=user.id,
                member_name="정의빈",
                score_value="09:10",
                is_rx=True,
            ),
            CompetitionScore(
                event_id=event_3.id,
                member_id=None,
                member_name="정의빈",
                score_value="07:50",
                is_rx=True,
                guest_phone="010-9999-1111",
                guest_gym=gym.name,
            ),
        ])
        db.commit()
        competition_id = competition.id
    finally:
        db.close()

    superadmin_headers = login_and_get_headers(client, "010-5555-4444", "super1234")

    merge_response = client.post(
        f"/api/competitions/{competition_id}/merge-participants",
        json={
            "source": {
                "member_id": None,
                "member_name": "정의빈",
                "guest_phone": "010-9999-1111",
            },
            "target": {
                "member_id": user.id,
                "member_name": "정의빈",
                "guest_phone": None,
            },
        },
        headers=superadmin_headers,
    )

    assert merge_response.status_code == 200, merge_response.text
    merge_payload = merge_response.json()
    assert merge_payload["moved_count"] == 1
    assert merge_payload["conflict_events"] == []

    overall_response = client.get(
        f"/api/competitions/{competition_id}/overall",
        headers=superadmin_headers,
    )

    assert overall_response.status_code == 200, overall_response.text
    overall_payload = [item for item in overall_response.json() if item["member_name"] == "정의빈"]
    assert len(overall_payload) == 1
    assert overall_payload[0]["event_details"]["26.1"] == 1
    assert overall_payload[0]["event_details"]["26.2"] == 1
    assert overall_payload[0]["event_details"]["26.3"] == 1
