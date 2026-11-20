import React, { useMemo, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import {
  BusinessSector,
  DatasetState,
  DescriptiveStat,
  MissingStrategy,
} from '../../types/analytics';
import { BUSINESS_SECTORS } from '../../utils/expertInterpreter';
import { parseFlexibleDate, parseFlexibleNumber } from '../../utils/dataParser';
import {
  BoxPlotChart,
  CorrelationHeatmap,
  HistogramChart,
  ScatterRegressionChart,
  TrendLineChart,
} from '../charts/StatCharts';
import { KpiCard, NoticeBanner, StatGlossaryHint } from '../ui/StatInfo';

// ============================================================================
// PASOS 5 & 6: CONTEXTO DE NEGOCIO Y CALIDAD DE DATOS
// ============================================================================

interface ContextQualityProps {
  dataset: DatasetState;
  sector: BusinessSector;
  onChangeSector: (s: BusinessSector) => void;
  missingStrategy: MissingStrategy;
  onChangeMissingStrategy: (m: MissingStrategy) => void;
  removeDuplicates: boolean;
  onToggleRemoveDuplicates: (v: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const StepContextQualityView: React.FC<ContextQualityProps> = ({
  dataset,
  sector,
  onChangeSector,
  missingStrategy,
  onChangeMissingStrategy,
  removeDuplicates,
  onToggleRemoveDuplicates,
  onPrev,
  onNext,
}) => {
  const suggestedLabel =
    BUSINESS_SECTORS.find((s) => s.id === dataset.suggestedSector)?.label ?? 'Empresarial General';

  return (
    <div className="space-y-8">
      {/* Paso 5: Contexto del negocio */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 05 · Contexto del negocio</p>
          <h2 className="text-xl font-bold text-white">
            Sector económico e interpretación contextualizada
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sugerencia automática según la estructura de columnas:{' '}
            <strong className="text-white">{suggestedLabel}</strong>. Puede confirmar o cambiar el sector para adaptar las conclusiones ejecutivas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {BUSINESS_SECTORS.map((s) => {
            const active = sector === s.id;
            const isSuggested = dataset.suggestedSector === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onChangeSector(s.id)}
                className={`text-left p-3.5 rounded-lg border transition-colors ${
                  active
                    ? 'bg-blue-600/20 text-white border-blue-500'
                    : 'bg-[#0C121E] text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                  <span>{s.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </div>
                <p className={`text-[11px] mt-1 leading-snug ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                  Enfoque: {s.focus}
                </p>
                {isSuggested && (
                  <div className="text-[10px] mt-1.5 font-medium text-blue-400">
                    Sugerido por variables detectadas
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Paso 6: Calidad de los datos */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 06 · Calidad de los datos</p>
          <h3 className="text-lg font-semibold text-white">
            Auditoría de faltantes, duplicados, atípicos e inconsistencias
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Celdas faltantes"
            value={String(dataset.quality.totalMissingCells)}
            subtext={`${dataset.quality.missingPctGlobal.toFixed(2)}% del total de celdas`}
            tone={dataset.quality.totalMissingCells > 0 ? 'warning' : 'positive'}
          />
          <KpiCard
            label="Registros duplicados"
            value={String(dataset.quality.duplicateRowCount)}
            subtext="Filas idénticas en todas las columnas"
            tone={dataset.quality.duplicateRowCount > 0 ? 'warning' : 'positive'}
          />
          <KpiCard
            label="Columnas con atípicos (IQR)"
            value={String(dataset.quality.columnsWithOutliers.length)}
            subtext="Criterio 1.5 × Rango Intercuartílico"
            tone={dataset.quality.columnsWithOutliers.length > 0 ? 'warning' : 'positive'}
          />
          <KpiCard
            label="Inconsistencias de formato"
            value={String(dataset.quality.inconsistencies.length)}
            subtext="Valores no válidos en columnas tipadas"
            tone={dataset.quality.inconsistencies.length > 0 ? 'danger' : 'positive'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Detalle de hallazgos */}
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-4">
            <h4 className="text-sm font-semibold text-white">Hallazgos por columna</h4>

            {dataset.quality.columnsWithMissing.length === 0 &&
            dataset.quality.columnsWithOutliers.length === 0 &&
            dataset.quality.inconsistencies.length === 0 ? (
              <p className="text-xs text-blue-400">
                No se detectaron valores faltantes, atípicos severos ni errores de formato en las columnas analizadas.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                {dataset.quality.columnsWithMissing.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-200 mb-1">Valores faltantes:</div>
                    <ul className="space-y-1 text-slate-400 font-mono tabular-nums">
                      {dataset.quality.columnsWithMissing.map((m) => (
                        <li key={m.column}>
                          • {m.column}: {m.count} ({m.pct.toFixed(1)}%)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dataset.quality.columnsWithOutliers.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-200 mb-1">
                      Valores atípicos (Regla 1.5 × RIC):
                    </div>
                    <ul className="space-y-1 text-slate-400 font-mono tabular-nums">
                      {dataset.quality.columnsWithOutliers.map((o) => (
                        <li key={o.column}>
                          • {o.column}: {o.count} registro(s) fuera de [{o.lower.toFixed(2)}, {o.upper.toFixed(2)}]
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dataset.quality.inconsistencies.length > 0 && (
                  <div>
                    <div className="font-semibold text-rose-400 mb-1">Inconsistencias de formato:</div>
                    <ul className="space-y-1 text-rose-300">
                      {dataset.quality.inconsistencies.map((inc) => (
                        <li key={inc.column}>
                          • {inc.column}: {inc.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Decisión de tratamiento sin fuga */}
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-4">
            <h4 className="text-sm font-semibold text-white">
              Tratamiento de datos faltantes y duplicados
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Para evitar fuga de información, cualquier imputación estadística (media, mediana o moda) se calculará exclusivamente con el conjunto de entrenamiento (80%) y luego se aplicará al conjunto de prueba (20%).
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200 block">
                Estrategia para valores faltantes en predictores (X):
              </label>
              <select
                value={missingStrategy}
                onChange={(e) => onChangeMissingStrategy(e.target.value as MissingStrategy)}
                className="w-full border border-slate-700 rounded-lg px-3 py-2 text-xs bg-[#070B12] text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="median">Imputar numéricos con Mediana (Train) y categóricos con Moda (Train) — Recomendado</option>
                <option value="mean">Imputar numéricos con Media (Train) y categóricos con Moda (Train)</option>
                <option value="mode">Imputar con Moda observada en entrenamiento</option>
                <option value="drop_rows">Eliminar filas con datos faltantes (Análisis completo)</option>
              </select>
            </div>

            {dataset.quality.duplicateRowCount > 0 && (
              <label className="flex items-center gap-2.5 text-xs text-slate-200 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeDuplicates}
                  onChange={(e) => onToggleRemoveDuplicates(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span>
                  Eliminar {dataset.quality.duplicateRowCount} registro(s) exactamente duplicado(s) antes de dividir Train/Test
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onPrev}
            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Atrás: Variables
          </button>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            Continuar a Estadística Descriptiva <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// PASO 7: ANÁLISIS DESCRIPTIVO
// ============================================================================

export const StepDescriptiveView: React.FC<{
  descriptiveStats: DescriptiveStat[];
  onPrev: () => void;
  onNext: () => void;
}> = ({ descriptiveStats, onPrev, onNext }) => {
  const [selectedCol, setSelectedCol] = useState<string>(
    descriptiveStats[0]?.column ?? ''
  );

  const activeStat =
    descriptiveStats.find((d) => d.column === selectedCol) ?? descriptiveStats[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 07 · Análisis descriptivo</p>
          <h2 className="text-xl font-bold text-white">
            Estadísticas individuales y tabla comparativa
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cálculos exactos sobre los valores válidos de cada variable numérica: tendencia central, dispersión, percentiles y forma de la distribución.
          </p>
        </div>
        {descriptiveStats.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Detalle individual:</span>
            <select
              value={activeStat?.column ?? ''}
              onChange={(e) => setSelectedCol(e.target.value)}
              className="border border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-[#070B12] text-slate-100 font-medium"
            >
              {descriptiveStats.map((d) => (
                <option key={d.column} value={d.column}>
                  {d.column}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!activeStat ? (
        <NoticeBanner variant="warning" title="Sin variables numéricas">
          No hay columnas numéricas disponibles para calcular estadísticas descriptivas.
        </NoticeBanner>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Media aritmética"
              value={activeStat.mean.toFixed(3)}
              subtext={`Mediana: ${activeStat.median.toFixed(3)}`}
              hint="Promedio muestral. Si difiere notablemente de la mediana, existe asimetría o atípicos."
            />
            <KpiCard
              label="Desviación estándar"
              value={activeStat.stdDev.toFixed(3)}
              subtext={`Varianza: ${activeStat.variance.toFixed(2)}`}
              hint="Dispersión típica alrededor de la media en las unidades originales de la variable."
            />
            <KpiCard
              label="Rango (Mín – Máx)"
              value={`${activeStat.min.toFixed(1)} – ${activeStat.max.toFixed(1)}`}
              subtext={`RIC (Q3 - Q1): ${activeStat.iqr.toFixed(2)}`}
            />
            <KpiCard
              label="Asimetría / Curtosis"
              value={`${activeStat.skewness.toFixed(2)} / ${activeStat.kurtosis.toFixed(2)}`}
              subtext={`Atípicos IQR: ${activeStat.outlierCount}`}
              hint="Asimetría cercana a 0 y curtosis cercana a 3 indican distribución simétrica tipo normal."
            />
          </div>

          <div className="bg-[#0C121E] border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-[#080C15] text-xs font-semibold text-slate-200">
              Tabla comparativa de todas las variables numéricas
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#070B12] text-slate-200 border-b border-slate-800">
                    <th className="py-2.5 px-3 text-left font-medium">Variable</th>
                    <th className="py-2.5 px-3 text-right font-medium">N</th>
                    <th className="py-2.5 px-3 text-right font-medium">Media</th>
                    <th className="py-2.5 px-3 text-right font-medium">Mediana</th>
                    <th className="py-2.5 px-3 text-right font-medium">Desv. Est.</th>
                    <th className="py-2.5 px-3 text-right font-medium">Varianza</th>
                    <th className="py-2.5 px-3 text-right font-medium">Mín</th>
                    <th className="py-2.5 px-3 text-right font-medium">P5</th>
                    <th className="py-2.5 px-3 text-right font-medium">Q1</th>
                    <th className="py-2.5 px-3 text-right font-medium">Q3</th>
                    <th className="py-2.5 px-3 text-right font-medium">P95</th>
                    <th className="py-2.5 px-3 text-right font-medium">Máx</th>
                  </tr>
                </thead>
                <tbody>
                  {descriptiveStats.map((d) => (
                    <tr
                      key={d.column}
                      onClick={() => setSelectedCol(d.column)}
                      className={`border-b border-slate-800/70 cursor-pointer transition-colors ${
                        d.column === activeStat.column ? 'bg-blue-950/40' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2 px-3 font-semibold text-white whitespace-nowrap">{d.column}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">{d.n}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-200">{d.mean.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-200">{d.median.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">{d.stdDev.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-400">{d.variance.toFixed(1)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">{d.min.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-400">{d.p5.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">{d.q1.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">{d.q3.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-400">{d.p95.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">{d.max.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
        >
          Atrás: Contexto y Calidad
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          Continuar a Análisis Gráfico <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// PASO 8: ANÁLISIS GRÁFICO EXPLORATORIO
// ============================================================================

export const StepGraphicalView: React.FC<{
  dataset: DatasetState;
  descriptiveStats: DescriptiveStat[];
  targetColumn: string;
  onPrev: () => void;
  onNext: () => void;
}> = ({ dataset, descriptiveStats, targetColumn, onPrev, onNext }) => {
  const numCols = descriptiveStats.map((d) => d.column);
  const dateCols = dataset.profiles.filter((p) => p.selectedType === 'date').map((p) => p.name);

  const [histVar, setHistVar] = useState<string>(targetColumn || numCols[0] || '');
  const [binsCount, setBinsCount] = useState<number>(12);
  const [showNormal, setShowNormal] = useState<boolean>(true);
  const [scatterX, setScatterX] = useState<string>(
    numCols.find((c) => c !== targetColumn) || numCols[0] || ''
  );
  const [scatterY, setScatterY] = useState<string>(targetColumn || numCols[0] || '');
  const [showTrendline, setShowTrendline] = useState<boolean>(true);
  const [trendVar, setTrendVar] = useState<string>(targetColumn || numCols[0] || '');

  const histStat = descriptiveStats.find((d) => d.column === histVar) ?? descriptiveStats[0];

  const scatterPoints = useMemo(() => {
    if (!scatterX || !scatterY) return [];
    const pts: { x: number; y: number }[] = [];
    for (const r of dataset.rows) {
      const xv = parseFlexibleNumber(r[scatterX]);
      const yv = parseFlexibleNumber(r[scatterY]);
      if (xv !== null && yv !== null) pts.push({ x: xv, y: yv });
    }
    return pts;
  }, [dataset.rows, scatterX, scatterY]);

  const trendSeries = useMemo(() => {
    if (!trendVar) return [];
    const dateCol = dateCols[0] ?? null;
    const raw = dataset.rows
      .map((r, idx) => {
        const val = parseFlexibleNumber(r[trendVar]);
        if (val === null) return null;
        const ts = dateCol ? parseFlexibleDate(r[dateCol]) : null;
        return {
          label: dateCol && r[dateCol] ? String(r[dateCol]) : `#${idx + 1}`,
          sortKey: ts ?? idx,
          value: val,
        };
      })
      .filter((x): x is { label: string; sortKey: number; value: number } => x !== null);
    if (dateCol) raw.sort((a, b) => a.sortKey - b.sortKey);
    return raw.map((r) => ({ label: r.label, value: r.value }));
  }, [dataset.rows, trendVar, dateCols]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-blue-400">Paso 08 · Análisis gráfico</p>
        <h2 className="text-xl font-bold text-white">
          Distribución, dispersión, BoxPlots y tendencias
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Personalice las variables y parámetros de cada gráfico para explorar linealidad, asimetría y presencia de valores extremos.
        </p>
      </div>

      {numCols.length === 0 ? (
        <NoticeBanner variant="warning" title="Sin variables numéricas">
          Cargue o clasifique al menos una columna numérica para visualizar gráficos estadísticos.
        </NoticeBanner>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Histograma */}
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Histograma de frecuencias</h3>
              <div className="flex items-center gap-2">
                <select
                  value={histVar}
                  onChange={(e) => setHistVar(e.target.value)}
                  className="border border-slate-700 rounded px-2 py-1 text-xs bg-[#070B12] text-slate-100"
                >
                  {numCols.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={binsCount}
                  onChange={(e) => setBinsCount(Number(e.target.value))}
                  className="border border-slate-700 rounded px-2 py-1 text-xs bg-[#070B12] text-slate-100"
                >
                  <option value={8}>8 barras</option>
                  <option value={12}>12 barras</option>
                  <option value={16}>16 barras</option>
                </select>
                <label className="inline-flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showNormal}
                    onChange={(e) => setShowNormal(e.target.checked)}
                    className="accent-blue-500"
                  />
                  Curva normal
                </label>
              </div>
            </div>
            {histStat && (
              <HistogramChart
                values={histStat.values}
                label={histStat.column}
                binsCount={binsCount}
                showNormalCurve={showNormal}
              />
            )}
          </div>

          {/* Dispersión */}
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Gráfico de dispersión</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={scatterX}
                  onChange={(e) => setScatterX(e.target.value)}
                  className="border border-slate-700 rounded px-2 py-1 text-xs bg-[#070B12] text-slate-100"
                >
                  {numCols.map((c) => (
                    <option key={c} value={c}>X: {c}</option>
                  ))}
                </select>
                <select
                  value={scatterY}
                  onChange={(e) => setScatterY(e.target.value)}
                  className="border border-slate-700 rounded px-2 py-1 text-xs bg-[#070B12] text-slate-100"
                >
                  {numCols.map((c) => (
                    <option key={c} value={c}>Y: {c}</option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTrendline}
                    onChange={(e) => setShowTrendline(e.target.checked)}
                    className="accent-blue-500"
                  />
                  Recta MCO
                </label>
              </div>
            </div>
            <ScatterRegressionChart
              points={scatterPoints}
              xLabel={scatterX}
              yLabel={scatterY}
              showTrendline={showTrendline}
            />
          </div>

          {/* BoxPlot */}
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                Diagrama de Caja y Bigotes (BoxPlot)
              </h3>
              <span className="text-xs text-slate-400">Variable: {histStat?.column}</span>
            </div>
            {histStat && <BoxPlotChart stat={histStat} />}
          </div>

          {/* Tendencia */}
          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                Gráfico de tendencia {dateCols[0] ? `(ordenado por ${dateCols[0]})` : '(por secuencia)'}
              </h3>
              <select
                value={trendVar}
                onChange={(e) => setTrendVar(e.target.value)}
                className="border border-slate-700 rounded px-2 py-1 text-xs bg-[#070B12] text-slate-100"
              >
                {numCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <TrendLineChart series={trendSeries} yLabel={trendVar} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
        >
          Atrás: Descriptivo
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          Continuar a Correlaciones <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// PASO 9: ANÁLISIS DE CORRELACIONES
// ============================================================================

export const StepCorrelationView: React.FC<{
  correlationMatrix: {
    headers: string[];
    values: (number | null)[][];
    pValues: (number | null)[][];
  };
  targetColumn: string;
  onPrev: () => void;
  onNext: () => void;
}> = ({ correlationMatrix, targetColumn, onPrev, onNext }) => {
  const { headers, values } = correlationMatrix;

  const collinearPairs = useMemo(() => {
    const pairs: { a: string; b: string; r: number }[] = [];
    for (let i = 0; i < headers.length; i++) {
      for (let j = i + 1; j < headers.length; j++) {
        if (headers[i] === targetColumn || headers[j] === targetColumn) continue;
        const r = values[i]?.[j];
        if (r !== null && r !== undefined && Math.abs(r) >= 0.75) {
          pairs.push({ a: headers[i], b: headers[j], r });
        }
      }
    }
    return pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  }, [headers, values, targetColumn]);

  const targetCorrs = useMemo(() => {
    const tIdx = headers.indexOf(targetColumn);
    if (tIdx === -1) return [];
    return headers
      .map((h, idx) => ({
        variable: h,
        r: values[tIdx]?.[idx] ?? null,
      }))
      .filter((item) => item.variable !== targetColumn && item.r !== null)
      .sort((a, b) => Math.abs(b.r!) - Math.abs(a.r!));
  }, [headers, values, targetColumn]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-blue-400">Paso 09 · Análisis de correlaciones</p>
        <h2 className="text-xl font-bold text-white">
          Matriz de correlación de Pearson y detección de multicolinealidad
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Evalúe la fuerza y dirección de las relaciones lineales entre variables numéricas. Valores cercanos a +1 o -1 entre predictores advierten redundancia.
        </p>
      </div>

      {collinearPairs.length > 0 ? (
        <NoticeBanner variant="warning" title="Advertencia de posible multicolinealidad entre predictores">
          Se detectaron {collinearPairs.length} par(es) de variables independientes con correlación alta (|r| ≥ 0.75):{' '}
          {collinearPairs.map((p) => `${p.a} ↔ ${p.b} (r = ${p.r.toFixed(2)})`).join(' · ')}. En los pasos siguientes se validará su VIF exacto.
        </NoticeBanner>
      ) : (
        <NoticeBanner variant="success" title="Sin alertas críticas de colinealidad bivariada">
          Ningún par de variables predictoras numéricas supera el umbral de |r| ≥ 0.75. Aun así, el VIF en el Paso 14 verificará relaciones lineales múltiples.
        </NoticeBanner>
      )}

      {headers.length < 2 ? (
        <NoticeBanner variant="warning" title="Variables insuficientes">
          Se requieren al menos dos variables numéricas para calcular la matriz de correlación.
        </NoticeBanner>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0C121E] border border-slate-800 rounded-lg p-4">
            <div className="text-xs font-semibold text-slate-200 mb-3 flex items-center justify-between">
              <StatGlossaryHint
                term="Matriz de Correlación de Pearson (r)"
                explanation="Mide asociación lineal entre -1 (inversa perfecta) y +1 (directa perfecta). Correlación no implica causalidad."
              />
              <span className="text-slate-400 font-normal">Objetivo destacado: {targetColumn}</span>
            </div>
            <CorrelationHeatmap headers={headers} values={values} targetColumn={targetColumn} />
          </div>

          <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Ranking de asociación con {targetColumn}
            </h3>
            {targetCorrs.length === 0 ? (
              <p className="text-xs text-slate-400">Seleccione una variable objetivo numérica.</p>
            ) : (
              <div className="space-y-2.5">
                {targetCorrs.map((item) => {
                  const r = item.r!;
                  const abs = Math.abs(r);
                  const strength =
                    abs >= 0.7 ? 'Fuerte' : abs >= 0.4 ? 'Moderada' : 'Débil';
                  return (
                    <div key={item.variable} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200 truncate max-w-[55%]" title={item.variable}>
                          {item.variable}
                        </span>
                        <span className="font-mono tabular-nums text-slate-300">
                          r = {r >= 0 ? '+' : ''}
                          {r.toFixed(3)} ({strength})
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${r >= 0 ? 'bg-blue-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, abs * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
        >
          Atrás: Análisis Gráfico
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          Continuar a Preparación y División <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
