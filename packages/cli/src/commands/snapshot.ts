import type { UiCandidate } from "@uiheal/core";

export interface SnapshotPayload {
  version: number;
  createdAt: string;
  metadata: Record<string, unknown>;
  candidates: UiCandidate[];
}

export function createSnapshotPayload(candidates: UiCandidate[], metadata: Record<string, unknown>): SnapshotPayload {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    metadata,
    candidates
  };
}
