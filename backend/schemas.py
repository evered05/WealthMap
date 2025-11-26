from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Asset Schemas
class AssetBase(BaseModel):
    name: str
    category: str
    value: float = 0.0
    ticker: Optional[str] = None
    shares: Optional[float] = None

class AssetCreate(AssetBase):
    pass

class Asset(AssetBase):
    id: int
    owner_id: int
    class Config:
        orm_mode = True

class StockPreviewResponse(BaseModel):
    ticker: str
    price: float
    currency: str
    exchange_rate: float
    total_value_twd: float

# Liability Schemas
class LiabilityBase(BaseModel):
    name: str
    category: str
    amount: float
    amount: float
    interest_rate: Optional[float] = None
    start_date: Optional[datetime] = None
    years: Optional[int] = None
    grace_period_months: Optional[int] = 0

class LiabilityCreate(LiabilityBase):
    pass

class Liability(LiabilityBase):
    id: int
    owner_id: int
    class Config:
        orm_mode = True

# Income Schemas
class IncomeBase(BaseModel):
    source: str
    amount: float

class IncomeCreate(IncomeBase):
    pass

class Income(IncomeBase):
    id: int
    owner_id: int
    class Config:
        orm_mode = True

# Expense Schemas
class ExpenseBase(BaseModel):
    category: str
    amount: float

class ExpenseCreate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    id: int
    owner_id: int
    class Config:
        orm_mode = True

# Future Goal Schemas
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# ... (previous schemas)

class FutureGoalExpenseBase(BaseModel):
    name: str
    amount: float
    target_date: datetime
    image_url: Optional[str] = None
    goal_type: str = "lump_sum"

class FutureGoalExpenseCreate(FutureGoalExpenseBase):
    pass

class FutureGoalExpense(FutureGoalExpenseBase):
    id: int
    owner_id: int
    class Config:
        orm_mode = True
