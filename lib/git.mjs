import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_TIMEOUT = 20000;

function gitEnv() {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: '',
    SSH_ASKPASS: '',
    GCM_INTERACTIVE: 'never',
  };
}

export function runGit(cwd, args, options = {}) {
  return new Promise((resolve) => {
    const child = execFile(
      'git',
      ['-c', 'core.quotepath=false', ...args],
      {
        cwd,
        timeout: options.timeout ?? DEFAULT_TIMEOUT,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        env: gitEnv(),
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        resolve({
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? error?.message ?? ''),
        });
      },
    );
    child.on('error', () => {
      /* handled by the callback */
    });
  });
}

export async function gitVersion() {
  const result = await runGit(process.cwd(), ['--version']);
  return result.code === 0 ? result.stdout.trim() : null;
}

export async function isRepo(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return false;
  const result = await runGit(root, ['rev-parse', '--is-inside-work-tree']);
  return result.code === 0 && result.stdout.trim() === 'true';
}

async function ensureIdentity(root) {
  const email = await runGit(root, ['config', 'user.email']);
  if (email.code === 0 && email.stdout.trim()) return;
  await runGit(root, ['config', 'user.email', 'knowledge-base@localhost']);
  const name = await runGit(root, ['config', 'user.name']);
  if (name.code === 0 && name.stdout.trim()) return;
  await runGit(root, ['config', 'user.name', 'Knowledge Base']);
}

export async function initRepo(root) {
  const init = await runGit(root, ['init', '-b', 'main']);
  if (init.code !== 0) {
    const fallback = await runGit(root, ['init']);
    if (fallback.code !== 0) throw new Error(fallback.stderr || 'git init 失败');
    await runGit(root, ['branch', '-M', 'main']);
  }
  await ensureIdentity(root);
  return true;
}

export async function currentBranch(root) {
  const result = await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (result.code !== 0) return null;
  const name = result.stdout.trim();
  return name && name !== 'HEAD' ? name : null;
}

export async function commitAll(root, message) {
  if (!(await isRepo(root))) return { committed: false, reason: 'no-repo', branch: null, hash: null };
  await ensureIdentity(root);
  const add = await runGit(root, ['add', '-A']);
  if (add.code !== 0) return { committed: false, reason: 'add-failed', error: add.stderr.trim(), branch: await currentBranch(root) };
  const status = await runGit(root, ['status', '--porcelain']);
  if (status.code === 0 && !status.stdout.trim()) {
    return { committed: false, reason: 'clean', branch: await currentBranch(root), hash: null };
  }
  const commit = await runGit(root, ['commit', '-m', String(message || 'kb: update')]);
  if (commit.code !== 0) {
    return {
      committed: false,
      reason: 'commit-failed',
      error: (commit.stderr || commit.stdout).trim(),
      branch: await currentBranch(root),
    };
  }
  const short = await runGit(root, ['rev-parse', '--short', 'HEAD']);
  return {
    committed: true,
    branch: await currentBranch(root),
    hash: short.code === 0 ? short.stdout.trim() : null,
  };
}

export async function logRecent(root, limit = 5) {
  const result = await runGit(root, ['log', `-${limit}`, '--pretty=%h\t%cI\t%s']);
  if (result.code !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, date, subject] = line.split('\t');
      return { hash, date, subject };
    });
}
