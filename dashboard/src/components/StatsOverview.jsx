import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Users, CheckCircle2, ShieldAlert, TrendingDown, Sparkles } from 'lucide-react';

export default function StatsOverview({ data }) {
  const totalBorrowers = data.length;

  const borrowersWithPromises = data.filter(b => b.metrics.promise_keep_rate > 0 || b.turn_outcomes.some(t => t.proposed_state === 'PROMISE_MADE'));
  const avgKeepRate = borrowersWithPromises.length
    ? (borrowersWithPromises.reduce((sum, b) => sum + (b.metrics.promise_keep_rate || 0), 0) / borrowersWithPromises.length) * 100
    : 0;

  const totalComplianceFlags = data.reduce((sum, b) => sum + (b.metrics.compliance_flags_total || 0), 0);
  const totalRegressions = data.reduce((sum, b) => sum + (b.metrics.state_regressions || 0), 0);

  const tierCounts = { Green: 0, Amber: 0, Red: 0 };
  data.forEach(b => {
    tierCounts[b.metrics.tier] = (tierCounts[b.metrics.tier] || 0) + 1;
  });

  // Refs for counting numbers
  const totalBorrowersRef = useRef(null);
  const avgKeepRateRef = useRef(null);
  const totalRegressionsRef = useRef(null);
  const complianceFlagsRef = useRef(null);
  const greenPillRef = useRef(null);
  const amberPillRef = useRef(null);
  const redPillRef = useRef(null);

  useEffect(() => {
    // 1. Total portfolios count
    gsap.fromTo(totalBorrowersRef.current,
      { textContent: 0 },
      { textContent: totalBorrowers, duration: 1.2, ease: 'power2.out', roundProps: 'textContent' }
    );

    // 2. Average Keep Rate count
    gsap.fromTo(avgKeepRateRef.current,
      { textContent: 0 },
      {
        textContent: Math.round(avgKeepRate),
        duration: 1.2,
        ease: 'power2.out',
        roundProps: 'textContent',
        onUpdate: function() {
          if (avgKeepRateRef.current) {
            avgKeepRateRef.current.textContent = avgKeepRateRef.current.textContent + '%';
          }
        }
      }
    );

    // 3. Total regressions count
    gsap.fromTo(totalRegressionsRef.current,
      { textContent: 0 },
      { textContent: totalRegressions, duration: 1.2, ease: 'power2.out', roundProps: 'textContent' }
    );

    // 4. Total compliance violations count
    gsap.fromTo(complianceFlagsRef.current,
      { textContent: 0 },
      { textContent: totalComplianceFlags, duration: 1.2, ease: 'power2.out', roundProps: 'textContent' }
    );

    // 5. Tier breakdown counts
    gsap.fromTo(greenPillRef.current, { textContent: 0 }, { textContent: tierCounts.Green, duration: 1, ease: 'power2.out', roundProps: 'textContent' });
    gsap.fromTo(amberPillRef.current, { textContent: 0 }, { textContent: tierCounts.Amber, duration: 1, ease: 'power2.out', roundProps: 'textContent' });
    gsap.fromTo(redPillRef.current, { textContent: 0 }, { textContent: tierCounts.Red, duration: 1, ease: 'power2.out', roundProps: 'textContent' });

  }, [data, totalBorrowers, avgKeepRate, totalRegressions, totalComplianceFlags]);

  return (
    <div className="stats-overview-grid">
      {/* Total Borrowers Card */}
      <div className="glass stat-card">
        <div className="stat-icon-wrapper blue">
          <Users className="stat-icon" />
        </div>
        <div className="stat-details">
          <span className="stat-label">Total Portfolios</span>
          <span ref={totalBorrowersRef} className="stat-value">{totalBorrowers}</span>
          <div className="stat-subtext">Active Borrower Accounts</div>
        </div>
      </div>

      {/* Avg Promise Keep Rate Card */}
      <div className="glass stat-card">
        <div className="stat-icon-wrapper green">
          <CheckCircle2 className="stat-icon" />
        </div>
        <div className="stat-details">
          <span className="stat-label">Avg Promise Kept</span>
          <span ref={avgKeepRateRef} className="stat-value">{avgKeepRate.toFixed(0)}%</span>
          <div className="stat-subtext">Commitment Fulfillment Rate</div>
        </div>
      </div>

      {/* State Regressions Card */}
      <div className="glass stat-card">
        <div className="stat-icon-wrapper amber">
          <TrendingDown className="stat-icon" />
        </div>
        <div className="stat-details">
          <span className="stat-label">State Regressions</span>
          <span ref={totalRegressionsRef} className="stat-value">{totalRegressions}</span>
          <div className="stat-subtext">Broken Promises / Escalations</div>
        </div>
      </div>

      {/* Compliance Violations Card */}
      <div className="glass stat-card">
        <div className="stat-icon-wrapper red">
          <ShieldAlert className="stat-icon" />
        </div>
        <div className="stat-details">
          <span className="stat-label">Compliance Flags</span>
          <span ref={complianceFlagsRef} className="stat-value">{totalComplianceFlags}</span>
          <div className={`stat-subtext ${totalComplianceFlags > 0 ? 'warning-text' : 'success-text'}`}>
            {totalComplianceFlags > 0 ? 'Agent violations detected' : 'Perfect audit status'}
          </div>
        </div>
      </div>

      {/* Quick Tier Breakdown Mini Card */}
      <div className="glass stat-card tier-breakdown-card">
        <div className="stat-icon-wrapper purple">
          <Sparkles className="stat-icon" />
        </div>
        <div className="stat-details" style={{ width: '100%' }}>
          <span className="stat-label">Risk Segments</span>
          <div className="tier-pill-container">
            <span className="tier-mini-pill green">
              Green <strong ref={greenPillRef}>{tierCounts.Green}</strong>
            </span>
            <span className="tier-mini-pill amber">
              Amber <strong ref={amberPillRef}>{tierCounts.Amber}</strong>
            </span>
            <span className="tier-mini-pill red">
              Red <strong ref={redPillRef}>{tierCounts.Red}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
