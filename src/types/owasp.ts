export type RiskLevel = "critical" | "high" | "medium";
export type Difficulty = "introductory" | "intermediate" | "advanced";

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
  difficulty: Difficulty;
  quiz: QuizQuestion;
}
