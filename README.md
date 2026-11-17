# dsh-knowledge

DeepSeek Harness（DSH）的知识库插件：用本地目录保存资料，用 Git 记录版本，在对话里通过 `@kb:` 引用、保存和读写。

## 功能

- **本地知识库**：每个库就是一个普通文件夹，自带 `inbox / notes / projects / assets / templates` 五个分区。
- **Git 版本管理**：建库时自动 `git init`，可配置远端仓库；插件内置提交 / 同步状态提示。
- **左栏知识库面板**：文件树、彩色类型图标、右键菜单（新建 / 上传 / 重命名 / 删除 / 复制引用）、Markdown 预览与编辑、全文搜索。
- **右侧栏浏览页**：右栏「开始」页提供「知识库」入口，可直接逐级浏览和预览文件。
- **`@kb:` 引用**：在输入框输入 `@kb:关键词`，跨所有库模糊匹配文件与目录，选中后插入 `@kb:<库名>/<路径>`。
- **对话保存**：助手回复下方「保存到知识库」，把回复正文加 front-matter 存进库，支持 30 秒撤销。
- **模型工具**：`kb_list` / `kb_read` / `kb_search` / `kb_write` / `kb_append` / `kb_create` / `kb_move` / `kb_delete` / `kb_find`。

## 安装

本插件以 DSH bundle 形式工作，在当前 profile 中安装：

```bash
dsh plugin install-bundle link:D:/path/to/dsh-knowledge
```

或在 profile 的 `package.json` 里加入：

```json
"@local/dsh-knowledge-base": "link:D:/path/to/dsh-knowledge"
```

## 目录结构

```
dsh-knowledge/
├── package.json        # bundle 声明（exports / dsh.bundle / dsh.client）
├── cordis.patch.yml    # Loader 插入行
├── index.js            # 宿主半：HTTP 路由、模型工具、提示词
├── lib/
│   ├── api.mjs         # HTTP 路由实现
│   ├── store.mjs       # 库注册表、文件读写、搜索、Git
│   └── git.mjs         # Git 命令封装
├── client.js           # 客户端半：面板、@kb 源、右栏页、保存动作
├── locale/             # zh / en 文案
└── icon.svg
```

## 数据位置

库注册表默认保存在：

```
<DSH_PROFILE_DIR|DSH_HOME|~/.dsh>/knowledge-base/libraries.json
```

删除文件会移到库内 `.kb/trash/<时间戳>/`，可从 Git 历史或回收目录恢复。

## License

MIT
