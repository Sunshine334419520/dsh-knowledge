import {
  KbError,
  createFolder,
  createLibrary,
  createNote,
  deleteEntry,
  findLibrary,
  gitManualCommit,
  gitStatus,
  gitSync,
  libraryStats,
  listLibraries,
  listTree,
  mimeOf,
  readBytes,
  readNote,
  removeLibrary,
  renameEntry,
  requireLibrary,
  saveUpload,
  searchFiles,
  searchLibrary,
  setActive,
  writeNote,
  bootstrapRemote,
  dataDir,
  profileDir,
} from './store.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyGitError,
  gitVersion,
  logRecent,
  probeRemote,
  redactGitOutput,
  systemCredentialAvailable,
} from './git.mjs';
import { parseRemote } from './paths.mjs';
import { clearToken, describeToken, saveToken, resolveToken } from './credentials.mjs';
import { previewOffice } from './preview.mjs';

const STATUS_BY_CODE = {
  E_NO_LIBRARY: 404,
  E_NOT_FOUND: 404,
  E_NO_ROOT: 404,
  E_CONFLICT: 409,
  E_EXISTS: 409,
  E_PATH: 400,
  E_NAME: 400,
  E_ROOT: 400,
  E_NOT_DIR: 400,
  E_NOT_FILE: 400,
  E_EMPTY: 400,
  E_TOO_LARGE: 413,
  E_BAD_OFFICE: 415,
  E_DUPLICATE: 409,
  E_NO_GIT: 409,
  E_NO_REMOTE: 409,
  E_READONLY: 403,
  E_BODY: 400,
  E_ACTION: 400,
  E_ROUTE: 404,
  E_REMOTE_INVALID: 400,
  E_DIR_NOT_EMPTY: 409,
  E_AUTH: 401,
  E_REMOTE_NOT_FOUND: 404,
  E_SSH_KEY: 400,
  E_SSH_HOSTKEY: 400,
  E_NETWORK: 502,
  E_TIMEOUT: 504,
  E_NO_WRITE: 403,
  E_REMOTE_DIVERGED: 409,
  E_TOKEN_SHAPE: 400,
  E_EMPTY_TOKEN: 400,
  E_NO_CREDENTIALS: 409,
};

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export function fail(error) {
  const code =
    error instanceof KbError
      ? error.code
      : typeof error?.code === 'string'
        ? error.code
        : 'E_INTERNAL';
  const status = STATUS_BY_CODE[code] ?? 500;
  return json(
    {
      ok: false,
      code,
      error: error instanceof Error ? error.message : String(error),
      detail: error instanceof KbError ? error.detail : null,
    },
    status,
  );
}

export async function readBody(request) {
  const text = await request.text();
  if (!text) return {};
  if (text.length > 48 * 1024 * 1024) throw new KbError('E_TOO_LARGE', '请求内容太大。');
  try {
    return JSON.parse(text);
  } catch {
    throw new KbError('E_BODY', '请求内容不是合法 JSON。');
  }
}

function query(request) {
  return new URL(request.url).searchParams;
}

function libRoot(param) {
  return requireLibrary(param);
}

/** SSH / 本地路径不需要令牌；HTTPS 才去解析插件凭据。 */
async function credentialFor(ctx, remote) {
  const parsed = remote ? parseRemote(remote) : { ok: false };
  if (!parsed.ok || parsed.kind !== 'https') return { credential: null, parsed };
  const hit = await resolveToken(ctx, parsed.hostKey);
  return {
    credential: hit.token ? { token: hit.token, username: parsed.user || 'x-access-token' } : null,
    hit,
    parsed,
  };
}

/** 给某个库解析凭据（库里存了 remote 地址）。 */
async function credentialForLibrary(ctx, entry) {
  return credentialFor(ctx, entry.remote ?? '');
}

// 按 messageId 从会话事件里取助手回复正文；客户端取不到快照时用它兜底。
export function messageText(ctx, sessionId, messageId) {
  const sessions = ctx?.get?.('sessions');
  const session = sessions?.get?.(sessionId);
  if (!session) throw new KbError('E_NO_SESSION', '找不到这条会话，可能已经关闭。');
  const events = session.snapshotEvents();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== 'assistant/message') continue;
    const message = event.data?.message;
    if (!message) continue;
    if (messageId && message.id !== messageId) continue;
    const blocks = Array.isArray(message.content) ? message.content : [];
    const text = blocks
      .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n\n')
      .trim();
    if (text) return { ok: true, messageId: message.id, text };
  }
  throw new KbError('E_NOT_FOUND', '这条回复没有可保存的文本。');
}

async function dispatch(request, ctx) {
  const url = new URL(request.url);
  const route = url.pathname;
  const method = request.method.toUpperCase();

  if (route === '/api/kb/libraries' && method === 'GET') {
    const libraries = listLibraries();
    let active = libraries.find((row) => row.id === findLibrary(null)?.id) ?? libraries[0] ?? null;
    return json({
      ok: true,
      libraries,
      activeId: active?.id ?? null,
      dataDir: dataDir(),
      profileDir: profileDir(),
      git: { available: Boolean(await gitVersion()), version: await gitVersion() },
    });
  }

  if (route === '/api/kb/libraries' && method === 'POST') {
    const body = await readBody(request);
    const { credential } = await credentialFor(ctx, body.remote);
    const result = await createLibrary({
      name: body.name,
      root: body.root,
      parent: body.parent,
      folder: body.folder,
      remote: body.remote,
      git: body.git !== false,
      adopt: body.adopt === true,
      mergeUnrelated: body.mergeUnrelated === true,
      credential,
    });
    return json({ ok: true, ...result });
  }

  if (route === '/api/kb/libraries/bootstrap' && method === 'POST') {
    const body = await readBody(request);
    const entry = libRoot(body.lib);
    const remote = String(body.remote ?? entry.remote ?? '').trim();
    const { credential } = await credentialFor(ctx, remote);
    const result = await bootstrapRemote(entry.id, {
      remote,
      mergeUnrelated: body.mergeUnrelated === true,
      credential,
    });
    return json({ ok: true, ...result });
  }

  if (route === '/api/kb/credentials' && method === 'GET') {
    const param = query(request).get('remote');
    const remote = String(param ?? libRoot(query(request).get('lib')).remote ?? '').trim();
    const parsed = parseRemote(remote);
    if (!parsed.ok) throw new KbError(parsed.code ?? 'E_REMOTE_INVALID', parsed.message);
    const token = await describeToken(ctx, parsed.hostKey, { tokenUrl: parsed.tokenUrl });
    const system =
      parsed.kind === 'https' && !token.configured
        ? await systemCredentialAvailable(remote)
        : { available: false };
    return json({ ok: true, remote: parsed, ssh: parsed.kind === 'ssh', token, system });
  }

  if (route === '/api/kb/credentials' && method === 'POST') {
    const body = await readBody(request);
    const remote = String(
      body.remote ?? (body.lib ? libRoot(body.lib).remote ?? '' : ''),
    ).trim();
    const parsed = parseRemote(remote);
    if (!parsed.ok) throw new KbError(parsed.code ?? 'E_REMOTE_INVALID', parsed.message);
    if (parsed.kind !== 'https') {
      throw new KbError('E_REMOTE_INVALID', '这个地址不需要访问令牌：SSH 用本机 ssh 配置，本地路径不联网。');
    }
    const token = String(body.token ?? '').trim();
    const credential = { token, username: parsed.user || 'x-access-token' };
    const probe = await probeRemote(remote, { credential });
    const unverifiable = !probe.ok && ['E_NETWORK', 'E_TIMEOUT', 'E_GIT'].includes(probe.code);
    if (!probe.ok && !unverifiable && body.force !== true) {
      throw new KbError(probe.code ?? 'E_AUTH', probe.message, { raw: redactGitOutput(probe.raw ?? '', credential) });
    }
    const tokenInfo = await saveToken(ctx, parsed.hostKey, token);
    return json({
      ok: true,
      token: tokenInfo,
      remote: parsed,
      probe: probe.ok
        ? { ok: true, empty: probe.empty, defaultBranch: probe.defaultBranch }
        : { ok: false, code: probe.code, message: probe.message, unverified: unverifiable },
    });
  }

  if (route === '/api/kb/credentials' && method === 'DELETE') {
    const body = await readBody(request);
    const remote = String(
      body.remote ?? (body.lib ? libRoot(body.lib).remote ?? '' : ''),
    ).trim();
    const parsed = parseRemote(remote);
    if (!parsed.ok) throw new KbError(parsed.code ?? 'E_REMOTE_INVALID', parsed.message);
    return json({ ok: true, remote: parsed, token: await clearToken(ctx, parsed.hostKey) });
  }

  if (route === '/api/kb/remote/test' && method === 'POST') {
    const body = await readBody(request);
    const remote = String(body.remote ?? '').trim();
    const parsed = parseRemote(remote);
    if (!parsed.ok) throw new KbError(parsed.code ?? 'E_REMOTE_INVALID', parsed.message);
    const { credential } = await credentialFor(ctx, remote);
    const probe = await probeRemote(remote, { credential });
    return json({
      ok: true,
      remote: parsed,
      probe: probe.ok
        ? { ok: true, empty: probe.empty, defaultBranch: probe.defaultBranch, headSha: probe.headSha }
        : { ok: false, code: probe.code, message: probe.message, raw: redactGitOutput(probe.raw ?? '', credential) },
    });
  }

  if (route === '/api/kb/libraries/active' && method === 'POST') {
    const body = await readBody(request);
    return json({ ok: true, library: setActive(String(body.id ?? '')) });
  }

  if (route === '/api/kb/libraries/remove' && method === 'POST') {
    const body = await readBody(request);
    return json({ ok: true, ...removeLibrary(String(body.id ?? ''), Boolean(body.deleteFiles)) });
  }

  if (route === '/api/kb/tree' && method === 'GET') {
    const entry = libRoot(query(request).get('lib'));
    const parent = query(request).get('path') ?? '';
    return json({ ok: true, library: libraryView(entry), ...listTree(entry.root, parent) });
  }

  if (route === '/api/kb/message' && method === 'GET') {
    return json(messageText(ctx, query(request).get('sessionId') ?? '', query(request).get('messageId') ?? ''));
  }

  if (route === '/api/kb/file' && method === 'GET') {
    const entry = libRoot(query(request).get('lib'));
    return json({ ok: true, ...readNote(entry.root, query(request).get('path') ?? '') });
  }

  if (route === '/api/kb/raw' && method === 'GET') {
    const entry = libRoot(query(request).get('lib'));
    const data = readBytes(entry.root, query(request).get('path') ?? '');
    const download = query(request).get('download') === '1';
    const filename = encodeURIComponent(path.basename(data.path));
    return new Response(new Uint8Array(data.bytes), {
      status: 200,
      headers: {
        'content-type': data.mime || mimeOf(data.path),
        'content-length': String(data.size),
        'cache-control': 'no-store',
        'content-disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${filename}`,
      },
    });
  }

  if (route === '/api/kb/preview' && method === 'GET') {
    const entry = libRoot(query(request).get('lib'));
    return json({ ok: true, ...previewOffice(entry.root, query(request).get('path') ?? '') });
  }

  if (route === '/api/kb/file' && method === 'POST') {
    const body = await readBody(request);
    const entry = libRoot(body.lib);
    const result = await writeNote(entry.root, body.path, body.content ?? '', body.expectedHash ?? null);
    return json({ ok: true, ...result });
  }

  if (route === '/api/kb/file/create' && method === 'POST') {
    const body = await readBody(request);
    const entry = libRoot(body.lib);
    return json({ ok: true, ...(await createNote(entry.root, body.path, body.content ?? '')) });
  }

  if (route === '/api/kb/folder' && method === 'POST') {
    const body = await readBody(request);
    const entry = libRoot(body.lib);
    return json({ ok: true, ...createFolder(entry.root, body.path) });
  }

  if (route === '/api/kb/rename' && method === 'POST') {
    const body = await readBody(request);
    const entry = libRoot(body.lib);
    return json({ ok: true, ...(await renameEntry(entry.root, body.from, body.to)) });
  }

  if (route === '/api/kb/delete' && method === 'POST') {
    const body = await readBody(request);
    const entry = libRoot(body.lib);
    return json({ ok: true, ...(await deleteEntry(entry.root, body.path)) });
  }

  if (route === '/api/kb/upload' && method === 'POST') {
    const body = await readBody(request);
    const entry = libRoot(body.lib);
    return json({ ok: true, ...(await saveUpload(entry.root, body.dir ?? 'inbox', body.name, body.data)) });
  }

  // 客户端报错收集：写在插件数据目录，方便诊断运行期异常。
  if (route === '/api/kb/client-log' && method === 'POST') {
    const body = await readBody(request);
    const line = `${new Date().toISOString()} [${String(body.scope ?? 'client')}] ${String(body.message ?? '')}${body.stack ? `\n${String(body.stack)}` : ''}\n`;
    try {
      fs.appendFileSync(path.join(dataDir(), 'client.log'), line, 'utf8');
    } catch {
      /* 日志失败不影响业务 */
    }
    return json({ ok: true });
  }

  if (route === '/api/kb/search' && method === 'GET') {
    const entry = libRoot(query(request).get('lib'));
    const q = query(request).get('q') ?? '';
    return json({ ok: true, ...(await searchLibrary(entry.root, q)) });
  }

  // 全库文件/目录搜索：@kb: 候选用，不要求先选库。
  if (route === '/api/kb/files' && method === 'GET') {
    const q = query(request).get('q') ?? '';
    const limit = Math.min(60, Math.max(1, Number(query(request).get('limit') ?? 30) || 30));
    return json({ ok: true, ...searchFiles(q, limit) });
  }

  if (route === '/api/kb/git' && method === 'GET') {
    const entry = libRoot(query(request).get('lib'));
    return json({
      ok: true,
      status: await gitStatus(entry.root),
      log: await logRecent(entry.root, 8),
    });
  }

  if (route === '/api/kb/git' && method === 'POST') {
    const body = await readBody(request);
    const entry = libRoot(body.lib);
    if (body.action === 'sync') {
      const { credential } = await credentialFor(ctx, entry.remote ?? '');
      return json({
        ok: true,
        ...(await gitSync(entry.root, { credential, mergeUnrelated: body.mergeUnrelated === true })),
      });
    }
    if (body.action === 'commit') {
      return json({ ok: true, ...(await gitManualCommit(entry.root, body.message)) });
    }
    throw new KbError('E_ACTION', '不认识的 git 操作。');
  }

  if (route === '/api/kb/stats' && method === 'GET') {
    const entry = libRoot(query(request).get('lib'));
    return json({ ok: true, ...libraryStats(entry.root) });
  }

  return json({ ok: false, code: 'E_ROUTE', error: '没有这个接口。' }, 404);
}

// 单入口：任何 KbError 都变成带状态码的 JSON，路由层不再需要逐个 try/catch。
export async function handle(request, ctx) {
  try {
    return await dispatch(request, ctx);
  } catch (error) {
    return fail(error);
  }
}

function libraryView(entry) {
  return { id: entry.id, name: entry.name, root: entry.root, remote: entry.remote ?? '' };
}
