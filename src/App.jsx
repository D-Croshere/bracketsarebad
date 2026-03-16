import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASELINE = 2.232e12;

const IRS_DATA = [
  { label: 'Under $15k',  min: 0,       max: 15000,   returns: 21800000, total_agi: 136e9 },
  { label: '$15k–$25k',   min: 15000,   max: 25000,   returns: 12600000, total_agi: 254e9 },
  { label: '$25k–$35k',   min: 25000,   max: 35000,   returns: 11400000, total_agi: 343e9 },
  { label: '$35k–$50k',   min: 35000,   max: 50000,   returns: 14200000, total_agi: 597e9 },
  { label: '$50k–$75k',   min: 50000,   max: 75000,   returns: 18700000, total_agi: 1136e9 },
  { label: '$75k–$100k',  min: 75000,   max: 100000,  returns: 13900000, total_agi: 1200e9 },
  { label: '$100k–$150k', min: 100000,  max: 150000,  returns: 17600000, total_agi: 2133e9 },
  { label: '$150k–$200k', min: 150000,  max: 200000,  returns: 8400000,  total_agi: 1445e9 },
  { label: '$200k–$250k', min: 200000,  max: 250000,  returns: 4100000,  total_agi: 920e9 },
  { label: '$250k–$500k', min: 250000,  max: 500000,  returns: 5600000,  total_agi: 1880e9 },
  { label: '$500k–$1M',   min: 500000,  max: 1000000, returns: 1700000,  total_agi: 1148e9 },
  { label: '$1M+',        min: 1000000, max: null,    returns: 900000,   total_agi: 3100e9 },
];

// Current law effective rates (single filer, 2024, approximate)
const CL_POINTS = [
  [15000,    0.020],
  [30000,    0.085],
  [50000,    0.132],
  [75000,    0.168],
  [100000,   0.187],
  [150000,   0.210],
  [200000,   0.225],
  [400000,   0.282],
  [600000,   0.310],
  [1000000,  0.338],
  [5000000,  0.365],
  [10000000, 0.370],
];

const PRESETS = [
  { label: 'Current law',         R_max: 0.37, I_mid: 130000, k: 1.5 },
  { label: 'Flat 15%',            R_max: 0.15, I_mid: 50000,  k: 0.3 },
  { label: 'Flat 25%',            R_max: 0.25, I_mid: 50000,  k: 0.3 },
  { label: 'Steep progressive',   R_max: 0.60, I_mid: 200000, k: 2.5 },
  { label: 'High top, low floor', R_max: 0.55, I_mid: 80000,  k: 2.0 },
];

const CALLOUT_INCOMES = [50000, 150000, 500000];

// ─── Pure math ────────────────────────────────────────────────────────────────

const sigmoid = x => 1 / (1 + Math.exp(-x));

const effectiveRate = (I, R_max, k, I_mid) =>
  R_max * sigmoid(k * (Math.log(I) - Math.log(I_mid)));

const taxOwed = (I, R_max, k, I_mid) =>
  effectiveRate(I, R_max, k, I_mid) * I;

const currentLawRate = income => {
  if (income <= CL_POINTS[0][0]) return CL_POINTS[0][1];
  if (income >= CL_POINTS[CL_POINTS.length - 1][0]) return CL_POINTS[CL_POINTS.length - 1][1];
  for (let i = 0; i < CL_POINTS.length - 1; i++) {
    const [x0, y0] = CL_POINTS[i];
    const [x1, y1] = CL_POINTS[i + 1];
    if (income >= x0 && income <= x1) {
      const t = (income - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 0;
};

const calcRevenue = (R_max, k, I_mid) =>
  IRS_DATA.reduce((sum, c) => {
    const avg = c.total_agi / c.returns;
    return sum + taxOwed(avg, R_max, k, I_mid) * c.returns;
  }, 0);

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

const LOG_MIN = Math.log10(1000);
const LOG_MAX = Math.log10(10_000_000);
const X_TICKS = [10000, 50000, 100000, 250000, 1_000_000, 10_000_000];

const fmtXTick = v => {
  if (v >= 1e6) return `$${v / 1e6}M`;
  return `$${v / 1e3}k`;
};

const makeChartData = (R_max, k, I_mid) =>
  Array.from({ length: 151 }, (_, i) => {
    const income = Math.pow(10, LOG_MIN + (i / 150) * (LOG_MAX - LOG_MIN));
    return {
      income,
      user: effectiveRate(income, R_max, k, I_mid) * 100,
      current: currentLawRate(income) * 100,
    };
  });

// ─── Log slider helpers for I_mid ($10k–$1M) ─────────────────────────────────

const IMID_MIN = 10000;
const IMID_MAX = 1_000_000;

const imidToSlider = v =>
  (Math.log(v / IMID_MIN) / Math.log(IMID_MAX / IMID_MIN)) * 100;

const sliderToImid = s =>
  Math.round(IMID_MIN * Math.pow(IMID_MAX / IMID_MIN, s / 100));

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

// ─── Custom tooltip for main chart ───────────────────────────────────────────

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const userRate = d.user;
  const currentRate = d.current;
  const tax = d.income * userRate / 100;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs min-w-[140px]">
      <p className="font-semibold text-gray-900 mb-1">{fmtIncome(d.income)}</p>
      <p className="text-blue-600">Your curve: {userRate.toFixed(1)}%</p>
      <p className="text-blue-600">Tax owed: {fmtDollar(tax)}</p>
      {currentRate != null && (
        <p className="text-gray-400 mt-1">Current law: {currentRate.toFixed(1)}%</p>
      )}
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [R_max, setRmax] = useState(0.37);
  const [I_mid, setImid] = useState(130000);
  const [k, setK]        = useState(1.5);
  const [incomeStr, setIncomeStr] = useState('');
  const [copied, setCopied]       = useState(false);

  // Parse URL path on mount: /R_max|k|I_mid
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

  // Derived values
  const chartData = useMemo(() => makeChartData(R_max, k, I_mid), [R_max, k, I_mid]);
  const revenue   = useMemo(() => calcRevenue(R_max, k, I_mid),   [R_max, k, I_mid]);
  const revDelta  = revenue - BASELINE;
  const revPct    = (revDelta / BASELINE) * 100;

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

  const personalIncome      = useMemo(() => parseIncome(incomeStr), [incomeStr]);
  const personalUserRate    = personalIncome != null ? effectiveRate(personalIncome, R_max, k, I_mid) : null;
  const personalCurrentRate = personalIncome != null ? currentLawRate(personalIncome) : null;
  // positive = saving (current law charges more than user curve)
  const personalDiff = personalUserRate != null
    ? (personalCurrentRate - personalUserRate) * 100
    : null;

  const shareText = useMemo(() => {
    const line1  = `${R_max.toFixed(2)}|${k.toFixed(1)}|${Math.round(I_mid)}`;
    const absD   = Math.abs(revDelta);
    let dStr;
    if (absD >= 1e12)    dStr = `$${(absD / 1e12).toFixed(2)}T`;
    else if (absD >= 1e9) dStr = `$${(absD / 1e9).toFixed(0)}B`;
    else                  dStr = `$${(absD / 1e6).toFixed(0)}M`;
    const fedLine = revDelta >= 0
      ? `Fed makes ${dStr} more.`
      : `Fed makes ${dStr} less.`;
    if (personalDiff != null) {
      const absP = Math.abs(personalDiff);
      const personalLine = personalDiff > 0
        ? `I save ${absP.toFixed(1)}%.`
        : `I pay ${absP.toFixed(1)}% more.`;
      return `${line1}\n${personalLine} ${fedLine}`;
    }
    return `${line1}\n${fedLine}`;
  }, [R_max, k, I_mid, revDelta, personalDiff]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const applyPreset = p => {
    setRmax(p.R_max);
    setImid(p.I_mid);
    setK(p.k);
  };

  const yMax = R_max * 100 + 5;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Brackets Are Bad</h1>
          <p className="text-gray-500 mt-1 text-base">
            Design a smooth, continuous income tax curve. Watch what it does to federal revenue.
          </p>
        </header>

        {/* ── Main grid: chart + revenue panel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Effective Tax Rate by Income
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="income"
                  scale="log"
                  type="number"
                  domain={[1000, 10_000_000]}
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
                <Tooltip content={<ChartTooltip />} />

                {/* Current law ghost */}
                <Line
                  dataKey="current"
                  stroke="#d1d5db"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                  name="Current law"
                />

                {/* User curve */}
                <Line
                  dataKey="user"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  name="Your curve"
                />

                {/* Callout dots */}
                {CALLOUT_INCOMES.map(inc => (
                  <ReferenceDot
                    key={inc}
                    x={inc}
                    y={effectiveRate(inc, R_max, k, I_mid) * 100}
                    r={5}
                    fill="#2563eb"
                    stroke="white"
                    strokeWidth={2}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#2563eb" strokeWidth="2.5" /></svg>
                Your curve
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="5 4" /></svg>
                Current law
              </span>
              <span className="flex items-center gap-1.5 text-gray-400">
                Dots at $50k, $150k, $500k — hover for details
              </span>
            </div>
          </div>

          {/* Revenue panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Federal Revenue
            </h2>

            <p className="text-3xl font-bold text-gray-900 tabular-nums">{fmtRevTotal(revenue)}</p>
            <p className="text-xs text-gray-400 mb-1">projected</p>

            <div className={`text-xl font-bold tabular-nums ${revDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmtRevDelta(revDelta)}
              <span className="text-sm font-normal ml-1 text-gray-400">
                ({revDelta >= 0 ? '+' : ''}{revPct.toFixed(1)}%)
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">vs. 2022 actual ($2.23T)</p>

            {/* By-bracket bar chart */}
            <div className="border-t border-gray-100 pt-3 flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Rate Δ vs. current law
              </p>
              <ResponsiveContainer width="100%" height={268}>
                <BarChart
                  layout="vertical"
                  data={bracketData}
                  margin={{ top: 0, right: 14, left: 0, bottom: 0 }}
                  barCategoryGap="15%"
                >
                  <XAxis
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}pp`}
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={74}
                    tick={{ fontSize: 9, fill: '#6b7280' }}
                  />
                  <Tooltip
                    formatter={v => [`${v > 0 ? '+' : ''}${v.toFixed(2)} pp`, 'vs. current law']}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <ReferenceLine x={0} stroke="#e5e7eb" strokeWidth={1} />
                  <Bar dataKey="diff" radius={[0, 3, 3, 0]}>
                    {bracketData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.diff > 0 ? '#ef4444' : '#22c55e'}
                        fillOpacity={0.75}
                      />
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

        {/* ── Sliders ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* R_max */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-medium text-gray-700">Top rate</label>
                <span className="text-lg font-bold text-blue-600 tabular-nums">
                  {(R_max * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0} max={80} step={1}
                value={Math.round(R_max * 100)}
                onChange={e => setRmax(parseInt(e.target.value, 10) / 100)}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0%</span><span>80%</span>
              </div>
            </div>

            {/* I_mid (log scale) */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-medium text-gray-700">Pivot income</label>
                <span className="text-lg font-bold text-blue-600 tabular-nums">
                  {fmtIncome(I_mid)}
                </span>
              </div>
              <input
                type="range"
                min={0} max={100} step={0.5}
                value={imidToSlider(I_mid)}
                onChange={e => setImid(sliderToImid(parseFloat(e.target.value)))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>$10k</span><span>$1M</span>
              </div>
            </div>

            {/* k */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-medium text-gray-700">Progressivity</label>
                <span className="text-lg font-bold text-blue-600 tabular-nums">
                  {k.toFixed(1)}
                  <span className="text-xs font-normal text-gray-400 ml-1">({kHint(k)})</span>
                </span>
              </div>
              <input
                type="range"
                min={0.3} max={4.0} step={0.1}
                value={k}
                onChange={e => setK(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0.3 flat</span><span>4.0 steep</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Presets ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Income input + share card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">

          {/* Income input */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-600">What's your income?</label>
            <input
              type="text"
              value={incomeStr}
              onChange={e => setIncomeStr(e.target.value)}
              placeholder="$75,000"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Nothing is stored. Put whatever you want in here.</p>

          {/* Personal breakdown (shown when income entered) */}
          {personalIncome != null && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Your curve</p>
                  <p className="text-xl font-bold text-blue-600">
                    {(personalUserRate * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">effective rate</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fmtDollar(personalIncome * personalUserRate)} owed
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Current law</p>
                  <p className="text-xl font-bold text-gray-700">
                    {(personalCurrentRate * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">effective rate</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fmtDollar(personalIncome * personalCurrentRate)} owed
                  </p>
                </div>
              </div>
              <p className={`text-sm font-semibold ${personalDiff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {personalDiff > 0
                  ? `You save ${personalDiff.toFixed(1)} percentage points under this curve.`
                  : `You pay ${(-personalDiff).toFixed(1)} percentage points more under this curve.`}
              </p>
            </div>
          )}

          {/* Share card */}
          <div className="mt-5 border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2 font-medium">Share card</p>
            <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap mb-3 leading-relaxed">
              {shareText}
            </pre>
            <button
              onClick={handleCopy}
              className="px-4 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* ── Footnotes ── */}
        <footer className="text-xs text-gray-400 space-y-1 pb-10">
          <p>Based on IRS Statistics of Income 2022 (approximate figures).</p>
          <p>Effective rates shown. Does not include payroll taxes, capital gains, deductions, or credits.</p>
          <p>This is version one. More to come.</p>
        </footer>

      </div>
    </div>
  );
}
