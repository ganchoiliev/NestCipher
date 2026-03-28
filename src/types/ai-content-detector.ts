export type ContentVerdict = "human" | "likely_human" | "mixed" | "likely_ai" | "ai";

export interface SentenceAnalysis {
  text: string;
  aiProbability: number;
  verdict: ContentVerdict;
  signals: string[];
}

export interface DetectionSignal {
  name: string;
  score: number;
  verdict: ContentVerdict;
  description: string;
  findings: string[];
  explanation: string;
}

export interface ContentStats {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  vocabularyRichness: number;
  avgSentenceLength: number;
  longestSentence: number;
  shortestSentence: number;
}

export interface AIContentAnalysis {
  overallScore: number;
  overallVerdict: ContentVerdict;
  verdictText: string;
  confidence: number;
  signals: DetectionSignal[];
  sentenceAnalysis: SentenceAnalysis[];
  stats: ContentStats;
  summary: string;
  educationalNote: string;
  analyzedAt: string;
}
