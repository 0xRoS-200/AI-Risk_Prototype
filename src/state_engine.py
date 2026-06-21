import time
import logging
from typing import Tuple, List

from schema import Borrower, BorrowerState, EngineOutput, is_valid_transition
from classify_turn import classify

logger = logging.getLogger("state_engine")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def process_borrower(borrower: Borrower, context_window_size: int = 4) -> Tuple[BorrowerState, List[str], int, List[EngineOutput], int]:
    """
    Walks a single borrower's full history, turn by turn, updating state and collecting flags.
    Returns: (final_state, risk_flags, compliance_flags_count, list_of_turn_outcomes, state_regressions)
    """
    current_state = BorrowerState.NEW
    risk_flags = set()
    compliance_flags_count = 0
    turn_outcomes = []
    state_regressions = 0
    
    recent_context = []

    for conversation in borrower.conversations:
        for turn in conversation.turns:
            try:
                outcome, provider = classify(current_state, turn, recent_context)
                
                # Validation Rail
                actual_next_state = current_state
                if outcome.proposed_state != current_state:
                    if is_valid_transition(current_state, outcome.proposed_state):
                        logger.info(f"[{borrower.borrower_id}] Valid transition: {current_state.value} -> {outcome.proposed_state.value}")
                        actual_next_state = outcome.proposed_state
                        
                        # Check for regressions
                        if actual_next_state in (BorrowerState.PROMISE_BROKEN, BorrowerState.ESCALATED):
                            state_regressions += 1
                            
                    else:
                        logger.warning(
                            f"[{borrower.borrower_id}] Invalid proposed transition {current_state.value} -> {outcome.proposed_state.value}. "
                            "Rejecting and holding current state."
                        )
                        # Override outcome to reflect rejection
                        outcome.proposed_state = current_state
                        outcome.transition_reason = f"[REJECTED] {outcome.transition_reason}"
                
                current_state = actual_next_state

                # Accumulate flags
                for flag in outcome.risk_flags:
                    risk_flags.add(flag)
                
                if outcome.compliance_flag:
                    compliance_flags_count += 1
                
                turn_outcomes.append(outcome)

            except Exception as e:
                logger.error(f"Error classifying turn {turn.turn} for borrower {borrower.borrower_id}: {e}")
                fallback = EngineOutput(
                    turn=turn.turn,
                    current_state=current_state,
                    proposed_state=current_state,
                    transition_reason=f"Failed classification: {str(e)}",
                    confidence=0.0
                )
                turn_outcomes.append(fallback)
            
            # Update context window
            recent_context.append(turn)
            if len(recent_context) > context_window_size:
                recent_context.pop(0)

    return current_state, list(risk_flags), compliance_flags_count, turn_outcomes, state_regressions
