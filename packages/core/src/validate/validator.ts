import { textSimilarity } from "../context/context.js";
import type { UiCandidate, UiTarget, ValidationResult, ValidationSignal } from "../model/types.js";

function signal(name: string, score: number, weight: number, message: string): ValidationSignal {
  return { name, score, weight, message };
}

function sameNormalized(a?: string, b?: string): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function scoreFrame(target: UiTarget, candidate: UiCandidate): ValidationSignal {
  const expected = target.frame?.url ?? target.url;
  const actual = candidate.frame?.url ?? candidate.url;
  if (!expected || !actual) return signal("frame", 0.5, 0.15, "Frame URL missing on one side");
  const match = actual.startsWith(expected) || expected.startsWith(actual);
  return signal("frame", match ? 1 : 0, 0.15, match ? "Frame URL matched" : "Frame URL differed");
}

function selectorOverlap(target: UiTarget, candidate: UiCandidate): ValidationSignal {
  if (!candidate.selector) return signal("selector", 0, 0.1, "Candidate selector missing");
  const matched = target.selectors.some(
    (selector) =>
      selector.enabled &&
      selector.kind === candidate.selector?.kind &&
      selector.value.trim() === candidate.selector.value.trim()
  );
  return signal("selector", matched ? 1 : 0, 0.1, matched ? "Stored selector matched" : "Candidate uses repaired selector");
}

function scoreIdentity(target: UiTarget, candidate: UiCandidate): ValidationSignal[] {
  const targetElement = target.element;
  const candidateElement = candidate.element;
  return [
    signal("tag", sameNormalized(targetElement.tag, candidateElement.tag) ? 1 : 0, 0.15, "Tag comparison"),
    signal("type", !targetElement.type ? 0.5 : sameNormalized(targetElement.type, candidateElement.type) ? 1 : 0, 0.1, "Type comparison"),
    signal("id", !targetElement.id ? 0.5 : sameNormalized(targetElement.id, candidateElement.id) ? 1 : 0, 0.2, "ID comparison"),
    signal("name", !targetElement.name ? 0.5 : sameNormalized(targetElement.name, candidateElement.name) ? 1 : 0, 0.15, "Name comparison"),
    signal("label", textSimilarity(targetElement.label, candidateElement.label), 0.15, "Label similarity"),
    signal("text", textSimilarity(targetElement.text, candidateElement.text), 0.1, "Text similarity")
  ];
}

function aggregate(target: UiTarget, candidate: UiCandidate | undefined, signals: ValidationSignal[]): ValidationResult {
  const totalWeight = signals.reduce((sum, item) => sum + item.weight, 0);
  const weighted = signals.reduce((sum, item) => sum + item.score * item.weight, 0);
  const confidence = totalWeight === 0 ? 0 : Number((weighted / totalWeight).toFixed(4));
  const selectorMatched = signals.find((item) => item.name === "selector")?.score === 1;
  const status = confidence >= 0.8 && selectorMatched ? "pass" : confidence >= 0.6 ? "repairable" : "failed";
  return {
    targetId: target.id,
    status,
    confidence,
    matchedCandidate: candidate,
    signals,
    reason:
      status === "pass"
        ? "Stored selector and element context matched"
        : status === "repairable"
          ? "Stored selector needs repair but element context is close"
          : "No candidate reached the confidence threshold"
  };
}

export function scoreCandidate(target: UiTarget, candidate: UiCandidate): ValidationResult {
  const signals = [scoreFrame(target, candidate), selectorOverlap(target, candidate), ...scoreIdentity(target, candidate)];
  return aggregate(target, candidate, signals);
}

export function validateTarget(target: UiTarget, candidates: UiCandidate[]): ValidationResult {
  if (candidates.length === 0) {
    return {
      targetId: target.id,
      status: "failed",
      confidence: 0,
      signals: [],
      reason: "No candidates were provided"
    };
  }
  return candidates.map((candidate) => scoreCandidate(target, candidate)).sort((a, b) => b.confidence - a.confidence)[0];
}
