from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import numpy as np
from typing import List
from sqlalchemy.orm import Session
from datetime import datetime
import engine, auth, models, database, schemas

router = APIRouter(
    tags=["simulation"],
)

class SimulationRequest(BaseModel):
    initial_portfolio: float
    annual_contribution: float
    years: int
    iterations: int = 1000
    time_unit: str = "month"  # 'year', 'month', 'day'
    backtest_years: int = 10
    us_stock_ticker: str = "SPY"
    real_estate_ticker: str = "VNQ"

class SimulationResponse(BaseModel):
    years: List[int]
    p5: List[float]
    p25: List[float]
    p50: List[float]
    p75: List[float]
    p95: List[float]
    short_term_paths: List[dict]
    one_month_paths: List[dict]
    historical_backtest: dict
    metrics: dict

@router.post("/monte_carlo", response_model=SimulationResponse)
def run_simulation(request: SimulationRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Let's query all assets if no user, or specific user's assets.
    # For now, let's query all assets to be safe if auth is bypassed/dummy.
    # OR better: use the assets associated with the current user context.
    
    # Check if current_user has id.
    user_id = current_user.id if hasattr(current_user, 'id') else 1
    
    assets = db.query(models.Asset).filter(models.Asset.owner_id == user_id).all()
    
    # 1. Run Historical Backtest FIRST to get dynamic metrics
    backtest_result = engine.run_historical_backtest(
        assets, 
        request.initial_portfolio, 
        request.backtest_years,
        request.us_stock_ticker,
        request.real_estate_ticker
    )
    
    # Extract historical metrics to use as overrides
    metrics_overrides = backtest_result.get("historical_metrics", {})
    
    # 2. Calculate weighted metrics using overrides
    mean_return, volatility, breakdown = engine.calculate_portfolio_metrics(assets, metrics_overrides)
    
    # 3. Run Monte Carlo Simulation with dynamic metrics
    result = engine.run_monte_carlo_simulation(
        initial_portfolio=request.initial_portfolio,
        annual_contribution=request.annual_contribution,
        years=request.years,
        expected_return_mean=mean_return,
        expected_return_std=volatility,
        iterations=request.iterations,
        time_unit=request.time_unit
    )
    
    # Add breakdown to metrics
    result["metrics"]["breakdown"] = breakdown
    
    # Attach backtest result
    result["historical_backtest"] = backtest_result
    
    return result

class GoalCheckRequest(BaseModel):
    initial_portfolio: float
    annual_contribution: float
    years: int
    goals: List[schemas.FutureGoalExpense]

@router.post("/goals_check")
def check_goals(request: GoalCheckRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    user_id = current_user.id if hasattr(current_user, 'id') else 1
    assets = db.query(models.Asset).filter(models.Asset.owner_id == user_id).all()
    
    # Get metrics
    mean_return, volatility, _ = engine.calculate_portfolio_metrics(assets)
    
    # Simulation Parameters
    iterations = 1000
    monthly_return_mean = mean_return / 12
    monthly_return_std = volatility / np.sqrt(12)
    monthly_contribution = request.annual_contribution / 12
    total_months = request.years * 12
    
    # Prepare Goals Map (Month Index -> List of Goals)
    goals_by_month = {}
    now = datetime.now()
    
    for goal in request.goals:
        months_until = (goal.target_date.year - now.year) * 12 + (goal.target_date.month - now.month)
        if months_until < 1: months_until = 1 # Minimum 1 month out
        if months_until > total_months: months_until = total_months
        
        if months_until not in goals_by_month:
            goals_by_month[months_until] = []
        goals_by_month[months_until].append(goal)
    
    # Initialize Simulation
    # simulations[i] represents the current wealth of iteration i
    current_wealth = np.full(iterations, request.initial_portfolio)
    
    goal_results = {}
    
    # Constants
    INFLATION_RATE = 0.03
    DEBT_INTEREST_RATE = 0.05
    monthly_debt_rate = DEBT_INTEREST_RATE / 12
    
    # Run Simulation Step-by-Step
    for t in range(1, total_months + 1):
        # 1. Apply Market Return (for positive wealth) or Debt Interest (for negative wealth)
        random_shocks = np.random.normal(monthly_return_mean, monthly_return_std, iterations)
        market_growth = 1 + random_shocks
        debt_growth = 1 + monthly_debt_rate
        
        # Vectorized update: If wealth > 0 use market return, else use debt rate
        # Note: We assume monthly_contribution is added regardless (reducing debt or increasing wealth)
        current_wealth = np.where(
            current_wealth >= 0,
            current_wealth * market_growth + monthly_contribution,
            current_wealth * debt_growth + monthly_contribution
        )
        
        # 2. Handle Goals in this month
        if t in goals_by_month:
            for goal in goals_by_month[t]:
                # Inflation Adjustment
                # Calculate years from now to this goal
                years_until = t / 12
                inflation_factor = (1 + INFLATION_RATE) ** years_until
                adjusted_amount = goal.amount * inflation_factor
                
                # Calculate Success (Wealth >= Adjusted Amount)
                median_wealth = float(np.median(current_wealth))
                
                if goal.goal_type == 'cash_flow':
                    # Financial Freedom Check
                    annual_needed = adjusted_amount * 12
                    safe_withdrawal = current_wealth * 0.04
                    
                    success_count = np.sum(safe_withdrawal >= annual_needed)
                    
                    projected_income = median_wealth * 0.04 / 12
                    progress_ratio = projected_income / adjusted_amount if adjusted_amount > 0 else 1.0
                    
                else:
                    # Lump Sum Check
                    success_count = np.sum(current_wealth >= adjusted_amount)
                    progress_ratio = median_wealth / adjusted_amount if adjusted_amount > 0 else 1.0
                    
                    # DEDUCT the adjusted amount
                    current_wealth -= adjusted_amount
                
                probability = (success_count / iterations) * 100
                
                goal_results[goal.id] = {
                    "goal_id": goal.id,
                    "probability": round(probability, 1),
                    "progress_ratio": round(progress_ratio * 100, 1),
                    "projected_amount": round(median_wealth, 0),
                    "status": "On Track" if probability > 80 else ("At Risk" if probability < 50 else "Needs Work"),
                    "inflation_adjusted_amount": round(adjusted_amount, 0) # Optional: return for UI
                }

    # Convert results map to list
    results = list(goal_results.values())
    return results
