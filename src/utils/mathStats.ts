import {
  CoefficientResult,
  DescriptiveStat,
  DiagnosticTests,
  NumericTransform,
  RegressionMetrics,
  RegressionModelResult,
  ScalingMethod,
  SubsetCandidate,
  VariableSelectionSummary,
  VariableType,
} from '../types/analytics';

// ============================================================================
// 1. PROBABILITY DISTRIBUTIONS (Exact Numerical Recipes Implementations)
// ============================================================================

function logGamma(z: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += cof[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaCf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-10;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1.0;
  const qam = a - 1.0;
  let c = 1.0;
  let d = 1.0 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1.0 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < EPS) break;
  }
  return h;
}

export function betai(a: number, b: number, x: number): number {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1.0 - x)
  );
  if (x < (a + 1.0) / (a + b + 2.0)) {
    return (bt * betaCf(a, b, x)) / a;
  }
  return 1.0 - (bt * betaCf(b, a, 1.0 - x)) / b;
}

// Regularized incomplete gamma P(a, x)
function gammp(a: number, x: number): number {
  if (x <= 0 || a <= 0) return 0;
  if (x < a + 1.0) {
    // Series representation
    let ap = a;
    let sum = 1.0 / a;
    let del = sum;
    for (let n = 1; n <= 200; n++) {
      ap += 1.0;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 3e-10) {
        return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
      }
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  } else {
    // Continued fraction representation
    const FPMIN = 1e-30;
    let b = x + 1.0 - a;
    let c = 1.0 / FPMIN;
    let d = 1.0 / b;
    let h = d;
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a);
      b += 2.0;
      d = an * d + b;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1.0 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1.0) < 3e-10) break;
    }
    return 1.0 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  }
}

export function tTwoSidedPValue(tAbs: number, df: number): number {
  if (!Number.isFinite(tAbs) || df <= 0) return 1;
  const x = df / (df + tAbs * tAbs);
  return Math.min(1, Math.max(0, betai(df / 2, 0.5, x)));
}

export function tCdf(t: number, df: number): number {
  if (df <= 0) return 0.5;
  const x = df / (df + t * t);
  const ib = betai(df / 2, 0.5, x);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

// Inverse Student's t via bisection (exact and monotonic)
export function tInv(p: number, df: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (df <= 0) return 1.96;
  let lo = -100;
  let hi = 100;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export function fPValue(fStat: number, df1: number, df2: number): number {
  if (!Number.isFinite(fStat) || fStat <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const x = df2 / (df2 + df1 * fStat);
  return Math.min(1, Math.max(0, betai(df2 / 2, df1 / 2, x)));
}

export function chi2PValue(chi2: number, df: number): number {
  if (!Number.isFinite(chi2) || chi2 <= 0 || df <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - gammp(df / 2, chi2 / 2)));
}

export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// Beasley-Springer-Moro approximation for Normal inverse CDF (for Q-Q plots)
export function normInv(p: number): number {
  if (p <= 0) return -5;
  if (p >= 1) return 5;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

// ============================================================================
// 2. DESCRIPTIVE STATISTICS & CORRELATIONS
// ============================================================================

export function quantileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function computeDescriptiveStats(
  column: string,
  rawValues: (number | null | undefined)[]
): DescriptiveStat | null {
  const values: number[] = [];
  let missing = 0;
  for (const v of rawValues) {
    if (v === null || v === undefined || !Number.isFinite(v)) {
      missing++;
    } else {
      values.push(v);
    }
  }
  const n = values.length;
  if (n === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const v of values) {
    const d = v - mean;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
    m4 += d2 * d2;
  }
  const variance = n > 1 ? m2 / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const popStd = Math.sqrt(m2 / n);
  const skewness = popStd > 0 ? m3 / n / Math.pow(popStd, 3) : 0;
  const kurtosis = popStd > 0 ? m4 / n / Math.pow(popStd, 4) : 3;

  const q1 = quantileSorted(sorted, 0.25);
  const median = quantileSorted(sorted, 0.5);
  const q3 = quantileSorted(sorted, 0.75);
  const p5 = quantileSorted(sorted, 0.05);
  const p95 = quantileSorted(sorted, 0.95);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const outlierCount = values.filter((v) => v < lowerFence || v > upperFence).length;

  return {
    column,
    n,
    missing,
    mean,
    median,
    stdDev,
    variance,
    min: sorted[0],
    p5,
    q1,
    q3,
    p95,
    max: sorted[sorted.length - 1],
    iqr,
    skewness,
    kurtosis,
    outlierCount,
    values,
  };
}

export function pearsonCorrelation(
  a: (number | null)[],
  b: (number | null)[]
): { r: number | null; pValue: number | null; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i];
    const vb = b[i];
    if (va !== null && vb !== null && Number.isFinite(va) && Number.isFinite(vb)) {
      xs.push(va);
      ys.push(vb);
    }
  }
  const n = xs.length;
  if (n < 3) return { r: null, pValue: null, n };

  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom < 1e-12) return { r: null, pValue: null, n };
  const r = Math.max(-1, Math.min(1, num / denom));
  if (Math.abs(r) >= 0.999999999) return { r, pValue: 0, n };
  const tStat = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
  const pValue = tTwoSidedPValue(Math.abs(tStat), n - 2);
  return { r, pValue, n };
}

// ============================================================================
// 3. HOUSEHOLDER QR DECOMPOSITION & OLS ENGINE
// ============================================================================

interface QrSolution {
  beta: number[];
  rMatrix: number[][];
  xtxInverse: number[][];
  rank: number;
  isRankDeficient: boolean;
}

function solveOlsQr(X: number[][], y: number[]): QrSolution | null {
  const n = X.length;
  if (n === 0) return null;
  const p = X[0].length;
  if (p === 0 || n <= p) return null;

  // Copy X into A (n x p) and y into b (n)
  const A: number[][] = X.map((row) => [...row]);
  const b: number[] = [...y];

  for (let k = 0; k < p; k++) {
    let normSq = 0;
    for (let i = k; i < n; i++) {
      normSq += A[i][k] * A[i][k];
    }
    const norm = Math.sqrt(normSq);
    if (norm < 1e-12) {
      return {
        beta: new Array(p).fill(0),
        rMatrix: [],
        xtxInverse: [],
        rank: k,
        isRankDeficient: true,
      };
    }

    const alpha = A[k][k] >= 0 ? -norm : norm;
    const v0 = A[k][k] - alpha;
    // Store Householder vector v in column k, with v[k] = v0
    const v = new Array(n - k).fill(0);
    v[0] = v0;
    let vNormSq = v0 * v0;
    for (let i = k + 1; i < n; i++) {
      v[i - k] = A[i][k];
      vNormSq += v[i - k] * v[i - k];
    }

    if (vNormSq < 1e-24) continue;
    const factor = 2 / vNormSq;

    // Apply H = I - factor * v * v^T to remaining columns of A
    A[k][k] = alpha;
    for (let i = k + 1; i < n; i++) A[i][k] = 0;

    for (let j = k + 1; j < p; j++) {
      let dot = 0;
      for (let i = k; i < n; i++) {
        dot += v[i - k] * A[i][j];
      }
      const scale = factor * dot;
      for (let i = k; i < n; i++) {
        A[i][j] -= scale * v[i - k];
      }
    }

    // Apply H to b
    let dotB = 0;
    for (let i = k; i < n; i++) {
      dotB += v[i - k] * b[i];
    }
    const scaleB = factor * dotB;
    for (let i = k; i < n; i++) {
      b[i] -= scaleB * v[i - k];
    }
  }

  // Extract upper triangular R (p x p) and check rank
  const R: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  let minDiag = Infinity;
  let maxDiag = 0;
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      R[i][j] = A[i][j];
    }
    const absD = Math.abs(R[i][i]);
    if (absD < minDiag) minDiag = absD;
    if (absD > maxDiag) maxDiag = absD;
  }

  if (minDiag < 1e-10 || (maxDiag > 0 && minDiag / maxDiag < 1e-9)) {
    return {
      beta: new Array(p).fill(0),
      rMatrix: R,
      xtxInverse: [],
      rank: p - 1,
      isRankDeficient: true,
    };
  }

  // Back-substitution for beta: R * beta = b[0..p-1]
  const beta = new Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < p; j++) {
      sum -= R[i][j] * beta[j];
    }
    beta[i] = sum / R[i][i];
  }

  // Compute R^{-1} (upper triangular)
  const Rinv: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let j = 0; j < p; j++) {
    Rinv[j][j] = 1 / R[j][j];
    for (let i = j - 1; i >= 0; i--) {
      let sum = 0;
      for (let k = i + 1; k <= j; k++) {
        sum -= R[i][k] * Rinv[k][j];
      }
      Rinv[i][j] = sum / R[i][i];
    }
  }

  // (X^T X)^{-1} = R^{-1} * (R^{-1})^T
  const xtxInverse: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let sum = 0;
      for (let k = Math.max(i, j); k < p; k++) {
        sum += Rinv[i][k] * Rinv[j][k];
      }
      xtxInverse[i][j] = sum;
      xtxInverse[j][i] = sum;
    }
  }

  return {
    beta,
    rMatrix: R,
    xtxInverse,
    rank: p,
    isRankDeficient: false,
  };
}

function computeMetrics(
  yActual: number[],
  yPred: number[],
  p: number
): RegressionMetrics {
  const n = yActual.length;
  const dfResidual = Math.max(1, n - p);
  const yMean = yActual.reduce((s, v) => s + v, 0) / n;

  let sse = 0;
  let sst = 0;
  let absErrSum = 0;
  let apeSum = 0;
  let apeCount = 0;

  for (let i = 0; i < n; i++) {
    const err = yActual[i] - yPred[i];
    sse += err * err;
    const dy = yActual[i] - yMean;
    sst += dy * dy;
    absErrSum += Math.abs(err);
    if (Math.abs(yActual[i]) > 1e-9) {
      apeSum += Math.abs(err / yActual[i]);
      apeCount++;
    }
  }

  const ssr = Math.max(0, sst - sse);
  const r2 = sst > 1e-12 ? Math.max(0, Math.min(1, 1 - sse / sst)) : 0;
  const adjR2 =
    n > p && sst > 1e-12
      ? 1 - ((1 - r2) * (n - 1)) / (n - p)
      : r2;
  const rmse = Math.sqrt(sse / n);
  const mae = absErrSum / n;
  const mape = apeCount > 0 ? (apeSum / apeCount) * 100 : null;
  const residualStdError = n > p ? Math.sqrt(sse / (n - p)) : rmse;

  const dfModel = p - 1;
  let fStat: number | null = null;
  let fPValueVal: number | null = null;
  if (dfModel > 0 && n > p && sse > 1e-14) {
    const msr = ssr / dfModel;
    const mse = sse / (n - p);
    fStat = msr / mse;
    fPValueVal = fPValue(fStat, dfModel, n - p);
  }

  // Gaussian log-likelihood AIC and BIC (with k_params = p + 1 including sigma^2)
  const safeSse = Math.max(sse, 1e-15);
  const aic = n * Math.log(safeSse / n) + 2 * (p + 1);
  const bic = n * Math.log(safeSse / n) + (p + 1) * Math.log(n);

  return {
    n,
    p,
    dfResidual,
    r2,
    adjR2,
    rmse,
    mae,
    mape,
    sse,
    ssr,
    sst,
    fStat,
    fPValue: fPValueVal,
    aic,
    bic,
    residualStdError,
  };
}

function computeVifs(XNoIntercept: number[][]): (number | null)[] {
  const n = XNoIntercept.length;
  if (n === 0) return [];
  const k = XNoIntercept[0].length;
  if (k <= 1) return new Array(k).fill(null);

  const vifs: (number | null)[] = [];
  for (let j = 0; j < k; j++) {
    const yj = XNoIntercept.map((row) => row[j]);
    const Xothers = XNoIntercept.map((row) => {
      const r = [1];
      for (let m = 0; m < k; m++) {
        if (m !== j) r.push(row[m]);
      }
      return r;
    });
    const sol = solveOlsQr(Xothers, yj);
    if (!sol || sol.isRankDeficient) {
      vifs.push(Infinity);
      continue;
    }
    const yMean = yj.reduce((s, v) => s + v, 0) / n;
    let sse = 0;
    let sst = 0;
    for (let i = 0; i < n; i++) {
      let pred = 0;
      for (let c = 0; c < Xothers[i].length; c++) {
        pred += Xothers[i][c] * sol.beta[c];
      }
      sse += (yj[i] - pred) ** 2;
      sst += (yj[i] - yMean) ** 2;
    }
    const r2j = sst > 1e-12 ? Math.max(0, Math.min(0.999999, 1 - sse / sst)) : 0;
    vifs.push(1 / (1 - r2j));
  }
  return vifs;
}

function computeDiagnostics(
  XWithIntercept: number[][],
  fitted: number[],
  residuals: number[],
  vifs: (number | null)[]
): DiagnosticTests {
  const n = residuals.length;
  const p = XWithIntercept[0].length;

  // 1. Durbin-Watson
  let dwNum = 0;
  let dwDen = 0;
  for (let i = 0; i < n; i++) {
    dwDen += residuals[i] * residuals[i];
    if (i > 0) {
      const diff = residuals[i] - residuals[i - 1];
      dwNum += diff * diff;
    }
  }
  const durbinWatson = dwDen > 1e-14 ? dwNum / dwDen : 2;
  let durbinWatsonStatus: DiagnosticTests['durbinWatsonStatus'] = 'ok';
  if (durbinWatson < 1.5) durbinWatsonStatus = 'positive_autocorr';
  else if (durbinWatson > 2.5) durbinWatsonStatus = 'negative_autocorr';

  // 2. Breusch-Pagan Test (Regress e_i^2 on X)
  let breuschPaganStat: number | null = null;
  let breuschPaganPValue: number | null = null;
  let homoscedastic: boolean | null = null;
  if (n > p + 2 && p >= 2) {
    const e2 = residuals.map((e) => e * e);
    const auxSol = solveOlsQr(XWithIntercept, e2);
    if (auxSol && !auxSol.isRankDeficient) {
      const e2Mean = e2.reduce((s, v) => s + v, 0) / n;
      let sseAux = 0;
      let sstAux = 0;
      for (let i = 0; i < n; i++) {
        let pred = 0;
        for (let c = 0; c < p; c++) pred += XWithIntercept[i][c] * auxSol.beta[c];
        sseAux += (e2[i] - pred) ** 2;
        sstAux += (e2[i] - e2Mean) ** 2;
      }
      const r2Aux = sstAux > 1e-14 ? Math.max(0, 1 - sseAux / sstAux) : 0;
      breuschPaganStat = n * r2Aux;
      breuschPaganPValue = chi2PValue(breuschPaganStat, p - 1);
      homoscedastic = breuschPaganPValue >= 0.05;
    }
  }

  // 3. Jarque-Bera Normality Test
  const resMean = residuals.reduce((s, v) => s + v, 0) / n;
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const r of residuals) {
    const d = r - resMean;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  const sigma = Math.sqrt(m2 / n);
  const residualSkewness = sigma > 1e-12 ? m3 / n / Math.pow(sigma, 3) : 0;
  const residualKurtosis = sigma > 1e-12 ? m4 / n / Math.pow(sigma, 4) : 3;
  let jarqueBeraStat: number | null = null;
  let jarqueBeraPValue: number | null = null;
  let normalResiduals: boolean | null = null;
  if (n >= 5 && sigma > 1e-12) {
    jarqueBeraStat =
      (n / 6) *
      (residualSkewness * residualSkewness +
        Math.pow(residualKurtosis - 3, 2) / 4);
    jarqueBeraPValue = chi2PValue(jarqueBeraStat, 2);
    normalResiduals = jarqueBeraPValue >= 0.05;
  }

  // 4. Linearity Check: correlation between residuals and fitted + quadratic fitted test
  const corrResFit = pearsonCorrelation(residuals, fitted);
  const linearityCorrResidualFitted = corrResFit.r ?? 0;
  let linearityResetR2: number | null = null;
  let linearityOk = true;
  if (n > 6) {
    // Regress residuals on [1, fitted, fitted^2] to detect curvature
    const fMean = fitted.reduce((s, v) => s + v, 0) / n;
    const fStd = Math.sqrt(
      fitted.reduce((s, v) => s + (v - fMean) ** 2, 0) / n
    );
    if (fStd > 1e-10) {
      const Xquad = fitted.map((f) => {
        const z = (f - fMean) / fStd;
        return [1, z, z * z];
      });
      const quadSol = solveOlsQr(Xquad, residuals);
      if (quadSol && !quadSol.isRankDeficient) {
        let sseQ = 0;
        let sstQ = 0;
        for (let i = 0; i < n; i++) {
          const pred =
            quadSol.beta[0] +
            quadSol.beta[1] * Xquad[i][1] +
            quadSol.beta[2] * Xquad[i][2];
          sseQ += (residuals[i] - pred) ** 2;
          sstQ += (residuals[i] - resMean) ** 2;
        }
        linearityResetR2 = sstQ > 1e-14 ? Math.max(0, 1 - sseQ / sstQ) : 0;
        // F-test on curvature R2: if R2 > 0.15 and statistically significant (p < 0.01)
        const fQuad =
          sseQ > 1e-14 ? ((sstQ - sseQ) / 2) / (sseQ / (n - 3)) : 0;
        const pQuad = fPValue(fQuad, 2, n - 3);
        if (pQuad < 0.01 && linearityResetR2 > 0.1) {
          linearityOk = false;
        }
      }
    }
  }

  // 5. Multicollinearity summary
  const finiteVifs = vifs.filter((v): v is number => v !== null);
  let maxVif: number | null = null;
  let multicollinearityLevel: DiagnosticTests['multicollinearityLevel'] = 'na';
  if (finiteVifs.length > 0) {
    maxVif = Math.max(...finiteVifs);
    if (!Number.isFinite(maxVif) || maxVif >= 10) multicollinearityLevel = 'severe';
    else if (maxVif >= 5) multicollinearityLevel = 'moderate';
    else multicollinearityLevel = 'none';
  }

  return {
    durbinWatson,
    durbinWatsonStatus,
    breuschPaganStat,
    breuschPaganPValue,
    homoscedastic,
    jarqueBeraStat,
    jarqueBeraPValue,
    residualSkewness,
    residualKurtosis,
    normalResiduals,
    linearityCorrResidualFitted,
    linearityResetR2,
    linearityOk,
    maxVif,
    multicollinearityLevel,
  };
}

// ============================================================================
// 4. PUBLIC MODEL FITTING & SELECTION
// ============================================================================

export interface FitModelParams {
  id: string;
  name: string;
  kind: RegressionModelResult['kind'];
  targetColumn: string;
  selectedFeatureNames: string[];
  allFeatureNames: string[];
  featureSourceMap: Record<string, string>;
  xTrainFull: number[][];
  yTrain: number[];
  xTestFull: number[][];
  yTest: number[];
  scalingMethod: ScalingMethod;
  scalingLearned: Record<string, { mean: number; std: number; min: number; max: number }>;
  imputationsLearned: Record<string, { type: VariableType; value: string | number; method: string }>;
  oneHotMappings: { sourceCol: string; referenceCategory: string; categories: string[] }[];
  transformsMap: Record<string, NumericTransform>;
}

export function fitLinearRegressionModel(
  params: FitModelParams
): { model: RegressionModelResult | null; error: string | null } {
  const {
    id,
    name,
    kind,
    targetColumn,
    selectedFeatureNames,
    allFeatureNames,
    featureSourceMap,
    xTrainFull,
    yTrain,
    xTestFull,
    yTest,
    scalingMethod,
    scalingLearned,
    imputationsLearned,
    oneHotMappings,
    transformsMap,
  } = params;

  const featureIndices = selectedFeatureNames.map((fn) => allFeatureNames.indexOf(fn));
  if (featureIndices.some((idx) => idx === -1) || selectedFeatureNames.length === 0) {
    return { model: null, error: 'No se seleccionaron variables predictoras válidas.' };
  }

  const nTrain = yTrain.length;
  const k = selectedFeatureNames.length;
  const p = k + 1;

  if (nTrain <= p + 1) {
    return {
      model: null,
      error: `Tamaño de muestra insuficiente en entrenamiento (${nTrain} registros para ${p} parámetros). Se requieren al menos ${p + 2} observaciones válidas.`,
    };
  }

  // Build X matrices with leading intercept column 1
  const xTrainNoInt = xTrainFull.map((row) => featureIndices.map((idx) => row[idx]));
  const xTrainWithInt = xTrainNoInt.map((row) => [1, ...row]);
  const xTestNoInt = xTestFull.map((row) => featureIndices.map((idx) => row[idx]));
  const xTestWithInt = xTestNoInt.map((row) => [1, ...row]);

  // Check zero variance predictors in Train
  const warnings: string[] = [];
  for (let j = 0; j < k; j++) {
    const colVals = xTrainNoInt.map((r) => r[j]);
    const minV = Math.min(...colVals);
    const maxV = Math.max(...colVals);
    if (Math.abs(maxV - minV) < 1e-12) {
      return {
        model: null,
        error: `La variable "${selectedFeatureNames[j]}" tiene varianza cero en el conjunto de entrenamiento (todos los valores son iguales a ${minV}). Exclúyala para ajustar el modelo.`,
      };
    }
  }

  const sol = solveOlsQr(xTrainWithInt, yTrain);
  if (!sol || sol.isRankDeficient) {
    return {
      model: null,
      error:
        'Matriz singular o colinealidad perfecta detectada entre las variables independientes en entrenamiento. Elimine variables redundantes o combinaciones lineales exactas.',
    };
  }

  const yTrainFitted = xTrainWithInt.map((row) =>
    row.reduce((sum, val, idx) => sum + val * sol.beta[idx], 0)
  );
  const trainResiduals = yTrain.map((y, i) => y - yTrainFitted[i]);
  const trainMetrics = computeMetrics(yTrain, yTrainFitted, p);

  // Test evaluation
  let testMetrics: RegressionMetrics | null = null;
  let yTestPredicted: number[] = [];
  let testResiduals: number[] = [];
  if (xTestWithInt.length >= 2) {
    yTestPredicted = xTestWithInt.map((row) =>
      row.reduce((sum, val, idx) => sum + val * sol.beta[idx], 0)
    );
    testResiduals = yTest.map((y, i) => y - yTestPredicted[i]);
    testMetrics = computeMetrics(yTest, yTestPredicted, p);
  } else {
    warnings.push('El conjunto de prueba tiene menos de 2 registros; no se evaluaron métricas out-of-sample.');
  }

  // Standard errors, t-stats, p-values, 95% CIs, Standardized Betas
  const mse = trainMetrics.sse / Math.max(1, nTrain - p);
  const tCrit = tInv(0.975, Math.max(1, nTrain - p));
  const yTrainMean = yTrain.reduce((s, v) => s + v, 0) / nTrain;
  const yTrainStd = Math.sqrt(
    yTrain.reduce((s, v) => s + (v - yTrainMean) ** 2, 0) / Math.max(1, nTrain - 1)
  );

  const vifs = computeVifs(xTrainNoInt);
  const trainFeatureMeans: Record<string, number> = {};
  const trainFeatureStds: Record<string, number> = {};

  const buildCoeff = (idx: number, nameStr: string, sourceCol: string, vif: number | null): CoefficientResult => {
    const est = sol.beta[idx];
    const varianceEst = Math.max(0, mse * sol.xtxInverse[idx][idx]);
    const se = Math.sqrt(varianceEst);
    const tStat = se > 1e-14 ? est / se : 0;
    const pValue = tTwoSidedPValue(Math.abs(tStat), nTrain - p);
    const ciLower95 = est - tCrit * se;
    const ciUpper95 = est + tCrit * se;

    let stdBeta: number | null = null;
    if (idx > 0 && yTrainStd > 1e-12) {
      const colVals = xTrainNoInt.map((r) => r[idx - 1]);
      const meanX = colVals.reduce((s, v) => s + v, 0) / nTrain;
      const stdX = Math.sqrt(
        colVals.reduce((s, v) => s + (v - meanX) ** 2, 0) / Math.max(1, nTrain - 1)
      );
      trainFeatureMeans[nameStr] = meanX;
      trainFeatureStds[nameStr] = stdX;
      stdBeta = est * (stdX / yTrainStd);
    }

    return {
      name: nameStr,
      sourceColumn: sourceCol,
      estimate: est,
      stdError: se,
      tStat,
      pValue,
      ciLower95,
      ciUpper95,
      standardizedBeta: stdBeta,
      vif,
    };
  };

  const intercept = buildCoeff(0, 'Intercepto (β₀)', '(Constante)', null);
  const coefficients = selectedFeatureNames.map((fn, j) =>
    buildCoeff(j + 1, fn, featureSourceMap[fn] || fn, vifs[j])
  );

  const diagnostics = computeDiagnostics(xTrainWithInt, yTrainFitted, trainResiduals, vifs);

  if (diagnostics.multicollinearityLevel === 'severe') {
    warnings.push(
      `Multicolinealidad severa detectada (VIF máx = ${diagnostics.maxVif === Infinity ? '∞' : diagnostics.maxVif?.toFixed(2)}). Los coeficientes individuales pueden ser inestables.`
    );
  }
  if (testMetrics && trainMetrics.r2 - testMetrics.r2 > 0.15) {
    warnings.push(
      `Posible sobreajuste: R² en entrenamiento (${(trainMetrics.r2 * 100).toFixed(1)}%) supera ampliamente a prueba (${(testMetrics.r2 * 100).toFixed(1)}%).`
    );
  }

  const eqTerms = coefficients.map((c) => {
    const sign = c.estimate >= 0 ? '+' : '-';
    return `${sign} ${Math.abs(c.estimate).toFixed(4)}·(${c.name})`;
  });
  const equationText = `${targetColumn} = ${intercept.estimate.toFixed(4)} ${eqTerms.join(' ')}`;

  const sourceColumns = Array.from(
    new Set(selectedFeatureNames.map((fn) => featureSourceMap[fn] || fn))
  );

  return {
    model: {
      id,
      name,
      kind,
      targetColumn,
      featureNames: selectedFeatureNames,
      sourceColumns,
      intercept,
      coefficients,
      trainMetrics,
      testMetrics,
      diagnostics,
      yTrainActual: yTrain,
      yTrainFitted,
      trainResiduals,
      yTestActual: yTest,
      yTestPredicted,
      testResiduals,
      xtxInverse: sol.xtxInverse,
      trainFeatureMeans,
      trainFeatureStds,
      scalingMethod,
      scalingLearned,
      imputationsLearned,
      oneHotMappings,
      transformsMap,
      warnings,
      equationText,
      createdAt: new Date().toISOString(),
    },
    error: null,
  };
}

// Fast internal evaluation on Train ONLY (no leakage!) for Stepwise and Best Subsets
function evaluateTrainSubsetFast(
  featureIndices: number[],
  xTrainFull: number[][],
  yTrain: number[],
  xTestFull: number[][],
  yTest: number[]
): {
  r2: number;
  adjR2: number;
  aic: number;
  bic: number;
  trainRmse: number;
  testRmse: number | null;
} | null {
  const n = yTrain.length;
  const p = featureIndices.length + 1;
  if (n <= p + 1) return null;

  const X = xTrainFull.map((row) => [1, ...featureIndices.map((idx) => row[idx])]);
  const sol = solveOlsQr(X, yTrain);
  if (!sol || sol.isRankDeficient) return null;

  const yPred = X.map((row) => row.reduce((s, v, idx) => s + v * sol.beta[idx], 0));
  const metrics = computeMetrics(yTrain, yPred, p);

  let testRmse: number | null = null;
  if (xTestFull.length >= 2) {
    let sseTest = 0;
    for (let i = 0; i < xTestFull.length; i++) {
      let pred = sol.beta[0];
      for (let j = 0; j < featureIndices.length; j++) {
        pred += sol.beta[j + 1] * xTestFull[i][featureIndices[j]];
      }
      sseTest += (yTest[i] - pred) ** 2;
    }
    testRmse = Math.sqrt(sseTest / xTestFull.length);
  }

  return {
    r2: metrics.r2,
    adjR2: metrics.adjR2,
    aic: metrics.aic,
    bic: metrics.bic,
    trainRmse: metrics.rmse,
    testRmse,
  };
}

export function runVariableSelection(
  baseParams: Omit<FitModelParams, 'id' | 'name' | 'kind' | 'selectedFeatureNames'>
): VariableSelectionSummary {
  const { allFeatureNames, xTrainFull, yTrain, xTestFull, yTest } = baseParams;
  const k = allFeatureNames.length;
  if (k === 0 || yTrain.length < 5) {
    return { stepwiseResult: null, bestSubsetsResult: null };
  }

  // 1. Bidirectional Stepwise Selection using Train AIC (zero test leakage)
  const selectedIdx: number[] = [];
  const remainingIdx = new Set<number>(allFeatureNames.map((_, i) => i));
  const yMean = yTrain.reduce((s, v) => s + v, 0) / yTrain.length;
  const sstNull = yTrain.reduce((s, v) => s + (v - yMean) ** 2, 0);
  let currentAic =
    yTrain.length * Math.log(Math.max(sstNull, 1e-15) / yTrain.length) + 4; // intercept + sigma2

  const steps: {
    step: number;
    action: 'add' | 'remove';
    feature: string;
    aic: number;
    adjR2: number;
  }[] = [];

  let stepCounter = 0;
  let improved = true;
  while (improved && stepCounter < k * 3) {
    improved = false;
    let bestAddIdx: number | null = null;
    let bestAddEval: ReturnType<typeof evaluateTrainSubsetFast> = null;

    for (const cand of remainingIdx) {
      const evalRes = evaluateTrainSubsetFast(
        [...selectedIdx, cand],
        xTrainFull,
        yTrain,
        xTestFull,
        yTest
      );
      if (evalRes && (!bestAddEval || evalRes.aic < bestAddEval.aic)) {
        bestAddEval = evalRes;
        bestAddIdx = cand;
      }
    }

    if (bestAddIdx !== null && bestAddEval && bestAddEval.aic < currentAic - 1e-4) {
      selectedIdx.push(bestAddIdx);
      remainingIdx.delete(bestAddIdx);
      currentAic = bestAddEval.aic;
      stepCounter++;
      steps.push({
        step: stepCounter,
        action: 'add',
        feature: allFeatureNames[bestAddIdx],
        aic: bestAddEval.aic,
        adjR2: bestAddEval.adjR2,
      });
      improved = true;
    }

    // Backward check if more than 1 feature selected
    if (selectedIdx.length > 1) {
      let bestDropPos: number | null = null;
      let bestDropEval: ReturnType<typeof evaluateTrainSubsetFast> = null;
      for (let pos = 0; pos < selectedIdx.length; pos++) {
        const subset = selectedIdx.filter((_, i) => i !== pos);
        const evalRes = evaluateTrainSubsetFast(
          subset,
          xTrainFull,
          yTrain,
          xTestFull,
          yTest
        );
        if (evalRes && (!bestDropEval || evalRes.aic < bestDropEval.aic)) {
          bestDropEval = evalRes;
          bestDropPos = pos;
        }
      }
      if (bestDropPos !== null && bestDropEval && bestDropEval.aic < currentAic - 1e-4) {
        const removedFeature = allFeatureNames[selectedIdx[bestDropPos]];
        const removedIdx = selectedIdx[bestDropPos];
        selectedIdx.splice(bestDropPos, 1);
        remainingIdx.add(removedIdx);
        currentAic = bestDropEval.aic;
        stepCounter++;
        steps.push({
          step: stepCounter,
          action: 'remove',
          feature: removedFeature,
          aic: bestDropEval.aic,
          adjR2: bestDropEval.adjR2,
        });
        improved = true;
      }
    }
  }

  // Fallback: if no variable beat null AIC, keep top single variable by R2
  if (selectedIdx.length === 0) {
    let bestSingle = 0;
    let bestR2 = -1;
    for (let i = 0; i < k; i++) {
      const ev = evaluateTrainSubsetFast([i], xTrainFull, yTrain, xTestFull, yTest);
      if (ev && ev.r2 > bestR2) {
        bestR2 = ev.r2;
        bestSingle = i;
      }
    }
    selectedIdx.push(bestSingle);
  }

  const stepwiseFeatures = selectedIdx.map((i) => allFeatureNames[i]);
  const stepwiseFit = fitLinearRegressionModel({
    ...baseParams,
    id: 'model-stepwise',
    name: 'Regresión Stepwise (AIC)',
    kind: 'stepwise',
    selectedFeatureNames: stepwiseFeatures,
  });

  // 2. Best Subsets Selection (exhaustive up to k <= 12; otherwise top 12 by marginal correlation)
  let candidateFeatureIndices = allFeatureNames.map((_, i) => i);
  let truncatedWarning: string | null = null;
  if (k > 12) {
    const scored = candidateFeatureIndices.map((idx) => {
      const col = xTrainFull.map((r) => r[idx]);
      const corr = pearsonCorrelation(col, yTrain);
      return { idx, absR: Math.abs(corr.r ?? 0) };
    });
    scored.sort((a, b) => b.absR - a.absR);
    candidateFeatureIndices = scored.slice(0, 12).map((s) => s.idx);
    truncatedWarning = `Existen ${k} variables codificadas (>12). Para evitar explosión combinatoria (2^${k} subconjuntos), Best Subsets evaluó exhaustivamente las 12 variables con mayor correlación en entrenamiento.`;
  }

  const m = candidateFeatureIndices.length;
  const totalMasks = (1 << m) - 1;
  const allCandidates: SubsetCandidate[] = [];

  for (let mask = 1; mask <= totalMasks; mask++) {
    const subset: number[] = [];
    for (let bit = 0; bit < m; bit++) {
      if (mask & (1 << bit)) subset.push(candidateFeatureIndices[bit]);
    }
    const ev = evaluateTrainSubsetFast(subset, xTrainFull, yTrain, xTestFull, yTest);
    if (ev) {
      allCandidates.push({
        id: `sub-${mask}`,
        k: subset.length,
        featureNames: subset.map((i) => allFeatureNames[i]),
        adjR2: ev.adjR2,
        r2: ev.r2,
        aic: ev.aic,
        bic: ev.bic,
        trainRmse: ev.trainRmse,
        testRmse: ev.testRmse,
      });
    }
  }

  // Keep top candidates (best by Adj R2, best by BIC, plus best per subset size)
  const sortedByAdjR2 = [...allCandidates].sort((a, b) => b.adjR2 - a.adjR2);
  const sortedByBic = [...allCandidates].sort((a, b) => a.bic - b.bic);

  const topMap = new Map<string, SubsetCandidate>();
  for (let size = 1; size <= m; size++) {
    const bestOfSize = allCandidates
      .filter((c) => c.k === size)
      .sort((a, b) => b.adjR2 - a.adjR2)[0];
    if (bestOfSize) topMap.set(bestOfSize.id, bestOfSize);
  }
  sortedByAdjR2.slice(0, 5).forEach((c) => topMap.set(c.id, c));
  sortedByBic.slice(0, 5).forEach((c) => topMap.set(c.id, c));

  const topCandidates = Array.from(topMap.values()).sort((a, b) => b.adjR2 - a.adjR2);

  const bestAdjCandidate = sortedByAdjR2[0];
  const bestBicCandidate = sortedByBic[0];

  const bestByAdjR2 = bestAdjCandidate
    ? fitLinearRegressionModel({
        ...baseParams,
        id: 'model-best-adjr2',
        name: 'Best Subsets (Máx. R² Ajustado)',
        kind: 'best_subset',
        selectedFeatureNames: bestAdjCandidate.featureNames,
      }).model
    : null;

  const bestByBic = bestBicCandidate
    ? fitLinearRegressionModel({
        ...baseParams,
        id: 'model-best-bic',
        name: 'Best Subsets (Mín. BIC)',
        kind: 'best_subset',
        selectedFeatureNames: bestBicCandidate.featureNames,
      }).model
    : null;

  return {
    stepwiseResult: {
      selectedFeatures: stepwiseFeatures,
      steps,
      model: stepwiseFit.model,
    },
    bestSubsetsResult: {
      evaluatedCount: allCandidates.length,
      truncatedWarning,
      topCandidates,
      bestByAdjR2,
      bestByBic,
    },
  };
}

// ============================================================================
// 5. PREDICTION & INTERVALS (95% CI & 95% PI)
// ============================================================================

export function predictSingleObservation(
  model: RegressionModelResult,
  rawInputs: Record<string, string | number>
): {
  predictedValue: number;
  ciLower95: number | null;
  ciUpper95: number | null;
  piLower95: number | null;
  piUpper95: number | null;
} {
  // Reconstruct feature vector matching model.featureNames using exact training preprocessing
  const xVector: number[] = [1]; // intercept

  for (const fname of model.featureNames) {
    // Check if fname is a one-hot column: "sourceCol = category"
    const ohMapping = model.oneHotMappings.find((oh) =>
      oh.categories.some((cat) => `${oh.sourceCol} = ${cat}` === fname)
    );

    if (ohMapping) {
      const targetCat = fname.slice(ohMapping.sourceCol.length + 3);
      const rawVal = String(rawInputs[ohMapping.sourceCol] ?? '').trim();
      xVector.push(rawVal === targetCat ? 1 : 0);
    } else {
      // Numeric feature
      const rawVal = rawInputs[fname];
      let numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal ?? ''));
      if (!Number.isFinite(numVal)) {
        const imp = model.imputationsLearned[fname];
        numVal = imp && typeof imp.value === 'number' ? imp.value : 0;
      }
      // Apply numeric transform learned/configured
      if (model.transformsMap[fname] === 'log1p') {
        numVal = numVal >= 0 ? Math.log1p(numVal) : 0;
      }
      // Apply scaling learned on Train
      const sc = model.scalingLearned[fname];
      if (sc) {
        if (model.scalingMethod === 'standard' && sc.std > 1e-12) {
          numVal = (numVal - sc.mean) / sc.std;
        } else if (model.scalingMethod === 'minmax' && sc.max - sc.min > 1e-12) {
          numVal = (numVal - sc.min) / (sc.max - sc.min);
        }
      }
      xVector.push(numVal);
    }
  }

  const betas = [model.intercept.estimate, ...model.coefficients.map((c) => c.estimate)];
  const yHat = xVector.reduce((s, val, idx) => s + val * betas[idx], 0);

  // Compute x0^T (X^T X)^{-1} x0
  const inv = model.xtxInverse;
  let leverage = 0;
  if (inv.length === xVector.length) {
    for (let i = 0; i < xVector.length; i++) {
      let rowDot = 0;
      for (let j = 0; j < xVector.length; j++) {
        rowDot += inv[i][j] * xVector[j];
      }
      leverage += xVector[i] * rowDot;
    }
  }

  const s = model.trainMetrics.residualStdError;
  const df = model.trainMetrics.dfResidual;
  if (!Number.isFinite(leverage) || leverage < 0 || df <= 0 || !Number.isFinite(s)) {
    return {
      predictedValue: yHat,
      ciLower95: null,
      ciUpper95: null,
      piLower95: null,
      piUpper95: null,
    };
  }

  const tCrit = tInv(0.975, df);
  const ciHalf = tCrit * s * Math.sqrt(leverage);
  const piHalf = tCrit * s * Math.sqrt(1 + leverage);

  return {
    predictedValue: yHat,
    ciLower95: yHat - ciHalf,
    ciUpper95: yHat + ciHalf,
    piLower95: yHat - piHalf,
    piUpper95: yHat + piHalf,
  };
}
