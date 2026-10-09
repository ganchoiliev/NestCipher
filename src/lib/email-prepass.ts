/**
 * Deterministic pre-pass for the Email Analyzer (docs/THREAT-MODEL.md A3).
 *
 * Runs before the model and cannot be argued with. Each flag carries a floor
 * score; the final verdict can only go UP from the highest floor, so a
 * phishing email that successfully steers the model still comes back at
 * least "high" when it carries hidden manipulation.
 *
 * Score bands (shared with the model prompt):
 * safe 0-15, low 16-35, medium 36-60, high 61-85, critical 86-100.
 */

import type { ThreatLevel } from "@/types/email-analyzer";

export interface PrepassFlag {
  id: "ai-directed-instructions" | "unicode-tag-block" | "bidi-controls" | "zero-width" | "link-text-mismatch";
  label: string;
  detail: string;
  floorScore: number;
}

export interface PrepassResult {
  flags: PrepassFlag[];
  floorScore: number;
}

export function scoreToLevel(score: number): ThreatLevel {
  if (score >= 86) return "critical";
  if (score >= 61) return "high";
  if (score >= 36) return "medium";
  if (score >= 16) return "low";
  return "safe";
}

const HIGH_FLOOR = 70; // "high"
const MEDIUM_FLOOR = 50; // "medium"

// ── Detector 1: instructions aimed at an AI/automated reviewer ──

const AI_INSTRUCTION_PATTERNS: RegExp[] = [
  /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|your\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|prompts?|rules?|guidelines?)/i,
  /\b(?:ai|a\.i\.|llm|language\s+model|automated\s+(?:system|reviewer|scanner)|assistant|classifier|spam\s+filter|security\s+(?:scanner|filter|tool))\b[^.\n!?]{0,80}\b(?:mark|classify|treat|flag|rate|score|consider|label|report)\b[^.\n!?]{0,80}\b(?:safe|legitimate|legit|benign|trusted|clean|harmless|not\s+(?:spam|phishing|suspicious|malicious))\b/i,
  /\b(?:mark|classify|treat|flag|rate|score|consider|label|report)\b[^.\n!?]{0,80}\b(?:as\s+)?(?:safe|legitimate|legit|benign|trusted|clean|harmless|not\s+(?:spam|phishing|suspicious|malicious))\b[^.\n!?]{0,80}\b(?:ai|automated|reviewer|scanner|classifier|filter)\b/i,
  /\bto\s+(?:the|any)\s+(?:ai|automated\s+(?:system|reviewer)|model|assistant)\b/i,
  /\bnote\s+to\s+automated\s+systems?\b/i,
  /\b(?:system|hidden|developer)\s+prompt\b/i,
  /\bthis\s+(?:email|message)\s+(?:is|has\s+been)\s+(?:verified\s+(?:as\s+)?)?(?:legitimate|safe|not\s+phishing|whitelisted|pre[- ]?approved\s+by)\b[^.\n!?]{0,60}\b(?:ai|scanner|filter|security|system)\b/i,
];

function detectAiInstructions(content: string): PrepassFlag | null {
  for (const re of AI_INSTRUCTION_PATTERNS) {
    const m = content.match(re);
    if (m) {
      return {
        id: "ai-directed-instructions",
        label: "Hidden instructions aimed at automated analysis",
        detail: `Matched: "${m[0].slice(0, 120)}"`,
        floorScore: HIGH_FLOOR,
      };
    }
  }
  return null;
}

// ── Detector 2: invisible / deceptive Unicode ──

const TAG_BLOCK = /[\u{E0000}-\u{E007F}]/u;
const BIDI_CONTROLS = /[‪-‮⁦-⁩]/;
const ZERO_WIDTH = /[​-‍⁠﻿]/;

function countMatches(content: string, re: RegExp): number {
  return (content.match(new RegExp(re.source, re.flags.includes("u") ? "gu" : "g")) ?? []).length;
}

function detectInvisibleUnicode(content: string): PrepassFlag[] {
  const flags: PrepassFlag[] = [];
  if (TAG_BLOCK.test(content)) {
    flags.push({
      id: "unicode-tag-block",
      label: "Unicode tag-block characters (invisible text smuggling)",
      detail: `${countMatches(content, TAG_BLOCK)} tag-block character(s) found`,
      floorScore: HIGH_FLOOR,
    });
  }
  if (BIDI_CONTROLS.test(content)) {
    flags.push({
      id: "bidi-controls",
      label: "Bidirectional control characters (display-order spoofing)",
      detail: `${countMatches(content, BIDI_CONTROLS)} bidi control(s) found`,
      floorScore: HIGH_FLOOR,
    });
  }
  if (ZERO_WIDTH.test(content)) {
    flags.push({
      id: "zero-width",
      label: "Zero-width characters (hidden content or word-splitting)",
      detail: `${countMatches(content, ZERO_WIDTH)} zero-width character(s) found`,
      // Zero-width characters occasionally appear in legitimate marketing
      // mail, so alone they floor at "medium", not "high".
      floorScore: MEDIUM_FLOOR,
    });
  }
  return flags;
}

// ── Detector 3: link text that does not match its destination ──

function hostOf(raw: string): string | null {
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const URL_LIKE_TEXT = /(?:https?:\/\/|www\.)[^\s<>"']+|[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+\/?[^\s<>"']*/i;

function detectLinkMismatch(content: string): PrepassFlag | null {
  const pairs: Array<{ href: string; text: string }> = [];

  // HTML anchors
  const anchorRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of content.matchAll(anchorRe)) {
    pairs.push({ href: m[1], text: m[2].replace(/<[^>]+>/g, "").trim() });
  }
  // Markdown links
  const mdRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  for (const m of content.matchAll(mdRe)) {
    pairs.push({ href: m[2], text: m[1].trim() });
  }

  for (const { href, text } of pairs) {
    if (!URL_LIKE_TEXT.test(text)) continue; // text isn't pretending to be a URL
    const hrefHost = hostOf(href);
    const textHost = hostOf(text.match(URL_LIKE_TEXT)![0]);
    if (hrefHost && textHost && hrefHost !== textHost) {
      return {
        id: "link-text-mismatch",
        label: "Link text does not match its destination",
        detail: `Shown "${textHost}" but points to "${hrefHost}"`,
        floorScore: HIGH_FLOOR,
      };
    }
  }
  return null;
}

// ── Entry point ──

export function runEmailPrepass(content: string): PrepassResult {
  const flags: PrepassFlag[] = [];
  const ai = detectAiInstructions(content);
  if (ai) flags.push(ai);
  flags.push(...detectInvisibleUnicode(content));
  const link = detectLinkMismatch(content);
  if (link) flags.push(link);

  const floorScore = flags.reduce((max, f) => Math.max(max, f.floorScore), 0);
  return { flags, floorScore };
}
