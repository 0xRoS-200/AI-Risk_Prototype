import logging
from typing import List, Tuple

from schema import Turn, BorrowerState, EngineOutput, TRANSITION_TABLE
from llm_router import route_completion

logger = logging.getLogger("classify_turn")

def build_prompt(current_state: BorrowerState, turn: Turn, context: List[Turn]) -> str:
    """
    Constructs the prompt given the current state, the allowed transitions, 
    the recent context, and the new turn to classify.
    """
    allowed_states = TRANSITION_TABLE[current_state]
    allowed_names = [s.value for s in allowed_states]
    
    context_text = "\n".join([f"Turn {t.turn} ({t.speaker}): {t.text}" for t in context])
    if not context_text.strip():
        context_text = "(No prior context in this conversation)"
        
    current_text = f"Turn {turn.turn} ({turn.speaker}): {turn.text}"
    
    prompt = f"""You are the core intelligence of Riverline's Risk Engine.
Your job is to read the latest turn of a conversation between a debt collection agent and a borrower, and determine if the borrower's state has changed.

CURRENT STATE: {current_state.value}

ALLOWED NEXT STATES:
{', '.join(allowed_names)}
Note: If no valid transition occurred, you must propose the CURRENT STATE ({current_state.value}). You MUST NOT propose any state outside of the ALLOWED NEXT STATES or the CURRENT STATE.

CONVERSATION CONTEXT (recent turns):
{context_text}

LATEST TURN TO CLASSIFY:
{current_text}

Your task:
1. Include the 'turn' number.
2. Include the 'current_state' ({current_state.value}).
3. Determine the 'proposed_state'.
4. Provide a 'transition_reason' (1 short sentence explaining why).
5. Extract any 'risk_flags' (e.g. ['financial_stress', 'hostility']) if present.
6. Evaluate 'compliance_flag' (boolean) - set to true ONLY IF the AGENT (not the borrower) violated fair-practice tone (e.g. threatening, pressuring despite hardship).
7. If compliance_flag is true, provide a 'compliance_reason'.
8. Provide a 'confidence' score between 0.0 and 1.0.

Respond strictly with a valid JSON object matching this exact structure:
{{
  "turn": {turn.turn},
  "current_state": "{current_state.value}",
  "proposed_state": "<one of the allowed states>",
  "transition_reason": "<short explanation>",
  "risk_flags": [],
  "compliance_flag": false,
  "compliance_reason": null,
  "confidence": 0.9
}}

Ensure the 'turn' field in your output matches the turn number of the LATEST TURN ({turn.turn}).
"""
    return prompt

def classify(current_state: BorrowerState, turn: Turn, context: List[Turn]) -> Tuple[EngineOutput, str]:
    """
    Calls the LLM router to classify a single turn.
    Returns the structured EngineOutput and the name of the LLM provider used.
    """
    prompt = build_prompt(current_state, turn, context)
    return route_completion(prompt, EngineOutput)

if __name__ == "__main__":
    # Simple isolated smoke test
    from schema import Turn, BorrowerState
    mock_turn = Turn(turn=1, speaker="borrower", text="I lost my job last week, I really can't pay this EMI right now.")
    result, provider = classify(BorrowerState.ENGAGED, mock_turn, [])
    print(f"Classified via {provider}:")
    print(result.model_dump_json(indent=2))
