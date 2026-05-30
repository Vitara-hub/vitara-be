export type AssistantResponsePayload = {
  response: string;
  recommendations?: string[];
};

export type CompanionSseData =
  | { token: string }
  | { full_response: string; recommendations?: unknown };

export type JsonTokenStreamState = {
  enabled: boolean;
  seenFence: boolean;
  buffer: string;
  capturing: boolean;
  done: boolean;
  escape: boolean;
};

export function sanitizeTextForStorage(input: string): string {
  const stripped = input
    .split("\u0000")
    .join("")
    .replace(/[^\P{C}\n\r\t]+/gu, "")
    .trim();

  const normalized = stripped
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  const MAX_LEN = 8000;
  return normalized.length > MAX_LEN ? `${normalized.slice(0, MAX_LEN)}…` : normalized;
}

export function buildAssistantStoredContent(
  response: string,
  recommendations?: string[],
): string {
  const sanitizedResponse = sanitizeTextForStorage(response);
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return sanitizedResponse;
  }

  const normalizedRecommendations = recommendations
    .map((item) => sanitizeTextForStorage(item))
    .filter((item) => item.length > 0);

  if (normalizedRecommendations.length === 0) {
    return sanitizedResponse;
  }

  const recommendationBlock = normalizedRecommendations
    .map((item) => `- ${item}`)
    .join("\n");

  return `${sanitizedResponse}\n\nRecommendations:\n${recommendationBlock}`;
}

export function parseAssistantStoredContent(content: string): AssistantResponsePayload {
  const normalized = sanitizeTextForStorage(content);
  const marker = "\n\nRecommendations:\n";
  const markerIndex = normalized.indexOf(marker);

  if (markerIndex === -1) {
    return { response: normalized };
  }

  const response = normalized.slice(0, markerIndex).trim();
  const recommendationRaw = normalized.slice(markerIndex + marker.length);
  const recommendations = recommendationRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => sanitizeTextForStorage(line.slice(2)))
    .filter((line) => line.length > 0);

  return {
    response,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  };
}

function payloadFromParsedAssistantJson(
  parsed: Record<string, unknown>,
): AssistantResponsePayload | null {
  const fromAssistantMessage =
    typeof parsed.assistantMessage === "string" ? parsed.assistantMessage : null;
  const fromResponse = typeof parsed.response === "string" ? parsed.response : null;

  if (!fromAssistantMessage && !fromResponse) {
    return null;
  }

  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : undefined;

  return {
    response: String(fromAssistantMessage ?? fromResponse ?? ""),
    recommendations,
  };
}

export function unwrapAssistantPayload(text: string): AssistantResponsePayload {
  const candidate = text.trim();

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const payload = payloadFromParsedAssistantJson(parsed);
    if (payload) return payload;
  } catch {
    // ignore
  }

  const jsonBlockMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1] ?? "{}") as Record<string, unknown>;
      const payload = payloadFromParsedAssistantJson(parsed);
      if (payload) return payload;
    } catch {
      // ignore
    }
  }

  return { response: candidate };
}

export function createJsonTokenStreamState(): JsonTokenStreamState {
  return {
    enabled: false,
    seenFence: false,
    buffer: "",
    capturing: false,
    done: false,
    escape: false,
  };
}

export function extractResponseTextFromJsonTokens(
  tokenChunk: string,
  state: JsonTokenStreamState,
): string {
  if (state.done) return "";

  const chunk = tokenChunk ?? "";
  const fenceMatch = chunk.includes("```json") || chunk.includes("```");
  const looksJson =
    fenceMatch ||
    chunk.includes("\"response\"") ||
    (state.buffer.length === 0 && chunk.trimStart().startsWith("{"));

  if (!state.enabled && looksJson) {
    state.enabled = true;
  }

  if (!state.enabled) {
    return sanitizeTextForStorage(chunk);
  }

  if (fenceMatch) state.seenFence = true;

  state.buffer += chunk;
  if (state.buffer.length > 20000) {
    state.buffer = state.buffer.slice(-20000);
  }

  if (!state.capturing) {
    const idx = state.buffer.indexOf("\"response\"");
    if (idx === -1) return "";

    const colon = state.buffer.indexOf(":", idx);
    if (colon === -1) return "";
    const firstQuote = state.buffer.indexOf("\"", colon);
    if (firstQuote === -1) return "";

    state.capturing = true;
    state.escape = false;
    state.buffer = state.buffer.slice(firstQuote + 1);
  }

  let out = "";
  let i = 0;
  for (; i < state.buffer.length; i++) {
    const ch = state.buffer[i]!;
    if (state.escape) {
      if (ch === "n") out += "\n";
      else if (ch === "r") out += "\r";
      else if (ch === "t") out += "\t";
      else out += ch;
      state.escape = false;
      continue;
    }

    if (ch === "\\") {
      state.escape = true;
      continue;
    }

    if (ch === "\"") {
      state.done = true;
      i++;
      break;
    }

    out += ch;
  }

  state.buffer = state.buffer.slice(i);

  return sanitizeTextForStorage(out);
}

export function tryParseCompanionData(raw: string): CompanionSseData | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.token === "string") return { token: parsed.token };
    if (typeof parsed.full_response === "string") {
      return {
        full_response: parsed.full_response,
        recommendations: parsed.recommendations,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function sanitizeCompanionDataEvent(data: CompanionSseData): CompanionSseData {
  if ("token" in data) {
    return { token: sanitizeTextForStorage(data.token) };
  }

  const payload = unwrapAssistantPayload(data.full_response);
  const rawRecommendations = Array.isArray(data.recommendations)
    ? data.recommendations
    : payload.recommendations;
  const recs =
    Array.isArray(rawRecommendations)
      ? rawRecommendations
          .filter((item): item is string => typeof item === "string")
          .map((item) => sanitizeTextForStorage(item))
          .filter((item) => item.length > 0)
          .slice(0, 6)
      : undefined;

  return {
    full_response: sanitizeTextForStorage(payload.response),
    recommendations: recs,
  };
}

export function createCompanionFallbackResponse(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("capek") || normalized.includes("lelah")) {
    return "Aku dengar kamu lagi capek. Coba ambil jeda 5 menit: tarik napas pelan 4 hitungan, tahan 4 hitungan, lalu hembuskan 6 hitungan. Setelah itu lanjut satu tugas kecil dulu ya.";
  }

  if (normalized.includes("cemas") || normalized.includes("anxious")) {
    return "Rasa cemas itu valid. Coba tulis 3 hal yang bisa kamu kontrol hari ini, lalu fokus ke yang paling kecil dulu. Kamu nggak harus menyelesaikan semuanya sekaligus.";
  }

  return "Terima kasih sudah cerita. Aku siap bantu kapan pun. Untuk langkah sekarang, coba minum air, atur napas selama 1 menit, lalu pilih satu aktivitas ringan yang paling mungkin kamu kerjakan.";
}
