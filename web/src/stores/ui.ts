import { defineStore } from 'pinia';

type Theme = 'dark' | 'cyber' | 'auto';

interface State {
  currentSessionId: string | null;
  sidebarCollapsed: boolean;
  theme: Theme;
  denseTables: boolean;
}

export const useUiStore = defineStore('ui', {
  state: (): State => ({
    currentSessionId: null,
    sidebarCollapsed: false,
    theme: 'dark',
    denseTables: false
  }),
  actions: {
    setCurrentSession(id: string | null): void {
      this.currentSessionId = id;
    },
    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    setTheme(theme: Theme): void {
      this.theme = theme;
    }
  }
});