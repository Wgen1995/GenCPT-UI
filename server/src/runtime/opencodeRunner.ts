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
  const args = ['run', '--dir', input.gencptPath, input.prompt];
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

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      input.onStdout?.(text);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      input.onStderr?.(text);
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
  return [
    '使用 GenCPT 对目标执行安全评估。',
    `参数：server=${params.server} mode=${params.mode} scope=${params.scope.join(',')} approval=${params.approval}`,
    params.sourcePath ? `source-path=${params.sourcePath}` : '',
    params.baseline ? `baseline=${params.baseline}` : '',
    '请读取 SKILL.md 并按 GenCPT 原生流程执行。',
    '所有原始证据和报告写入 GenCPT 自己创建的工作目录。'
  ]
    .filter(Boolean)
    .join('\n');
}