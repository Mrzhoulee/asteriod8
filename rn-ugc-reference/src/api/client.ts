import { API_BASE_URL } from "../config";

export type ReportReason = "harassment" | "hate_speech" | "nudity" | "spam" | "other";
export type ReportContentType = "song" | "comment" | "profile";

async function apiFetch(path: string, init: RequestInit & { userId?: string } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (init.userId) headers["x-user-id"] = init.userId;
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error(`API ${res.status}`);
    (err as Error & { body: unknown }).body = body;
    throw err;
  }
  return body;
}

export async function acceptTerms(userId: string, termsVersion = "1.0") {
  return apiFetch("/terms/accept", {
    method: "POST",
    userId,
    body: JSON.stringify({ termsVersion }),
  }) as Promise<{ userId: string; termsVersion: string; acceptedAt: string }>;
}

export async function getTermsStatus(userId: string) {
  return apiFetch(`/terms/status/${encodeURIComponent(userId)}`, {
    method: "GET",
    userId,
  }) as Promise<{ accepted: boolean; termsVersion?: string; acceptedAt?: string }>;
}

export async function getUserSettings(userId: string) {
  return apiFetch(`/users/${encodeURIComponent(userId)}/settings`, {
    method: "GET",
    userId,
  }) as Promise<{ userId: string; hideExplicit: boolean }>;
}

export async function patchUserSettings(userId: string, hideExplicit: boolean) {
  return apiFetch(`/users/${encodeURIComponent(userId)}/settings`, {
    method: "PATCH",
    userId,
    body: JSON.stringify({ hideExplicit }),
  }) as Promise<{ userId: string; hideExplicit: boolean }>;
}

export async function submitReport(
  userId: string,
  payload: {
    contentId: string;
    contentType: ReportContentType;
    reason: ReportReason;
    details?: string;
  }
) {
  return apiFetch("/reports", {
    method: "POST",
    userId,
    body: JSON.stringify(payload),
  }) as Promise<{ id: string; status: string; createdAt: string }>;
}

export async function submitBlock(userId: string, blockedUserId: string) {
  return apiFetch("/blocks", {
    method: "POST",
    userId,
    body: JSON.stringify({ blockedUserId }),
  }) as Promise<{ blockerId: string; blockedUserId: string; timestamp: string }>;
}

export async function validateText(text: string, context?: string) {
  return apiFetch("/moderation/validate-text", {
    method: "POST",
    body: JSON.stringify({ text, context }),
  }) as Promise<{
    ok: boolean;
    blocked: boolean;
    flagged: boolean;
    severeMatches: string[];
    mildMatches: string[];
  }>;
}
