export class SystemClock {
  private startTime: number = 0;
  private _timeScale: number = 1;
  private _paused: boolean = false;
  private _pausedAt: number = 0;
  private _totalPausedTime: number = 0;

  start(): void {
    this.startTime = Date.now();
    this._paused = false;
    this._pausedAt = 0;
    this._totalPausedTime = 0;
  }

  now(): number {
    if (this.startTime === 0) {
      return 0;
    }
    if (this._paused) {
      return (this._pausedAt - this.startTime - this._totalPausedTime) * this._timeScale;
    }
    return (Date.now() - this.startTime - this._totalPausedTime) * this._timeScale;
  }

  elapsed(): number {
    return this.now();
  }

  pause(): void {
    if (!this._paused && this.startTime !== 0) {
      this._paused = true;
      this._pausedAt = Date.now();
    }
  }

  resume(): void {
    if (this._paused) {
      this._totalPausedTime += Date.now() - this._pausedAt;
      this._paused = false;
      this._pausedAt = 0;
    }
  }

  get timeScale(): number {
    return this._timeScale;
  }

  set timeScale(scale: number) {
    this._timeScale = scale;
  }

  reset(): void {
    this.startTime = 0;
    this._timeScale = 1;
    this._paused = false;
    this._pausedAt = 0;
    this._totalPausedTime = 0;
  }
}
