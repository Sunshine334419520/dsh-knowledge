/**
 * 端到端测试：全部在临时目录 + 本地 bare 仓库里跑，不联网、不碰真实 profile。
 * 运行：node tests/run.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-'));
process.env.DSH_PROFILE_DIR = path.join(BASE, 'profile');
fs.mkdirSync(process.env.DSH_PROFILE_DIR, { recursive: true });
process.env.GIT_CONFIG_GLOBAL = path.join(BASE, 'gitconfig');
fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');

const store = await import('../lib/store.mjs');
const git = await import('../lib/git.mjs');
const paths = await import('../lib/paths.mjs');
const creds = await import('../lib/credentials.mjs');

const results = [];
async function test(name, fn) {
  const dir = fs.mkdtempSync(path.join(BASE, 'case-'));
  try {
    await fn(dir);
    results.push({ name, ok: true });
    console.log(`✔ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`✘ ${name}\n   ${error?.message ?? error}`);
  }
}

function gitCmd(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '' },
  });
}
function bare(dir, name = 'remote.git') {
  const remote = path.join(dir, name);
  execFileSync('git', ['init', '--bare', '--quiet', remote]);
  execFileSync('git', ['--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
  return remote;
}
function seedRepo(dir, files) {
  const repo = path.join(dir, 'seed');
  fs.mkdirSync(repo, { recursive: true });
  gitCmd(repo, 'init', '--quiet', '-b', 'main');
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  gitCmd(repo, 'add', '-A');
  gitCmd(repo, 'commit', '--quiet', '-m', 'seed');
  return repo;
}
async function pushSeed(repo, remote) {
  gitCmd(repo, 'remote', 'add', 'origin', remote);
  gitCmd(repo, 'push', '--quiet', '-u', 'origin', 'main');
}

/* ---------- 1. 地址解析 ---------- */
await test('parseRemote：各种地址形态', () => {
  const gh = paths.parseRemote('https://github.com/Sunshine334419520/personal-cloud-knownotes.git');
  assert.equal(gh.ok, true);
  assert.equal(gh.kind, 'https');
  assert.equal(gh.hostKey, 'github');
  assert.equal(gh.repoName, 'personal-cloud-knownotes');
  assert.equal(gh.ownerPath, 'Sunshine334419520/personal-cloud-knownotes');

  const ssh = paths.parseRemote('git@github.com:me/notes.git');
  assert.equal(ssh.kind, 'ssh');
  assert.equal(ssh.repoName, 'notes');

  const sshUrl = paths.parseRemote('ssh://git@gitlab.com/group/sub/proj.git');
  assert.equal(sshUrl.kind, 'ssh');
  assert.equal(sshUrl.hostKey, 'gitlab');
  assert.equal(sshUrl.repoName, 'proj');

  assert.equal(paths.parseRemote('/tmp/some/repo').kind, 'file');
  assert.equal(paths.parseRemote('~/kb/repo').kind, 'file');

  const bad = paths.parseRemote('nonsense');
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'E_REMOTE_INVALID');

  const incomplete = paths.parseRemote('https://github.com/me');
  assert.equal(incomplete.ok, false);
});

await test('resolveLibraryTarget：父目录 + 仓库名', () => {
  const target = paths.resolveLibraryTarget({
    parent: path.join(BASE, 'parent'),
    remote: 'https://github.com/me/My Notes.git',
  });
  assert.equal(target.ok, true);
  assert.equal(target.dir, 'My-Notes');
  assert.equal(target.root, path.join(BASE, 'parent', 'My-Notes'));
  const explicit = paths.resolveLibraryTarget({ parent: path.join(BASE, 'parent'), name: '../evil' });
  assert.equal(explicit.dir, 'evil');
  assert.equal(explicit.root, path.join(BASE, 'parent', 'evil'));
});

/* ---------- 2. 空远端 ---------- */
await test('空远端：建库 + 首推 main + 种子目录 + .gitignore', async (dir) => {
  const remote = bare(dir);
  const parent = path.join(dir, 'notes');
  const result = await store.createLibrary({
    name: '工作笔记',
    parent,
    remote,
  });
  const root = result.library.root;
  assert.equal(root, path.join(parent, 'remote'));
  assert.equal(result.cloned, false);
  assert.ok(fs.existsSync(path.join(root, '.kb', 'config.json')));
  for (const seed of store.SEED_DIRS) {
    assert.ok(fs.existsSync(path.join(root, seed, '.gitkeep')), `${seed}/.gitkeep 缺失`);
  }
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /^\.kb\/$/m);
  assert.doesNotMatch(ignore, /\.kb\/trash\//);
  assert.equal(result.bootstrap?.ok, true, JSON.stringify(result.bootstrap));

  const probe = await git.probeRemote(remote);
  assert.equal(probe.ok, true);
  assert.equal(probe.empty, false);
  assert.deepEqual(probe.branches, ['main']);
  assert.equal(probe.defaultBranch, 'main');

  const status = await store.gitStatus(root);
  assert.equal(status.repo, true);
  assert.equal(status.remote, remote);
  assert.equal(status.dirty, 0);
  assert.equal(status.git?.needsPush ?? false, false);
});

/* ---------- 3. 有内容的远端 ---------- */
await test('非空远端：clone 落地 + 补种子 + 提交 .gitignore', async (dir) => {
  const remote = bare(dir);
  const seed = seedRepo(dir, { 'README.md': '# 远端库\n', 'notes/a.md': 'hello\n' });
  await pushSeed(seed, remote);

  const parent = path.join(dir, 'cloned');
  const result = await store.createLibrary({ name: '远端库', parent, remote, folder: 'remote-kb' });
  const root = result.library.root;
  assert.equal(result.cloned, true);
  assert.equal(fs.readFileSync(path.join(root, 'notes', 'a.md'), 'utf8'), 'hello\n');
  assert.ok(fs.existsSync(path.join(root, 'inbox', '.gitkeep')));
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^\.kb\/$/m);
  assert.equal(result.bootstrap?.ok, true, JSON.stringify(result.bootstrap));
  const tracked = gitCmd(root, 'ls-files').split('\n');
  assert.ok(!tracked.some((line) => line.startsWith('.kb/')), '.kb 不该被跟踪');
  // 本地补的种子已经推上远端
  const remoteFiles = gitCmd(dir, '--git-dir', remote, 'ls-tree', '-r', '--name-only', 'main').split('\n');
  assert.ok(remoteFiles.includes('inbox/.gitkeep'));
  assert.ok(remoteFiles.includes('.gitignore'));
});

/* ---------- 4. 旧仓库把 .kb 提交过 ---------- */
await test('克隆旧仓库：把 .kb 从索引摘掉并保留本地文件', async (dir) => {
  const remote = bare(dir);
  const seed = seedRepo(dir, { 'README.md': '# old\n', '.kb/config.json': '{"id":"old"}\n' });
  await pushSeed(seed, remote);
  const result = await store.createLibrary({ name: '旧库', parent: path.join(dir, 'p'), remote });
  const root = result.library.root;
  assert.ok(fs.existsSync(path.join(root, '.kb', 'config.json')));
  assert.equal(gitCmd(root, 'ls-files', '.kb').trim(), '');
});

/* ---------- 5. C4：非空目录 ---------- */
await test('非空目录默认拒绝，显式 adopt 才接管且不塞种子', async (dir) => {
  const target = path.join(dir, 'busy');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'main.py'), 'print(1)\n');
  await assert.rejects(
    () => store.createLibrary({ name: 'busy', parent: dir, folder: 'busy' }),
    (error) => error.code === 'E_DIR_NOT_EMPTY',
  );
  const adopted = await store.createLibrary({ name: 'busy', parent: dir, folder: 'busy', adopt: true });
  assert.equal(adopted.adopted, true);
  assert.ok(fs.existsSync(path.join(dir, 'busy', 'main.py')));
  assert.ok(!fs.existsSync(path.join(dir, 'busy', 'inbox')), '不该往别人的目录里塞 inbox');
});

/* ---------- 6. 接管已有知识库目录 ---------- */
await test('已有 .kb 标记的目录：接管并补齐缺的种子', async (dir) => {
  const root = path.join(dir, 'old-kb');
  fs.mkdirSync(path.join(root, '.kb'), { recursive: true });
  fs.writeFileSync(path.join(root, '.kb', 'config.json'), '{"id":"kb-old","name":"旧库","remote":"","createdAt":"2026-01-01T00:00:00.000Z"}\n');
  fs.writeFileSync(path.join(root, 'README.md'), '# 旧库\n');
  fs.mkdirSync(path.join(root, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(root, 'notes', 'a.md'), 'x\n');
  const result = await store.createLibrary({ name: '旧库', parent: dir, folder: 'old-kb' });
  assert.equal(result.adopted, true);
  assert.ok(result.seeded.includes('inbox'));
  assert.ok(fs.existsSync(path.join(root, 'notes', 'a.md')));
});

/* ---------- 7. 分叉后同步 ---------- */
await test('远端有新提交：gitSync 合并后推送', async (dir) => {
  const remote = bare(dir);
  const created = await store.createLibrary({ name: 'sync', parent: path.join(dir, 'p'), remote, folder: 'sync' });
  const root = created.library.root;

  const sibling = path.join(dir, 'sibling');
  execFileSync('git', ['clone', '--quiet', remote, sibling], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  fs.writeFileSync(path.join(sibling, 'from-remote.md'), 'remote\n');
  gitCmd(sibling, 'add', '-A');
  gitCmd(sibling, 'commit', '--quiet', '-m', 'remote edit');
  gitCmd(sibling, 'push', '--quiet');

  fs.writeFileSync(path.join(root, 'local.md'), 'local\n');
  const sync = await store.gitSync(root);
  assert.equal(sync.ok, true, JSON.stringify(sync));
  assert.ok(fs.existsSync(path.join(root, 'from-remote.md')));
  const status = await store.gitStatus(root);
  assert.equal(status.dirty, 0);
});

/* ---------- 8. 冲突 ---------- */
await test('同一文件两边都改：同步失败但工作区干净', async (dir) => {
  const remote = bare(dir);
  const created = await store.createLibrary({ name: 'conflict', parent: path.join(dir, 'p'), remote, folder: 'conflict' });
  const root = created.library.root;
  fs.writeFileSync(path.join(root, 'README.md'), '# 本地版本\n');
  const committed = await git.commitAll(root, 'kb: local');
  assert.equal(committed.committed, true);

  const sibling = path.join(dir, 'sibling');
  execFileSync('git', ['clone', '--quiet', remote, sibling], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  fs.writeFileSync(path.join(sibling, 'README.md'), '# 远端版本\n');
  gitCmd(sibling, 'add', '-A');
  gitCmd(sibling, 'commit', '--quiet', '-m', 'remote edit');
  gitCmd(sibling, 'push', '--quiet');

  const sync = await store.gitSync(root);
  assert.equal(sync.ok, false);
  assert.equal(sync.code, 'E_CONFLICT');
  assert.equal(gitCmd(root, 'status', '--porcelain').trim(), '', '工作区应该干净');
  assert.ok(!fs.existsSync(path.join(root, '.git', 'MERGE_HEAD')));
  assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), '# 本地版本\n');
});

/* ---------- 9. 无关历史 ---------- */
await test('无关历史：默认拒绝，显式允许才合并', async (dir) => {
  const remote = bare(dir);
  const seed = seedRepo(dir, { 'theirs.md': 'theirs\n' });
  await pushSeed(seed, remote);

  const root = path.join(dir, 'mine');
  fs.mkdirSync(root, { recursive: true });
  gitCmd(root, 'init', '--quiet', '-b', 'main');
  fs.writeFileSync(path.join(root, 'mine.md'), 'mine\n');
  gitCmd(root, 'add', '-A');
  gitCmd(root, 'commit', '--quiet', '-m', 'mine');
  gitCmd(root, 'remote', 'add', 'origin', remote);

  const refused = await store.gitSync(root, { credential: null });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'E_REMOTE_DIVERGED');
  assert.equal(gitCmd(root, 'status', '--porcelain').trim(), '');

  const merged = await store.gitSync(root, { mergeUnrelated: true });
  assert.equal(merged.ok, true, JSON.stringify(merged));
  assert.ok(fs.existsSync(path.join(root, 'theirs.md')));
});

/* ---------- 10. 凭据与 askpass ---------- */
await test('gitEnv：有令牌才注入 askpass，且屏蔽系统 helper', () => {
  const withToken = git.gitEnv({ token: 'ghp_abcdefgh', username: 'me' });
  assert.match(withToken.GIT_ASKPASS, /askpass\.sh$/);
  assert.equal(withToken.GIT_ASKPASS_REQUIRE, 'force');
  assert.equal(withToken.DSH_KB_GIT_TOKEN, 'ghp_abcdefgh');
  assert.equal(withToken.GIT_CONFIG_KEY_0, 'credential.helper');
  assert.equal(withToken.GIT_CONFIG_VALUE_0, '');

  const without = git.gitEnv(null);
  assert.equal(without.GIT_ASKPASS, '');
  assert.equal(without.DSH_KB_GIT_TOKEN, undefined);
});

await test('askpass.sh：按参数返回用户名或令牌', () => {
  const env = { ...process.env, DSH_KB_GIT_USER: 'me', DSH_KB_GIT_TOKEN: 'tok123456' };
  const askpass = new URL('../lib/askpass.sh', import.meta.url).pathname;
  const user = execFileSync('/bin/sh', [askpass, "Username for 'https://github.com': "], { env, encoding: 'utf8' }).trim();
  const token = execFileSync('/bin/sh', [askpass, "Password for 'https://me@github.com': "], { env, encoding: 'utf8' }).trim();
  assert.equal(user, 'me');
  assert.equal(token, 'tok123456');
});

await test('凭据服务：存 / 读 / 抹掉', async () => {
  const saved = new Map();
  const ctx = {
    get: (name) =>
      name === 'credentials'
        ? {
            resolve: (ref) => (saved.has(ref) ? { value: saved.get(ref), source: 'file' } : undefined),
            describe: (ref) => ({ configured: saved.has(ref), source: 'file', writable: true }),
            set: (ref, value) => saved.set(ref, value),
            unset: (ref) => saved.delete(ref),
          }
        : undefined,
  };
  const before = await creds.describeToken(ctx, 'github');
  assert.equal(before.configured, false);
  const after = await creds.saveToken(ctx, 'github', 'ghp_0123456789abcdef');
  assert.equal(after.configured, true);
  assert.match(after.masked, /^ghp_/);
  assert.ok(!after.masked.includes('0123456789'));
  const resolved = await creds.resolveToken(ctx, 'github');
  assert.equal(resolved.source, 'credentials');
  await creds.clearToken(ctx, 'github');
  assert.equal((await creds.describeToken(ctx, 'github')).configured, false);
  await assert.rejects(() => creds.saveToken(ctx, 'github', 'bad token with space'), (error) => error.code === 'E_TOKEN_SHAPE');
  await assert.rejects(() => creds.saveToken({}, 'github', 'ghp_0123456789'), (error) => error.code === 'E_NO_CREDENTIALS');
});

await test('bootstrapRemote：给没推上去的库补首推', async (dir) => {
  const created = await store.createLibrary({ name: 'later', parent: path.join(dir, 'p'), folder: 'later' });
  const root = created.library.root;
  const remote = bare(dir);
  const result = await store.bootstrapRemote(created.library.id, { remote });
  assert.equal(result.ok, true, JSON.stringify(result));
  const probe = await git.probeRemote(remote);
  assert.equal(probe.empty, false);
  assert.equal((await store.gitStatus(root)).remote, remote);
});



/* ---------- 11. 远端连不上：库照样建，之后单独补推 ---------- */
await test('远端不可达：本地建库成功，bootstrap 给错误，之后可补推', async (dir) => {
  const deadRemote = 'https://127.0.0.1:1/me/notes.git';
  const created = await store.createLibrary({
    name: 'offline',
    parent: path.join(dir, 'p'),
    folder: 'offline',
    remote: deadRemote,
  });
  const root = created.library.root;
  assert.ok(fs.existsSync(root));
  assert.equal(created.bootstrap?.ok, false);
  assert.match(created.bootstrap?.code ?? '', /^E_/);
  const status = await store.gitStatus(root);
  assert.equal(status.remote, deadRemote);
  const view = () => store.listLibraries().find((row) => row.id === created.library.id);
  assert.equal(view().git.needsPush, true);

  const remote = bare(dir);
  const fixed = await store.bootstrapRemote(created.library.id, { remote });
  assert.equal(fixed.ok, true, JSON.stringify(fixed));
  assert.equal(view().git.needsPush, false);
});


/* ---------- 平台相关的 askpass ---------- */
await test('gitEnv：Windows 用 .bat 垫片并预置用户名', () => {
  const env = git.gitEnv({ token: 't0ken-123', username: 'me' }, 'win32');
  assert.equal(env.GIT_ASKPASS, git.ASKPASS_BAT);
  assert.ok(env.GIT_ASKPASS.endsWith('askpass.bat'));
  assert.equal(env.GIT_ASKPASS_REQUIRE, 'force');
  assert.equal(env.DSH_KB_GIT_USER, 'me');
  assert.equal(env.DSH_KB_GIT_TOKEN, 't0ken-123');
  assert.equal(env.GIT_CONFIG_COUNT, '2');
  assert.equal(env.GIT_CONFIG_KEY_0, 'credential.helper');
  assert.equal(env.GIT_CONFIG_VALUE_0, '');
  assert.equal(env.GIT_CONFIG_KEY_1, 'credential.username');
  assert.equal(env.GIT_CONFIG_VALUE_1, 'me');

  const plain = git.gitEnv({}, 'win32');
  assert.equal(plain.GIT_ASKPASS, '');
  assert.equal(plain.GIT_CONFIG_COUNT, undefined);
});

await test('gitEnv：macOS/Linux 用 .sh 垫片', () => {
  const env = git.gitEnv({ token: 't0ken-123' }, 'darwin');
  assert.equal(env.GIT_ASKPASS, git.ASKPASS_SH);
  assert.ok(env.GIT_ASKPASS.endsWith('askpass.sh'));
  assert.equal(env.GIT_CONFIG_VALUE_1, 'x-access-token');
});

await test('askpass.bat：CRLF + 纯 cmd 取值，不依赖 node', () => {
  const buf = fs.readFileSync(git.ASKPASS_BAT);
  const text = buf.toString('utf8');
  assert.match(text, /\r\n/);
  assert.ok(text.includes('findstr'));
  assert.ok(text.includes('%DSH_KB_GIT_TOKEN%') && text.includes('%DSH_KB_GIT_USER%'));
  assert.ok(!/node|\.mjs|%\*/.test(text), 'bat 里不该有 node 或额外参数');
});

/* ---------- 汇总 ---------- */
const failed = results.filter((row) => !row.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) {
  for (const row of failed) console.error(`\n[${row.name}]\n${row.error?.stack ?? row.error}`);
  process.exit(1);
}
console.log(`临时目录：${BASE}`);
