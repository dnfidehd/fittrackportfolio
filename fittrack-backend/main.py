# fittrack-backend/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import time

# ✅ [설정] 서버 시간 한국 시간(KST)으로 고정
os.environ['TZ'] = 'Asia/Seoul'
try:
    time.tzset()
except Exception:
    pass # Windows 등에서는 지원되지 않을 수 있음

from config import settings
from auto_migrate import run_auto_migration
from database import engine
from utils.health import check_database_connection

# 라우터들 불러오기
from routers import (
    auth, members, wods, workouts, sales, ai, competitions, attendance, community, dashboard, records, badges, expenses, notifications, superadmin, crm, classes, goals, dropin, diet,
    messages, # ✅ [신규] 메시지 라우터 추가
    work_schedules, # ✅ [신규] 근무표 라우터 추가
    open_percentile,
    coaching_classes # ✅ [신규] 수업 배정 라우터 추가
)
from routers import settings as settings_router

app = FastAPI(title="FitTrack AI API", version="1.0.0")


@app.on_event("startup")
def ensure_runtime_schema() -> None:
    if not settings.auto_migrate_on_startup:
        return
    run_auto_migration(raise_on_error=True)

# 업로드 폴더가 없으면 자동으로 만들기
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# 'uploads' 폴더를 외부에서 접근 가능하게 설정 (이미지 URL 생성용)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS 설정 (환경변수로 관리)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 라우터 연결 ---
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(members.router, prefix="/api/members", tags=["Members"])
app.include_router(wods.router, prefix="/api/wods", tags=["WODs"])
app.include_router(workouts.router, prefix="/api/workouts", tags=["Workouts"])
app.include_router(sales.router, prefix="/api/sales", tags=["Sales"]) 
app.include_router(ai.router) 
app.include_router(competitions.router, prefix="/api/competitions", tags=["Competitions"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(community.router, prefix="/api/community", tags=["Community"])
app.include_router(records.router, prefix="/api/records", tags=["Records"])
app.include_router(badges.router, prefix="/api/badges", tags=["Badges"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(diet.router, prefix="/api/diet", tags=["Diet"])
app.include_router(messages.router, prefix="/api") # ✅ [신규] 메시지 라우터 등록
app.include_router(superadmin.router)
app.include_router(crm.router)
app.include_router(settings_router.router)

app.include_router(classes.router, prefix="/api/classes", tags=["Classes"])
app.include_router(goals.router)  # ✅ 목표 설정 라우터 추가
app.include_router(dropin.router) # ✅ 드랍인 라우터 추가
app.include_router(work_schedules.router, prefix="/api/work-schedules", tags=["Work Schedules"]) # ✅ 근무표 라우터 추가
app.include_router(open_percentile.router)
app.include_router(coaching_classes.router, prefix="/api/coaching-classes", tags=["Coaching Classes"]) # ✅ 수업 배정 라우터 추가



@app.get("/")
def read_root():
    return {"message": "Welcome to FitTrack AI API 🚀"}


@app.get("/health")
def health_check():
    try:
        check_database_connection(engine)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "degraded",
                "database": "error",
                "environment": settings.environment,
                "reason": str(exc),
            },
        ) from exc

    return {
        "status": "ok",
        "database": "ok",
        "environment": settings.environment,
    }
