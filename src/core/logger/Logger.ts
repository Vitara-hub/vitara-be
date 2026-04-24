type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private context: string;
  private static minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "debug";

  constructor(context: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[Logger.minLevel];
  }

  private format(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`;
    return meta ? `${base} ${JSON.stringify(meta)}` : base;
  }

  debug(message: string, meta?: unknown): void {
    if (this.shouldLog("debug")) console.debug(this.format("debug", message, meta));
  }

  info(message: string, meta?: unknown): void {
    if (this.shouldLog("info")) console.info(this.format("info", message, meta));
  }

  warn(message: string, meta?: unknown): void {
    if (this.shouldLog("warn")) console.warn(this.format("warn", message, meta));
  }

  error(message: string, meta?: unknown): void {
    if (this.shouldLog("error")) console.error(this.format("error", message, meta));
  }
}
