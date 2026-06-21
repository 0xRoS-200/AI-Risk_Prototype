import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MessageSquare, Phone, ShieldAlert, Cpu, Calendar } from 'lucide-react';

// Register GSAP ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

export default function Timeline({ borrower }) {
  const timelineRef = useRef(null);

  useEffect(() => {
    // Make sure we have a borrower and the element exists
    if (!borrower || !timelineRef.current) return;

    const ctx = gsap.context(() => {
      // 1. Animate detail header card immediately on select
      const headerCard = timelineRef.current.querySelector('.detail-header-card');
      if (headerCard) {
        gsap.fromTo(headerCard,
          { opacity: 0, y: -20, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power2.out' }
        );
      }

      // Find the scrollable container parent
      const scroller = timelineRef.current.closest('.timeline-scroll-parent') || window;

      // 2. Stagger animate conversation blocks on scroll
      const blocks = timelineRef.current.querySelectorAll('.conversation-block');
      blocks.forEach((block) => {
        gsap.fromTo(block,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: block,
              scroller: scroller,
              start: 'top 90%',
              toggleActions: 'play none none none'
            }
          }
        );
      });

      // 3. Animate the vertical timeline line to "grow" as we scroll down
      const progressLine = timelineRef.current.querySelector('.timeline-progress-line');
      const wrapper = timelineRef.current.querySelector('.conversations-wrapper');
      if (progressLine && wrapper && blocks.length > 0) {
        gsap.fromTo(progressLine,
          { height: '0%' },
          {
            height: '100%',
            ease: 'none',
            scrollTrigger: {
              trigger: wrapper,
              scroller: scroller,
              start: 'top 80%',
              end: 'bottom 40%',
              scrub: 1 // smooth scrubbing
            }
          }
        );
      }

      // 4. Slide chat bubbles in from left (agent) and right (borrower) on viewport entry
      const bubbles = timelineRef.current.querySelectorAll('.chat-turn-container');
      bubbles.forEach((bubble) => {
        const bubbleWrapper = bubble.querySelector('.chat-bubble-wrapper');
        if (!bubbleWrapper) return;
        
        const isAgent = bubbleWrapper.classList.contains('agent');
        
        gsap.fromTo(bubbleWrapper,
          { opacity: 0, x: isAgent ? -40 : 40, scale: 0.95 },
          {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.5,
            ease: 'back.out(1.1)',
            scrollTrigger: {
              trigger: bubble,
              scroller: scroller,
              start: 'top 92%',
              toggleActions: 'play none none none'
            }
          }
        );
      });
    }, timelineRef);

    // Clean up all triggers scoped to this context when dependencies change or component unmounts
    return () => {
      ctx.revert();
    };
  }, [borrower]);

  // Group turn outcomes by conversation_id while guarding against null/undefined
  const conversationsMap = {};
  const turnOutcomes = borrower.turn_outcomes || [];
  turnOutcomes.forEach((turn) => {
    const convId = turn.conversation_id || 'Unknown Call';
    if (!conversationsMap[convId]) {
      conversationsMap[convId] = {
        id: convId,
        date: turn.date || 'Unknown Date',
        channel: turn.channel || 'voice',
        turns: []
      };
    }
    conversationsMap[convId].turns.push(turn);
  });

  // Sort conversations chronologically by date and conversation ID
  const conversations = Object.values(conversationsMap).sort((a, b) => {
    if (a.date === 'Unknown Date' && b.date !== 'Unknown Date') return 1;
    if (a.date !== 'Unknown Date' && b.date === 'Unknown Date') return -1;
    if (a.date !== 'Unknown Date' && b.date !== 'Unknown Date') {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
    }
    return a.id.localeCompare(b.id);
  });

  // Sort turns inside each conversation by turn number (ascending)
  conversations.forEach((conv) => {
    conv.turns.sort((a, b) => (a.turn || 0) - (b.turn || 0));
  });

  const tierClass = (borrower.metrics?.tier || 'green').toLowerCase();

  return (
    <div className="timeline-container pr-2" ref={timelineRef}>
      {/* Detail Header Card */}
      <div className="glass card detail-header-card">
        <div className="detail-meta">
          <div>
            <span className="detail-id">Account: {borrower.borrower_id}</span>
            <div className="persona-notes-box">
              <span className="persona-label">Persona Profile</span>
              <p>"{borrower.persona_notes || 'No persona details available.'}"</p>
            </div>
          </div>
          {borrower.metrics && (
            <span className={`badge ${tierClass}`}>{borrower.metrics.tier} Risk Tier</span>
          )}
        </div>

        {/* Mini stats row */}
        {borrower.metrics && (
          <div className="detail-stats-row">
            <div className="d-stat">
              <span className="d-label">Promise Keep Rate</span>
              <span className="d-val">{(borrower.metrics.promise_keep_rate * 100).toFixed(0)}%</span>
            </div>
            <div className="d-stat">
              <span className="d-label">Regressions</span>
              <span className="d-val">{borrower.metrics.state_regressions}</span>
            </div>
            <div className="d-stat">
              <span className="d-label">Risk Density</span>
              <span className="d-val">{(borrower.metrics.risk_flag_density || 0).toFixed(2)} / turn</span>
            </div>
            <div className="d-stat">
              <span className="d-label">Compliance Flags</span>
              <span className="d-val text-red">{borrower.metrics.compliance_flags_total}</span>
            </div>
          </div>
        )}
      </div>

      <h3 className="section-title-visual" style={{ marginTop: '2rem' }}>Lifecycle Conversation History</h3>

      <div className="conversations-wrapper" style={{ position: 'relative' }}>
        {/* Scroll-triggered progress guide line */}
        <div className="absolute left-[20px] top-6 bottom-6 w-[2px] bg-border-subtle/30 -z-10 hidden sm:block">
          <div className="timeline-progress-line w-full bg-accent-orange origin-top h-0" style={{ height: '0%' }}></div>
        </div>

        {conversations.map((conv) => {
          const channelLower = (conv.channel || '').toLowerCase();
          const isVoice = channelLower.includes('voice') || channelLower.includes('phone') || channelLower.includes('call');
          const isChat = channelLower.includes('whatsapp') || channelLower.includes('chat') || channelLower.includes('message') || channelLower.includes('sms');
          const channelLabel = isVoice ? 'Voice Call' : (isChat ? 'WhatsApp Chat' : (conv.channel || 'Chat'));

          return (
            <div key={conv.id} className="glass conversation-block">
              {/* Conversation Header */}
              <div className="conversation-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isVoice ? <Phone size={16} className="text-blue" /> : <MessageSquare size={16} className="text-green" />}
                  <span className="conv-channel-tag">{channelLabel}</span>
                  <span className="conv-id-tag">{conv.id}</span>
                </div>
                <div className="conv-date-wrapper">
                  <Calendar size={14} />
                  <span>{conv.date}</span>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="chat-thread">
                {conv.turns.map((turn, index) => {
                  const isAgent = turn.speaker && turn.speaker.toLowerCase() === 'agent';
                  const hasTransition = turn.proposed_state !== turn.current_state;
                  
                  return (
                    <div key={index} className="chat-turn-container">
                      {/* Dialogue Bubble */}
                      <div className={`chat-bubble-wrapper ${isAgent ? 'agent' : 'borrower'}`}>
                        <div className={`chat-bubble ${isAgent ? 'agent-bubble' : 'borrower-bubble'} ${turn.compliance_flag ? 'compliance-violation' : ''}`}>
                          <span className="bubble-speaker">{isAgent ? 'Agent' : 'Borrower'}</span>
                          <p className="bubble-text">{turn.text || 'No dialogue recorded for this turn.'}</p>
                          
                          {/* Turn metadata */}
                          <div className="bubble-meta">
                            <span>Turn {turn.turn}</span>
                            {turn.provider && (
                              <span className="ai-meta">
                                <Cpu size={10} style={{ marginRight: '2px' }} />
                                {turn.provider}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Inline Risk Flags */}
                      {!isAgent && turn.risk_flags && turn.risk_flags.length > 0 && (
                        <div className="bubble-flags-row borrower">
                          {turn.risk_flags.map((flag) => (
                            <span key={flag} className="badge amber mini-badge">
                              {flag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Compliance Flag Alert */}
                      {isAgent && turn.compliance_flag && (
                        <div className="compliance-violation-alert">
                          <ShieldAlert size={14} />
                          <div>
                            <strong>Fair-Practice Violation:</strong> {turn.compliance_reason}
                          </div>
                        </div>
                      )}

                      {/* State Transition Logs */}
                      {hasTransition && (
                        <div className="system-transition-log">
                          <div className="transition-icon-dot"></div>
                          <div className="transition-log-content">
                            <span className="transition-title">
                              Transition: <strong>{turn.current_state}</strong> → <strong>{turn.proposed_state}</strong>
                            </span>
                            <p className="transition-reason">{turn.transition_reason}</p>
                            <span className="transition-confidence">
                              Confidence: <strong>{(turn.confidence * 100).toFixed(0)}%</strong>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
