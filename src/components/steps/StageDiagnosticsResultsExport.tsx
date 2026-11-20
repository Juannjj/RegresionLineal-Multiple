import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  Download,
  FileText,
  TableProperties,
} from 'lucide-react';
import {
  BusinessSector,
  DatasetState,
  DescriptiveStat,
  PredictionRecord,
  PreparedSplitData,
  RegressionModelResult,
} from '../../types/analytics';
import { generateExpertInterpretation } from '../../utils/expertInterpreter';
import { predictSingleObservation } from '../../utils/mathStats';
import {
  exportExecutivePdfReport,
  exportResultsToExcel,
} from '../../utils/exportReports';
import {
  ActualVsPredictedChart,
  FeatureContributionChart,
  HistogramChart,
  NormalQQChart,
  ResidualsVsFittedChart,
} from '../charts/StatCharts';
import { KpiCard, NoticeBanner, StatGlossaryHint } from '../ui/StatInfo';

// ============================================================================
// PASOS 14 & 15: VALIDACIÓN DE SUPUESTOS Y COMPARACIÓN DE MODELOS
// ============================================================================

export const StepDiagnosticsCompareView: React.FC<{
  models: RegressionModelResult[];
  activeModel: RegressionModelResult;
  onSelectActiveModel: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
}> = ({ models, activeModel, onSelectActiveModel, onPrev, onNext }) => {
  const d = activeModel.diagnostics;

  const modelStrengthsLimitations = (m: RegressionModelResult) => {
    const strengths: string[] = [];
    const limits: string[] = [];

    if (m.trainMetrics.adjR2 >= 0.7) strengths.push('Alto R² ajustado');
    if (m.testMetrics && m.trainMetrics.r2 - m.testMetrics.r2 <= 0.1) {
      strengths.push('Buena generalización en prueba');
    }
    if (m.coefficients.every((c) => c.pValue < 0.05)) {
      strengths.push('Todos sus predictores son significativos');
    }
    if (m.diagnostics.multicollinearityLevel === 'none' || m.diagnostics.multicollinearityLevel === 'na') {
      strengths.push('Sin multicolinealidad');
    }

    if (m.diagnostics.multicollinearityLevel === 'severe') {
      limits.push('Colinealidad alta (VIF >= 10)');
    }
    if (m.testMetrics && m.trainMetrics.r2 - m.testMetrics.r2 > 0.12) {
      limits.push('Brecha Train-Test (posible sobreajuste)');
    }
    const nonSig = m.coefficients.filter((c) => c.pValue >= 0.05).length;
    if (nonSig > 0) limits.push(`${nonSig} predictor(es) con p ≥ 0.05`);
    if (m.kind === 'simple' && m.trainMetrics.r2 < 0.5) {
      limits.push('Solo captura una variable (posible sesgo omitido)');
    }

    return {
      strength: strengths.join(', ') || 'Modelo base interpretable',
      limit: limits.join(', ') || 'Sin limitaciones críticas detectadas',
    };
  };

  return (
    <div className="space-y-8">
      {/* Paso 14: Validación de supuestos */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-400">
              Paso 14 · Validación de supuestos estadísticos
            </p>
            <h2 className="text-xl font-bold text-white">
              Diagnóstico del modelo: {activeModel.name}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0C121E] border border-slate-800 p-1 rounded-lg">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectActiveModel(m.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  m.id === activeModel.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Linealidad"
            value={d.linearityOk ? 'Cumple' : 'Alerta'}
            subtext={`Corr(res, Ŷ) = ${d.linearityCorrResidualFitted.toFixed(3)}`}
            hint="Los residuos deben distribuirse aleatoriamente sin patrón curvo respecto a los valores ajustados."
            tone={d.linearityOk ? 'positive' : 'warning'}
          />
          <KpiCard
            label="Durbin-Watson"
            value={d.durbinWatson.toFixed(3)}
            subtext={
              d.durbinWatsonStatus === 'ok'
                ? 'Independencia aceptable (~2)'
                : d.durbinWatsonStatus === 'positive_autocorr'
                  ? 'Autocorrelación positiva (<1.5)'
                  : 'Autocorrelación negativa (>2.5)'
            }
            hint="Evalúa independencia de errores. Valores cercanos a 2.0 indican ausencia de autocorrelación."
            tone={d.durbinWatsonStatus === 'ok' ? 'positive' : 'warning'}
          />
          <KpiCard
            label="Homocedasticidad (BP)"
            value={
              d.breuschPaganPValue !== null
                ? `p = ${d.breuschPaganPValue.toFixed(4)}`
                : 'N/A'
            }
            subtext={
              d.homoscedastic === null
                ? 'Requiere >= 2 parámetros'
                : d.homoscedastic
                  ? 'Varianza constante (p ≥ 0.05)'
                  : 'Heterocedasticidad (p < 0.05)'
            }
            hint="Prueba de Breusch-Pagan: p ≥ 0.05 respalda varianza homogénea de errores."
            tone={d.homoscedastic === false ? 'warning' : 'positive'}
          />
          <KpiCard
            label="Normalidad (Jarque-Bera)"
            value={
              d.jarqueBeraPValue !== null
                ? `p = ${d.jarqueBeraPValue.toFixed(4)}`
                : 'N/A'
            }
            subtext={
              d.normalResiduals === null
                ? 'Muestra muy pequeña'
                : d.normalResiduals
                  ? 'Consistente con normal'
                  : `Asimetría ${d.residualSkewness.toFixed(2)}`
            }
            hint="Evalúa si los residuos siguen distribución normal mediante asimetría y curtosis."
            tone={d.normalResiduals === false ? 'warning' : 'positive'}
          />
          <KpiCard
            label="Multicolinealidad (VIF máx)"
            value={
              d.maxVif !== null
                ? Number.isFinite(d.maxVif)
                  ? d.maxVif.toFixed(2)
                  : '∞'
                : 'N/A'
            }
            subtext={
              d.multicollinearityLevel === 'na'
                ? 'Solo 1 predictor (Simple)'
                : d.multicollinearityLevel === 'severe'
                  ? 'Severa (VIF ≥ 10)'
                  : d.multicollinearityLevel === 'moderate'
                    ? 'Moderada (VIF ≥ 5)'
                    : 'Controlada (VIF < 5)'
            }
            hint="Factor de Inflación de Varianza: VIF < 5 indica independencia entre predictores."
            tone={
              d.multicollinearityLevel === 'severe'
                ? 'danger'
                : d.multicollinearityLevel === 'moderate'
                  ? 'warning'
                  : 'positive'
            }
          />
        </div>

        {/* Gráficos diagnósticos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-semibold text-white">
              Residuos vs. Valores Ajustados (Linealidad y Homocedasticidad)
            </h3>
            <ResidualsVsFittedChart model={activeModel} />
          </div>
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-semibold text-white">
              Gráfico Q-Q Normal de Residuos
            </h3>
            <NormalQQChart residuals={activeModel.trainResiduals} />
          </div>
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-semibold text-white">
              Distribución de Residuos (Train)
            </h3>
            <HistogramChart
              values={activeModel.trainResiduals}
              label="Residuos"
              binsCount={10}
              showNormalCurve
            />
          </div>
        </div>

        {/* Tabla VIF individual si hay múltiples variables */}
        {activeModel.coefficients.length > 1 && (
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="text-xs font-semibold text-white">
              Factor de Inflación de la Varianza (VIF) por variable predictora
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {activeModel.coefficients.map((c) => {
                const vif = c.vif;
                const status =
                  vif === null
                    ? 'N/A'
                    : !Number.isFinite(vif) || vif >= 10
                      ? 'Crítico'
                      : vif >= 5
                        ? 'Moderado'
                        : 'Óptimo';
                return (
                  <div
                    key={c.name}
                    className="flex items-center justify-between border border-slate-800 rounded px-3 py-2 bg-[#080C15]"
                  >
                    <span className="font-medium text-slate-200 truncate max-w-[60%]" title={c.name}>
                      {c.name}
                    </span>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        status === 'Crítico'
                          ? 'text-rose-400'
                          : status === 'Moderado'
                            ? 'text-amber-400'
                            : 'text-blue-400'
                      }`}
                    >
                      {vif !== null ? (Number.isFinite(vif) ? vif.toFixed(2) : '∞') : 'N/A'} · {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Paso 15: Comparación de modelos */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 15 · Comparación de modelos</p>
          <h3 className="text-lg font-semibold text-white">
            Evaluación comparativa en Entrenamiento y Prueba (20%)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare múltiples especificaciones sin recargar datos. Menor AIC, BIC y RMSE de prueba indican mejor equilibrio entre precisión y simplicidad.
          </p>
        </div>

        <div className="bg-[#0C121E] border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#070B12] text-slate-200 border-b border-slate-800">
                  <th className="py-2.5 px-3 text-left font-medium">Modelo</th>
                  <th className="py-2.5 px-3 text-right font-medium">Vars</th>
                  <th className="py-2.5 px-3 text-right font-medium">R² Aj. Train</th>
                  <th className="py-2.5 px-3 text-right font-medium">AIC</th>
                  <th className="py-2.5 px-3 text-right font-medium">BIC</th>
                  <th className="py-2.5 px-3 text-right font-medium">RMSE Train</th>
                  <th className="py-2.5 px-3 text-right font-medium">RMSE Test</th>
                  <th className="py-2.5 px-3 text-right font-medium">MAE Test</th>
                  <th className="py-2.5 px-3 text-left font-medium">Fortalezas / Limitaciones</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => {
                  const isAct = m.id === activeModel.id;
                  const evalSummary = modelStrengthsLimitations(m);
                  return (
                    <tr
                      key={m.id}
                      onClick={() => onSelectActiveModel(m.id)}
                      className={`border-b border-slate-800/70 cursor-pointer transition-colors ${
                        isAct ? 'bg-blue-950/40' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
                        {m.name} {isAct && <span className="text-blue-400">(Activo)</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {m.coefficients.length}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-100">
                        {(m.trainMetrics.adjR2 * 100).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {m.trainMetrics.aic.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {m.trainMetrics.bic.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {m.trainMetrics.rmse.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-blue-400">
                        {m.testMetrics ? m.testMetrics.rmse.toFixed(3) : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {m.testMetrics ? m.testMetrics.mae.toFixed(3) : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[260px]">
                        <div className="text-blue-300">+ {evalSummary.strength}</div>
                        <div className="text-slate-400">− {evalSummary.limit}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
        >
          Atrás: Modelos y Selección
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          Continuar a Dashboard y Predicciones <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// PASOS 17 & 18: DASHBOARD DE RESULTADOS Y PREDICCIONES
// ============================================================================

export const StepDashboardPredictionsView: React.FC<{
  dataset: DatasetState;
  models: RegressionModelResult[];
  activeModel: RegressionModelResult;
  onSelectActiveModel: (id: string) => void;
  descriptiveStats: DescriptiveStat[];
  predictions: PredictionRecord[];
  onAddPrediction: (p: PredictionRecord) => void;
  onPrev: () => void;
  onNext: () => void;
}> = ({
  dataset,
  models,
  activeModel,
  onSelectActiveModel,
  descriptiveStats,
  predictions,
  onAddPrediction,
  onPrev,
  onNext,
}) => {
  const [inputs, setInputs] = useState<Record<string, string | number>>({});

  useEffect(() => {
    const defaults: Record<string, string | number> = {};
    for (const srcCol of activeModel.sourceColumns) {
      const oh = activeModel.oneHotMappings.find((m) => m.sourceCol === srcCol);
      if (oh) {
        defaults[srcCol] = oh.referenceCategory;
      } else {
        const stat = descriptiveStats.find((d) => d.column === srcCol);
        defaults[srcCol] = stat ? Number(stat.median.toFixed(2)) : 0;
      }
    }
    setInputs(defaults);
  }, [activeModel.id, activeModel.sourceColumns, activeModel.oneHotMappings, descriptiveStats]);

  const handlePredict = (e: React.FormEvent) => {
    e.preventDefault();
    const res = predictSingleObservation(activeModel, inputs);
    onAddPrediction({
      id: `pred-${Date.now()}`,
      inputs: { ...inputs },
      predictedValue: res.predictedValue,
      ciLower95: res.ciLower95,
      ciUpper95: res.ciUpper95,
      piLower95: res.piLower95,
      piUpper95: res.piUpper95,
      modelName: activeModel.name,
      createdAt: new Date().toLocaleTimeString('es-ES'),
    });
  };

  const latestPred = predictions[0] ?? null;

  return (
    <div className="space-y-8">
      {/* Paso 18: Dashboard de Resultados */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-400">
              Paso 18 · Visualización de resultados y Dashboard BI
            </p>
            <h2 className="text-xl font-bold text-white">
              Desempeño del modelo: {activeModel.name}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0C121E] border border-slate-800 p-1 rounded-lg">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectActiveModel(m.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  m.id === activeModel.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="R² en Prueba (20%)"
            value={
              activeModel.testMetrics
                ? `${(activeModel.testMetrics.r2 * 100).toFixed(2)}%`
                : 'N/A'
            }
            subtext={`R² Aj. Train: ${(activeModel.trainMetrics.adjR2 * 100).toFixed(2)}%`}
            tone={
              activeModel.testMetrics && activeModel.testMetrics.r2 >= 0.6
                ? 'positive'
                : 'neutral'
            }
          />
          <KpiCard
            label="RMSE en Prueba"
            value={
              activeModel.testMetrics ? activeModel.testMetrics.rmse.toFixed(3) : 'N/A'
            }
            subtext={`RMSE Train: ${activeModel.trainMetrics.rmse.toFixed(3)}`}
            hint="Raíz del error cuadrático medio: penaliza con mayor fuerza los errores grandes."
          />
          <KpiCard
            label="MAE en Prueba"
            value={
              activeModel.testMetrics ? activeModel.testMetrics.mae.toFixed(3) : 'N/A'
            }
            subtext={
              activeModel.testMetrics?.mape !== null && activeModel.testMetrics?.mape !== undefined
                ? `MAPE Test: ${activeModel.testMetrics.mape.toFixed(1)}%`
                : 'Error absoluto medio'
            }
          />
          <KpiCard
            label="Criterios AIC / BIC"
            value={`${activeModel.trainMetrics.aic.toFixed(0)} / ${activeModel.trainMetrics.bic.toFixed(0)}`}
            subtext={`${activeModel.coefficients.length} términos predictores`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Valores Reales vs. Valores Estimados ({activeModel.targetColumn})
            </h3>
            <ActualVsPredictedChart model={activeModel} />
          </div>

          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between text-slate-200">
              <h3 className="text-sm font-semibold text-white">
                Contribución relativa de variables (β estandarizado)
              </h3>
              <StatGlossaryHint
                term="β estandarizado"
                explanation="Permite comparar la importancia relativa de variables medidas en distintas unidades: indica cuántas desviaciones estándar cambia Y por cada desviación estándar de X."
              />
            </div>
            <FeatureContributionChart model={activeModel} />
          </div>
        </div>
      </section>

      {/* Paso 17: Simulador de Predicciones */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 17 · Predicciones</p>
          <h3 className="text-lg font-semibold text-white">
            Simulador interactivo con intervalos de predicción al 95%
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingrese nuevos valores dentro del rango observado en {dataset.fileName} para estimar "{activeModel.targetColumn}".
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handlePredict}
            className="lg:col-span-2 bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeModel.sourceColumns.map((col) => {
                const oh = activeModel.oneHotMappings.find((m) => m.sourceCol === col);
                const stat = descriptiveStats.find((d) => d.column === col);
                if (oh) {
                  const allCats = [oh.referenceCategory, ...oh.categories];
                  return (
                    <div key={col} className="space-y-1">
                      <label className="text-xs font-semibold text-slate-200 block">
                        {col}
                      </label>
                      <select
                        value={String(inputs[col] ?? oh.referenceCategory)}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [col]: e.target.value }))
                        }
                        className="w-full border border-slate-700 rounded-lg px-3 py-2 text-xs bg-[#070B12] text-slate-100"
                      >
                        {allCats.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return (
                  <div key={col} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-200">{col}</label>
                      {stat && (
                        <span className="text-[11px] font-mono tabular-nums text-slate-400">
                          [{stat.min.toFixed(1)} – {stat.max.toFixed(1)}]
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="any"
                      required
                      value={inputs[col] ?? ''}
                      onChange={(e) =>
                        setInputs((prev) => ({
                          ...prev,
                          [col]: e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      className="w-full border border-slate-700 bg-[#070B12] text-slate-100 rounded-lg px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <Calculator className="w-3.5 h-3.5" /> Calcular Predicción
              </button>
            </div>
          </form>

          <div className="bg-[#090E1A] border border-blue-800/60 text-white rounded-lg p-5 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-blue-400 font-medium">
                Resultado estimado ({activeModel.targetColumn})
              </div>
              {latestPred ? (
                <>
                  <div className="text-3xl font-bold font-mono tabular-nums tracking-tight pt-1">
                    {latestPred.predictedValue.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-slate-300 pt-2 space-y-1.5 font-mono tabular-nums">
                    <div>
                      <span className="text-slate-400">IP 95% (Nueva obs.):</span>{' '}
                      {latestPred.piLower95 !== null && latestPred.piUpper95 !== null
                        ? `[${latestPred.piLower95.toFixed(2)}, ${latestPred.piUpper95.toFixed(2)}]`
                        : 'N/A'}
                    </div>
                    <div>
                      <span className="text-slate-400">IC 95% (Media):</span>{' '}
                      {latestPred.ciLower95 !== null && latestPred.ciUpper95 !== null
                        ? `[${latestPred.ciLower95.toFixed(2)}, ${latestPred.ciUpper95.toFixed(2)}]`
                        : 'N/A'}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-300 pt-2 leading-relaxed">
                  Ajuste los valores del escenario y pulse "Calcular Predicción" para obtener el valor estimado y su intervalo de incertidumbre del 95%.
                </p>
              )}
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-3">
              El Intervalo de Predicción (IP 95%) contempla tanto la incertidumbre del modelo como la variabilidad individual futura.
            </div>
          </div>
        </div>

        {predictions.length > 0 && (
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 bg-[#080C15] text-xs font-semibold text-slate-200">
              Historial de predicciones de la sesión ({predictions.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3 text-left font-medium">Hora</th>
                    <th className="py-2 px-3 text-left font-medium">Modelo</th>
                    <th className="py-2 px-3 text-left font-medium">Entradas</th>
                    <th className="py-2 px-3 text-right font-medium">Estimación</th>
                    <th className="py-2 px-3 text-right font-medium">IP 95%</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/70">
                      <td className="py-2 px-3 font-mono tabular-nums text-slate-400">{p.createdAt}</td>
                      <td className="py-2 px-3 font-medium text-slate-200">{p.modelName}</td>
                      <td className="py-2 px-3 text-slate-400 max-w-[280px] truncate">
                        {Object.entries(p.inputs)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(', ')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-blue-400">
                        {p.predictedValue.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-400">
                        {p.piLower95 !== null && p.piUpper95 !== null
                          ? `[${p.piLower95.toFixed(2)}, ${p.piUpper95.toFixed(2)}]`
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
        >
          Atrás: Supuestos y Comparación
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          Continuar a Interpretación y Reportes <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// PASOS 19 & 20: INTERPRETACIÓN EXPERTA Y GENERACIÓN DE INFORMES
// ============================================================================

export const StepInterpretationExportView: React.FC<{
  dataset: DatasetState;
  sector: BusinessSector;
  descriptiveStats: DescriptiveStat[];
  correlationMatrix: { headers: string[]; values: (number | null)[][] };
  splitData: PreparedSplitData;
  models: RegressionModelResult[];
  activeModel: RegressionModelResult;
  onSelectActiveModel: (id: string) => void;
  predictions: PredictionRecord[];
  onPrev: () => void;
}> = ({
  dataset,
  sector,
  descriptiveStats,
  correlationMatrix,
  splitData,
  models,
  activeModel,
  onSelectActiveModel,
  predictions,
  onPrev,
}) => {
  const expert = generateExpertInterpretation(activeModel, sector);

  const handleDownloadPdf = () => {
    exportExecutivePdfReport({
      dataset,
      sector,
      descriptiveStats,
      splitData,
      models,
      activeModel,
      predictions,
    });
  };

  const handleDownloadExcel = () => {
    exportResultsToExcel({
      dataset,
      descriptiveStats,
      correlationMatrix,
      models,
      activeModel,
      predictions,
      sector,
    });
  };

  return (
    <div className="space-y-8">
      {/* Paso 19: Interpretación y recomendaciones */}
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-400">
              Paso 19 · Interpretación analítica y toma de decisiones
            </p>
            <h2 className="text-xl font-bold text-white">
              Conclusiones del experto y recomendaciones de negocio
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0C121E] border border-slate-800 p-1 rounded-lg">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectActiveModel(m.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  m.id === activeModel.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-6 space-y-5">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-white">Resumen ejecutivo del ajuste</h3>
            <p className="text-sm text-slate-200 leading-relaxed">{expert.executiveSummary}</p>
            <p className="text-xs text-slate-400 leading-relaxed pt-1">{expert.fitAssessment}</p>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-2.5">
            <h4 className="text-sm font-semibold text-white">
              Efecto estadístico de las variables independientes
            </h4>
            <div className="space-y-2">
              {expert.variableImpacts.map((vi) => (
                <div key={vi.name} className="text-xs leading-relaxed text-slate-300">
                  <strong className="text-white">{vi.name}:</strong> {vi.interpretation}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-2">
            <h4 className="text-sm font-semibold text-white">
              Limitaciones estadísticas y validación de supuestos
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
              {expert.assumptionsAndRisks.map((risk, idx) => (
                <li key={idx} className="leading-relaxed">{risk}</li>
              ))}
            </ul>
          </div>

          <NoticeBanner variant="warning" title="Diferenciación estricta: Correlación vs. Causalidad">
            {expert.causalityWarning}
          </NoticeBanner>

          <div className="border-t border-slate-800 pt-4 space-y-2">
            <h4 className="text-sm font-semibold text-blue-400">
              Recomendaciones accionables para decisiones de negocio
            </h4>
            <ol className="space-y-1.5 text-xs text-slate-300 list-decimal pl-4">
              {expert.businessRecommendations.map((rec, idx) => (
                <li key={idx} className="leading-relaxed">{rec}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Paso 20: Generación de informes */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 20 · Generación de informes</p>
          <h3 className="text-lg font-semibold text-white">
            Exportar informe ejecutivo en PDF y resultados en Excel
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  Informe Ejecutivo Profesional (PDF)
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Incluye resumen ejecutivo, metodología sin fuga de datos, estadísticas descriptivas, ecuaciones e intervalos de confianza, comparación de modelos, pruebas de supuestos, gráficos diagnósticos y conclusiones de negocio.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" /> Descargar Informe PDF
            </button>
          </div>

          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-blue-400 flex items-center justify-center shrink-0">
                <TableProperties className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  Libro de Resultados y Predicciones (Excel .xlsx)
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Descarga un libro estructurado con hojas separadas: Resumen de Modelos, Coeficientes e IC 95%, Análisis Descriptivo, Matriz de Correlación, Valores Reales vs. Estimados y Predicciones simuladas.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" /> Descargar Libro Excel (.xlsx)
            </button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
        >
          Atrás: Dashboard y Predicciones
        </button>
      </div>
    </div>
  );
};
