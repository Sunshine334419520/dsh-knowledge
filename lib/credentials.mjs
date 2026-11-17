/**
 * 访问令牌的存取。令牌只进 DSH 的 credentials 服务（写进 ~/.dsh/.credentials.yaml，0600），
 * 不进插件配置、不进 remote URL、不进命令行参数。
 */
import { KbError } from './store.mjs';

export const TOKEN_REFS = {
  github: 'DSH_KB_GITHUB_TOKEN',
  gitlab: 'DSH_KB_GITLAB_TOKEN',
  gitee: 'DSH_KB_GIT_TOKEN',
  bitbucket: 'DSH_KB_GIT_TOKEN',
  git: 'DSH_KB_GIT_TOKEN',
};

export const ENV_FALLBACKS = {
  github: ['DSH_KB_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN'],
  gitlab: ['DSH_KB_GITLAB_TOKEN', 'GITLAB_TOKEN', 'GL_TOKEN'],
  gitee: ['DSH_KB_GIT_TOKEN', 'GITEE_TOKEN'],
  bitbucket: ['DSH_KB_GIT_TOKEN', 'BITBUCKET_TOKEN'],
  git: ['DSH_KB_GIT_TOKEN', 'GIT_TOKEN'],
};

const TOKEN_SHAPE = /^[A-Za-z0-9_\-.~+/=]{8,512}$/;

const HINTS = {
  github: '在 GitHub 的 Settings → Developer settings 里创建 token；fine-grained token 只需要 Contents 的 Read and write。',
  gitlab: '在 GitLab 的 Preferences → Access tokens 里创建，勾 read_repository 和 write_repository。',
  gitee: '在 Gitee 的「设置 → 私人令牌」里创建，勾 projects。',
  bitbucket: 'Bitbucket 用 app password：Repository 勾 Read/Write。',
  git: '给这个主机创建一个有仓库读写权限的 token。',
};

export function tokenRefFor(hostKey) {
  return TOKEN_REFS[hostKey] ?? TOKEN_REFS.git;
}

function credentialService(ctx) {
  try {
    const service = ctx?.get?.('credentials') ?? ctx?.credentials;
    return service && typeof service.resolve === 'function' ? service : null;
  } catch {
    return null;
  }
}

export function maskToken(token) {
  const text = String(token ?? '');
  if (!text) return '';
  if (text.length <= 8) return `${text.slice(0, 2)}…`;
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

export function tokenHint(hostKey) {
  return HINTS[hostKey] ?? HINTS.git;
}

/** 解析可用令牌：插件自己的凭据服务优先，其次环境变量（方便 CI / 老用户）。 */
export async function resolveToken(ctx, hostKey) {
  const ref = tokenRefFor(hostKey ?? 'git');
  const service = credentialService(ctx);
  if (service && ref) {
    try {
      const found = await service.resolve(ref);
      if (found?.value) return { token: String(found.value), source: 'credentials', ref, envName: null };
    } catch {
      /* 凭据服务不可用就当没有，继续看环境变量 */
    }
  }
  for (const name of ENV_FALLBACKS[hostKey] ?? ENV_FALLBACKS.git) {
    const value = process.env[name];
    if (value && value.trim()) return { token: value.trim(), source: 'env', ref: null, envName: name };
  }
  return { token: null, source: 'none', ref, envName: null };
}

/** 只描述令牌状态，绝不把值返回给前端。 */
export async function describeToken(ctx, hostKey, { tokenUrl = '' } = {}) {
  const found = await resolveToken(ctx, hostKey);
  const service = credentialService(ctx);
  return {
    configured: Boolean(found.token),
    source: found.source,
    ref: found.ref,
    envName: found.envName,
    masked: maskToken(found.token),
    writable: Boolean(service),
    tokenUrl,
    hint: tokenHint(hostKey),
  };
}

export async function saveToken(ctx, hostKey, token) {
  const value = String(token ?? '').trim();
  if (!value) throw new KbError('E_EMPTY_TOKEN', '令牌是空的。');
  if (!TOKEN_SHAPE.test(value)) {
    throw new KbError('E_TOKEN_SHAPE', '令牌格式不对：不能有空格，长度 8–512，只含字母数字和 -_.~+/=。');
  }
  const service = credentialService(ctx);
  const ref = tokenRefFor(hostKey);
  if (!service || !ref) {
    throw new KbError('E_NO_CREDENTIALS', '当前环境没有凭据服务，无法安全保存令牌。可以改用环境变量 GITHUB_TOKEN。');
  }
  if (typeof service.set !== 'function') throw new KbError('E_NO_CREDENTIALS', '凭据服务不支持写入。');
  try {
    await service.set(ref, value);
  } catch (error) {
    throw new KbError('E_NO_CREDENTIALS', `保存令牌失败：${error instanceof Error ? error.message : String(error)}`);
  }
  return describeToken(ctx, hostKey);
}

export async function clearToken(ctx, hostKey) {
  const service = credentialService(ctx);
  const ref = tokenRefFor(hostKey);
  if (service && ref && typeof service.unset === 'function') {
    try {
      await service.unset(ref);
    } catch {
      /* 已经不存在就算了 */
    }
  }
  return describeToken(ctx, hostKey);
}

/** 收尾用：把错误信息里可能出现的令牌抹掉。 */
export function scrub(text, secrets = []) {
  let out = String(text ?? '');
  for (const secret of secrets) {
    if (secret && secret.length >= 6) out = out.split(secret).join('***');
  }
  return out;
}
