import React, { useMemo, useState } from 'react';
import { DescriptiveStat, RegressionModelResult } from '../../types/analytics';
import { normInv, normPdf } from '../../utils/mathStats';

const fmt = (n: number, dec = 2) => {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 10000) return n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

// ============================================================================
// 1. HISTOGRAM WITH NORMAL OVERLAY
// ============================================================================

export const HistogramChart: React.FC<{
  values: number[];
  label: string;
  binsCount?: number;
  showNormalCurve?: boolean;
}> = ({ values, label, binsCount = 12, showNormalCurve = true }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = span / binsCount;
    const bins = Array.from({ length: binsCount }, (_, i) => ({
      x0: min + i * step,
      x1: min + (i + 1) * step,
      count: 0,
    }));
    for (const v of values) {
      const idx = Math.min(binsCount - 1, Math.max(0, Math.floor((v - min) / step)));
      bins[idx].count++;
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const std = Math.sqrt(
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, values.length - 1)
    );
    const maxCount = Math.max(...bins.map((b) => b.count), 1);

    const curvePoints: { x: number; expectedCount: number }[] = [];
    if (showNormalCurve && std > 1e-12) {
      for (let i = 0; i <= 40; i++) {
        const xv = min + (span * i) / 40;
        const z = (xv - mean) / std;
        const density = normPdf(z) / std;
        const expectedCount = density * values.length * step;
        curvePoints.push({ x: xv, expectedCount });
      }
    }

    return { bins, min, max, mean, std, maxCount, curvePoints };
  }, [values, binsCount, showNormalCurve]);

  if (!chart) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        Datos insuficientes para generar el histograma.
      </div>
    );
  }

  const W = 560;
  const H = 260;
  const pad = { top: 24, right: 20, bottom: 38, left: 44 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const yMax = Math.max(
    chart.maxCount,
    ...chart.curvePoints.map((p) => p.expectedCount),
    1
  );
  const mapX = (v: number) => pad.left + ((v - chart.min) / (chart.max - chart.min || 1)) * pw;
  const mapY = (c: number) => pad.top + ph - (c / yMax) * ph;

  const curvePath =
    chart.curvePoints.length > 1
      ? chart.curvePoints
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.x).toFixed(1)} ${mapY(p.expectedCount).toFixed(1)}`)
          .join(' ')
      : '';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const val = yMax * t;
          const yy = mapY(val);
          return (
            <g key={t}>
              <line x1={pad.left} y1={yy} x2={pad.left + pw} y2={yy} stroke="#1E293B" strokeWidth={1} />
              <text x={pad.left - 6} y={yy + 3} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        {chart.bins.map((b, i) => {
          const x = pad.left + (i / chart.bins.length) * pw;
          const bw = pw / chart.bins.length - 2;
          const y = mapY(b.count);
          const bh = pad.top + ph - y;
          const active = hoverIdx === i;
          return (
            <rect
              key={i}
              x={x + 1}
              y={y}
              width={Math.max(2, bw)}
              height={Math.max(0, bh)}
              rx={2}
              fill={active ? '#60A5FA' : '#2563EB'}
              fillOpacity={active ? 0.95 : 0.78}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="transition-colors cursor-pointer"
            />
          );
        })}

        {curvePath && (
          <path d={curvePath} fill="none" stroke="#38BDF8" strokeWidth={2.2} />
        )}

        {/* Mean marker */}
        <line
          x1={mapX(chart.mean)}
          y1={pad.top}
          x2={mapX(chart.mean)}
          y2={pad.top + ph}
          stroke="#E2E8F0"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        <text x={pad.left} y={H - 10} fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
          {fmt(chart.min)}
        </text>
        <text x={pad.left + pw / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="#CBD5E1">
          {label} (Media: {fmt(chart.mean)})
        </text>
        <text x={pad.left + pw} y={H - 10} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
          {fmt(chart.max)}
        </text>
      </svg>

      {hoverIdx !== null && chart.bins[hoverIdx] && (
        <div className="mt-1 text-xs font-mono tabular-nums text-slate-400">
          Rango [{fmt(chart.bins[hoverIdx].x0)} – {fmt(chart.bins[hoverIdx].x1)}]:{' '}
          <strong className="text-blue-400">{chart.bins[hoverIdx].count}</strong> observaciones
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. BOXPLOT CHART (Exact Q1, Median, Q3, 1.5*IQR Whiskers & Outliers)
// ============================================================================

export const BoxPlotChart: React.FC<{
  stat: DescriptiveStat;
}> = ({ stat }) => {
  const W = 540;
  const H = 180;
  const pad = { top: 26, right: 28, bottom: 38, left: 28 };
  const pw = W - pad.left - pad.right;

  const span = stat.max - stat.min || 1;
  const lo = stat.min - span * 0.05;
  const hi = stat.max + span * 0.05;
  const mapX = (v: number) => pad.left + ((v - lo) / (hi - lo)) * pw;

  const lowerFence = stat.q1 - 1.5 * stat.iqr;
  const upperFence = stat.q3 + 1.5 * stat.iqr;
  const inliers = stat.values.filter((v) => v >= lowerFence && v <= upperFence);
  const whiskerLow = inliers.length > 0 ? Math.min(...inliers) : stat.min;
  const whiskerHigh = inliers.length > 0 ? Math.max(...inliers) : stat.max;
  const outliers = stat.values.filter((v) => v < lowerFence || v > upperFence);

  const cy = 78;
  const boxH = 44;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line x1={pad.left} y1={cy} x2={pad.left + pw} y2={cy} stroke="#1E293B" strokeWidth={1} />
        {/* Whiskers */}
        <line x1={mapX(whiskerLow)} y1={cy} x2={mapX(stat.q1)} y2={cy} stroke="#94A3B8" strokeWidth={1.75} />
        <line x1={mapX(stat.q3)} y1={cy} x2={mapX(whiskerHigh)} y2={cy} stroke="#94A3B8" strokeWidth={1.75} />
        <line x1={mapX(whiskerLow)} y1={cy - 12} x2={mapX(whiskerLow)} y2={cy + 12} stroke="#94A3B8" strokeWidth={1.75} />
        <line x1={mapX(whiskerHigh)} y1={cy - 12} x2={mapX(whiskerHigh)} y2={cy + 12} stroke="#94A3B8" strokeWidth={1.75} />

        {/* IQR Box */}
        <rect
          x={mapX(stat.q1)}
          y={cy - boxH / 2}
          width={Math.max(4, mapX(stat.q3) - mapX(stat.q1))}
          height={boxH}
          rx={3}
          fill="#2563EB"
          fillOpacity={0.28}
          stroke="#60A5FA"
          strokeWidth={1.75}
        />

        {/* Median line */}
        <line
          x1={mapX(stat.median)}
          y1={cy - boxH / 2}
          x2={mapX(stat.median)}
          y2={cy + boxH / 2}
          stroke="#38BDF8"
          strokeWidth={2.5}
        />

        {/* Outliers */}
        {outliers.slice(0, 80).map((o, idx) => (
          <circle
            key={idx}
            cx={mapX(o)}
            cy={cy}
            r={3.5}
            fill="#F59E0B"
            fillOpacity={0.9}
            stroke="#0C121E"
            strokeWidth={0.8}
          />
        ))}

        {/* Labels */}
        <text x={mapX(whiskerLow)} y={cy + 36} textAnchor="middle" fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
          {fmt(whiskerLow)}
        </text>
        <text x={mapX(stat.q1)} y={cy - 30} textAnchor="middle" fontSize="10" fill="#CBD5E1" fontFamily="JetBrains Mono, monospace">
          Q1: {fmt(stat.q1)}
        </text>
        <text x={mapX(stat.median)} y={cy + 48} textAnchor="middle" fontSize="10" fill="#38BDF8" fontWeight="600" fontFamily="JetBrains Mono, monospace">
          Mediana: {fmt(stat.median)}
        </text>
        <text x={mapX(stat.q3)} y={cy - 30} textAnchor="middle" fontSize="10" fill="#CBD5E1" fontFamily="JetBrains Mono, monospace">
          Q3: {fmt(stat.q3)}
        </text>
        <text x={mapX(whiskerHigh)} y={cy + 36} textAnchor="middle" fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
          {fmt(whiskerHigh)}
        </text>
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-400 mt-1 font-mono tabular-nums">
        <span>RIC (IQR): {fmt(stat.iqr)}</span>
        <span>Atípicos detectados (1.5×RIC): {stat.outlierCount}</span>
      </div>
    </div>
  );
};

// ============================================================================
// 3. SCATTER PLOT WITH OLS LINE
// ============================================================================

export const ScatterRegressionChart: React.FC<{
  points: { x: number; y: number }[];
  xLabel: string;
  yLabel: string;
  showTrendline?: boolean;
}> = ({ points, xLabel, yLabel, showTrendline = true }) => {
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);

  const stats = useMemo(() => {
    if (points.length < 2) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < points.length; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    const slope = den > 1e-12 ? num / den : 0;
    const intercept = meanY - slope * meanX;
    return { minX, maxX, minY, maxY, slope, intercept };
  }, [points]);

  if (!stats) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        Se requieren al menos 2 pares válidos (X, Y).
      </div>
    );
  }

  const W = 560;
  const H = 280;
  const pad = { top: 20, right: 24, bottom: 42, left: 60 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const spanX = stats.maxX - stats.minX || 1;
  const spanY = stats.maxY - stats.minY || 1;
  const xLo = stats.minX - spanX * 0.05;
  const xHi = stats.maxX + spanX * 0.05;
  const yLo = stats.minY - spanY * 0.08;
  const yHi = stats.maxY + spanY * 0.08;

  const mapX = (v: number) => pad.left + ((v - xLo) / (xHi - xLo)) * pw;
  const mapY = (v: number) => pad.top + ph - ((v - yLo) / (yHi - yLo)) * ph;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {[0, 0.5, 1].map((t) => {
          const yv = yLo + (yHi - yLo) * t;
          const yy = mapY(yv);
          return (
            <g key={t}>
              <line x1={pad.left} y1={yy} x2={pad.left + pw} y2={yy} stroke="#1E293B" strokeWidth={1} />
              <text x={pad.left - 8} y={yy + 3} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
                {fmt(yv, 1)}
              </text>
            </g>
          );
        })}

        {points.slice(0, 600).map((p, idx) => (
          <circle
            key={idx}
            cx={mapX(p.x)}
            cy={mapY(p.y)}
            r={3.5}
            fill="#3B82F6"
            fillOpacity={0.68}
            className="hover:fill-sky-300 cursor-pointer"
            onMouseEnter={() => setHovered(p)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        {showTrendline && (
          <line
            x1={mapX(stats.minX)}
            y1={mapY(stats.intercept + stats.slope * stats.minX)}
            x2={mapX(stats.maxX)}
            y2={mapY(stats.intercept + stats.slope * stats.maxX)}
            stroke="#38BDF8"
            strokeWidth={2.3}
          />
        )}

        <text x={pad.left + pw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#CBD5E1">
          {xLabel}
        </text>
        <text
          x={14}
          y={pad.top + ph / 2}
          textAnchor="middle"
          fontSize="11"
          fill="#CBD5E1"
          transform={`rotate(-90 14 ${pad.top + ph / 2})`}
        >
          {yLabel}
        </text>
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-400 mt-1 font-mono tabular-nums">
        <span>
          Tendencia lineal: Y = {fmt(stats.intercept)} {stats.slope >= 0 ? '+' : '-'} {fmt(Math.abs(stats.slope))}·X
        </span>
        {hovered && (
          <span className="text-blue-300">
            Punto: ({fmt(hovered.x)}, {fmt(hovered.y)})
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 4. TREND LINE CHART
// ============================================================================

export const TrendLineChart: React.FC<{
  series: { label: string; value: number }[];
  yLabel: string;
}> = ({ series, yLabel }) => {
  if (series.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        Datos insuficientes para gráfico de tendencia.
      </div>
    );
  }
  const W = 560;
  const H = 240;
  const pad = { top: 20, right: 20, bottom: 36, left: 60 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const vals = series.map((s) => s.value);
  const minY = Math.min(...vals);
  const maxY = Math.max(...vals);
  const spanY = maxY - minY || 1;
  const yLo = minY - spanY * 0.08;
  const yHi = maxY + spanY * 0.08;

  const mapX = (i: number) => pad.left + (i / (series.length - 1)) * pw;
  const mapY = (v: number) => pad.top + ph - ((v - yLo) / (yHi - yLo)) * ph;

  const path = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${mapX(i).toFixed(1)} ${mapY(s.value).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0, 0.5, 1].map((t) => {
        const yv = yLo + (yHi - yLo) * t;
        const yy = mapY(yv);
        return (
          <g key={t}>
            <line x1={pad.left} y1={yy} x2={pad.left + pw} y2={yy} stroke="#1E293B" strokeWidth={1} />
            <text x={pad.left - 8} y={yy + 3} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
              {fmt(yv, 1)}
            </text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke="#3B82F6" strokeWidth={2.2} />
      <text x={pad.left} y={H - 10} fontSize="10" fill="#94A3B8">
        {series[0].label}
      </text>
      <text x={pad.left + pw / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="#CBD5E1">
        Evolución: {yLabel}
      </text>
      <text x={pad.left + pw} y={H - 10} textAnchor="end" fontSize="10" fill="#94A3B8">
        {series[series.length - 1].label}
      </text>
    </svg>
  );
};

// ============================================================================
// 5. CORRELATION HEATMAP MATRIX
// ============================================================================

export const CorrelationHeatmap: React.FC<{
  headers: string[];
  values: (number | null)[][];
  targetColumn?: string;
}> = ({ headers, values, targetColumn }) => {
  const cellBg = (r: number | null, isDiag: boolean) => {
    if (isDiag) return 'bg-blue-600 text-white font-semibold';
    if (r === null) return 'bg-slate-900 text-slate-500';
    const abs = Math.abs(r);
    if (r > 0) {
      if (abs >= 0.8) return 'bg-blue-700 text-white';
      if (abs >= 0.5) return 'bg-blue-800/80 text-blue-50';
      if (abs >= 0.25) return 'bg-blue-950/90 text-blue-200';
      return 'bg-[#090D16] text-slate-300';
    } else {
      if (abs >= 0.8) return 'bg-rose-700 text-white';
      if (abs >= 0.5) return 'bg-rose-800/80 text-rose-50';
      if (abs >= 0.25) return 'bg-rose-950/80 text-rose-200';
      return 'bg-[#090D16] text-slate-300';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left font-semibold text-slate-300 border-b border-slate-800 bg-[#070B12] min-w-[140px]">
              Variable
            </th>
            {headers.map((h) => (
              <th
                key={h}
                className={`p-2 text-center font-semibold border-b border-slate-800 bg-[#070B12] min-w-[82px] ${
                  h === targetColumn ? 'text-blue-400 underline underline-offset-4' : 'text-slate-300'
                }`}
              >
                <span className="block truncate max-w-[90px] mx-auto" title={h}>
                  {h}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {headers.map((rowH, i) => (
            <tr key={rowH} className="border-b border-slate-800/70">
              <td
                className={`p-2 font-medium truncate max-w-[160px] ${
                  rowH === targetColumn ? 'text-blue-400 font-semibold' : 'text-slate-200'
                }`}
                title={rowH}
              >
                {rowH}
              </td>
              {headers.map((colH, j) => {
                const r = values[i]?.[j] ?? null;
                const isDiag = i === j;
                return (
                  <td
                    key={colH}
                    className={`p-2 text-center font-mono tabular-nums border border-[#0C121E] ${cellBg(r, isDiag)}`}
                    title={`${rowH} vs ${colH}: r = ${r !== null ? r.toFixed(4) : 'N/A'}`}
                  >
                    {isDiag ? '1.00' : r !== null ? r.toFixed(2) : 'N/A'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// 6. MODEL DIAGNOSTIC SUITE (Residuals vs Fitted, Q-Q Plot)
// ============================================================================

export const ResidualsVsFittedChart: React.FC<{ model: RegressionModelResult }> = ({ model }) => {
  const W = 480;
  const H = 240;
  const pad = { top: 18, right: 18, bottom: 36, left: 54 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const minX = Math.min(...model.yTrainFitted);
  const maxX = Math.max(...model.yTrainFitted);
  const spanX = maxX - minX || 1;
  const maxAbsY = Math.max(...model.trainResiduals.map((r) => Math.abs(r)), 1e-6) * 1.1;

  const mapX = (v: number) => pad.left + ((v - minX) / spanX) * pw;
  const mapY = (v: number) => pad.top + ph / 2 - (v / maxAbsY) * (ph / 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <line x1={pad.left} y1={mapY(0)} x2={pad.left + pw} y2={mapY(0)} stroke="#38BDF8" strokeWidth={1.5} strokeDasharray="4 3" />
      {model.yTrainFitted.map((f, i) => (
        <circle key={i} cx={mapX(f)} cy={mapY(model.trainResiduals[i])} r={3} fill="#60A5FA" fillOpacity={0.72} />
      ))}
      <text x={pad.left - 6} y={pad.top + 8} textAnchor="end" fontSize="9.5" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
        +{fmt(maxAbsY, 1)}
      </text>
      <text x={pad.left - 6} y={mapY(0) + 3} textAnchor="end" fontSize="9.5" fill="#38BDF8" fontFamily="JetBrains Mono, monospace">
        0
      </text>
      <text x={pad.left - 6} y={pad.top + ph} textAnchor="end" fontSize="9.5" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
        -{fmt(maxAbsY, 1)}
      </text>
      <text x={pad.left + pw / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#CBD5E1">
        Valores Ajustados (Ŷ)
      </text>
    </svg>
  );
};

export const NormalQQChart: React.FC<{ residuals: number[] }> = ({ residuals }) => {
  const qqData = useMemo(() => {
    const n = residuals.length;
    if (n < 3) return null;
    const mean = residuals.reduce((s, v) => s + v, 0) / n;
    const std = Math.sqrt(residuals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) || 1;
    const stdSorted = [...residuals].map((r) => (r - mean) / std).sort((a, b) => a - b);
    const pts = stdSorted.map((y, i) => {
      const p = (i + 0.5) / n;
      return { x: normInv(p), y };
    });
    return pts;
  }, [residuals]);

  if (!qqData) return null;

  const W = 480;
  const H = 240;
  const pad = { top: 18, right: 18, bottom: 36, left: 54 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const allVals = qqData.flatMap((p) => [p.x, p.y]);
  const lo = Math.min(...allVals, -2.5);
  const hi = Math.max(...allVals, 2.5);
  const mapX = (v: number) => pad.left + ((v - lo) / (hi - lo)) * pw;
  const mapY = (v: number) => pad.top + ph - ((v - lo) / (hi - lo)) * ph;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <line x1={mapX(lo)} y1={mapY(lo)} x2={mapX(hi)} y2={mapY(hi)} stroke="#38BDF8" strokeWidth={1.5} strokeDasharray="4 3" />
      {qqData.map((p, i) => (
        <circle key={i} cx={mapX(p.x)} cy={mapY(p.y)} r={3} fill="#3B82F6" fillOpacity={0.8} />
      ))}
      <text x={pad.left + pw / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#CBD5E1">
        Cuantiles Teóricos Normales (Z)
      </text>
      <text x={pad.left - 6} y={pad.top + 8} textAnchor="end" fontSize="9.5" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
        {hi.toFixed(1)}
      </text>
      <text x={pad.left - 6} y={pad.top + ph} textAnchor="end" fontSize="9.5" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
        {lo.toFixed(1)}
      </text>
    </svg>
  );
};

// ============================================================================
// 7. ACTUAL VS PREDICTED & STANDARDIZED CONTRIBUTION CHARTS
// ============================================================================

export const ActualVsPredictedChart: React.FC<{ model: RegressionModelResult }> = ({ model }) => {
  const W = 520;
  const H = 280;
  const pad = { top: 20, right: 20, bottom: 40, left: 60 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const allVals = [
    ...model.yTrainActual,
    ...model.yTrainFitted,
    ...model.yTestActual,
    ...model.yTestPredicted,
  ];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const span = maxV - minV || 1;
  const lo = minV - span * 0.05;
  const hi = maxV + span * 0.05;

  const mapX = (v: number) => pad.left + ((v - lo) / (hi - lo)) * pw;
  const mapY = (v: number) => pad.top + ph - ((v - lo) / (hi - lo)) * ph;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {[0, 0.5, 1].map((t) => {
          const val = lo + (hi - lo) * t;
          const yy = mapY(val);
          return (
            <g key={t}>
              <line x1={pad.left} y1={yy} x2={pad.left + pw} y2={yy} stroke="#1E293B" strokeWidth={1} />
              <text x={pad.left - 8} y={yy + 3} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
                {fmt(val, 1)}
              </text>
            </g>
          );
        })}

        <line x1={mapX(lo)} y1={mapY(lo)} x2={mapX(hi)} y2={mapY(hi)} stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="5 4" />

        {model.yTrainActual.map((y, i) => (
          <circle key={`tr-${i}`} cx={mapX(y)} cy={mapY(model.yTrainFitted[i])} r={3.2} fill="#64748B" fillOpacity={0.65} />
        ))}
        {model.yTestActual.map((y, i) => (
          <circle key={`te-${i}`} cx={mapX(y)} cy={mapY(model.yTestPredicted[i])} r={4.2} fill="#38BDF8" fillOpacity={0.95} />
        ))}

        <text x={pad.left + pw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#CBD5E1">
          Valor Real ({model.targetColumn})
        </text>
      </svg>
      <div className="flex items-center gap-5 text-xs text-slate-400 mt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" /> Entrenamiento (80%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> Prueba (20%)
        </span>
        <span className="text-slate-500">Línea punteada = predicción perfecta (Y = Ŷ)</span>
      </div>
    </div>
  );
};

export const FeatureContributionChart: React.FC<{ model: RegressionModelResult }> = ({ model }) => {
  const sorted = [...model.coefficients].sort(
    (a, b) => Math.abs(b.standardizedBeta ?? 0) - Math.abs(a.standardizedBeta ?? 0)
  );
  const maxAbs = Math.max(...sorted.map((c) => Math.abs(c.standardizedBeta ?? 0)), 0.01);

  return (
    <div className="space-y-2.5">
      {sorted.map((c) => {
        const val = c.standardizedBeta ?? 0;
        const pct = Math.min(100, (Math.abs(val) / maxAbs) * 100);
        const positive = val >= 0;
        const sig = c.pValue < 0.05;
        return (
          <div key={c.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-200 truncate max-w-[60%]" title={c.name}>
                {c.name}
              </span>
              <span className="font-mono tabular-nums text-slate-400">
                β std = {val >= 0 ? '+' : ''}
                {val.toFixed(3)} · {sig ? 'p < 0.05' : 'No sig.'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all ${
                  positive ? 'bg-blue-500' : 'bg-slate-400'
                } ${sig ? 'opacity-95' : 'opacity-45'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
