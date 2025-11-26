from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import models, schemas, database, auth, engine

router = APIRouter(
    tags=["finance"],
)

# ... (Assets endpoints remain unchanged) ...

# Helper to calculate payment and update linked expense
def update_linked_expense(db: Session, liability: models.Liability, user_id: int):
    if not liability.years or liability.years <= 0:
        return

    principal = liability.amount
    annual_rate = liability.interest_rate or 0
    grace_months = liability.grace_period_months or 0
    start_date = liability.start_date
    
    monthly_payment = 0
    category_suffix = ""

    # Check if in grace period
    in_grace_period = False
    if start_date and grace_months > 0:
        now = datetime.now()
        # Calculate months elapsed
        months_elapsed = (now.year - start_date.year) * 12 + (now.month - start_date.month)
        if months_elapsed < grace_months:
            in_grace_period = True
    
    if in_grace_period:
        # Interest Only
        monthly_payment = principal * (annual_rate / 100 / 12)
        category_suffix = " (Interest Only)"
    else:
        # Amortized Payment
        # If we had a grace period, the term for amortization is reduced? 
        # Usually, grace period is part of the total term. So remaining term = Total - Grace.
        # But if we are PAST the grace period, we just calculate PMT based on the remaining principal (which is full principal if interest only)
        # and remaining term.
        
        # Standard approach: Amortize full principal over (Total Years * 12 - Grace Months)
        total_months = liability.years * 12
        amortization_months = total_months - grace_months
        
        if amortization_months <= 0:
            # Should not happen if data is valid, but fallback
            amortization_months = total_months

        if annual_rate == 0:
            monthly_payment = principal / amortization_months
        else:
            r = annual_rate / 100 / 12
            monthly_payment = principal * (r * (1 + r)**amortization_months) / ((1 + r)**amortization_months - 1)

    # Update or Create Expense
    db_expense = db.query(models.Expense).filter(models.Expense.liability_id == liability.id).first()
    
    category_name = f"Debt Repayment: {liability.name}{category_suffix}"
    
    if db_expense:
        db_expense.amount = round(monthly_payment, 2)
        db_expense.category = category_name
    else:
        db_expense = models.Expense(
            category=category_name,
            amount=round(monthly_payment, 2),
            owner_id=user_id,
            liability_id=liability.id
        )
        db.add(db_expense)
    
    db.commit()

# Assets
@router.post("/assets", response_model=schemas.Asset)
def create_asset(asset: schemas.AssetCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # If ticker is provided, fetch current price and calculate value
    if asset.ticker and asset.shares:
        price, rate = engine.get_stock_price_and_rate(asset.ticker)
        if price:
            asset.value = float(price * asset.shares * rate)
    
    db_asset = models.Asset(**asset.dict(), owner_id=current_user.id)
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

@router.put("/assets/{asset_id}", response_model=schemas.Asset)
def update_asset(asset_id: int, asset: schemas.AssetCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id, models.Asset.owner_id == current_user.id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # If ticker is provided and changed, or if shares changed, re-calculate value
    if asset.category == "Stock/Fund" and asset.ticker and asset.shares:
        # Check if ticker or shares changed, or if we just want to refresh value
        price, rate = engine.get_stock_price_and_rate(asset.ticker)
        if price:
            asset.value = float(price * asset.shares * rate)
    
    for key, value in asset.dict().items():
        setattr(db_asset, key, value)

    db.commit()
    db.refresh(db_asset)
    db.refresh(db_asset)
    return db_asset

@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id, models.Asset.owner_id == current_user.id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    db.delete(asset)
    db.commit()
    return {"message": "Asset deleted"}

@router.get("/assets", response_model=List[schemas.Asset])
def read_assets(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    assets = db.query(models.Asset).filter(models.Asset.owner_id == current_user.id).offset(skip).limit(limit).all()
    return assets

@router.get("/stock/preview", response_model=schemas.StockPreviewResponse)
def preview_stock(ticker: str, shares: float, current_user: models.User = Depends(auth.get_current_user)):
    price, rate = engine.get_stock_price_and_rate(ticker)
    if price == 0:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    total_value = price * shares * rate
    currency = "TWD" if rate == 1.0 else "USD"
    
    return {
        "ticker": ticker,
        "price": price,
        "currency": currency,
        "exchange_rate": rate,
        "total_value_twd": total_value
    }

# Liabilities
@router.post("/liabilities", response_model=schemas.Liability)
def create_liability(liability: schemas.LiabilityCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_liability = models.Liability(**liability.dict(), owner_id=current_user.id)
    db.add(db_liability)
    db.commit()
    db.refresh(db_liability)

    # Calculate Monthly Payment (PMT) with Grace Period Logic
    update_linked_expense(db, db_liability, current_user.id)

    return db_liability

@router.put("/liabilities/{liability_id}", response_model=schemas.Liability)
def update_liability(liability_id: int, liability: schemas.LiabilityCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_liability = db.query(models.Liability).filter(models.Liability.id == liability_id, models.Liability.owner_id == current_user.id).first()
    if not db_liability:
        raise HTTPException(status_code=404, detail="Liability not found")
    
    # Update fields
    for key, value in liability.dict().items():
        setattr(db_liability, key, value)
    
    db.commit()
    db.refresh(db_liability)

    # Recalculate Monthly Payment (PMT) with Grace Period Logic
    update_linked_expense(db, db_liability, current_user.id)

    return db_liability

@router.delete("/liabilities/{liability_id}")
def delete_liability(liability_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    liability = db.query(models.Liability).filter(models.Liability.id == liability_id, models.Liability.owner_id == current_user.id).first()
    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")
    
    # Delete linked expense if exists
    db.query(models.Expense).filter(models.Expense.liability_id == liability_id).delete()
    
    db.delete(liability)
    db.commit()
    return {"message": "Liability deleted"}

@router.get("/liabilities", response_model=List[schemas.Liability])
def read_liabilities(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    liabilities = db.query(models.Liability).filter(models.Liability.owner_id == current_user.id).offset(skip).limit(limit).all()
    return liabilities

# Income
@router.post("/incomes", response_model=schemas.Income)
def create_income(income: schemas.IncomeCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_income = models.Income(**income.dict(), owner_id=current_user.id)
    db.add(db_income)
    db.commit()
    db.refresh(db_income)
    return db_income

@router.get("/incomes", response_model=List[schemas.Income])
def read_incomes(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    incomes = db.query(models.Income).filter(models.Income.owner_id == current_user.id).offset(skip).limit(limit).all()
    return incomes

# Expenses
@router.post("/expenses", response_model=schemas.Expense)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_expense = models.Expense(**expense.dict(), owner_id=current_user.id)
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

@router.get("/expenses", response_model=List[schemas.Expense])
def read_expenses(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    expenses = db.query(models.Expense).filter(models.Expense.owner_id == current_user.id).offset(skip).limit(limit).all()
    return expenses

# Future Goals
import urllib.parse

# ...

@router.post("/goals", response_model=schemas.FutureGoalExpense)
def create_goal(goal: schemas.FutureGoalExpenseCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Generate AI Image URL
    prompt = f"minimalist flat vector icon of {goal.name}, white background, simple, clean, high quality"
    encoded_prompt = urllib.parse.quote(prompt)
    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=200&height=200&nologo=true"
    
    # Create DB Object
    db_goal = models.FutureGoalExpense(**goal.dict(), owner_id=current_user.id)
    db_goal.image_url = image_url # Override/Set image_url
    
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.get("/goals", response_model=List[schemas.FutureGoalExpense])
def read_goals(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    goals = db.query(models.FutureGoalExpense).filter(models.FutureGoalExpense.owner_id == current_user.id).offset(skip).limit(limit).all()
    return goals

@router.put("/goals/{goal_id}", response_model=schemas.FutureGoalExpense)
def update_goal(goal_id: int, goal: schemas.FutureGoalExpenseCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_goal = db.query(models.FutureGoalExpense).filter(models.FutureGoalExpense.id == goal_id, models.FutureGoalExpense.owner_id == current_user.id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Check if name changed to regenerate image (optional, maybe skip to save API calls/time)
    # For now, let's regenerate if name changes
    if goal.name != db_goal.name:
        prompt = f"minimalist flat vector icon of {goal.name}, white background, simple, clean, high quality"
        encoded_prompt = urllib.parse.quote(prompt)
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=200&height=200&nologo=true"
        db_goal.image_url = image_url

    for key, value in goal.dict().items():
        if key != 'image_url': # Don't overwrite image_url unless we regenerated it
             setattr(db_goal, key, value)
    
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    goal = db.query(models.FutureGoalExpense).filter(models.FutureGoalExpense.id == goal_id, models.FutureGoalExpense.owner_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    db.delete(goal)
    db.commit()
    return {"message": "Goal deleted"}
