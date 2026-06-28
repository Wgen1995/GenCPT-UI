import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import DashboardView from './views/DashboardView.vue';
import LaunchImportView from './views/LaunchImportView.vue';
import ExecutionView from './views/ExecutionView.vue';
import QualityGatesView from './views/QualityGatesView.vue';
import CandidatePanoramaView from './views/CandidatePanoramaView.vue';
import ToolAssetsView from './views/ToolAssetsView.vue';
import KnowledgeGraphView from './views/KnowledgeGraphView.vue';
import ComplianceView from './views/ComplianceView.vue';
import TriLibraryView from './views/TriLibraryView.vue';
import AttackValidationView from './views/AttackValidationView.vue';
import AttackChainView from './views/AttackChainView.vue';
import CoverageMatrixView from './views/CoverageMatrixView.vue';
import PocView from './views/PocView.vue';
import ReportsView from './views/ReportsView.vue';
import BaselineView from './views/BaselineView.vue';
import EvolutionView from './views/EvolutionView.vue';
import SettingsView from './views/SettingsView.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: DashboardView },
  { path: '/launch', name: 'launch', component: LaunchImportView },
  { path: '/sessions/:id/execution', name: 'execution', component: ExecutionView },
  { path: '/sessions/:id/quality', name: 'quality', component: QualityGatesView },
  {
    path: '/sessions/:id/candidate-panorama',
    name: 'candidate-panorama',
    component: CandidatePanoramaView
  },
  { path: '/tool-assets', name: 'tool-assets', component: ToolAssetsView },
  { path: '/sessions/:id/graph', name: 'graph', component: KnowledgeGraphView },
  { path: '/sessions/:id/compliance', name: 'compliance', component: ComplianceView },
  { path: '/sessions/:id/tri-library', name: 'tri-library', component: TriLibraryView },
  { path: '/sessions/:id/attacks', name: 'attacks', component: AttackValidationView },
  { path: '/sessions/:id/chains', name: 'chains', component: AttackChainView },
  { path: '/sessions/:id/coverage', name: 'coverage', component: CoverageMatrixView },
  { path: '/sessions/:id/poc', name: 'poc', component: PocView },
  { path: '/sessions/:id/reports', name: 'reports', component: ReportsView },
  { path: '/sessions/:id/baseline', name: 'baseline', component: BaselineView },
  { path: '/sessions/:id/evolution', name: 'evolution', component: EvolutionView },
  { path: '/settings', name: 'settings', component: SettingsView }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});