import { spawn } from 'node:child_process';

export type RunOpencodeInput = {
  command: string;
  gencptPath: string;
  prompt: string;
  timeoutMs: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

export type RunOpencodeResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export function runOpencode(input: RunOpencodeInput): Promise<RunOpencodeResult> {
  // The GenCPT skill is installed under ~/.config/opencode/skills/gencpt and
  // opencode auto-discovers installed skills, so we do NOT need `--dir <skill>`.
  // `--dir` only sets opencode's working directory; we use gencptPath as cwd.
  // The prompt explicitly mentions the GenCPT skill so opencode routes to it.
  const args = ['run', input.prompt];
  const child = spawn(input.command, args, { cwd: input.gencptPath });
  let stdout = '';
  let stderr = '';
  let settled = false;
  let timedOut = false;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, input.timeoutMs);

    // Early-failure detection: if opencode exits with a "balance" / auth error
    // within the first 30s, surface it immediately rather than waiting for the
    // full timeout. We rely on the normal close event, so nothing extra needed
    // here — included for clarity / future hook.
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      input.onStdout?.(text);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      input.onStderr?.(text);
      // Detect immediate auth / balance failures and kill early so the user
      // does not have to wait out the full 5-minute timeout.
      if (
        !settled &&
        /\b(balance|credit|quota|insufficient|unauthor|401|403|api key)\b/i.test(text)
      ) {
        // give opencode a moment to flush, then kill
        setTimeout(() => {
          if (!settled) child.kill();
        }, 1500);
      }
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
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