export interface CdpRuntime {
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  on(method: string, handler: (params: unknown) => void): () => void;
  close(): void;
}

export async function createCdpRuntime(webSocketDebuggerUrl: string): Promise<CdpRuntime> {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map<number, (value: unknown) => void>();
  const handlers = new Map<string, Set<(params: unknown) => void>>();

  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method && handlers.has(message.method)) {
      for (const handler of handlers.get(message.method) ?? []) {
        handler(message.params);
      }
    }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  };

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("Unable to open CDP WebSocket"));
  });

  return {
    send<T = unknown>(method: string, params: Record<string, unknown> = {}) {
      return new Promise<T>((resolve) => {
        const messageId = ++id;
        pending.set(messageId, (value) => resolve(value as T));
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    on(method: string, handler: (params: unknown) => void) {
      const set = handlers.get(method) ?? new Set<(params: unknown) => void>();
      set.add(handler);
      handlers.set(method, set);
      return () => {
        set.delete(handler);
      };
    },
    close() {
      ws.close();
    }
  };
}
