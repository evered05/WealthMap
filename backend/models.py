from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, date

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    assets = relationship("Asset", back_populates="owner")
    liabilities = relationship("Liability", back_populates="owner")
    incomes = relationship("Income", back_populates="owner")
    expenses = relationship("Expense", back_populates="owner")

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String) # Cash, Stock, Real Estate, Other
    value = Column(Float) # For non-stock assets or cached total value
    
    # Stock specific fields
    ticker = Column(String, nullable=True)
    shares = Column(Float, nullable=True)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="assets")

class Liability(Base):
    __tablename__ = "liabilities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String) # Mortgage, Car Loan, Credit Card, Student Loan, Other
    amount = Column(Float)
    amount = Column(Float)
    interest_rate = Column(Float, nullable=True)
    start_date = Column(DateTime, nullable=True)
    years = Column(Integer, nullable=True)
    grace_period_months = Column(Integer, default=0)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="liabilities")

class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String)
    amount = Column(Float) # Monthly amount
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="incomes")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)
    amount = Column(Float) # Monthly amount
    liability_id = Column(Integer, ForeignKey("liabilities.id"), nullable=True)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="expenses")

class FutureGoalExpense(Base):
    __tablename__ = "future_goals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    amount = Column(Float)
    target_date = Column(DateTime) # We will use this to determine the year/month
    image_url = Column(String, nullable=True)
    goal_type = Column(String, default="lump_sum") # 'lump_sum' or 'cash_flow'
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="future_goals")

User.future_goals = relationship("FutureGoalExpense", back_populates="owner")
