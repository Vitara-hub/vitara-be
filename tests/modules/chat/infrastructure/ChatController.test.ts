import { describe, expect, test } from "bun:test";
import {
  buildAssistantStoredContent,
  parseAssistantStoredContent,
  unwrapAssistantPayload,
} from "../../../../src/modules/chat/application/services/CompanionMessageService.js";

describe("unwrapAssistantPayload", () => {
  test("should preserve recommendations from markdown fenced JSON response", () => {
    const raw =
      "```json { \"response\": \"Wah, mendengar kamu mengatakan hidup ini terasa keren membuatku ikut merasa senang! Senang sekali rasanya melihat mood kamu yang positif malam ini, meskipun tadi kamu sempat mengeluhkan rasa pegal di tubuh. Seringkali, saat kita bisa berdamai dengan rasa lelah fisik dan tetap melihat sisi terang dari hari yang kita jalani, itulah tanda ketangguhan mental yang luar biasa. Oh ya, melihat skor kualitas tidurmu yang masih 48/100 dengan beberapa kali terbangun semalam, mungkin rasa pegal itu juga dipengaruhi oleh istirahat yang kurang optimal. Tapi, dengan semangat positifmu sekarang, aku yakin besok kamu bisa bangun dengan perasaan yang jauh lebih segar!\", \"recommendations\": [ \"Karena kamu merasa sangat positif malam ini, cobalah tulis 3 hal kecil yang membuatmu merasa 'keren' hari ini di catatan ponselmu agar mood baik ini terjaga sampai besok pagi.\", \"Lakukan peregangan ringan 'Child\\u2019s Pose' di atas kasur selama 2 menit untuk membantu otot punggung yang pegal lebih rileks sebelum tidur.\", \"Alihkan perhatian dari layar gadget 15 menit lebih awal malam ini agar kualitas tidurmu bisa lebih baik dan tidak mudah terbangun lagi seperti malam sebelumnya.\", \"Siapkan segelas air putih di samping tempat tidur agar saat bangun nanti, kamu bisa langsung terhidrasi dengan baik.\" ] } ```";

    const payload = unwrapAssistantPayload(raw);

    expect(payload.response).toStartWith(
      "Wah, mendengar kamu mengatakan hidup ini terasa keren",
    );
    expect(payload.response).not.toContain("```json");
    expect(payload.recommendations).toEqual([
      "Karena kamu merasa sangat positif malam ini, cobalah tulis 3 hal kecil yang membuatmu merasa 'keren' hari ini di catatan ponselmu agar mood baik ini terjaga sampai besok pagi.",
      "Lakukan peregangan ringan 'Child\u2019s Pose' di atas kasur selama 2 menit untuk membantu otot punggung yang pegal lebih rileks sebelum tidur.",
      "Alihkan perhatian dari layar gadget 15 menit lebih awal malam ini agar kualitas tidurmu bisa lebih baik dan tidak mudah terbangun lagi seperti malam sebelumnya.",
      "Siapkan segelas air putih di samping tempat tidur agar saat bangun nanti, kamu bisa langsung terhidrasi dengan baik.",
    ]);
  });
});

describe("buildAssistantStoredContent", () => {
  test("should append recommendations into stored content", () => {
    const content = buildAssistantStoredContent("Jawaban utama", [
      "Minum air putih",
      "Tidur lebih awal",
    ]);

    expect(content).toContain("Jawaban utama");
    expect(content).toContain("Recommendations:");
    expect(content).toContain("- Minum air putih");
    expect(content).toContain("- Tidur lebih awal");
  });

  test("should keep plain response when recommendations are empty", () => {
    const content = buildAssistantStoredContent("Jawaban utama", []);
    expect(content).toBe("Jawaban utama");
  });
});

describe("parseAssistantStoredContent", () => {
  test("should parse stored assistant content and extract recommendations", () => {
    const stored = [
      "Jawaban utama",
      "",
      "Recommendations:",
      "- Minum air putih",
      "- Tidur lebih awal",
    ].join("\n");

    const parsed = parseAssistantStoredContent(stored);

    expect(parsed.response).toBe("Jawaban utama");
    expect(parsed.recommendations).toEqual([
      "Minum air putih",
      "Tidur lebih awal",
    ]);
  });

  test("should return plain response when recommendation marker not present", () => {
    const parsed = parseAssistantStoredContent("Jawaban utama");
    expect(parsed.response).toBe("Jawaban utama");
    expect(parsed.recommendations).toBeUndefined();
  });
});
