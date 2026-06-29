import { defineStore } from 'pinia';

type Theme = 'dark' | 'cyber' | 'auto';

interface State {
  currentSessionId: string | null;
  sidebarCollapsed: boolean;
  theme: Theme;
  denseTables: boolean;
  codeRain: boolean;
}

export const useUiStore = defineStore('ui', {
  state: (): State => ({
    currentSessionId: null,
    sidebarCollapsed: false,
    theme: 'dark',
    denseTables: false,
    codeRain: true
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
    },
    toggleCodeRain(): void {
      this.codeRain = !this.codeRain;
    }
  }
});