import { AgeGroup, ScreeningItem, TriageResults, DomainRisk } from '../types';
import matrixData from '../data/matrix.json';

const matrixInfo = matrixData as unknown as { age_groups: Record<string, any>, screening_matrix: ScreeningItem[] };

export class TriageEngine {
  static determineAgeGroup(ageMonths: number): AgeGroup {
    if (ageMonths <= 12) return 'A';
    if (ageMonths <= 24) return 'B';
    return 'C';
  }

  static getApplicableItems(ageGroup: AgeGroup): ScreeningItem[] {
    return matrixInfo.screening_matrix.filter(item => item.weights[ageGroup] && item.weights[ageGroup] > 0);
  }

  static calculateResults(responses: Record<string, number>, ageMonths: number): TriageResults {
    const ageGroup = this.determineAgeGroup(ageMonths);
    const domainRisks: Record<string, DomainRisk> = {};
    const redFlagsDetected: ScreeningItem[] = [];
    const maskingIndicatorsDetected: ScreeningItem[] = [];

    // Initialize domains
    const domains = [...new Set(matrixInfo.screening_matrix.map(i => i.domain))];
    domains.forEach(domain => {
      domainRisks[domain] = { score: 0, maxScore: 0, riskPercentage: 0 };
    });

    for (const [itemId, intensity] of Object.entries(responses)) {
      const item = matrixInfo.screening_matrix.find(i => i.id === itemId);
      if (!item) continue;

      const weight = item.weights[ageGroup] || 0;
      if (weight === 0) continue;

      const maxItemScore = 3 * weight;
      const actualScore = intensity * weight;

      domainRisks[item.domain].maxScore += maxItemScore;
      domainRisks[item.domain].score += actualScore;

      // Evaluate Red Flags
      if (item.is_red_flag && intensity >= 2) {
        redFlagsDetected.push(item);
      }

      // Evaluate Masking Indicators 
      if (item.is_masking_indicator && intensity >= 2) {
        maskingIndicatorsDetected.push(item);
      }
    }

    // Calculate domain percentages
    for (const domain of domains) {
      const stats = domainRisks[domain];
      if (stats.maxScore > 0) {
        stats.riskPercentage = (stats.score / stats.maxScore) * 100;
      }
    }

    // Rule 1: High neurodevelopmental risk if >= 2 red flags
    const highRisk = redFlagsDetected.length >= 2;

    // Rule 2: Masking warning
    // Posible sesgo si alto enmascaramiento pero interacción social reportada normal.
    // Asimilemos "alto enmascaramiento" a riskPercentage de Enmascaramiento >= 50%
    // Asimilemos "interacción social normal" a riskPercentage de Social < 30%
    const maskingDomain = domainRisks["Enmascaramiento"];
    const socialDomain = domainRisks["Social"];
    let maskingWarning = false;

    if (
      maskingDomain && socialDomain && 
      maskingDomain.riskPercentage >= 50 && 
      socialDomain.riskPercentage < 30
    ) {
      maskingWarning = true;
    }

    return {
      domainRisks,
      redFlagsDetected,
      maskingIndicatorsDetected,
      highRisk,
      maskingWarning
    };
  }
}
