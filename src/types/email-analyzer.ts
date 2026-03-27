export type ThreatLevel = "critical" | "high" | "medium" | "low" | "safe";

export interface EmailAnalysisRequest {
  emailContent: string;
}

export interface ThreatCategory {
  name: string;
  score: number;
  level: ThreatLevel;
  findings: string[];
  explanation: string;
}

export interface SuspiciousElement {
  type: "link" | "sender" | "attachment" | "language" | "impersonation" | "other";
  value: string;
  reason: string;
}

export interface EmailAnalysisResponse {
  overallScore: number;
  overallLevel: ThreatLevel;
  verdict: string;
  categories: ThreatCategory[];
  suspiciousElements: SuspiciousElement[];
  recommendations: string[];
  summary: string;
  analysedAt: string;
}
