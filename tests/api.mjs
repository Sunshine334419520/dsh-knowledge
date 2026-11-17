/**
 * API 层集成测试：用假的 ctx + Request 直接打 dispatch，不启动宿主、不联网。
 * 运行：node tests/api.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-api-'));
process.env.DSH_PROFILE_DIR = path.join(BASE, 'profile');
fs.mkdirSync(process.env.DSH_PROFILE_DIR, { recursive: true });
process.env.GIT_CONFIG_GLOBAL = path.join(BASE, 'gitconfig');
fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
for (const key of ['DSH_KB_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) delete process.env[key];

const api = await import('../lib/api.mjs');
const store = await import('../lib/store.mjs');

function fakeCredentials() {
  const values = new Map();
  return {
    resolve(ref) {
      return values.has(ref) ? { value: values.get(ref), source: 'stored' } : undefined;
    },
    async set(ref, value) {
      if (!value) throw new Error('空值');
      values.set(ref, value);
    },
    async unset(ref) {
      values.delete(ref);
    },
  };
}

const credentials = fakeCredentials();
const ctx = {
  get(name) {
    if (name === 'credentials') return credentials;
    return undefined;
  },
};

function call(method, url, body) {
  const request = new Request(`http://localhost${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return api.handle(request, ctx).then(async (response) => ({
    status: response.status,
    payload: await response.json(),
  }));
}

function bare(dir, name = 'remote.git') {
  const remote = path.join(dir, name);
  execFileSync('git', ['init', '--bare', '--quiet', remote]);
  execFileSync('git', ['--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
  return remote;
}

let failures = 0;
let createdLib = null;
async function test(name, fn) {
  const dir = fs.mkdtempSync(path.join(BASE, 'case-'));
  try {
    await fn(dir);
    console.log(`✔ ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`✘ ${name}\n   ${error?.stack ?? error}`);
  }
}

await test('POST /api/kb/libraries：父目录 + 远端推导目录名，并首推', async (dir) => {
  const parent = path.join(dir, 'work');
  fs.mkdirSync(parent, { recursive: true });
  const remote = bare(dir);
  const { status, payload } = await call('POST', '/api/kb/libraries', {
    name: '工作笔记',
    parent,
    remote: `file://${remote}`,
  });
  assert.equal(status, 200, JSON.stringify(payload));
  assert.equal(payload.ok, true);
  assert.equal(payload.library.root, path.join(parent, 'remote'));
  assert.equal(payload.bootstrap.ok, true, JSON.stringify(payload.bootstrap));
  assert.equal(payload.seeded.length, 5);
  assert.equal(payload.library.git.needsPush, false);
  createdLib = payload.library;
  const { payload: git } = await call('GET', `/api/kb/git?lib=${encodeURIComponent(payload.library.id)}`);
  assert.equal(git.status.repo, true);
  assert.equal(git.status.remote, `file://${remote}`);
});

await test('GET /api/kb/credentials：未配置时回 ref 与提示', async () => {
  const { status, payload } = await call(
    'GET',
    `/api/kb/credentials?remote=${encodeURIComponent('https://github.com/acme/demo.git')}`,
  );
  assert.equal(status, 200, JSON.stringify(payload));
  assert.equal(payload.token.configured, false);
  assert.equal(payload.token.ref, 'DSH_KB_GITHUB_TOKEN');
  assert.equal(payload.token.writable, true);
  assert.match(payload.token.tokenUrl, /github\.com\/settings\/tokens/);
});

await test('POST /api/kb/credentials：令牌进凭据服务，GET 只回掩码', async () => {
  const remote = 'https://git.example.invalid/acme/demo.git';
  const saved = await call('POST', '/api/kb/credentials', {
    remote,
    token: 'ghp_FakeTestToken1234567890',
    force: true,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.payload));
  assert.equal(saved.payload.token.configured, true);
  assert.equal(saved.payload.token.source, 'credentials');
  const { payload } = await call('GET', `/api/kb/credentials?remote=${encodeURIComponent(remote)}`);
  assert.equal(payload.token.configured, true);
  assert.equal(payload.token.masked.startsWith('ghp_'), true);
  assert.equal(JSON.stringify(payload).includes('FakeTestToken'), false);
});

await test('POST /api/kb/credentials：形状不合法 → 400 E_TOKEN_SHAPE', async () => {
  const { status, payload } = await call('POST', '/api/kb/credentials', {
    remote: 'https://git.example.invalid/acme/demo.git',
    token: 'has space inside',
  });
  assert.equal(status, 400);
  assert.equal(payload.code, 'E_TOKEN_SHAPE');
});

await test('DELETE /api/kb/credentials：抹掉后回到未配置', async () => {
  const remote = 'https://git.example.invalid/acme/demo.git';
  const { status, payload } = await call('DELETE', '/api/kb/credentials', { remote });
  assert.equal(status, 200, JSON.stringify(payload));
  assert.equal(payload.token.configured, false);
});

await test('POST /api/kb/remote/test：file 远端能探测到非空', async (dir) => {
  const remote = bare(dir);
  const work = path.join(dir, 'seed');
  fs.mkdirSync(work);
  execFileSync('git', ['init', '--quiet', '-b', 'main', work]);
  fs.writeFileSync(path.join(work, 'README.md'), '# hi\n');
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@e.f', 'add', '-A'], { cwd: work });
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@e.f', 'commit', '-qm', 'seed'], { cwd: work });
  execFileSync('git', ['push', '--quiet', remote, 'main'], { cwd: work });
  const { status, payload } = await call('POST', '/api/kb/remote/test', { remote: `file://${remote}` });
  assert.equal(status, 200, JSON.stringify(payload));
  assert.equal(payload.probe.ok, true);
  assert.equal(payload.probe.empty, false);
  assert.equal(payload.probe.defaultBranch, 'main');
});

await test('POST /api/kb/libraries/bootstrap：已经推过的库再补推是幂等的', async () => {
  assert.ok(createdLib, '前面的建库用例没有成功');
  const { status, payload } = await call('POST', '/api/kb/libraries/bootstrap', { lib: createdLib.id });
  assert.equal(status, 200, JSON.stringify(payload));
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.equal(payload.status.repo, true);
});

await test('错误映射：未知路由 404 / 非法远端 400 / 非空目录 409', async (dir) => {
  const missing = await call('GET', '/api/kb/nope');
  assert.equal(missing.status, 404);
  assert.equal(missing.payload.code, 'E_ROUTE');

  const badRemote = await call('POST', '/api/kb/libraries', { name: 'x', parent: dir, remote: 'nonsense' });
  assert.equal(badRemote.status, 400);
  assert.equal(badRemote.payload.code, 'E_REMOTE_INVALID');

  const busy = path.join(dir, 'busy');
  fs.mkdirSync(busy);
  fs.writeFileSync(path.join(busy, 'notes.md'), '# 已有内容\n');
  const conflict = await call('POST', '/api/kb/libraries', {
    name: 'x',
    parent: dir,
    folder: 'busy',
    remote: '',
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.payload.code, 'E_DIR_NOT_EMPTY');
});

await test('GET /api/kb/tree：种子目录都带 .gitkeep', async () => {
  assert.ok(createdLib, '前面的建库用例没有成功');
  const { status, payload } = await call('GET', `/api/kb/tree?lib=${encodeURIComponent(createdLib.id)}&path=`);
  assert.equal(status, 200, JSON.stringify(payload));
  const dirs = payload.entries.filter((entry) => entry.type === 'dir').map((entry) => entry.name);
  for (const name of ['inbox', 'notes', 'projects', 'assets', 'templates']) {
    assert.equal(dirs.includes(name), true, `缺 ${name}`);
    // 文件树本身会跳过点文件，所以直接看磁盘
    assert.equal(fs.existsSync(path.join(createdLib.root, name, '.gitkeep')), true, `${name}/.gitkeep 不在`);
  }
});

console.log(failures ? `\n${failures} 个用例失败` : '\nAPI 全部通过');
process.exitCode = failures ? 1 : 0;
