export interface SessionEvent {
  type: string;
  eventType?: string;
  sessionId: string;
  id?: number;
  timestamp?: string;
  createdAt?: string;
  payload?: Record<string, unknown> | null;
}

export function subscribeEvents(
  sessionId: string,
  onEvent: (data: SessionEvent) => void,
  onError?: (err: Event) => void
): () => void {
  const es = new EventSource(`/api/sessions/${sessionId}/events/stream`);
  
  // Handle default message events (no event: field)
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as SessionEvent;
      onEvent(data);
    } catch {
      /* ignore malformed frame */
    }
  };

  // Handle named events from Hono writeSSE
  // Hono sends: event: opencode.stdout\ndata: {...}\n\n
  // EventSource fires events with the named event type
  const eventTypes = [
    'opencode.stdout', 'opencode.stderr', 'gencpt.run.started',
    'assessment.failed', 'assessment.error', 'assessment.completed',
    'phase.started', 'phase.completed', 'approval.requested', 'approval.decided',
    'circuit_breaker.triggered', 'gencpt.session.ingested'
  ];
  for (const et of eventTypes) {
    es.addEventListener(et, (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as SessionEvent;
        onEvent(data);
      } catch {
        /* ignore */
      }
    });
  }

  if (onError) es.onerror = onError;
  return () => es.close();
}