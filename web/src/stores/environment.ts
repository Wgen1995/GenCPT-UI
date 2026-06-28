import { defineStore } from 'pinia';

export interface EnvironmentInfo {
  gencptHome?: string;
  opencodeHome?: string;
  version?: string;
  containerTools?: Record<string, string>;
  scannedAt?: string;
  [k: string]: unknown;
}

interface State {
  data: EnvironmentInfo | null;
  loading: boolean;
  error: string | null;
}

export const useEnvironmentStore = defineStore('environment', {
  state: (): State => ({ data: null, loading: false, error: null }),
  actions: {
    async fetchEnvironment(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const mod = await import('../api/client.js');
        this.data = await mod.getJson<EnvironmentInfo>('/api/environment');
      } catch (e) {
        this.error = (e as Error).message;
      } finally {
        this.loading = false;
      }
    },
    async rescan(): Promise<void> {
      const mod = await import('../api/client.js');
      this.data = await mod.postJson<EnvironmentInfo>('/api/environment/rescan', {});
    }
  }
});