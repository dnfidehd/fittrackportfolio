# models/sales.py
# Sale and Expense models

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, date


class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    gym_id = Column(Integer, ForeignKey("gyms.id"))
    item_name = Column(String)
    amount = Column(Integer)
    category = Column(String)
    payment_method = Column(String)
    status = Column(String, default="paid")
    payment_date = Column(DateTime, default=datetime.now)
    member = relationship("Member", back_populates="sales")
    gym = relationship("Gym", back_populates="sales")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))

    item_name = Column(String)
    amount = Column(Integer)
    category = Column(String)
    date = Column(Date, default=date.today)
    method = Column(String)
    memo = Column(String, nullable=True)

    gym = relationship("Gym")
