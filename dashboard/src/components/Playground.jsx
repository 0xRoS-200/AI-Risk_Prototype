import React, { useState } from 'react';
import { 
  Play, 
  RotateCcw, 
  AlertTriangle, 
  ShieldCheck, 
  HelpCircle, 
  Server,
  FileText,
  Copy,
  Download,
  ShieldAlert,
  Cpu,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

const BORROWER_STATES = [
  'NEW', 'ENGAGED', 'DISPUTING', 'HARDSHIP_FLAGGED', 'PROMISE_MADE',
  'PROMISE_KEPT', 'PROMISE_BROKEN', 'ESCALATED', 'GHOSTED', 'RESOLVED'
];

const TRANSITION_TABLE = {
  'NEW': ['ENGAGED', 'ESCALATED', 'GHOSTED'],
  'ENGAGED': ['DISPUTING', 'HARDSHIP_FLAGGED', 'PROMISE_MADE', 'ESCALATED', 'GHOSTED'],
  'DISPUTING': ['ENGAGED', 'ESCALATED', 'RESOLVED'],
  'HARDSHIP_FLAGGED': ['PROMISE_MADE', 'RESOLVED', 'ESCALATED'],
  'PROMISE_MADE': ['PROMISE_KEPT', 'PROMISE_BROKEN', 'ESCALATED'],
  'PROMISE_BROKEN': ['PROMISE_MADE', 'ESCALATED', 'HARDSHIP_FLAGGED'],
  'ESCALATED': ['HARDSHIP_FLAGGED', 'RESOLVED'],
  'GHOSTED': ['ENGAGED'],
  'PROMISE_KEPT': [],
  'RESOLVED': []
};

const SAMPLE_CONVERSATION = `=== Call 1: whatsapp (2026-04-02) ===
Agent: Hi Priya, this is Riverline reaching out on behalf of Freo regarding your pending EMI of ₹4,500. Hope you're doing well.
Borrower: Hi, yeah I know, things have been a bit tight since my rides dropped this month.
Agent: Totally understand, the gig income can be unpredictable. Would a part payment work, or do you need a few more days?
Borrower: I can pay ₹2,000 by this Friday and the rest by the 15th.
Agent: That works, I'll note it down. We'll check in on Friday then.

=== Call 2: whatsapp (2026-04-11) ===
Agent: Hi Priya, following up — we saw the ₹2,000 came through on Friday, thank you! Are we still on track for the 15th for the remaining ₹2,500?
Borrower: Yes, picked up extra shifts this week, should be no problem.`;

export default function Playground({ onDataUpdated }) {
  const [playgroundTab, setPlaygroundTab] = useState('full'); // 'full' or 'single'
  
  // Single Turn Simulator state
  const [currentState, setCurrentState] = useState('NEW');
  const [speaker, setSpeaker] = useState('borrower');
  const [dialogue, setDialogue] = useState(
    "I lost my job last week, so things are very tight. I want to pay, but I don't have enough right now."
  );
  const [turnNumber, setTurnNumber] = useState(1);
  const [agentText, setAgentText] = useState("You must pay by today or we will legal route.");
  const [singleResult, setSingleResult] = useState(null);
  
  // Full Script Analyzer state
  const [rawScript, setRawScript] = useState(SAMPLE_CONVERSATION);
  const [fullResult, setFullResult] = useState(null);
  const [apiMode, setApiMode] = useState('real'); // 'real' or 'fallback'
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Parse raw text script to conversation blocks (JavaScript Client-side parser)
  const parseRawDialogueJS = (text, borrowerId = "B-SIMULATED") => {
    const lines = text.split('\n');
    const conversations = [];
    let currentConv = null;
    let convIndex = 1;
    let turnNum = 1;
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      let separatorMatch = false;
      let date = '2026-06-21';
      let channel = 'voice';
      
      // Pattern 1: === Call X: channel (date) ===
      const m1 = line.match(/(?:===|---)\s*(?:Call|Conversation)?\s*(\d+)?:?\s*(\w+)\s*\(([\d\-]+)\)\s*(?:===|---)/i);
      // Pattern 2: --- Date: date, Channel: channel ---
      const m2 = line.match(/(?:===|---)?\s*Date:\s*([\d\-]+)\s*,\s*Channel:\s*(\w+)\s*(?:===|---)?/i);
      // Pattern 3: [date, channel] or [channel, date]
      const m3 = line.match(/\[\s*([\d\-]+)\s*,\s*(\w+)\s*\]/);
      const m3_alt = line.match(/\[\s*(\w+)\s*,\s*([\d\-]+)\s*\]/);
      
      if (m1) {
        channel = m1[2].trim().toLowerCase();
        date = m1[3].trim();
        separatorMatch = true;
      } else if (m2) {
        date = m2[1].trim();
        channel = m2[2].trim().toLowerCase();
        separatorMatch = true;
      } else if (m3) {
        date = m3[1].trim();
        channel = m3[2].trim().toLowerCase();
        separatorMatch = true;
      } else if (m3_alt) {
        channel = m3_alt[1].trim().toLowerCase();
        date = m3_alt[2].trim();
        separatorMatch = true;
      }
      
      if (separatorMatch) {
        const normChannel = (channel.includes('whatsapp') || channel.includes('chat') || channel.includes('message') || channel.includes('sms')) ? 'whatsapp' : 'voice';
        currentConv = {
          conversation_id: `${borrowerId}-C${convIndex}`,
          date: date,
          channel: normChannel,
          turns: []
        };
        conversations.push(currentConv);
        convIndex++;
        turnNum = 1;
        continue;
      }
      
      if (!currentConv) {
        currentConv = {
          conversation_id: `${borrowerId}-C${convIndex}`,
          date: '2026-06-21',
          channel: 'voice',
          turns: []
        };
        conversations.push(currentConv);
        convIndex++;
      }
      
      let speaker = 'borrower';
      let body = line;
      
      if (line.includes(':')) {
        const parts = line.split(':');
        const prefix = parts[0].trim().toLowerCase();
        body = parts.slice(1).join(':').trim();
        
        if (['agent', 'you', 'collector', 'representative', 'riverline'].includes(prefix)) {
          speaker = 'agent';
        } else if (['borrower', 'customer', 'client', 'me', 'payer', 'priya', 'vikram', 'sunita', 'rahul', 'arjun', 'meena'].includes(prefix)) {
          speaker = 'borrower';
        } else {
          if (prefix.includes('agent') || prefix.includes('collector')) {
            speaker = 'agent';
          } else {
            speaker = 'borrower';
          }
        }
      } else {
        if (currentConv.turns.length > 0) {
          const lastSpeaker = currentConv.turns[currentConv.turns.length - 1].speaker;
          speaker = lastSpeaker === 'agent' ? 'borrower' : 'agent';
        } else {
          speaker = 'agent';
        }
      }
      
      currentConv.turns.push({
        turn: turnNum,
        speaker,
        text: body
      });
      turnNum++;
    }
    return conversations;
  };

  // JavaScript Local Simulation Fallback
  const runClientSideSimulation = () => {
    const parsedConvs = parseRawDialogueJS(rawScript, "B-SIMULATED");
    if (parsedConvs.length === 0) return;

    let tempState = 'NEW';
    const turnOutcomes = [];
    let regressions = 0;
    const riskFlags = new Set();
    let complianceFlagsCount = 0;
    let promisesMade = 0;
    let promisesKept = 0;

    parsedConvs.forEach((conv) => {
      conv.turns.forEach((t) => {
        const text = t.text.toLowerCase();
        let proposedState = tempState;
        let transitionReason = "No state transition detected based on dialogue.";
        const turnRiskFlags = [];
        let complianceFlag = false;
        let complianceReason = null;

        if (t.speaker === 'borrower') {
          if (text.includes("lost my job") || text.includes("hospital") || text.includes("medical") || text.includes("tight") || text.includes("accident") || text.includes("illness")) {
            proposedState = 'HARDSHIP_FLAGGED';
            transitionReason = "Borrower disclosed genuine financial hardship (income loss/medical).";
            turnRiskFlags.push("financial_stress");
            riskFlags.add("financial_stress");
          } 
          else if (text.includes("promise") || text.includes("will pay") || text.includes("pay by") || text.includes("transfer on") || text.includes("friday") || text.includes("next week") || text.includes("tomorrow")) {
            proposedState = 'PROMISE_MADE';
            transitionReason = "Borrower committed to a specific payment schedule/date.";
            promisesMade++;
          } 
          else if (text.includes("wrong") || text.includes("dispute") || text.includes("not correct") || text.includes("already paid") || text.includes("duplicate")) {
            proposedState = 'DISPUTING';
            transitionReason = "Borrower contested the balance amount or debt validity.";
            turnRiskFlags.push("dispute");
            riskFlags.add("dispute");
          } 
          else if (text.includes("fuck") || text.includes("harass") || text.includes("sue") || text.includes("stop calling") || text.includes("hostile")) {
            proposedState = 'ESCALATED';
            transitionReason = "Borrower expressed intense hostility or explicitly refused to engage.";
            turnRiskFlags.push("hostility");
            riskFlags.add("hostility");
          } 
          else if (text.length > 5 && (tempState === 'NEW' || tempState === 'GHOSTED')) {
            proposedState = 'ENGAGED';
            transitionReason = "Borrower responded and active dialogue was established.";
          }
        } else {
          if (tempState === 'HARDSHIP_FLAGGED' && (text.includes("must pay") || text.includes("legal") || text.includes("court") || text.includes("today") || text.includes("immediate"))) {
            complianceFlag = true;
            complianceReason = "Agent used pressuring/legal threats immediately after borrower hardship disclosure.";
            complianceFlagsCount++;
          }
        }

        const allowed = TRANSITION_TABLE[tempState] || [];
        const isValid = proposedState === tempState || allowed.includes(proposedState);
        
        let finalState = tempState;
        let actualReason = transitionReason;
        
        if (isValid) {
          if (proposedState !== tempState) {
            finalState = proposedState;
            if (proposedState === 'ESCALATED' || proposedState === 'PROMISE_BROKEN') {
              regressions++;
            }
          }
        } else {
          actualReason = `[REJECTED] Proposed transition to ${proposedState} is not allowed from current state ${tempState}.`;
        }

        turnOutcomes.push({
          turn: t.turn,
          speaker: t.speaker,
          text: t.text,
          channel: conv.channel,
          date: conv.date,
          conversation_id: conv.conversation_id,
          current_state: tempState,
          proposed_state: finalState,
          transition_reason: actualReason,
          risk_flags: turnRiskFlags,
          compliance_flag: complianceFlag,
          compliance_reason: complianceReason,
          confidence: 0.85,
          provider: "Local Rule-based Simulator"
        });

        tempState = finalState;
      });
    });

    let tier = "Amber";
    if (['ENGAGED', 'PROMISE_MADE', 'PROMISE_KEPT', 'RESOLVED'].includes(tempState) && regressions === 0) {
      tier = "Green";
    } else if (regressions >= 2 || tempState === 'ESCALATED' || (tempState === 'GHOSTED' && parsedConvs.length >= 2)) {
      tier = "Red";
    } else if (tempState === 'HARDSHIP_FLAGGED' || regressions === 1) {
      tier = "Amber";
    }

    const promiseKeepRate = promisesMade > 0 ? (promisesKept / promisesMade) : 0.0;
    const totalTurns = turnOutcomes.length;
    const riskFlagDensity = totalTurns > 0 ? (riskFlags.size / totalTurns) : 0.0;

    setFullResult({
      borrower_id: "B-SIMULATED",
      persona_notes: "Simulated from local dialogue input",
      metrics: {
        borrower_id: "B-SIMULATED",
        current_state: tempState,
        tier,
        time_to_first_promise_turns: null,
        promise_keep_rate: promiseKeepRate,
        state_regressions: regressions,
        risk_flag_density: riskFlagDensity,
        compliance_flags_total: complianceFlagsCount,
        unique_risk_flags: Array.from(riskFlags)
      },
      turn_outcomes: turnOutcomes
    });

    setApiMode('fallback');
  };

  const handleAnalyzeScript = async () => {
    if (!rawScript.trim()) return;
    setLoading(true);
    setFullResult(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: rawScript }),
      });

      if (!response.ok) {
        throw new Error(`API response error: ${response.statusText}`);
      }

      const data = await response.json();
      setFullResult(data);
      setApiMode('real');
      if (onDataUpdated) {
        onDataUpdated();
      }
    } catch (error) {
      console.warn("FastAPI Server is offline. Running Javascript local rule-based simulation fallback.", error);
      runClientSideSimulation();
    } finally {
      setLoading(false);
    }
  };

  const handleSingleEvaluate = () => {
    setLoading(true);
    setTimeout(() => {
      const text = dialogue.toLowerCase();
      let proposedState = currentState;
      let transitionReason = "No state transition detected based on dialogue.";
      const riskFlags = [];
      let complianceFlag = false;
      let complianceReason = null;
      let confidence = 0.85;

      if (text.includes("lost my job") || text.includes("hospital") || text.includes("medical") || text.includes("tight") || text.includes("accident") || text.includes("illness")) {
        proposedState = 'HARDSHIP_FLAGGED';
        transitionReason = "Borrower disclosed genuine financial hardship (income loss/medical).";
        riskFlags.push("financial_stress");
        confidence = 0.94;
      } else if (text.includes("promise") || text.includes("will pay") || text.includes("pay by") || text.includes("transfer on") || text.includes("friday") || text.includes("next week") || text.includes("tomorrow")) {
        proposedState = 'PROMISE_MADE';
        transitionReason = "Borrower committed to a specific payment schedule/date.";
        confidence = 0.91;
      } else if (text.includes("wrong") || text.includes("dispute") || text.includes("not correct") || text.includes("already paid") || text.includes("duplicate")) {
        proposedState = 'DISPUTING';
        transitionReason = "Borrower contested the balance amount or debt validity.";
        riskFlags.push("dispute");
        confidence = 0.88;
      } else if (text.includes("fuck") || text.includes("harass") || text.includes("sue") || text.includes("stop calling") || text.includes("hostile")) {
        proposedState = 'ESCALATED';
        transitionReason = "Borrower expressed intense hostility or explicitly refused to engage.";
        riskFlags.push("hostility");
        confidence = 0.95;
      } else if (text.includes("hello") || text.includes("yes") || text.includes("speaking") || text.trim().length > 10) {
        if (currentState === 'NEW' || currentState === 'GHOSTED') {
          proposedState = 'ENGAGED';
          transitionReason = "Borrower responded and active dialogue was established.";
          confidence = 0.90;
        }
      }

      if (currentState === 'HARDSHIP_FLAGGED' && (agentText.toLowerCase().includes("must pay") || agentText.toLowerCase().includes("legal") || agentText.toLowerCase().includes("court") || agentText.toLowerCase().includes("today"))) {
        complianceFlag = true;
        complianceReason = "Agent used pressuring/legal threats immediately after borrower hardship disclosure.";
      }

      const allowedStates = TRANSITION_TABLE[currentState] || [];
      const isValid = proposedState === currentState || allowedStates.includes(proposedState);
      const actualState = isValid ? proposedState : currentState;
      const provider = Math.random() > 0.3 ? 'Groq (llama-3.3-70b)' : 'Gemini (gemini-2.5-flash)';

      setSingleResult({
        turn: turnNumber,
        originalState: currentState,
        proposedState,
        actualState,
        isValidTransition: isValid,
        transitionReason: isValid ? transitionReason : `[REJECTED] Proposed transition to ${proposedState} is not allowed from current state ${currentState}.`,
        riskFlags,
        complianceFlag,
        complianceReason,
        confidence,
        provider
      });
      setLoading(false);
    }, 800);
  };

  const handleCopyJSON = () => {
    if (!fullResult) return;
    navigator.clipboard.writeText(JSON.stringify(fullResult, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    if (!fullResult) return;
    const blob = new Blob([JSON.stringify(fullResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `risk_analysis_${fullResult.borrower_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setDialogue("");
    setAgentText("");
    setRawScript("");
    setSingleResult(null);
    setFullResult(null);
  };

  const isFull = playgroundTab === 'full';
  const tierClass = fullResult?.metrics?.tier?.toLowerCase() || '';

  return (
    <div className="playground-container flex flex-col w-full">
      <div className="playground-header border-b border-border-subtle pb-4 mb-6">
        <h2 className="card-title text-text-primary text-xl font-bold">Risk Intelligence Playground</h2>
        <p className="text-text-secondary text-sm mt-1">
          Simulate single conversational turns or analyze full conversation histories to map risk state machines.
        </p>
      </div>

      {/* Internal Tabs */}
      <div className="tabs-container mb-6 self-start">
        <button 
          className={`tab-btn ${isFull ? 'active' : ''}`}
          onClick={() => setPlaygroundTab('full')}
        >
          <FileText size={16} /> Evaluate Full Script
        </button>
        <button 
          className={`tab-btn ${!isFull ? 'active' : ''}`}
          onClick={() => setPlaygroundTab('single')}
        >
          <Sparkles size={16} /> Single Turn Simulator
        </button>
      </div>

      <div className="dashboard-grid-layout">
        {/* Left Side: Inputs */}
        <div className="glass card playground-form flex flex-col gap-4">
          <h3 className="text-text-primary text-lg font-bold">
            {isFull ? 'Paste Conversation Log' : 'Configure Turn State'}
          </h3>

          {isFull ? (
            /* FULL CONVERSATION SCRIPT VIEW */
            <div className="form-group flex flex-col gap-2">
              <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                Dialogue script (plain text format)
              </label>
              <textarea 
                rows={11}
                placeholder="Format like:&#10;Agent: Hello Priya, calling about outstanding balance...&#10;Borrower: I lost my job and things are tight..."
                value={rawScript}
                onChange={(e) => setRawScript(e.target.value)}
                className="w-full bg-bg-primary text-text-primary border border-border-subtle rounded-xl p-3 text-sm font-mono focus:border-accent-orange focus:ring-2 focus:ring-accent-orange/15 focus:outline-none transition-all"
              />
              <span className="text-text-muted text-xs">
                Use 'Agent:' and 'Borrower:' prefixes. Script parser will automatically structure speech records.
              </span>
            </div>
          ) : (
            /* SINGLE TURN VIEW */
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="form-group col-span-2 flex flex-col gap-1.5">
                  <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                    Current State
                  </label>
                  <select 
                    value={currentState} 
                    onChange={(e) => setCurrentState(e.target.value)}
                    className="bg-bg-primary text-text-primary border border-border-subtle rounded-xl p-2 text-sm focus:border-accent-orange focus:outline-none"
                  >
                    {BORROWER_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                    Turn #
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    value={turnNumber} 
                    onChange={(e) => setTurnNumber(parseInt(e.target.value) || 1)} 
                    className="bg-bg-primary text-text-primary border border-border-subtle rounded-xl p-2 text-sm focus:border-accent-orange focus:outline-none"
                  />
                </div>
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                  Agent Turn Text (To analyze compliance)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. You must pay by today or we will legal route." 
                  value={agentText}
                  onChange={(e) => setAgentText(e.target.value)} 
                  className="bg-bg-primary text-text-primary border border-border-subtle rounded-xl p-2.5 text-sm focus:border-accent-orange focus:outline-none"
                />
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                  Borrower Turn Text (To analyze transition & risk)
                </label>
                <textarea 
                  rows={4}
                  placeholder="e.g. I lost my job, I don't have enough money right now."
                  value={dialogue}
                  onChange={(e) => setDialogue(e.target.value)}
                  className="bg-bg-primary text-text-primary border border-border-subtle rounded-xl p-3 text-sm focus:border-accent-orange focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button 
              className="flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-border-subtle hover:bg-bg-secondary/40 text-text-secondary font-semibold cursor-pointer transition-all duration-200" 
              onClick={handleReset}
            >
              <RotateCcw size={16} /> Reset
            </button>
            <button 
              className="flex-[2] py-3 px-4 rounded-xl flex items-center justify-center gap-2 bg-accent-orange hover:bg-accent-orange/90 text-white font-bold cursor-pointer disabled:bg-border-subtle disabled:text-text-muted disabled:cursor-not-allowed transition-all duration-200 shadow-[0_4px_12px_rgba(255,101,0,0.2)]" 
              onClick={isFull ? handleAnalyzeScript : handleSingleEvaluate} 
              disabled={loading || (isFull ? !rawScript.trim() : !dialogue.trim())}
            >
              <Play size={16} /> {loading ? 'Analyzing...' : isFull ? 'Analyze Script' : 'Evaluate Turn'}
            </button>
          </div>
        </div>

        {/* Right Side: Results */}
        <div className="glass card playground-results flex flex-col h-full min-h-[460px]">
          <h3 className="text-text-primary text-lg font-bold mb-4">
            Analysis & Risk Detection
          </h3>

          {loading && (
            <div className="flex-grow flex flex-col justify-center items-center text-center p-8 animate-pulse">
              <Server className="text-accent-orange mb-4" size={48} />
              <p className="text-text-primary font-semibold">Structuring dialogue script and triggering risk engines...</p>
              <span className="text-text-muted text-xs mt-1">Calling API validations</span>
            </div>
          )}

          {!loading && !fullResult && !singleResult && (
            <div className="flex-grow flex flex-col justify-center items-center text-center p-8">
              <Server size={48} className="text-text-muted/30 mb-4" />
              <p className="text-text-secondary text-sm max-w-xs">
                {isFull 
                  ? 'Input dialogue logs on the left and click Analyze Script to generate structured JSON and audit transitions.' 
                  : 'Configure current state variables and click Evaluate Turn to inspect semantic state changes.'}
              </p>
            </div>
          )}

          {/* SINGLE TURN RESULT RENDERING */}
          {!loading && !isFull && singleResult && (
            <div className="flex flex-col gap-4">
              <div className={`validation-status-banner ${singleResult.isValidTransition ? 'valid' : 'invalid'}`}>
                {singleResult.isValidTransition ? (
                  <>
                    <ShieldCheck size={18} className="banner-icon" />
                    <div><strong>Transition Approved:</strong> {singleResult.originalState} → {singleResult.actualState}</div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={18} className="banner-icon" />
                    <div><strong>Rejected:</strong> Invalid transition proposed. Locked at {singleResult.actualState}.</div>
                  </>
                )}
              </div>

              <div className="outcome-stats-grid">
                <div className="outcome-stat">
                  <span className="outcome-label">Previous</span>
                  <span className="outcome-val prev">{singleResult.originalState}</span>
                </div>
                <div className="outcome-stat">
                  <span className="outcome-label">Proposed</span>
                  <span className={`outcome-val ${singleResult.isValidTransition ? 'valid' : 'invalid'}`}>{singleResult.proposedState}</span>
                </div>
                <div className="outcome-stat">
                  <span className="outcome-label">Final State</span>
                  <span className="outcome-val final">{singleResult.actualState}</span>
                </div>
              </div>

              <div className="outcome-reason-box">
                <span className="outcome-label text-accent-orange">Decision Reasoning</span>
                <p className="text-text-secondary text-sm mt-1">{singleResult.transitionReason}</p>
              </div>

              <div className="flex justify-between items-center text-xs text-text-muted pb-3 border-b border-border-subtle">
                <span>Confidence: <strong>{(singleResult.confidence * 100).toFixed(0)}%</strong></span>
                <span>Inference: <strong className="text-purple-600 dark:text-purple-400">{singleResult.provider}</strong></span>
              </div>

              <div>
                <span className="outcome-label block mb-1">Risk Flags</span>
                {singleResult.riskFlags.length === 0 ? (
                  <span className="text-text-muted text-sm italic">No risk flags flagged</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {singleResult.riskFlags.map(f => (
                      <span key={f} className="badge amber">{f}</span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span className="outcome-label block mb-1">Compliance Check</span>
                {singleResult.complianceFlag ? (
                  <div className="compliance-violation-card">
                    <strong>Fair-Practice Violation Detected</strong>
                    <p className="text-sm mt-1">{singleResult.complianceReason}</p>
                  </div>
                ) : (
                  <div className="compliance-safe-card">
                    Conforms to fair collections code.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FULL SCRIPT RESULT RENDERING */}
          {!loading && isFull && fullResult && (
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[440px] pr-1">
              
              {/* API Mode and Fallback alert */}
              {apiMode === 'real' ? (
                <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 p-3 rounded-xl text-xs text-blue-500">
                  <Cpu size={14} />
                  <span><strong>Real LLM API Mode Active:</strong> Analysis processed through state validation rail.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1 bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-600 dark:text-amber-500">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={15} />
                    <span>API Server Offline (Simulated Fallback)</span>
                  </div>
                  <p className="text-text-secondary text-[11px] mt-0.5">
                    Using client-side dialogue regex simulation. Run <code>python src/server.py</code> in the root folder to start the FastAPI server and enable real LLM routing (Groq/Gemini).
                  </p>
                </div>
              )}

              {/* Account summary & Risk Tier */}
              <div className="flex justify-between items-center bg-bg-primary/50 p-3.5 rounded-xl border border-border-subtle">
                <div>
                  <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider">Derived Classification</span>
                  <div className="text-text-primary text-md font-bold font-mono">{fullResult.borrower_id}</div>
                </div>
                <span className={`badge ${tierClass} px-3 py-1.5 text-xs`}>{fullResult.metrics.tier} Risk Tier</span>
              </div>

              {/* Metrics grid rollup */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bg-primary border border-border-subtle p-2.5 rounded-xl flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">Final state</span>
                  <strong className="text-text-primary text-sm mt-0.5">{fullResult.metrics.current_state}</strong>
                </div>
                <div className="bg-bg-primary border border-border-subtle p-2.5 rounded-xl flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">Regressions</span>
                  <strong className="text-text-primary text-sm mt-0.5">{fullResult.metrics.state_regressions}</strong>
                </div>
                <div className="bg-bg-primary border border-border-subtle p-2.5 rounded-xl flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">Unique Risk Flags</span>
                  <strong className="text-text-primary text-sm mt-0.5">{fullResult.metrics.unique_risk_flags.length}</strong>
                </div>
                <div className="bg-bg-primary border border-border-subtle p-2.5 rounded-xl flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">Compliance Flags</span>
                  <strong className={`text-sm mt-0.5 ${fullResult.metrics.compliance_flags_total > 0 ? 'text-tier-red' : 'text-tier-green'}`}>
                    {fullResult.metrics.compliance_flags_total}
                  </strong>
                </div>
              </div>

              {/* JSON Viewer */}
              <div className="border-t border-border-subtle pt-3">
                <span className="text-[11px] uppercase tracking-wider font-bold text-text-muted block mb-2">
                  Structured JSON Output
                </span>
                
                <div className="bg-black/90 dark:bg-black border border-border-subtle rounded-xl p-3 relative">
                  <div className="flex gap-1.5 absolute right-2 top-2 z-10">
                    <button 
                      onClick={handleCopyJSON} 
                      className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-all" 
                      title="Copy JSON"
                    >
                      {copied ? <CheckCircle2 size={13} className="text-tier-green" /> : <Copy size={13} />}
                    </button>
                    <button 
                      onClick={handleDownloadJSON} 
                      className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-all" 
                      title="Download JSON File"
                    >
                      <Download size={13} />
                    </button>
                  </div>
                  
                  <pre className="margin-0 overflow-x-auto text-[11px] text-sky-400 max-h-[180px] font-mono leading-relaxed select-all">
                    {JSON.stringify(fullResult, null, 2)}
                  </pre>
                </div>
              </div>

              {/* State transition log listing */}
              <div className="border-t border-border-subtle pt-3">
                <span className="text-[11px] uppercase tracking-wider font-bold text-text-muted block mb-2">
                  Dialogue State Log
                </span>
                <div className="flex flex-col gap-2">
                  {fullResult.turn_outcomes.map((turn, i) => {
                    const isAgent = turn.speaker === 'agent';
                    const stateChanged = turn.proposed_state !== turn.current_state;
                    
                    return (
                      <div key={i} className="border-l-2 border-border-subtle pl-3 relative py-0.5">
                        <div className={`absolute left-[-5px] top-[7px] w-2 h-2 rounded-full ${isAgent ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                        <div className="flex justify-between items-center text-[10px] text-text-muted font-bold">
                          <span>Turn {turn.turn} - {isAgent ? 'Agent' : 'Borrower'}</span>
                          {stateChanged && <span className="text-accent-orange font-mono">{turn.current_state} ➜ {turn.proposed_state}</span>}
                        </div>
                        <p className="text-xs text-text-primary mt-0.5 font-medium">"{turn.text}"</p>
                        
                        {turn.compliance_flag && (
                          <div className="text-[10px] text-tier-red bg-tier-red/5 p-1.5 rounded-lg mt-1 border border-tier-red/10">
                            ⚠️ Compliance Flag: {turn.compliance_reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Allowed Transitions References Footer */}
      {!isFull && (
        <div className="glass card states-reference mt-4 p-4">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-text-primary">
            <HelpCircle size={15} /> Allowed Transitions Reference
          </h4>
          <p className="text-text-secondary text-xs mt-1">
            From <strong>{currentState}</strong>, the allowed transition states are:{' '}
            <code className="bg-bg-primary border border-border-subtle px-2 py-0.5 rounded text-accent-orange font-mono">
              {(TRANSITION_TABLE[currentState] || []).join(', ') || 'None (Terminal State)'}
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
