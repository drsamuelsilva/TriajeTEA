import { AgeGroup, ScreeningItem, TriageResults, DomainRisk } from '../types';
import matrixData from '../data/matrix.json';

const matrixInfo = matrixData as unknown as { age_groups: Record<string, any>, screening_matrix: ScreeningItem[] };

export class TriageEngine {
  static determineAgeGroup(ageMonths: number): AgeGroup {
    // Menores de 18 meses -> 'A', Mayores o iguales -> 'B'
    if (ageMonths < 18) return 'A';
    return 'B';
  }

  static getApplicableItems(ageGroup: AgeGroup): ScreeningItem[] {
    return matrixInfo.screening_matrix.filter(item => item.weights[ageGroup] && item.weights[ageGroup] > 0);
  }

  static calculateResults(responses: Record<string, number>, ageMonths: number): TriageResults {
    const ageGroup = this.determineAgeGroup(ageMonths);
    const domainRisks: Record<string, DomainRisk> = {};
    const redFlagsDetected: ScreeningItem[] = [];
    const maskingIndicatorsDetected: ScreeningItem[] = [];
    const criticalItemsActive: ScreeningItem[] = [];

    // Inicializar dominios
    const domains = [...new Set(matrixInfo.screening_matrix.map(i => i.domain))];
    domains.forEach(domain => {
      domainRisks[domain] = { score: 0, maxScore: 0, riskPercentage: 0 };
    });

    let score = 0;

    for (const [itemId, value] of Object.entries(responses)) {
      const item = matrixInfo.screening_matrix.find(i => i.id === itemId);
      if (!item) continue;

      const weight = item.weights[ageGroup] || 0;
      if (weight === 0) continue;

      // Un cuestionario binario (0 = NO, 1 = SÍ)
      const isYes = value === 1;

      // Calcular para dominios
      domainRisks[item.domain].maxScore += 1;
      if (isYes) {
        domainRisks[item.domain].score += 1;
        score += 1;

        // Evaluar banderas rojas
        if (item.is_red_flag) {
          redFlagsDetected.push(item);
        }

        // Evaluar ítems críticos nucleares (1, 2, 3)
        if (item.is_critical) {
          criticalItemsActive.push(item);
        }
      }
    }

    // Calcular porcentajes de riesgo de los dominios
    for (const domain of domains) {
      const stats = domainRisks[domain];
      if (stats.maxScore > 0) {
        stats.riskPercentage = (stats.score / stats.maxScore) * 100;
      }
    }

    // Regla de Alerta Crítica (Critical Trigger)
    const criticalTriggerActive = criticalItemsActive.length > 0;

    // Lógica del Algoritmo de Riesgo Global
    // - Bajo Riesgo: 0-1 ítems marcados Y ningún ítem crítico activo.
    // - Riesgo Moderado: 2 ítems marcados, O 1 ítem crítico activo.
    // - Alto Riesgo: 3 o más ítems marcados, O más de un ítem crítico activo.
    let riskLevel: 'Bajo' | 'Moderado' | 'Alto' = 'Bajo';
    if (score >= 3 || criticalItemsActive.length > 1) {
      riskLevel = 'Alto';
    } else if (score === 2 || criticalItemsActive.length === 1) {
      riskLevel = 'Moderado';
    }

    const highRisk = riskLevel === 'Alto';

    return {
      domainRisks,
      redFlagsDetected,
      maskingIndicatorsDetected, // Se mantiene vacío por simplificación
      highRisk,
      maskingWarning: false,     // Se mantiene falso por simplificación
      score,
      riskLevel,
      criticalTriggerActive,
      criticalItemsActive
    };
  }
}
