import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BusinessSector,
  DatasetState,
  DescriptiveStat,
  PredictionRecord,
  PreparedSplitData,
  RegressionModelResult,
} from '../types/analytics';
import { BUSINESS_SECTORS, generateExpertInterpretation } from './expertInterpreter';

// ============================================================================
// 1. EXCEL WORKBOOK EXPORT
// ============================================================================

export function exportResultsToExcel(params: {
  dataset: DatasetState;
  descriptiveStats: DescriptiveStat[];
  correlationMatrix: { headers: string[]; values: (number | null)[][] };
  models: RegressionModelResult[];
  activeModel: RegressionModelResult;
  predictions: PredictionRecord[];
  sector: BusinessSector;
}): void {
  const {
    dataset,
    descriptiveStats,
    correlationMatrix,
    models,
    activeModel,
    predictions,
  } = params;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen Modelos
  const summaryRows = models.map((m) => ({
    Modelo: m.name,
    Tipo: m.kind,
    Variable_Objetivo_Y: m.targetColumn,
    Predictores: m.featureNames.length,
    R2_Entrenamiento: Number(m.trainMetrics.r2.toFixed(4)),
    R2_Ajustado_Train: Number(m.trainMetrics.adjR2.toFixed(4)),
    RMSE_Train: Number(m.trainMetrics.rmse.toFixed(4)),
    MAE_Train: Number(m.trainMetrics.mae.toFixed(4)),
    AIC: Number(m.trainMetrics.aic.toFixed(2)),
    BIC: Number(m.trainMetrics.bic.toFixed(2)),
    R2_Prueba: m.testMetrics ? Number(m.testMetrics.r2.toFixed(4)) : 'N/A',
    RMSE_Prueba: m.testMetrics ? Number(m.testMetrics.rmse.toFixed(4)) : 'N/A',
    MAE_Prueba: m.testMetrics ? Number(m.testMetrics.mae.toFixed(4)) : 'N/A',
    Durbin_Watson: Number(m.diagnostics.durbinWatson.toFixed(3)),
    VIF_Max:
      m.diagnostics.maxVif !== null
        ? Number.isFinite(m.diagnostics.maxVif)
          ? Number(m.diagnostics.maxVif.toFixed(2))
          : 'Infinito'
        : 'N/A',
    Ecuacion: m.equationText,
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_Modelos');

  // Sheet 2: Coeficientes del Modelo Activo
  const allCoeffs = [activeModel.intercept, ...activeModel.coefficients].map((c) => ({
    Variable: c.name,
    Columna_Origen: c.sourceColumn,
    Coeficiente_Beta: Number(c.estimate.toFixed(6)),
    Error_Estandar: Number(c.stdError.toFixed(6)),
    Estadistico_t: Number(c.tStat.toFixed(4)),
    Valor_p: Number(c.pValue.toFixed(6)),
    Significativo_5pct: c.pValue < 0.05 ? 'Sí' : 'No',
    IC_95_Inferior: Number(c.ciLower95.toFixed(6)),
    IC_95_Superior: Number(c.ciUpper95.toFixed(6)),
    Beta_Estandarizado:
      c.standardizedBeta !== null ? Number(c.standardizedBeta.toFixed(4)) : 'N/A',
    VIF: c.vif !== null ? (Number.isFinite(c.vif) ? Number(c.vif.toFixed(3)) : 'Inf') : 'N/A',
  }));
  const wsCoeffs = XLSX.utils.json_to_sheet(allCoeffs);
  XLSX.utils.book_append_sheet(wb, wsCoeffs, 'Coeficientes_Activo');

  // Sheet 3: Análisis Descriptivo
  if (descriptiveStats.length > 0) {
    const descRows = descriptiveStats.map((d) => ({
      Variable: d.column,
      N_Validos: d.n,
      Faltantes: d.missing,
      Media: Number(d.mean.toFixed(4)),
      Mediana: Number(d.median.toFixed(4)),
      Desv_Estandar: Number(d.stdDev.toFixed(4)),
      Varianza: Number(d.variance.toFixed(4)),
      Minimo: Number(d.min.toFixed(4)),
      Percentil_5: Number(d.p5.toFixed(4)),
      Q1_25: Number(d.q1.toFixed(4)),
      Q3_75: Number(d.q3.toFixed(4)),
      Percentil_95: Number(d.p95.toFixed(4)),
      Maximo: Number(d.max.toFixed(4)),
      Atipicos_IQR: d.outlierCount,
    }));
    const wsDesc = XLSX.utils.json_to_sheet(descRows);
    XLSX.utils.book_append_sheet(wb, wsDesc, 'Descriptivos');
  }

  // Sheet 4: Matriz de Correlación
  if (correlationMatrix.headers.length > 0) {
    const corrRows = correlationMatrix.headers.map((h, i) => {
      const rowObj: Record<string, string | number> = { Variable: h };
      correlationMatrix.headers.forEach((h2, j) => {
        const val = correlationMatrix.values[i]?.[j];
        rowObj[h2] = val !== null && val !== undefined ? Number(val.toFixed(4)) : 'N/A';
      });
      return rowObj;
    });
    const wsCorr = XLSX.utils.json_to_sheet(corrRows);
    XLSX.utils.book_append_sheet(wb, wsCorr, 'Correlaciones');
  }

  // Sheet 5: Valores Reales vs Estimados (Test & Train)
  const evalRows: Record<string, string | number>[] = [];
  activeModel.yTrainActual.forEach((y, idx) => {
    evalRows.push({
      Conjunto: 'Entrenamiento (80%)',
      Registro: idx + 1,
      Valor_Real_Y: Number(y.toFixed(4)),
      Valor_Estimado_Y_Hat: Number(activeModel.yTrainFitted[idx].toFixed(4)),
      Residuo: Number(activeModel.trainResiduals[idx].toFixed(4)),
    });
  });
  activeModel.yTestActual.forEach((y, idx) => {
    evalRows.push({
      Conjunto: 'Prueba (20%)',
      Registro: idx + 1,
      Valor_Real_Y: Number(y.toFixed(4)),
      Valor_Estimado_Y_Hat: Number(activeModel.yTestPredicted[idx].toFixed(4)),
      Residuo: Number(activeModel.testResiduals[idx].toFixed(4)),
    });
  });
  const wsEval = XLSX.utils.json_to_sheet(evalRows);
  XLSX.utils.book_append_sheet(wb, wsEval, 'Reales_vs_Estimados');

  // Sheet 6: Predicciones Nuevas
  if (predictions.length > 0) {
    const predRows = predictions.map((p, idx) => ({
      Nro: idx + 1,
      Modelo: p.modelName,
      ...p.inputs,
      Prediccion_Estimada: Number(p.predictedValue.toFixed(4)),
      IC_95_Media_Inf: p.ciLower95 !== null ? Number(p.ciLower95.toFixed(4)) : 'N/A',
      IC_95_Media_Sup: p.ciUpper95 !== null ? Number(p.ciUpper95.toFixed(4)) : 'N/A',
      IP_95_Obs_Inf: p.piLower95 !== null ? Number(p.piLower95.toFixed(4)) : 'N/A',
      IP_95_Obs_Sup: p.piUpper95 !== null ? Number(p.piUpper95.toFixed(4)) : 'N/A',
    }));
    const wsPred = XLSX.utils.json_to_sheet(predRows);
    XLSX.utils.book_append_sheet(wb, wsPred, 'Predicciones');
  }

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  XLSX.writeFile(wb, `EstimaBI_Resultados_${baseName}.xlsx`);
}

// ============================================================================
// 2. OFFSCREEN CANVAS CHART GENERATORS FOR PDF EMBEDDING
// ============================================================================

function renderActualVsPredictedCanvas(model: RegressionModelResult): string {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = { top: 48, right: 32, bottom: 54, left: 72 };
  const w = canvas.width - pad.left - pad.right;
  const h = canvas.height - pad.top - pad.bottom;

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

  const mapX = (v: number) => pad.left + ((v - lo) / (hi - lo)) * w;
  const mapY = (v: number) => pad.top + h - ((v - lo) / (hi - lo)) * h;

  // Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`Valores Reales vs. Estimados (${model.targetColumn})`, pad.left, 26);

  // Grid
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const val = lo + ((hi - lo) * i) / 4;
    const yy = mapY(val);
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(pad.left + w, yy);
    ctx.stroke();
    ctx.fillStyle = '#64748B';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(1), pad.left - 8, yy + 4);
  }

  // 45-degree ideal line
  ctx.strokeStyle = '#0F172A';
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mapX(lo), mapY(lo));
  ctx.lineTo(mapX(hi), mapY(hi));
  ctx.stroke();
  ctx.setLineDash([]);

  // Train points
  ctx.fillStyle = 'rgba(30, 58, 95, 0.55)';
  model.yTrainActual.forEach((y, i) => {
    ctx.beginPath();
    ctx.arc(mapX(y), mapY(model.yTrainFitted[i]), 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Test points
  ctx.fillStyle = 'rgba(37, 99, 235, 0.88)';
  model.yTestActual.forEach((y, i) => {
    ctx.beginPath();
    ctx.arc(mapX(y), mapY(model.yTestPredicted[i]), 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Axes labels & legend
  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.font = '12px sans-serif';
  ctx.fillText('Valor Real (Y)', pad.left + w / 2, canvas.height - 14);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#1E3A5F';
  ctx.fillRect(pad.left + w - 210, 14, 10, 10);
  ctx.fillStyle = '#334155';
  ctx.fillText('Train (80%)', pad.left + w - 195, 23);

  ctx.fillStyle = '#2563EB';
  ctx.fillRect(pad.left + w - 105, 14, 10, 10);
  ctx.fillStyle = '#334155';
  ctx.fillText('Test (20%)', pad.left + w - 90, 23);

  return canvas.toDataURL('image/png');
}

function renderResidualsCanvas(model: RegressionModelResult): string {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = { top: 48, right: 32, bottom: 54, left: 72 };
  const w = canvas.width - pad.left - pad.right;
  const h = canvas.height - pad.top - pad.bottom;

  const minX = Math.min(...model.yTrainFitted);
  const maxX = Math.max(...model.yTrainFitted);
  const spanX = maxX - minX || 1;
  const maxAbsY = Math.max(...model.trainResiduals.map((r) => Math.abs(r)), 1e-6);

  const mapX = (v: number) => pad.left + ((v - minX) / spanX) * w;
  const mapY = (v: number) => pad.top + h / 2 - (v / (maxAbsY * 1.15)) * (h / 2);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Diagnóstico: Residuos vs. Valores Ajustados (Train)', pad.left, 26);

  // Zero line
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, mapY(0));
  ctx.lineTo(pad.left + w, mapY(0));
  ctx.stroke();
  ctx.setLineDash([]);

  // Points
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  model.yTrainFitted.forEach((f, i) => {
    ctx.beginPath();
    ctx.arc(mapX(f), mapY(model.trainResiduals[i]), 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#64748B';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText((maxAbsY * 1.15).toFixed(1), pad.left - 8, pad.top + 8);
  ctx.fillText('0.0', pad.left - 8, mapY(0) + 4);
  ctx.fillText((-maxAbsY * 1.15).toFixed(1), pad.left - 8, pad.top + h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.font = '12px sans-serif';
  ctx.fillText('Valores Ajustados (Ŷ)', pad.left + w / 2, canvas.height - 14);

  return canvas.toDataURL('image/png');
}

// ============================================================================
// 3. EXECUTIVE PDF REPORT EXPORT
// ============================================================================

export function exportExecutivePdfReport(params: {
  dataset: DatasetState;
  sector: BusinessSector;
  descriptiveStats: DescriptiveStat[];
  splitData: PreparedSplitData;
  models: RegressionModelResult[];
  activeModel: RegressionModelResult;
  predictions: PredictionRecord[];
}): void {
  const {
    dataset,
    sector,
    descriptiveStats,
    splitData,
    models,
    activeModel,
    predictions,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sectorMeta =
    BUSINESS_SECTORS.find((s) => s.id === sector) ?? BUSINESS_SECTORS[BUSINESS_SECTORS.length - 1];
  const expert = generateExpertInterpretation(activeModel, sector);

  // Header Banner
  doc.setFillColor(10, 15, 28); // #0A0F1C Deep Dark
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(37, 99, 235); // #2563EB Cobalt Blue stripe
  doc.rect(0, 34, 210, 1.8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Informe Ejecutivo de Analítica y Regresión Lineal', 14, 16);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Archivo: ${dataset.fileName}  |  Sector: ${sectorMeta.label}  |  Fecha: ${new Date().toLocaleDateString('es-ES')}`,
    14,
    25
  );

  let yPos = 44;

  // Section 1: Resumen Ejecutivo & Metodología
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Resumen Ejecutivo y Metodología Aplicada', 14, yPos);
  yPos += 6;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const splitMethodLabel =
    splitData.splitMethodUsed === 'chronological'
      ? `División cronológica por "${splitData.dateColumnUsed}"`
      : 'División aleatoria reproducible';
  const methodText = `Base analizada: ${dataset.quality.totalRows} registros y ${dataset.quality.totalCols} variables. Se implementó un flujo estricto sin fuga de información: ${splitMethodLabel} en Entrenamiento (${splitData.xTrain.length} filas) y Prueba (${splitData.xTest.length} filas). Todas las imputaciones, codificaciones categóricas y transformaciones se ajustaron exclusivamente sobre entrenamiento.`;
  const methodLines = doc.splitTextToSize(methodText, 182);
  doc.text(methodLines, 14, yPos);
  yPos += methodLines.length * 4.5 + 3;

  const execLines = doc.splitTextToSize(expert.executiveSummary, 182);
  doc.text(execLines, 14, yPos);
  yPos += execLines.length * 4.5 + 6;

  // Section 2: Estadísticas Descriptivas
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Análisis Descriptivo de Variables Numéricas', 14, yPos);
  yPos += 3;

  autoTable(doc, {
    startY: yPos,
    head: [['Variable', 'N', 'Media', 'Mediana', 'Desv. Est.', 'Mín', 'Máx', 'Atípicos']],
    body: descriptiveStats.slice(0, 12).map((d) => [
      d.column,
      String(d.n),
      d.mean.toFixed(2),
      d.median.toFixed(2),
      d.stdDev.toFixed(2),
      d.min.toFixed(2),
      d.max.toFixed(2),
      String(d.outlierCount),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Section 3: Ecuación y Coeficientes del Modelo Activo
  doc.addPage();
  yPos = 18;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`3. Modelo Seleccionado: ${activeModel.name}`, 14, yPos);
  yPos += 6;

  doc.setFontSize(8.5);
  doc.setFont('courier', 'normal');
  doc.setTextColor(37, 99, 235);
  const eqLines = doc.splitTextToSize(`Ecuación: ${activeModel.equationText}`, 182);
  doc.text(eqLines, 14, yPos);
  yPos += eqLines.length * 4 + 4;

  autoTable(doc, {
    startY: yPos,
    head: [['Término', 'Coef. β', 'Error Est.', 't', 'Valor p', 'IC 95%', 'VIF']],
    body: [activeModel.intercept, ...activeModel.coefficients].map((c) => [
      c.name,
      c.estimate.toFixed(4),
      c.stdError.toFixed(4),
      c.tStat.toFixed(2),
      c.pValue < 0.0001 ? '< 0.0001' : c.pValue.toFixed(4),
      `[${c.ciLower95.toFixed(3)}, ${c.ciUpper95.toFixed(3)}]`,
      c.vif !== null ? (Number.isFinite(c.vif) ? c.vif.toFixed(2) : 'Inf') : '-',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Section 4: Validación de Supuestos y Comparación de Modelos
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Diagnóstico de Supuestos y Comparación de Modelos', 14, yPos);
  yPos += 3;

  autoTable(doc, {
    startY: yPos,
    head: [['Modelo', 'R² Train', 'R² Aj.', 'AIC', 'BIC', 'RMSE Train', 'RMSE Test', 'MAE Test']],
    body: models.map((m) => [
      m.name,
      `${(m.trainMetrics.r2 * 100).toFixed(1)}%`,
      `${(m.trainMetrics.adjR2 * 100).toFixed(1)}%`,
      m.trainMetrics.aic.toFixed(1),
      m.trainMetrics.bic.toFixed(1),
      m.trainMetrics.rmse.toFixed(3),
      m.testMetrics ? m.testMetrics.rmse.toFixed(3) : 'N/A',
      m.testMetrics ? m.testMetrics.mae.toFixed(3) : 'N/A',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Diagnostics summary table
  autoTable(doc, {
    startY: yPos,
    head: [['Supuesto Estadístico', 'Prueba / Indicador', 'Resultado']],
    body: [
      [
        'Linealidad',
        'Correlación Residuos-Ajustados / Curvatura',
        activeModel.diagnostics.linearityOk ? 'Cumple (sin curvatura severa)' : 'Alerta de no linealidad',
      ],
      [
        'Independencia',
        `Durbin-Watson = ${activeModel.diagnostics.durbinWatson.toFixed(3)}`,
        activeModel.diagnostics.durbinWatsonStatus === 'ok'
          ? 'Aceptable (~2.0)'
          : 'Posible autocorrelación',
      ],
      [
        'Homocedasticidad',
        `Breusch-Pagan p = ${activeModel.diagnostics.breuschPaganPValue?.toFixed(4) ?? 'N/A'}`,
        activeModel.diagnostics.homoscedastic === false ? 'Heterocedasticidad detectada' : 'Varianza homogénea',
      ],
      [
        'Normalidad de Residuos',
        `Jarque-Bera p = ${activeModel.diagnostics.jarqueBeraPValue?.toFixed(4) ?? 'N/A'}`,
        activeModel.diagnostics.normalResiduals === false ? 'Desviación de normalidad' : 'Consistente con normalidad',
      ],
      [
        'Multicolinealidad',
        `VIF Máximo = ${activeModel.diagnostics.maxVif !== null ? (Number.isFinite(activeModel.diagnostics.maxVif) ? activeModel.diagnostics.maxVif.toFixed(2) : 'Inf') : 'N/A (Simple)'}`,
        activeModel.diagnostics.multicollinearityLevel === 'severe'
          ? 'Severa (VIF >= 10)'
          : activeModel.diagnostics.multicollinearityLevel === 'moderate'
            ? 'Moderada (VIF >= 5)'
            : 'Controlada',
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  // Section 5: Gráficos Diagnósticos y Resultados
  doc.addPage();
  yPos = 18;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Visualización de Desempeño y Residuos', 14, yPos);
  yPos += 6;

  const chart1 = renderActualVsPredictedCanvas(activeModel);
  const chart2 = renderResidualsCanvas(activeModel);
  if (chart1) {
    doc.addImage(chart1, 'PNG', 14, yPos, 180, 98);
    yPos += 104;
  }
  if (chart2) {
    doc.addImage(chart2, 'PNG', 14, yPos, 180, 98);
  }

  // Section 6: Interpretación Experta, Causalidad y Recomendaciones
  doc.addPage();
  yPos = 18;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('6. Interpretación Experta y Recomendaciones de Negocio', 14, yPos);
  yPos += 7;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const addParagraph = (title: string, text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(title, 14, yPos);
    yPos += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(text, 182);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 4.4 + 4;
  };

  addParagraph('Evaluación de Ajuste y Generalización:', expert.fitAssessment);
  addParagraph('Correlación vs. Causalidad (Advertencia Metodológica):', expert.causalityWarning);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Recomendaciones Accionables:', 14, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  expert.businessRecommendations.forEach((rec, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, 178);
    doc.text(lines, 16, yPos);
    yPos += lines.length * 4.4 + 2;
  });

  if (predictions.length > 0) {
    yPos += 4;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('7. Registro de Predicciones Realizadas', 14, yPos);
    yPos += 3;
    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Modelo', 'Estimación Puntual', 'IC 95% Media', 'IP 95% Observación']],
      body: predictions.slice(0, 15).map((p, idx) => [
        String(idx + 1),
        p.modelName,
        p.predictedValue.toFixed(3),
        p.ciLower95 !== null && p.ciUpper95 !== null
          ? `[${p.ciLower95.toFixed(2)}, ${p.ciUpper95.toFixed(2)}]`
          : 'N/A',
        p.piLower95 !== null && p.piUpper95 !== null
          ? `[${p.piLower95.toFixed(2)}, ${p.piUpper95.toFixed(2)}]`
          : 'N/A',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    });
  }

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  doc.save(`EstimaBI_Informe_${baseName}.pdf`);
}
