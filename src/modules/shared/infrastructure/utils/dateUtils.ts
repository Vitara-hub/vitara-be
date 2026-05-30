export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toUtcDateOnly(input: Date): string {
  return input.toISOString().slice(0, 10);
}

export function getDayBoundaries(dateOnly: string): {
  startIso: string;
  endIso: string;
} {
  const start = new Date(`${dateOnly}T00:00:00.000Z`);
  const end = new Date(`${dateOnly}T23:59:59.999Z`);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((item) => Number(item));
  return hours * 60 + minutes;
}

export function deriveSleepWindow(sleepTime: string, wakeTime: string): {
  start: Date;
  end: Date;
  durationHours: number;
} {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  const sleepMinutes = parseTimeToMinutes(sleepTime);
  const wakeMinutes = parseTimeToMinutes(wakeTime);

  const sleepHour = Math.floor(sleepMinutes / 60);
  const sleepMinute = sleepMinutes % 60;
  const wakeHour = Math.floor(wakeMinutes / 60);
  const wakeMinute = wakeMinutes % 60;

  const end = new Date(Date.UTC(year, month, day, wakeHour, wakeMinute, 0, 0));
  const start = new Date(
    Date.UTC(year, month, day, sleepHour, sleepMinute, 0, 0),
  );

  if (start > end) {
    start.setUTCDate(start.getUTCDate() - 1);
  }

  const durationHours = clamp(
    (end.getTime() - start.getTime()) / 3_600_000,
    0,
    24,
  );

  return {
    start,
    end,
    durationHours: Math.round(durationHours * 100) / 100,
  };
}
