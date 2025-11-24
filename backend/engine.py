import yfinance as yf
import numpy as np
import pandas as pd
from typing import List, Dict

# Static Asset Class Data
# Annualized Return and Volatility
ASSET_CLASSES = {
    "cash": {"name": "Cash/Bank Deposit", "mean_return": 0.02, "volatility": 0.01},
    "tw_stock": {"name": "Taiwan Stock", "mean_return": 0.12, "volatility": 0.20},
    "us_stock": {"name": "US Stock", "mean_return": 0.10, "volatility": 0.15},
    "bond": {"name": "Bond", "mean_return": 0.04, "volatility": 0.05},
    "gold": {"name": "Gold", "mean_return": 0.06, "volatility": 0.15},
    "real_estate": {"name": "Real Estate", "mean_return": 0.08, "volatility": 0.10}, # Proxy using REITs or similar
}

def get_stock_price_and_rate(ticker: str):
    """
    Fetches the latest stock price and exchange rate (USD to TWD).
    If the ticker is a Taiwan stock (ends with .TW), rate is 1.
    """
    try:
        stock = yf.Ticker(ticker)
        history = stock.history(period="1d")
        if history.empty:
            return 0.0, 1.0
        
        price = history['Close'].iloc[-1]
        
        # Determine exchange rate
        rate = 1.0
        if not ticker.endswith(".TW") and not ticker.endswith(".TWO"):
            # Assume USD for non-TW stocks for simplicity, fetch USD/TWD rate
            # In a real app, we should detect currency more robustly
            usd_twd = yf.Ticker("TWD=X")
            rate_history = usd_twd.history(period="1d")
            if not rate_history.empty:
                rate = rate_history['Close'].iloc[-1]
        
        return price, rate
    except Exception as e:
        print(f"Error fetching data for {ticker}: {e}")
        return 0.0, 1.0

def calculate_portfolio_metrics(assets: List[any], metrics_overrides: Dict[str, Dict[str, float]] = None):
    """
    Calculates the weighted average return and volatility of the user's portfolio.
    Maps user assets to ASSET_CLASSES.
    If metrics_overrides is provided (from historical backtest), use those values instead of defaults.
    """
    total_value = sum(asset.value for asset in assets)
    if total_value == 0:
        # Default to Cash if no assets
        if metrics_overrides and "cash" in metrics_overrides:
            return metrics_overrides["cash"]["return"], metrics_overrides["cash"]["volatility"], {}
        return ASSET_CLASSES["cash"]["mean_return"], ASSET_CLASSES["cash"]["volatility"], {}

    weighted_return = 0.0
    weighted_volatility = 0.0 
    
    breakdown = {}
    
    # Initialize breakdown with defaults or overrides
    for key in ASSET_CLASSES:
        mean_return = ASSET_CLASSES[key]["mean_return"]
        volatility = ASSET_CLASSES[key]["volatility"]
        
        if metrics_overrides and key in metrics_overrides:
            mean_return = metrics_overrides[key]["return"]
            volatility = metrics_overrides[key]["volatility"]
            
        breakdown[key] = {
            "name": ASSET_CLASSES[key]["name"],
            "weight": 0.0,
            "mean_return": mean_return,
            "volatility": volatility,
            "contribution_return": 0.0
        }

    for asset in assets:
        weight = asset.value / total_value
        
        # Map asset to class
        asset_class = "cash" # Default
        category = asset.category
        name = asset.name.lower()
        ticker = asset.ticker
        
        if category == "Cash/Bank Deposit":
            asset_class = "cash"
        elif category == "Stock/Fund":
            if ticker and (ticker.endswith(".TW") or ticker.endswith(".TWO")):
                asset_class = "tw_stock"
            else:
                asset_class = "us_stock"
        elif category == "Bond" or category == "Insurance":
            asset_class = "bond"
        elif category == "Real Estate":
            asset_class = "real_estate"
        elif "gold" in name or "黃金" in name:
            asset_class = "gold"
        else:
            asset_class = "us_stock" # Default 'Other' to US Stock for growth potential
            
        # Use overridden metrics if available
        mean_return = ASSET_CLASSES[asset_class]["mean_return"]
        volatility = ASSET_CLASSES[asset_class]["volatility"]
        
        if metrics_overrides and asset_class in metrics_overrides:
            mean_return = metrics_overrides[asset_class]["return"]
            volatility = metrics_overrides[asset_class]["volatility"]
            
        weighted_return += weight * mean_return
        weighted_volatility += weight * volatility
        
        breakdown[asset_class]["weight"] += weight
        breakdown[asset_class]["contribution_return"] += weight * mean_return
        
    return weighted_return, weighted_volatility, breakdown

def run_monte_carlo_simulation(
    initial_portfolio: float,
    annual_contribution: float,
    years: int,
    expected_return_mean: float,
    expected_return_std: float,
    iterations: int = 1000,
    time_unit: str = 'month'
):
    # Main Simulation (Long-term, Monthly steps)
    # We keep the main simulation monthly for consistency in the Fan Chart
    monthly_return_mean = expected_return_mean / 12
    monthly_return_std = expected_return_std / np.sqrt(12)
    monthly_contribution = annual_contribution / 12
    
    total_months = years * 12
    simulations = np.zeros((iterations, total_months + 1))
    simulations[:, 0] = initial_portfolio
    
    for t in range(1, total_months + 1):
        random_shocks = np.random.normal(monthly_return_mean, monthly_return_std, iterations)
        simulations[:, t] = simulations[:, t-1] * (1 + random_shocks) + monthly_contribution

    # Extract year-end values for the main chart
    year_indices = np.arange(0, total_months + 1, 12)
    year_simulations = simulations[:, year_indices]
    
    # Calculate percentiles for main chart
    p5 = np.percentile(year_simulations, 5, axis=0)
    p25 = np.percentile(year_simulations, 25, axis=0)
    p50 = np.percentile(year_simulations, 50, axis=0)
    p75 = np.percentile(year_simulations, 75, axis=0)
    p95 = np.percentile(year_simulations, 95, axis=0)

    # Short-term Volatility Simulation (Year 1 only, Scenario-based)
    short_term_paths = []
    if time_unit in ['day', 'month']:
        st_steps = 252 if time_unit == 'day' else 12
        st_dt = 1 / st_steps
        st_mean = expected_return_mean * st_dt
        st_std = expected_return_std * np.sqrt(st_dt)
        st_contribution = annual_contribution / st_steps
        
        # Run 1000 iterations for short-term to find representative paths
        st_iterations = 1000
        st_sims = np.zeros((st_iterations, st_steps + 1))
        st_sims[:, 0] = initial_portfolio
        
        for t in range(1, st_steps + 1):
            shocks = np.random.normal(st_mean, st_std, st_iterations)
            st_sims[:, t] = st_sims[:, t-1] * (1 + shocks) + st_contribution

        # Find indices for specific scenarios
        final_values = st_sims[:, -1]
        
        # 1. Best Case (approx P95)
        target_p95 = np.percentile(final_values, 95)
        idx_best = (np.abs(final_values - target_p95)).argmin()
        
        # 2. Worst Case (approx P5)
        target_p5 = np.percentile(final_values, 5)
        idx_worst = (np.abs(final_values - target_p5)).argmin()
        
        # 3. Median Case (approx P50)
        target_p50 = np.percentile(final_values, 50)
        idx_median = (np.abs(final_values - target_p50)).argmin()
        
        # 4. High Volatility (Max Std Dev of returns)
        # Calculate returns for each path: (Pt - Pt-1) / Pt-1
        # This is approximate, but good enough for visual selection
        # Or simply use the path with highest standard deviation of prices if returns are constant mean
        # Better: Calculate std dev of daily/monthly returns for each path
        returns = (st_sims[:, 1:] - st_sims[:, :-1]) / st_sims[:, :-1]
        path_volatilities = np.std(returns, axis=1)
        idx_volatile = np.argmax(path_volatilities)

        # Format for frontend
        for i in range(st_steps + 1):
            point = {
                "step": i,
                "best": st_sims[idx_best, i],
                "worst": st_sims[idx_worst, i],
                "median": st_sims[idx_median, i],
                "volatile": st_sims[idx_volatile, i]
            }
            short_term_paths.append(point)

    # One Month Daily Variation (Always 21 trading days)
    one_month_paths = []
    om_steps = 21
    om_dt = 1 / 252 # Daily step size assuming 252 trading days
    om_mean = expected_return_mean * om_dt
    om_std = expected_return_std * np.sqrt(om_dt)
    om_contribution = annual_contribution / 252 # Daily contribution
    
    om_iterations = 1000
    om_sims = np.zeros((om_iterations, om_steps + 1))
    om_sims[:, 0] = initial_portfolio
    
    for t in range(1, om_steps + 1):
        shocks = np.random.normal(om_mean, om_std, om_iterations)
        om_sims[:, t] = om_sims[:, t-1] * (1 + shocks) + om_contribution

    # Find indices for specific scenarios (One Month)
    om_final_values = om_sims[:, -1]
    
    om_target_p95 = np.percentile(om_final_values, 95)
    om_idx_best = (np.abs(om_final_values - om_target_p95)).argmin()
    
    om_target_p5 = np.percentile(om_final_values, 5)
    om_idx_worst = (np.abs(om_final_values - om_target_p5)).argmin()
    
    om_target_p50 = np.percentile(om_final_values, 50)
    om_idx_median = (np.abs(om_final_values - om_target_p50)).argmin()
    
    om_returns = (om_sims[:, 1:] - om_sims[:, :-1]) / om_sims[:, :-1]
    om_path_volatilities = np.std(om_returns, axis=1)
    om_idx_volatile = np.argmax(om_path_volatilities)

    for i in range(om_steps + 1):
        point = {
            "step": i,
            "best": om_sims[om_idx_best, i],
            "worst": om_sims[om_idx_worst, i],
            "median": om_sims[om_idx_median, i],
            "volatile": om_sims[om_idx_volatile, i]
        }
        one_month_paths.append(point)

    return {
        "years": list(range(years + 1)),
        "p5": p5.tolist(),
        "p25": p25.tolist(),
        "p50": p50.tolist(),
        "p75": p75.tolist(),
        "p95": p95.tolist(),
        "short_term_paths": short_term_paths,
        "one_month_paths": one_month_paths,
        "metrics": {
            "weighted_return": expected_return_mean,
            "weighted_volatility": expected_return_std
        }
    }

def run_historical_backtest(
    assets: List[any], 
    initial_portfolio_value: float, 
    years: int = 10,
    us_stock_ticker: str = "SPY",
    real_estate_ticker: str = "VNQ"
):
    """
    Backtests the user's current asset allocation over the past `years`.
    Compares against a Real Estate benchmark (VNQ or custom).
    """
    # 1. Calculate Weights
    total_value = sum(asset.value for asset in assets)
    if total_value == 0:
        return {"dates": [], "portfolio": [], "real_estate": []}

    weights = {
        "cash": 0.0,
        "tw_stock": 0.0,
        "us_stock": 0.0,
        "bond": 0.0,
        "gold": 0.0,
        "real_estate": 0.0
    }

    for asset in assets:
        weight = asset.value / total_value
        category = asset.category
        name = asset.name.lower()
        ticker = asset.ticker
        
        asset_class = "us_stock" # Default
        if category == "Cash/Bank Deposit":
            asset_class = "cash"
        elif category == "Stock/Fund":
            if ticker and (ticker.endswith(".TW") or ticker.endswith(".TWO")):
                asset_class = "tw_stock"
            else:
                asset_class = "us_stock"
        elif category == "Bond" or category == "Insurance":
            asset_class = "bond"
        elif category == "Real Estate":
            asset_class = "real_estate"
        elif "gold" in name or "黃金" in name:
            asset_class = "gold"
        
        weights[asset_class] += weight

    # 2. Fetch Historical Data
    tickers = {
        "tw_stock": "0050.TW",
        "us_stock": us_stock_ticker,
        "bond": "BND",
        "gold": "GLD",
        "real_estate": real_estate_ticker
    }
    
    data_frames = {}
    try:
        # Download all at once for efficiency
        download_tickers = list(tickers.values())
        if not download_tickers:
            return {"dates": [], "portfolio": [], "real_estate": []}
            
        # Fetch slightly more than 'years' to ensure we have a start point
        start_date = (pd.Timestamp.now() - pd.DateOffset(years=years)).strftime('%Y-%m-%d')
        
        # Use auto_adjust=True to get adjusted close (accounting for dividends/splits)
        # progress=False to suppress stdout
        hist_data = yf.download(download_tickers, start=start_date, auto_adjust=True, progress=False)['Close']
        
        if hist_data.empty:
             return {"dates": [], "portfolio": [], "real_estate": []}
             
        # Fill missing data (forward fill then backward fill)
        hist_data = hist_data.ffill().bfill()
        
        # Resample to monthly to reduce data size for frontend? 
        # Or keep daily? Let's keep daily but maybe thin it out if too large.
        # For 10 years, ~2500 points. Recharts can handle it, but maybe weekly is better?
        # Let's stick to daily for accuracy, frontend can handle 2500 points usually.
        
    except Exception as e:
        print(f"Error fetching backtest data: {e}")
        return {"dates": [], "portfolio": [], "real_estate": []}

    # 3. Construct Portfolio History
    # Normalize all assets to start at 1.0
    normalized_data = hist_data / hist_data.iloc[0]
    
    # Create Cash series (2% annual return)
    days = len(hist_data)
    daily_cash_return = 1.02 ** (1/252)
    cash_series = [daily_cash_return ** i for i in range(days)]
    
    portfolio_series = np.zeros(days)
    
    # Add weighted components
    if weights["cash"] > 0:
        portfolio_series += weights["cash"] * np.array(cash_series)
        
    for asset_class, ticker in tickers.items():
        if weights[asset_class] > 0:
            if ticker in normalized_data.columns:
                portfolio_series += weights[asset_class] * normalized_data[ticker].values
            else:
                # Fallback if ticker missing? Treat as cash or ignore?
                # Treat as cash for safety
                portfolio_series += weights[asset_class] * np.array(cash_series)

    # Scale by initial portfolio value
    portfolio_values = portfolio_series * initial_portfolio_value
    
    # Real Estate Benchmark (VNQ)
    if "VNQ" in normalized_data.columns:
        re_values = normalized_data["VNQ"].values * initial_portfolio_value
    else:
        re_values = np.zeros(days)

    # Format for frontend
    # Convert Timestamp index to string
    dates = hist_data.index.strftime('%Y-%m-%d').tolist()
    
    # Calculate Historical Metrics (CAGR & Volatility)
    historical_metrics = {}
    
    # Map tickers back to asset classes for the output
    ticker_to_class = {v: k for k, v in tickers.items()}
    
    for ticker in hist_data.columns:
        if ticker not in ticker_to_class:
            continue
            
        asset_class = ticker_to_class[ticker]
        series = hist_data[ticker]
        
        # CAGR
        start_val = series.iloc[0]
        end_val = series.iloc[-1]
        if start_val > 0:
            cagr = (end_val / start_val) ** (1 / years) - 1
        else:
            cagr = 0.0
            
        # Volatility (Annualized std of daily log returns)
        daily_returns = np.log(series / series.shift(1)).dropna()
        volatility = daily_returns.std() * np.sqrt(252)
        
        historical_metrics[asset_class] = {
            "return": float(cagr),
            "volatility": float(volatility)
        }
        
    # Add Cash metrics (fixed assumption)
    historical_metrics["cash"] = {
        "return": 0.02,
        "volatility": 0.01
    }

    result = {
        "dates": dates,
        "portfolio": portfolio_values.tolist(),
        "real_estate": re_values.tolist(),
        "historical_metrics": historical_metrics
    }
    
    return result
