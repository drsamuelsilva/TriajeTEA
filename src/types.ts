export type AgeGroup = 'A' | 'B' | 'C';

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
  responses: Record<string, number>; // itemId -> intensity (0,1,2,3)
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
}
