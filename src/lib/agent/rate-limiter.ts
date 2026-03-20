export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxMessages: number = 20,
    private windowMs: number = 60_000
  ) {}

  canSend(): boolean {
    this.prune();
    return this.timestamps.length < this.maxMessages;
  }

  record(): void {
    this.timestamps.push(Date.now());
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }
}
