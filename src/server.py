import os
import sys
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add current folder to sys.path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from schema import Borrower, Conversation, Turn
from state_engine import process_borrower
from rollup_metrics import compute_metrics

app = FastAPI(title="Riverline Risk Intelligence API", version="1.0.0")

# Enable CORS so our React frontend (typically on port 5173) can call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    text: str

def parse_raw_dialogue_to_conversations(text: str, borrower_id: str) -> list[dict]:
    import re
    lines = text.split("\n")
    conversations = []
    
    current_conv = None
    conv_index = 1
    turn_num = 1
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Check if line is a conversation separator, e.g.:
        # === Call 1: voice (2026-04-03) ===
        # --- Date: 2026-04-02, Channel: whatsapp ---
        # [2026-04-02, whatsapp]
        separator_match = False
        
        # Pattern 1: === Call X: channel (date) === or similar
        m1 = re.search(r'(?:===|---)\s*(?:Call|Conversation)?\s*(\d+)?:?\s*(\w+)\s*\(([\d\-]+)\)\s*(?:===|---)', line, re.IGNORECASE)
        # Pattern 2: --- Date: date, Channel: channel ---
        m2 = re.search(r'(?:===|---)?\s*Date:\s*([\d\-]+)\s*,\s*Channel:\s*(\w+)\s*(?:===|---)?', line, re.IGNORECASE)
        # Pattern 3: [date, channel] or [channel, date]
        m3 = re.search(r'\[\s*([\d\-]+)\s*,\s*(\w+)\s*\]', line)
        m3_alt = re.search(r'\[\s*(\w+)\s*,\s*([\d\-]+)\s*\]', line)
        
        extracted_date = None
        extracted_channel = None
        
        if m1:
            extracted_channel = m1.group(2).strip().lower()
            extracted_date = m1.group(3).strip()
            separator_match = True
        elif m2:
            extracted_date = m2.group(1).strip()
            extracted_channel = m2.group(2).strip().lower()
            separator_match = True
        elif m3:
            extracted_date = m3.group(1).strip()
            extracted_channel = m3.group(2).strip().lower()
            separator_match = True
        elif m3_alt:
            extracted_channel = m3_alt.group(1).strip().lower()
            extracted_date = m3_alt.group(2).strip()
            separator_match = True
            
        if separator_match:
            # Normalize channel to voice or whatsapp
            channel = "whatsapp" if any(x in extracted_channel for x in ("whatsapp", "chat", "message", "sms")) else "voice"
            current_conv = {
                "conversation_id": f"{borrower_id}-C{conv_index}",
                "date": extracted_date,
                "channel": channel,
                "turns": []
            }
            conversations.append(current_conv)
            conv_index += 1
            turn_num = 1
            continue
            
        # If it's a normal line and we don't have a conversation yet, create a default one
        if current_conv is None:
            current_conv = {
                "conversation_id": f"{borrower_id}-C{conv_index}",
                "date": "2026-06-21",
                "channel": "voice",
                "turns": []
            }
            conversations.append(current_conv)
            conv_index += 1
            
        # Parse speaker and text
        speaker = 'borrower'
        body = line
        
        if ":" in line:
            parts = line.split(":", 1)
            prefix = parts[0].strip().lower()
            body = parts[1].strip()
            
            if prefix in ("agent", "you", "collector", "representative", "riverline"):
                speaker = "agent"
            elif prefix in ("borrower", "customer", "client", "me", "payer", "priya", "vikram", "sunita", "rahul", "arjun", "meena"):
                speaker = "borrower"
            else:
                if "agent" in prefix or "collector" in prefix:
                    speaker = "agent"
                else:
                    speaker = "borrower"
        else:
            if current_conv["turns"]:
                last_speaker = current_conv["turns"][-1]["speaker"]
                speaker = "borrower" if last_speaker == "agent" else "agent"
            else:
                speaker = "agent"
                
        current_conv["turns"].append({
            "turn": turn_num,
            "speaker": speaker,
            "text": body
        })
        turn_num += 1
        
    return conversations

# In-memory session caches to support read-only serverless environments like Vercel
dynamic_borrowers = []
dynamic_runs = []

@app.get("/api/borrowers")
def get_borrowers():
    import json
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "examples", "sample_run_output.json")
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = []
        
    # Merge with in-memory dynamic runs (ensuring no duplicates by borrower_id)
    existing_ids = {item["borrower_id"] for item in data if "borrower_id" in item}
    for run in dynamic_runs:
        if run["borrower_id"] not in existing_ids:
            data.append(run)
            existing_ids.add(run["borrower_id"])
            
    return data

@app.post("/api/reset")
def reset_portfolio():
    import json
    import shutil
    global dynamic_borrowers, dynamic_runs
    dynamic_borrowers.clear()
    dynamic_runs.clear()
    
    try:
        # File paths
        backup_borrowers = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "synthetic_borrowers_backup.json")
        target_borrowers = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "synthetic_borrowers.json")
        
        backup_runs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "examples", "sample_run_output_backup.json")
        target_runs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "examples", "sample_run_output.json")
        
        dashboard_runs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dashboard", "src", "assets", "sample_run_output.json")
        
        # Reset files
        if os.path.exists(backup_borrowers):
            shutil.copyfile(backup_borrowers, target_borrowers)
        if os.path.exists(backup_runs):
            shutil.copyfile(backup_runs, target_runs)
            os.makedirs(os.path.dirname(dashboard_runs), exist_ok=True)
            shutil.copyfile(backup_runs, dashboard_runs)
    except Exception as e:
        print(f"Warning: file reset failed (expected on read-only serverless systems): {e}")
        
    # Always load data from target_runs or fallback to backup_runs
    try:
        with open(target_runs, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        try:
            with open(backup_runs, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = []
            
    return {"status": "success", "data": data}

@app.post("/api/analyze")
def analyze_conversation(req: AnalyzeRequest):
    import json
    try:
        # 1. Load existing synthetic borrowers to determine next ID and append new record
        data_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "synthetic_borrowers.json")
        try:
            with open(data_path, "r", encoding="utf-8") as f:
                existing_borrowers = json.load(f)
        except Exception:
            existing_borrowers = []
            
        # Merge with in-memory dynamic borrowers
        existing_b_ids = {b["borrower_id"] for b in existing_borrowers if "borrower_id" in b}
        for b in dynamic_borrowers:
            if b["borrower_id"] not in existing_b_ids:
                existing_borrowers.append(b)
                existing_b_ids.add(b["borrower_id"])
                
        # Find next B-XXXX ID
        max_num = 0
        for b in existing_borrowers:
            bid = b.get("borrower_id", "")
            if bid.startswith("B-"):
                try:
                    num = int(bid.split("-")[1])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
        new_id_num = max_num + 1
        borrower_id = f"B-{new_id_num:04d}"
        
        conversations_data = parse_raw_dialogue_to_conversations(req.text, borrower_id)
        if not conversations_data:
            raise HTTPException(status_code=400, detail="Could not parse any dialogue lines or conversation blocks from the input.")
            
        new_borrower_record = {
            "borrower_id": borrower_id,
            "persona_notes": f"Dialogue evaluator submission: custom script parsed at conversation count {len(conversations_data)}",
            "conversations": conversations_data
        }
        
        dynamic_borrowers.append(new_borrower_record)
        existing_borrowers.append(new_borrower_record)
        
        try:
            with open(data_path, "w", encoding="utf-8") as f:
                json.dump(existing_borrowers, f, indent=2)
        except Exception as e:
            print(f"Warning: could not write to {data_path} (read-only filesystem): {e}")
            
        # 2. Run state engine to calculate metrics and transitions
        conversations = []
        for conv_data in conversations_data:
            turns = [
                Turn(turn=t["turn"], speaker=t["speaker"], text=t["text"]) 
                for t in conv_data["turns"]
            ]
            conversation = Conversation(
                conversation_id=conv_data["conversation_id"],
                date=conv_data["date"],
                channel=conv_data["channel"],
                turns=turns
            )
            conversations.append(conversation)
            
        borrower = Borrower(
            borrower_id=borrower_id,
            persona_notes=new_borrower_record["persona_notes"],
            conversations=conversations
        )
        
        final_state, risk_flags, compliance_flags_count, turn_outcomes, state_regressions = process_borrower(borrower)
        metrics = compute_metrics(
            borrower=borrower,
            final_state=final_state,
            risk_flags=risk_flags,
            compliance_flags_count=compliance_flags_count,
            turn_outcomes=turn_outcomes,
            state_regressions=state_regressions
        )
        
        # Format turns with detail fields for timeline display
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
            
        new_run_output = {
            "borrower_id": borrower.borrower_id,
            "persona_notes": borrower.persona_notes,
            "metrics": metrics,
            "turn_outcomes": serialized_turns
        }
        
        dynamic_runs.append(new_run_output)
        
        # 3. Load, append, and save to sample_run_output.json (examples and dashboard assets)
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "examples", "sample_run_output.json")
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                run_outputs = json.load(f)
        except Exception:
            run_outputs = []
            
        # Merge with in-memory runs
        existing_run_ids = {r["borrower_id"] for r in run_outputs if "borrower_id" in r}
        for run in dynamic_runs:
            if run["borrower_id"] not in existing_run_ids:
                run_outputs.append(run)
                existing_run_ids.add(run["borrower_id"])
                
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(run_outputs, f, indent=2)
        except Exception as e:
            print(f"Warning: could not write to {output_path} (read-only filesystem): {e}")
            
        dashboard_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dashboard", "src", "assets", "sample_run_output.json")
        try:
            os.makedirs(os.path.dirname(dashboard_path), exist_ok=True)
            with open(dashboard_path, "w", encoding="utf-8") as f:
                json.dump(run_outputs, f, indent=2)
        except Exception as e:
            print(f"Warning: could not write to {dashboard_path} (read-only filesystem): {e}")
            
        return new_run_output
        
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error analyzing conversation: {error_details}")
        raise HTTPException(
            status_code=500, 
            detail=f"Analysis failed: {str(e)}\n{error_details}"
        )

if __name__ == "__main__":
    import uvicorn
    # Only watch the src directory for changes to avoid restarts when writing data/dashboard files
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True, reload_dirs=[os.path.dirname(os.path.abspath(__file__))])
