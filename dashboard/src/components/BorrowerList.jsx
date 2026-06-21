import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

export default function BorrowerList({ data, onSelectBorrower, selectedBorrowerId }) {
  const tableRef = useRef(null);
  
  useEffect(() => {
    if (!tableRef.current) return;
    const ctx = gsap.context(() => {
      const rows = tableRef.current.querySelectorAll('.table-row');
      gsap.fromTo(
        rows,
        { opacity: 0, y: 15, transformPerspective: 800, rotationX: -10 },
        { 
          opacity: 1, 
          y: 0, 
          rotationX: 0, 
          duration: 0.5, 
          stagger: 0.05, 
          ease: 'power3.out' 
        }
      );
    }, tableRef);
    return () => ctx.revert();
  }, [data]);

  return (
    <div className="glass card flex flex-col h-full overflow-hidden">
      <h2 className="card-title">Borrower Portfolio</h2>
      <div className="table-wrapper flex-grow overflow-y-auto pr-1">
        <table ref={tableRef}>
          <thead>
            <tr>
              <th>Account ID</th>
              <th>Risk Tier</th>
              <th>Lifecycle State</th>
              <th>Keep Rate</th>
              <th>Audits / Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.map((borrower) => {
              const { metrics } = borrower;
              const tierClass = metrics.tier.toLowerCase();
              const isActive = selectedBorrowerId === metrics.borrower_id;
              const hasViolations = metrics.compliance_flags_total > 0;
              const hasRegressions = metrics.state_regressions > 0;

              return (
                <tr 
                  key={metrics.borrower_id} 
                  className={`table-row ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectBorrower(borrower)}
                >
                  <td className="font-semibold text-text-primary font-mono select-all">
                    {metrics.borrower_id}
                  </td>
                  <td>
                    <span className={`badge ${tierClass}`}>{metrics.tier}</span>
                  </td>
                  <td>
                    <span className="text-text-secondary font-medium">{metrics.current_state}</span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1.5 min-w-[90px]">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span>{(metrics.promise_keep_rate * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-border-subtle/30 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${metrics.promise_keep_rate * 100}%`,
                            backgroundColor: metrics.promise_keep_rate >= 0.7 
                              ? 'var(--tier-green)' 
                              : metrics.promise_keep_rate >= 0.4 
                                ? 'var(--tier-amber)' 
                                : 'var(--tier-red)'
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted text-sm font-medium">
                        {metrics.state_regressions} reg.
                      </span>
                      {hasViolations && (
                        <div className="flex items-center text-tier-red" title="Compliance Violations Detected!">
                          <ShieldAlert size={16} className="animate-pulse" />
                        </div>
                      )}
                      {!hasViolations && hasRegressions && (
                        <div className="flex items-center text-tier-amber" title="State Regressions / Broken Commitments">
                          <AlertTriangle size={15} />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
