from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
from .. import engine, auth, models, database

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
