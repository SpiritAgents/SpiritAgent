import type { SessionBundle } from './session-bundle.js';
import { shouldAdvanceWorktreeBootstrap } from './worktree-bootstrap-orchestrator.js';

/** 泵 tick 间隔：决定流式事件消费与 UI 推送的最小节奏。 */
export const SESSION_PUMP_INTERVAL_MS = 25;

/** live snapshot 节流推送间隔（leading+trailing）。 */
export const LIVE_SNAPSHOT_EMIT_THROTTLE_MS = 33;

/** busy 但无变更时的心跳推送间隔（spinner / 计时等宿主态动画依赖推送刷新）。 */
export const LIVE_SNAPSHOT_BUSY_HEARTBEAT_MS = 150;

/** 与 pollCommand 的 tick 条件一致：runtime busy 或 worktree bootstrap 待推进。 */
export function sessionBundleNeedsPumpTick(bundle: SessionBundle): boolean {
  return bundle.runtime?.isBusy() === true || shouldAdvanceWorktreeBootstrap(bundle);
}

/** 环境变量 `SPIRIT_DESKTOP_PUMP_DEBUG`：设为 1/true/on 时输出泵的启停与 tick 频率统计。 */
function pumpDebugEnabled(): boolean {
  const raw = process.env.SPIRIT_DESKTOP_PUMP_DEBUG?.trim().toLowerCase() ?? '';
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

const PUMP_DEBUG_STATS_INTERVAL_MS = 5_000;

export interface SessionPumpOptions {
  /** True while any session still needs pump ticks; pump stops when false. */
  hasPumpWork(): boolean;
  /** One serialized pump tick (advance runtimes, integrate events). */
  runTick(): Promise<void>;
  intervalMs?: number;
  onTickError?(error: unknown): void;
}

/**
 * 主进程自驱泵：busy 会话的回合推进不再依赖 renderer 的 poll 循环。
 * 任一入口命令使会话变 busy 后调用 ensureRunning()，泵以固定间隔 tick 直到全部空闲。
 */
export class SessionPump {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private debugTickCount = 0;
  private debugTickDurationMs = 0;
  private debugWindowStartedAtMs = 0;

  constructor(private readonly options: SessionPumpOptions) {}

  get intervalMs(): number {
    return this.options.intervalMs ?? SESSION_PUMP_INTERVAL_MS;
  }

  isRunning(): boolean {
    return this.running;
  }

  ensureRunning(): void {
    if (this.running) {
      return;
    }
    if (!this.options.hasPumpWork()) {
      return;
    }
    this.running = true;
    if (pumpDebugEnabled()) {
      console.log('[desktop-host][pump] start');
      this.debugTickCount = 0;
      this.debugTickDurationMs = 0;
      this.debugWindowStartedAtMs = Date.now();
    }
    this.scheduleNext(0);
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.running = false;
  }

  private scheduleNext(delayMs: number): void {
    const timer = setTimeout(() => {
      this.timer = undefined;
      void this.tick();
    }, delayMs);
    // 泵不应阻止主进程退出（Electron quit / 测试进程结束）。
    timer.unref?.();
    this.timer = timer;
  }

  private async tick(): Promise<void> {
    const startedAtMs = Date.now();
    try {
      await this.options.runTick();
    } catch (error) {
      this.options.onTickError?.(error);
    }
    if (pumpDebugEnabled()) {
      this.debugTickCount += 1;
      this.debugTickDurationMs += Date.now() - startedAtMs;
      const windowMs = Date.now() - this.debugWindowStartedAtMs;
      if (windowMs >= PUMP_DEBUG_STATS_INTERVAL_MS) {
        const hz = (this.debugTickCount / windowMs) * 1_000;
        const avgMs = this.debugTickDurationMs / Math.max(1, this.debugTickCount);
        console.log(
          `[desktop-host][pump] ticks=${this.debugTickCount} rate=${hz.toFixed(1)}/s avgTick=${avgMs.toFixed(1)}ms`,
        );
        this.debugTickCount = 0;
        this.debugTickDurationMs = 0;
        this.debugWindowStartedAtMs = Date.now();
      }
    }
    if (!this.running) {
      return;
    }
    if (!this.options.hasPumpWork()) {
      this.running = false;
      if (pumpDebugEnabled()) {
        console.log('[desktop-host][pump] idle, stop');
      }
      return;
    }
    this.scheduleNext(this.intervalMs);
  }
}
