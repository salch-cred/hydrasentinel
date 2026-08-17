export type Severity = "critical" | "high" | "moderate";

export function severityOf(downloads: number): Severity {
  if (downloads >= 1_000_000) return "critical";
  if (downloads >= 100_000) return "high";
  return "moderate";
}
