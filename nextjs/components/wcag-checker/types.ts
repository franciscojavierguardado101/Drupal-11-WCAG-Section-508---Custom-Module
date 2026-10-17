export type ScanMode = "url" | "html";
export type Impact = "critical" | "serious" | "moderate" | "minor";

export interface ViolationNode {
  html: string;
  target: string[] | string[][];
  failureSummary?: string;
}

export interface AuditResult {
  id: string;
  impact: Impact | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: ViolationNode[];
}

export interface ScanResponse {
  mode: ScanMode;
  scannedUrl?: string;
  timestamp: string;
  hasCss?: boolean;
  violations: AuditResult[];
  incomplete: AuditResult[];
  passes: AuditResult[];
  inapplicable: number;
  testEngine?: { name: string; version: string };
  error?: string;
}

export interface WcagCheckerData {
  id: string;
  heading?: string;
}
