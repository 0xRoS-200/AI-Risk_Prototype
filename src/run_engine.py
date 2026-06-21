import json
import os
import sys

from schema import Borrower
from state_engine import process_borrower
from rollup_metrics import compute_metrics

def main():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_borrowers.json")
    output_path = os.path.join(os.path.dirname(__file__), "..", "examples", "sample_run_output.json")
    
    with open(data_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
        
    results = []
    
    for b_data in raw_data:
        borrower = Borrower.model_validate(b_data)
        print(f"Processing borrower: {borrower.borrower_id}")
        
        final_state, risk_flags, compliance_flags_count, turn_outcomes, state_regressions = process_borrower(borrower)
        
        metrics = compute_metrics(
            borrower=borrower,
            final_state=final_state,
            risk_flags=risk_flags,
            compliance_flags_count=compliance_flags_count,
            turn_outcomes=turn_outcomes,
            state_regressions=state_regressions
        )
        
        # Serialize turn outcomes and inject dialogue text, speaker, and call metadata for the UI
        serialized_turns = []
        raw_turns_flat = []
        for conv in borrower.conversations:
            for turn in conv.turns:
                raw_turns_flat.append({
                    "text": turn.text,
                    "speaker": turn.speaker,
                    "channel": conv.channel,
                    "date": conv.date,
                    "conversation_id": conv.conversation_id
                })
        
        for idx, outcome in enumerate(turn_outcomes):
            out_dict = outcome.model_dump()
            if idx < len(raw_turns_flat):
                out_dict.update(raw_turns_flat[idx])
            serialized_turns.append(out_dict)
        
        results.append({
            "borrower_id": borrower.borrower_id,
            "persona_notes": borrower.persona_notes,
            "metrics": metrics,
            "turn_outcomes": serialized_turns
        })
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        
    print(f"Done! Processed {len(results)} borrowers. Output saved to {output_path}")

    # Also save to dashboard assets if the dashboard directory exists
    dashboard_path = os.path.join(os.path.dirname(__file__), "..", "dashboard", "src", "assets", "sample_run_output.json")
    try:
        os.makedirs(os.path.dirname(dashboard_path), exist_ok=True)
        with open(dashboard_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"Output also saved to dashboard assets: {dashboard_path}")
    except Exception as e:
        print(f"Note: Could not write copy to dashboard assets: {e}")

if __name__ == "__main__":
    main()
