import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Layers,
  Menu,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  BusinessSector,
  DatasetState,
  DescriptiveStat,
  FeaturePrepConfig,
  MissingStrategy,
  PredictionRecord,
  PreparedSplitData,
  RegressionChoice,
  RegressionModelResult,
  ScalingMethod,
  SplitMethod,
  VariableSelectionSummary,
  VariableType,
} from './types/analytics';
import {
  analyzeDatasetStructure,
  parseFlexibleNumber,
  parseUploadedFile,
  prepareTrainTestPipeline,
} from './utils/dataParser';
import {
  computeDescriptiveStats,
  fitLinearRegressionModel,
  pearsonCorrelation,
  runVariableSelection,
} from './utils/mathStats';
import { SAMPLE_DATASETS } from './utils/sampleDatasets';
import {
  StepExploreVariablesView,
  StepImportView,
} from './components/steps/StageDataImportExplore';
import {
  StepContextQualityView,
  StepCorrelationView,
  StepDescriptiveView,
  StepGraphicalView,
} from './components/steps/StageContextQualityEda';
import {
  StepModelsSelectionView,
  StepPrepSplitView,
} from './components/steps/StagePrepSplitModels';
import {
  StepDashboardPredictionsView,
  StepDiagnosticsCompareView,
  StepInterpretationExportView,
} from './components/steps/StageDiagnosticsResultsExport';

type StageKey =
  | 'import'
  | 'explore'
  | 'quality'
  | 'descriptive'
  | 'graphical'
  | 'correlation'
  | 'prep'
  | 'models'
  | 'diagnostics'
  | 'dashboard'
  | 'export';

interface NavItem {
  key: StageKey;
  stepsLabel: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresDataset: boolean;
  requiresModels: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'import',
    stepsLabel: '01–02',
    title: 'Inicio y Carga de Datos',
    icon: Database,
    requiresDataset: false,
    requiresModels: false,
  },
  {
    key: 'explore',
    stepsLabel: '03–04',
    title: 'Exploración y Variables',
    icon: FileSpreadsheet,
    requiresDataset: true,
    requiresModels: false,
  },
  {
    key: 'quality',
    stepsLabel: '05–06',
    title: 'Contexto y Calidad',
    icon: ShieldAlert,
    requiresDataset: true,
    requiresModels: false,
  },
  {
    key: 'descriptive',
    stepsLabel: '07',
    title: 'Análisis Descriptivo',
    icon: BarChart3,
    requiresDataset: true,
    requiresModels: false,
  },
  {
    key: 'graphical',
    stepsLabel: '08',
    title: 'Análisis Gráfico',
    icon: TrendingUp,
    requiresDataset: true,
    requiresModels: false,
  },
  {
    key: 'correlation',
    stepsLabel: '09',
    title: 'Correlaciones',
    icon: GitBranch,
    requiresDataset: true,
    requiresModels: false,
  },
  {
    key: 'prep',
    stepsLabel: '10–12',
    title: 'Preparación y División',
    icon: SlidersHorizontal,
    requiresDataset: true,
    requiresModels: false,
  },
  {
    key: 'models',
    stepsLabel: '13 & 16',
    title: 'Modelos y Selección',
    icon: Layers,
    requiresDataset: true,
    requiresModels: true,
  },
  {
    key: 'diagnostics',
    stepsLabel: '14–15',
    title: 'Supuestos y Comparación',
    icon: Scale,
    requiresDataset: true,
    requiresModels: true,
  },
  {
    key: 'dashboard',
    stepsLabel: '17–18',
    title: 'Dashboard y Predicción',
    icon: CheckCircle2,
    requiresDataset: true,
    requiresModels: true,
  },
  {
    key: 'export',
    stepsLabel: '19–20',
    title: 'Conclusiones e Informes',
    icon: FileText,
    requiresDataset: true,
    requiresModels: true,
  },
];

export default function App() {
  const [activeStage, setActiveStage] = useState<StageKey>('import');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dataset & upload state
  const [dataset, setDataset] = useState<DatasetState | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Modeling & preprocessing configuration
  const [regressionChoice, setRegressionChoice] = useState<RegressionChoice>('auto');
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [selectedPredictors, setSelectedPredictors] = useState<string[]>([]);
  const [sector, setSector] = useState<BusinessSector>('general');
  const [missingStrategy, setMissingStrategy] = useState<MissingStrategy>('median');
  const [removeDuplicates, setRemoveDuplicates] = useState<boolean>(true);
  const [featureConfigs, setFeatureConfigs] = useState<FeaturePrepConfig[]>([]);
  const [scalingMethod, setScalingMethod] = useState<ScalingMethod>('none');
  const [compareSimpleAndMultiple, setCompareSimpleAndMultiple] = useState<boolean>(true);
  const [simplePredictorColumn, setSimplePredictorColumn] = useState<string>('');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('random');
  const [dateColumn, setDateColumn] = useState<string | null>(null);
  const [seed, setSeed] = useState<number>(42);

  // Fitted artifacts
  const [splitData, setSplitData] = useState<PreparedSplitData | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [models, setModels] = useState<RegressionModelResult[]>([]);
  const [activeModelId, setActiveModelId] = useState<string>('');
  const [selectionSummary, setSelectionSummary] = useState<VariableSelectionSummary | null>(null);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);

  const initializeFromDataset = (ds: DatasetState) => {
    setDataset(ds);
    setUploadError(null);
    setModels([]);
    setSplitData(null);
    setPrepError(null);
    setSelectionSummary(null);
    setPredictions([]);
    setActiveModelId('');
    setSector(ds.suggestedSector);

    const numCols = ds.profiles.filter((p) => p.selectedType === 'numeric').map((p) => p.name);
    const catCols = ds.profiles.filter((p) => p.selectedType === 'categorical').map((p) => p.name);
    const dateCols = ds.profiles.filter((p) => p.selectedType === 'date').map((p) => p.name);

    // Default target = last numeric column (common convention in tabular regression)
    const defaultTarget = numCols[numCols.length - 1] ?? '';
    const defaultPreds = [
      ...numCols.filter((c) => c !== defaultTarget),
      ...catCols,
    ];

    setTargetColumn(defaultTarget);
    setSelectedPredictors(defaultPreds);
    setSimplePredictorColumn(numCols.find((c) => c !== defaultTarget) ?? defaultPreds[0] ?? '');

    setFeatureConfigs(
      ds.profiles.map((p) => ({
        column: p.name,
        included: defaultPreds.includes(p.name),
        encoding: p.selectedType === 'categorical' ? 'onehot' : 'ignore',
        transform: 'none',
      }))
    );

    if (dateCols.length > 0) {
      setSplitMethod('chronological');
      setDateColumn(dateCols[0]);
    } else {
      setSplitMethod('random');
      setDateColumn(null);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    setUploadError(null);
    try {
      const ds = await parseUploadedFile(file);
      initializeFromDataset(ds);
      setActiveStage('explore');
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'No se pudo interpretar el archivo. Verifique encabezados y delimitadores.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleLoadSample = (sampleId: string) => {
    const found = SAMPLE_DATASETS.find((s) => s.id === sampleId);
    if (!found) return;
    const ds = found.build();
    initializeFromDataset(ds);
    setActiveStage('explore');
  };

  const handleChangeColumnType = (col: string, newType: VariableType) => {
    if (!dataset) return;
    const typeMap: Record<string, VariableType> = {};
    dataset.profiles.forEach((p) => {
      typeMap[p.name] = p.name === col ? newType : p.selectedType;
    });
    const updated = analyzeDatasetStructure(
      dataset.fileName,
      dataset.fileFormat,
      dataset.separator,
      dataset.headers,
      dataset.rows.map((r) => ({ ...r })),
      typeMap
    );
    setDataset(updated);

    // Keep featureConfigs & target synchronized cleanly
    setFeatureConfigs((prev) =>
      prev.map((fc) => {
        if (fc.column !== col) return fc;
        const compatible = newType === 'numeric' || newType === 'categorical';
        return {
          ...fc,
          included: compatible && fc.column !== targetColumn ? fc.included : false,
          encoding: newType === 'categorical' ? 'onehot' : 'ignore',
          transform: newType === 'numeric' ? fc.transform : 'none',
        };
      })
    );
    if (newType !== 'numeric' && targetColumn === col) {
      const nextNum = updated.profiles.find((p) => p.selectedType === 'numeric')?.name ?? '';
      setTargetColumn(nextNum);
    }
    if (newType !== 'numeric' && newType !== 'categorical') {
      setSelectedPredictors((prev) => prev.filter((c) => c !== col));
    }
  };

  const handleSelectTarget = (col: string) => {
    setTargetColumn(col);
    setSelectedPredictors((prev) => prev.filter((p) => p !== col));
    setFeatureConfigs((prev) =>
      prev.map((fc) => (fc.column === col ? { ...fc, included: false } : fc))
    );
  };

  const handleTogglePredictor = (col: string) => {
    setSelectedPredictors((prev) => {
      const exists = prev.includes(col);
      const next = exists ? prev.filter((c) => c !== col) : [...prev, col];
      setFeatureConfigs((fcs) =>
        fcs.map((fc) => (fc.column === col ? { ...fc, included: !exists } : fc))
      );
      if (!exists && !simplePredictorColumn) {
        setSimplePredictorColumn(col);
      }
      return next;
    });
  };

  const handleUpdateFeatureConfig = (col: string, patch: Partial<FeaturePrepConfig>) => {
    setFeatureConfigs((prev) => {
      const next = prev.map((fc) => (fc.column === col ? { ...fc, ...patch } : fc));
      setSelectedPredictors(
        next.filter((fc) => fc.included && fc.column !== targetColumn).map((fc) => fc.column)
      );
      return next;
    });
  };

  // Descriptive statistics computed directly on dataset numeric columns
  const descriptiveStats: DescriptiveStat[] = useMemo(() => {
    if (!dataset) return [];
    return dataset.profiles
      .filter((p) => p.selectedType === 'numeric')
      .map((p) =>
        computeDescriptiveStats(
          p.name,
          dataset.rows.map((r) => parseFlexibleNumber(r[p.name]))
        )
      )
      .filter((d): d is DescriptiveStat => d !== null);
  }, [dataset]);

  // Correlation matrix computed on dataset numeric columns
  const correlationMatrix = useMemo(() => {
    if (!dataset) return { headers: [], values: [], pValues: [] };
    const numHeaders = dataset.profiles
      .filter((p) => p.selectedType === 'numeric')
      .map((p) => p.name);

    const colArrays = numHeaders.map((h) =>
      dataset.rows.map((r) => parseFlexibleNumber(r[h]))
    );

    const values: (number | null)[][] = numHeaders.map(() =>
      new Array(numHeaders.length).fill(null)
    );
    const pValues: (number | null)[][] = numHeaders.map(() =>
      new Array(numHeaders.length).fill(null)
    );

    for (let i = 0; i < numHeaders.length; i++) {
      values[i][i] = 1;
      pValues[i][i] = 0;
      for (let j = i + 1; j < numHeaders.length; j++) {
        const res = pearsonCorrelation(colArrays[i], colArrays[j]);
        values[i][j] = res.r;
        values[j][i] = res.r;
        pValues[i][j] = res.pValue;
        pValues[j][i] = res.pValue;
      }
    }

    return { headers: numHeaders, values, pValues };
  }, [dataset]);

  // Build Models (Steps 12, 13, 16) without any Train/Test leakage
  const handleBuildModels = () => {
    if (!dataset) return;
    setPrepError(null);

    const prepRes = prepareTrainTestPipeline({
      dataset,
      targetColumn,
      featureConfigs,
      missingStrategy,
      removeDuplicates,
      scalingMethod,
      splitMethod,
      dateColumn,
      trainRatio: 0.8,
      seed,
    });

    if (prepRes.error || !prepRes.data) {
      setPrepError(prepRes.error ?? 'Error al preparar los datos.');
      return;
    }

    const prepared = prepRes.data;
    setSplitData(prepared);

    const transformsMap: Record<string, 'none' | 'log1p'> = {};
    featureConfigs.forEach((fc) => {
      transformsMap[fc.column] = fc.transform;
    });

    const baseFit = {
      targetColumn,
      allFeatureNames: prepared.featureNames,
      featureSourceMap: prepared.featureSourceMap,
      xTrainFull: prepared.xTrain,
      yTrain: prepared.yTrain,
      xTestFull: prepared.xTest,
      yTest: prepared.yTest,
      scalingMethod,
      scalingLearned: prepared.scalingLearned,
      imputationsLearned: prepared.imputationsLearned,
      oneHotMappings: prepared.oneHotMappings,
      transformsMap,
    };

    const builtModels: RegressionModelResult[] = [];
    const effectiveMode =
      regressionChoice === 'auto'
        ? prepared.featureNames.length === 1
          ? 'simple'
          : 'multiple'
        : regressionChoice;

    if (effectiveMode === 'multiple') {
      const mult = fitLinearRegressionModel({
        ...baseFit,
        id: 'model-multiple-full',
        name: 'Regresión Lineal Múltiple (Completa)',
        kind: 'multiple',
        selectedFeatureNames: prepared.featureNames,
      });
      if (mult.error) {
        setPrepError(mult.error);
        return;
      }
      if (mult.model) builtModels.push(mult.model);
    }

    // Simple linear regression model (either primary when 1 var / forced simple, or comparison benchmark)
    if (effectiveMode === 'simple' || (compareSimpleAndMultiple && prepared.featureNames.length >= 2)) {
      const simpleCol =
        prepared.featureNames.find((fn) => fn === simplePredictorColumn) ??
        prepared.featureNames[0];
      const simpleFit = fitLinearRegressionModel({
        ...baseFit,
        id: 'model-simple',
        name: `Regresión Simple (${simpleCol})`,
        kind: 'simple',
        selectedFeatureNames: [simpleCol],
      });
      if (simpleFit.error && builtModels.length === 0) {
        setPrepError(simpleFit.error);
        return;
      }
      if (simpleFit.model) builtModels.push(simpleFit.model);
    }

    // Stepwise & Best Subsets (when >= 2 encoded predictors)
    let selSum: VariableSelectionSummary | null = null;
    if (prepared.featureNames.length >= 2) {
      selSum = runVariableSelection(baseFit);
      if (selSum.stepwiseResult?.model) {
        // Avoid pushing duplicate identical feature set if same name/features? Keep for transparency in comparison!
        builtModels.push(selSum.stepwiseResult.model);
      }
      if (selSum.bestSubsetsResult?.bestByAdjR2) {
        builtModels.push(selSum.bestSubsetsResult.bestByAdjR2);
      }
      if (selSum.bestSubsetsResult?.bestByBic) {
        builtModels.push(selSum.bestSubsetsResult.bestByBic);
      }
    }
    setSelectionSummary(selSum);

    if (builtModels.length === 0) {
      setPrepError('No fue posible ajustar ningún modelo válido con las variables seleccionadas.');
      return;
    }

    setModels(builtModels);
    setActiveModelId(builtModels[0].id);
    setPredictions([]);
    setActiveStage('models');
  };

  const activeModel = models.find((m) => m.id === activeModelId) ?? models[0] ?? null;

  const canNavigateTo = (item: NavItem) => {
    if (item.requiresDataset && !dataset) return false;
    if (item.requiresModels && models.length === 0) return false;
    return true;
  };

  return (
    <div className="min-h-screen flex bg-[#06090F] text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation (Deep Black #090D16 + Cobalt Blue) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#090D16] border-r border-slate-800/90 text-slate-100 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 space-y-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold tracking-tight text-white">EstimaBI</div>
              <div className="text-[11px] text-blue-400">
                Analítica de Regresión Lineal
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1" aria-label="Etapas del análisis">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const enabled = canNavigateTo(item);
              const isActive = activeStage === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!enabled}
                  onClick={() => {
                    if (!enabled) return;
                    setActiveStage(item.key);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold'
                      : enabled
                        ? 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                        : 'text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </span>
                  <span
                    className={`text-[10px] font-mono tabular-nums shrink-0 ${
                      isActive ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {item.stepsLabel}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800/90 text-[11px] text-slate-400 space-y-1">
          {dataset ? (
            <>
              <div className="text-slate-200 font-medium truncate" title={dataset.fileName}>
                {dataset.fileName}
              </div>
              <div className="font-mono tabular-nums">
                {dataset.quality.totalRows} filas · {dataset.quality.totalCols} cols
              </div>
            </>
          ) : (
            <div>Sin base de datos cargada</div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (3-zone contract) */}
        <header className="bg-[#090D16]/95 backdrop-blur border-b border-slate-800/90 px-4 sm:px-8 h-14 flex items-center justify-between gap-8 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-300 hover:bg-slate-800 rounded-lg"
              aria-label="Abrir menú lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-bold text-white whitespace-nowrap shrink-0">
                EstimaBI
              </span>
              {dataset && (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-slate-300 truncate max-w-[220px] sm:max-w-xs">
                    {dataset.fileName}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <button
              type="button"
              disabled={!dataset}
              onClick={() => setActiveStage('explore')}
              className="hover:text-blue-400 disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors"
            >
              Variables
            </button>
            <button
              type="button"
              disabled={!dataset}
              onClick={() => setActiveStage('graphical')}
              className="hover:text-blue-400 disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors"
            >
              Gráficos
            </button>
            <button
              type="button"
              disabled={models.length === 0}
              onClick={() => setActiveStage('diagnostics')}
              className="hover:text-blue-400 disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors"
            >
              Supuestos
            </button>
            <button
              type="button"
              disabled={models.length === 0}
              onClick={() => setActiveStage('dashboard')}
              className="hover:text-blue-400 disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors"
            >
              Predicciones
            </button>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveStage('import')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {dataset ? 'Cambiar base' : 'Importar datos'}
            </button>
          </div>
        </header>

        {/* Active Stage Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeStage === 'import' && (
            <StepImportView
              dataset={dataset}
              regressionChoice={regressionChoice}
              onChangeRegressionChoice={setRegressionChoice}
              onFileUpload={handleFileUpload}
              onLoadSample={handleLoadSample}
              onNext={() => setActiveStage('explore')}
              uploadError={uploadError}
              isParsing={isParsing}
            />
          )}

          {activeStage === 'explore' && dataset && (
            <StepExploreVariablesView
              dataset={dataset}
              targetColumn={targetColumn}
              selectedPredictors={selectedPredictors}
              onChangeColumnType={handleChangeColumnType}
              onSelectTarget={handleSelectTarget}
              onTogglePredictor={handleTogglePredictor}
              onPrev={() => setActiveStage('import')}
              onNext={() => setActiveStage('quality')}
            />
          )}

          {activeStage === 'quality' && dataset && (
            <StepContextQualityView
              dataset={dataset}
              sector={sector}
              onChangeSector={setSector}
              missingStrategy={missingStrategy}
              onChangeMissingStrategy={setMissingStrategy}
              removeDuplicates={removeDuplicates}
              onToggleRemoveDuplicates={setRemoveDuplicates}
              onPrev={() => setActiveStage('explore')}
              onNext={() => setActiveStage('descriptive')}
            />
          )}

          {activeStage === 'descriptive' && dataset && (
            <StepDescriptiveView
              descriptiveStats={descriptiveStats}
              onPrev={() => setActiveStage('quality')}
              onNext={() => setActiveStage('graphical')}
            />
          )}

          {activeStage === 'graphical' && dataset && (
            <StepGraphicalView
              dataset={dataset}
              descriptiveStats={descriptiveStats}
              targetColumn={targetColumn}
              onPrev={() => setActiveStage('descriptive')}
              onNext={() => setActiveStage('correlation')}
            />
          )}

          {activeStage === 'correlation' && dataset && (
            <StepCorrelationView
              correlationMatrix={correlationMatrix}
              targetColumn={targetColumn}
              onPrev={() => setActiveStage('graphical')}
              onNext={() => setActiveStage('prep')}
            />
          )}

          {activeStage === 'prep' && dataset && (
            <StepPrepSplitView
              dataset={dataset}
              targetColumn={targetColumn}
              featureConfigs={featureConfigs}
              onUpdateFeatureConfig={handleUpdateFeatureConfig}
              scalingMethod={scalingMethod}
              onChangeScalingMethod={setScalingMethod}
              regressionChoice={regressionChoice}
              onChangeRegressionChoice={setRegressionChoice}
              compareSimpleAndMultiple={compareSimpleAndMultiple}
              onToggleCompareSimpleAndMultiple={setCompareSimpleAndMultiple}
              simplePredictorColumn={simplePredictorColumn}
              onChangeSimplePredictorColumn={setSimplePredictorColumn}
              splitMethod={splitMethod}
              onChangeSplitMethod={setSplitMethod}
              dateColumn={dateColumn}
              onChangeDateColumn={setDateColumn}
              seed={seed}
              onChangeSeed={setSeed}
              splitData={splitData}
              prepError={prepError}
              onBuildModels={handleBuildModels}
              onPrev={() => setActiveStage('correlation')}
              onNext={() => setActiveStage('models')}
            />
          )}

          {activeStage === 'models' && splitData && activeModel && (
            <StepModelsSelectionView
              splitData={splitData}
              models={models}
              activeModel={activeModel}
              onSelectActiveModel={setActiveModelId}
              selectionSummary={selectionSummary}
              onPrev={() => setActiveStage('prep')}
              onNext={() => setActiveStage('diagnostics')}
            />
          )}

          {activeStage === 'diagnostics' && activeModel && (
            <StepDiagnosticsCompareView
              models={models}
              activeModel={activeModel}
              onSelectActiveModel={setActiveModelId}
              onPrev={() => setActiveStage('models')}
              onNext={() => setActiveStage('dashboard')}
            />
          )}

          {activeStage === 'dashboard' && dataset && activeModel && (
            <StepDashboardPredictionsView
              dataset={dataset}
              models={models}
              activeModel={activeModel}
              onSelectActiveModel={setActiveModelId}
              descriptiveStats={descriptiveStats}
              predictions={predictions}
              onAddPrediction={(p) => setPredictions((prev) => [p, ...prev])}
              onPrev={() => setActiveStage('diagnostics')}
              onNext={() => setActiveStage('export')}
            />
          )}

          {activeStage === 'export' && dataset && splitData && activeModel && (
            <StepInterpretationExportView
              dataset={dataset}
              sector={sector}
              descriptiveStats={descriptiveStats}
              correlationMatrix={correlationMatrix}
              splitData={splitData}
              models={models}
              activeModel={activeModel}
              onSelectActiveModel={setActiveModelId}
              predictions={predictions}
              onPrev={() => setActiveStage('dashboard')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
