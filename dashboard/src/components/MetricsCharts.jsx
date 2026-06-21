import React, { useEffect, useState } from 'react';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  PointElement, 
  LineElement 
} from 'chart.js';
import { Doughnut, Bar as BarChart } from 'react-chartjs-2';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  PointElement, 
  LineElement
);

export default function MetricsCharts({ data }) {
  // Sync state with HTML dark class to dynamically update chart colors
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="glass card empty-charts">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
          No portfolio data available to plot charts.
        </p>
      </div>
    );
  }

  // Theme-aware colors
  const textPrimary = isDark ? '#ffffff' : '#0b192c';
  const textSecondary = isDark ? '#cbd5e1' : '#1e3e62';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(11, 25, 44, 0.06)';
  const tooltipBg = isDark ? 'rgba(11, 25, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const tooltipBorder = isDark ? '#1e3e62' : '#cbd5e1';
  
  const greenColor = '#10b981';
  const amberColor = isDark ? '#fbbf24' : '#d97706';
  const redColor = isDark ? '#f43f5e' : '#e11d48';
  const brandOrange = '#ff6500';

  // 1. Aggregate Tier Data (Doughnut)
  const tierCounts = { Green: 0, Amber: 0, Red: 0 };
  data.forEach(b => {
    if (b.metrics && b.metrics.tier) {
      tierCounts[b.metrics.tier] = (tierCounts[b.metrics.tier] || 0) + 1;
    }
  });

  const doughnutData = {
    labels: ['Green Tier', 'Amber Tier', 'Red Tier'],
    datasets: [
      {
        data: [tierCounts.Green, tierCounts.Amber, tierCounts.Red],
        backgroundColor: [
          'rgba(16, 185, 129, 0.75)',
          isDark ? 'rgba(251, 191, 36, 0.75)' : 'rgba(217, 119, 6, 0.75)',
          isDark ? 'rgba(244, 63, 94, 0.75)' : 'rgba(225, 29, 72, 0.75)'
        ],
        borderColor: [
          greenColor,
          amberColor,
          redColor
        ],
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: textSecondary,
          font: { family: 'Inter', size: 12, weight: '500' },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: textPrimary,
        bodyColor: textSecondary,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        boxPadding: 6,
      }
    }
  };

  // 2. Average Promise Keep Rates by Tier (Bar)
  const tierKeepRates = { Green: [], Amber: [], Red: [] };
  data.forEach(b => {
    if (b.metrics && b.metrics.tier) {
      tierKeepRates[b.metrics.tier].push(b.metrics.promise_keep_rate);
    }
  });
  
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const reliabilityData = {
    labels: ['Green Tier', 'Amber Tier', 'Red Tier'],
    datasets: [
      {
        data: [
          avg(tierKeepRates.Green) * 100,
          avg(tierKeepRates.Amber) * 100,
          avg(tierKeepRates.Red) * 100
        ],
        backgroundColor: [
          'rgba(16, 185, 129, 0.15)',
          isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(217, 119, 6, 0.15)',
          isDark ? 'rgba(244, 63, 94, 0.15)' : 'rgba(225, 29, 72, 0.15)'
        ],
        borderColor: [
          greenColor,
          amberColor,
          redColor
        ],
        borderWidth: 1.5,
        borderRadius: 6,
        barThickness: 32,
      }
    ]
  };

  const reliabilityOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: textPrimary,
        bodyColor: textSecondary,
        borderColor: tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (context) => `Avg Keep Rate: ${context.parsed.y.toFixed(0)}%`
        }
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        max: 100,
        ticks: { color: textSecondary, font: { family: 'Inter', size: 10 } },
        grid: { color: gridColor }
      },
      x: {
        ticks: { color: textSecondary, font: { family: 'Inter', size: 11, weight: '500' } },
        grid: { display: false }
      }
    }
  };

  // 3. Risk Flags Frequencies (Horizontal Bar)
  const flagCounts = {};
  data.forEach(b => {
    b.turn_outcomes.forEach(turn => {
      (turn.risk_flags || []).forEach(flag => {
        const cleanName = flag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        flagCounts[cleanName] = (flagCounts[cleanName] || 0) + 1;
      });
    });
  });

  const sortedFlags = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // top 5 flags

  const flagsData = {
    labels: sortedFlags.map(f => f[0]),
    datasets: [
      {
        data: sortedFlags.map(f => f[1]),
        backgroundColor: 'rgba(255, 101, 0, 0.15)',
        borderColor: brandOrange,
        borderWidth: 1.5,
        borderRadius: 4,
        barThickness: 16,
      }
    ]
  };

  const flagsOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { 
        backgroundColor: tooltipBg,
        titleColor: textPrimary,
        bodyColor: textSecondary,
        borderColor: tooltipBorder,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: textSecondary, font: { family: 'Inter', size: 10 }, stepSize: 1 },
        grid: { color: gridColor }
      },
      y: {
        ticks: { color: textSecondary, font: { family: 'Inter', size: 11, weight: '500' } },
        grid: { display: false }
      }
    }
  };

  // 4. Final States Distribution (Bar)
  const stateCounts = {};
  data.forEach(b => {
    if (b.metrics && b.metrics.current_state) {
      const state = b.metrics.current_state;
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    }
  });

  const stateLabels = Object.keys(stateCounts);
  const stateValues = Object.values(stateCounts);

  const statesData = {
    labels: stateLabels,
    datasets: [
      {
        data: stateValues,
        backgroundColor: isDark ? 'rgba(30, 62, 98, 0.4)' : 'rgba(30, 62, 98, 0.15)',
        borderColor: isDark ? '#60a5fa' : '#1e3e62',
        borderWidth: 1.5,
        borderRadius: 4,
        barThickness: 24,
      }
    ]
  };

  const statesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { 
        backgroundColor: tooltipBg,
        titleColor: textPrimary,
        bodyColor: textSecondary,
        borderColor: tooltipBorder,
        borderWidth: 1
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: textSecondary, font: { family: 'Inter', size: 10 }, stepSize: 1 },
        grid: { color: gridColor }
      },
      x: {
        ticks: { 
          color: textSecondary, 
          font: { family: 'Inter', size: 10, weight: '500' },
          maxRotation: 45,
          minRotation: 45
        },
        grid: { display: false }
      }
    }
  };

  return (
    <div className="metrics-dashboard-grid">
      {/* Chart 1: Doughnut */}
      <div className="glass card chart-card">
        <div className="chart-header">
          <h3 className="chart-title">Risk Tier Segmentations</h3>
          <span className="chart-subtitle">Portfolio concentration breakdown</span>
        </div>
        <div className="chart-container">
          <Doughnut data={doughnutData} options={doughnutOptions} />
        </div>
      </div>
      
      {/* Chart 2: Promise Reliability */}
      <div className="glass card chart-card">
        <div className="chart-header">
          <h3 className="chart-title">Promise Fulfillment Rates</h3>
          <span className="chart-subtitle">Average promise keep rate (%) by risk tier</span>
        </div>
        <div className="chart-container">
          <BarChart data={reliabilityData} options={reliabilityOptions} />
        </div>
      </div>

      {/* Chart 3: Top Risk Flags */}
      <div className="glass card chart-card">
        <div className="chart-header">
          <h3 className="chart-title">Risk Signals Distribution</h3>
          <span className="chart-subtitle">Frequency of semantic flag detections</span>
        </div>
        <div className="chart-container">
          <BarChart data={flagsData} options={flagsOptions} />
        </div>
      </div>

      {/* Chart 4: Final States */}
      <div className="glass card chart-card">
        <div className="chart-header">
          <h3 className="chart-title">Portfolio State Outflow</h3>
          <span className="chart-subtitle">Distribution of final borrower lifecycle states</span>
        </div>
        <div className="chart-container" style={{ height: '240px' }}>
          <BarChart data={statesData} options={statesOptions} />
        </div>
      </div>
    </div>
  );
}
