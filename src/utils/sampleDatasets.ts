import { DatasetState } from '../types/analytics';
import { buildDatasetStateFromMatrix } from './dataParser';

export interface SampleDatasetDescriptor {
  id: string;
  title: string;
  sectorLabel: string;
  description: string;
  rowCount: number;
  build: () => DatasetState;
}

function seededRand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRand(rng: () => number): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export const SAMPLE_DATASETS: SampleDatasetDescriptor[] = [
  {
    id: 'retail_omnicanal',
    title: 'Ventas Omnicanal y Marketing',
    sectorLabel: 'Comercial / Retail',
    description:
      '84 registros semanales con fecha, inversión en pauta digital, tráfico web, descuento promedio, canal de venta y ventas totales.',
    rowCount: 84,
    build: () => {
      const rng = seededRand(42);
      const headers = [
        'Fecha',
        'Inversion_Marketing_USD',
        'Trafico_Web',
        'Descuento_Pct',
        'Precio_Promedio',
        'Canal',
        'Ventas_USD',
      ];
      const rows: unknown[][] = [headers];
      const channels = ['Ecommerce', 'Tienda_Fisica', 'Marketplace'];
      const start = new Date(2024, 0, 7);

      for (let i = 0; i < 84; i++) {
        const dt = new Date(start.getTime() + i * 7 * 86400000);
        const dateStr = dt.toISOString().slice(0, 10);
        const canal = channels[i % 3];
        const mkt = Math.round(2800 + i * 24 + rng() * 2200);
        const trafico = Math.round(12000 + mkt * 3.1 + normalRand(rng) * 900);
        const descuento = Number((4 + rng() * 14).toFixed(1));
        const precio = Number((48 + rng() * 24).toFixed(2));
        const canalBonus = canal === 'Ecommerce' ? 4200 : canal === 'Marketplace' ? 1900 : 0;

        let ventas =
          8500 +
          mkt * 3.65 +
          trafico * 0.42 +
          descuento * 310 -
          precio * 85 +
          canalBonus +
          normalRand(rng) * 1450;

        // Deliberate realistic data quality cases (2 missing cells, 1 outlier, 1 duplicate)
        let mktCell: unknown = mkt;
        let descCell: unknown = descuento;
        if (i === 14) mktCell = null;
        if (i === 49) descCell = null;
        if (i === 63) ventas += 18500; // outlier campaign peak

        rows.push([
          dateStr,
          mktCell,
          trafico,
          descCell,
          precio,
          canal,
          Math.round(ventas),
        ]);
      }
      // Add 1 duplicate row to demonstrate duplicate detection
      rows.push([...rows[10]]);
      return buildDatasetStateFromMatrix(
        'ventas_omnicanal_retail.csv',
        'CSV',
        ',',
        rows
      );
    },
  },
  {
    id: 'banca_credito',
    title: 'Originación de Cartera Crediticia',
    sectorLabel: 'Bancario / Riesgo',
    description:
      '90 solicitudes evaluadas con ingreso mensual, score crediticio, ratio de endeudamiento, antigüedad laboral, segmento y monto aprobado.',
    rowCount: 90,
    build: () => {
      const rng = seededRand(108);
      const headers = [
        'Ingreso_Mensual_USD',
        'Score_Crediticio',
        'Ratio_Deuda_Pct',
        'Antiguedad_Laboral_Anios',
        'Segmento',
        'Monto_Aprobado_USD',
      ];
      const rows: unknown[][] = [headers];
      const segments = ['Preferente', 'Masivo', 'Pyme'];

      for (let i = 0; i < 90; i++) {
        const seg = segments[i % 3];
        const ingreso = Math.round(1400 + rng() * 6800);
        const score = Math.round(Math.min(850, Math.max(480, 560 + ingreso * 0.024 + normalRand(rng) * 55)));
        const deudaPct = Number(Math.min(68, Math.max(8, 42 - score * 0.025 + normalRand(rng) * 9)).toFixed(1));
        const antiguedad = Number(Math.max(0.5, 1 + rng() * 14).toFixed(1));
        const segBonus = seg === 'Preferente' ? 4500 : seg === 'Pyme' ? 2800 : 0;

        const monto =
          -6500 +
          ingreso * 2.85 +
          score * 28.5 -
          deudaPct * 210 +
          antiguedad * 460 +
          segBonus +
          normalRand(rng) * 1800;

        rows.push([
          ingreso,
          i === 27 ? null : score,
          deudaPct,
          antiguedad,
          seg,
          Math.max(1200, Math.round(monto)),
        ]);
      }
      return buildDatasetStateFromMatrix(
        'cartera_crediticia_banca.xlsx',
        'XLSX',
        'Hoja Excel',
        rows
      );
    },
  },
  {
    id: 'saas_mrr',
    title: 'Ingresos Recurrentes SaaS B2B',
    sectorLabel: 'Tecnológico / SaaS',
    description:
      '75 cuentas corporativas con usuarios activos, adopción de funcionalidades, tickets de soporte, plan contratado y MRR mensual.',
    rowCount: 75,
    build: () => {
      const rng = seededRand(777);
      const headers = [
        'Fecha_Cohorte',
        'Usuarios_Activos',
        'Adopcion_Pct',
        'Tickets_Soporte',
        'Plan',
        'MRR_USD',
      ];
      const rows: unknown[][] = [headers];
      const plans = ['Enterprise', 'Growth', 'Starter'];
      const baseDate = new Date(2024, 3, 1);

      for (let i = 0; i < 75; i++) {
        const dt = new Date(baseDate.getTime() + i * 5 * 86400000);
        const plan = plans[i % 3];
        const baseUsers = plan === 'Enterprise' ? 75 : plan === 'Growth' ? 32 : 12;
        const usuarios = Math.max(3, Math.round(baseUsers + rng() * 60 + normalRand(rng) * 8));
        const adopcion = Number(Math.min(99, Math.max(22, 48 + rng() * 44)).toFixed(1));
        const tickets = Math.max(0, Math.round(2 + usuarios * 0.14 + (100 - adopcion) * 0.12 + normalRand(rng) * 3));
        const planBonus = plan === 'Enterprise' ? 1400 : plan === 'Growth' ? 450 : 0;

        const mrr =
          180 +
          usuarios * 34.5 +
          adopcion * 11.2 -
          tickets * 18.4 +
          planBonus +
          normalRand(rng) * 210;

        rows.push([
          dt.toISOString().slice(0, 10),
          usuarios,
          i === 35 ? null : adopcion,
          tickets,
          plan,
          Math.max(150, Math.round(mrr)),
        ]);
      }
      return buildDatasetStateFromMatrix(
        'metricas_mrr_saas.csv',
        'CSV',
        ',',
        rows
      );
    },
  },
];
