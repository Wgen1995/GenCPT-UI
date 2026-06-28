import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname, relative, sep } from 'node:path';

export type ReportEntry = {
  relativePath: string;
  reportType: string;
  size: number;
};

export type ParsedReports = {
  reports: ReportEntry[];
  warnings: string[];
};

function inferReportType(fileName: string): string {
  const stem = basename(fileName, extname(fileName));
  // e.g. pentest_report.md -> pentest_report; compliance_summary.json -> compliance_summary
  return stem;
}

function walkReportFiles(dir: string): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // recurse into subdirectories such as poc_package/
      out.push(...walkReportFiles(full));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (ext === '.md' || ext === '.json') {
        out.push(full);
      }
    }
  }
  return out;
}

function pushReport(
  reports: ReportEntry[],
  reportsDir: string,
  full: string
): void {
  let size = 0;
  try {
    size = statSync(full).size;
  } catch {
    size = 0;
  }
  const rel = relative(reportsDir, full).split(sep).join('/');
  reports.push({
    relativePath: `reports/${rel}`,
    reportType: inferReportType(full),
    size
  });
}

function collectInsights(sessionDir: string, reports: ReportEntry[]): void {
  // GenCPT sessions may store insights under either of two evidence paths.
  const candidates = ['evidence/insights.md', 'evidence/attack/insights.md'];
  for (const cand of candidates) {
    const full = join(sessionDir, cand);
    if (existsSync(full) && statSync(full).isFile()) {
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        size = 0;
      }
      reports.push({
        relativePath: cand,
        reportType: 'insights',
        size
      });
    }
  }
}

export function parseReports(sessionDir: string): ParsedReports {
  const warnings: string[] = [];
  const reports: ReportEntry[] = [];
  const reportsDir = join(sessionDir, 'reports');
  if (!existsSync(reportsDir)) {
    warnings.push(`reports directory missing: ${reportsDir}`);
  } else {
    const files = walkReportFiles(reportsDir);
    for (const full of files) {
      pushReport(reports, reportsDir, full);
    }
  }

  // insights compatibility: GenCPT may store final insights outside reports/
  collectInsights(sessionDir, reports);

  return { reports, warnings };
}