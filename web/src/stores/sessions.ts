import { defineStore } from 'pinia';

export interface SessionSummary {
  id: string;
  name?: string;
  createdAt?: string;
  status?: string;
  [k: string]: unknown;
}

export interface SessionDetail extends SessionSummary {
  attrs?: Record<string, unknown>;
  artifacts?: Array<{ id: string; path: string; kind: string }>;
  events?: Array<Record<string, unknown>>;
}

interface State {
  list: SessionSummary[];
  current: SessionDetail | null;
  loading: boolean;
  error: string | null;
}

export const useSessionsStore = defineStore('sessions', {
  state: (): State => ({ list: [], current: null, loading: false, error: null }),
  actions: {
    async fetchList(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const mod = await import('../api/client.js');
        this.list = await mod.getJson<SessionSummary[]>('/api/sessions');
      } catch (e) {
        this.error = (e as Error).message;
      } finally {
        this.loading = false;
      }
    },
    async fetchDetail(id: string): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const mod = await import('../api/client.js');
        this.current = await mod.getJson<SessionDetail>(`/api/sessions/${id}`);
      } catch (e) {
        this.error = (e as Error).message;
      } finally {
        this.loading = false;
      }
    }
  }
});