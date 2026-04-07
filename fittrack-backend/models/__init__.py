# models/__init__.py
# Re-export all models for backward compatibility
# This allows existing code to use: from models import Member, Competition, Gym, etc.

from database import Base

# Import all models from domain modules
from .gym import Gym
from .member import Member, PersonalRecord
from .membership import MembershipHold, MembershipProduct
from .wod import Wod, WodVideo, WodRecord
from .workout import Workout
from .competition import Competition, CompetitionEvent, CompetitionScore, CompetitionRegistration, CompetitionGym
from .community import Post, Comment, PostLike
from .badge import Badge, MemberBadge
from .notification import Notification, NotificationTemplate
from .sales import Sale, Expense
from .attendance import Attendance
from .dropin import DropInReservation
from .schedule import WorkSchedule, WorkScheduleTemplate
from .goals import Goal
from .diet import DietLog
from .messaging import Message
from .analytics import AIAnalysis
from .classes import ClassSchedule, ClassReservation, ClassTemplate
from .permissions import Permission, CoachPermission
from .staffing import StaffTask
from .coaching_class import CoachingClass, CoachingClassAssignment
from .crm_followup import MemberCrmFollowUp

# Member 관계 설정 추가 (AIAnalysis와의 관계를 동적으로 설정)
from sqlalchemy.orm import relationship
Member.ai_analyses = relationship("AIAnalysis", order_by=AIAnalysis.created_at.desc(), back_populates="member")


# Re-export all models for backward compatibility
__all__ = [
    "Base",
    # Gym
    "Gym",
    # Member
    "Member",
    "PersonalRecord",
    # Membership
    "MembershipHold",
    "MembershipProduct",
    # WOD
    "Wod",
    "WodVideo",
    "WodRecord",
    # Workout
    "Workout",
    # Competition
    "Competition",
    "CompetitionEvent",
    "CompetitionScore",
    "CompetitionRegistration",
    "CompetitionGym",
    # Community
    "Post",
    "Comment",
    "PostLike",
    # Badge
    "Badge",
    "MemberBadge",
    # Notification
    "Notification",
    "NotificationTemplate",
    # Sales
    "Sale",
    "Expense",
    # Attendance
    "Attendance",
    # Drop-in
    "DropInReservation",
    # Schedule
    "WorkSchedule",
    "WorkScheduleTemplate",
    # Goals
    "Goal",
    # Diet
    "DietLog",
    # Messaging
    "Message",
    # Analytics
    "AIAnalysis",
    # Classes
    "ClassSchedule",
    "ClassReservation",
    "ClassTemplate",
    # Permissions
    "Permission",
    "CoachPermission",
    # Staffing
    "StaffTask",
    # Coaching Classes
    "CoachingClass",
    "CoachingClassAssignment",
    "MemberCrmFollowUp",
]
