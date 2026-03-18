import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASELINE = 2.1e12;

const IRS_DATA = [
  { label: 'Under $15k',  min: 0,       max: 15000,   returns: 21800000, total_agi: 136e9,  D: 0.16 },
  { label: '$15k–$25k',   min: 15000,   max: 25000,   returns: 12600000, total_agi: 254e9,  D: 0.47 },
  { label: '$25k–$35k',   min: 25000,   max: 35000,   returns: 11400000, total_agi: 343e9,  D: 0.55 },
  { label: '$35k–$50k',   min: 35000,   max: 50000,   returns: 14200000, total_agi: 597e9,  D: 0.60 },
  { label: '$50k–$75k',   min: 50000,   max: 75000,   returns: 18700000, total_agi: 1136e9, D: 0.64 },
  { label: '$75k–$100k',  min: 75000,   max: 100000,  returns: 13900000, total_agi: 1200e9, D: 0.67 },
  { label: '$100k–$150k', min: 100000,  max: 150000,  returns: 17600000, total_agi: 2133e9, D: 0.68 },
  { label: '$150k–$200k', min: 150000,  max: 200000,  returns: 8400000,  total_agi: 1445e9, D: 0.69 },
  { label: '$200k–$250k', min: 200000,  max: 250000,  returns: 4100000,  total_agi: 920e9,  D: 0.70 },
  { label: '$250k–$500k', min: 250000,  max: 500000,  returns: 5600000,  total_agi: 1880e9, D: 0.72 },
  { label: '$500k–$1M',   min: 500000,  max: 1000000, returns: 1700000,  total_agi: 1148e9, D: 0.76 },
  { label: '$1M+',        min: 1000000, max: null,    returns: 900000,   total_agi: 3100e9, D: 0.78 },
];

// 2024 federal tax brackets — single filer, $14,600 standard deduction
const STD_DEDUCTION = 14600;
const BRACKETS_2024 = [
  { floor:      0, rate: 0.10, base:        0 },
  { floor:  11600, rate: 0.12, base:     1160 },
  { floor:  47150, rate: 0.22, base:     5426 },
  { floor: 100525, rate: 0.24, base:  17168.5 },
  { floor: 191950, rate: 0.32, base:  39110.5 },
  { floor: 243725, rate: 0.35, base:  55678.5 },
  { floor: 609350, rate: 0.37, base: 183647.25 },
];

// ─── Panel A data ─────────────────────────────────────────────────────────────

const CAPITAL_GAINS_AGI = [2e9, 3e9, 4e9, 8e9, 18e9, 22e9, 48e9, 52e9, 45e9, 148e9, 182e9, 620e9];
const CARRIED_INTEREST_LABEL = '$1M+';
const CARRIED_INTEREST_AGI = 25e9;

// ─── Panel B data ─────────────────────────────────────────────────────────────

// delta_D[cohort_index] for each deduction removal checkbox
const DELTA_D_MORTGAGE = { '$50k–$75k': 0.007, '$75k–$100k': 0.012, '$100k–$150k': 0.013, '$150k–$200k': 0.017, '$200k–$250k': 0.019, '$250k–$500k': 0.020, '$500k–$1M': 0.010, '$1M+': 0.006 };
const DELTA_D_SALT      = { '$75k–$100k': 0.003, '$100k–$150k': 0.004, '$150k–$200k': 0.006, '$200k–$250k': 0.007, '$250k–$500k': 0.005, '$500k–$1M': 0.004 };
const DELTA_D_CHARITY   = { '$100k–$150k': 0.004, '$150k–$200k': 0.007, '$200k–$250k': 0.010, '$250k–$500k': 0.012, '$500k–$1M': 0.016, '$1M+': 0.021 };
const DELTA_D_RETIRE    = { '$35k–$50k': 0.018, '$50k–$75k': 0.025, '$75k–$100k': 0.027, '$100k–$150k': 0.022, '$150k–$200k': 0.019, '$200k–$250k': 0.017, '$250k–$500k': 0.010, '$500k–$1M': 0.006 };

// ─── Panel C data ─────────────────────────────────────────────────────────────

const SPENDING_PROGRAMS = [
  { id: 'prek',      label: 'Universal Pre-K (ages 3–4)',        short: 'Pre-K',       cost: 80e9,   note: 'Well-modeled. Multiple CBO and academic estimates cluster here.' },
  { id: 'college',   label: 'Free public college (tuition)',      short: 'Free college', cost: 80e9,   note: 'Tuition at public universities only. Not room, board, or private schools.' },
  { id: 'leave',     label: 'Paid family leave (12 weeks)',       short: 'Family leave', cost: 25e9,   note: 'Partial wage replacement. Based on multiple CBO estimates.' },
  { id: 'meals',     label: 'Universal school meals (K–12)',      short: 'School meals', cost: 15e9,   note: 'Expansion of existing federal program.' },
  { id: 'publicopt', label: 'Public option (healthcare)',         short: 'Public option',cost: 750e9,  note: 'Federal insurer competing with private market. Wide range depending on uptake.' },
  { id: 'm4a',       label: 'Medicare for All',                   short: 'Medicare 4 All',cost: 3000e9, note: 'Net additional federal spending. Range $2T–$4T depending on design.' },
  { id: 'climate',   label: 'Green New Deal / climate',           short: 'Climate',      cost: 500e9,  note: 'Very wide range. Order of magnitude estimate only.' },
  { id: 'ubi',       label: 'Universal Basic Income ($1k/mo)',    short: 'UBI',          cost: 500e9,  note: 'Net of replaced programs. Highly design-dependent.' },
];

// ─── Pure math ────────────────────────────────────────────────────────────────

const sigmoid = x => 1 / (1 + Math.exp(-x));

const effectiveRate = (I, R_max, k, I_mid) =>
  R_max * sigmoid(k * (Math.log(I) - Math.log(I_mid)));

const taxOwed = (I, R_max, k, I_mid) =>
  effectiveRate(I, R_max, k, I_mid) * I;

const currentLawRate = income => {
  const taxable = Math.max(0, income - STD_DEDUCTION);
  if (taxable === 0) return 0;
  let b = BRACKETS_2024[0];
  for (const bracket of BRACKETS_2024) {
    if (taxable >= bracket.floor) b = bracket;
    else break;
  }
  const tax = b.base + (taxable - b.floor) * b.rate;
  return tax / income;
};

const marginalRate = income => {
  const taxable = income - STD_DEDUCTION;
  if (taxable <= 0) return 0;
  let b = BRACKETS_2024[0];
  for (const bracket of BRACKETS_2024) {
    if (taxable >= bracket.floor) b = bracket;
    else break;
  }
  return b.rate;
};

// Revenue calculation per spec order of operations.
// D(I) is ALWAYS applied (baked in). Panel B increases D toward 1.0 (removing deductions).
const calcRevenue = (R_max, k, I_mid, panelA, panelB) => {
  let base = 0;
  IRS_DATA.forEach((c, i) => {
    // Step 1-2: AGI adjustments
    let agi = c.total_agi;
    if (panelA.capitalGains) agi += CAPITAL_GAINS_AGI[i];
    if (panelA.carriedInterest && c.label === CARRIED_INTEREST_LABEL) agi += CARRIED_INTEREST_AGI;
    // Step 3: avg income
    const avg = agi / c.returns;
    // Step 4-5: D always applied; Panel B increases D toward 1.0
    let D = c.D;
    if (panelB.removeAll) {
      D = 1.0;
    } else {
      if (panelB.mortgage)  D = Math.min(1.0, D + (DELTA_D_MORTGAGE[c.label] ?? 0));
      if (panelB.salt)      D = Math.min(1.0, D + (DELTA_D_SALT[c.label]     ?? 0));
      if (panelB.charity)   D = Math.min(1.0, D + (DELTA_D_CHARITY[c.label]  ?? 0));
      if (panelB.retire)    D = Math.min(1.0, D + (DELTA_D_RETIRE[c.label]   ?? 0));
    }
    // Step 6-8: taxable income and revenue
    const taxable = avg * D;
    const tax = taxOwed(taxable, R_max, k, I_mid);
    base += tax * c.returns;
  });
  return base;
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtIncome = n => {
  if (n >= 1e6) return `$${(n / 1e6 % 1 === 0 ? n / 1e6 : (n / 1e6).toFixed(1))}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
};

const fmtDollar = n => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString()}`;
};

const fmtRevTotal = n => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
};

const fmtRevDelta = n => {
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '−';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(0)}B`;
  return `${sign}$${(abs / 1e6).toFixed(0)}M`;
};

// ─── Chart data ───────────────────────────────────────────────────────────────

const LOG_MIN = Math.log10(10_000);
const LOG_MAX = Math.log10(10_000_000);
const X_TICKS = [10000, 50000, 100000, 250000, 1_000_000, 10_000_000];
const CALLOUT_INCOMES = [50000, 150000, 500000];

const fmtXTick = v => {
  if (v >= 1e6) return `$${v / 1e6}M`;
  return `$${v / 1e3}k`;
};

// AGI at which each bracket boundary is crossed
const BRACKET_BOUNDARIES = [26200, 61750, 115125, 206550, 258325, 623950];

// Current law smooth effective rate — always after-deductions ghost
// Uses avg D across cohorts weighted by total_agi as a rough approximation for display
// For chart display: use the actual currentLawRate() which applies std deduction from formula
const CL_SMOOTH_DATA = Array.from({ length: 151 }, (_, i) => {
  const income = Math.pow(10, LOG_MIN + (i / 150) * (LOG_MAX - LOG_MIN));
  return { income, current: currentLawRate(income) * 100 };
});

const CL_STEP_DATA = [
  { income: 10_000,     marginal: 0  },
  { income: 14_600,     marginal: 10 },
  { income: 26_200,     marginal: 12 },
  { income: 61_750,     marginal: 22 },
  { income: 115_125,    marginal: 24 },
  { income: 206_550,    marginal: 32 },
  { income: 258_325,    marginal: 35 },
  { income: 623_950,    marginal: 37 },
  { income: 10_000_000, marginal: 37 },
];

const makeChartData = (R_max, k, I_mid, applyD) =>
  Array.from({ length: 151 }, (_, i) => {
    const income = Math.pow(10, LOG_MIN + (i / 150) * (LOG_MAX - LOG_MIN));
    // When applyD: use a blended D approximation for display (weighted avg across cohorts)
    // For chart, use a smooth D(income) approximation: interpolate from IRS cohort D values
    let rate;
    if (applyD) {
      // Find nearest cohort D by income
      let D = 0.87;
      for (const c of IRS_DATA) {
        if (income >= c.min && (c.max == null || income < c.max)) { D = c.D; break; }
      }
      const taxableIncome = income * D;
      rate = taxableIncome > 0 ? effectiveRate(taxableIncome, R_max, k, I_mid) * taxableIncome / income * 100 : 0;
    } else {
      rate = effectiveRate(income, R_max, k, I_mid) * 100;
    }
    return { income, user: rate };
  });

// ─── Log slider helpers for I_mid ($10k–$1M) ─────────────────────────────────

const IMID_MIN = 10000;
const IMID_MAX = 1_000_000;
const imidToSlider = v => (Math.log(v / IMID_MIN) / Math.log(IMID_MAX / IMID_MIN)) * 100;
const sliderToImid = s => Math.round(IMID_MIN * Math.pow(IMID_MAX / IMID_MIN, s / 100));

// ─── Qualitative k hint ───────────────────────────────────────────────────────

const kHint = k => {
  if (k < 0.6) return 'nearly flat';
  if (k < 1.2) return 'gentle';
  if (k < 2.0) return 'moderate';
  if (k < 3.0) return 'steep';
  return 'very steep';
};

// ─── Income input parser ──────────────────────────────────────────────────────

const parseIncome = s => {
  if (!s) return null;
  const cleaned = s.replace(/[$,\s]/g, '');
  const m = cleaned.match(/^([\d.]+)([km]?)$/i);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (m[2].toLowerCase() === 'k') v *= 1000;
  if (m[2].toLowerCase() === 'm') v *= 1e6;
  return v > 0 ? v : null;
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const userEntry = payload.find(p => p.dataKey === 'user');
  if (!userEntry) return null;
  const { income, user: userRate } = userEntry.payload;
  if (userRate == null) return null;
  const tax = income * userRate / 100;
  const clEffective = currentLawRate(income) * 100;
  const clMarginal = marginalRate(income) * 100;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs min-w-[170px]">
      <p className="font-semibold text-gray-900 mb-1">{fmtIncome(income)}</p>
      <p className="text-blue-600">Your curve: {userRate.toFixed(1)}%</p>
      <p className="text-blue-600">Tax owed: {fmtDollar(tax)}</p>
      <div className="border-t border-gray-100 mt-1.5 pt-1.5 space-y-0.5">
        <p className="text-gray-500">Effective rate: {clEffective.toFixed(1)}%</p>
        <p className="text-gray-500">Marginal bracket: {clMarginal.toFixed(0)}%</p>
      </div>
    </div>
  );
};

// ─── Collapsible panel wrapper ────────────────────────────────────────────────

const Panel = ({ title, children, disclaimer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className="text-gray-400 text-lg leading-none">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-6 pb-5 border-t border-gray-100 pt-4">
          {children}
          {disclaimer && (
            <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">{disclaimer}</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Checkbox row ─────────────────────────────────────────────────────────────

const CheckRow = ({ checked, onChange, label, note, disabled, children }) => (
  <div className="mb-3">
    <label className={`flex items-start gap-2.5 cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 accent-blue-600 shrink-0"
      />
      <span>
        <span className="text-sm text-gray-700">{label}</span>
        {note && <span className="block text-xs text-gray-400 mt-0.5">{note}</span>}
      </span>
    </label>
    {checked && children}
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [R_max, setRmax] = useState(0.37);
  const [I_mid, setImid] = useState(130000);
  const [k, setK]        = useState(1.5);
  const [incomeStr, setIncomeStr] = useState('');
  const [copied, setCopied]       = useState(false);

  // Panel A state
  const [pA_capitalGains,       setPACapGains]    = useState(false);
  const [pA_carriedInterest,    setPACarried]     = useState(false);
  const [pA_collateralized,     setPACollat]      = useState(false);
  const [pA_collateralSlider,   setPACollatSlider]= useState(175e9);

  // Panel B state
  const [pB_mortgage,  setPBMortgage] = useState(false);
  const [pB_salt,      setPBSalt]     = useState(false);
  const [pB_charity,   setPBCharity]  = useState(false);
  const [pB_retire,    setPBRetire]   = useState(false);
  const [pB_removeAll, setPBAll]      = useState(false);

  // Panel C state
  const [spending, setSpending] = useState({});

  const toggleSpending = id => {
    setSpending(prev => {
      const next = { ...prev, [id]: !prev[id] };
      // Medicare for All and Public option mutually exclusive
      if (id === 'm4a'      && next.m4a)      next.publicopt = false;
      if (id === 'publicopt' && next.publicopt) next.m4a = false;
      return next;
    });
  };

  // Parse URL on mount
  useEffect(() => {
    const path = decodeURIComponent(window.location.pathname.replace(/^\//, ''));
    const m = path.match(/^([\d.]+)\|([\d.]+)\|(\d+)$/);
    if (m) {
      const r  = parseFloat(m[1]);
      const kv = parseFloat(m[2]);
      const iv = parseInt(m[3], 10);
      if (r >= 0 && r <= 0.8)       setRmax(r);
      if (kv >= 0.3 && kv <= 4.0)   setK(kv);
      if (iv >= 10000 && iv <= 1e6)  setImid(iv);
    }
  }, []);

  // Derived panel state
  const panelA = { capitalGains: pA_capitalGains, carriedInterest: pA_carriedInterest, collateralizedGains: pA_collateralized };
  const panelB = { mortgage: pB_mortgage, salt: pB_salt, charity: pB_charity, retire: pB_retire, removeAll: pB_removeAll };
  const anyPanelB = pB_mortgage || pB_salt || pB_charity || pB_retire || pB_removeAll;

  // Revenue
  const revenue = useMemo(() => calcRevenue(R_max, k, I_mid, panelA, panelB), [R_max, k, I_mid, pA_capitalGains, pA_carriedInterest, pB_mortgage, pB_salt, pB_charity, pB_retire, pB_removeAll]);

  // Collateralized gains line item (step 10)
  const collateralizedRevenue = useMemo(() => {
    if (!pA_collateralized) return 0;
    const D_top = 0.87;
    const taxableAt5M = 5_000_000 * D_top;
    const rate = effectiveRate(taxableAt5M, R_max, k, I_mid) * taxableAt5M / 5_000_000;
    return pA_collateralSlider * rate;
  }, [pA_collateralized, pA_collateralSlider, R_max, k, I_mid]);

  const totalRevenue = revenue + collateralizedRevenue;
  const revDelta  = totalRevenue - BASELINE;
  const revPct    = (revDelta / BASELINE) * 100;

  // Chart data — mode switches when any Panel B box checked
  const chartData = useMemo(() => makeChartData(R_max, k, I_mid, anyPanelB), [R_max, k, I_mid, anyPanelB]);

  // Bracket delta for bar chart
  const bracketData = useMemo(() =>
    IRS_DATA.map(c => {
      const avg = c.total_agi / c.returns;
      return {
        label: c.label,
        diff: (effectiveRate(avg, R_max, k, I_mid) - currentLawRate(avg)) * 100,
      };
    }),
    [R_max, k, I_mid]
  );

  // Personal income
  const personalIncome      = useMemo(() => parseIncome(incomeStr), [incomeStr]);
  const personalUserRate    = personalIncome != null ? effectiveRate(personalIncome, R_max, k, I_mid) : null;
  const personalCurrentRate = personalIncome != null ? currentLawRate(personalIncome) : null;
  const personalDiff = personalUserRate != null ? (personalCurrentRate - personalUserRate) * 100 : null;

  // Spending
  const checkedPrograms = SPENDING_PROGRAMS.filter(p => spending[p.id]);
  const anySpending = checkedPrograms.length > 0;
  let runningBalance = totalRevenue;
  const spendingRows = checkedPrograms.map(p => {
    const funded = runningBalance >= p.cost;
    const shortfall = funded ? 0 : p.cost - runningBalance;
    runningBalance -= p.cost;
    return { ...p, funded, shortfall };
  });
  const netBalance = totalRevenue - checkedPrograms.reduce((s, p) => s + p.cost, 0);

  // Share text
  const shareText = useMemo(() => {
    const line1 = `${R_max.toFixed(2)}|${k.toFixed(1)}|${Math.round(I_mid)}`;
    const rStr = fmtRevTotal(totalRevenue);
    let line2 = '';
    if (personalDiff != null) {
      const absP = Math.abs(personalDiff);
      line2 = personalDiff > 0 ? `I save ${absP.toFixed(1)}%. ` : `I pay ${absP.toFixed(1)}% more. `;
    }
    line2 += `Raises ${rStr}.`;
    if (!anySpending) return `${line1}\n${line2}`;
    const names = checkedPrograms.slice(0, 4).map(p => {
      const row = spendingRows.find(r => r.id === p.id);
      return `${p.short} ${row?.funded ? '✓' : '✗'}`;
    });
    const truncated = checkedPrograms.length > 4 ? names.slice(0, 4).join(', ') + '…' : names.join(', ');
    return `${line1}\n${line2}\nFunds: ${truncated}`;
  }, [R_max, k, I_mid, totalRevenue, personalDiff, anySpending, checkedPrograms, spendingRows]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const yMax = R_max * 100 + 5;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Brackets Are Bad</h1>
          <p className="text-gray-500 mt-1 text-base">
            Design a smooth, continuous income tax curve. Watch what it does to federal revenue.
          </p>
        </header>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Chart card */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Effective Tax Rate by Income
              </h2>
              {anyPanelB && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">After deductions</span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="income"
                  scale="log"
                  type="number"
                  domain={[10_000, 10_000_000]}
                  ticks={X_TICKS}
                  tickFormatter={fmtXTick}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  allowDataOverflow
                />
                <YAxis
                  domain={[0, yMax]}
                  tickCount={6}
                  tickFormatter={v => `${Math.round(v)}%`}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />

                {/* Marginal bracket steps */}
                <Line data={CL_STEP_DATA} dataKey="marginal" type="stepAfter"
                  stroke="#e5e7eb" strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} />

                {/* Current law smooth effective rate */}
                <Line data={CL_SMOOTH_DATA} dataKey="current"
                  stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="5 4"
                  dot={false} activeDot={false} isAnimationActive={false} />

                {/* Bracket boundary ticks */}
                {BRACKET_BOUNDARIES.map(x => (
                  <ReferenceLine key={x} x={x} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="2 4" />
                ))}

                {/* User curve */}
                <Line dataKey="user" stroke="#2563eb" strokeWidth={2.5}
                  dot={false} isAnimationActive={false} />

                {/* Callout dots */}
                {CALLOUT_INCOMES.map(inc => (
                  <ReferenceDot key={inc} x={inc} y={effectiveRate(inc, R_max, k, I_mid) * 100}
                    r={5} fill="#2563eb" stroke="white" strokeWidth={2} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#2563eb" strokeWidth="2.5" /></svg>
                Your curve
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="5 4" /></svg>
                Effective rate (current law)
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#e5e7eb" strokeWidth="1" /></svg>
                Marginal brackets
              </span>
              <span className="text-gray-400">Dots at $50k, $150k, $500k — hover for details</span>
            </div>

            {/* Income input */}
            <div className="border-t border-gray-100 mt-4 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-gray-600">What's your income?</label>
                <input
                  type="text"
                  value={incomeStr}
                  onChange={e => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setIncomeStr(digits ? Number(digits).toLocaleString() : '');
                  }}
                  placeholder="75,000"
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Nothing is stored.</p>
              {personalIncome != null && (
                <div className="mt-3 p-4 bg-gray-50 rounded-xl">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Your curve</p>
                      <p className="text-xl font-bold text-blue-600">{(personalUserRate * 100).toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">effective rate</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmtDollar(personalIncome * personalUserRate)} owed</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Current law</p>
                      <p className="text-xl font-bold text-gray-700">{(personalCurrentRate * 100).toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">effective rate</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmtDollar(personalIncome * personalCurrentRate)} owed</p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${personalDiff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {personalDiff > 0
                      ? `You save ${personalDiff.toFixed(1)} percentage points under this curve.`
                      : `You pay ${(-personalDiff).toFixed(1)} percentage points more under this curve.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Revenue panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Federal Revenue from Income Taxes
            </h2>

            <p className="text-3xl font-bold text-gray-900 tabular-nums">{fmtRevTotal(totalRevenue)}</p>
            <p className="text-xs text-gray-400 mb-1">{anyPanelB ? 'projected (deductions removed)' : 'projected (current deductions)'}</p>

            <div className={`text-xl font-bold tabular-nums ${revDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmtRevDelta(revDelta)}
              <span className="text-sm font-normal ml-1 text-gray-400">
                ({revDelta >= 0 ? '+' : ''}{revPct.toFixed(1)}%)
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">vs. 2022 actual ($2.10T)</p>

            {/* Capital gains line item */}
            {pA_capitalGains && (
              <p className="text-xs text-gray-500 mb-1">
                + Capital gains taxed as ordinary income (included above)
              </p>
            )}
            {pA_collateralized && (
              <p className="text-xs text-gray-500 mb-1">
                + Collateralized gains: ~{fmtRevTotal(collateralizedRevenue)} (estimated)
              </p>
            )}

            {/* Spending section */}
            {anySpending && (
              <div className="border-t border-gray-100 pt-3 mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Spending</p>
                {spendingRows.map(row => (
                  <div key={row.id} className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-600 truncate mr-2">{row.label}</span>
                    <span className={`shrink-0 font-medium ${row.funded ? 'text-green-600' : 'text-red-500'}`}>
                      {row.funded
                        ? `−${fmtRevTotal(row.cost)} ✓`
                        : `−${fmtRevTotal(row.cost)} ✗`}
                    </span>
                  </div>
                ))}
                <div className={`mt-2 pt-2 border-t border-gray-100 text-sm font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  Net: {netBalance >= 0 ? fmtRevTotal(netBalance) + ' surplus' : fmtRevTotal(-netBalance) + ' shortfall'}
                </div>
              </div>
            )}

            {/* Rate delta bar chart */}
            <div className="border-t border-gray-100 pt-3 flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Rate Δ vs. current law
              </p>
              <ResponsiveContainer width="100%" height={268}>
                <BarChart layout="vertical" data={bracketData}
                  margin={{ top: 0, right: 14, left: 0, bottom: 0 }} barCategoryGap="15%">
                  <XAxis type="number" domain={['dataMin', 'dataMax']}
                    tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}pp`}
                    tick={{ fontSize: 9, fill: '#9ca3af' }} />
                  <YAxis type="category" dataKey="label" width={74} tick={{ fontSize: 9, fill: '#6b7280' }} />
                  <Tooltip formatter={v => [`${v > 0 ? '+' : ''}${v.toFixed(2)} pp`, 'vs. current law']}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <ReferenceLine x={0} stroke="#e5e7eb" strokeWidth={1} />
                  <Bar dataKey="diff" radius={[0, 3, 3, 0]}>
                    {bracketData.map((entry, i) => (
                      <Cell key={i} fill={entry.diff > 0 ? '#ef4444' : '#22c55e'} fillOpacity={0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-xs text-gray-400 mt-1">
                <span><span className="text-red-400 font-bold">■</span> Pays more</span>
                <span><span className="text-green-500 font-bold">■</span> Pays less</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-medium text-gray-700">Top rate</label>
                <span className="text-lg font-bold text-blue-600 tabular-nums">{(R_max * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={0} max={80} step={1}
                value={Math.round(R_max * 100)}
                onChange={e => setRmax(parseInt(e.target.value, 10) / 100)}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>0%</span><span>80%</span></div>
            </div>
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-medium text-gray-700">Pivot income</label>
                <span className="text-lg font-bold text-blue-600 tabular-nums">{fmtIncome(I_mid)}</span>
              </div>
              <input type="range" min={0} max={100} step={0.5}
                value={imidToSlider(I_mid)}
                onChange={e => setImid(sliderToImid(parseFloat(e.target.value)))}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>$10k</span><span>$1M</span></div>
            </div>
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-medium text-gray-700">Progressivity</label>
                <span className="text-lg font-bold text-blue-600 tabular-nums">
                  {k.toFixed(1)}
                  <span className="text-xs font-normal text-gray-400 ml-1">({kHint(k)})</span>
                </span>
              </div>
              <input type="range" min={0.3} max={4.0} step={0.1}
                value={k}
                onChange={e => setK(parseFloat(e.target.value))}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>0.3 flat</span><span>4.0 steep</span></div>
            </div>
          </div>
        </div>

        {/* Panel A */}
        <Panel
          title="What counts as income?"
          disclaimer="Income estimates from IRS SOI 2022. Behavioral responses not modeled."
        >
          <CheckRow
            checked={pA_capitalGains}
            onChange={e => setPACapGains(e.target.checked)}
            label="Tax capital gains as ordinary income"
            note="Approximate. IRS SOI 2022 long-term capital gains by AGI cohort. Behavioral response not modeled."
          />
          <CheckRow
            checked={pA_carriedInterest}
            onChange={e => setPACarried(e.target.checked)}
            label="Tax carried interest as ordinary income"
            note="Estimate. Carried interest is difficult to isolate in published IRS data. Adds ~$25B to $1M+ cohort."
          />
          <CheckRow
            checked={pA_collateralized}
            onChange={e => setPACollat(e.target.checked)}
            label="Tax collateralized unrealized gains"
            note="Highly speculative. Behavioral response could substantially reduce actual revenue."
          >
            <div className="ml-6 mt-2 mb-1">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Estimated annual collateralized gains</span>
                <span className="font-medium">{fmtRevTotal(pA_collateralSlider)}</span>
              </div>
              <input type="range" min={50e9} max={500e9} step={25e9}
                value={pA_collateralSlider}
                onChange={e => setPACollatSlider(parseFloat(e.target.value))}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>$50B</span><span>$500B</span></div>
            </div>
          </CheckRow>
        </Panel>

        {/* Panel B */}
        <Panel
          title="Remove deductions"
          disclaimer="Deduction values derived from IRS SOI 2022. Behavioral effects not modeled."
        >
          <CheckRow
            checked={pB_removeAll}
            onChange={e => {
              setPBAll(e.target.checked);
              if (e.target.checked) {
                setPBMortgage(true); setPBSalt(true); setPBCharity(true); setPBRetire(true);
              }
            }}
            label="Remove all deductions (clean slate)"
            note="Sets taxable income = gross income for all cohorts."
          />
          <div className="mt-3 space-y-0">
            <CheckRow
              checked={pB_mortgage}
              onChange={e => setPBMortgage(e.target.checked)}
              label="Remove mortgage interest deduction"
              note="Primarily benefits homeowners in higher-cost markets."
              disabled={pB_removeAll}
            />
            <CheckRow
              checked={pB_salt}
              onChange={e => setPBSalt(e.target.checked)}
              label="Remove SALT deduction"
              note="TCJA already capped SALT at $10k. Affects upper-middle earners in high-tax states."
              disabled={pB_removeAll}
            />
            <CheckRow
              checked={pB_charity}
              onChange={e => setPBCharity(e.target.checked)}
              label="Remove charitable deduction"
              note="Removing this deduction may reduce charitable giving. Behavioral response not modeled."
              disabled={pB_removeAll}
            />
            <CheckRow
              checked={pB_retire}
              onChange={e => setPBRetire(e.target.checked)}
              label="Remove retirement contribution deductions (401k/IRA)"
              note="Largest single deduction category. Broad impact across middle and upper-middle incomes."
              disabled={pB_removeAll}
            />
          </div>
        </Panel>

        {/* Panel C */}
        <Panel
          title="What do you want to fund?"
          disclaimer="Program costs are gross additional federal spending estimates. Wide uncertainty ranges. Order of magnitude only."
        >
          <div className="space-y-0">
            {SPENDING_PROGRAMS.map(p => (
              <CheckRow
                key={p.id}
                checked={!!spending[p.id]}
                onChange={() => toggleSpending(p.id)}
                label={`${p.label} — ${fmtRevTotal(p.cost)}/yr`}
                note={p.note}
              />
            ))}
          </div>
        </Panel>

        {/* Share card — compressed */}
        <div className="mb-6 flex items-start gap-3">
          <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap leading-relaxed flex-1">{shareText}</pre>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shrink-0"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* Footer */}
        <footer className="text-xs text-gray-400 space-y-1 pb-10">
          <p>Based on IRS Statistics of Income 2022 (approximate figures).</p>
          <p>Effective rates shown. Does not include payroll taxes, capital gains taxes (unless checked), deductions (unless removed), or credits.</p>
          <p>This is version two. More to come.</p>
        </footer>

      </div>
    </div>
  );
}
