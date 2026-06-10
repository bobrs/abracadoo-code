export interface ClockAdapter {
  now(): Date;
  nowIso(): string;
  nowMs(): number;
}
