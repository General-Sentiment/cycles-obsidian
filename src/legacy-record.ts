import { parseVisitedDate } from "./cycle";

export interface LegacyVisitRecord {
  notePath: string;
  lastVisitedAt: Date;
}

interface LegacyRecordCandidate {
  notePath?: unknown;
  lastVisitedAt?: unknown;
  lastReviewedAt?: unknown;
}

export function parseLegacyVisitRecord(value: unknown): LegacyVisitRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as LegacyRecordCandidate;
  if (typeof candidate.notePath !== "string" || !candidate.notePath.trim()) {
    return null;
  }

  const lastVisitedAt = parseVisitedDate(
    candidate.lastVisitedAt ?? candidate.lastReviewedAt
  );
  return lastVisitedAt
    ? { notePath: candidate.notePath.trim().replace(/\\/g, "/"), lastVisitedAt }
    : null;
}
