import type { ToolExecutor } from '../ports.js';
import type { RealtimeEvent, RealtimeSession } from './types.js';

export interface RealtimeToolRunnerOptions {
  toolExecutor: ToolExecutor;
  continueResponseAfterToolResult?: boolean;
}

export class RealtimeToolRunner {
  private running = false;
  private loopTask: Promise<void> | null = null;

  constructor(
    private readonly session: RealtimeSession,
    private readonly options: RealtimeToolRunnerOptions,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.loopTask = this.runLoop();
  }

  stop(): void {
    this.running = false;
  }

  async processEvent(event: RealtimeEvent): Promise<void> {
    if (event.type !== 'function-call-arguments-done') {
      return;
    }
    await this.handleFunctionCall(event);
  }

  private async runLoop(): Promise<void> {
    try {
      for await (const event of this.session.events()) {
        if (!this.running) {
          return;
        }
        await this.processEvent(event);
      }
    } finally {
      this.running = false;
    }
  }

  private async handleFunctionCall(
    event: Extract<RealtimeEvent, { type: 'function-call-arguments-done' }>,
  ): Promise<void> {
    const continueResponse = this.options.continueResponseAfterToolResult ?? true;
    try {
      const output = await this.executeToolCall(event.name, event.argumentsJson);
      await this.session.submitToolResult({
        callId: event.callId,
        name: event.name,
        output,
      });
    } catch (error) {
      await this.session.submitToolResult({
        callId: event.callId,
        name: event.name,
        output: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      });
    }

    if (continueResponse) {
      await this.session.requestResponse();
    }
  }

  private async executeToolCall(name: string, argumentsJson: string): Promise<string> {
    const request = await this.options.toolExecutor.requestFromFunctionCall(name, argumentsJson);
    const authorization = await this.options.toolExecutor.authorize(request);
    if (authorization.kind !== 'allowed') {
      return JSON.stringify({
        error: 'authorization_denied',
        kind: authorization.kind,
      });
    }

    const result = await this.options.toolExecutor.execute(request);
    return result.summaryText;
  }
}
