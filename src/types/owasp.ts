export type RiskLevel = "critical" | "high" | "medium";

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface OwaspVulnerability {
  id: string;
  rank: string;
  title: string;
  riskLevel: RiskLevel;
  summary: string;
  description: string;
  realWorldExample: string;
  impact: string[];
  mitigations: string[];
  tags: string[];
  quiz: QuizQuestion;
}
