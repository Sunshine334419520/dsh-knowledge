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
  readNote,
  removeLibrary,
  renameEntry,
  requireLibrary,
  saveUpload,
  searchFiles,
  searchLibrary,
  setActive,
  writeNote,
  dataDir,
  profileDir,
} from './store.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { gitVersion, logRecent } from './git.mjs';

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
  E_DUPLICATE: 409,
  E_NO_GIT: 409,
  E_NO_REMOTE: 409,
  E_READONLY: 403,
};

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export function fail(error) {
  const code = error instanceof KbError ? error.code : 'E_INTERNAL';
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
    const result = await createLibrary({
      name: body.name,
      root: body.root,
      remote: body.remote,
      git: body.git !== false,
    });
    return json({ ok: true, ...result });
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
    if (body.action === 'sync') return json({ ok: true, ...(await gitSync(entry.root)) });
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
