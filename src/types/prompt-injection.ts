export type AttackCategory =
  | "direct_override"
  | "role_manipulation"
  | "context_escape"
  | "instruction_injection"
  | "output_manipulation"
  | "information_extraction";

export type ResilienceLevel = "strong" | "moderate" | "weak" | "vulnerable";

export interface AttackTest {
  id: string;
  category: AttackCategory;
  name: string;
  description: string;
  payload: string;
  severity: "critical" | "high" | "medium";
}

export interface AttackResult {
  attackId: string;
  category: AttackCategory;
  name: string;
  passed: boolean;
  response: string;
  analysis: string;
  severity: "critical" | "high" | "medium";
  payload?: string;
}

export interface TestSuiteResult {
  systemPromptPreview: string;
  overallScore: number;
  resilienceLevel: ResilienceLevel;
  totalTests: number;
  passed: number;
  failed: number;
  results: AttackResult[];
  recommendations: string[];
  testedAt: string;
}
