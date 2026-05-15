export function mapEmotionLabel(emotion: string): string {
  const normalized = emotion.toLowerCase();
  const labels: Record<string, string> = {
    happy: "Bahagia",
    calm: "Tenang",
    neutral: "Netral",
    anxious: "Cemas",
    stressed: "Stres",
    sad: "Sedih",
    angry: "Marah",
  };

  return labels[normalized] ?? "Netral";
}

export function mapStressLabel(stressDimension: number): string {
  if (stressDimension >= 70) return "Rendah";
  if (stressDimension >= 40) return "Sedang";
  return "Tinggi";
}

export function mapHealthStatusLabel(score: number): {
  statusLabel: string;
  suggestion: string;
} {
  if (score >= 80) {
    return {
      statusLabel: "Sehat & Senang",
      suggestion:
        "Vee kelihatan sangat sehat hari ini! Terus pertahankan rutinitas baikmu.",
    };
  }

  if (score >= 60) {
    return {
      statusLabel: "Cukup Seimbang",
      suggestion:
        "Kondisimu cukup baik. Coba tambah tidur berkualitas dan hidrasi ya.",
    };
  }

  return {
    statusLabel: "Perlu Perhatian",
    suggestion:
      "Kondisimu lagi menurun. Coba istirahat, makan teratur, dan tarik napas pelan.",
  };
}
