import * as XLSX from 'xlsx';
import {
  BusinessSector,
  ColumnProfile,
  DataQualityReport,
  DatasetState,
  FeaturePrepConfig,
  MissingStrategy,
  NumericTransform,
  PreparedSplitData,
  ScalingMethod,
  SplitMethod,
  VariableType,
} from '../types/analytics';
import { computeDescriptiveStats } from './mathStats';

// ============================================================================
// 1. PARSING HELPERS (CSV, TXT, EXCEL)
// ============================================================================

const MISSING_TOKENS = new Set([
  '',
  'na',
  'n/a',
  'null',
  'none',
  'nan',
  'undefined',
  '-',
  '--',
  'sin dato',
  'n.a.',
]);

export function isMissingCell(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number') return !Number.isFinite(val);
  const str = String(val).trim().toLowerCase();
  return MISSING_TOKENS.has(str);
}

export function parseFlexibleNumber(val: unknown): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (isMissingCell(val)) return null;
  let str = String(val).trim();
  // Strip currency symbols, spaces, percent
  str = str.replace(/[$€£¥%\s]/g, '');
  if (!str) return null;

  // Handle European format like 1.234,56 vs US 1,234.56
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  if (hasComma && hasDot) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // European: 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    // Check if single comma acts as decimal separator (e.g. 12,5 or 0,45)
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length !== 3) {
      str = str.replace(',', '.');
    } else if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      // Ambiguous like 12,345 -> treat as decimal if small or US thousands? Usually comma decimal in Spanish CSVs with ; sep
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }

  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(str)) {
    return null;
  }
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export function parseFlexibleDate(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    const t = val.getTime();
    return Number.isFinite(t) ? t : null;
  }
  const str = String(val).trim();
  if (!str || str.length < 6) return null;
  // Avoid treating pure integers like "2024" or "123456" as dates
  if (/^[+-]?\d+(\.\d+)?$/.test(str)) return null;

  // ISO YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const t = Date.parse(str);
    return Number.isFinite(t) ? t : null;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dt = new Date(year, month - 1, day);
      return Number.isFinite(dt.getTime()) ? dt.getTime() : null;
    }
  }
  const t = Date.parse(str);
  return Number.isFinite(t) ? t : null;
}

function detectDelimiter(sampleLines: string[]): string {
  const candidates = [',', ';', '\t', '|'];
  let bestDelim = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = sampleLines
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        let inQuotes = false;
        let count = 0;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') inQuotes = !inQuotes;
          else if (ch === delim && !inQuotes) count++;
        }
        return count;
      });
    if (counts.length === 0) continue;
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    if (avg === 0) continue;
    const variance =
      counts.reduce((a, b) => a + (b - avg) ** 2, 0) / counts.length;
    // Consistent column count across lines wins
    const score = avg / (1 + variance);
    if (score > bestScore) {
      bestScore = score;
      bestDelim = delim;
    }
  }
  return bestDelim;
}

function parseDelimitedText(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, ''); // strip UTF-8 BOM

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) rows.push(currentRow);
  }
  return rows;
}

export async function parseUploadedFile(file: File): Promise<DatasetState> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  let rawMatrix: unknown[][] = [];
  let separator = ',';
  let fileFormat = ext.toUpperCase() || 'CSV';

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('El archivo Excel no contiene hojas válidas.');
    }
    const sheet = workbook.Sheets[firstSheetName];
    rawMatrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
    }) as unknown[][];
    separator = 'Hoja Excel';
    fileFormat = ext.toUpperCase();
  } else {
    const text = await file.text();
    const firstLines = text.split(/\r?\n/).slice(0, 15);
    separator = detectDelimiter(firstLines);
    rawMatrix = parseDelimitedText(text, separator);
    fileFormat = ext === 'txt' ? 'TXT' : 'CSV';
  }

  return buildDatasetStateFromMatrix(
    file.name,
    fileFormat,
    separator === '\t' ? 'Tabulador (\\t)' : separator,
    rawMatrix
  );
}

export function buildDatasetStateFromMatrix(
  fileName: string,
  fileFormat: string,
  separator: string,
  rawMatrix: unknown[][]
): DatasetState {
  // Filter completely empty rows
  const nonEmptyRows = rawMatrix.filter(
    (r) => Array.isArray(r) && r.some((cell) => !isMissingCell(cell))
  );
  if (nonEmptyRows.length < 3) {
    throw new Error(
      'El archivo debe contener al menos una fila de encabezados y 2 filas de datos.'
    );
  }

  const rawHeaders = nonEmptyRows[0].map((h, idx) => {
    const clean = String(h ?? '').trim();
    return clean || `Columna_${idx + 1}`;
  });

  // Deduplicate header names cleanly
  const seenHeaders = new Map<string, number>();
  const headers = rawHeaders.map((h) => {
    const count = seenHeaders.get(h) ?? 0;
    seenHeaders.set(h, count + 1);
    return count === 0 ? h : `${h}_${count + 1}`;
  });

  const dataRows = nonEmptyRows.slice(1);
  const rows: Record<string, string | number | null>[] = dataRows.map((rawRow) => {
    const obj: Record<string, string | number | null> = {};
    for (let c = 0; c < headers.length; c++) {
      const cell = rawRow[c];
      if (isMissingCell(cell)) {
        obj[headers[c]] = null;
      } else if (cell instanceof Date) {
        obj[headers[c]] = cell.toISOString().slice(0, 10);
      } else if (typeof cell === 'number') {
        obj[headers[c]] = Number.isFinite(cell) ? cell : null;
      } else {
        obj[headers[c]] = String(cell).trim();
      }
    }
    return obj;
  });

  return analyzeDatasetStructure(fileName, fileFormat, separator, headers, rows);
}

// ============================================================================
// 2. VARIABLE PROFILING, SECTOR SUGGESTION & DATA QUALITY
// ============================================================================

export function suggestBusinessSector(headers: string[]): BusinessSector {
  const joined = headers.join(' ').toLowerCase();
  if (/(credito|préstamo|prestamo|mora|scoring|riesgo|tasa_interes|deuda|banco|hipoteca|saldo)/.test(joined)) {
    return 'bancario';
  }
  if (/(activo|pasivo|patrimonio|ebitda|flujo|rentabilidad|accion|retorno|inversion|dividendo|margen_neto|utilidad)/.test(joined)) {
    return 'financiero';
  }
  if (/(mrr|arr|churn|usuarios|saas|suscripcion|tickets|latencia|servidor|clics|sesion|app|software)/.test(joined)) {
    return 'tecnologico';
  }
  if (/(ventas|precio|descuento|marketing|publicidad|tienda|canal|cliente|producto|unidades|factura|ticket_promedio)/.test(joined)) {
    return 'comercial';
  }
  if (/(produccion|maquina|defecto|lote|temperatura|presion|planta|turno|eficiencia|desperdicio)/.test(joined)) {
    return 'manufactura';
  }
  if (/(metros|m2|habitaciones|inmueble|alquiler|zona|propiedad|vivienda|terreno|banos)/.test(joined)) {
    return 'inmobiliario';
  }
  if (/(paciente|edad|imc|presion|glucosa|hospital|dosis|tratamiento|colesterol|diagnostico)/.test(joined)) {
    return 'salud';
  }
  return 'general';
}

export function analyzeDatasetStructure(
  fileName: string,
  fileFormat: string,
  separator: string,
  headers: string[],
  rows: Record<string, string | number | null>[],
  existingTypes?: Record<string, VariableType>
): DatasetState {
  const totalRows = rows.length;
  const profiles: ColumnProfile[] = [];
  const columnsWithMissing: DataQualityReport['columnsWithMissing'] = [];
  const columnsWithOutliers: DataQualityReport['columnsWithOutliers'] = [];
  const inconsistencies: DataQualityReport['inconsistencies'] = [];
  let totalMissingCells = 0;

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const col = headers[colIdx];
    let missingCount = 0;
    let numericCount = 0;
    let dateCount = 0;
    const nonMissingStrings: string[] = [];
    const numericValues: (number | null)[] = [];

    for (const row of rows) {
      const val = row[col];
      if (isMissingCell(val)) {
        missingCount++;
        numericValues.push(null);
        continue;
      }
      const strVal = String(val).trim();
      nonMissingStrings.push(strVal);

      const num = parseFlexibleNumber(val);
      if (num !== null) {
        numericCount++;
        numericValues.push(num);
      } else {
        numericValues.push(null);
        if (parseFlexibleDate(val) !== null) {
          dateCount++;
        }
      }
    }

    const validCount = nonMissingStrings.length;
    const uniqueSet = new Set(nonMissingStrings);
    const uniqueCount = uniqueSet.size;

    let inferredType: VariableType = 'text';
    let inconsistencyCount = 0;

    if (validCount > 0) {
      const numRatio = numericCount / validCount;
      const dateRatio = dateCount / validCount;

      if (numRatio >= 0.85) {
        inferredType = 'numeric';
        inconsistencyCount = validCount - numericCount;
        if (inconsistencyCount > 0) {
          inconsistencies.push({
            column: col,
            count: inconsistencyCount,
            description: `${inconsistencyCount} celda(s) con formato no numérico dentro de columna numérica.`,
          });
        }
      } else if (dateRatio >= 0.85) {
        inferredType = 'date';
        inconsistencyCount = validCount - dateCount;
        if (inconsistencyCount > 0) {
          inconsistencies.push({
            column: col,
            count: inconsistencyCount,
            description: `${inconsistencyCount} celda(s) con formato de fecha inválido.`,
          });
        }
      } else if (uniqueCount <= Math.min(20, Math.max(2, Math.floor(validCount * 0.45)))) {
        inferredType = 'categorical';
      } else {
        inferredType = 'text';
      }
    }

    const selectedType = existingTypes?.[col] ?? inferredType;

    // Normalize numeric values in rows if column is numeric so downstream works cleanly
    if (selectedType === 'numeric') {
      for (let r = 0; r < rows.length; r++) {
        const parsed = parseFlexibleNumber(rows[r][col]);
        if (parsed !== null) {
          rows[r][col] = parsed;
        }
      }
    }

    let outlierCount = 0;
    let outlierBounds: { lower: number; upper: number } | undefined;
    if (selectedType === 'numeric') {
      const stats = computeDescriptiveStats(
        col,
        rows.map((r) => parseFlexibleNumber(r[col]))
      );
      if (stats) {
        outlierCount = stats.outlierCount;
        const lower = stats.q1 - 1.5 * stats.iqr;
        const upper = stats.q3 + 1.5 * stats.iqr;
        outlierBounds = { lower, upper };
        if (outlierCount > 0) {
          columnsWithOutliers.push({ column: col, count: outlierCount, lower, upper });
        }
      }
    }

    totalMissingCells += missingCount;
    const missingPct = totalRows > 0 ? (missingCount / totalRows) * 100 : 0;
    if (missingCount > 0) {
      columnsWithMissing.push({ column: col, count: missingCount, pct: missingPct });
    }

    profiles.push({
      name: col,
      originalIndex: colIdx,
      inferredType,
      selectedType,
      totalCount: totalRows,
      missingCount,
      missingPct,
      uniqueCount,
      inconsistencyCount,
      sampleValues: nonMissingStrings.slice(0, 5),
      outlierCount,
      outlierBounds,
    });
  }

  // Exact duplicate row detection
  const rowSignatures = new Set<string>();
  const duplicateRowIndices: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const sig = headers.map((h) => String(rows[i][h] ?? '<NULL>')).join('||');
    if (rowSignatures.has(sig)) {
      duplicateRowIndices.push(i);
    } else {
      rowSignatures.add(sig);
    }
  }

  const totalCells = totalRows * headers.length;
  const quality: DataQualityReport = {
    totalRows,
    totalCols: headers.length,
    duplicateRowCount: duplicateRowIndices.length,
    duplicateRowIndices,
    totalMissingCells,
    missingPctGlobal: totalCells > 0 ? (totalMissingCells / totalCells) * 100 : 0,
    columnsWithMissing,
    columnsWithOutliers,
    inconsistencies,
  };

  return {
    fileName,
    fileFormat,
    separator,
    headers,
    rows,
    profiles,
    quality,
    suggestedSector: suggestBusinessSector(headers),
  };
}

// ============================================================================
// 3. ZERO-LEAKAGE PREPROCESSING & TRAIN/TEST SPLIT PIPELINE
// ============================================================================

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PreparePipelineParams {
  dataset: DatasetState;
  targetColumn: string;
  featureConfigs: FeaturePrepConfig[];
  missingStrategy: MissingStrategy;
  removeDuplicates: boolean;
  scalingMethod: ScalingMethod;
  splitMethod: SplitMethod;
  dateColumn: string | null;
  trainRatio: number; // default 0.8
  seed: number;
}

export function prepareTrainTestPipeline(
  params: PreparePipelineParams
): { data: PreparedSplitData | null; error: string | null } {
  const {
    dataset,
    targetColumn,
    featureConfigs,
    missingStrategy,
    removeDuplicates,
    scalingMethod,
    splitMethod,
    dateColumn,
    trainRatio,
    seed,
  } = params;

  const warnings: string[] = [];
  const profileMap = new Map<string, ColumnProfile>(
    dataset.profiles.map((p) => [p.name, p])
  );

  const targetProfile = profileMap.get(targetColumn);
  if (!targetProfile || targetProfile.selectedType !== 'numeric') {
    return {
      data: null,
      error: 'La variable dependiente (Y) debe ser numérica para ejecutar Regresión Lineal.',
    };
  }

  const activeFeatures = featureConfigs.filter((f) => f.included && f.column !== targetColumn);
  if (activeFeatures.length === 0) {
    return {
      data: null,
      error: 'Seleccione al menos una variable independiente (X) válida.',
    };
  }

  // Step A: Deduplicate (optional) and filter rows where Y is missing
  let workingRows = [...dataset.rows];
  let removedDuplicates = 0;
  if (removeDuplicates && dataset.quality.duplicateRowCount > 0) {
    const dupSet = new Set(dataset.quality.duplicateRowIndices);
    workingRows = workingRows.filter((_, idx) => !dupSet.has(idx));
    removedDuplicates = dupSet.size;
  }

  // Target Y cannot be imputed reliably without creating label leakage / synthetic targets: drop missing Y
  const beforeYDrop = workingRows.length;
  workingRows = workingRows.filter((r) => parseFlexibleNumber(r[targetColumn]) !== null);
  const droppedY = beforeYDrop - workingRows.length;
  if (droppedY > 0) {
    warnings.push(
      `Se excluyeron ${droppedY} fila(s) porque la variable objetivo "${targetColumn}" presentaba valores faltantes o no numéricos.`
    );
  }

  if (workingRows.length < 6) {
    return {
      data: null,
      error: `Registros insuficientes (${workingRows.length}) después de depurar valores faltantes en "${targetColumn}".`,
    };
  }

  // Step B: Train / Test Split BEFORE learning any imputation, encoding, or scaling!
  let splitMethodUsed: SplitMethod = splitMethod;
  let dateColumnUsed: string | null = null;

  let orderedRows = [...workingRows];
  if (splitMethod === 'chronological' && dateColumn) {
    const dated = orderedRows
      .map((r) => ({ row: r, ts: parseFlexibleDate(r[dateColumn]) }))
      .filter((item): item is { row: Record<string, string | number | null>; ts: number } => item.ts !== null);

    if (dated.length >= Math.max(6, Math.floor(orderedRows.length * 0.6))) {
      dated.sort((a, b) => a.ts - b.ts);
      orderedRows = dated.map((d) => d.row);
      dateColumnUsed = dateColumn;
      if (dated.length < workingRows.length) {
        warnings.push(
          `División cronológica por "${dateColumn}": se excluyeron ${workingRows.length - dated.length} fila(s) sin fecha válida.`
        );
      }
    } else {
      splitMethodUsed = 'random';
      warnings.push(
        `La columna "${dateColumn}" no tiene suficientes fechas válidas; se aplicó división aleatoria reproducible (semilla ${seed}).`
      );
    }
  } else {
    splitMethodUsed = 'random';
  }

  if (splitMethodUsed === 'random') {
    const rng = mulberry32(seed);
    for (let i = orderedRows.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [orderedRows[i], orderedRows[j]] = [orderedRows[j], orderedRows[i]];
    }
  }

  const splitIdx = Math.max(4, Math.min(orderedRows.length - 2, Math.round(orderedRows.length * trainRatio)));
  let rawTrain = orderedRows.slice(0, splitIdx);
  let rawTest = orderedRows.slice(splitIdx);

  // Step C: Handle missing values strictly learned from Train
  let droppedMissingTrain = 0;
  let droppedMissingTest = 0;
  const imputationsLearned: PreparedSplitData['imputationsLearned'] = {};

  const activeCols = activeFeatures.map((f) => f.column);

  if (missingStrategy === 'drop_rows' || missingStrategy === 'none') {
    const filterValid = (rowsList: Record<string, string | number | null>[]) =>
      rowsList.filter((r) =>
        activeFeatures.every((fc) => {
          const prof = profileMap.get(fc.column);
          if (!prof) return false;
          if (prof.selectedType === 'numeric') {
            return parseFlexibleNumber(r[fc.column]) !== null;
          }
          return !isMissingCell(r[fc.column]);
        })
      );
    const trainFiltered = filterValid(rawTrain);
    const testFiltered = filterValid(rawTest);
    droppedMissingTrain = rawTrain.length - trainFiltered.length;
    droppedMissingTest = rawTest.length - testFiltered.length;
    rawTrain = trainFiltered;
    rawTest = testFiltered;
  } else {
    // Learn imputation stats strictly on rawTrain
    for (const fc of activeFeatures) {
      const prof = profileMap.get(fc.column);
      if (!prof) continue;

      if (prof.selectedType === 'numeric') {
        const trainNums = rawTrain
          .map((r) => parseFlexibleNumber(r[fc.column]))
          .filter((v): v is number => v !== null);
        if (trainNums.length === 0) {
          return {
            data: null,
            error: `La variable "${fc.column}" no tiene valores numéricos válidos en entrenamiento.`,
          };
        }
        let impVal = 0;
        let methodName = 'Media (Train)';
        if (missingStrategy === 'median') {
          const sorted = [...trainNums].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          impVal = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          methodName = 'Mediana (Train)';
        } else if (missingStrategy === 'mode') {
          const counts = new Map<number, number>();
          trainNums.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
          let bestV = trainNums[0];
          let bestC = 0;
          counts.forEach((c, v) => {
            if (c > bestC) {
              bestC = c;
              bestV = v;
            }
          });
          impVal = bestV;
          methodName = 'Moda (Train)';
        } else {
          impVal = trainNums.reduce((s, v) => s + v, 0) / trainNums.length;
        }
        imputationsLearned[fc.column] = { type: 'numeric', value: impVal, method: methodName };
      } else {
        // Categorical mode learned on Train
        const counts = new Map<string, number>();
        for (const r of rawTrain) {
          if (!isMissingCell(r[fc.column])) {
            const s = String(r[fc.column]).trim();
            counts.set(s, (counts.get(s) ?? 0) + 1);
          }
        }
        let modeCat = 'Desconocido';
        let bestC = 0;
        counts.forEach((c, k) => {
          if (c > bestC) {
            bestC = c;
            modeCat = k;
          }
        });
        imputationsLearned[fc.column] = {
          type: prof.selectedType,
          value: modeCat,
          method: 'Moda Categórica (Train)',
        };
      }
    }
  }

  if (rawTrain.length < 4) {
    return {
      data: null,
      error: `Quedaron solo ${rawTrain.length} filas válidas en entrenamiento tras tratar datos faltantes. Cambie la estrategia de imputación o revise sus columnas.`,
    };
  }

  // Helper to get imputed value
  const getCellNumeric = (row: Record<string, string | number | null>, col: string): number => {
    const parsed = parseFlexibleNumber(row[col]);
    if (parsed !== null) return parsed;
    const imp = imputationsLearned[col];
    return imp && typeof imp.value === 'number' ? imp.value : 0;
  };

  const getCellCategorical = (row: Record<string, string | number | null>, col: string): string => {
    if (!isMissingCell(row[col])) return String(row[col]).trim();
    const imp = imputationsLearned[col];
    return imp ? String(imp.value) : 'Desconocido';
  };

  // Step D: Build encoding & scaling metadata strictly from rawTrain
  const featureNames: string[] = [];
  const featureSourceMap: Record<string, string> = {};
  const oneHotMappings: PreparedSplitData['oneHotMappings'] = [];
  const scalingLearned: PreparedSplitData['scalingLearned'] = {};

  interface EncodedColSpec {
    featureName: string;
    sourceCol: string;
    kind: 'numeric' | 'dummy';
    dummyCategory?: string;
    transform: NumericTransform;
  }
  const specs: EncodedColSpec[] = [];

  for (const fc of activeFeatures) {
    const prof = profileMap.get(fc.column);
    if (!prof) continue;

    if (prof.selectedType === 'numeric') {
      // Check if log1p is valid on Train
      let effectiveTransform: NumericTransform = fc.transform;
      if (effectiveTransform === 'log1p') {
        const hasNegative = rawTrain.some((r) => getCellNumeric(r, fc.column) < 0);
        if (hasNegative) {
          effectiveTransform = 'none';
          warnings.push(
            `Se omitió transformación Log(1+x) en "${fc.column}" porque contiene valores negativos en entrenamiento.`
          );
        }
      }

      const trainTransformed = rawTrain.map((r) => {
        const v = getCellNumeric(r, fc.column);
        return effectiveTransform === 'log1p' ? Math.log1p(Math.max(0, v)) : v;
      });
      const nT = trainTransformed.length;
      const mean = trainTransformed.reduce((s, v) => s + v, 0) / nT;
      const std = Math.sqrt(
        trainTransformed.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, nT - 1)
      );
      const min = Math.min(...trainTransformed);
      const max = Math.max(...trainTransformed);
      scalingLearned[fc.column] = { mean, std, min, max };

      featureNames.push(fc.column);
      featureSourceMap[fc.column] = fc.column;
      specs.push({
        featureName: fc.column,
        sourceCol: fc.column,
        kind: 'numeric',
        transform: effectiveTransform,
      });
    } else if (prof.selectedType === 'categorical' && fc.encoding === 'onehot') {
      // Discover categories strictly in Train
      const catCounts = new Map<string, number>();
      for (const r of rawTrain) {
        const c = getCellCategorical(r, fc.column);
        catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
      }
      // Sort by frequency desc so most frequent category is the reference baseline (avoid dummy trap)
      const sortedCats = Array.from(catCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map((e) => e[0]);

      if (sortedCats.length < 2) {
        warnings.push(
          `La variable categórica "${fc.column}" tiene una sola categoría en entrenamiento y fue omitida.`
        );
        continue;
      }

      // Cap high cardinality categories to top 10 to preserve degrees of freedom
      const limitedCats = sortedCats.slice(0, 10);
      if (sortedCats.length > 10) {
        warnings.push(
          `La variable "${fc.column}" tenía ${sortedCats.length} categorías; se codificaron las 9 principales frente a referencia.`
        );
      }
      const refCat = limitedCats[0];
      const dummyCats = limitedCats.slice(1);
      oneHotMappings.push({
        sourceCol: fc.column,
        referenceCategory: refCat,
        categories: dummyCats,
      });

      for (const cat of dummyCats) {
        const fname = `${fc.column} = ${cat}`;
        featureNames.push(fname);
        featureSourceMap[fname] = fc.column;
        specs.push({
          featureName: fname,
          sourceCol: fc.column,
          kind: 'dummy',
          dummyCategory: cat,
          transform: 'none',
        });
      }
    }
  }

  if (featureNames.length === 0) {
    return {
      data: null,
      error: 'No quedaron predictores válidos tras la codificación de variables.',
    };
  }

  const encodeRows = (rowsList: Record<string, string | number | null>[]): { X: number[][]; y: number[] } => {
    const X: number[][] = [];
    const y: number[] = [];
    for (const r of rowsList) {
      const yVal = parseFlexibleNumber(r[targetColumn]);
      if (yVal === null) continue;
      const xRow: number[] = [];
      for (const sp of specs) {
        if (sp.kind === 'dummy') {
          const catVal = getCellCategorical(r, sp.sourceCol);
          xRow.push(catVal === sp.dummyCategory ? 1 : 0);
        } else {
          let val = getCellNumeric(r, sp.sourceCol);
          if (sp.transform === 'log1p') {
            val = val >= 0 ? Math.log1p(val) : 0;
          }
          const sc = scalingLearned[sp.sourceCol];
          if (sc) {
            if (scalingMethod === 'standard' && sc.std > 1e-12) {
              val = (val - sc.mean) / sc.std;
            } else if (scalingMethod === 'minmax' && sc.max - sc.min > 1e-12) {
              val = (val - sc.min) / (sc.max - sc.min);
            }
          }
          xRow.push(val);
        }
      }
      X.push(xRow);
      y.push(yVal);
    }
    return { X, y };
  };

  const trainEncoded = encodeRows(rawTrain);
  const testEncoded = encodeRows(rawTest);

  // Also ensure activeCols reference is used cleanly
  void activeCols;

  return {
    data: {
      trainRows: rawTrain,
      testRows: rawTest,
      splitMethodUsed,
      dateColumnUsed,
      removedDuplicates,
      droppedMissingTrain,
      droppedMissingTest,
      imputationsLearned,
      scalingLearned,
      oneHotMappings,
      featureNames,
      featureSourceMap,
      xTrain: trainEncoded.X,
      yTrain: trainEncoded.y,
      xTest: testEncoded.X,
      yTest: testEncoded.y,
      warnings,
    },
    error: null,
  };
}
