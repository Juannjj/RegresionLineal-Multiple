import React from 'react';
import { ArrowRight, Play, ShieldCheck } from 'lucide-react';
import {
  DatasetState,
  FeaturePrepConfig,
  NumericTransform,
  PreparedSplitData,
  RegressionChoice,
  RegressionModelResult,
  ScalingMethod,
  SplitMethod,
  VariableSelectionSummary,
} from '../../types/analytics';
import { KpiCard, NoticeBanner, StatGlossaryHint } from '../ui/StatInfo';

// ============================================================================
// PASOS 10, 11 & 12: PREPARACIÓN, TIPO DE REGRESIÓN Y DIVISIÓN TRAIN/TEST
// ============================================================================

interface PrepSplitProps {
  dataset: DatasetState;
  targetColumn: string;
  featureConfigs: FeaturePrepConfig[];
  onUpdateFeatureConfig: (col: string, patch: Partial<FeaturePrepConfig>) => void;
  scalingMethod: ScalingMethod;
  onChangeScalingMethod: (s: ScalingMethod) => void;
  regressionChoice: RegressionChoice;
  onChangeRegressionChoice: (c: RegressionChoice) => void;
  compareSimpleAndMultiple: boolean;
  onToggleCompareSimpleAndMultiple: (v: boolean) => void;
  simplePredictorColumn: string;
  onChangeSimplePredictorColumn: (col: string) => void;
  splitMethod: SplitMethod;
  onChangeSplitMethod: (m: SplitMethod) => void;
  dateColumn: string | null;
  onChangeDateColumn: (col: string | null) => void;
  seed: number;
  onChangeSeed: (s: number) => void;
  splitData: PreparedSplitData | null;
  prepError: string | null;
  onBuildModels: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const StepPrepSplitView: React.FC<PrepSplitProps> = ({
  dataset,
  targetColumn,
  featureConfigs,
  onUpdateFeatureConfig,
  scalingMethod,
  onChangeScalingMethod,
  regressionChoice,
  onChangeRegressionChoice,
  compareSimpleAndMultiple,
  onToggleCompareSimpleAndMultiple,
  simplePredictorColumn,
  onChangeSimplePredictorColumn,
  splitMethod,
  onChangeSplitMethod,
  dateColumn,
  onChangeDateColumn,
  seed,
  onChangeSeed,
  splitData,
  prepError,
  onBuildModels,
  onPrev,
}) => {
  const dateCols = dataset.profiles.filter((p) => p.selectedType === 'date');
  const includedFeatures = featureConfigs.filter(
    (f) => f.included && f.column !== targetColumn
  );
  const recommendedType =
    includedFeatures.length <= 1 ? 'Regresión Lineal Simple' : 'Regresión Lineal Múltiple';

  const numericIncluded = includedFeatures.filter((fc) => {
    const p = dataset.profiles.find((pr) => pr.name === fc.column);
    return p?.selectedType === 'numeric';
  });

  return (
    <div className="space-y-8">
      {/* Paso 10: Preparación de datos */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 10 · Preparación de datos</p>
          <h2 className="text-xl font-bold text-white">
            Selección, codificación categórica y escalamiento
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Defina qué predictores participan, si las variables categóricas se codifican como dummies (One-Hot con categoría de referencia) y si requiere transformar o escalar variables numéricas.
          </p>
        </div>

        <div className="bg-[#0C121E] border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#070B12] text-slate-200 border-b border-slate-800">
                  <th className="py-2.5 px-3 text-center font-medium w-16">Incluir</th>
                  <th className="py-2.5 px-3 text-left font-medium">Variable predictora (X)</th>
                  <th className="py-2.5 px-3 text-left font-medium">Tipo</th>
                  <th className="py-2.5 px-3 text-left font-medium">Codificación / Transformación</th>
                </tr>
              </thead>
              <tbody>
                {featureConfigs
                  .filter((fc) => fc.column !== targetColumn)
                  .map((fc) => {
                    const prof = dataset.profiles.find((p) => p.name === fc.column);
                    if (!prof || (prof.selectedType !== 'numeric' && prof.selectedType !== 'categorical')) {
                      return null;
                    }
                    return (
                      <tr key={fc.column} className="border-b border-slate-800/70 hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={fc.included}
                            onChange={(e) =>
                              onUpdateFeatureConfig(fc.column, { included: e.target.checked })
                            }
                            className="w-4 h-4 accent-blue-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">{fc.column}</td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {prof.selectedType === 'numeric' ? 'Numérica' : `Categórica (${prof.uniqueCount} niveles)`}
                        </td>
                        <td className="py-2.5 px-3">
                          {prof.selectedType === 'numeric' ? (
                            <select
                              value={fc.transform}
                              disabled={!fc.included}
                              onChange={(e) =>
                                onUpdateFeatureConfig(fc.column, {
                                  transform: e.target.value as NumericTransform,
                                })
                              }
                              className="border border-slate-700 rounded px-2 py-1 text-xs bg-[#070B12] text-slate-100 disabled:opacity-40"
                            >
                              <option value="none">Escala original (Lineal)</option>
                              <option value="log1p">Transformación Log(1 + x) para asimetría positiva</option>
                            </select>
                          ) : (
                            <select
                              value={fc.encoding}
                              disabled={!fc.included}
                              onChange={(e) =>
                                onUpdateFeatureConfig(fc.column, {
                                  encoding: e.target.value as 'onehot' | 'ignore',
                                })
                              }
                              className="border border-slate-700 rounded px-2 py-1 text-xs bg-[#070B12] text-slate-100 disabled:opacity-40"
                            >
                              <option value="onehot">One-Hot Encoding (k-1 dummies sin trampa)</option>
                              <option value="ignore">Excluir de codificación</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-white">
              Escalamiento de variables numéricas (aprendido solo en Train)
            </div>
            <p className="text-xs text-slate-400">
              Para interpretar coeficientes en unidades originales del negocio, mantenga "Sin escalamiento". Para comparar magnitudes o estabilizar escalas muy dispares, use Estandarización Z-score.
            </p>
          </div>
          <select
            value={scalingMethod}
            onChange={(e) => onChangeScalingMethod(e.target.value as ScalingMethod)}
            className="border border-slate-700 rounded-lg px-3 py-2 text-xs bg-[#070B12] text-slate-100 font-medium shrink-0"
          >
            <option value="none">Sin escalamiento (Unidades originales)</option>
            <option value="standard">Estandarización Z-Score (Media 0, DE 1)</option>
            <option value="minmax">Normalización Min-Max (0 a 1)</option>
          </select>
        </div>
      </section>

      {/* Paso 11: Selección del tipo de regresión */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 11 · Selección del tipo de regresión</p>
          <h3 className="text-lg font-semibold text-white">
            Enfoque Simple vs. Múltiple
          </h3>
        </div>

        <NoticeBanner variant="info" title={`Recomendación automática: ${recommendedType}`}>
          Con <strong className="text-white">{includedFeatures.length}</strong> variable(s) independiente(s) seleccionada(s), el método recomendado es <strong className="text-white">{recommendedType}</strong>. La regresión simple mide el efecto marginal bruto de una sola variable X, mientras que la regresión múltiple aísla el efecto parcial de cada predictor controlando por los demás (ceteris paribus) y reduce el sesgo por variables omitidas.
        </NoticeBanner>

        <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { id: 'auto' as const, label: `Automático (${recommendedType})` },
              { id: 'simple' as const, label: 'Forzar Regresión Simple' },
              { id: 'multiple' as const, label: 'Regresión Múltiple' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeRegressionChoice(opt.id)}
                className={`py-2.5 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                  regressionChoice === opt.id
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-[#080C15] text-slate-300 border-slate-800 hover:bg-slate-800/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {includedFeatures.length >= 2 && (
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compareSimpleAndMultiple}
                  onChange={(e) => onToggleCompareSimpleAndMultiple(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span>
                  Ajustar y comparar también un modelo de Regresión Lineal Simple de referencia
                </span>
              </label>

              {(compareSimpleAndMultiple || regressionChoice === 'simple') && numericIncluded.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Variable para Regresión Simple:</span>
                  <select
                    value={simplePredictorColumn}
                    onChange={(e) => onChangeSimplePredictorColumn(e.target.value)}
                    className="border border-slate-700 rounded px-2.5 py-1.5 text-xs bg-[#070B12] text-slate-100"
                  >
                    {numericIncluded.map((fc) => (
                      <option key={fc.column} value={fc.column}>
                        {fc.column}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Paso 12: División de datos */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 12 · División de datos (80% / 20%)</p>
          <h3 className="text-lg font-semibold text-white">
            Partición Entrenamiento / Prueba sin fuga de información
          </h3>
        </div>

        <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-200 block">
              Estrategia de partición:
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="split-method"
                  checked={splitMethod === 'random'}
                  onChange={() => onChangeSplitMethod('random')}
                  className="mt-0.5 accent-blue-500"
                />
                <span>
                  <strong className="text-white">División aleatoria reproducible (80% Train / 20% Test):</strong> adecuada cuando las observaciones son independientes entre sí.
                </span>
              </label>
              <label
                className={`flex items-start gap-2.5 text-xs ${
                  dateCols.length > 0 ? 'text-slate-300 cursor-pointer' : 'text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="split-method"
                  disabled={dateCols.length === 0}
                  checked={splitMethod === 'chronological'}
                  onChange={() => onChangeSplitMethod('chronological')}
                  className="mt-0.5 accent-blue-500"
                />
                <span>
                  <strong className={dateCols.length > 0 ? 'text-white' : 'text-slate-600'}>
                    División cronológica (80% pasado / 20% futuro):
                  </strong>{' '}
                  {dateCols.length > 0
                    ? 'ordena por fecha y reserva el último 20% para prueba, evitando usar información futura.'
                    : 'no disponible (no hay columnas clasificadas como Fecha).'}
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            {splitMethod === 'random' ? (
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1">
                  Semilla aleatoria reproducible (Seed):
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => onChangeSeed(Number(e.target.value) || 42)}
                  className="w-40 border border-slate-700 bg-[#070B12] text-slate-100 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Garantiza exactamente la misma partición Train/Test en ejecuciones repetidas.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1">
                  Columna temporal para ordenamiento cronológico:
                </label>
                <select
                  value={dateColumn ?? dateCols[0]?.name ?? ''}
                  onChange={(e) => onChangeDateColumn(e.target.value)}
                  className="w-full border border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-[#070B12] text-slate-100"
                >
                  {dateCols.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-blue-200 bg-blue-950/40 border border-blue-800/60 rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Imputación, One-Hot Encoding y escalamiento se ajustan únicamente sobre el 80% de entrenamiento.
              </span>
            </div>
          </div>
        </div>

        {prepError && (
          <NoticeBanner variant="warning" title="No se pudo preparar la partición">
            {prepError}
          </NoticeBanner>
        )}

        {splitData && splitData.warnings.length > 0 && (
          <NoticeBanner variant="info" title="Avisos del preprocesamiento">
            <ul className="list-disc pl-4 space-y-0.5">
              {splitData.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </NoticeBanner>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onPrev}
            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Atrás: Correlaciones
          </button>
          <button
            type="button"
            onClick={onBuildModels}
            disabled={includedFeatures.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg transition-colors"
          >
            <Play className="w-3.5 h-3.5" /> Construir Modelos y Ejecutar Selección
          </button>
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// PASOS 13 & 16: CONSTRUCCIÓN DE MODELOS Y SELECCIÓN (STEPWISE / BEST SUBSETS)
// ============================================================================

interface ModelsViewProps {
  splitData: PreparedSplitData;
  models: RegressionModelResult[];
  activeModel: RegressionModelResult;
  onSelectActiveModel: (id: string) => void;
  selectionSummary: VariableSelectionSummary | null;
  onPrev: () => void;
  onNext: () => void;
}

export const StepModelsSelectionView: React.FC<ModelsViewProps> = ({
  splitData,
  models,
  activeModel,
  onSelectActiveModel,
  selectionSummary,
  onPrev,
  onNext,
}) => {
  const formatP = (p: number | null) => {
    if (p === null) return 'N/A';
    if (p < 0.0001) return '< 0.0001';
    return p.toFixed(4);
  };

  return (
    <div className="space-y-8">
      {/* Selector de modelo activo */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-400">
              Paso 13 · Construcción de modelos
            </p>
            <h2 className="text-xl font-bold text-white">
              Ecuación estimada, coeficientes e inferencia estadística
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Partición ejecutada: {splitData.xTrain.length} registros de entrenamiento y {splitData.xTest.length} de prueba ({splitData.splitMethodUsed === 'chronological' ? `corte cronológico por ${splitData.dateColumnUsed}` : 'corte aleatorio reproducible'}).
            </p>
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

        {/* Ecuación estimada */}
        <div className="bg-[#090E1A] border border-blue-800/60 text-white rounded-lg p-5 space-y-2">
          <div className="text-xs font-medium text-blue-400">
            Ecuación de regresión estimada ({activeModel.name})
          </div>
          <div className="font-mono text-sm leading-relaxed break-words text-slate-100">
            {activeModel.equationText}
          </div>
        </div>

        {activeModel.warnings.length > 0 && (
          <NoticeBanner variant="warning" title="Advertencias del ajuste">
            <ul className="list-disc pl-4 space-y-0.5">
              {activeModel.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </NoticeBanner>
        )}

        {/* KPIs principales del modelo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="R² (Entrenamiento)"
            value={`${(activeModel.trainMetrics.r2 * 100).toFixed(2)}%`}
            subtext={
              activeModel.testMetrics
                ? `R² Prueba: ${(activeModel.testMetrics.r2 * 100).toFixed(2)}%`
                : 'Sin evaluación en prueba'
            }
            hint="Proporción de la variabilidad de Y explicada por el modelo."
            tone={activeModel.trainMetrics.r2 >= 0.6 ? 'positive' : 'neutral'}
          />
          <KpiCard
            label="R² Ajustado"
            value={`${(activeModel.trainMetrics.adjR2 * 100).toFixed(2)}%`}
            subtext={`Grados de libertad residuales: ${activeModel.trainMetrics.dfResidual}`}
            hint="Penaliza la inclusión de variables que no aportan mejora real al ajuste."
          />
          <KpiCard
            label="Prueba F Global"
            value={
              activeModel.trainMetrics.fStat !== null
                ? activeModel.trainMetrics.fStat.toFixed(2)
                : 'N/A'
            }
            subtext={`Valor p global: ${formatP(activeModel.trainMetrics.fPValue)}`}
            hint="Evalúa si al menos una variable independiente aporta explicación conjunta significativa."
            tone={
              activeModel.trainMetrics.fPValue !== null && activeModel.trainMetrics.fPValue < 0.05
                ? 'positive'
                : 'warning'
            }
          />
          <KpiCard
            label="Error Estándar Residual"
            value={activeModel.trainMetrics.residualStdError.toFixed(3)}
            subtext={`RMSE Prueba: ${activeModel.testMetrics ? activeModel.testMetrics.rmse.toFixed(3) : 'N/A'}`}
            hint="Desviación típica de los errores de predicción en entrenamiento."
          />
        </div>

        {/* Tabla de coeficientes */}
        <div className="bg-[#0C121E] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-[#080C15] flex items-center justify-between text-slate-200">
            <span className="text-xs font-semibold">
              Tabla de coeficientes estimados e intervalos de confianza (95%)
            </span>
            <StatGlossaryHint
              term="Interpretación de p-valor"
              explanation="Si p < 0.05 existe evidencia estadística de que el coeficiente es distinto de cero manteniendo constantes los demás predictores."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#070B12] text-slate-200 border-b border-slate-800">
                  <th className="py-2.5 px-3 text-left font-medium">Variable / Término</th>
                  <th className="py-2.5 px-3 text-right font-medium">Coeficiente (β)</th>
                  <th className="py-2.5 px-3 text-right font-medium">Error Est.</th>
                  <th className="py-2.5 px-3 text-right font-medium">Estadístico t</th>
                  <th className="py-2.5 px-3 text-right font-medium">Valor p</th>
                  <th className="py-2.5 px-3 text-right font-medium">IC 95% Inferior</th>
                  <th className="py-2.5 px-3 text-right font-medium">IC 95% Superior</th>
                  <th className="py-2.5 px-3 text-center font-medium">Significancia</th>
                </tr>
              </thead>
              <tbody>
                {[activeModel.intercept, ...activeModel.coefficients].map((c, idx) => {
                  const sig = c.pValue < 0.05;
                  return (
                    <tr key={c.name} className={`border-b border-slate-800/70 ${idx === 0 ? 'bg-[#090E18]' : 'hover:bg-slate-800/40'}`}>
                      <td className="py-2.5 px-3 font-semibold text-white">{c.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-100">
                        {c.estimate.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">
                        {c.stdError.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {c.tStat.toFixed(3)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono tabular-nums font-semibold ${sig ? 'text-blue-400' : 'text-slate-500'}`}>
                        {formatP(c.pValue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">
                        {c.ciLower95.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">
                        {c.ciUpper95.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[11px] font-medium ${sig ? 'text-blue-400' : 'text-slate-500'}`}>
                          {c.pValue < 0.001 ? '*** (p<0.001)' : c.pValue < 0.01 ? '** (p<0.01)' : sig ? '* (p<0.05)' : 'No sig.'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Paso 16: Selección automática de variables (Stepwise & Best Subsets) */}
      {selectionSummary && (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-medium text-blue-400">
              Paso 16 · Selección automática de variables (solo sobre Entrenamiento)
            </p>
            <h3 className="text-lg font-semibold text-white">
              Métodos Stepwise (AIC) y Best Subsets
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifican combinaciones parsimoniosas de variables para evitar sobreajuste sin utilizar datos de prueba durante la selección.
            </p>
          </div>

          {selectionSummary.bestSubsetsResult?.truncatedWarning && (
            <NoticeBanner variant="info" title="Optimización combinatoria en Best Subsets">
              {selectionSummary.bestSubsetsResult.truncatedWarning}
            </NoticeBanner>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stepwise trace */}
            <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-3">
              <h4 className="text-sm font-semibold text-white">
                Selección Stepwise Bidireccional (Criterio AIC)
              </h4>
              {selectionSummary.stepwiseResult && selectionSummary.stepwiseResult.steps.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 text-left font-medium">Paso</th>
                        <th className="py-2 text-left font-medium">Acción</th>
                        <th className="py-2 text-left font-medium">Variable</th>
                        <th className="py-2 text-right font-medium">AIC</th>
                        <th className="py-2 text-right font-medium">R² Aj.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectionSummary.stepwiseResult.steps.map((st) => (
                        <tr key={st.step} className="border-b border-slate-800/70">
                          <td className="py-1.5 font-mono tabular-nums text-slate-400">{st.step}</td>
                          <td className={`py-1.5 font-medium ${st.action === 'add' ? 'text-blue-400' : 'text-amber-400'}`}>
                            {st.action === 'add' ? '+ Incorporar' : '- Retirar'}
                          </td>
                          <td className="py-1.5 font-medium text-slate-100">{st.feature}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-slate-300">{st.aic.toFixed(1)}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-slate-300">{(st.adjR2 * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  El modelo solo cuenta con una variable predictora o no requirió pasos iterativos.
                </p>
              )}
            </div>

            {/* Best Subsets ranking */}
            <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  Mejores Subconjuntos (Best Subsets)
                </h4>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {selectionSummary.bestSubsetsResult?.evaluatedCount ?? 0} combinaciones evaluadas
                </span>
              </div>
              {selectionSummary.bestSubsetsResult && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 text-left font-medium">k</th>
                        <th className="py-2 text-left font-medium">Variables incluidas</th>
                        <th className="py-2 text-right font-medium">R² Aj.</th>
                        <th className="py-2 text-right font-medium">BIC</th>
                        <th className="py-2 text-right font-medium">RMSE Test</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectionSummary.bestSubsetsResult.topCandidates.slice(0, 7).map((cand) => (
                        <tr key={cand.id} className="border-b border-slate-800/70">
                          <td className="py-1.5 font-mono tabular-nums text-slate-400">{cand.k}</td>
                          <td className="py-1.5 text-slate-200 max-w-[200px] truncate" title={cand.featureNames.join(', ')}>
                            {cand.featureNames.join(', ')}
                          </td>
                          <td className="py-1.5 text-right font-mono tabular-nums font-semibold text-blue-400">
                            {(cand.adjR2 * 100).toFixed(2)}%
                          </td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-slate-300">{cand.bic.toFixed(1)}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums text-slate-300">
                            {cand.testRmse !== null ? cand.testRmse.toFixed(2) : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
        >
          Atrás: Preparación y División
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          Continuar a Supuestos y Comparación <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
