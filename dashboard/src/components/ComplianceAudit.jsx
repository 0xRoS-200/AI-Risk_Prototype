import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ShieldAlert, AlertTriangle, ArrowRight, FileText } from 'lucide-react';

export default function ComplianceAudit({ data, onSelectBorrower }) {
  const containerRef = useRef(null);

  // Extract all turns across all borrowers that have compliance violations
  const violations = [];
  data.forEach((borrower) => {
    borrower.turn_outcomes.forEach((turn) => {
      if (turn.compliance_flag) {
        violations.push({
          borrower,
          turn_num: turn.turn,
          text: turn.text,
          reason: turn.compliance_reason,
          date: turn.date || 'Unknown Date',
          channel: turn.channel || 'voice',
          conversation_id: turn.conversation_id
        });
      }
    });
  });

  useEffect(() => {
    if (containerRef.current) {
      const items = containerRef.current.querySelectorAll('.violation-card');
      gsap.fromTo(
        items,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out' }
      );
    }
  }, [data]);

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <div className="glass card detail-header-card border-l-4 border-tier-red">
        <h2 className="flex items-center gap-2.5 text-tier-red text-xl font-extrabold">
          <ShieldAlert size={26} className="animate-pulse" /> Fair-Practice Compliance Center
        </h2>
        <p className="text-text-secondary text-sm mt-2 leading-relaxed">
          This view audits collection calls and chats for regulatory violations. The state engine scans agent speech patterns against fair practice codes (e.g., unauthorized pressure, threats, or illegal collection tactics after hardship disclosures).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {violations.length === 0 ? (
          <div className="glass card p-12 text-center text-text-muted flex flex-col items-center justify-center">
            <ShieldAlert size={48} className="text-tier-green opacity-30 mb-3" />
            <h3 className="text-text-primary font-bold text-lg mb-1">Audit Clear: No Violations</h3>
            <p className="text-sm">All analyzed conversations conform to standard collection guidelines.</p>
          </div>
        ) : (
          violations.map((v, index) => (
            <div 
              key={index} 
              className="glass card violation-card border-l-3 border-tier-red bg-tier-red/[0.02] dark:bg-tier-red/[0.05] p-5 flex flex-col gap-3.5"
            >
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="badge red px-2 py-0.5 text-[10px] font-bold">Violation #{index + 1}</span>
                  <span className="text-text-secondary text-sm font-semibold">
                    Account:{' '}
                    <strong className="text-text-primary font-mono font-bold select-all">
                      {v.borrower.borrower_id}
                    </strong>
                  </span>
                  <span className="conv-id-tag font-mono text-xs">{v.conversation_id}</span>
                </div>
                <div className="text-text-muted text-xs flex items-center gap-1">
                  <FileText size={13} /> {v.date} ({v.channel})
                </div>
              </div>

              <div className="bg-bg-primary border border-border-subtle/50 p-4 rounded-xl">
                <span className="text-[11px] font-bold text-tier-red uppercase tracking-wider block">
                  Violating Agent Turn (Turn {v.turn_num}):
                </span>
                <p className="text-text-primary italic text-sm mt-1.5 leading-relaxed">
                  "{v.text}"
                </p>
              </div>

              <div className="flex justify-between items-center flex-wrap gap-3 border-t border-border-subtle/40 pt-3">
                <div className="flex items-center gap-1.5 text-tier-amber text-xs font-semibold">
                  <AlertTriangle size={15} />
                  <span>
                    <strong className="uppercase text-[10px] text-text-muted mr-1">Reason:</strong>
                    {v.reason}
                  </span>
                </div>
                
                <button 
                  onClick={() => onSelectBorrower(v.borrower)}
                  className="action-btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5 rounded-lg"
                >
                  Timeline Drilldown <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
