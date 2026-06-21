import json
import os
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

def generate_visualizations():
    data_path = os.path.join(os.path.dirname(__file__), "..", "examples", "sample_run_output.json")
    if not os.path.exists(data_path):
        print(f"Data file not found at {data_path}. Run run_engine.py first.")
        return
        
    with open(data_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
        
    if not raw_data:
        print("No data found in sample_run_output.json")
        return

    # Extract metrics into a DataFrame
    df_list = []
    for d in raw_data:
        metrics = d["metrics"]
        df_list.append({
            "borrower_id": metrics["borrower_id"],
            "tier": metrics["tier"],
            "current_state": metrics["current_state"],
            "promise_keep_rate": metrics["promise_keep_rate"],
            "state_regressions": metrics["state_regressions"],
            "risk_flag_density": metrics["risk_flag_density"],
            "compliance_flags_total": metrics["compliance_flags_total"]
        })
        
    df = pd.DataFrame(df_list)
    
    # Set seaborn style
    sns.set_theme(style="whitegrid")
    
    # Create an output directory for plots
    plots_dir = os.path.join(os.path.dirname(__file__), "..", "examples", "plots")
    os.makedirs(plots_dir, exist_ok=True)
    
    # Plot 1: Borrowers by Tier
    plt.figure(figsize=(8, 5))
    tier_order = ["Green", "Amber", "Red"]
    palette = {"Green": "#2ecc71", "Amber": "#f39c12", "Red": "#e74c3c"}
    sns.countplot(data=df, x="tier", order=tier_order, palette=palette)
    plt.title("Borrowers by Risk Tier")
    plt.ylabel("Count")
    plt.xlabel("Tier")
    plt.savefig(os.path.join(plots_dir, "tier_distribution.png"))
    plt.close()
    
    # Plot 2: Final State Distribution
    plt.figure(figsize=(10, 6))
    sns.countplot(data=df, y="current_state", order=df["current_state"].value_counts().index, palette="viridis")
    plt.title("Final Borrower States")
    plt.xlabel("Count")
    plt.ylabel("State")
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, "final_states.png"))
    plt.close()
    
    # Plot 3: Risk Flag Density vs Regressions
    plt.figure(figsize=(8, 6))
    sns.scatterplot(data=df, x="state_regressions", y="risk_flag_density", hue="tier", palette=palette, s=100)
    plt.title("Risk Flag Density vs State Regressions")
    plt.xlabel("State Regressions")
    plt.ylabel("Risk Flag Density (flags per turn)")
    plt.savefig(os.path.join(plots_dir, "risk_vs_regressions.png"))
    plt.close()
    
    print(f"Generated {len(df)} borrower metrics visualizations in {plots_dir}")

if __name__ == "__main__":
    generate_visualizations()
