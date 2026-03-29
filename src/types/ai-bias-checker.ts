export type BiasLevel = "minimal" | "low" | "moderate" | "significant" | "high";

export type BiasCategory =
  | "demographic"
  | "stereotyping"
  | "representation"
  | "assumption"
  | "framing";

export interface BiasInstance {
  id: string;
  category: BiasCategory;
  excerpt: string;
  issue: string;
  impact: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
}

export interface BiasCategoryAnalysis {
  category: BiasCategory;
  name: string;
  score: number;
  level: BiasLevel;
  description: string;
  findings: string[];
  explanation: string;
}

export interface BiasAnalysis {
  overallScore: number;
  overallLevel: BiasLevel;
  verdictText: string;
  categories: BiasCategoryAnalysis[];
  instances: BiasInstance[];
  positiveAspects: string[];
  rewriteSuggestions: string[];
  summary: string;
  educationalNote: string;
  analyzedAt: string;
}
