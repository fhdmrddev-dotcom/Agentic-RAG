"""Worked Example: Sandboxed Code Execution.

This script demonstrates how custom client transforms and computational data routines
run within the Agentic RAG sandbox boundary (Mechanism 3).

Execution Environment:
- Pinned Docker container (`agentic-rag-sandbox:101.1`)
- No host filesystem access; no network egress
- Runs via the `execute_code` tool routed to `sandbox_service.py`
"""

import json
import sys
import numpy as np
import pandas as pd


def compute_portfolio_risk(data: list[dict]) -> dict:
    """Calculate Sharpe ratio, value at risk (VaR), and rolling volatility."""
    df = pd.DataFrame(data)
    if "return" not in df.columns:
        return {"error": "Missing 'return' column in input data"}

    returns = df["return"].to_numpy()
    mean_return = np.mean(returns)
    std_dev = np.std(returns)

    # Risk-free rate assumed at 2% annualized
    rf_daily = 0.02 / 252
    sharpe = (mean_return - rf_daily) / std_dev if std_dev > 0 else 0.0

    # 95% historical Value at Risk
    var_95 = np.percentile(returns, 5)

    return {
        "observations": len(returns),
        "mean_daily_return": round(float(mean_return), 6),
        "annualized_volatility": round(float(std_dev * np.sqrt(252)), 4),
        "sharpe_ratio": round(float(sharpe * np.sqrt(252)), 2),
        "historical_var_95": round(float(var_95), 4),
    }


if __name__ == "__main__":
    # The agent passes inputs via stdin or pre-populated JSON files in /workspace
    sample_input = [
        {"day": 1, "return": 0.005},
        {"day": 2, "return": -0.002},
        {"day": 3, "return": 0.008},
        {"day": 4, "return": -0.012},
        {"day": 5, "return": 0.004},
        {"day": 6, "return": 0.001},
        {"day": 7, "return": -0.003},
    ]

    metrics = compute_portfolio_risk(sample_input)
    print("--- COMPUTATION RESULT ---")
    print(json.dumps(metrics, indent=2))
