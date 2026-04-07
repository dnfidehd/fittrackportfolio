"""
Competitions router package - combines all competition-related endpoints.

This package is organized into modular sub-routers:
- competitions.py: CRUD endpoints for competitions
- events.py: Event management endpoints
- leaderboard.py: Leaderboard endpoints
- registrations.py: Registration management endpoints
- gym_management.py: Gym participation endpoints
- guest_access.py: Guest user endpoints
- scores.py: Score management and bulk operations
- excel.py: Excel import/export endpoints

All routers are combined here with the /competitions prefix.
"""
from fastapi import APIRouter
from . import competitions, events, leaderboard, registrations, gym_management, guest_access, scores, excel

# Create main router for /competitions endpoints
router = APIRouter(prefix="/competitions", tags=["competitions"])

# Include all sub-routers
router.include_router(competitions.router)
router.include_router(events.router)
router.include_router(leaderboard.router)
router.include_router(registrations.router)
router.include_router(gym_management.router)
router.include_router(guest_access.router)
router.include_router(scores.router)
router.include_router(excel.router)

__all__ = ['router']
