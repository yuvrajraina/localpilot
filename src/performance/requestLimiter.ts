type RequestKind = 'inline' | 'chat';

type RunningRequest = {
  controller: AbortController;
};

export class LocalPilotRequestLimiter {
  private readonly running = new Map<RequestKind, RunningRequest>();

  public startInlineRequest(): AbortController {
    this.cancel('inline');

    return this.start('inline');
  }

  public startChatRequest(): AbortController {
    return this.start('chat');
  }

  public finish(kind: RequestKind, controller: AbortController): void {
    const running = this.running.get(kind);

    if (running?.controller === controller) {
      this.running.delete(kind);
    }
  }

  public cancel(kind: RequestKind): void {
    const running = this.running.get(kind);

    if (!running) {
      return;
    }

    running.controller.abort();
    this.running.delete(kind);
  }

  public dispose(): void {
    this.cancel('inline');
    this.cancel('chat');
  }

  private start(kind: RequestKind): AbortController {
    const existing = this.running.get(kind);

    if (kind === 'chat' && existing) {
      return existing.controller;
    }

    const controller = new AbortController();

    this.running.set(kind, {
      controller
    });

    return controller;
  }
}
