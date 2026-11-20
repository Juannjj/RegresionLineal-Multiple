import React, { useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Database,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  DatasetState,
  RegressionChoice,
  VariableType,
} from '../../types/analytics';
import { SAMPLE_DATASETS } from '../../utils/sampleDatasets';
import { KpiCard, NoticeBanner } from '../ui/StatInfo';

interface Stage1Props {
  dataset: DatasetState | null;
  regressionChoice: RegressionChoice;
  onChangeRegressionChoice: (choice: RegressionChoice) => void;
  onFileUpload: (file: File) => Promise<void>;
  onLoadSample: (sampleId: string) => void;
  onNext: () => void;
  uploadError: string | null;
  isParsing: boolean;
}

export const StepImportView: React.FC<Stage1Props> = ({
  dataset,
  regressionChoice,
  onChangeRegressionChoice,
  onFileUpload,
  onLoadSample,
  onNext,
  uploadError,
  isParsing,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await onFileUpload(files[0]);
  };

  return (
    <div className="space-y-8">
      {/* Paso 1: Configuración del modo de regresión */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-400">Paso 01 · Configuración inicial</p>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Modelado de Regresión Lineal Simple y Múltiple
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Importe su base de datos para analizar relaciones estadísticas, validar supuestos, comparar modelos sin fuga de información y generar recomendaciones ejecutivas.
            </p>
          </div>
          {dataset && (
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Continuar a Exploración <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-5 space-y-3">
          <div className="text-sm font-semibold text-white">
            Modo de selección del tipo de modelo
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: 'auto' as const,
                title: 'Recomendación automática',
                desc: 'Sugiere Simple o Múltiple según la cantidad de variables predictoras seleccionadas y permite comparar ambos enfoques.',
              },
              {
                id: 'simple' as const,
                title: 'Regresión Lineal Simple (manual)',
                desc: 'Modela una única variable independiente X frente a Y para interpretar elasticidad directa y tendencia.',
              },
              {
                id: 'multiple' as const,
                title: 'Regresión Lineal Múltiple (manual)',
                desc: 'Evalúa simultáneamente múltiples variables X numéricas y categóricas controlando efectos ceteris paribus.',
              },
            ].map((opt) => {
              const active = regressionChoice === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeRegressionChoice(opt.id)}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    active
                      ? 'bg-blue-600/15 text-white border-blue-500'
                      : 'bg-[#080C15] text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-semibold text-sm">
                    <span>{opt.title}</span>
                    {active && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </div>
                  <p className={`text-xs mt-1.5 leading-relaxed ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Paso 2: Carga de información */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 02 · Carga de información</p>
          <h3 className="text-lg font-semibold text-white">
            Importar base de datos (Excel, CSV o TXT)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Reconocimiento automático de encabezados, delimitadores (, ; tab |), decimales y estructura tabular. Todo el procesamiento se ejecuta localmente en su navegador.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-blue-500 bg-blue-950/30'
              : 'border-slate-700 bg-[#0C121E] hover:border-blue-500/70 hover:bg-[#0F1625]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="mx-auto w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <div className="text-sm font-semibold text-white">
            {isParsing
              ? 'Analizando estructura del archivo...'
              : 'Arrastre su archivo aquí o haga clic para seleccionar'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Formatos compatibles: .xlsx, .xls, .csv, .txt
          </div>
        </div>

        {uploadError && (
          <NoticeBanner variant="warning" title="Error al importar archivo">
            {uploadError}
          </NoticeBanner>
        )}

        {dataset && (
          <div className="bg-blue-950/35 border border-blue-800/70 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs space-y-1">
                <div className="font-semibold text-white">
                  Base cargada: {dataset.fileName}
                </div>
                <div className="text-slate-300 font-mono tabular-nums">
                  Formato: {dataset.fileFormat} · Separador: {dataset.separator} ·{' '}
                  {dataset.quality.totalRows} registros · {dataset.quality.totalCols} columnas
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onNext}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Explorar Dataset
            </button>
          </div>
        )}
      </section>

      {/* Bases de datos de prueba */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Database className="w-4 h-4 text-blue-400" />
          <span>O cargue un dataset empresarial de demostración</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_DATASETS.map((sample) => {
            const isLoaded = dataset?.fileName.includes(sample.id.split('_')[0]);
            return (
              <div
                key={sample.id}
                className="bg-[#0C121E] border border-slate-800 rounded-lg p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-400">
                    {sample.sectorLabel} · {sample.rowCount} registros
                  </div>
                  <h4 className="text-sm font-semibold text-white">{sample.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{sample.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onLoadSample(sample.id)}
                  className={`w-full py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                    isLoaded
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#080C15] text-slate-200 border-slate-700 hover:bg-blue-600 hover:border-blue-500 hover:text-white'
                  }`}
                >
                  {isLoaded ? 'Dataset activo' : 'Cargar esta base'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// PASOS 3 & 4: EXPLORACIÓN INICIAL E IDENTIFICACIÓN DE VARIABLES
// ============================================================================

interface Stage2Props {
  dataset: DatasetState;
  targetColumn: string;
  selectedPredictors: string[];
  onChangeColumnType: (col: string, newType: VariableType) => void;
  onSelectTarget: (col: string) => void;
  onTogglePredictor: (col: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const StepExploreVariablesView: React.FC<Stage2Props> = ({
  dataset,
  targetColumn,
  selectedPredictors,
  onChangeColumnType,
  onSelectTarget,
  onTogglePredictor,
  onNext,
  onPrev,
}) => {
  const [previewCount, setPreviewCount] = useState<5 | 10>(10);

  const numericCols = dataset.profiles.filter((p) => p.selectedType === 'numeric');
  const categoricalCols = dataset.profiles.filter((p) => p.selectedType === 'categorical');
  const dateCols = dataset.profiles.filter((p) => p.selectedType === 'date');
  const textCols = dataset.profiles.filter((p) => p.selectedType === 'text');

  const targetProfile = dataset.profiles.find((p) => p.name === targetColumn);
  const targetValid = targetProfile?.selectedType === 'numeric';
  const predictorsValid = selectedPredictors.length > 0;

  return (
    <div className="space-y-8">
      {/* Paso 3: Exploración inicial */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-400">Paso 03 · Exploración inicial</p>
            <h2 className="text-xl font-bold text-white">
              Estructura general y vista previa de registros
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filas a mostrar:</span>
            <div className="inline-flex p-0.5 bg-[#0C121E] border border-slate-800 rounded-lg">
              {([5, 10] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPreviewCount(n)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    previewCount === n
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Primeras {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total de registros"
            value={dataset.quality.totalRows.toLocaleString('es-ES')}
            subtext={`Formato ${dataset.fileFormat} (${dataset.separator})`}
          />
          <KpiCard
            label="Número de variables"
            value={String(dataset.quality.totalCols)}
            subtext={`${numericCols.length} num · ${categoricalCols.length} cat · ${dateCols.length} fecha`}
          />
          <KpiCard
            label="Completitud global"
            value={`${(100 - dataset.quality.missingPctGlobal).toFixed(1)}%`}
            subtext={`${dataset.quality.totalMissingCells} celdas faltantes`}
            tone={dataset.quality.missingPctGlobal > 5 ? 'warning' : 'positive'}
          />
          <KpiCard
            label="Filas duplicadas"
            value={String(dataset.quality.duplicateRowCount)}
            subtext={dataset.quality.duplicateRowCount > 0 ? 'Requiere revisión en Paso 6' : 'Sin duplicados exactos'}
            tone={dataset.quality.duplicateRowCount > 0 ? 'warning' : 'neutral'}
          />
        </div>

        <div className="bg-[#0C121E] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-[#080C15]">
            <span className="text-xs font-semibold text-slate-200">
              Muestra de datos: {dataset.fileName} (mostrando {Math.min(previewCount, dataset.rows.length)} de {dataset.rows.length} filas)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#070B12] text-slate-200 border-b border-slate-800">
                  <th className="py-2.5 px-3 text-left font-medium w-10 text-slate-400">#</th>
                  {dataset.headers.map((h) => (
                    <th key={h} className="py-2.5 px-3 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.rows.slice(0, previewCount).map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-800/70 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                      {idx + 1}
                    </td>
                    {dataset.headers.map((h) => {
                      const val = row[h];
                      const isMissing = val === null || val === undefined || val === '';
                      const isNum = typeof val === 'number';
                      return (
                        <td
                          key={h}
                          className={`py-2 px-3 whitespace-nowrap ${
                            isMissing
                              ? 'text-amber-300 italic bg-amber-950/30'
                              : isNum
                                ? 'font-mono tabular-nums text-slate-100'
                                : 'text-slate-300'
                          }`}
                        >
                          {isMissing ? 'Faltante' : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Paso 4: Identificación de variables */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-medium text-blue-400">Paso 04 · Identificación de variables</p>
          <h3 className="text-lg font-semibold text-white">
            Clasificación de variables y selección de Y y X
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ajuste el tipo detectado si es necesario y defina la variable dependiente numérica (Y) junto con las variables independientes (X) compatibles con regresión.
          </p>
        </div>

        {!targetValid && (
          <NoticeBanner variant="warning" title="Variable dependiente (Y) incompatible">
            Para regresión lineal, la variable dependiente (Y) debe ser de tipo Numérica. Seleccione una columna numérica o reclasifique la variable objetivo.
          </NoticeBanner>
        )}

        <div className="bg-[#0C121E] border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#070B12] border-b border-slate-800 text-slate-300">
                  <th className="py-2.5 px-3 text-left font-semibold">Variable</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Tipo clasificado</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Únicos</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Faltantes</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Muestra</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Dependiente (Y)</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Predictora (X)</th>
                </tr>
              </thead>
              <tbody>
                {dataset.profiles.map((prof) => {
                  const isTarget = targetColumn === prof.name;
                  const isPred = selectedPredictors.includes(prof.name);
                  const canBeTarget = prof.selectedType === 'numeric';
                  const canBePredictor =
                    !isTarget &&
                    (prof.selectedType === 'numeric' || prof.selectedType === 'categorical');

                  return (
                    <tr
                      key={prof.name}
                      className={`border-b border-slate-800/70 ${
                        isTarget ? 'bg-blue-950/35' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {prof.name}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={prof.selectedType}
                          onChange={(e) =>
                            onChangeColumnType(prof.name, e.target.value as VariableType)
                          }
                          className="border border-slate-700 rounded px-2 py-1 text-xs bg-[#070B12] text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="numeric">Numérica</option>
                          <option value="categorical">Categórica</option>
                          <option value="date">Fecha</option>
                          <option value="text">Texto / ID</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {prof.uniqueCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {prof.missingCount} ({prof.missingPct.toFixed(1)}%)
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-[180px]">
                        {prof.sampleValues.slice(0, 3).join(', ') || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="radio"
                          name="target-col"
                          checked={isTarget}
                          disabled={!canBeTarget}
                          onChange={() => onSelectTarget(prof.name)}
                          className="w-4 h-4 accent-blue-500 cursor-pointer disabled:opacity-30"
                          title={
                            canBeTarget
                              ? 'Seleccionar como variable objetivo (Y)'
                              : 'Solo variables numéricas pueden ser Y'
                          }
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isPred}
                          disabled={!canBePredictor}
                          onChange={() => onTogglePredictor(prof.name)}
                          className="w-4 h-4 accent-blue-500 cursor-pointer disabled:opacity-30"
                          title={
                            isTarget
                              ? 'Es la variable objetivo'
                              : canBePredictor
                                ? 'Incluir como variable independiente (X)'
                                : 'Variables de texto libre o fecha no entran directamente como X (use fechas para split cronológico)'
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {textCols.length > 0 && (
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Nota: Las columnas clasificadas como "Texto / ID" o "Fecha" no se ingresan directamente como predictores lineales; las fechas pueden utilizarse para la división cronológica (Paso 12).
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onPrev}
            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0C121E] border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Volver a Carga
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!targetValid || !predictorsValid}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg transition-colors"
          >
            Continuar a Contexto y Calidad <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
};
