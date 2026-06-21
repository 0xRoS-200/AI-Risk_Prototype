"""
generate_data.py — loads the synthetic borrower dataset and validates
every record against the Pydantic models in schema.py.

Why does this file exist, if the data is already hand-written?

Because "the JSON looks right" and "the JSON IS right" are different
claims. A typo in a speaker field ("borower" instead of "borrower"),
a missing field, a turn number that's a string instead of an int —
none of these are visible just by reading the file. This script is
the gatekeeper: nothing downstream (classify_turn.py, state_engine.py)
should ever read the raw JSON file directly. They should always go
through this loader, so they can trust the data is shaped correctly.

Run this file directly to see a quick validation report.
"""

import json
from pathlib import Path

from schema import Borrower

DATA_PATH = Path(__file__).parent.parent / "data" / "synthetic_borrowers.json"


def load_borrowers() -> list[Borrower]:
    """
    Load synthetic_borrowers.json and parse every record into a
    Borrower object (which itself contains Conversation objects,
    which contain Turn objects — Pydantic validates the whole
    nested structure in one go).

    If any record is malformed, this raises immediately with a
    clear error telling you exactly which borrower and which field
    is the problem — rather than failing mysteriously three files
    later inside an LLM prompt.
    """
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    borrowers = [Borrower(**record) for record in raw]
    return borrowers


if __name__ == "__main__":
    borrowers = load_borrowers()

    total_conversations = sum(len(b.conversations) for b in borrowers)
    total_turns = sum(
        len(c.turns) for b in borrowers for c in b.conversations
    )

    print(f"✓ Loaded and validated {len(borrowers)} borrowers")
    print(f"✓ {total_conversations} total conversations")
    print(f"✓ {total_turns} total turns")
    print()

    # Print a quick summary table so you can eyeball the dataset shape
    print(f"{'Borrower':<10} {'Conversations':<15} {'Turns':<8} Notes")
    print("-" * 80)
    for b in borrowers:
        turns = sum(len(c.turns) for c in b.conversations)
        notes = (b.persona_notes or "")[:50]
        print(f"{b.borrower_id:<10} {len(b.conversations):<15} {turns:<8} {notes}")
