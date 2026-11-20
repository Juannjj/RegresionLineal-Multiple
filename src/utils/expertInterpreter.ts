import { BusinessSector, RegressionModelResult } from '../types/analytics';

export const BUSINESS_SECTORS: {
  id: BusinessSector;
  label: string;
  focus: string;
  caution: string;
}[] = [
  {
    id: 'comercial',
    label: 'Comercial y Retail',
    focus: 'elasticidad de precios, retorno de inversión comercial, conversión y estacionalidad de ventas',
    caution: 'efectos estacionales, promociones simultáneas y canibalización entre canales',
  },
  {
    id: 'financiero',
    label: 'Financiero e Inversiones',
    focus: 'generación de flujo, rentabilidad ajustada al riesgo, márgenes y sensibilidad ante variables de capital',
    caution: 'volatilidad macroeconómica, cambios de régimen y colinealidad entre razones financieras',
  },
  {
    id: 'bancario',
    label: 'Bancario y Riesgo Crediticio',
    focus: 'capacidad de pago, perfilamiento de riesgo, asignación de cupos y cumplimiento prudencial',
    caution: 'sesgos de selección en cartera aprobada y regulación sobre variables sensibles',
  },
  {
    id: 'tecnologico',
    label: 'Tecnológico y SaaS',
    focus: 'retención, expansión de ingresos recurrentes (MRR/ARR), adopción de producto y carga operativa',
    caution: 'efectos de cohorte, planes heterogéneos y relaciones no lineales en escala',
  },
  {
    id: 'manufactura',
    label: 'Manufactura y Operaciones',
    focus: 'rendimiento de planta, control de mermas, tiempos de ciclo y variables de proceso',
    caution: 'límites físicos de capacidad, fatiga de equipos y variables de entorno no medidas',
  },
  {
    id: 'inmobiliario',
    label: 'Inmobiliario y Construcción',
    focus: 'valoración por atributos físicos, ubicación y dinámica de precios por metro cuadrado',
    caution: 'heterogeneidad espacial entre zonas y ciclos de tasas hipotecarias',
  },
  {
    id: 'salud',
    label: 'Salud y Clínico',
    focus: 'indicadores de respuesta clínica, uso de recursos hospitalarios y factores de riesgo asociados',
    caution: 'variables confusoras demográficas y la estricta prohibición de inferir causalidad sin ensayo controlado',
  },
  {
    id: 'general',
    label: 'Empresarial General',
    focus: 'eficiencia operativa, impulsores cuantitativos del desempeño y asignación de recursos',
    caution: 'factores externos omitidos y estabilidad estructural fuera del rango observado',
  },
];

export interface ExpertConclusion {
  executiveSummary: string;
  fitAssessment: string;
  variableImpacts: {
    name: string;
    significant: boolean;
    direction: 'positivo' | 'negativo';
    interpretation: string;
  }[];
  assumptionsAndRisks: string[];
  causalityWarning: string;
  businessRecommendations: string[];
}

export function generateExpertInterpretation(
  model: RegressionModelResult,
  sector: BusinessSector
): ExpertConclusion {
  const sectorMeta =
    BUSINESS_SECTORS.find((s) => s.id === sector) ?? BUSINESS_SECTORS[BUSINESS_SECTORS.length - 1];

  const trainR2Pct = (model.trainMetrics.r2 * 100).toFixed(1);
  const adjR2Pct = (model.trainMetrics.adjR2 * 100).toFixed(1);
  const testR2Pct = model.testMetrics ? (model.testMetrics.r2 * 100).toFixed(1) : null;

  // 1. Fit assessment
  let qualityLabel = 'explicación moderada';
  const refR2 = model.testMetrics ? model.testMetrics.r2 : model.trainMetrics.adjR2;
  if (refR2 >= 0.75) qualityLabel = 'capacidad explicativa y predictiva sólida';
  else if (refR2 >= 0.5) qualityLabel = 'capacidad explicativa moderada-alta';
  else if (refR2 >= 0.25) qualityLabel = 'capacidad explicativa limitada';
  else qualityLabel = 'poder explicativo bajo';

  const fSig =
    model.trainMetrics.fPValue !== null && model.trainMetrics.fPValue < 0.05
      ? `globalmente significativo (F = ${model.trainMetrics.fStat?.toFixed(2)}, p = ${model.trainMetrics.fPValue < 0.001 ? '< 0.001' : model.trainMetrics.fPValue.toFixed(4)})`
      : 'no alcanza significancia global al 5% (p ≥ 0.05)';

  const executiveSummary = `En el contexto del sector ${sectorMeta.label}, el modelo "${model.name}" para estimar "${model.targetColumn}" resulta ${fSig} y exhibe una ${qualityLabel}. En entrenamiento explica el ${trainR2Pct}% de la variabilidad total (R² ajustado = ${adjR2Pct}%)${
    testR2Pct !== null
      ? `, logrando un R² de ${testR2Pct}% y un RMSE de ${model.testMetrics!.rmse.toFixed(3)} sobre datos de prueba independientes.`
      : '.'
  }`;

  // Overfitting check
  let fitAssessment = `El error cuadrático medio (RMSE) en entrenamiento es ${model.trainMetrics.rmse.toFixed(3)} y el MAE es ${model.trainMetrics.mae.toFixed(3)}.`;
  if (model.testMetrics) {
    const r2Diff = model.trainMetrics.r2 - model.testMetrics.r2;
    const rmseRatio =
      model.trainMetrics.rmse > 0 ? model.testMetrics.rmse / model.trainMetrics.rmse : 1;
    if (r2Diff > 0.15 || rmseRatio > 1.35) {
      fitAssessment += ` Se detecta una brecha relevante frente al conjunto de prueba (RMSE prueba = ${model.testMetrics.rmse.toFixed(3)}, ΔR² = ${(r2Diff * 100).toFixed(1)} pp), lo que sugiere posible sobreajuste o cambio de régimen entre entrenamiento y prueba.`;
    } else {
      fitAssessment += ` El desempeño en prueba (RMSE = ${model.testMetrics.rmse.toFixed(3)}, MAE = ${model.testMetrics.mae.toFixed(3)}) se mantiene consistente con entrenamiento, respaldando la estabilidad del ajuste fuera de muestra.`;
    }
  }

  // 2. Variable impacts
  const sortedCoeffs = [...model.coefficients].sort(
    (a, b) => Math.abs(b.standardizedBeta ?? 0) - Math.abs(a.standardizedBeta ?? 0)
  );

  const variableImpacts = sortedCoeffs.map((c) => {
    const sig = c.pValue < 0.05;
    const dir: 'positivo' | 'negativo' = c.estimate >= 0 ? 'positivo' : 'negativo';
    const pStr = c.pValue < 0.001 ? '< 0.001' : c.pValue.toFixed(4);
    const scaleNote =
      model.scalingMethod === 'standard'
        ? 'por cada desviación estándar adicional'
        : model.scalingMethod === 'minmax'
          ? 'al pasar del mínimo al máximo normalizado (0 a 1)'
          : 'por cada unidad adicional en esta variable';

    const impactPhrase = sig
      ? `Asociación estadísticamente significativa (p = ${pStr}). Manteniendo las demás variables constantes (ceteris paribus), un incremento ${scaleNote} se asocia con ${c.estimate >= 0 ? 'un aumento' : 'una disminución'} promedio de ${Math.abs(c.estimate).toFixed(4)} en "${model.targetColumn}" (IC 95%: [${c.ciLower95.toFixed(3)}, ${c.ciUpper95.toFixed(3)}]).`
      : `Sin evidencia estadística suficiente al 5% (p = ${pStr}; el IC 95% [${c.ciLower95.toFixed(3)}, ${c.ciUpper95.toFixed(3)}] incluye al cero). No se recomienda fundamentar decisiones operativas aisladas sobre este coeficiente mientras no se reduzca colinealidad o se amplíe la muestra.`;

    return {
      name: c.name,
      significant: sig,
      direction: dir,
      interpretation: impactPhrase,
    };
  });

  // 3. Assumptions & risks
  const assumptionsAndRisks: string[] = [];
  if (!model.diagnostics.linearityOk) {
    assumptionsAndRisks.push(
      'Linealidad comprometida: se detectó curvatura significativa en los residuos frente a los valores ajustados. Considere transformaciones no lineales o términos cuadráticos.'
    );
  }
  if (model.diagnostics.durbinWatsonStatus !== 'ok') {
    assumptionsAndRisks.push(
      `Independencia de errores en alerta (Durbin-Watson = ${model.diagnostics.durbinWatson.toFixed(2)}): existe posible autocorrelación serial en los residuos, frecuente en datos temporales; los errores estándar clásicos podrían subestimar la incertidumbre.`
    );
  }
  if (model.diagnostics.homoscedastic === false) {
    assumptionsAndRisks.push(
      `Heterocedasticidad detectada (Breusch-Pagan p = ${model.diagnostics.breuschPaganPValue?.toFixed(4)}): la varianza del error no es constante en todo el rango de predicción. Los intervalos de confianza y predicción pueden ser más estrechos o amplios que el riesgo real en extremos.`
    );
  }
  if (model.diagnostics.normalResiduals === false) {
    assumptionsAndRisks.push(
      `Desviación de normalidad en residuos (Jarque-Bera p = ${model.diagnostics.jarqueBeraPValue?.toFixed(4)}, asimetría = ${model.diagnostics.residualSkewness.toFixed(2)}): aunque los estimadores MCO siguen siendo insesgados, las pruebas t/F e intervalos en muestras pequeñas pierden exactitud.`
    );
  }
  if (model.diagnostics.multicollinearityLevel === 'severe') {
    assumptionsAndRisks.push(
      `Multicolinealidad severa (VIF máx = ${model.diagnostics.maxVif === Infinity ? '∞' : model.diagnostics.maxVif?.toFixed(2)}): dos o más predictores comparten información redundante, inflando errores estándar y volviendo inestables los signos de coeficientes.`
    );
  } else if (model.diagnostics.multicollinearityLevel === 'moderate') {
    assumptionsAndRisks.push(
      `Multicolinealidad moderada (VIF máx = ${model.diagnostics.maxVif?.toFixed(2)}): conviene revisar si la selección Stepwise o Best Subsets simplifica el modelo sin sacrificar R² ajustado.`
    );
  }
  if (assumptionsAndRisks.length === 0) {
    assumptionsAndRisks.push(
      'Los diagnósticos principales (linealidad, independencia, homocedasticidad, normalidad y VIF) no muestran violaciones críticas al nivel de significancia del 5%.'
    );
  }

  // 4. Causality warning
  const causalityWarning = `Distinción entre correlación y causalidad: Los coeficientes estimados mediante Regresión Lineal reflejan asociaciones estadísticas condicionales observadas en los datos históricos, NO relaciones causa-efecto demostradas. En el sector ${sectorMeta.label}, resulta indispensable vigilar ${sectorMeta.caution} antes de asumir que modificar una variable independiente producirá automáticamente el cambio predicho en "${model.targetColumn}".`;

  // 5. Sector-adapted business recommendations
  const sigDrivers = variableImpacts.filter((v) => v.significant);
  const topDriver = sortedCoeffs.find((c) => c.pValue < 0.05);
  const businessRecommendations: string[] = [];

  if (topDriver && refR2 >= 0.35) {
    businessRecommendations.push(
      `Priorizar seguimiento sobre "${topDriver.name}" (mayor peso estandarizado entre los predictores significativos) como palanca analítica clave orientada a ${sectorMeta.focus}.`
    );
  } else {
    businessRecommendations.push(
      `Dado el poder explicativo actual (R² prueba/ajustado = ${(refR2 * 100).toFixed(1)}%), utilice el modelo únicamente como referencia exploratoria e incorpore nuevas variables operativas relevantes del sector ${sectorMeta.label}.`
    );
  }

  if (sigDrivers.length < model.coefficients.length) {
    const nonSigCount = model.coefficients.length - sigDrivers.length;
    businessRecommendations.push(
      `Evaluar la simplificación del modelo eliminando las ${nonSigCount} variable(s) sin significancia estadística (p ≥ 0.05) mediante los métodos Stepwise o Best Subsets para evitar ruido en la toma de decisiones.`
    );
  }

  if (model.diagnostics.multicollinearityLevel === 'severe') {
    businessRecommendations.push(
      'Antes de interpretar impactos individuales o asignar presupuestos por variable, depure la colinealidad conservando únicamente un indicador representativo por bloque correlacionado.'
    );
  }

  businessRecommendations.push(
    'Al utilizar la herramienta de predicción para escenarios de negocio, evalúe siempre el Intervalo de Predicción al 95% (no solo el valor puntual) y evite extrapolar por fuera de los rangos históricos observados en el análisis descriptivo.'
  );

  return {
    executiveSummary,
    fitAssessment,
    variableImpacts,
    assumptionsAndRisks,
    causalityWarning,
    businessRecommendations,
  };
}
