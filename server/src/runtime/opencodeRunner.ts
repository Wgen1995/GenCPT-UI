import { spawn } from 'node:child_process';

export type RunOpencodeInput = {
  command: string;
  gencptPath: string; // used as cwd
  prompt: string;
  model?: string;
  thinking?: boolean;
  variant?: string;
  agent?: string;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onSessionId?: (sessionId: string) => void;
};

export type RunOpencodeResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

const SESSION_ID_FAIL_AUTH_RE = /\b(balance|credit|quota|insufficient|unauthor|401|403|api key)\b/i;

function tryExtractSessionId(line: string, onSessionId?: (id: string) => void): void {
  if (!onSessionId) return;
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('{')) return;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    if (obj && obj.type === 'session') {
      const payload = obj.payload as Record<string, unknown> | undefined;
      const id = payload?.id;
      if (typeof id === 'string' && id.length > 0) {
        onSessionId(id);
      }
    }
  } catch {
    // not a JSON line — ignore
  }
}

export function runOpencode(input: RunOpencodeInput): Promise<RunOpencodeResult> {
  // The GenCPT skill is auto-discovered from ~/.config/opencode/skills/gencpt,
  // so we do NOT need `--dir <skill>`. We use gencptPath as cwd.
  // We use `--format json` to get machine-readable events, from which we extract
  // the opencode session id (payload.id on a `session` event line).
  const args = ['run', '--format', 'json'];
  if (input.model) args.push('-m', input.model);
  if (input.thinking) args.push('--thinking');
  if (input.variant) args.push('--variant', input.variant);
  if (input.agent) args.push('--agent', input.agent);
  args.push(input.prompt);

  const child = spawn(input.command, args, { cwd: input.gencptPath });
  let stdout = '';
  let stderr = '';
  let settled = false;
  let sessionIdFound = false;
  let stdoutLineBuf = '';

  return new Promise((resolve, reject) => {
    // No timeout: GenCPT assessments can run for hours or days. The process
    // runs to completion (or until the user/admin kills it externally).

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      input.onStdout?.(text);
      // `--format json` emits one JSON object per line. Buffer lines and try
      // to extract the opencode session id from any `session` event.
      if (!sessionIdFound && input.onSessionId) {
        stdoutLineBuf += text;
        let nl = stdoutLineBuf.indexOf('\n');
        while (nl !== -1) {
          const line = stdoutLineBuf.slice(0, nl);
          stdoutLineBuf = stdoutLineBuf.slice(nl + 1);
          tryExtractSessionId(line, (id) => {
            sessionIdFound = true;
            input.onSessionId?.(id);
          });
          nl = stdoutLineBuf.indexOf('\n');
        }
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      input.onStderr?.(text);
      // Detect immediate auth / balance failures and kill early so the user
      // does not have to wait for an unbounded run that has already failed.
      if (!settled && SESSION_ID_FAIL_AUTH_RE.test(text)) {
        setTimeout(() => {
          if (!settled) child.kill();
        }, 1500);
      }
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.on('close', (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode, stdout, stderr, timedOut: false });
    });
  });
}

export function buildGenCptPrompt(params: {
  server: string;
  mode: string;
  scope: string[];
  approval: string;
  sourcePath?: string;
  baseline?: string;
}): string {
  // Use the installed "gencpt" skill via slash-mention and pass the native
  // parameter format defined in SKILL.md so opencode routes the message to it.
  return [
    `/gencpt server=${params.server} mode=${params.mode} scope=${params.scope.join(',')} approval=${params.approval}`,
    params.sourcePath ? `source-path=${params.sourcePath}` : '',
    params.baseline ? `baseline=${params.baseline}` : '',
    '请使用已安装的 GenCPT 技能按其原生流程执行；所有原始证据和报告写入 GenCPT 自己创建的工作目录。'
  ]
    .filter(Boolean)
    .join('\n');
}