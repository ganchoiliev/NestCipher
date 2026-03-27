export type GradeLevel = "A+" | "A" | "B" | "C" | "D" | "F";

export type HeaderStatus = "pass" | "fail" | "partial";

export interface ScanRequest {
  url: string;
}

export interface HeaderResult {
  name: string;
  present: boolean;
  value: string | null;
  score: number;
  maxScore: number;
  status: HeaderStatus;
  description: string;
  recommendation: string | null;
}

export interface ServerInfo {
  ip: string | null;
  server: string | null;
  poweredBy: string | null;
}

export interface ScanResponse {
  url: string;
  grade: GradeLevel;
  score: number;
  maxScore: number;
  scannedAt: string;
  headers: HeaderResult[];
  serverInfo: ServerInfo;
}
