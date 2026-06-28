import { defineStore } from 'pinia';
import { subscribeEvents, type SessionEvent } from '../api/sse.js';

interface State {
  events: SessionEvent[];
  live: boolean;
  sessionId: string | null;
  error: string | null;
}

export const useEventsStore = defineStore('events', {
  state: (): State => ({ events: [], live: false, sessionId: null, error: null }),
  actions: {
    subscribe(id: string): () => void {
      this.sessionId = id;
      this.events = [];
      this.live = true;
      this.error = null;
      const stop = subscribeEvents(
        id,
        (e) => {
          this.events.push(e);
          if (this.events.length > 1000) this.events.splice(0, this.events.length - 1000);
        },
        () => {
          this.live = false;
          this.error = 'stream closed';
        }
      );
      return () => {
        this.live = false;
        stop();
      };
    },
    clear(): void {
      this.events = [];
      this.live = false;
      this.sessionId = null;
    }
  }
});