/**
 * git 的薄封装。所有调用都是非交互的：
 * - 有令牌时用 GIT_ASKPASS 脚本注入（令牌走环境变量，不进 argv）；
 * - 同时用 GIT_CONFIG_COUNT 把系统 credential helper 清空，避免弹出钥匙串对话框；
 * - 没有令牌时直接禁用 askpass/prompt，让这类错误尽快失败并归到 E_AUTH。
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BRANCH = 'main';
export const DEFAULT_TIMEOUT = 20000;
export const REMOTE_TIMEOUT = 60000;

const MAX_BUFFER = 8 * 1024 * 1024;
export const ASKPASS_SH = fileURLToPath(new URL('./askpass.sh', import.meta.url));
export const ASKPASS_BAT = fileURLToPath(new URL('./askpass.bat', import.meta.url));

/**
 * 选 askpass 垫片：Git for Windows 跑不了 .sh，用纯 cmd 的 .bat；其余平台用 .sh。
 * 两个垫片都只从环境变量取值，令牌不会出现在 argv 里。
 */
function askpassFor(platform) {
  return platform === 'win32' ? ASKPASS_BAT : ASKPASS_SH;
}

export function gitEnv(credential, platform = process.platform) {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
  };
  if (credential?.token) {
    env.GIT_ASKPASS = askpassFor(platform);
    env.GIT_ASKPASS_REQUIRE = 'force';
    env.DSH_KB_GIT_USER = credential.username || 'x-access-token';
    env.DSH_KB_GIT_TOKEN = credential.token;
    // helper 置空 -> 不弹系统钥匙串；username 预置 -> 只问密码，绕开提示语本地化。
    env.GIT_CONFIG_COUNT = '2';
    env.GIT_CONFIG_KEY_0 = 'credential.helper';
    env.GIT_CONFIG_VALUE_0 = '';
    env.GIT_CONFIG_KEY_1 = 'credential.username';
    env.GIT_CONFIG_VALUE_1 = credential.username || 'x-access-token';
    delete env.SSH_ASKPASS;
    delete env.GCM_INTERACTIVE;
  } else {
    env.GIT_ASKPASS = '';
    env.SSH_ASKPASS = '';
    delete env.GIT_ASKPASS_REQUIRE;
    delete env.DSH_KB_GIT_TOKEN;
    delete env.DSH_KB_GIT_USER;
    delete env.GIT_CONFIG_COUNT;
    delete env.GIT_CONFIG_KEY_0;
    delete env.GIT_CONFIG_VALUE_0;
    delete env.GIT_CONFIG_KEY_1;
    delete env.GIT_CONFIG_VALUE_1;
  }
  return env;
}

export function runGit(cwd, args, options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const env = options.env ?? gitEnv(options.credential);
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-c', 'core.quotepath=false', ...args],
      { cwd, env, timeout, maxBuffer: MAX_BUFFER, encoding: 'utf8' },
      (error, stdout, stderr) => {
        const timedOut = Boolean(error && (error.killed || error.signal === 'SIGTERM' || error.code === 'ETIMEDOUT'));
        const code = error ? (timedOut ? 124 : typeof error.code === 'number' ? error.code : 1) : 0;
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '', timedOut });
      },
    );
  });
}

/** 把常见 git 错误归成前端能处理的中文提示。 */
export function classifyGitError(stderr, result = {}) {
  const raw = String(stderr ?? '').trim();
  const at = (code, message) => ({ code, message, raw });
  if (result.timedOut) return at('E_TIMEOUT', '连接远端超时了，检查网络、代理或仓库地址。');
  if (/Authentication failed|could not read (Username|Password)|terminal prompts disabled|Invalid username or password/i.test(raw)) {
    return at('E_AUTH', '这个仓库要登录才能访问：令牌不对、过期，或者没有这个仓库的权限。');
  }
  if (/Repository not found|The project you were looking for could not be found|does not appear to be a git repository/i.test(raw)) {
    return at('E_REMOTE_NOT_FOUND', '找不到这个仓库。私有仓库在没授权时也会报这个错——先确认地址，再检查令牌权限。');
  }
  if (/Permission denied \(publickey\)/i.test(raw)) {
    return at('E_SSH_KEY', '这台机器的 SSH 密钥不被远端接受。要么把公钥加到账号里，要么改用 https 地址 + 令牌。');
  }
  if (/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(raw)) {
    return at('E_SSH_HOSTKEY', '主机的 SSH 指纹没被信任（或变过）。先在终端 ssh 一次确认指纹。');
  }
  if (/Could not resolve host|Couldn't resolve host|Connection (timed out|refused|reset)|Failed to connect|unable to access|网络|无法解析|连接超时|拒绝连接/i.test(raw)) {
    return at('E_NETWORK', '连不上远端：域名解析或网络不通，检查网络和代理。');
  }
  if (/protected branch|GH006|protected branch hook declined|cannot force push/i.test(raw)) {
    return at('E_NO_WRITE', '没有写权限，或者目标分支被保护了。');
  }
  if (/\[rejected\]|non-fast-forward|fetch first|Updates were rejected/i.test(raw)) {
    return at('E_REMOTE_DIVERGED', '远端有你本地没有的提交，先同步再推。');
  }
  return at('E_GIT', raw ? `git 命令失败：${raw.split('\n').slice(-3).join(' ')}` : 'git 命令失败。');
}

export function redactGitOutput(text, credential = null) {
  let out = String(text ?? '');
  const token = credential?.token;
  if (token && token.length >= 6) out = out.split(token).join('***');
  return out
    .replace(/(https?:\/\/)[^/\s@]+@/gi, '$1***@')
    .replace(/([?&](?:token|access_token|private_token)=)[^&\s]+/gi, '$1***');
}

export async function gitVersion() {
  const result = await runGit(process.cwd(), ['--version']);
  return result.code === 0 ? result.stdout.trim() : '';
}

export async function isRepo(root) {
  if (!root || !fs.existsSync(root)) return false;
  const result = await runGit(root, ['rev-parse', '--git-dir']);
  return result.code === 0;
}

export async function ensureIdentity(root) {
  const email = await runGit(root, ['config', '--get', 'user.email']);
  if (email.code !== 0 || !email.stdout.trim()) {
    await runGit(root, ['config', 'user.email', 'knowledge-base@localhost']);
  }
  const name = await runGit(root, ['config', '--get', 'user.name']);
  if (name.code !== 0 || !name.stdout.trim()) {
    await runGit(root, ['config', 'user.name', 'Knowledge Base']);
  }
}

export async function initRepo(root) {
  await ensureIdentity(root);
  const result = await runGit(root, ['init', '-b', DEFAULT_BRANCH]);
  if (result.code === 0) return result;
  const fallback = await runGit(root, ['init']);
  if (fallback.code === 0) await runGit(root, ['branch', '-M', DEFAULT_BRANCH]);
  return fallback.code === 0 ? fallback : result;
}

export async function currentBranch(root) {
  const result = await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (result.code !== 0) return null;
  const name = result.stdout.trim();
  return !name || name === 'HEAD' ? null : name;
}

export async function commitAll(root, message = 'kb: update') {
  const info = { committed: false, branch: null, hash: null, reason: null, error: null };
  if (!(await isRepo(root))) {
    info.reason = 'no-repo';
    return info;
  }
  info.branch = await currentBranch(root);
  const added = await runGit(root, ['add', '-A']);
  if (added.code !== 0) {
    info.reason = 'add-failed';
    info.error = added.stderr.trim();
    return info;
  }
  const staged = await runGit(root, ['diff', '--cached', '--quiet']);
  if (staged.code === 0) {
    info.reason = 'clean';
    return info;
  }
  await ensureIdentity(root);
  const commit = await runGit(root, ['commit', '--quiet', '-m', message]);
  if (commit.code !== 0) {
    info.reason = 'commit-failed';
    info.error = commit.stderr.trim();
    return info;
  }
  const head = await runGit(root, ['rev-parse', 'HEAD']);
  info.committed = true;
  info.hash = head.code === 0 ? head.stdout.trim() : null;
  return info;
}

export async function logRecent(root, limit = 5) {
  if (!(await isRepo(root))) return [];
  const result = await runGit(root, ['log', `-n${Math.max(1, limit)}`, '--pretty=format:%H%x09%ad%x09%s', '--date=iso']);
  if (result.code !== 0) return [];
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, date, ...rest] = line.split('\t');
      return { hash, date, subject: rest.join('\t') };
    });
}

function defaultBranchOf(symref) {
  if (!symref) return null;
  return symref.replace(/^ref:\s+/, '').split('\t')[0].replace('refs/heads/', '');
}

/**
 * 探测远端。空仓库返回 {ok:true, empty:true}；有内容返回默认分支和全部分支名，
 * 这样即使远端 HEAD 悬空（比如原本指向 master），也能挑一个存在的分支来 clone。
 */
export async function probeRemote(remote, { credential = null, timeout = REMOTE_TIMEOUT } = {}) {
  const result = await runGit(process.cwd(), ['ls-remote', '--symref', remote], { credential, timeout });
  if (result.timedOut) return { ok: false, code: 'E_TIMEOUT', message: '连接远端超时了，检查网络或代理。', raw: '' };
  if (result.code !== 0) {
    const classified = classifyGitError(result.stderr || result.stdout, result);
    return { ok: false, ...classified };
  }
  const lines = result.stdout.split('\n').filter(Boolean);
  const head = lines.find((line) => line.startsWith('ref:'));
  const shaLine = lines.find((line) => /\tHEAD$/.test(line) && !line.startsWith('ref:'));
  const branches = lines
    .filter((line) => /\trefs\/heads\//.test(line))
    .map((line) => line.split('\t')[1].replace('refs/heads/', ''));
  return {
    ok: true,
    empty: branches.length === 0 && !shaLine,
    defaultBranch: defaultBranchOf(head),
    branches,
    headSha: shaLine ? shaLine.split('\t')[0] : null,
    raw: '',
  };
}

export async function cloneRemote(remote, dir, { credential = null, branch = null, timeout = 300000 } = {}) {
  const args = ['clone', '--quiet'];
  if (branch) args.push('--branch', branch);
  args.push(remote, dir);
  const result = await runGit(path.dirname(path.resolve(dir)), args, { credential, timeout });
  if (result.code !== 0) {
    const classified = classifyGitError(result.stderr || result.stdout, result);
    const error = new Error(classified.message);
    error.code = classified.code;
    error.classified = classified;
    throw error;
  }
  return result;
}

export async function fetchRemote(root, { credential = null, remote = 'origin', timeout = 120000 } = {}) {
  return runGit(root, ['fetch', '--prune', '--quiet', remote], { credential, timeout });
}

export async function pushBranch(root, branch, { credential = null, timeout = 120000 } = {}) {
  return runGit(root, ['push', '--quiet', '-u', 'origin', branch], { credential, timeout });
}

export async function setUpstream(root, branch, remoteBranch = branch) {
  const result = await runGit(root, ['branch', `--set-upstream-to=origin/${remoteBranch}`, branch]);
  return result.code === 0;
}

export async function hasRef(root, ref) {
  const result = await runGit(root, ['rev-parse', '--verify', '--quiet', ref]);
  return result.code === 0;
}

export async function revParse(root, ref) {
  const result = await runGit(root, ['rev-parse', '--verify', '--quiet', ref]);
  return result.code === 0 ? result.stdout.trim() : null;
}

export async function hasMergeBase(root, left, right) {
  const result = await runGit(root, ['merge-base', left, right]);
  return result.code === 0;
}

export async function countAheadBehind(root, upstream) {
  const result = await runGit(root, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`]);
  if (result.code !== 0) return null;
  const [behind, ahead] = result.stdout.trim().split(/\s+/).map(Number);
  return { ahead: ahead || 0, behind: behind || 0 };
}

/** 合并远端引用；冲突时回滚工作区，绝不让用户在半个冲突现场里继续。 */
export async function mergeRemote(root, ref, { allowUnrelated = false } = {}) {
  await ensureIdentity(root);
  const args = ['merge', '--no-edit'];
  if (allowUnrelated) args.push('--allow-unrelated-histories');
  args.push(ref);
  const result = await runGit(root, args, { timeout: 120000 });
  if (result.code === 0) return { ok: true, raw: result.stdout };
  const status = await runGit(root, ['diff', '--name-only', '--diff-filter=U']);
  const conflicts = status.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  await runGit(root, ['merge', '--abort']);
  const message = conflicts.length
    ? `和远端改到了同一批文件：${conflicts.slice(0, 4).join('、')}${conflicts.length > 4 ? ' 等' : ''}。已经撤回合并，本地文件没动。`
    : '合并远端历史失败，已经撤回。';
  return { ok: false, conflicts, message, raw: result.stderr.trim() };
}

/**
 * 系统里有没有能用的 git 凭据（钥匙串 / .git-credentials）。
 * 只用于在界面上提示"可以直接用"，不读取、不回传密码。
 */
export function systemCredentialAvailable(remote) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(remote);
    } catch {
      resolve({ available: false, username: null });
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      resolve({ available: false, username: null });
      return;
    }
    const child = execFile(
      'git',
      ['-c', 'credential.helper=', 'credential', 'fill'],
      {
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', GCM_INTERACTIVE: 'never' },
        timeout: 5000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
      },
      (error, stdout) => {
        if (error) {
          resolve({ available: false, username: null });
          return;
        }
        const line = String(stdout ?? '').split('\n').find((row) => row.startsWith('username='));
        resolve({ available: true, username: line ? line.slice('username='.length).trim() : null });
      },
    );
    child.stdin.end(`protocol=${url.protocol.replace(':', '')}\nhost=${url.host}\n\n`);
  });
}
