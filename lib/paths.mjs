/**
 * 远端地址解析与本地目录推导。
 * 职责：把用户粘进来的地址（https / ssh / scp / 本地路径）解析成稳定字段，
 * 并用「父目录 + 仓库名」算出知识库落盘的目录，避免让用户手填一个不存在的路径。
 */
import path from 'node:path';
import os from 'node:os';

const HOST_RULES = {
  'github.com': { hostKey: 'github', webBase: 'https://github.com', tokenUrl: 'https://github.com/settings/tokens' },
  'gitlab.com': { hostKey: 'gitlab', webBase: 'https://gitlab.com', tokenUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens' },
  'gitee.com': { hostKey: 'gitee', webBase: 'https://gitee.com', tokenUrl: 'https://gitee.com/profile/personal_access_tokens' },
  'bitbucket.org': { hostKey: 'bitbucket', webBase: 'https://bitbucket.org', tokenUrl: 'https://bitbucket.org/account/settings/app-passwords/' },
};

const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function expandHome(input) {
  const text = String(input ?? '').trim();
  if (!text) return '';
  if (text === '~') return os.homedir();
  if (text.startsWith('~/') || text.startsWith('~\\')) return path.join(os.homedir(), text.slice(2));
  return text;
}

function hostRule(host) {
  const key = String(host ?? '').toLowerCase();
  return HOST_RULES[key] ?? { hostKey: key ? 'git' : 'local', webBase: key ? `https://${key}` : '', tokenUrl: '' };
}

function finish(result) {
  if (!result.ownerPath) return invalid(result, '这个地址看起来缺少仓库名，像 https://github.com/<用户名>/<仓库>.git 这样才对。');
  const segments = result.ownerPath.split('/').filter(Boolean);
  if (segments.length < 2) {
    return invalid(result, '这个地址只有账号，没有仓库名。补成 <账号>/<仓库>.git 这样。');
  }
  return { ok: true, ...result, segments, repoName: segments[segments.length - 1] };
}

function invalid(result, message) {
  return { ok: false, code: 'E_REMOTE_INVALID', message, raw: result?.raw ?? '' };
}

/**
 * 解析远端地址。成功返回 {ok:true, kind:'https'|'ssh'|'file', host, hostKey, ownerPath,
 * repoName, webBase, tokenUrl, inlineCredential, user, localPath, segments}。
 * 裸名字（例如 "nonsense"）不算地址，会返回 ok:false，避免把拼写错误当成仓库名建目录。
 */
/** 本地路径/裸远端：不做账号/仓库名两段校验，目录名直接取末段（去 .git）。 */
function localRemote(raw, localPath) {
  const leaf = String(localPath ?? '').replace(/[\\/]+$/, '');
  const base = path.basename(leaf || 'kb');
  const repoName = base.replace(/\.git$/i, '') || 'kb';
  return {
    ok: true,
    kind: 'file',
    raw,
    host: '',
    hostKey: 'local',
    ownerPath: '',
    repoName,
    localPath,
    webBase: '',
    tokenUrl: '',
    segments: [repoName],
  };
}

export function parseRemote(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, code: 'E_REMOTE_EMPTY', message: '远端地址为空。', raw: '' };

  // 本地路径：/abs、~/、./、../、file://
  if (raw.startsWith('file://')) return localRemote(raw, raw.slice('file://'.length));
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('~/') || raw === '~') {
    return localRemote(raw, path.resolve(expandHome(raw)));
  }

  // scp 风格：git@host:owner/repo.git（host 后没有 //）
  const scp = raw.match(/^(?:([^@\s]+)@)?([^:/\s]+):(?!\/\/)(.+)$/);
  if (scp && !/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    const [, user, host, rest] = scp;
    const rule = hostRule(host);
    const ownerPath = rest.replace(/^\/+/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    return finish({ kind: 'ssh', raw, host, hostKey: rule.hostKey, user: user || 'git', ownerPath, webBase: `ssh://${host}`, tokenUrl: rule.tokenUrl, inlineCredential: null });
  }

  // URL 风格：https://、http://、ssh://、git://
  let url;
  try {
    url = new URL(raw);
  } catch {
    return invalid({ raw }, '这看起来不是仓库地址。支持 https://…、git@host:账号/仓库.git，也可以填本机路径。');
  }
  const kind = url.protocol === 'ssh:' || url.protocol === 'git+ssh:' || url.protocol === 'git:' ? 'ssh' : url.protocol === 'file:' ? 'file' : 'https';
  if (kind === 'file') return localRemote(raw, decodeURIComponent(url.pathname));
  const host = url.hostname;
  const rule = hostRule(host);
  const ownerPath = decodeURIComponent(url.pathname).replace(/^\/+/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const user = url.username || (kind === 'ssh' ? 'git' : '');
  const inlineCredential =
    url.password && url.username ? { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) } : null;
  return finish({ kind, raw, host, hostKey: rule.hostKey, user, ownerPath, webBase: rule.webBase, tokenUrl: rule.tokenUrl, inlineCredential });
}

export function isRemoteUrl(input) {
  const parsed = parseRemote(input);
  return parsed.ok && parsed.kind !== 'file';
}

export function isSshRemote(input) {
  const parsed = parseRemote(input);
  return parsed.ok && parsed.kind === 'ssh';
}

/** 由仓库名生成安全的目录名：去 .git、坏字符换 -、去两端符号、避开 Windows 保留名。 */
export function sanitizeDirName(input) {
  const original = String(input ?? '').trim();
  let name = original
    .replace(/\.git$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^[.\-_]+|[.\-_]+$/g, '')
    .slice(0, 80);
  if (!name || RESERVED_NAMES.test(name)) name = `${name || 'knowledge-base'}-kb`;
  return { name, changed: name !== original, original };
}

/**
 * 知识库落盘位置。有远端时目录名默认取仓库名（可用 folder 覆盖），
 * 父目录由用户选；返回的 root 一定在父目录下面，不会被 ../ 逃出去。
 */
export function resolveLibraryTarget({ parent, name, remote, fallback } = {}) {
  const parentText = String(parent ?? '').trim();
  if (!parentText) return { ok: false, code: 'E_ROOT', message: '还没有选择本地目录。' };
  const parentDir = path.resolve(expandHome(parentText));

  let dir = '';
  let dirChanged = false;
  let dirOriginal = '';
  const explicit = String(name ?? '').trim();
  if (explicit) {
    const safe = sanitizeDirName(explicit);
    dir = safe.name;
    dirChanged = safe.changed;
    dirOriginal = safe.original;
  } else {
    const remoteText = String(remote ?? '').trim();
    const fallbackText = String(fallback ?? '').trim();
    let base = fallbackText;
    if (remoteText) {
      const parsed = parseRemote(remoteText);
      if (!parsed.ok) return parsed;
      base = parsed.repoName;
    }
    if (!base) {
      return {
        ok: false,
        code: 'E_NAME',
        message: '给知识库起个名字，或者填一个远端仓库地址（会拿仓库名当目录名）。',
      };
    }
    const safe = sanitizeDirName(base);
    dir = safe.name;
    dirChanged = safe.changed;
    dirOriginal = safe.original;
  }

  const root = path.join(parentDir, dir);
  if (path.dirname(path.resolve(root)) !== path.resolve(parentDir)) {
    return { ok: false, code: 'E_PATH', message: '目录名不合法，换一个吧。' };
  }
  return { ok: true, parent: parentDir, dir, root, dirChanged, dirOriginal, remote: String(remote ?? '').trim() };
}

/** 把可能出现在输出里的凭据抹掉（URL 里的 userinfo、token 参数、已知 token 本体）。 */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? '');
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    out = out.split(secret).join('***');
  }
  return out
    .replace(/(https?:\/\/)[^/\s@]+@/gi, '$1***@')
    .replace(/([?&](?:token|access_token|private_token|auth)=)[^&\s]+/gi, '$1***');
}
