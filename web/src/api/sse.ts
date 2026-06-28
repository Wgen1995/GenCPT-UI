export interface SessionEvent {
  type: string;
  sessionId: string;
  timestamp?: string;
  payload?: unknown;
}

export function subscribeEvents(
  sessionId: string,
  onEvent: (data: SessionEvent) => void,
  onError?: (err: Event) => void
): () => void {
  const es = new EventSource(`/api/sessions/${sessionId}/events/stream`);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data) as SessionEvent);
    } catch {
      /* ignore malformed frame */
    }
  };
  if (onError) es.onerror = onError;
  return () => es.close();
}