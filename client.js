// 知识库插件 · 客户端半（阅读端）
// 座位：main（keyed name=knowledge-base）、sidebar.panellist（order 41）、
// sidebar.right.pane.tab（key=dsh-knowledge-base.file）、@ 知识库引用源。
// 数据来自宿主 /api/kb/*（见 index.js 与 lib/api.mjs）。
window.__ModuleLoader__.load({
  id: '@local/dsh-knowledge-base',
  factory(require) {
    const React = require('react');
    const { useCallback, useEffect, useMemo, useRef, useState } = React;
    let ReactDOM = null;
    try {
      ReactDOM = require('react-dom');
    } catch {
      ReactDOM = null;
    }

    const PANEL_ID = 'knowledge-base';
    const KB_TAB_ID = 'dsh-knowledge-base.file';
    const KB_TAB_KIND = 'kb';
    const KB_PAGE_ID = 'dsh-knowledge-base.pane';
    const KB_PAGE_KIND = 'knowledge-base-pane';
    const STYLE_ATTR = 'data-plugin-css="knowledge-base"';

    // ---------------------------------------------------------------- DOM utils

    function h(sel, props, ...kids) {
      if (typeof sel === 'function' || typeof sel === 'symbol') return React.createElement(sel, props, ...kids);
      const parts = String(sel).split('.');
      const tag = parts.shift() || 'div';
      const className = parts.join(' ');
      const next = className ? { ...(props || {}), className: props?.className ? `${className} ${props.className}` : className } : props;
      return React.createElement(tag, next, ...kids);
    }

    function cx(...items) {
      return items.filter(Boolean).join(' ');
    }

    // ---------------------------------------------------------------- 图标

    const ICONS = {
      plus: ['M12 5v14', 'M5 12h14'],
      refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
      upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 20h16'],
      save: ['M5 3h11l3 3v15H5V3Z', 'M8 3v6h8V3', 'M8 13h8v8H8z'],
      edit: ['M4 20h4l10-10-4-4L4 16v4Z', 'M13 7l4 4'],
      eye: ['M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
      trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
      rename: ['M4 20h16', 'M6 16l9-9 3 3-9 9H6v-3Z'],
      close: ['M6 6l12 12', 'M18 6l-6 6-6 6'],
      right: ['M4 4h16v16H4z', 'M12 4v16', 'M16 10l3 3-3 3'],
      commit: ['M12 3v9', 'M8 8l4 4 4-4', 'M4 21h16'],
      sync: ['M4 12a8 8 0 0 1 13.7-5.6L20 8', 'M20 4v4h-4', 'M20 12a8 8 0 0 1-13.7 5.6L4 16', 'M4 20v-4h4'],
      search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'M20 20l-4-4'],
      folder: ['M3 6h6l2 2h10v10H3V6Z'],
      'folder-open': ['M3 7h6l2 2h10l-2 9H5L3 7Z', 'M3 7V5h6l2 2'],
      'folder-plus': ['M3 6h6l2 2h10v10H3V6Z', 'M12 12v4', 'M10 14h4'],
      'file-plus': ['M6 3h8l4 4v14H6V3Z', 'M14 3v4h4', 'M12 11v6', 'M9 14h6'],
      'file-text': ['M6 3h8l4 4v14H6V3Z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
      'file-code': ['M6 3h8l4 4v14H6V3Z', 'M14 3v4h4', 'M10 12l-2 2 2 2', 'M14 12l2 2-2 2'],
      'file-image': ['M6 3h8l4 4v14H6V3Z', 'M14 3v4h4', 'M9 17l3-4 2 3 2-2 2 3'],
      'file-pdf': ['M6 3h8l4 4v14H6V3Z', 'M14 3v4h4', 'M9 12h6', 'M9 16h4'],
      inbox: ['M3 13h5l2 3h4l2-3h5', 'M5 5h14l2 8v6H3v-6l2-8Z'],
      notes: ['M5 3h11l3 3v15H5V3Z', 'M8 8h7', 'M8 12h7', 'M8 16h4'],
      projects: ['M3 7h7l2 2h9v10H3V7Z', 'M8 4h8'],
      assets: ['M3 5h18v14H3V5Z', 'M3 15l5-5 4 4 3-3 6 6'],
      templates: ['M4 4h16v4H4z', 'M4 10h7v10H4z', 'M13 10h7v10h-7z'],
      library: ['M4 5h4v14H4V5Z', 'M9 5h4v14H9V5Z', 'M14 5h4l1 14h-4L14 5Z'],
      chevron: ['M9 6l6 6-6 6'],
      more: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
      up: ['M12 19V5', 'M5 12l7-7 7 7'],
    };

    function Icon({ name, size = 16, className }) {
      const paths = ICONS[name] || ICONS['file-text'];
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          className,
          'aria-hidden': 'true',
          focusable: 'false',
        },
        ...paths.map((d, index) => h('path', { key: index, d })),
      );
    }

    function IconButton({ icon, label, onClick, disabled, active, danger, size, tone }) {
      return h(
        'button',
        {
          type: 'button',
          className: cx('kb-iconbtn', active && 'on', danger && 'danger', tone && `tone-${tone}`),
          title: label,
          'aria-label': label,
          disabled,
          onClick,
        },
        h(Icon, { name: icon, size: size || 16 }),
      );
    }

    function ContextMenu({ menu, onClose }) {
      const ref = useRef(null);
      useEffect(() => {
        if (!menu) return undefined;
        const onDown = (event) => {
          if (ref.current && !ref.current.contains(event.target)) onClose();
        };
        const onKey = (event) => {
          if (event.key === 'Escape') onClose();
        };
        window.addEventListener('mousedown', onDown, true);
        window.addEventListener('keydown', onKey);
        return () => {
          window.removeEventListener('mousedown', onDown, true);
          window.removeEventListener('keydown', onKey);
        };
      }, [menu, onClose]);
      if (!menu) return null;
      return h(
        'div',
        {
          ref,
          className: 'kb-ctx',
          role: 'menu',
          style: { left: `${menu.x}px`, top: `${menu.y}px` },
        },
        ...menu.items.map((item, index) =>
          item === '-'
            ? h('div', { key: `sep-${index}`, className: 'kb-ctx-sep' })
            : h(
                'button',
                {
                  key: item.label,
                  type: 'button',
                  className: 'kb-ctx-item',
                  role: 'menuitem',
                  onClick: () => {
                    onClose();
                    item.onClick?.();
                  },
                },
                h('span', { className: 'kb-ctx-icon' }, h(Icon, { name: item.icon, size: 15 })),
                item.label,
              ),
        ),
      );
    }

    function fileIconName(name) {
      const leaf = String(name || '').toLowerCase();
      if (/\.(md|markdown|mdx)$/.test(leaf)) return 'file-text';
      if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(leaf)) return 'file-image';
      if (/\.pdf$/.test(leaf)) return 'file-pdf';
      if (/\.(js|mjs|cjs|ts|tsx|jsx|py|rs|go|java|c|h|cpp|sh|ps1|css|html|json|ya?ml|toml|sql)$/.test(leaf)) return 'file-code';
      return 'file-text';
    }

    function dirIconName(name) {
      const key = String(name || '').toLowerCase();
      if (key === 'inbox') return 'inbox';
      if (key === 'notes') return 'notes';
      if (key === 'projects') return 'projects';
      if (key === 'assets') return 'assets';
      if (key === 'templates') return 'templates';
      return 'folder';
    }


    // ---------------------------------------------------------------- transport

    async function request(path, init) {
      let response;
      try {
        response = await fetch(path, { credentials: 'same-origin', ...(init || {}) });
      } catch (error) {
        const wrapped = new Error(error?.message || '无法连接宿主进程。');
        wrapped.code = 'E_NETWORK';
        throw wrapped;
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || payload?.ok === false) {
        const error = new Error(payload?.error || `请求失败（HTTP ${response.status}）。`);
        error.code = payload?.code || `E_HTTP_${response.status}`;
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    const getJson = (path) => request(path);
    const postJson = (path, body) =>
      request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });

    function errorText(error) {
      if (!error) return '';
      const code = error.code ? `[${error.code}] ` : '';
      return `${code}${error.message || String(error)}`;
    }

    // 把客户端异常写回宿主日志，便于在没有 devtools 的情况下定位。
    function reportClientError(scope, error) {
      try {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : '';
        fetch('/api/kb/client-log', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scope, message, stack }),
        }).catch(() => {});
        console.error(`[knowledge-base] ${scope}`, error);
      } catch {
        /* 忽略 */
      }
    }

    // ---------------------------------------------------------------- formatting

    function formatBytes(size) {
      if (typeof size !== 'number' || !Number.isFinite(size)) return '';
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      return `${(size / 1024 / 1024).toFixed(1)} MB`;
    }

    function baseName(path) {
      const parts = String(path || '').split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    }

    function parentDir(path) {
      const parts = String(path || '').split('/').filter(Boolean);
      parts.pop();
      return parts.join('/');
    }

    function joinPath(...parts) {
      return parts
        .filter((part) => part !== undefined && part !== null && String(part) !== '')
        .map((part) => String(part).replace(/^\/+|\/+$/g, ''))
        .filter(Boolean)
        .join('/');
    }

    // ---------------------------------------------------------------- markdown

    const INLINE_RULES = [
      { pattern: /`([^`]+)`/g, render: (m) => h('code', { className: 'kb-md-code' }, m[1]) },
      { pattern: /\*\*([^*]+)\*\*/g, render: (m) => h('strong', null, m[1]) },
      { pattern: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, render: (m) => h('a', { href: m[2], target: '_blank', rel: 'noreferrer' }, m[1]) },
    ];

    function renderInline(text, keyPrefix) {
      let nodes = [text];
      let round = 0;
      for (const rule of INLINE_RULES) {
        const output = [];
        for (const node of nodes) {
          if (typeof node !== 'string') {
            output.push(node);
            continue;
          }
          let cursor = 0;
          let index = 0;
          let match;
          rule.pattern.lastIndex = 0;
          while ((match = rule.pattern.exec(node)) !== null) {
            if (match.index > cursor) output.push(node.slice(cursor, match.index));
            output.push(React.cloneElement(rule.render(match), { key: `${keyPrefix}-${round}-${index}` }));
            cursor = match.index + match[0].length;
            index += 1;
          }
          if (cursor < node.length) output.push(node.slice(cursor));
        }
        nodes = output;
        round += 1;
      }
      return nodes;
    }

    function Skeleton({ lines = 4 }) {
      return h(
        'div',
        { className: 'kb-skeleton' },
        Array.from({ length: lines }, (_, index) => h('span', { key: index, style: { width: `${92 - index * 9}%` } })),
      );
    }

    function Markdown({ text }) {
      const blocks = useMemo(() => parseMarkdown(text), [text]);
      return h(
        'div',
        { className: 'kb-md' },
        blocks.map((block, index) => {
          if (block.type === 'code') {
            return h(
              'pre',
              { key: index, className: 'kb-md-pre' },
              h('code', null, block.text),
            );
          }
          if (block.type === 'heading') {
            return h(`h${block.level}`, { key: index, className: `kb-md-h${block.level}` }, ...renderInline(block.text, `h${index}`));
          }
          if (block.type === 'hr') return h('hr', { key: index, className: 'kb-md-hr' });
          if (block.type === 'list') {
            return h(
              block.ordered ? 'ol' : 'ul',
              { key: index, className: 'kb-md-list' },
              block.items.map((item, itemIndex) => h('li', { key: itemIndex }, ...renderInline(item, `l${index}-${itemIndex}`))),
            );
          }
          if (block.type === 'quote') {
            return h('blockquote', { key: index, className: 'kb-md-quote' }, ...renderInline(block.text, `q${index}`));
          }
          return h('p', { key: index, className: 'kb-md-p' }, ...renderInline(block.text, `p${index}`));
        }),
      );
    }

    function parseMarkdown(source) {
      const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
      const blocks = [];
      let paragraph = [];
      let list = null;
      let fence = null;

      const flushParagraph = () => {
        if (paragraph.length) {
          blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
          paragraph = [];
        }
      };
      const flushList = () => {
        if (list) {
          blocks.push(list);
          list = null;
        }
      };

      for (const line of lines) {
        if (fence) {
          if (/^```/.test(line.trim())) {
            blocks.push({ type: 'code', text: fence.lines.join('\n') });
            fence = null;
          } else {
            fence.lines.push(line);
          }
          continue;
        }
        const fenceStart = /^```(\w*)/.exec(line.trim());
        if (fenceStart) {
          flushParagraph();
          flushList();
          fence = { lines: [] };
          continue;
        }
        if (!line.trim()) {
          flushParagraph();
          flushList();
          continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
          flushParagraph();
          flushList();
          blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
          continue;
        }
        if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
          flushParagraph();
          flushList();
          blocks.push({ type: 'hr' });
          continue;
        }
        const quote = /^>\s?(.*)$/.exec(line);
        if (quote) {
          flushParagraph();
          flushList();
          blocks.push({ type: 'quote', text: quote[1] });
          continue;
        }
        const bullet = /^\s*([-*+])\s+(.*)$/.exec(line);
        const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
        if (bullet || ordered) {
          flushParagraph();
          const isOrdered = Boolean(ordered);
          if (!list || list.ordered !== isOrdered) {
            flushList();
            list = { type: 'list', ordered: isOrdered, items: [] };
          }
          list.items.push((bullet || ordered)[2]);
          continue;
        }
        flushList();
        paragraph.push(line.trim());
      }
      if (fence) blocks.push({ type: 'code', text: fence.lines.join('\n') });
      flushParagraph();
      flushList();
      return blocks.length ? blocks : [{ type: 'paragraph', text: '' }];
    }

    // ---------------------------------------------------------------- styles

    const STYLES = `
.kb-app{display:flex;flex-direction:column;height:100%;width:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1,#fff)}
.kb-head{display:flex;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.kb-title{font-size:15px;font-weight:650;margin-right:2px}
.kb-sub{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px}
.kb-spacer{flex:1}
.kb-btn{box-sizing:border-box;appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap;transition:background-color .12s,border-color .12s}
.kb-btn:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.kb-btn:disabled{opacity:.45;cursor:default}
.kb-btn.primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
.kb-btn.primary:hover{background:var(--dsw-alias-brand-primary);filter:brightness(1.05)}
.kb-btn.ghost{background:transparent;border-color:transparent}
.kb-btn.ghost:hover{background:var(--dsw-alias-bg-layer-2);border-color:transparent}
.kb-btn.danger:hover{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.kb-iconbtn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s,color .12s}
.kb-iconbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.kb-iconbtn.on{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
.kb-iconbtn:disabled{opacity:.4;cursor:default}
.kb-iconbtn.danger:hover{color:var(--dsw-alias-state-error-primary)}
.kb-iconbtn.tone-green{color:#2ea043}
.kb-iconbtn.tone-blue{color:#2f81f7}
.kb-iconbtn.tone-purple{color:#8957e5}
.kb-iconbtn.tone-teal{color:#1a9e8f}
.kb-iconbtn.tone-amber{color:#d29922}
.kb-iconbtn.tone-red{color:#e5534b}
.kb-iconbtn.tone-indigo{color:#5b6ee8}
.kb-iconbtn.tone-green:hover,.kb-iconbtn.tone-blue:hover,.kb-iconbtn.tone-purple:hover,.kb-iconbtn.tone-teal:hover,.kb-iconbtn.tone-amber:hover,.kb-iconbtn.tone-indigo:hover{background:var(--dsw-alias-bg-layer-2);filter:brightness(1.08)}
.kb-actions{display:flex;align-items:center;gap:2px;padding:2px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}
.kb-actions .kb-divider{margin:0 3px}
.kb-more{position:relative}
.kb-toolbar{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
.kb-toolbar .kb-divider{width:1px;height:16px;background:var(--dsw-alias-border-l1);margin:0 4px}
.kb-select{box-sizing:border-box;appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 26px 0 9px;height:28px;font-size:12px;cursor:pointer;max-width:220px}
.kb-select:hover{border-color:var(--dsw-alias-border-l2)}
.kb-input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 9px;font-size:12px;min-width:0;outline:none}
.kb-input:focus{border-color:var(--dsw-alias-brand-primary)}
.kb-chip{font-size:11px;padding:1px 7px;border-radius:99px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.kb-chip.ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.kb-chip.warn{color:var(--dsw-alias-state-warning-primary);border-color:var(--dsw-alias-state-warning-primary)}
.kb-chip.err{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.kb-body{display:flex;flex:1;min-height:0}
.kb-side{width:320px;min-width:240px;max-width:420px;display:flex;flex-direction:column;border-right:1px solid var(--dsw-alias-border-l1);min-height:0}
.kb-side-tools{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.kb-tree{flex:1;overflow:auto;padding:6px 8px 16px}
.kb-row{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:7px;cursor:pointer;font-size:12.5px;line-height:18px;user-select:none;color:var(--dsw-alias-label-primary)}
.kb-row:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-row.active{background:var(--dsw-alias-bg-layer-2);outline:1px solid var(--dsw-alias-border-l1)}
.kb-row .kb-caret{width:14px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:10px;flex:none}
.kb-chev{transform:rotate(90deg);transition:transform .12s ease}
.kb-chev-closed{transform:rotate(0deg);transition:transform .12s ease}
.kb-row .kb-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-row .kb-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none}
.kb-row.dir .kb-name{font-weight:550}
.kb-main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.kb-file-head{display:flex;flex-direction:column;gap:8px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-file-top{display:flex;align-items:center;gap:8px;min-width:0}
.kb-file-path{font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-file-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.kb-content{flex:1;overflow:auto;padding:18px 22px 60px}
.kb-editor{width:100%;height:100%;min-height:320px;resize:none;border:0;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:0}
.kb-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:12.5px;padding:40px}
.kb-empty b{color:var(--dsw-alias-label-primary);font-size:14px}
.kb-md{font-size:13.5px;line-height:1.75;max-width:860px}
.kb-md-p{margin:0 0 10px}
.kb-md-h1{font-size:20px;margin:18px 0 10px}
.kb-md-h2{font-size:17px;margin:16px 0 8px}
.kb-md-h3{font-size:15px;margin:14px 0 6px}
.kb-md-h4,.kb-md-h5,.kb-md-h6{font-size:13.5px;margin:12px 0 6px;color:var(--dsw-alias-label-secondary)}
.kb-md-code{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:0 4px;font-size:12px}
.kb-md-pre{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;overflow:auto;font-size:12px;line-height:1.6;margin:0 0 12px}
.kb-md-list{margin:0 0 10px;padding-left:20px}
.kb-md-quote{margin:0 0 10px;padding:2px 12px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.kb-md-hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:14px 0}
.kb-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:7px 12px;font-size:12px;box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:70%;z-index:30}
.kb-toast.err{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.kb-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:120}
.kb-dialog{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:18px;width:520px;max-width:calc(100vw - 60px);box-shadow:0 18px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:10px}
.kb-dialog h3{margin:0 0 4px;font-size:15px}
.kb-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.kb-field .kb-input{width:100%}
.kb-hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.kb-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
.kb-dialog-error{font-size:12px;color:var(--dsw-alias-state-error-primary)}
.kb-search{position:relative;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-search .kb-input{width:100%}
.kb-hits{max-height:260px;overflow:auto;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-hit{padding:7px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-hit:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-hit .kb-hit-name{color:var(--dsw-alias-label-primary)}
.kb-hit .kb-hit-snippet{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-skeleton{display:flex;flex-direction:column;gap:8px;padding:18px}
.kb-skeleton span{height:11px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);display:block}
.kb-spinner{width:22px;height:22px;border-radius:50%;border:2px solid var(--dsw-alias-border-l1);border-top-color:var(--dsw-alias-brand-primary);animation:kb-spin .8s linear infinite}
@keyframes kb-spin{to{transform:rotate(360deg)}}
.kb-tree-skeleton{display:flex;flex-direction:column;gap:6px;padding:8px 6px}
.kb-tree-skeleton i{display:block;height:22px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);opacity:.7;animation:kb-pulse 1.4s ease-in-out infinite}
@keyframes kb-pulse{0%,100%{opacity:.45}50%{opacity:.8}}
.kb-msg-save{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:6px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11.5px;cursor:pointer;white-space:nowrap}
.kb-msg-save:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.kb-msg-save:disabled{opacity:.45;cursor:default}
.kb-receipt{position:fixed;right:22px;bottom:22px;z-index:200;display:flex;align-items:center;gap:10px;max-width:420px;padding:9px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);box-shadow:0 10px 30px rgba(0,0,0,.28);font-size:12px;color:var(--dsw-alias-label-primary)}
.kb-receipt .kb-receipt-path{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:230px}
.kb-receipt .kb-btn{padding:0 8px;height:24px;font-size:11.5px}
.kb-dialog .kb-select{width:100%}
.kb-row{position:relative}
.kb-row-icon{display:inline-flex;flex:none;width:16px;height:16px;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}
.kb-row-icon.inbox{color:#2f7cf6}
.kb-row-icon.notes{color:#22a06b}
.kb-row-icon.projects{color:#e8833a}
.kb-row-icon.assets{color:#9a6cf0}
.kb-row-icon.templates{color:#c2a15a}
.kb-row-icon.file-text{color:#2f81f7}
.kb-row-icon.file-image{color:#2ea043}
.kb-row-icon.file-pdf{color:#e5534b}
.kb-row-icon.file-code{color:#8957e5}
.kb-row.dir>.kb-row-icon{color:var(--dsw-alias-label-secondary)}
.kb-row.dir>.kb-row-icon.inbox,.kb-row.dir>.kb-row-icon.notes,.kb-row.dir>.kb-row-icon.projects,.kb-row.dir>.kb-row-icon.assets,.kb-row.dir>.kb-row-icon.templates{color:inherit}
.kb-row.dir>.kb-row-icon.inbox{color:#2f7cf6}
.kb-row.dir>.kb-row-icon.notes{color:#22a06b}
.kb-row.dir>.kb-row-icon.projects{color:#e8833a}
.kb-row.dir>.kb-row-icon.assets{color:#9a6cf0}
.kb-row.dir>.kb-row-icon.templates{color:#c2a15a}
.kb-ctx{position:fixed;z-index:1500;min-width:190px;padding:5px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);box-shadow:0 14px 40px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:1px}
.kb-ctx-item{display:flex;align-items:center;gap:9px;height:30px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font-size:12.5px;cursor:pointer;text-align:left;white-space:nowrap}
.kb-ctx-item:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-ctx-item .kb-ctx-icon{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.kb-ctx-sep{height:1px;background:var(--dsw-alias-border-l1);margin:4px 6px}
.kb-crumbs{display:flex;align-items:center;gap:2px;font-size:12px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap;min-width:0}
.kb-crumb{border:0;background:transparent;color:inherit;font:inherit;font-size:12px;padding:2px 5px;border-radius:5px;cursor:pointer;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-crumb:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.kb-crumb:last-child{color:var(--dsw-alias-label-primary);font-weight:550}
.kb-pane{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.kb-pane-head{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap}
.kb-pane-body{flex:1;overflow:auto;min-height:0;padding:6px 8px 20px}
.kb-pane-doc{padding:14px 16px 40px;overflow:auto;flex:1;min-height:0}
.kb-pane-doc .kb-md{font-size:12.5px;max-width:none}
.kb-file-item{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;font-size:12.5px;cursor:pointer;color:var(--dsw-alias-label-primary)}
.kb-file-item:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-file-item .kb-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-file-item .kb-meta{font-size:10.5px;color:var(--dsw-alias-label-tertiary);flex:none}
@media (max-width: 860px){.kb-side{width:240px;min-width:200px}}
`;

    function injectStyles() {
      if (typeof document === 'undefined') return;
      if (document.querySelector(`style[${STYLE_ATTR}]`)) return;
      const style = document.createElement('style');
      style.setAttribute('data-plugin-css', 'knowledge-base');
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    // ---------------------------------------------------------------- UI atoms

    function Toast({ notice }) {
      if (!notice) return null;
      return h('div', { className: cx('kb-toast', notice.kind === 'error' && 'err') }, notice.text);
    }

    function Modal({ title, children, onClose }) {
      const kids = Array.isArray(children) ? children : children === undefined || children === null ? [] : [children];
      const mask = h(
        'div',
        {
          className: 'kb-mask',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose?.();
          },
        },
        h(
          'div',
          { className: 'kb-dialog', role: 'dialog', 'aria-modal': 'true' },
          h('h3', null, title),
          ...kids,
        ),
      );
      // 消息操作区里可能有 transform / overflow，fixed 遮罩会被裁剪；统一挂到 body。
      try {
        if (ReactDOM?.createPortal && typeof document !== 'undefined') {
          return ReactDOM.createPortal(mask, document.body);
        }
      } catch {
        /* 回退到原地渲染 */
      }
      return mask;
    }

    function CreateLibraryDialog({ onClose, onCreated }) {
      const uiWorkspace = useMemo(() => safeGet('uiWorkspace'), []);
      const [name, setName] = useState('');
      const [root, setRoot] = useState('');
      const [remote, setRemote] = useState('');
      const [git, setGit] = useState(true);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');

      const pick = async () => {
        if (!uiWorkspace?.pickDirectory) {
          setError('当前环境没有目录选择器，请手填本地目录。');
          return;
        }
        try {
          const picked = await uiWorkspace.pickDirectory();
          if (picked) {
            setRoot(picked);
            if (!name) setName(baseName(picked) || '知识库');
          }
        } catch (cause) {
          setError(errorText(cause));
        }
      };

      const submit = async () => {
        if (!name.trim()) {
          setError('给知识库起个名字。');
          return;
        }
        if (!root.trim()) {
          setError('本地目录不能为空。');
          return;
        }
        setBusy(true);
        setError('');
        try {
          const result = await postJson('/api/kb/libraries', {
            name: name.trim(),
            root: root.trim(),
            remote: remote.trim(),
            git,
          });
          onCreated?.(result);
        } catch (cause) {
          setError(errorText(cause));
        } finally {
          setBusy(false);
        }
      };

      return h(
        Modal,
        { title: '新建知识库', onClose: busy ? undefined : onClose },
        h(
          'label',
          { className: 'kb-field' },
          '名称',
          h('input', {
            className: 'kb-input',
            value: name,
            placeholder: '例如：工作笔记',
            onChange: (event) => setName(event.target.value),
            autoFocus: true,
          }),
        ),
        h(
          'label',
          { className: 'kb-field' },
          '本地目录',
          h(
            'div',
            { style: { display: 'flex', gap: '6px' } },
            h('input', {
              className: 'kb-input',
              value: root,
              placeholder: 'D:\\notes\\work',
              onChange: (event) => setRoot(event.target.value),
            }),
            h('button', { className: 'kb-btn', onClick: pick, type: 'button' }, '选择…'),
          ),
          h('span', { className: 'kb-hint' }, '目录可以已存在（会接管并初始化 .kb/），不存在会创建。'),
        ),
        h(
          'label',
          { className: 'kb-field' },
          '云端 Git 仓库（可选）',
          h('input', {
            className: 'kb-input',
            value: remote,
            placeholder: 'git@github.com:me/notes.git',
            onChange: (event) => setRemote(event.target.value),
          }),
          h('span', { className: 'kb-hint' }, '留空则只用本地 Git 管理，不联网。'),
        ),
        h(
          'label',
          { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' } },
          h('input', { type: 'checkbox', checked: git, onChange: (event) => setGit(event.target.checked) }),
          '用 Git 管理版本（推荐）',
        ),
        error ? h('div', { className: 'kb-dialog-error' }, error) : null,
        h(
          'div',
          { className: 'kb-dialog-actions' },
          h('button', { className: 'kb-btn ghost', onClick: onClose, disabled: busy, type: 'button' }, '取消'),
          h('button', { className: 'kb-btn primary', onClick: submit, disabled: busy, type: 'button' }, busy ? '创建中…' : '创建'),
        ),
      );
    }

    function PromptDialog({ title, label, initial, confirmText, onClose, onSubmit }) {
      const [value, setValue] = useState(initial ?? '');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const submit = async () => {
        if (!value.trim()) {
          setError('不能为空。');
          return;
        }
        setBusy(true);
        setError('');
        try {
          await onSubmit(value.trim());
        } catch (cause) {
          setError(errorText(cause));
          setBusy(false);
        }
      };
      return h(
        Modal,
        { title, onClose: busy ? undefined : onClose },
        h(
          'label',
          { className: 'kb-field' },
          label,
          h('input', {
            className: 'kb-input',
            value,
            onChange: (event) => setValue(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') submit();
            },
            autoFocus: true,
          }),
        ),
        error ? h('div', { className: 'kb-dialog-error' }, error) : null,
        h(
          'div',
          { className: 'kb-dialog-actions' },
          h('button', { className: 'kb-btn ghost', onClick: onClose, disabled: busy, type: 'button' }, '取消'),
          h('button', { className: 'kb-btn primary', onClick: submit, disabled: busy, type: 'button' }, busy ? '处理中…' : confirmText || '确定'),
        ),
      );
    }

    // ---------------------------------------------------------- 保存助手回复到知识库

    function textOfBlocks(blocks) {
      if (typeof blocks === 'string') return blocks.trim();
      if (!Array.isArray(blocks)) return '';
      return blocks
        .filter((block) => block && block.kind === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n\n')
        .trim();
    }

    function textOfContent(content) {
      if (typeof content === 'string') return content.trim();
      if (Array.isArray(content)) return textOfBlocks(content);
      return '';
    }

    // 从 chat 快照里取这条回复的正文：节点形状随版本略有差异，这里几种都兼容。
    function collectAssistantTexts(snapshot) {
      const nodes = snapshot?.nodes;
      if (!nodes) return [];
      const list =
        typeof nodes.values === 'function' ? [...nodes.values()] : Array.isArray(nodes) ? nodes : [...nodes];
      const out = [];
      for (const node of list) {
        if (!node || typeof node !== 'object') continue;
        const data = node.data && typeof node.data === 'object' ? node.data : node;
        const closing = data.finalNode ?? node.finalNode;
        const id = data.messageId ?? node.messageId ?? closing?.messageId;
        const text =
          textOfBlocks(closing?.blocks) ||
          textOfContent(closing?.content) ||
          textOfBlocks(data.blocks) ||
          textOfContent(data.content) ||
          textOfBlocks(node.blocks) ||
          textOfContent(node.content);
        if (text) out.push({ id, text });
      }
      return out;
    }

    function extractMessageText(snapshot, messageId) {
      const entries = collectAssistantTexts(snapshot);
      if (!entries.length) return '';
      const exact = entries.find((entry) => entry.id === messageId);
      if (exact) return exact.text;
      // 有些版本不给 messageId：此时退化为“最后一条有正文的回复”。
      if (entries.every((entry) => entry.id === undefined)) return entries[entries.length - 1].text;
      return '';
    }

    function stampNow() {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        clock: `${pad(d.getHours())}${pad(d.getMinutes())}`,
        iso: d.toISOString(),
      };
    }

    function SaveMessageDialog({ messageId, sessionId, text, onClose, onSaved }) {
      const [libraries, setLibraries] = useState(null);
      const [libId, setLibId] = useState('');
      const [relPath, setRelPath] = useState('');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const stamp = useMemo(() => stampNow(), []);

      useEffect(() => {
        let alive = true;
        getJson('/api/kb/libraries')
          .then((payload) => {
            if (!alive) return;
            const rows = Array.isArray(payload.libraries) ? payload.libraries : [];
            setLibraries(rows);
            const preferred = rows.find((row) => row.id === payload.activeId) || rows[0];
            if (preferred) {
              setLibId(preferred.id);
              setRelPath(`inbox/${stamp.date}-${stamp.clock}-对话摘录.md`);
            }
          })
          .catch((cause) => {
            if (!alive) return;
            setLibraries([]);
            setError(errorText(cause));
          });
        return () => {
          alive = false;
        };
      }, []);

      const submit = async () => {
        if (!libId) {
          setError('先选一个知识库。');
          return;
        }
        const requested = relPath.trim().replace(/^\/+/, '');
        if (!requested) {
          setError('填写保存路径。');
          return;
        }
        const target = requested.endsWith('.md') ? requested : `${requested}.md`;
        setBusy(true);
        setError('');
        try {
          let ticket = '';
          for (let index = 0; index < 10 && !ticket; index += 1) {
            const candidate = index === 0 ? target : target.replace(/(\.[^./]+)$/, `-${index + 1}$1`);
            try {
              await getJson(`/api/kb/file?lib=${encodeURIComponent(libId)}&path=${encodeURIComponent(candidate)}`);
            } catch (cause) {
              if (cause?.status === 404) ticket = candidate;
              else throw cause;
            }
          }
          if (!ticket) {
            setError('同名文件太多了，换个名字。');
            return;
          }
          const front = [
            '---',
            `title: 对话摘录 ${stamp.date} ${stamp.clock}`,
            `created: ${stamp.iso}`,
            `updated: ${stamp.iso}`,
            'source: dsh-conversation',
            sessionId ? `session: ${sessionId}` : '',
            messageId ? `message: ${messageId}` : '',
            'tags: []',
            '---',
            '',
            text,
            '',
          ].filter((line) => line !== '');
          await postJson('/api/kb/file', { lib: libId, path: ticket, content: front.join('\n') });
          onSaved?.({ libId, path: ticket });
        } catch (cause) {
          setError(errorText(cause));
        } finally {
          setBusy(false);
        }
      };

      if (libraries === null) {
        return h(Modal, { title: '保存到知识库', onClose }, h('div', { className: 'kb-hint' }, '读取知识库列表…'));
      }
      if (!libraries.length) {
        return h(
          Modal,
          { title: '保存到知识库', onClose },
          h('div', { className: 'kb-hint' }, '还没有知识库。先在左栏「知识库」里新建一个，再回来保存。'),
          h(
            'div',
            { className: 'kb-dialog-actions' },
            h('button', { className: 'kb-btn ghost', onClick: onClose, type: 'button' }, '关闭'),
          ),
        );
      }
      return h(
        Modal,
        { title: '保存到知识库', onClose: busy ? undefined : onClose },
        h(
          'label',
          { className: 'kb-field' },
          '知识库',
          h(
            'select',
            { className: 'kb-select', value: libId, onChange: (event) => setLibId(event.target.value) },
            ...libraries.map((row) => h('option', { key: row.id, value: row.id }, `${row.name} — ${row.root}`)),
          ),
        ),
        h(
          'label',
          { className: 'kb-field' },
          '保存路径',
          h('input', {
            className: 'kb-input',
            value: relPath,
            onChange: (event) => setRelPath(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') submit();
            },
            autoFocus: true,
          }),
          h('span', { className: 'kb-hint' }, '默认放进 inbox/，之后可以整理到 notes/ 或 projects/。'),
        ),
        h('div', { className: 'kb-hint' }, `将写入 ${text.length} 个字符，并自动提交一次 Git。`),
        error ? h('div', { className: 'kb-dialog-error' }, error) : null,
        h(
          'div',
          { className: 'kb-dialog-actions' },
          h('button', { className: 'kb-btn ghost', onClick: onClose, disabled: busy, type: 'button' }, '取消'),
          h('button', { className: 'kb-btn primary', onClick: submit, disabled: busy || !text, type: 'button' }, busy ? '保存中…' : '保存'),
        ),
      );
    }

    // 消息操作区在消息行内部，弹窗放在那里容易被裁切/压住；统一用一个根级 overlay 承载。
    const saveOverlay = {
      state: null,
      listeners: new Set(),
      set(next) {
        saveOverlay.state = next;
        for (const listener of [...saveOverlay.listeners]) listener(next);
      },
      subscribe(listener) {
        saveOverlay.listeners.add(listener);
        return () => saveOverlay.listeners.delete(listener);
      },
    };

    // 渲染错误兜底：把真正的异常写给宿主日志，同时避免整个 slot 条目被废弃。
    class KbBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error };
      }

      componentDidCatch(error) {
        reportClientError(this.props?.scope || 'render:boundary', error);
      }

      render() {
        if (this.state.error) {
          return h(
            'div',
            { className: 'kb-dialog-error', style: { padding: '12px' } },
            `渲染失败：${errorText(this.state.error)}`,
          );
        }
        return this.props?.children ?? null;
      }
    }

    function KbSaveOverlay() {
      const [state, setState] = useState(saveOverlay.state);
      const [receipt, setReceipt] = useState(null);
      useEffect(() => saveOverlay.subscribe(setState), []);
      useEffect(() => {
        if (!receipt) return undefined;
        const timer = setTimeout(() => setReceipt(null), 30000);
        return () => clearTimeout(timer);
      }, [receipt]);

      const undo = async () => {
        const current = receipt;
        setReceipt(null);
        try {
          await postJson('/api/kb/delete', { lib: current.libId, path: current.path });
        } catch (cause) {
          console.error('[knowledge-base] undo capture failed', cause);
        }
      };

      return h(
        React.Fragment,
        null,
        state
          ? h(
              KbBoundary,
              { scope: 'overlay:dialog' },
              h(SaveMessageDialog, {
                messageId: state.messageId,
                sessionId: state.sessionId,
                text: state.text,
                onClose: () => saveOverlay.set(null),
                onSaved: (result) => {
                  saveOverlay.set(null);
                  setReceipt(result);
                },
              }),
            )
          : null,
        receipt
          ? h(
              'div',
              { className: 'kb-receipt', role: 'status' },
              h('span', null, '已保存'),
              h('span', { className: 'kb-receipt-path' }, receipt.path),
              h('button', { className: 'kb-btn ghost', type: 'button', onClick: undo }, '撤销'),
            )
          : null,
      );
    }

    function SaveToKbAction(props) {
      const messageId = props?.messageId;
      const sessionId = props?.sessionId;
      const [loadingText, setLoadingText] = useState(false);

      const start = async () => {
        if (!messageId || !sessionId) {
          window.alert('这条消息缺少 messageId / sessionId，无法保存。');
          return;
        }
        setLoadingText(true);
        try {
          const payload = await getJson(
            `/api/kb/message?sessionId=${encodeURIComponent(sessionId)}&messageId=${encodeURIComponent(messageId)}`,
          );
          const text = String(payload?.text ?? '').trim();
          if (!text) throw new Error('这条回复没有可保存的正文。');
          saveOverlay.set({ messageId, sessionId, text });
        } catch (cause) {
          reportClientError('capture:resolve', cause);
          window.alert(`没能读取这条回复的正文：${errorText(cause)}`);
        } finally {
          setLoadingText(false);
        }
      };

      return h(
        'span',
        { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
        h(
          'button',
          {
            type: 'button',
            className: 'kb-msg-save',
            title: '把这条回复存进知识库',
            disabled: loadingText,
            onClick: start,
          },
          h(Icon, { name: 'library', size: 13 }),
          loadingText ? '读取中…' : '保存到知识库',
        ),
      );
    }

    function safeGet(name) {
      try {
        return ctxRef.current?.get?.(name) ?? null;
      } catch {
        return null;
      }
    }

    // 供组件之外读取 client 服务；apply 时赋值。
    const ctxRef = { current: null };

    // ---------------------------------------------------------------- 主面板

    function KbApp() {
      const [libraries, setLibraries] = useState([]);
      const [activeId, setActiveId] = useState(null);
      const [gitInfo, setGitInfo] = useState({ available: false, version: null });
      const [tree, setTree] = useState({});
      const [expanded, setExpanded] = useState(() => new Set());
      const [opened, setOpened] = useState(null);
      const [draft, setDraft] = useState('');
      const [mode, setMode] = useState('preview');
      const [folder, setFolder] = useState('');
      const [status, setStatus] = useState(null);
      const [log, setLog] = useState([]);
      const [query, setQuery] = useState('');
      const [hits, setHits] = useState(null);
      const [busy, setBusy] = useState(false);
      const [notice, setNotice] = useState(null);
      const [dialog, setDialog] = useState(null);
      const [menu, setMenu] = useState(null);
      const [searching, setSearching] = useState(false);
      const [booting, setBooting] = useState(true);
      const fileInput = useRef(null);
      const toastTimer = useRef(null);

      const active = useMemo(() => libraries.find((row) => row.id === activeId) ?? null, [libraries, activeId]);
      const dirty = opened && opened.binary === false && draft !== opened.content;

      const notify = useCallback((text, kind) => {
        setNotice({ text, kind: kind || 'info' });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setNotice(null), kind === 'error' ? 6000 : 3000);
      }, []);

      useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

      const loadLibraries = useCallback(async () => {
        try {
          const payload = await getJson('/api/kb/libraries');
          setLibraries(payload.libraries ?? []);
          setGitInfo(payload.git ?? { available: false });
          if (payload.activeId) setActiveId(payload.activeId);
          else setActiveId((current) => current ?? payload.libraries?.[0]?.id ?? null);
          return payload;
        } catch (cause) {
          notify(errorText(cause), 'error');
          return null;
        } finally {
          setBooting(false);
        }
      }, [notify]);

      const loadTree = useCallback(
        async (libId, path, { quiet } = {}) => {
          if (!libId) return;
          try {
            const payload = await getJson(`/api/kb/tree?lib=${encodeURIComponent(libId)}&path=${encodeURIComponent(path || '')}`);
            setTree((current) => ({ ...current, [`${libId}:${path || ''}`]: payload.entries ?? [] }));
          } catch (cause) {
            if (!quiet) notify(errorText(cause), 'error');
            const key = `${libId}:${path || ''}`;
            setTree((current) => (current[key] ? current : { ...current, [key]: [] }));
          }
        },
        [notify],
      );

      const loadGit = useCallback(
        async (libId) => {
          if (!libId) return;
          try {
            const payload = await getJson(`/api/kb/git?lib=${encodeURIComponent(libId)}`);
            setStatus(payload.status ?? null);
            setLog(payload.log ?? []);
          } catch {
            setStatus(null);
            setLog([]);
          }
        },
        [],
      );

      useEffect(() => {
        loadLibraries();
      }, [loadLibraries]);

      useEffect(() => {
        if (!activeId) return;
        setOpened(null);
        setQuery('');
        setHits(null);
        setTree({});
        setExpanded(new Set());
        setFolder('');
        loadTree(activeId, '');
        loadGit(activeId);
      }, [activeId, loadTree, loadGit]);

      const toggleDir = async (path) => {
        const key = `${activeId}:${path}`;
        const next = new Set(expanded);
        if (next.has(path)) next.delete(path);
        else {
          next.add(path);
          if (!tree[key]) await loadTree(activeId, path);
        }
        setExpanded(next);
        setFolder(path);
      };

      const openFile = async (path) => {
        setBusy(true);
        try {
          const payload = await getJson(`/api/kb/file?lib=${encodeURIComponent(activeId)}&path=${encodeURIComponent(path)}`);
          setOpened({
            path: payload.path,
            content: payload.content ?? '',
            hash: payload.hash ?? null,
            binary: Boolean(payload.binary),
            size: payload.size ?? 0,
            ext: payload.ext ?? '',
          });
          setDraft(payload.content ?? '');
          setMode(payload.binary ? 'meta' : 'preview');
          setFolder(parentDir(payload.path));
        } catch (cause) {
          notify(errorText(cause), 'error');
        } finally {
          setBusy(false);
        }
      };

      const save = useCallback(async () => {
        if (!opened || opened.binary) return;
        setBusy(true);
        try {
          const payload = await postJson('/api/kb/file', {
            lib: activeId,
            path: opened.path,
            content: draft,
            expectedHash: opened.hash,
          });
          setOpened({ ...opened, content: draft, hash: payload.hash ?? opened.hash });
          notify(payload.commit?.committed ? `已保存并提交 ${String(payload.commit.hash || '').slice(0, 8)}` : '已保存');
          loadGit(activeId);
        } catch (cause) {
          notify(errorText(cause), 'error');
        } finally {
          setBusy(false);
        }
      }, [opened, draft, activeId, notify, loadGit]);

      useEffect(() => {
        const onKey = (event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
            if (opened && !opened.binary) {
              event.preventDefault();
              save();
            }
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [opened, save]);

      useEffect(() => {
        if (!query.trim() || !activeId) {
          setHits(null);
          return undefined;
        }
        let alive = true;
        setSearching(true);
        const timer = setTimeout(async () => {
          try {
            const payload = await getJson(`/api/kb/search?lib=${encodeURIComponent(activeId)}&q=${encodeURIComponent(query.trim())}`);
            if (alive) setHits(payload.hits ?? []);
          } catch (cause) {
            if (alive) notify(errorText(cause), 'error');
          } finally {
            if (alive) setSearching(false);
          }
        }, 260);
        return () => {
          alive = false;
          clearTimeout(timer);
        };
      }, [query, activeId, notify]);

      const createDoc = async (path) => {
        await postJson('/api/kb/file/create', { lib: activeId, path, content: `# ${baseName(path).replace(/\.[^.]+$/, '')}\n\n` });
        setDialog(null);
        await loadTree(activeId, parentDir(path));
        await openFile(path);
        notify('已创建');
      };

      const createFolder = async (path) => {
        await postJson('/api/kb/folder', { lib: activeId, path });
        setDialog(null);
        await loadTree(activeId, parentDir(path));
        notify('已创建文件夹');
      };

      const renamePath = async (from, to) => {
        await postJson('/api/kb/rename', { lib: activeId, from, to });
        setDialog(null);
        await loadTree(activeId, parentDir(from));
        await loadTree(activeId, parentDir(to));
        if (opened && (opened.path === from || opened.path.startsWith(`${from}/`))) await openFile(to);
        notify('已重命名');
      };

      const removePath = async (path) => {
        if (!path) return;
        if (!window.confirm(`删除「${path}」？\n会移到 .kb/trash，可从 Git 历史恢复。`)) return;
        try {
          await postJson('/api/kb/delete', { lib: activeId, path });
          if (opened && (opened.path === path || opened.path.startsWith(`${path}/`))) {
            setOpened(null);
            setDraft('');
          }
          await loadTree(activeId, parentDir(path));
          loadGit(activeId);
          notify('已移到回收站');
        } catch (cause) {
          notify(errorText(cause), 'error');
        }
      };

      const upload = async (files) => {
        const list = Array.from(files ?? []);
        if (!list.length) return;
        setBusy(true);
        try {
          for (const file of list) {
            const buffer = await file.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const chunk = 0x8000;
            for (let index = 0; index < bytes.length; index += chunk) {
              binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
            }
            await postJson('/api/kb/upload', {
              lib: activeId,
              dir: folder || 'inbox',
              name: file.name,
              data: btoa(binary),
            });
          }
          await loadTree(activeId, folder || '');
          loadGit(activeId);
          notify(`已上传 ${list.length} 个文件`);
        } catch (cause) {
          notify(errorText(cause), 'error');
        } finally {
          setBusy(false);
          if (fileInput.current) fileInput.current.value = '';
        }
      };

      const gitAction = async (action) => {
        try {
          if (action === 'commit') {
            const message = window.prompt('提交说明', 'kb: 手动提交');
            if (message === null) return;
            const payload = await postJson('/api/kb/git', { lib: activeId, action: 'commit', message });
            notify(payload.committed ? '已提交' : '没有需要提交的变更');
          } else {
            const payload = await postJson('/api/kb/git', { lib: activeId, action: 'sync' });
            if (payload.ok === false) notify(`${payload.stage === 'pull' ? '拉取' : '推送'}失败：${payload.message}`, 'error');
            else notify(payload.committed ? '已同步（含新提交）' : '已同步');
          }
          loadGit(activeId);
        } catch (cause) {
          notify(errorText(cause), 'error');
        }
      };

      const newLibrary = () => setDialog({ type: 'library' });

      const openMenuAt = (event, items) => {
        event.preventDefault();
        event.stopPropagation();
        const height = Math.min(items.length * 31 + 12, 360);
        setMenu({
          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
          y: Math.max(8, Math.min(event.clientY, window.innerHeight - height)),
          items,
        });
      };

      const askNewDoc = (dir) =>
        setDialog({
          type: 'prompt',
          title: '新建文档',
          label: '相对路径',
          initial: joinPath(dir || 'inbox', '新文档.md'),
          confirmText: '创建',
          onSubmit: createDoc,
        });

      const askNewFolder = (dir) =>
        setDialog({
          type: 'prompt',
          title: '新建文件夹',
          label: '相对路径',
          initial: joinPath(dir || 'inbox', '新文件夹'),
          confirmText: '创建',
          onSubmit: createFolder,
        });

      const uploadInto = (dir) => {
        setFolder(dir || '');
        window.setTimeout(() => fileInput.current?.click(), 0);
      };

      const dirMenuItems = (entry) => [
        { label: '新建文档', icon: 'file-plus', onClick: () => askNewDoc(entry.path) },
        { label: '新建文件夹', icon: 'folder-plus', onClick: () => askNewFolder(entry.path) },
        { label: '上传文件到此目录', icon: 'upload', onClick: () => uploadInto(entry.path) },
        '-',
        {
          label: '重命名',
          icon: 'rename',
          onClick: () =>
            setDialog({
              type: 'prompt',
              title: '重命名目录',
              label: '新的相对路径',
              initial: entry.path,
              confirmText: '重命名',
              onSubmit: (to) => renamePath(entry.path, to),
            }),
        },
        { label: '删除目录', icon: 'trash', onClick: () => removePath(entry.path) },
        { label: '复制引用', icon: 'library', onClick: () => copyReference(`${entry.path}/`) },
        '-',
        { label: '刷新', icon: 'refresh', onClick: () => loadTree(activeId, entry.path) },
      ];

      const copyReference = async (path) => {
        const token = `@kb:${active?.name ?? activeId}/${path}`;
        try {
          await navigator.clipboard.writeText(token);
          notify(`已复制 ${token}`);
        } catch {
          notify(`复制失败，引用是 ${token}`, 'error');
        }
      };

      const askRename = (path) =>
        setDialog({
          type: 'prompt',
          title: '重命名 / 移动',
          label: '新的相对路径',
          initial: path,
          confirmText: '重命名',
          onSubmit: (to) => renamePath(path, to),
        });

      const fileMenuItems = (path) => [
        { label: '打开', icon: 'eye', onClick: () => openFile(path) },
        {
          label: '编辑',
          icon: 'edit',
          onClick: () => {
            openFile(path).then(() => setMode('edit'));
          },
        },
        { label: '复制引用', icon: 'library', onClick: () => copyReference(path) },
        '-',
        { label: '重命名 / 移动', icon: 'rename', onClick: () => askRename(path) },
        { label: '删除', icon: 'trash', onClick: () => removePath(path) },
        '-',
        { label: '刷新', icon: 'refresh', onClick: () => loadTree(activeId, parentDir(path)) },
      ];

      const renderTree = (path, depth) => {
        const key = `${activeId}:${path || ''}`;
        const entries = tree[key];
        if (!entries) {
          return h(
            'div',
            { className: 'kb-tree-skeleton' },
            h('i', { style: { width: '82%' } }),
            h('i', { style: { width: '68%' } }),
            h('i', { style: { width: '76%' } }),
            h('i', { style: { width: '58%' } }),
          );
        }
        return entries.map((entry) =>
          entry.type === 'dir'
            ? h(
                React.Fragment,
                { key: entry.path },
                h(
                  'div',
                  {
                    className: cx('kb-row', 'dir'),
                    style: { paddingLeft: `${8 + depth * 14}px` },
                    onClick: () => toggleDir(entry.path),
                    onContextMenu: (event) => openMenuAt(event, dirMenuItems(entry)),
                    title: entry.path,
                  },
                  h(
                    'span',
                    { className: 'kb-caret', style: { display: 'inline-flex', justifyContent: 'center' } },
                    h(Icon, { name: 'chevron', size: 12, className: expanded.has(entry.path) ? 'kb-chev' : 'kb-chev-closed' }),
                  ),
                  h(
                    'span',
                    { className: cx('kb-row-icon', dirIconName(entry.name)) },
                    h(Icon, { name: dirIconName(entry.name), size: 16 }),
                  ),
                  h('span', { className: 'kb-name' }, entry.name),
                ),
                expanded.has(entry.path) ? renderTree(entry.path, depth + 1) : null,
              )
            : h(
                'div',
                {
                  key: entry.path,
                  className: cx('kb-row', opened?.path === entry.path && 'active'),
                  style: { paddingLeft: `${8 + depth * 14 + 28}px` },
                  onClick: () => openFile(entry.path),
                  onContextMenu: (event) => openMenuAt(event, fileMenuItems(entry.path)),
                  title: entry.path,
                },
                h('span', { className: cx('kb-row-icon', fileIconName(entry.name)) }, h(Icon, { name: fileIconName(entry.name), size: 16 })),
                h('span', { className: 'kb-name' }, entry.name),
                h('span', { className: 'kb-meta' }, formatBytes(entry.size)),
              ),
        );
      };

      const header = h(
        'div',
        { className: 'kb-head' },
        h('span', { className: 'kb-title' }, '知识库'),
        libraries.length
          ? h(
              'select',
              {
                className: 'kb-select',
                value: activeId ?? '',
                onChange: async (event) => {
                  const id = event.target.value;
                  setActiveId(id);
                  try {
                    await postJson('/api/kb/libraries/active', { id });
                  } catch {
                    /* 忽略：只是记住上次选择 */
                  }
                },
              },
              libraries.map((row) => h('option', { key: row.id, value: row.id }, row.name)),
            )
          : null,
        active ? h('span', { className: 'kb-sub', title: active.root }, active.root) : null,
        status?.repo
          ? h('span', { className: cx('kb-chip', status.dirty ? 'warn' : 'ok') }, status.dirty ? `${status.dirty} 项变更` : '已提交')
          : null,
        status?.repo && status.branch ? h('span', { className: 'kb-chip' }, status.branch) : null,
        h('span', { className: 'kb-spacer' }),
        h(
          'div',
          { className: 'kb-actions' },
          h(IconButton, { icon: 'plus', label: '新建知识库', tone: 'green', onClick: newLibrary }),
          h(IconButton, {
            icon: 'refresh',
            label: '刷新目录与 Git 状态',
            tone: 'blue',
            onClick: () => loadLibraries().then(() => activeId && loadTree(activeId, '')),
          }),
          h('span', { className: 'kb-divider' }),
          h(IconButton, {
            icon: 'commit',
            label: '提交当前改动',
            tone: 'purple',
            disabled: !active || !status?.repo,
            onClick: () => gitAction('commit'),
          }),
          h(IconButton, {
            icon: 'sync',
            label: status?.remote ? '与远端同步' : '没有配置云端仓库',
            tone: 'teal',
            disabled: !active || !status?.repo || !status.remote,
            onClick: () => gitAction('sync'),
          }),
        ),
      );

      const side = h(
        'div',
        { className: 'kb-side' },
        h(
          'div',
          { className: 'kb-search' },
          h('input', {
            className: 'kb-input',
            placeholder: '搜索文件名或正文…',
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
        ),
        hits
          ? h(
              'div',
              { className: 'kb-hits' },
              hits.length === 0
                ? h('div', { className: 'kb-hit' }, searching ? '搜索中…' : '没有匹配。')
                : hits.map((hit) =>
                    h(
                      'div',
                      { key: hit.path, className: 'kb-hit', onClick: () => openFile(hit.path) },
                      h('div', { className: 'kb-hit-name' }, `${hit.title}  `, h('span', { className: 'kb-chip' }, hit.path)),
                      hit.snippet ? h('div', { className: 'kb-hit-snippet' }, hit.snippet) : null,
                    ),
                  ),
            )
          : null,
        h(
          'div',
          { className: 'kb-side-tools kb-toolbar' },
          h(IconButton, { icon: 'file-plus', label: '新建文档', tone: 'green', disabled: !active, onClick: () => askNewDoc(folder || 'inbox') }),
          h(IconButton, { icon: 'folder-plus', label: '新建文件夹', tone: 'amber', disabled: !active, onClick: () => askNewFolder(folder || 'inbox') }),
          h(IconButton, { icon: 'upload', label: '上传文件', tone: 'blue', disabled: !active || busy, onClick: () => fileInput.current?.click() }),
          h('span', { className: 'kb-spacer' }),
          h(IconButton, {
            icon: 'refresh',
            label: '刷新当前目录',
            tone: 'blue',
            disabled: !active,
            onClick: () => loadTree(activeId, folder || ''),
          }),
          h('input', {
            ref: fileInput,
            type: 'file',
            multiple: true,
            style: { display: 'none' },
            onChange: (event) => upload(event.target.files),
          }),
        ),
        h(
          'div',
          {
            className: 'kb-tree',
            onContextMenu: (event) =>
              openMenuAt(event, [
                { label: '新建文档', icon: 'file-plus', onClick: () => askNewDoc(folder || 'inbox') },
                { label: '新建文件夹', icon: 'folder-plus', onClick: () => askNewFolder(folder || 'inbox') },
                { label: '上传文件', icon: 'upload', onClick: () => uploadInto(folder || 'inbox') },
                '-',
                { label: '刷新', icon: 'refresh', onClick: () => loadTree(activeId, '') },
              ]),
          },
          active ? renderTree('', 0) : null,
        ),
      );

      if (booting) {
        return h(
          'div',
          { className: 'kb-app' },
          header,
          h(
            'div',
            { className: 'kb-empty' },
            h('div', { className: 'kb-spinner' }),
            h('span', null, '正在读取知识库…'),
          ),
          h(Toast, { notice }),
        );
      }

      const content = !active
        ? h(
            'div',
            { className: 'kb-empty' },
            h('b', null, '先建一个知识库'),
            h('span', null, '选一个本地目录，插件会为它铺好 inbox / notes / projects / assets / templates，并用 Git 记版本。'),
            h('button', { className: 'kb-btn primary', onClick: newLibrary, type: 'button' }, '新建知识库'),
          )
        : !opened
          ? tree[`${activeId}:`]
            ? h(
                'div',
                { className: 'kb-empty' },
                h('b', null, '选择左侧的文件开始'),
                h('span', null, '在对话里输入 @kb: 可以引用这里的文档；模型用 kb_read / kb_write 读写。'),
                status?.repo
                  ? h('span', null, `Git：${status.branch ?? '未命名分支'}${status.remote ? ` → ${status.remote}` : '（仅本地）'}，${status.dirty ? `${status.dirty} 项未提交` : '工作区干净'}`)
                  : h('span', null, '这个库没有 Git 仓库。'),
              )
            : h(
                'div',
                { className: 'kb-empty' },
                h('div', { className: 'kb-spinner' }),
                h('span', null, '正在读取目录…'),
              )
          : h(
              'div',
              { className: 'kb-main' },
              h(
                'div',
                { className: 'kb-file-head', onContextMenu: (event) => openMenuAt(event, fileMenuItems(opened.path)) },
                h(
                  'div',
                  { className: 'kb-file-top' },
                  h('span', { className: 'kb-file-path', title: opened.path }, opened.path),
                  h('span', { className: 'kb-chip' }, formatBytes(opened.size)),
                  opened.binary ? h('span', { className: 'kb-chip warn' }, '二进制') : null,
                  dirty ? h('span', { className: 'kb-chip warn' }, '未保存') : null,
                  h('span', { className: 'kb-spacer' }),
                  !opened.binary
                    ? h(IconButton, {
                        icon: mode === 'preview' ? 'edit' : 'eye',
                        label: mode === 'preview' ? '编辑' : '预览',
                        tone: 'amber',
                        onClick: () => setMode(mode === 'preview' ? 'edit' : 'preview'),
                      })
                    : null,
                  !opened.binary
                    ? h(IconButton, {
                        icon: 'save',
                        label: '保存（Ctrl+S）',
                        tone: 'blue',
                        active: dirty,
                        disabled: !dirty || busy,
                        onClick: save,
                      })
                    : null,
                  h(IconButton, {
                    icon: 'more',
                    label: '更多操作（重命名、删除、复制引用）',
                    onClick: (event) => openMenuAt(event, fileMenuItems(opened.path)),
                  }),
                  h(IconButton, { icon: 'close', label: '关闭', onClick: () => setOpened(null) }),
                ),
              ),
              h(
                'div',
                {
                  className: 'kb-content',
                  onContextMenu: (event) => openMenuAt(event, fileMenuItems(opened.path)),
                },
                opened.binary
                  ? h('div', { className: 'kb-empty' }, h('b', null, '二进制文件'), h('span', null, `${opened.size} 字节，暂不支持内联预览。`))
                  : mode === 'edit'
                    ? h('textarea', {
                        className: 'kb-editor',
                        value: draft,
                        spellCheck: false,
                        onChange: (event) => setDraft(event.target.value),
                        onKeyDown: (event) => {
                          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                            event.preventDefault();
                            save();
                          }
                        },
                      })
                    : h(Markdown, { text: opened.content }),
              ),
            );

      return h(
        'div',
        { className: 'kb-app', style: { position: 'relative' } },
        header,
        h('div', { className: 'kb-body' }, side, content),
        h(ContextMenu, { menu, onClose: () => setMenu(null) }),
        dialog?.type === 'library'
          ? h(CreateLibraryDialog, {
              onClose: () => setDialog(null),
              onCreated: async () => {
                setDialog(null);
                const payload = await loadLibraries();
                if (payload?.libraries?.length) setActiveId(payload.libraries[payload.libraries.length - 1].id);
                notify('知识库已创建');
              },
            })
          : dialog?.type === 'prompt'
            ? h(PromptDialog, {
                title: dialog.title,
                label: dialog.label,
                initial: dialog.initial,
                confirmText: dialog.confirmText,
                onClose: () => setDialog(null),
                onSubmit: dialog.onSubmit,
              })
            : null,
        h(Toast, { notice }),
      );
    }

    // ---------------------------------------------------------------- 右栏 tab

    function tabAddress(libId, relPath) {
      const lib = encodeURIComponent(String(libId ?? ''));
      const parts = String(relPath ?? '')
        .split('/')
        .filter(Boolean)
        .map((part) => encodeURIComponent(part));
      return `kb://${lib}/${parts.join('/')}`;
    }

    function parseTabAddress(address) {
      const raw = String(address ?? '');
      if (!raw.startsWith('kb://')) return null;
      const rest = raw.slice('kb://'.length);
      const slash = rest.indexOf('/');
      const lib = decodeURIComponent(slash < 0 ? rest : rest.slice(0, slash));
      const path = (slash < 0 ? '' : rest.slice(slash + 1))
        .split('/')
        .filter(Boolean)
        .map((part) => decodeURIComponent(part))
        .join('/');
      return lib ? { lib, path } : null;
    }

    // 右栏「知识库」页：库 -> 目录 -> 文件，单栏浏览。
    function KbBrowserPane() {
      const [libraries, setLibraries] = useState([]);
      const [libId, setLibId] = useState('');
      const [dir, setDir] = useState('');
      const [entries, setEntries] = useState([]);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const [file, setFile] = useState(null);
      const [booting, setBooting] = useState(true);

      const active = useMemo(() => libraries.find((row) => row.id === libId) ?? null, [libraries, libId]);

      useEffect(() => {
        let alive = true;
        getJson('/api/kb/libraries')
          .then((payload) => {
            if (!alive) return;
            const rows = Array.isArray(payload.libraries) ? payload.libraries : [];
            setLibraries(rows);
            const preferred = rows.find((row) => row.id === payload.activeId) || rows[0];
            if (preferred) setLibId(preferred.id);
          })
          .catch((cause) => {
            if (alive) setError(errorText(cause));
          })
          .finally(() => {
            if (alive) setBooting(false);
          });
        return () => {
          alive = false;
        };
      }, []);

      const loadDir = useCallback(
        async (libraryId, path) => {
          if (!libraryId) return;
          setLoading(true);
          setError('');
          try {
            const payload = await getJson(`/api/kb/tree?lib=${encodeURIComponent(libraryId)}&path=${encodeURIComponent(path || '')}`);
            setEntries(payload.entries ?? []);
            setDir(path || '');
          } catch (cause) {
            setError(errorText(cause));
            setEntries([]);
          } finally {
            setLoading(false);
          }
        },
        [],
      );

      useEffect(() => {
        if (!libId) return;
        setFile(null);
        loadDir(libId, '');
      }, [libId, loadDir]);

      if (booting) {
        return h(
          'div',
          { className: 'kb-pane' },
          h(
            'div',
            { className: 'kb-empty' },
            h('div', { className: 'kb-spinner' }),
            h('span', null, '正在读取知识库…'),
          ),
        );
      }

      const openFile = async (path) => {
        setLoading(true);
        setError('');
        try {
          const payload = await getJson(`/api/kb/file?lib=${encodeURIComponent(libId)}&path=${encodeURIComponent(path)}`);
          if (payload.binary) {
            setError('二进制文件，暂不支持预览。');
          } else {
            setFile(payload);
          }
        } catch (cause) {
          setError(errorText(cause));
        } finally {
          setLoading(false);
        }
      };

      const crumbs = (() => {
        const parts = String(dir || '').split('/').filter(Boolean);
        const chips = [
          h(
            'button',
            { key: 'root', type: 'button', className: 'kb-crumb', onClick: () => loadDir(libId, '') },
            active ? active.name : '知识库',
          ),
        ];
        parts.forEach((part, index) => {
          const target = parts.slice(0, index + 1).join('/');
          chips.push(
            h(
              'button',
              { key: target, type: 'button', className: 'kb-crumb', onClick: () => loadDir(libId, target) },
              part,
            ),
          );
        });
        return chips;
      })();

      const head = h(
        'div',
        { className: 'kb-pane-head' },
        libraries.length
          ? h(
              'select',
              {
                className: 'kb-select',
                value: libId,
                onChange: (event) => setLibId(event.target.value),
              },
              ...libraries.map((row) => h('option', { key: row.id, value: row.id }, row.name)),
            )
          : h('span', { className: 'kb-hint' }, '还没有知识库'),
        h(IconButton, {
          icon: 'up',
          label: '上一级',
          disabled: !dir,
          onClick: () => loadDir(libId, parentDir(dir)),
        }),
        h(IconButton, { icon: 'refresh', label: '刷新', disabled: !libId, onClick: () => loadDir(libId, dir) }),
        h('span', { className: 'kb-spacer' }),
        h(IconButton, {
          icon: 'right',
          label: '在中央面板打开知识库',
          onClick: () => {
            try {
              safeGet('layout')?.selectPanel?.(PANEL_ID);
            } catch {
              /* 忽略 */
            }
          },
        }),
      );

      if (file) {
        return h(
          'div',
          { className: 'kb-pane' },
          h(
            'div',
            { className: 'kb-pane-head' },
            h(IconButton, { icon: 'up', label: '返回目录', onClick: () => setFile(null) }),
            h('span', { className: 'kb-file-path', title: file.path }, file.path),
            h('span', { className: 'kb-spacer' }),
            h(IconButton, {
              icon: 'refresh',
              label: '重新读取',
              onClick: () => openFile(file.path),
            }),
          ),
          h('div', { className: 'kb-pane-doc' }, h(Markdown, { text: file.content })),
        );
      }

      return h(
        'div',
        { className: 'kb-pane' },
        head,
        h('div', { className: 'kb-pane-head', style: { borderTop: '0' } }, h('div', { className: 'kb-crumbs' }, ...crumbs)),
        error ? h('div', { className: 'kb-hint', style: { padding: '0 12px 8px' } }, error) : null,
        h(
          'div',
          { className: 'kb-pane-body' },
          loading ? h(Skeleton, { lines: 5 }) : null,
          !loading && !entries.length ? h('div', { className: 'kb-hint' }, '这个目录是空的') : null,
          ...entries.map((entry) =>
            h(
              'div',
              {
                key: entry.path,
                className: 'kb-file-item',
                onClick: () => (entry.type === 'dir' ? loadDir(libId, entry.path) : openFile(entry.path)),
                title: entry.path,
              },
              h(
                'span',
                {
                  className: cx(
                    'kb-row-icon',
                    entry.type === 'dir' ? dirIconName(entry.name) : fileIconName(entry.name),
                  ),
                },
                h(Icon, { name: entry.type === 'dir' ? dirIconName(entry.name) : fileIconName(entry.name), size: 16 }),
              ),
              h('span', { className: 'kb-name' }, entry.name),
              h('span', { className: 'kb-meta' }, entry.type === 'dir' ? '' : formatBytes(entry.size)),
            ),
          ),
        ),
      );
    }

    function KbSideTab(props) {
      const address = props?.resourceAddress ?? props?.tab?.resourceAddress ?? props?.tab?.address ?? props?.resource?.address ?? props?.address;
      const parsed = useMemo(() => parseTabAddress(address), [address]);
      const [state, setState] = useState({ phase: 'loading' });

      useEffect(() => {
        let alive = true;
        if (!parsed) {
          setState({ phase: 'error', error: '这个地址不是知识库文档。' });
          return () => {
            alive = false;
          };
        }
        setState({ phase: 'loading' });
        (async () => {
          try {
            const payload = await getJson(`/api/kb/file?lib=${encodeURIComponent(parsed.lib)}&path=${encodeURIComponent(parsed.path)}`);
            if (alive) setState({ phase: 'ready', file: payload });
          } catch (cause) {
            if (alive) setState({ phase: 'error', error: errorText(cause) });
          }
        })();
        return () => {
          alive = false;
        };
      }, [parsed]);

      if (state.phase === 'loading') return h('div', { className: 'kb-app' }, h(Skeleton, { lines: 6 }));
      if (state.phase === 'error') return h('div', { className: 'kb-empty' }, h('b', null, '打不开'), h('span', null, state.error));
      const file = state.file;
      return h(
        'div',
        { className: 'kb-app' },
        h(
          'div',
          { className: 'kb-file-head' },
          h(
            'div',
            { className: 'kb-file-top' },
            h('span', { className: 'kb-file-path', title: file.path }, file.path),
            h('span', { className: 'kb-chip' }, formatBytes(file.size)),
            h('span', { className: 'kb-spacer' }),
            h(IconButton, {
              icon: 'refresh',
              label: '重新读取',
              onClick: () => {
                setState({ phase: 'loading' });
                getJson(`/api/kb/file?lib=${encodeURIComponent(parsed.lib)}&path=${encodeURIComponent(parsed.path)}`)
                  .then((payload) => setState({ phase: 'ready', file: payload }))
                  .catch((cause) => setState({ phase: 'error', error: errorText(cause) }));
              },
            }),
            h(IconButton, {
              icon: 'right',
              label: '在中央面板打开知识库',
              onClick: () => {
                try {
                  safeGet('layout')?.selectPanel?.(PANEL_ID);
                } catch {
                  /* 忽略 */
                }
              },
            }),
          ),
        ),
        h(
          'div',
          { className: 'kb-content' },
          file.binary ? h('div', { className: 'kb-empty' }, h('b', null, '二进制文件'), h('span', null, `${file.size} 字节。`)) : h(Markdown, { text: file.content }),
        ),
      );
    }

    function PanelIcon(props) {
      const size = props?.size ?? 20;
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M4.5 5.2c0-.7.6-1.2 1.2-1.2H11a2 2 0 0 1 2 2v13.3a1.6 1.6 0 0 0-1.6-1.6H5.7a1.2 1.2 0 0 1-1.2-1.2V5.2Z',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M19.5 5.2c0-.7-.6-1.2-1.2-1.2H13a2 2 0 0 0-2 2v13.3a1.6 1.6 0 0 1 1.6-1.6h5.7c.7 0 1.2-.5 1.2-1.2V5.2Z',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    // ---------------------------------------------------------------- @kb 源

    const libraryCache = { at: 0, rows: [] };

    async function recentLibraries() {
      if (Date.now() - libraryCache.at < 4000 && libraryCache.rows.length) return libraryCache.rows;
      const payload = await getJson('/api/kb/libraries');
      libraryCache.at = Date.now();
      libraryCache.rows = payload.libraries ?? [];
      return libraryCache.rows;
    }

    function parseKbQuery(query) {
      const text = String(query ?? '');
      if (!/^kb:/i.test(text)) return null;
      const rest = text.slice(3);
      const slash = rest.indexOf('/');
      if (slash < 0) return { libName: rest, path: '', trailingSlash: false };
      return { libName: rest.slice(0, slash), path: rest.slice(slash + 1), trailingSlash: rest.endsWith('/') };
    }

    function sectionRow(name, description, value, extra) {
      return { name, ...(description ? { description } : {}), section: '知识库', value: JSON.stringify(value), ...(extra || {}) };
    }

    function kbSource() {
      return {
        trigger: '@',
        name: 'knowledge-base',
        showGroupTitle: false,
        async candidates(_session, { query }) {
          const parsed = parseKbQuery(query);
          if (!parsed) return [];
          const term = parsed.path ? `${parsed.libName}/${parsed.path}` : parsed.libName;
          let payload;
          try {
            payload = await getJson(`/api/kb/files?q=${encodeURIComponent(term)}&limit=40`);
          } catch {
            return [];
          }
          const rows = (payload.hits ?? []).map((hit) =>
            sectionRow(
              hit.type === 'dir' ? `${hit.name}/` : hit.name,
              `${hit.libName} · ${parentDir(hit.path) || '/'}`,
              { kind: hit.type, lib: hit.lib, name: hit.libName, path: hit.path },
              { icon: hit.type === 'dir' ? 'folder' : 'file' },
            ),
          );
          if (!rows.length) {
            rows.push(
              sectionRow(
                term ? '没有匹配的文件或目录' : '知识库还是空的',
                term ? '换个关键词试试' : '先在左栏「知识库」里建一个',
                { kind: 'none' },
              ),
            );
          }
          return rows;
        },
        onPick({ candidate }) {
          let value = null;
          try {
            value = JSON.parse(candidate?.value ?? 'null');
          } catch {
            return undefined;
          }
          if (!value || value.kind === 'none') return undefined;
          if (value.kind === 'dir') return { text: `@kb:${value.name}/${value.path}/ ` };
          return { text: `@kb:${value.name}/${value.path} ` };
        },
        openReference() {
          return false;
        },
        codec: {
          clipboardText: (ref) => ref,
          serialize: (ref) => Promise.resolve(ref),
        },
      };
    }

    // ---------------------------------------------------------------- 插件装配

    function apply(ctx) {
      ctxRef.current = ctx;
      try {
        injectStyles();
      } catch (error) {
        console.error('[knowledge-base] styles', error);
      }

      // 每个座位独立注册：一个失败不能拖垮其余入口。
      try {
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, KbApp));
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 41, label: '知识库' }, PanelIcon),
        );
      } catch (error) {
        console.error('[knowledge-base] panel slots failed', error);
      }

      try {
        const tabs = ctx.get('sidebarRightTabs');
        if (tabs?.register) {
          try {
            if (!tabs.get?.(KB_TAB_KIND)) {
              ctx.effect(
                () =>
                  tabs.register({
                    id: KB_TAB_ID,
                    kind: KB_TAB_KIND,
                    patterns: ['kb://**'],
                    priority: 'extension',
                    title: () => '知识库',
                    canOpen: (address) => String(address ?? '').startsWith('kb://'),
                    keepMounted: false,
                  }),
                'knowledge-base: right file tab',
              );
            }
          } catch (error) {
            reportClientError('register:file-type', error);
          }
          // 右栏“开始页”（引导页）里的一个知识库入口：打开后是可直接浏览的页。
          try {
            if (!tabs.get?.(KB_PAGE_KIND)) {
              ctx.effect(
                () =>
                  tabs.register({
                    id: KB_PAGE_ID,
                    kind: KB_PAGE_KIND,
                    title: () => '知识库',
                    guide: [
                      {
                        id: 'browse',
                        order: 900,
                        title: () => '知识库',
                        description: () => '浏览与预览本地知识库文件',
                        icon: PanelIcon,
                      },
                    ],
                  }),
                'knowledge-base: right pane tab',
              );
            }
          } catch (error) {
            reportClientError('register:page-type', error);
          }
          try {
            ctx.slots.inject('sidebar.right.pane.tab', () =>
              ctx.slots.register({ name: 'sidebar.right.pane.tab', key: KB_TAB_ID }, KbSideTab),
            );
            ctx.slots.inject('sidebar.right.pane.tab', () =>
              ctx.slots.register({ name: 'sidebar.right.pane.tab', key: KB_PAGE_ID }, KbBrowserPane),
            );
          } catch (error) {
            reportClientError('register:tab-body', error);
          }
        }
      } catch (error) {
        console.error('[knowledge-base] right tab failed', error);
      }

      try {
        const triggers = ctx.get('inputTriggers');
        if (triggers?.registerSource) {
          ctx.effect(() => triggers.registerSource(kbSource()), 'knowledge-base: @ source');
        }
      } catch (error) {
        console.error('[knowledge-base] @ source failed', error);
      }

      try {
        ctx.slots.inject('conversation.chat.assistant-actions', () =>
          ctx.slots.register(
            { name: 'conversation.chat.assistant-actions', id: 'kb-save-message', order: 30, label: '保存到知识库' },
            SaveToKbAction,
          ),
        );
      } catch (error) {
        console.error('[knowledge-base] assistant action failed', error);
      }

      // 保存弹窗挂根级 overlay：消息行内部会被裁切，且动态客户端没有稳定的 react-dom portal。
      try {
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'kb-save-overlay', order: 24 }, KbSaveOverlay),
        );
      } catch (error) {
        reportClientError('register:overlay', error);
      }
    }

    return { inject: ['slots'], apply };
  },
});
