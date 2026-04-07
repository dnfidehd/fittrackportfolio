from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import MembershipProduct, NotificationTemplate, Permission, CoachPermission, Member
from schemas import ProductCreate, ProductResponse, NotificationTemplateCreate, NotificationTemplateResponse, NotificationTemplateUpdate, SubCoachCreate, SubCoachResponse, PermissionResponse
from security import get_current_user, require_permission

router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"],
)

@router.get("/products", response_model=List[ProductResponse])
def get_products(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("settings"))
):
    """
    현재 체육관의 회원권 상품 목록 조회
    """
    gym_id = current_user.gym_id
    products = db.query(MembershipProduct).filter(
        MembershipProduct.gym_id == gym_id,
        MembershipProduct.is_active == True
    ).all()
    return products

@router.post("/products", response_model=ProductResponse)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("settings"))
):
    """
    회원권 상품 추가
    """
    gym_id = current_user.gym_id
    new_product = MembershipProduct(
        gym_id=gym_id,
        category=product.category,
        name=product.name,
        price=product.price,
        months=product.months,
        is_active=product.is_active
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("settings"))
):
    """
    회원권 상품 삭제 (DB 삭제 대신 비활성화 처리 권장, 여기선 삭제)
    """
    gym_id = current_user.gym_id
    product = db.query(MembershipProduct).filter(
        MembershipProduct.id == product_id,
        MembershipProduct.gym_id == gym_id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}


# =========================================================
# Notification Template Management
# =========================================================

def get_default_template_config():
    """기본 템플릿 설정 반환"""
    return {
        "expiry_7days": {
            "title": "회원권 만료 임박 ⏳",
            "message": "{member_name}님, 회원권이 7일 뒤 만료됩니다. 재등록 놓치지 마세요!"
        },
        "expiry_3days": {
            "title": "회원권 만료 임박 ⏳",
            "message": "{member_name}님, 회원권이 3일 뒤 만료됩니다. 재등록 놓치지 마세요!"
        },
        "inactivity_7days": {
            "title": "보고 싶어요! 😭",
            "message": "{member_name}님, 마지막 운동 이후 {days_since}일이 지났어요. 몸이 근질거리지 않으세요? 💪"
        },
        "inactivity_no_checkin": {
            "title": "보고 싶어요! 😭",
            "message": "{member_name}님, 가입하신 지 벌써 {days_since_join}일째! 첫 출석을 기다리고 있어요 🥺"
        }
    }

def create_default_templates(db: Session, gym_id: int):
    """체육관별 기본 템플릿 생성"""
    templates = []
    default_config = get_default_template_config()

    for template_type, config in default_config.items():
        template = NotificationTemplate(
            gym_id=gym_id,
            type=template_type,
            title=config["title"],
            message=config["message"]
        )
        db.add(template)
        templates.append(template)

    db.commit()
    for t in templates:
        db.refresh(t)

    return templates

@router.get("/notification-templates", response_model=List[NotificationTemplateResponse])
def get_notification_templates(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("notifications"))
):
    """
    알림 메시지 템플릿 조회
    없으면 자동으로 기본 템플릿 생성
    """
    gym_id = current_user.gym_id
    templates = db.query(NotificationTemplate).filter(
        NotificationTemplate.gym_id == gym_id
    ).all()

    # 템플릿이 없으면 기본 템플릿 자동 생성
    if not templates:
        templates = create_default_templates(db, gym_id)

    return templates

@router.post("/notification-templates", response_model=NotificationTemplateResponse)
def create_notification_template(
    template_data: NotificationTemplateCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("notifications"))
):
    """
    새 알림 메시지 템플릿 생성 (코치가 커스텀 템플릿 추가)
    """
    gym_id = current_user.gym_id

    # 같은 type의 템플릿이 이미 있는지 확인
    existing = db.query(NotificationTemplate).filter(
        NotificationTemplate.gym_id == gym_id,
        NotificationTemplate.type == template_data.type
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="같은 타입의 템플릿이 이미 존재합니다.")

    template = NotificationTemplate(
        gym_id=gym_id,
        type=template_data.type,
        title=template_data.title,
        message=template_data.message
    )

    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.put("/notification-templates/{template_id}", response_model=NotificationTemplateResponse)
def update_notification_template(
    template_id: int,
    template_data: NotificationTemplateUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("notifications"))
):
    """
    알림 메시지 템플릿 수정
    """
    gym_id = current_user.gym_id
    template = db.query(NotificationTemplate).filter(
        NotificationTemplate.id == template_id,
        NotificationTemplate.gym_id == gym_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if template_data.title is not None:
        template.title = template_data.title
    if template_data.message is not None:
        template.message = template_data.message

    from datetime import datetime
    template.updated_at = datetime.now()

    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.post("/notification-templates/reset/{template_type}")
def reset_notification_template(
    template_type: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("notifications"))
):
    """
    알림 메시지 템플릿을 기본값으로 초기화
    """
    gym_id = current_user.gym_id
    template = db.query(NotificationTemplate).filter(
        NotificationTemplate.gym_id == gym_id,
        NotificationTemplate.type == template_type
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    default_config = get_default_template_config()
    if template_type not in default_config:
        raise HTTPException(status_code=400, detail="Invalid template type")

    config = default_config[template_type]
    template.title = config["title"]
    template.message = config["message"]

    from datetime import datetime
    template.updated_at = datetime.now()

    db.add(template)
    db.commit()
    db.refresh(template)
    return template


# =========================================================
# Sub-Coach Management (부코치 관리)
# =========================================================

@router.get("/sub-coaches", response_model=List[SubCoachResponse])
def get_sub_coaches(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("settings"))
):
    """
    현재 체육관의 부코치 목록 조회
    """
    gym_id = current_user.gym_id
    sub_coaches = db.query(Member).filter(
        Member.gym_id == gym_id,
        Member.role == "subcoach"
    ).all()

    for coach in sub_coaches:
        coach.permissions = db.query(Permission).join(
            CoachPermission, CoachPermission.permission_id == Permission.id
        ).filter(CoachPermission.coach_id == coach.id).all()

    return sub_coaches


@router.post("/sub-coaches", response_model=SubCoachResponse)
def create_sub_coach(
    data: SubCoachCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("settings"))
):
    """
    새 부코치 생성 및 권한 설정
    """
    from security import get_password_hash

    gym_id = current_user.gym_id

    # ✅ [추가] 같은 전화번호로 이미 같은 체육관에 부코치가 있는지 확인
    existing_coach = db.query(Member).filter(
        Member.phone == data.phone,
        Member.gym_id == gym_id,
        Member.role == "subcoach"
    ).first()

    if existing_coach:
        raise HTTPException(status_code=400, detail="이미 같은 번호의 부코치가 존재합니다.")

    sub_coach = Member(
        gym_id=gym_id,
        name=data.name,
        phone=data.phone,
        hashed_password=get_password_hash(data.password),
        role="subcoach",
        hourly_wage=data.hourly_wage, # ✅ [추가] 시급
        class_wage=data.class_wage,   # ✅ [추가] 수업수당
        color=data.color,
        status="활성",
        must_change_password=False
    )
    db.add(sub_coach)
    db.flush()

    for permission_id in data.permission_ids:
        perm = db.query(Permission).filter(Permission.id == permission_id).first()
        if perm:
            coach_perm = CoachPermission(coach_id=sub_coach.id, permission_id=permission_id, gym_id=gym_id)  # ✅ gym_id 추가
            db.add(coach_perm)

    db.commit()
    db.refresh(sub_coach)

    sub_coach.permissions = db.query(Permission).join(
        CoachPermission, CoachPermission.permission_id == Permission.id
    ).filter(CoachPermission.coach_id == sub_coach.id).all()

    return sub_coach


@router.delete("/sub-coaches/{coach_id}")
def delete_sub_coach(
    coach_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("settings"))
):
    """
    부코치 삭제
    """
    gym_id = current_user.gym_id
    coach = db.query(Member).filter(
        Member.id == coach_id,
        Member.gym_id == gym_id,
        Member.role == "subcoach"
    ).first()

    if not coach:
        raise HTTPException(status_code=404, detail="부코치를 찾을 수 없습니다.")

    db.query(CoachPermission).filter(CoachPermission.coach_id == coach_id).delete()
    db.delete(coach)
    db.commit()

    return {"message": "부코치가 삭제되었습니다."}


@router.put("/sub-coaches/{coach_id}")
def update_sub_coach(
    coach_id: int,
    data: dict,  # 프론트에서 { name, phone, password, hourly_wage, permission_ids } 전송
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("settings"))
):
    """
    부코치 정보(이름, 전화번호, 비밀번호, 시급) 및 권한 업데이트
    """
    from security import get_password_hash
    gym_id = current_user.gym_id
    coach = db.query(Member).filter(
        Member.id == coach_id,
        Member.gym_id == gym_id,
        Member.role == "subcoach"
    ).first()

    if not coach:
        raise HTTPException(status_code=404, detail="부코치를 찾을 수 없습니다.")

    # 기본 정보 업데이트
    name = data.get("name")
    phone = data.get("phone")
    password = data.get("password")
    hourly_wage = data.get("hourly_wage")
    class_wage = data.get("class_wage")
    color = data.get("color")

    if name:
        coach.name = name
    if phone:
        # 중복체크
        if phone != coach.phone:
            existing = db.query(Member).filter(Member.phone == phone, Member.gym_id == gym_id).first()
            if existing:
                raise HTTPException(status_code=400, detail="이미 등록된 전화번호입니다.")
        coach.phone = phone
    if password:
        coach.hashed_password = get_password_hash(password)
    if hourly_wage is not None:
        coach.hourly_wage = int(hourly_wage)
    if class_wage is not None:
        coach.class_wage = int(class_wage)
    if color is not None:
        coach.color = color

    # 권한 업데이트
    permission_ids = data.get("permission_ids", [])
    if permission_ids is not None:
        db.query(CoachPermission).filter(CoachPermission.coach_id == coach_id).delete()
        for permission_id in permission_ids:
            perm = db.query(Permission).filter(Permission.id == permission_id).first()
            if perm:
                coach_perm = CoachPermission(coach_id=coach_id, permission_id=permission_id, gym_id=gym_id)
                db.add(coach_perm)

    db.commit()

    return {"message": "부코치 정보 및 권한이 업데이트되었습니다."}


@router.get("/permissions", response_model=List[PermissionResponse])
def get_all_permissions(db: Session = Depends(get_db)):
    """
    전체 권한 목록 조회
    """
    return db.query(Permission).all()
