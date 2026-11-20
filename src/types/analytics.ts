export type VariableType = 'numeric' | 'categorical' | 'date' | 'text';

export type BusinessSector =
  | 'comercial'
  | 'financiero'
  | 'bancario'
  | 'tecnologico'
  | 'manufactura'
  | 'inmobiliario'
  | 'salud'
  | 'general';

export type MissingStrategy =
  | 'drop_rows'
  | 'mean'
  | 'median'
  | 'mode'
  | 'none';

export type ScalingMethod = 'none' | 'standard' | 'minmax';

export type NumericTransform = 'none' | 'log1p';

export type RegressionChoice = 'auto' | 'simple' | 'multiple';

export type SplitMethod = 'random' | 'chronological';

export interface ColumnProfile {
  name: string;
  originalIndex: number;
  inferredType: VariableType;
  selectedType: VariableType;
  totalCount: number;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  inconsistencyCount: number;
  sampleValues: string[];
  outlierCount: number;
  outlierBounds?: { lower: number; upper: number };
}

export interface DescriptiveStat {
  column: string;
  n: number;
  missing: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  min: number;
  p5: number;
  q1: number;
  q3: number;
  p95: number;
  max: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  outlierCount: number;
  values: number[];
}

export interface DataQualityReport {
  totalRows: number;
  totalCols: number;
  duplicateRowCount: number;
  duplicateRowIndices: number[];
  totalMissingCells: number;
  missingPctGlobal: number;
  columnsWithMissing: { column: string; count: number; pct: number }[];
  columnsWithOutliers: { column: string; count: number; lower: number; upper: number }[];
  inconsistencies: { column: string; count: number; description: string }[];
}

export interface DatasetState {
  fileName: string;
  fileFormat: string;
  separator: string;
  headers: string[];
  rows: Record<string, string | number | null>[];
  profiles: ColumnProfile[];
  quality: DataQualityReport;
  suggestedSector: BusinessSector;
}

export interface FeaturePrepConfig {
  column: string;
  included: boolean;
  encoding: 'onehot' | 'ignore';
  transform: NumericTransform;
}

export interface CoefficientResult {
  name: string;
  sourceColumn: string;
  estimate: number;
  stdError: number;
  tStat: number;
  pValue: number;
  ciLower95: number;
  ciUpper95: number;
  standardizedBeta: number | null;
  vif: number | null;
}

export interface RegressionMetrics {
  n: number;
  p: number; // number of parameters including intercept
  dfResidual: number;
  r2: number;
  adjR2: number;
  rmse: number;
  mae: number;
  mape: number | null;
  sse: number;
  ssr: number;
  sst: number;
  fStat: number | null;
  fPValue: number | null;
  aic: number;
  bic: number;
  residualStdError: number;
}

export interface DiagnosticTests {
  durbinWatson: number;
  durbinWatsonStatus: 'ok' | 'positive_autocorr' | 'negative_autocorr' | 'inconclusive';
  breuschPaganStat: number | null;
  breuschPaganPValue: number | null;
  homoscedastic: boolean | null;
  jarqueBeraStat: number | null;
  jarqueBeraPValue: number | null;
  residualSkewness: number;
  residualKurtosis: number;
  normalResiduals: boolean | null;
  linearityCorrResidualFitted: number;
  linearityResetR2: number | null;
  linearityOk: boolean;
  maxVif: number | null;
  multicollinearityLevel: 'none' | 'moderate' | 'severe' | 'na';
}

export interface PreparedSplitData {
  trainRows: Record<string, string | number | null>[];
  testRows: Record<string, string | number | null>[];
  splitMethodUsed: SplitMethod;
  dateColumnUsed: string | null;
  removedDuplicates: number;
  droppedMissingTrain: number;
  droppedMissingTest: number;
  imputationsLearned: Record<string, { type: VariableType; value: string | number; method: string }>;
  scalingLearned: Record<string, { mean: number; std: number; min: number; max: number }>;
  oneHotMappings: { sourceCol: string; referenceCategory: string; categories: string[] }[];
  featureNames: string[];
  featureSourceMap: Record<string, string>;
  xTrain: number[][];
  yTrain: number[];
  xTest: number[][];
  yTest: number[];
  warnings: string[];
}

export interface RegressionModelResult {
  id: string;
  name: string;
  kind: 'simple' | 'multiple' | 'stepwise' | 'best_subset';
  targetColumn: string;
  featureNames: string[];
  sourceColumns: string[];
  intercept: CoefficientResult;
  coefficients: CoefficientResult[];
  trainMetrics: RegressionMetrics;
  testMetrics: RegressionMetrics | null;
  diagnostics: DiagnosticTests;
  yTrainActual: number[];
  yTrainFitted: number[];
  trainResiduals: number[];
  yTestActual: number[];
  yTestPredicted: number[];
  testResiduals: number[];
  xtxInverse: number[][];
  trainFeatureMeans: Record<string, number>;
  trainFeatureStds: Record<string, number>;
  scalingMethod: ScalingMethod;
  scalingLearned: Record<string, { mean: number; std: number; min: number; max: number }>;
  imputationsLearned: Record<string, { type: VariableType; value: string | number; method: string }>;
  oneHotMappings: { sourceCol: string; referenceCategory: string; categories: string[] }[];
  transformsMap: Record<string, NumericTransform>;
  warnings: string[];
  equationText: string;
  createdAt: string;
}

export interface SubsetCandidate {
  id: string;
  k: number;
  featureNames: string[];
  adjR2: number;
  r2: number;
  aic: number;
  bic: number;
  trainRmse: number;
  testRmse: number | null;
}

export interface VariableSelectionSummary {
  stepwiseResult: {
    selectedFeatures: string[];
    steps: { step: number; action: 'add' | 'remove'; feature: string; aic: number; adjR2: number }[];
    model: RegressionModelResult | null;
  } | null;
  bestSubsetsResult: {
    evaluatedCount: number;
    truncatedWarning: string | null;
    topCandidates: SubsetCandidate[];
    bestByAdjR2: RegressionModelResult | null;
    bestByBic: RegressionModelResult | null;
  } | null;
}

export interface PredictionRecord {
  id: string;
  inputs: Record<string, string | number>;
  predictedValue: number;
  ciLower95: number | null;
  ciUpper95: number | null;
  piLower95: number | null;
  piUpper95: number | null;
  modelName: string;
  createdAt: string;
}
