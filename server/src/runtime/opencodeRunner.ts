import { spawn } from 'node:child_process';

export type RunOpencodeInput = {
  command: string;
  gencptPath: string;
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

function tryExtractSessionId(line: string, cb?: (id: string) => void): void {
  if (!cb) return;
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) return;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    if (obj.sessionID) {
      cb(String(obj.sessionID));
    }
  } catch {}
}

export function runOpencode(input: RunOpencodeInput): { promise: Promise<RunOpencodeResult>; kill: () => void } {
  // opencode requires a TTY to output to stdout. We wrap with `script` to create a PTY.
  const opencodeArgs = ['run', '--format', 'json'];
  if (input.model) opencodeArgs.push('-m', input.model);
  if (input.thinking) opencodeArgs.push('--thinking');
  if (input.variant) opencodeArgs.push('--variant', input.variant);
  if (input.agent) opencodeArgs.push('--agent', input.agent);
  opencodeArgs.push(input.prompt);

  const shellCmd = `${input.command} ${opencodeArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`;
  const child = spawn('script', ['-q', '-c', shellCmd, '/dev/null'], {
    cwd: input.gencptPath,
    env: { ...process.env }
  });

  let stdout = '';
  let stderr = '';
  let settled = false;
  let sessionIdFound = false;

  const p = new Promise<RunOpencodeResult>((resolve, reject) => {
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      input.onStdout?.(text);
      if (!sessionIdFound) tryExtractSessionId(text, (id) => {
        sessionIdFound = true;
        input.onSessionId?.(id);
      });
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      input.onStderr?.(text);
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

  return { promise: p, kill: () => { child.kill(); } };
}

export function buildGenCptPrompt(params: {
  server: string;
  mode: string;
  scope: string[];
  approval: string;
  sourcePath?: string;
  baseline?: string;
}): string {
  return [
    `/gencpt server=${params.server} mode=${params.mode} scope=${params.scope.join(',')} approval=${params.approval}`,
    params.sourcePath ? `source-path=${params.sourcePath}` : '',
    params.baseline ? `baseline=${params.baseline}` : '',
    '请按 GenCPT 原生流程执行，所有原始证据和报告写入 GenCPT 工作目录。'
  ].filter(Boolean).join('\n');
}