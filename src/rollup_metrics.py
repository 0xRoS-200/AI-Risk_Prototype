from typing import List, Dict, Any
from schema import BorrowerState, EngineOutput, Borrower

def compute_metrics(
    borrower: Borrower,
    final_state: BorrowerState,
    risk_flags: List[str],
    compliance_flags_count: int,
    turn_outcomes: List[EngineOutput],
    state_regressions: int
) -> Dict[str, Any]:
    
    total_turns = len(turn_outcomes)
    
    # Calculate time to first promise (in turns)
    time_to_first_promise = None
    promises_made = 0
    promises_kept = 0
    
    for i, outcome in enumerate(turn_outcomes):
        if outcome.proposed_state == BorrowerState.PROMISE_MADE:
            promises_made += 1
            if time_to_first_promise is None:
                time_to_first_promise = i + 1
                
        elif outcome.proposed_state == BorrowerState.PROMISE_KEPT:
            promises_kept += 1

    promise_keep_rate = (promises_kept / promises_made) if promises_made > 0 else 0.0
    risk_flag_density = len(risk_flags) / total_turns if total_turns > 0 else 0.0
    
    # Determine Tier
    tier = "Unknown"
    
    # Green: current_state in {ENGAGED, PROMISE_MADE, PROMISE_KEPT, RESOLVED} and state_regressions == 0
    if final_state in (BorrowerState.ENGAGED, BorrowerState.PROMISE_MADE, BorrowerState.PROMISE_KEPT, BorrowerState.RESOLVED) and state_regressions == 0:
        tier = "Green"
        
    # Red: state_regressions >= 2 OR current_state == ESCALATED OR current_state == GHOSTED with 2+ conversations
    elif state_regressions >= 2 or final_state == BorrowerState.ESCALATED or (final_state == BorrowerState.GHOSTED and len(borrower.conversations) >= 2):
        tier = "Red"
        
    # Amber: HARDSHIP_FLAGGED (regardless of regressions) OR exactly one regression
    elif final_state == BorrowerState.HARDSHIP_FLAGGED or state_regressions == 1:
        tier = "Amber"
        
    # Fallback to Amber if not explicitly covered
    if tier == "Unknown":
        if final_state == BorrowerState.GHOSTED:
            tier = "Amber"
        else:
            tier = "Amber"
            
    return {
        "borrower_id": borrower.borrower_id,
        "current_state": final_state.value,
        "tier": tier,
        "time_to_first_promise_turns": time_to_first_promise,
        "promise_keep_rate": promise_keep_rate,
        "state_regressions": state_regressions,
        "risk_flag_density": risk_flag_density,
        "compliance_flags_total": compliance_flags_count,
        "unique_risk_flags": risk_flags
    }
