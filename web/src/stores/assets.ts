import { defineStore } from 'pinia';

export interface AssetEntry {
  id: string;
  name: string;
  path: string;
  kind: string;
  size?: number;
  scannedAt?: string;
  [k: string]: unknown;
}

interface State {
  index: AssetEntry[];
  loading: boolean;
  error: string | null;
}

export const useAssetsStore = defineStore('assets', {
  state: (): State => ({ index: [], loading: false, error: null }),
  actions: {
    async fetchAssets(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const mod = await import('../api/client.js');
        this.index = await mod.getJson<AssetEntry[]>('/api/assets');
      } catch (e) {
        this.error = (e as Error).message;
      } finally {
        this.loading = false;
      }
    },
    async rescan(): Promise<void> {
      const mod = await import('../api/client.js');
      this.index = await mod.postJson<AssetEntry[]>('/api/assets/rescan', {});
    }
  }
});