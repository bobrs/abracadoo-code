import type { ClockAdapter } from "./ClockAdapter";

export class SystemClockAdapter implements ClockAdapter {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  nowMs(): number {
    return this.now().getTime();
  }
}
