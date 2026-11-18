import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  DEFAULT_BRANCH,
  classifyGitError,
  cloneRemote,
  commitAll,
  countAheadBehind,
  currentBranch,
  fetchRemote,
  hasMergeBase,
  hasRef,
  initRepo,
  isRepo,
  mergeRemote,
  probeRemote,
  pushBranch,
  redactGitOutput,
  runGit,
  setUpstream,
} from './git.mjs';
import { parseRemote, resolveLibraryTarget } from './paths.mjs';

export const REGISTRY_VERSION = 1;
export const INTERNAL_DIR = '.kb';
export const TRASH_DIR = '.kb/trash';
export const SEED_DIRS = ['inbox', 'notes', 'projects', 'assets', 'templates'];
export const MAX_READ_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

const TEXT_EXT = new Set([
  '.md', '.markdown', '.mdx', '.txt', '.json', '.yaml', '.yml', '.csv', '.tsv',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.scss', '.html', '.htm',
  '.xml', '.py', '.rb', '.go', '.rs', '.java', '.c', '.h', '.cpp', '.sh', '.ps1',
  '.sql', '.toml', '.ini', '.log', '.tex', '.rst', '.adoc',
]);

const SKIP_NAMES = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db']);

export class KbError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'KbError';
    this.code = code;
    this.detail = detail ?? null;
  }
}

export function isTextFile(name) {
  return TEXT_EXT.has(path.extname(String(name)).toLowerCase());
}

export function hashText(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex').slice(0, 16);
}

export function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

export function profileDir() {
  return (
    process.env.DSH_PROFILE_DIR ||
    process.env.DSH_HOME ||
    path.join(os.homedir(), '.dsh')
  );
}

export function dataDir() {
  const dir = path.join(profileDir(), 'knowledge-base');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function registryFile() {
  return path.join(dataDir(), 'libraries.json');
}

function readRegistry() {
  try {
    const raw = fs.readFileSync(registryFile(), 'utf8');
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.libraries)) {
      return {
        version: REGISTRY_VERSION,
        libraries: data.libraries.filter((row) => row && typeof row.id === 'string' && typeof row.root === 'string'),
        activeId: typeof data.activeId === 'string' ? data.activeId : null,
      };
    }
  } catch {
    /* first run */
  }
  return { version: REGISTRY_VERSION, libraries: [], activeId: null };
}

function writeRegistry(registry) {
  const file = registryFile();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function newId() {
  return `kb-${crypto.randomBytes(4).toString('hex')}`;
}

export function expandHome(input) {
  const text = String(input ?? '').trim().replace(/^"(.*)"$/, '$1');
  if (!text) return '';
  if (text === '~') return os.homedir();
  if (text.startsWith('~/') || text.startsWith('~\\')) return path.join(os.homedir(), text.slice(2));
  return text;
}

export function normalizeRel(input) {
  const raw = String(input ?? '').replaceAll('\\', '/').trim();
  const cleaned = path.posix.normalize(raw).replace(/^\/+/, '');
  if (cleaned === '.' || cleaned === '') return '';
  if (cleaned === '..' || cleaned.startsWith('../')) {
    throw new KbError('E_PATH', '路径越出了知识库根目录。');
  }
  return cleaned;
}

export function resolveInside(root, rel) {
  const safe = normalizeRel(rel);
  const target = path.resolve(root, safe);
  const base = path.resolve(root);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new KbError('E_PATH', '路径越出了知识库根目录。');
  }
  return target;
}

function safeLeafName(name) {
  const leaf = path.basename(String(name ?? '').replaceAll('\\', '/')).trim();
  if (!leaf || leaf === '.' || leaf === '..' || /[<>:"/\\|?*\u0000-\u001f]/.test(leaf)) {
    throw new KbError('E_NAME', '文件名不合法。');
  }
  return leaf;
}

function readFirstLine(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/)[0]?.trim() ?? '';
  } catch {
    return '';
  }
}

/** 当前分支（从 .git/HEAD 读，免得起一个 git 进程）。detached 时返回 null。 */
function readBranchFile(root) {
  const head = readFirstLine(path.join(root, '.git', 'HEAD'));
  const matched = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
  return matched ? matched[1] : null;
}

/** 引用是否存在：loose ref 文件，或者 packed-refs 里的一行。 */
function hasLooseOrPackedRef(root, ref) {
  const gitDir = path.join(root, '.git');
  if (fs.existsSync(path.join(gitDir, ref))) return true;
  try {
    const packed = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
    return packed.split(/\r?\n/).some((line) => line.trim().endsWith(` ${ref}`));
  } catch {
    return false;
  }
}

/** 本地有提交、有远端、但从没推上去过 —— 界面据此显示「初始化云端」。 */
function needsFirstPush(root, branch, remote) {
  if (!remote || !branch) return false;
  if (!hasLooseOrPackedRef(root, `refs/heads/${branch}`)) return false;
  return !hasLooseOrPackedRef(root, `refs/remotes/origin/${branch}`);
}

function libraryView(entry) {
  let exists = false;
  let repo = false;
  let branch = null;
  let remote = entry.remote ?? '';
  let needsPush = false;
  try {
    exists = fs.statSync(entry.root).isDirectory();
  } catch {
    exists = false;
  }
  if (exists) {
    repo = fs.existsSync(path.join(entry.root, '.git'));
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(entry.root, INTERNAL_DIR, 'config.json'), 'utf8'));
      if (!remote && typeof cfg.remote === 'string') remote = cfg.remote;
    } catch {
      /* marker may be absent for adopted folders */
    }
    if (repo) {
      branch = readBranchFile(entry.root);
      needsPush = needsFirstPush(entry.root, branch, remote);
    }
  }
  return {
    id: entry.id,
    name: entry.name,
    root: entry.root,
    remote,
    createdAt: entry.createdAt ?? null,
    lastOpenedAt: entry.lastOpenedAt ?? null,
    exists,
    git: { repo, branch, needsPush },
  };
}

export function listLibraries() {
  const registry = readRegistry();
  return registry.libraries.map(libraryView);
}

export function findLibrary(idOrName) {
  const key = String(idOrName ?? '').trim();
  const registry = readRegistry();
  const rows = registry.libraries;
  if (!key) {
    if (registry.activeId) {
      const active = rows.find((row) => row.id === registry.activeId);
      if (active) return active;
    }
    if (rows.length === 1) return rows[0];
    return null;
  }
  return (
    rows.find((row) => row.id === key) ??
    rows.find((row) => row.name === key) ??
    rows.find((row) => path.resolve(row.root) === path.resolve(expandHome(key))) ??
    null
  );
}

export function requireLibrary(idOrName) {
  const entry = findLibrary(idOrName);
  if (!entry) throw new KbError('E_NO_LIBRARY', '还没有这个知识库，先创建一个。');
  if (!fs.existsSync(entry.root) || !fs.statSync(entry.root).isDirectory()) {
    throw new KbError('E_NO_ROOT', `知识库目录不存在：${entry.root}`, { root: entry.root });
  }
  return entry;
}

export function setActive(id) {
  const registry = readRegistry();
  const entry = registry.libraries.find((row) => row.id === id);
  if (!entry) throw new KbError('E_NO_LIBRARY', '没有这个知识库。');
  entry.lastOpenedAt = new Date().toISOString();
  registry.activeId = id;
  writeRegistry(registry);
  return libraryView(entry);
}

const GITIGNORE_LINES = ['.kb/', '.DS_Store', 'Thumbs.db'];
const NOISE_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

function countContent(root) {
  let existing = 0;
  for (const name of fs.readdirSync(root)) {
    if (name === INTERNAL_DIR || name === '.git' || NOISE_NAMES.has(name)) continue;
    existing += 1;
  }
  return existing;
}

/**
 * 补齐种子目录。新建的库铺全套；克隆/接管的目录只补缺的，并给空目录放 .gitkeep，
 * 这样远端仓库在别的机器克隆下来也有 inbox/notes/... 的骨架。
 */
export function ensureSeedDirs(root, { gitkeep = true } = {}) {
  const created = [];
  for (const dir of SEED_DIRS) {
    const abs = path.join(root, dir);
    const existed = fs.existsSync(abs);
    if (!existed) {
      fs.mkdirSync(abs, { recursive: true });
      created.push(dir);
    }
    if (!gitkeep) continue;
    const keep = path.join(abs, '.gitkeep');
    if (fs.existsSync(keep)) continue;
    let empty = true;
    try {
      empty = fs.readdirSync(abs).length === 0;
    } catch {
      empty = true;
    }
    if (!existed || empty) fs.writeFileSync(keep, '', 'utf8');
  }
  return created;
}

/** `.kb/` 整目录留在本机，不进 git；已有的 .gitignore 内容原样保留。 */
function ensureGitignore(root) {
  const file = path.join(root, '.gitignore');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const lines = current
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '.kb/trash/' && line !== '.kb/tmp/');
  const missing = GITIGNORE_LINES.filter((line) => !lines.includes(line));
  if (!missing.length && current.trim()) return false;
  const rest = lines.filter((line) => !GITIGNORE_LINES.includes(line));
  fs.writeFileSync(file, `${[...GITIGNORE_LINES, ...rest].join('\n')}\n`, 'utf8');
  return true;
}

/** 写库身份标记；已存在就保留它原来的 id/createdAt（身份跟着目录走）。 */
function writeMarker(root, fields) {
  const dir = path.join(root, INTERNAL_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'config.json');
  let existing = null;
  try {
    existing = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    existing = null;
  }
  const next = {
    id: existing?.id ?? fields.id,
    name: fields.name ?? existing?.name ?? '',
    remote: fields.remote !== undefined ? fields.remote : (existing?.remote ?? ''),
    createdAt: existing?.createdAt ?? fields.createdAt,
  };
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

/**
 * 把本地和远端对齐：空的远端什么都不做；非空远端先 fetch，再按情况合并。
 * 默认拒绝"两段互不相关的历史"（mergeUnrelated=false），需要时必须显式允许。
 */
async function alignWithRemote(root, { remote, credential = null, probe: probeIn = null, mergeUnrelated = false }) {
  const probe = probeIn ?? (await probeRemote(remote, { credential }));
  if (!probe.ok) {
    return { ok: false, stage: 'probe', code: probe.code, message: probe.message, raw: probe.raw ?? null };
  }
  const branch = (await currentBranch(root)) || DEFAULT_BRANCH;
  if (probe.empty) {
    return { ok: true, branch, empty: true, merged: false, defaultBranch: probe.defaultBranch ?? null };
  }
  const fetched = await fetchRemote(root, { credential });
  if (fetched.code !== 0) {
    return { ok: false, stage: 'fetch', ...classifyGitError(fetched.stderr || fetched.stdout, fetched) };
  }
  const remoteRef = `origin/${branch}`;
  let merged = false;
  if (await hasRef(root, remoteRef)) {
    const base = await hasMergeBase(root, 'HEAD', remoteRef);
    if (!base) {
      if (!mergeUnrelated) {
        return {
          ok: false,
          stage: 'diverge',
          code: 'E_REMOTE_DIVERGED',
          message: '远端已经有一段独立的历史，和本地没有共同祖先。默认不会自动合并；确认要合并的话，在高级选项里允许合并无关历史。',
          defaultBranch: probe.defaultBranch ?? null,
        };
      }
      const merge = await mergeRemote(root, remoteRef, { allowUnrelated: true });
      if (!merge.ok) {
        return { ok: false, stage: 'merge', code: 'E_CONFLICT', message: merge.message, conflicts: merge.conflicts, defaultBranch: probe.defaultBranch ?? null };
      }
      merged = true;
    } else {
      const counts = await countAheadBehind(root, remoteRef);
      if (counts?.behind > 0) {
        const merge = await mergeRemote(root, remoteRef);
        if (!merge.ok) {
          return { ok: false, stage: 'merge', code: 'E_CONFLICT', message: merge.message, conflicts: merge.conflicts, defaultBranch: probe.defaultBranch ?? null };
        }
        merged = true;
      }
      await setUpstream(root, branch, branch);
    }
  }
  return { ok: true, branch, empty: false, merged, defaultBranch: probe.defaultBranch ?? null };
}

/** 对齐 + 推送。创建库时调用；失败只降级成提示，不影响本地库。 */
async function bootstrapRemoteRef(root, { remote, credential = null, probe: probeIn = null, mergeUnrelated = false }) {
  const align = await alignWithRemote(root, { remote, credential, probe: probeIn, mergeUnrelated });
  if (!align.ok) return { ok: false, ...align };
  const push = await pushBranch(root, align.branch, { credential });
  if (push.code !== 0) {
    return { ok: false, stage: 'push', ...classifyGitError(push.stderr || push.stdout, push) };
  }
  let warning = null;
  if (align.empty) {
    const after = await probeRemote(remote, { credential });
    if (after.ok && after.defaultBranch && after.defaultBranch !== align.branch) {
      warning = `远端默认分支还指向 ${after.defaultBranch}，第一次推送后可能仍显示为空仓库；在仓库设置里把默认分支改成 ${align.branch} 即可。`;
    }
  }
  return { ok: true, stage: 'push', branch: align.branch, merged: align.merged, warning };
}

/**
 * 建库。两种入口：
 *   { parent, remote, folder? }  —— 推荐：库目录 = 父目录 + 仓库名（可由 folder 覆盖）
 *   { root, remote? }            —— 兼容老调用：直接用这个目录
 * 远端为空 -> 本地初始化后首推；远端有内容 -> clone 到暂存目录再落位；
 * 目标目录已有内容 -> 默认拒绝，adopt=true 才接管（mergeUnrelated 再放开合并）。
 */
export async function createLibrary(options = {}) {
  const {
    name,
    root,
    parent,
    folder,
    remote: remoteInput,
    git = true,
    credential = null,
    adopt = false,
    mergeUnrelated = false,
    probe: allowProbe = true,
  } = options;

  const displayName = String(name ?? '').trim() || '我的知识库';
  const remoteText = String(remoteInput ?? '').trim();
  const parsed = remoteText ? parseRemote(remoteText) : null;
  if (remoteText && !parsed.ok) throw new KbError('E_REMOTE_INVALID', parsed.message, { remote: remoteText });

  let target;
  if (String(parent ?? '').trim()) {
    target = resolveLibraryTarget({
      parent,
      name: folder,
      remote: remoteText,
      fallback: displayName,
    });
    if (!target.ok) throw new KbError(target.code, target.message, target);
  } else {
    const rawRoot = String(root ?? '').trim();
    if (!rawRoot) throw new KbError('E_ROOT', '本地目录不能为空。');
    const expanded = path.resolve(expandHome(rawRoot));
    target = {
      root: expanded,
      parent: path.dirname(expanded),
      dir: path.basename(expanded),
      dirChanged: false,
      dirOriginal: path.basename(expanded),
      remote: parsed?.ok ? parsed : null,
    };
  }
  const expanded = target.root;

  const registry = readRegistry();
  if (registry.libraries.some((row) => path.resolve(row.root) === expanded)) {
    throw new KbError('E_DUPLICATE', '这个目录已经是一个知识库了。');
  }

  const existed = fs.existsSync(expanded);
  if (existed && !fs.statSync(expanded).isDirectory()) {
    throw new KbError('E_ROOT', '本地目录指向的是一个文件，不是文件夹。');
  }
  const existing = existed ? countContent(expanded) : 0;
  const hasMarker = existed && fs.existsSync(path.join(expanded, INTERNAL_DIR, 'config.json'));
  const repoReady = existed && (await isRepo(expanded));
  const adoptTarget = hasMarker || repoReady;
  const pristine = !existed || (existing === 0 && !adoptTarget);
  if (!pristine && !adoptTarget && !adopt) {
    throw new KbError(
      'E_DIR_NOT_EMPTY',
      `目录里已经有 ${existing} 项内容。换一个空目录，或者在高级选项里选择「接管这个目录」。`,
      { root: expanded, existing },
    );
  }

  let remoteProbe = null;
  if (git && remoteText && allowProbe) {
    remoteProbe = await probeRemote(remoteText, { credential });
  }
  const remoteHasContent = remoteProbe?.ok === true && remoteProbe.empty === false;

  let cloned = false;
  let created = !existed;

  if (remoteHasContent && !adoptTarget) {
    // 远端有内容：clone 到同类目录下的暂存目录，成功后再换名就位，
    // 半途失败不会在目标位置留下半个库。
    fs.mkdirSync(path.dirname(expanded), { recursive: true });
    const staging = path.join(
      path.dirname(expanded),
      `.kb-staging-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    );
    try {
      await cloneRemote(remoteText, staging, {
        credential,
        branch: remoteProbe.defaultBranch ?? remoteProbe.branches?.[0] ?? undefined,
      });
      if (existed) fs.rmSync(expanded, { recursive: true, force: true });
      fs.renameSync(staging, expanded);
      cloned = true;
      created = true;
    } catch (error) {
      fs.rmSync(staging, { recursive: true, force: true });
      const classified = error.classified ?? { code: 'E_GIT', message: '克隆远端仓库失败。', raw: '' };
      throw new KbError(classified.code, classified.message, {
        raw: redactGitOutput(classified.raw ?? '', credential),
        remote: remoteText,
      });
    }
  } else if (!existed) {
    fs.mkdirSync(expanded, { recursive: true });
    created = true;
  }

  // 只有"我们的目录"才补种子：新建、克隆、或带 .kb 标记的旧库。
  // 接管一个别人的 git 仓库时不要往里塞 inbox/notes/...。
  const seeded = cloned || pristine || hasMarker ? ensureSeedDirs(expanded) : [];
  ensureGitignore(expanded);

  let marker = writeMarker(expanded, {
    id: newId(),
    name: displayName,
    remote: remoteText,
    createdAt: new Date().toISOString(),
  });

  const readme = path.join(expanded, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      `# ${displayName}\n\n这是 DeepSeek Harness 的知识库，由本地目录和 Git 管理。\n\n- \`inbox/\` 收件箱：还没整理的内容先放这里\n- \`notes/\` 笔记：整理过的主题笔记\n- \`projects/\` 项目：按项目归档\n- \`assets/\` 附件：图片、PDF 等\n- \`templates/\` 模板\n\n在左栏的「知识库」里浏览、编辑；在对话里用 \`@kb:\` 引用文件。\n`,
      'utf8',
    );
  }

  let gitInfo = { repo: false, committed: false, branch: null, error: null };
  let bootstrap = null;
  if (git) {
    try {
      if (!(await isRepo(expanded))) await initRepo(expanded);
      gitInfo.repo = true;
      if (remoteText) {
        const current = await runGit(expanded, ['remote', 'get-url', 'origin']);
        if (current.code !== 0 || !current.stdout.trim()) {
          const added = await runGit(expanded, ['remote', 'add', 'origin', remoteText]);
          if (added.code !== 0) throw new Error(added.stderr || 'remote add 失败');
        } else if (current.stdout.trim() !== remoteText) {
          await runGit(expanded, ['remote', 'set-url', 'origin', remoteText]);
        }
      }
      const commit = await commitAll(expanded, 'kb: init knowledge base');
      gitInfo.committed = commit.committed;
      gitInfo.branch = commit.branch;
      if (cloned) {
        // 老版本把 .kb/ 提交进了 git：克隆下来后把它从索引里摘掉，文件留在本机。
        const tracked = await runGit(expanded, ['ls-files', '.kb']);
        if (tracked.code === 0 && tracked.stdout.trim()) {
          await runGit(expanded, ['rm', '-r', '--cached', '--quiet', '.kb']);
          await commitAll(expanded, 'kb: keep .kb internal to this machine');
        }
      }
      if (remoteText) {
        bootstrap = await bootstrapRemoteRef(expanded, {
          remote: remoteText,
          credential,
          probe: remoteProbe,
          mergeUnrelated,
        });
      }
    } catch (error) {
      gitInfo.error = error instanceof Error ? error.message : String(error);
    }
  }

  let id = marker?.id;
  if (!id || registry.libraries.some((row) => row.id === id)) {
    id = newId();
    marker = writeMarker(expanded, {
      id,
      name: displayName,
      remote: remoteText,
      createdAt: new Date().toISOString(),
    });
  }

  const now = new Date().toISOString();
  const entry = {
    id,
    name: displayName,
    root: expanded,
    remote: remoteText,
    createdAt: now,
    lastOpenedAt: now,
  };
  registry.libraries.push(entry);
  registry.activeId = id;
  writeRegistry(registry);

  return {
    library: libraryView(entry),
    created,
    cloned,
    adopted: !pristine || adoptTarget,
    target: {
      parent: target.parent,
      dir: target.dir,
      root: expanded,
      dirChanged: target.dirChanged === true,
      dirOriginal: target.dirOriginal,
    },
    seeded,
    marker,
    git: gitInfo,
    remote: parsed?.ok
      ? {
          host: parsed.host,
          hostKey: parsed.hostKey,
          kind: parsed.kind,
          webBase: parsed.webBase,
          tokenUrl: parsed.tokenUrl,
          reachable: remoteProbe?.ok === true,
          empty: remoteProbe?.ok === true ? remoteProbe.empty : null,
          defaultBranch: remoteProbe?.ok === true ? remoteProbe.defaultBranch : null,
          error: remoteProbe && remoteProbe.ok === false ? { code: remoteProbe.code, message: remoteProbe.message } : null,
        }
      : null,
    bootstrap,
  };
}

export function removeLibrary(id, deleteFiles = false) {
  const registry = readRegistry();
  const index = registry.libraries.findIndex((row) => row.id === id);
  if (index < 0) throw new KbError('E_NO_LIBRARY', '没有这个知识库。');
  const [entry] = registry.libraries.splice(index, 1);
  if (registry.activeId === id) registry.activeId = registry.libraries[0]?.id ?? null;
  writeRegistry(registry);
  if (deleteFiles) {
    try {
      fs.rmSync(entry.root, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
  return { id, deleted: Boolean(deleteFiles) };
}

export function listTree(root, rel = '') {
  const target = resolveInside(root, rel);
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    throw new KbError('E_NOT_FOUND', '目录不存在。');
  }
  if (!stat.isDirectory()) throw new KbError('E_NOT_DIR', '这不是一个目录。');
  const entries = [];
  for (const item of fs.readdirSync(target, { withFileTypes: true })) {
    if (SKIP_NAMES.has(item.name)) continue;
    if (item.name.startsWith('.')) continue;
    const full = path.join(target, item.name);
    const childRel = normalizeRel(path.posix.join(normalizeRel(rel), item.name));
    let childStat = null;
    try {
      childStat = fs.statSync(full);
    } catch {
      continue;
    }
    entries.push({
      name: item.name,
      path: childRel,
      type: item.isDirectory() ? 'dir' : 'file',
      size: item.isDirectory() ? null : childStat.size,
      mtimeMs: childStat.mtimeMs,
      text: item.isDirectory() ? false : isTextFile(item.name),
    });
  }
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
  return { path: normalizeRel(rel), entries };
}

export function readNote(root, rel) {
  const target = resolveInside(root, rel);
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    throw new KbError('E_NOT_FOUND', '文件不存在。');
  }
  if (!stat.isFile()) throw new KbError('E_NOT_FILE', '这不是一个文件。');
  const ext = path.extname(target).toLowerCase();
  const text = isTextFile(target);
  if (!text) {
    return {
      path: normalizeRel(rel),
      binary: true,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      ext,
    };
  }
  if (stat.size > MAX_READ_BYTES) {
    throw new KbError('E_TOO_LARGE', '文件太大，超过 2 MB，先在磁盘上处理。', { size: stat.size });
  }
  const buffer = fs.readFileSync(target);
  if (buffer.includes(0)) {
    return { path: normalizeRel(rel), binary: true, size: stat.size, mtimeMs: stat.mtimeMs, ext };
  }
  const content = buffer.toString('utf8');
  return {
    path: normalizeRel(rel),
    binary: false,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    hash: hashText(content),
    content,
    ext,
  };
}

function atomicWrite(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.kb-tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, target);
}

export async function writeNote(root, rel, content, expectedHash) {
  const target = resolveInside(root, rel);
  const normalized = normalizeRel(rel);
  if (!normalized) throw new KbError('E_PATH', '缺少文件名。');
  const exists = fs.existsSync(target);
  let before = null;
  if (exists) {
    if (!fs.statSync(target).isFile()) throw new KbError('E_NOT_FILE', '目标是一个目录。');
    const current = fs.readFileSync(target);
    before = hashText(current.toString('utf8'));
    if (expectedHash && before !== expectedHash) {
      throw new KbError('E_CONFLICT', '文件在别处被改过了，重新打开再保存。', { currentHash: before });
    }
  }
  atomicWrite(target, String(content ?? ''));
  const hash = hashText(String(content ?? ''));
  const commit = await commitAll(root, `${exists ? 'kb: update' : 'kb: add'} ${normalized}`).catch((error) => ({
    committed: false,
    error: error instanceof Error ? error.message : String(error),
  }));
  return { path: normalized, created: !exists, hash, before, commit };
}

export async function createNote(root, rel, content = '') {
  const target = resolveInside(root, rel);
  if (!normalizeRel(rel)) throw new KbError('E_PATH', '缺少文件名。');
  if (fs.existsSync(target)) throw new KbError('E_EXISTS', '同名文件已经存在。');
  atomicWrite(target, String(content));
  const commit = await commitAll(root, `kb: add ${normalizeRel(rel)}`).catch(() => ({ committed: false }));
  return { path: normalizeRel(rel), hash: hashText(String(content)), commit };
}

export async function createFolder(root, rel) {
  const target = resolveInside(root, rel);
  if (!normalizeRel(rel)) throw new KbError('E_PATH', '缺少目录名。');
  if (fs.existsSync(target)) throw new KbError('E_EXISTS', '同名目录已经存在。');
  fs.mkdirSync(target, { recursive: true });
  return { path: normalizeRel(rel) };
}

export async function renameEntry(root, from, to) {
  const source = resolveInside(root, from);
  const target = resolveInside(root, to);
  if (!fs.existsSync(source)) throw new KbError('E_NOT_FOUND', '源文件不存在。');
  if (fs.existsSync(target)) throw new KbError('E_EXISTS', '目标位置已经有同名文件。');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(source, target);
  const commit = await commitAll(root, `kb: move ${normalizeRel(from)} -> ${normalizeRel(to)}`).catch(() => ({
    committed: false,
  }));
  return { from: normalizeRel(from), to: normalizeRel(to), commit };
}

export async function deleteEntry(root, rel) {
  const target = resolveInside(root, rel);
  const normalized = normalizeRel(rel);
  if (!normalized) throw new KbError('E_PATH', '不能删除知识库根目录。');
  if (!fs.existsSync(target)) throw new KbError('E_NOT_FOUND', '文件不存在。');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const trash = path.join(root, TRASH_DIR, stamp, normalized);
  fs.mkdirSync(path.dirname(trash), { recursive: true });
  fs.renameSync(target, trash);
  const commit = await commitAll(root, `kb: delete ${normalized}`).catch(() => ({ committed: false }));
  return { path: normalized, trash: path.relative(root, trash).replaceAll('\\', '/'), commit };
}

export async function saveUpload(root, dir, name, base64) {
  const leaf = safeLeafName(name);
  const buffer = Buffer.from(String(base64 ?? ''), 'base64');
  if (!buffer.length) throw new KbError('E_EMPTY', '上传内容是空的。');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new KbError('E_TOO_LARGE', '单个文件上限 32 MB。');
  const folder = resolveInside(root, dir);
  fs.mkdirSync(folder, { recursive: true });
  let target = path.join(folder, leaf);
  let base = path.parse(leaf).name;
  let ext = path.parse(leaf).ext;
  let n = 1;
  while (fs.existsSync(target)) {
    target = path.join(folder, `${base} (${n})${ext}`);
    n += 1;
  }
  fs.writeFileSync(target, buffer);
  const rel = path.relative(root, target).replaceAll('\\', '/');
  const commit = await commitAll(root, `kb: upload ${rel}`).catch(() => ({ committed: false }));
  return { path: rel, size: buffer.length, hash: hashBuffer(buffer), commit };
}

export async function searchLibrary(root, query, limit = 30) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return { query: '', total: 0, hits: [] };
  const hits = [];
  const queue = [''];
  let scanned = 0;
  while (queue.length && hits.length < 200 && scanned < 5000) {
    const rel = queue.shift();
    const target = resolveInside(root, rel);
    let entries;
    try {
      entries = fs.readdirSync(target, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const item of entries) {
      if (SKIP_NAMES.has(item.name) || item.name.startsWith('.')) continue;
      const childRel = path.posix.join(rel, item.name);
      const full = path.join(target, item.name);
      if (item.isDirectory()) {
        queue.push(childRel);
        continue;
      }
      scanned += 1;
      let score = 0;
      let snippet = '';
      let title = '';
      if (item.name.toLowerCase().includes(needle)) score += 60;
      let content = '';
      try {
        const stat = fs.statSync(full);
        if (isTextFile(item.name) && stat.size <= 512 * 1024) content = fs.readFileSync(full, 'utf8');
      } catch {
        content = '';
      }
      if (content) {
        const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
        const titleMatch = front ? /^title:\s*(.+)$/m.exec(front[1]) : null;
        title = titleMatch ? titleMatch[1].replace(/^["']|["']$/g, '').trim() : '';
        const lower = content.toLowerCase();
        const at = lower.indexOf(needle);
        if (at >= 0) {
          score += 25;
          const start = Math.max(0, at - 60);
          snippet = content.slice(start, at + 120).replace(/\s+/g, ' ').trim();
        }
        if (title && title.toLowerCase().includes(needle)) score += 30;
      }
      if (score > 0) hits.push({ path: childRel, name: item.name, title: title || item.name.replace(/\.[^.]+$/, ''), snippet, score });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return { query, total: hits.length, hits: hits.slice(0, limit) };
}

// 全库文件名/路径搜索：@kb: 的候选直接用这个，不需要先选库再进目录。
export function searchFiles(query, limit = 30) {
  const needle = String(query ?? '').trim().toLowerCase();
  const registry = readRegistry();
  const hits = [];
  let scanned = 0;
  const maxScan = 20000;

  for (const entry of registry.libraries) {
    let ok = false;
    try {
      ok = fs.statSync(entry.root).isDirectory();
    } catch {
      ok = false;
    }
    if (!ok) continue;

    const stack = [{ rel: '', depth: 0 }];
    while (stack.length && scanned < maxScan) {
      const current = stack.pop();
      if (current.depth > 6) continue;
      let dirents = [];
      try {
        dirents = fs.readdirSync(path.join(entry.root, current.rel), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const item of dirents) {
        if (SKIP_NAMES.has(item.name) || item.name.startsWith('.')) continue;
        const rel = current.rel ? `${current.rel}/${item.name}` : item.name;
        if (item.isDirectory()) {
          scanned += 1;
          if (needle && item.name.toLowerCase().includes(needle)) {
            hits.push({
              type: 'dir',
              lib: entry.id,
              libName: entry.name,
              name: item.name,
              path: rel,
              score: 420 - current.depth * 5,
            });
          }
          stack.push({ rel, depth: current.depth + 1 });
          continue;
        }
        scanned += 1;
        let stat = null;
        try {
          stat = fs.statSync(path.join(entry.root, rel));
        } catch {
          stat = null;
        }
        if (!needle) {
          if (!stat) continue;
          hits.push({
            type: 'file',
            lib: entry.id,
            libName: entry.name,
            name: item.name,
            path: rel,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            score: 0,
          });
          continue;
        }
        const name = item.name.toLowerCase();
        const full = rel.toLowerCase();
        let score = 0;
        if (name === needle) score = 1000;
        else if (name.startsWith(needle)) score = 820;
        else if (name.includes(needle)) score = 620;
        else if (full.includes(needle)) score = 420;
        else {
          let at = 0;
          let gap = 0;
          let matched = true;
          for (const ch of needle) {
            const found = full.indexOf(ch, at);
            if (found < 0) {
              matched = false;
              break;
            }
            gap += found - at;
            at = found + 1;
          }
          if (!matched) continue;
          score = Math.max(60, 260 - gap);
        }
        hits.push({
          type: 'file',
          lib: entry.id,
          libName: entry.name,
          name: item.name,
          path: rel,
          size: stat?.size ?? null,
          mtimeMs: stat?.mtimeMs ?? null,
          score,
        });
      }
    }
  }

  if (needle) hits.sort((a, b) => b.score - a.score || a.path.length - b.path.length);
  else hits.sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0));
  return { query: needle, total: hits.length, hits: hits.slice(0, Math.max(1, limit)) };
}

export async function gitStatus(root) {
  const repo = fs.existsSync(path.join(root, '.git'));
  if (!repo) return { repo: false };
  const status = await runGit(root, ['status', '--porcelain=v1', '--branch']);
  const lines = status.stdout.split(/\r?\n/).filter(Boolean);
  const head = lines[0] ?? '';
  const branchMatch = /^##\s+([^.\s]+)(?:\.\.\.([^\s\[]+))?(?:\s+\[(.+)\])?/.exec(head);
  const changed = lines.slice(1).filter((line) => line.trim()).map((line) => ({
    status: line.slice(0, 2).trim(),
    path: line.slice(3).trim(),
  }));
  const remote = await runGit(root, ['remote', 'get-url', 'origin']).catch(() => ({ code: 1, stdout: '' }));
  return {
    repo: true,
    branch: branchMatch?.[1] ?? null,
    upstream: branchMatch?.[2] ?? null,
    aheadBehind: branchMatch?.[3] ?? null,
    dirty: changed.length,
    changed: changed.slice(0, 100),
    remote: remote.code === 0 ? remote.stdout.trim() : '',
  };
}

/**
 * 同步：提交本地改动 -> 对齐远端（空则略过、有则合并）-> 推送。
 * 不再用 rebase：无关历史会卡在 detached HEAD，合并冲突也会把工作区弄脏。
 */
export async function gitSync(root, options = {}) {
  const status = await gitStatus(root);
  if (!status.repo) throw new KbError('E_NO_GIT', '这个知识库还没有 git 仓库。');
  if (!status.remote) throw new KbError('E_NO_REMOTE', '还没有配置云端仓库地址。');
  const credential = options.credential ?? null;
  const commit = await commitAll(root, 'kb: sync').catch(() => ({ committed: false }));
  const align = await alignWithRemote(root, {
    remote: status.remote,
    credential,
    mergeUnrelated: options.mergeUnrelated === true,
  });
  if (!align.ok) return { ok: false, ...align, status: await gitStatus(root) };
  const push = await pushBranch(root, align.branch, { credential });
  if (push.code !== 0) {
    return { ok: false, stage: 'push', ...classifyGitError(push.stderr || push.stdout, push), status: await gitStatus(root) };
  }
  return {
    ok: true,
    committed: commit.committed,
    merged: align.merged,
    branch: align.branch,
    status: await gitStatus(root),
  };
}

/**
 * 给"已经建好、但当时没推上去"的库补一次首推/合并。
 * 创建时远端连不上、或用户在对话框里选了"先不连云端"，之后点「初始化云端」就走这里。
 */
export async function bootstrapRemote(idOrName, options = {}) {
  const entry = requireLibrary(idOrName);
  const status = await gitStatus(entry.root);
  if (!status.repo) throw new KbError('E_NO_GIT', '这个知识库还没有 git 仓库。');
  const remote = String(options.remote ?? status.remote ?? '').trim();
  if (!remote) throw new KbError('E_NO_REMOTE', '还没有配置云端仓库地址。');
  const parsed = parseRemote(remote);
  if (!parsed.ok) throw new KbError('E_REMOTE_INVALID', parsed.message, { remote });
  if (remote !== status.remote) {
    const current = await runGit(entry.root, ['remote', 'get-url', 'origin']);
    if (current.code !== 0 || !current.stdout.trim()) {
      const added = await runGit(entry.root, ['remote', 'add', 'origin', remote]);
      if (added.code !== 0) throw new KbError('E_GIT', `添加远端失败：${added.stderr.trim()}`);
    } else {
      await runGit(entry.root, ['remote', 'set-url', 'origin', remote]);
    }
  }
  await commitAll(entry.root, 'kb: local changes');
  const result = await bootstrapRemoteRef(entry.root, {
    remote,
    credential: options.credential ?? null,
    mergeUnrelated: options.mergeUnrelated === true,
  });
  return { ...result, remote: parsed, status: await gitStatus(entry.root) };
}

export async function gitManualCommit(root, message) {
  return commitAll(root, String(message || 'kb: manual commit'));
}

export function libraryStats(root) {
  let files = 0;
  let bytes = 0;
  const queue = [''];
  while (queue.length) {
    const rel = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(resolveInside(root, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const item of entries) {
      if (SKIP_NAMES.has(item.name) || item.name.startsWith('.')) continue;
      if (item.isDirectory()) {
        queue.push(path.posix.join(rel, item.name));
      } else {
        files += 1;
        try {
          bytes += fs.statSync(path.join(root, rel, item.name)).size;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return { files, bytes };
}

export { fsp };
