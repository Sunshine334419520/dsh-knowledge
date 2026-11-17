import { handle, fail } from './lib/api.mjs';
import {
  findLibrary,
  readNote,
  requireLibrary,
  searchFiles,
  searchLibrary,
  listTree,
  writeNote,
  createNote,
  deleteEntry,
  renameEntry,
  KbError,
} from './lib/store.mjs';

export const name = 'knowledge-base';

const ROUTES = [
  ['/api/kb/libraries', ['GET', 'POST']],
  ['/api/kb/libraries/active', ['POST']],
  ['/api/kb/libraries/remove', ['POST']],
  ['/api/kb/tree', ['GET']],
  ['/api/kb/file', ['GET', 'POST']],
  ['/api/kb/file/create', ['POST']],
  ['/api/kb/folder', ['POST']],
  ['/api/kb/rename', ['POST']],
  ['/api/kb/delete', ['POST']],
  ['/api/kb/upload', ['POST']],
  ['/api/kb/search', ['GET']],
  ['/api/kb/message', ['GET']],
  ['/api/kb/client-log', ['POST']],
  ['/api/kb/files', ['GET']],
  ['/api/kb/git', ['GET', 'POST']],
  ['/api/kb/stats', ['GET']],
];

function registerRoutes(ctx) {
  if (typeof ctx.inject !== 'function') return;
  ctx.inject(['connection'], (inner) => {
    const connection = inner.get?.('connection') ?? inner.connection;
    if (!connection?.fetch?.register || typeof inner.effect !== 'function') {
      console.warn('[knowledge-base] 宿主没有 connection.fetch，知识库界面无法取数。');
      return;
    }
    for (const [path, methods] of ROUTES) {
      inner.effect(
        () =>
          connection.fetch.register({
            path,
            methods,
            requestBody: 'buffered',
            fetch: async (request) => {
              try {
                return await handle(request, ctx);
              } catch (error) {
                return fail(error);
              }
            },
          }),
        `knowledge-base: ${path}`,
      );
    }
  });
}

function text(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function toolOutput(args, value) {
  if (value && value.ok === false) return [{ type: 'text', text: `Error: ${value.error?.message ?? value.error ?? 'unknown'}` }];
  return [{ type: 'text', text: text(value) }];
}

function defineTools(ctx) {
  if (typeof ctx.inject !== 'function') return;
  ctx.inject(['tools'], (inner) => {
    if (!inner.tools?.register || typeof inner.effect !== 'function') return;
    const register = (definition) => {
      try {
        inner.effect(() => inner.tools.register(definition), `knowledge-base: tool ${definition.name}`);
      } catch (error) {
        console.warn(`[knowledge-base] 工具 ${definition.name} 注册失败：${error instanceof Error ? error.message : String(error)}`);
      }
    };

    const libParam = {
      type: 'string',
      description: '知识库 id 或名称；省略时用当前知识库。',
    };

    const guard = async (fn) => {
      try {
        return await fn();
      } catch (error) {
        if (error instanceof KbError) {
          return { ok: false, error: { code: error.code, message: error.message, detail: error.detail } };
        }
        return { ok: false, error: { code: 'E_INTERNAL', message: error instanceof Error ? error.message : String(error) } };
      }
    };

    register({
      name: 'kb_list',
      description: '列出知识库里的文件与目录。返回相对路径、类型、大小。',
      parameters: {
        type: 'object',
        properties: { lib: libParam, path: { type: 'string', description: '目录相对路径，省略为根目录。' } },
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: toolOutput },
      execute: async (args) =>
        guard(async () => {
          const entry = requireLibrary(args.lib);
          const tree = listTree(entry.root, args.path ?? '');
          return { ok: true, library: entry.id, root: entry.root, ...tree };
        }),
    });

    register({
      name: 'kb_read',
      description: '读取知识库里的文本文件，返回带行号的内容。',
      parameters: {
        type: 'object',
        properties: {
          lib: libParam,
          path: { type: 'string', description: '文件相对路径。' },
          offset: { type: 'number', description: '起始行，1 起。' },
          limit: { type: 'number', description: '最多返回多少行，默认 400。' },
        },
        required: ['path'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: toolOutput },
      execute: async (args) =>
        guard(async () => {
          const entry = requireLibrary(args.lib);
          const file = readNote(entry.root, args.path);
          if (file.binary) return { ok: true, ...file, note: '二进制文件，不能按文本读取。' };
          const lines = file.content.split(/\r?\n/);
          const offset = Math.max(1, Number(args.offset ?? 1));
          const limit = Math.min(2000, Math.max(1, Number(args.limit ?? 400)));
          const window = lines.slice(offset - 1, offset - 1 + limit);
          const numbered = window.map((line, index) => `${offset + index}: ${line}`).join('\n');
          const last = offset + window.length - 1;
          const footer =
            last < lines.length ? `(Showing lines ${offset}-${last} of ${lines.length}. Use offset=${last + 1} to continue.)` : `(End of file - total ${lines.length} lines)`;
          return { ok: true, path: file.path, hash: file.hash, content: `${numbered}\n\n${footer}` };
        }),
    });

    register({
      name: 'kb_find',
      description: '在所有知识库里按文件名/路径搜索文件和目录，不需要先指定库。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'number' } },
        required: ['query'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: toolOutput },
      execute: async (args) =>
        guard(async () => {
          const result = searchFiles(args.query, Math.min(60, Math.max(1, Number(args.limit ?? 20))));
          return { ok: true, ...result };
        }),
    });

    register({
      name: 'kb_search',
      description: '在知识库里按文件名和内容搜索，返回命中的相对路径、标题和片段。',
      parameters: {
        type: 'object',
        properties: { lib: libParam, query: { type: 'string' }, limit: { type: 'number' } },
        required: ['query'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: toolOutput },
      execute: async (args) =>
        guard(async () => {
          const entry = requireLibrary(args.lib);
          return { ok: true, library: entry.id, ...(await searchLibrary(entry.root, args.query, args.limit ?? 20)) };
        }),
    });

    register({
      name: 'kb_write',
      description: '在知识库里创建或覆盖一个文本文件。覆盖前应先 kb_read 拿到 hash，并把 hash 作为 expectedHash 传回，避免覆盖别人的修改。',
      parameters: {
        type: 'object',
        properties: {
          lib: libParam,
          path: { type: 'string', description: '文件相对路径，例如 notes/主题.md。' },
          content: { type: 'string' },
          expectedHash: { type: 'string', description: '覆盖时必填：上次 kb_read 返回的 hash。' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: toolOutput },
      execute: async (args) =>
        guard(async () => {
          const entry = requireLibrary(args.lib);
          const result = await writeNote(entry.root, args.path, args.content, args.expectedHash ?? null);
          return { ok: true, library: entry.id, ...result };
        }),
    });

    register({
      name: 'kb_append',
      description: '在知识库文件末尾追加内容；文件不存在时创建。',
      parameters: {
        type: 'object',
        properties: { lib: libParam, path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: toolOutput },
      execute: async (args) =>
        guard(async () => {
          const entry = requireLibrary(args.lib);
          let existing = '';
          let hash = null;
          try {
            const file = readNote(entry.root, args.path);
            if (!file.binary) {
              existing = file.content;
              hash = file.hash;
            }
          } catch (error) {
            if (!(error instanceof KbError) || error.code !== 'E_NOT_FOUND') throw error;
          }
          const joiner = existing && !existing.endsWith('\n') ? '\n' : '';
          const result = await writeNote(entry.root, args.path, `${existing}${joiner}${args.content}`, hash);
          return { ok: true, library: entry.id, mode: 'append', ...result };
        }),
    });

    register({
      name: 'kb_delete',
      description: '删除知识库里的文件或目录（移入 .kb/trash，不是永久删除）。',
      parameters: {
        type: 'object',
        properties: { lib: libParam, path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: toolOutput },
      execute: async (args) =>
        guard(async () => {
          const entry = requireLibrary(args.lib);
          return { ok: true, library: entry.id, ...(await deleteEntry(entry.root, args.path)) };
        }),
    });

    register({
      name: 'kb_move',
      description: '移动或重命名知识库里的文件/目录。',
      parameters: {
        type: 'object',
        properties: { lib: libParam, from: { type: 'string' }, to: { type: 'string' } },
        required: ['from', 'to'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: toolOutput },
      execute: async (args) =>
        guard(async () => {
          const entry = requireLibrary(args.lib);
          return { ok: true, library: entry.id, ...(await renameEntry(entry.root, args.from, args.to)) };
        }),
    });

    register({
      name: 'kb_create',
      description: '在知识库里新建一个文本文件（同名会拒绝，不覆盖）。',
      parameters: {
        type: 'object',
        properties: { lib: libParam, path: { type: 'string' }, content: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
      output: { schema: { type: 'object' }, render: toolOutput },
      execute: async (args) =>
        guard(async () => {
          const entry = requireLibrary(args.lib);
          return { ok: true, library: entry.id, ...(await createNote(entry.root, args.path, args.content ?? '')) };
        }),
    });
  });
}

const KB_PROMPT = `知识库（Knowledge Base）是用户本地的资料集合，由知识库插件管理，文件存放在用户指定的目录，并由 Git 记录版本。

用户消息里的 @kb:<库名>/<路径> 表示用户明确引用了知识库里的文件。它不同于 @<路径>：前者是知识库相对路径，必须用 kb_read / kb_list / kb_search 读取，不要当成工作区文件用 read 打开。结尾 #L12-L34 表示行范围。

可用工具：
- kb_list：列库、列某个目录；
- kb_read：读一个文件（带行号，可分段）；
- kb_search：按标题与正文搜索；
- kb_write / kb_append：整体重写或追加；
- kb_create / kb_move / kb_delete：新建、移动、删除。

写入规则：只在用户明确要求保存、修改或整理知识库时写入；用户的明确要求即授权，直接把内容写入合适的位置并在回复里说明写入路径即可。没有被要求时不要主动写入。
读一个尚未完整读过的文件之前不要用 kb_write 整体覆盖：先 kb_read 拿到 hash，再用 kb_write 的 expectedHash 回写，避免覆盖用户或其他人的修改。`;

function registerPrompt(ctx) {
  const prompt = ctx.get?.('systemPrompt') ?? ctx.systemPrompt;
  if (!prompt?.section || typeof ctx.effect !== 'function') return;
  ctx.effect(
    () =>
      prompt.section({
        name: 'knowledge-base',
        order: 92,
        text: KB_PROMPT,
      }),
    'knowledge-base: prompt',
  );
}

export function apply(ctx, config = {}) {
  registerRoutes(ctx);
  defineTools(ctx);
  registerPrompt(ctx);
  if (config && config.debug) {
    console.log('[knowledge-base] apply', { config });
  }
}

export { findLibrary };
