import type { ValidationResult } from "../model/types.js";

export interface PreflightSummary {
  total: number;
  pass: number;
  repairable: number;
  failed: number;
  minConfidence: number;
  averageConfidence: number;
}

export function createPreflightSummary(results: ValidationResult[]): PreflightSummary {
  const total = results.length;
  const sum = results.reduce((value, item) => value + item.confidence, 0);
  return {
    total,
    pass: results.filter((item) => item.status === "pass").length,
    repairable: results.filter((item) => item.status === "repairable").length,
    failed: results.filter((item) => item.status === "failed").length,
    minConfidence: total === 0 ? 0 : Math.min(...results.map((item) => item.confidence)),
    averageConfidence: total === 0 ? 0 : Number((sum / total).toFixed(4))
  };
}
