export type AgeGroup = 'A' | 'B';

export interface AgeGroupConfig {
  id: AgeGroup;
  label: string;
  min_months: number;
  max_months: number;
}

export interface ScreeningItem {
  id: string;
  domain: string;
  text_es: string;
  weights: Record<AgeGroup, number>;
  is_red_flag: boolean;
  is_masking_indicator?: boolean;
  is_critical?: boolean;
}

export interface ScreeningMatrix {
  age_groups: Record<AgeGroup, AgeGroupConfig>;
  screening_matrix: ScreeningItem[];
}

export interface Patient {
  id: string;
  name: string;
  birthDate: string;
  sex: 'masculino' | 'femenino' | 'otro';
  gestationalWeeks?: number;
  visionEvaluated: boolean; // Control biológico Fase 1
  hearingEvaluated: boolean; // Control biológico Fase 1
  developmentalMilestones: string[]; // Hitos observados
  history?: string;
  evaluations: EvaluationSession[];
}

export interface EvaluationSession {
  id: string;
  date: string;
  ageMonths: number;
  responses: Record<string, number>; // itemId -> 0 (NO) o 1 (SÍ)
  results: TriageResults;
}

export interface DomainRisk {
  score: number;
  maxScore: number;
  riskPercentage: number;
}

export interface TriageResults {
  domainRisks: Record<string, DomainRisk>;
  redFlagsDetected: ScreeningItem[];
  maskingIndicatorsDetected: ScreeningItem[];
  highRisk: boolean;
  maskingWarning: boolean;
  aiReport?: string;
  
  // Nuevos campos del algoritmo de 6 ítems
  score: number;
  riskLevel: 'Bajo' | 'Moderado' | 'Alto';
  criticalTriggerActive: boolean;
  criticalItemsActive: ScreeningItem[];
}
