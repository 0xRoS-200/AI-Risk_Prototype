"""
schema.py — the foundation everything else imports from.

This file defines THREE things, in order:
1. The states a borrower can be in (an Enum)
2. The transition table — which states can move to which (a plain dict)
3. The data shapes for what flows through the system (Pydantic models)

Nothing in here calls an LLM or does any "thinking" — this file just
defines the *shape* of truth. Every other file in this project trusts
that the shapes defined here are correct, so this is the file most
worth re-reading carefully before moving on.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────
# 1. STATES
# ─────────────────────────────────────────────────────────────────
#
# Why an Enum and not just strings like "ENGAGED"?
#
# If you use raw strings scattered across files, a typo like
# "ENGGAGED" is just... a different string. Python won't complain.
# Your state machine will silently break somewhere far from where
# the bug actually is, and you'll lose an hour figuring out why.
#
# An Enum is Python's way of saying "this variable can ONLY be one
# of these exact named values, nothing else." If you misspell it,
# Python throws an error immediately, at the exact line you made
# the mistake. That immediate feedback is the entire point.

class BorrowerState(str, Enum):
    """
    Every possible state a borrower can be in, across their
    lifecycle of conversations with Riverline's agent.

    Inheriting from `str` (not just `Enum`) is a small but useful
    trick: it means BorrowerState.NEW behaves like the string "NEW"
    when you print it, save it to JSON, or compare it — without
    losing the safety benefits of being an Enum. You'll see why
    this matters once we serialize to JSON later.
    """
    NEW = "NEW"
    ENGAGED = "ENGAGED"
    DISPUTING = "DISPUTING"
    HARDSHIP_FLAGGED = "HARDSHIP_FLAGGED"
    PROMISE_MADE = "PROMISE_MADE"
    PROMISE_KEPT = "PROMISE_KEPT"
    PROMISE_BROKEN = "PROMISE_BROKEN"
    ESCALATED = "ESCALATED"
    GHOSTED = "GHOSTED"
    RESOLVED = "RESOLVED"


# ─────────────────────────────────────────────────────────────────
# 2. TRANSITION TABLE
# ─────────────────────────────────────────────────────────────────
#
# This dict is the actual "state machine" part of the project.
# Everything else (the LLM call, the validation logic) just USES
# this table — they don't define the rules, this does.
#
# Read it as: "if a borrower is currently in state X, the ONLY
# states they're allowed to move into next are this list."
#
# This is straight from Section 4.2 of DOCUMENTATION.md.

TRANSITION_TABLE: dict[BorrowerState, list[BorrowerState]] = {
    BorrowerState.NEW: [
        BorrowerState.ENGAGED,
        BorrowerState.ESCALATED,
        BorrowerState.GHOSTED,
    ],
    BorrowerState.ENGAGED: [
        BorrowerState.DISPUTING,
        BorrowerState.HARDSHIP_FLAGGED,
        BorrowerState.PROMISE_MADE,
        BorrowerState.ESCALATED,
        BorrowerState.GHOSTED,
    ],
    BorrowerState.DISPUTING: [
        BorrowerState.ENGAGED,
        BorrowerState.ESCALATED,
        BorrowerState.RESOLVED,
    ],
    BorrowerState.HARDSHIP_FLAGGED: [
        BorrowerState.PROMISE_MADE,
        BorrowerState.RESOLVED,
        BorrowerState.ESCALATED,
    ],
    BorrowerState.PROMISE_MADE: [
        BorrowerState.PROMISE_KEPT,
        BorrowerState.PROMISE_BROKEN,
        BorrowerState.ESCALATED,
    ],
    BorrowerState.PROMISE_BROKEN: [
        BorrowerState.PROMISE_MADE,
        BorrowerState.ESCALATED,
        BorrowerState.HARDSHIP_FLAGGED,
    ],
    BorrowerState.ESCALATED: [
        BorrowerState.HARDSHIP_FLAGGED,
        BorrowerState.RESOLVED,
    ],
    BorrowerState.GHOSTED: [
        BorrowerState.ENGAGED,
    ],
    # PROMISE_KEPT and RESOLVED are terminal (positive) states —
    # empty list means "no valid transitions out of here."
    BorrowerState.PROMISE_KEPT: [],
    BorrowerState.RESOLVED: [],
}


def is_valid_transition(current: BorrowerState, proposed: BorrowerState) -> bool:
    """
    The single source of truth for 'is this state change allowed?'

    state_engine.py will call this function later — it should NEVER
    duplicate this logic itself. One function, one place, one truth.
    """
    return proposed in TRANSITION_TABLE[current]


# ─────────────────────────────────────────────────────────────────
# 3. DATA SHAPES (Pydantic models)
# ─────────────────────────────────────────────────────────────────
#
# What is Pydantic actually doing for us here?
#
# A plain Python dict like {"turn": 4, "text": "hello"} has no
# guarantees. Nothing stops someone (including an LLM, including
# future-you) from accidentally writing {"turn": "four", "txt": "hi"}
# instead — wrong type, wrong key name — and you won't find out
# until your code crashes somewhere downstream, confusingly.
#
# A Pydantic model is a class that describes EXACTLY what fields
# are allowed, what type each one must be, and which are optional.
# If you try to create one with bad data, Pydantic raises a clear
# error immediately, naming exactly which field is wrong and why.
#
# This matters enormously once we're parsing LLM output — LLMs
# sometimes return slightly malformed JSON, or use a state name
# that doesn't exist. Pydantic is our first line of defense against
# trusting bad data.

class Turn(BaseModel):
    """One line of conversation — either the agent or the borrower speaking."""
    turn: int
    speaker: str  # "agent" or "borrower"
    text: str


class Conversation(BaseModel):
    """One full call or WhatsApp thread — an ordered list of turns."""
    conversation_id: str
    date: str
    channel: str  # "voice" or "whatsapp"
    turns: list[Turn]


class Borrower(BaseModel):
    """One borrower's full history — possibly multiple conversations over time."""
    borrower_id: str
    persona_notes: Optional[str] = None
    conversations: list[Conversation]


class EngineOutput(BaseModel):
    """
    What we expect back after asking the LLM to look at one turn
    and decide if a state transition just happened.

    This is the shape classify_turn.py will ask the LLM to fill in,
    and the shape state_engine.py will validate against the
    transition table before trusting it.
    """
    turn: int
    current_state: BorrowerState
    proposed_state: BorrowerState
    transition_reason: str = Field(
        description="One sentence: why this transition, in plain language"
    )
    risk_flags: list[str] = Field(default_factory=list)
    compliance_flag: bool = False
    compliance_reason: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    # ge=0.0, le=1.0 means "greater-or-equal to 0, less-or-equal to 1"
    # — Pydantic will reject a confidence of 1.5 automatically.


# ─────────────────────────────────────────────────────────────────
# Quick self-test — run this file directly to sanity-check everything
# ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Test 1: a valid transition
    assert is_valid_transition(BorrowerState.NEW, BorrowerState.ENGAGED) is True
    print("✓ NEW -> ENGAGED is correctly valid")

    # Test 2: an invalid transition (this is the whole point of the project)
    assert is_valid_transition(BorrowerState.NEW, BorrowerState.RESOLVED) is False
    print("✓ NEW -> RESOLVED is correctly rejected")

    # Test 3: build a real EngineOutput and see Pydantic validate it
    example = EngineOutput(
        turn=4,
        current_state=BorrowerState.ENGAGED,
        proposed_state=BorrowerState.PROMISE_MADE,
        transition_reason="Borrower committed to paying ₹5,000 by Friday",
        risk_flags=["financial_stress_mentioned"],
        confidence=0.84,
    )
    print("✓ EngineOutput built successfully:")
    print(example.model_dump_json(indent=2))

    # Test 4: prove Pydantic actually catches bad data
    try:
        EngineOutput(
            turn=4,
            current_state=BorrowerState.ENGAGED,
            proposed_state=BorrowerState.PROMISE_MADE,
            transition_reason="test",
            confidence=1.5,  # invalid: above 1.0
        )
        print("✗ This should have failed but didn't!")
    except Exception as e:
        print(f"✓ Pydantic correctly rejected confidence=1.5: {type(e).__name__}")

    print("\nAll checks passed. schema.py is solid.")
