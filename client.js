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
      copy: ['M9 9h10v10H9V9Z', 'M5 15V5h10'],
      check: ['M4 12l5 5L20 6'],
      download: ['M12 4v11', 'M8 11l4 4 4-4', 'M5 20h14'],
      wrap: ['M4 7h16', 'M4 12h11a3 3 0 0 1 0 6H9', 'M11 15l-2 3 2 3'],
      external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'],
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

    function IconButton({ icon, label, onClick, disabled, active, danger, size, tone, busy }) {
      return h(
        'button',
        {
          type: 'button',
          className: cx('kb-iconbtn', active && 'on', danger && 'danger', tone && `tone-${tone}`),
          title: label,
          'aria-label': label,
          disabled: disabled || busy,
          onClick,
        },
        busy ? h('span', { className: 'kb-spinner kb-spinner-sm' }) : h(Icon, { name: icon, size: size || 16 }),
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

    function Skeleton({ lines = 4 }) {
      return h(
        'div',
        { className: 'kb-skeleton' },
        Array.from({ length: lines }, (_, index) => h('span', { key: index, style: { width: `${92 - index * 9}%` } })),
      );
    }

    // ---------------------------------------------------------------- preview engine

    function extOf(filePath) {
      const name = String(filePath || '');
      const dot = name.lastIndexOf('.');
      return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
    }

    function rawUrl(libId, filePath, options = {}) {
      const qs = new URLSearchParams({ lib: libId, path: filePath });
      if (options.download) qs.set('download', '1');
      return `/api/kb/raw?${qs.toString()}`;
    }

    function previewUrl(libId, filePath) {
      return `/api/kb/preview?${new URLSearchParams({ lib: libId, path: filePath }).toString()}`;
    }

    const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg']);
    const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac']);
    const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'ogv']);
    const OFFICE_EXT = new Set(['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt']);
    const CODE_LANG = {
      js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', ts: 'TypeScript', tsx: 'TSX', jsx: 'JSX',
      py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', swift: 'Swift',
      c: 'C', h: 'C', cpp: 'C++', hpp: 'C++', cs: 'C#', php: 'PHP', sh: 'Shell', bash: 'Shell',
      ps1: 'PowerShell', bat: 'Batch', cmd: 'Batch', sql: 'SQL', json: 'JSON', yaml: 'YAML',
      yml: 'YAML', toml: 'TOML', ini: 'INI', xml: 'XML', html: 'HTML', htm: 'HTML', css: 'CSS',
      scss: 'SCSS', less: 'Less', vue: 'Vue', svelte: 'Svelte', md: 'Markdown', markdown: 'Markdown',
      tex: 'LaTeX', rst: 'reST', csv: 'CSV', log: 'Log', txt: 'Text', dockerfile: 'Dockerfile',
    };

    function languageOf(filePath) {
      const name = String(filePath || '').split('/').pop() || '';
      if (/^dockerfile$/i.test(name)) return 'Dockerfile';
      if (/^makefile$/i.test(name)) return 'Makefile';
      return CODE_LANG[extOf(filePath)] || (extOf(filePath) ? extOf(filePath).toUpperCase() : 'Text');
    }

    // --- 轻量语法高亮：按语言切 token，渲染成带主题色的 span ---

    const HL_JS_KEYWORDS =
      'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|super|this|import|export|from|as|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|delete|void|yield|static|get|set|true|false|null|undefined|interface|type|enum|implements|public|private|protected|readonly|declare|namespace';
    const HL_PY_KEYWORDS =
      'def|class|return|if|elif|else|for|while|in|is|not|and|or|import|from|as|try|except|finally|raise|with|lambda|yield|async|await|pass|break|continue|global|nonlocal|assert|del|True|False|None|self|print';
    const HL_SH_KEYWORDS =
      'if|then|else|elif|fi|for|while|do|done|case|esac|function|return|export|local|readonly|source|echo|exit|set|unset|shift|eval|exec|trap|alias|cd|pwd';
    const HL_SQL_KEYWORDS =
      'select|from|where|insert|into|values|update|set|delete|create|table|alter|drop|index|join|left|right|inner|outer|on|group|by|order|having|limit|offset|as|and|or|not|null|is|in|exists|between|like|distinct|union|all|case|when|then|else|end|primary|key|foreign|references|default|unique|check|constraint|database|view|begin|commit|rollback';
    const HL_CSS_AT = 'media|supports|import|charset|font-face|keyframes|layer|container|property|page';

    function hlRules(lang) {
      const key = String(lang || '').toLowerCase();
      const js = /^(js|javascript|mjs|cjs|jsx|ts|typescript|tsx|mts|cts)$/;
      const py = /^(py|python|python3)$/;
      const sh = /^(sh|bash|zsh|shell|fish|ps1|powershell|cmd|bat)$/;
      const sql = /^(sql|mysql|postgres|postgresql|sqlite)$/;
      const html = /^(html|htm|xml|svg|vue|svelte)$/;
      const css = /^(css|scss|less)$/;
      const yaml = /^(yaml|yml)$/;
      const toml = /^(toml|ini|conf|properties|env)$/;
      const json = /^(json|jsonc|json5)$/;
      if (js.test(key)) {
        return [
          { type: 'comment', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
          { type: 'string', re: /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g },
          { type: 'number', re: /\b(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g },
          { type: 'keyword', re: new RegExp(`\\b(?:${HL_JS_KEYWORDS})\\b`, 'g') },
          { type: 'func', re: /\b[A-Za-z_$][\w$]*(?=\s*\()/g },
          { type: 'punct', re: /[{}()[\].,;:+\-*/%=<>!&|?~^]+/g },
        ];
      }
      if (py.test(key)) {
        return [
          { type: 'comment', re: /#[^\n]*/g },
          { type: 'string', re: /'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g },
          { type: 'decorator', re: /@[A-Za-z_][\w.]*/g },
          { type: 'number', re: /\b(?:\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g },
          { type: 'keyword', re: new RegExp(`\\b(?:${HL_PY_KEYWORDS})\\b`, 'g') },
          { type: 'func', re: /\b[A-Za-z_]\w*(?=\s*\()/g },
          { type: 'punct', re: /[{}()[\].,;:+\-*/%=<>!&|?~^]+/g },
        ];
      }
      if (sh.test(key)) {
        return [
          { type: 'comment', re: /#[^\n]*/g },
          { type: 'string', re: /'(?:[^']*)'|"(?:\\.|[^"\\])*"/g },
          { type: 'variable', re: /\$\{[^}]+\}|\$[\w@#?*!$-]+/g },
          { type: 'keyword', re: new RegExp(`\\b(?:${HL_SH_KEYWORDS})\\b`, 'g') },
          { type: 'number', re: /\b\d+(?:\.\d+)?\b/g },
          { type: 'flag', re: /(?:^|\s)--?[\w-]+/g },
          { type: 'punct', re: /[{}()[\]|&;<>]+/g },
        ];
      }
      if (sql.test(key)) {
        return [
          { type: 'comment', re: /--[^\n]*|\/\*[\s\S]*?\*\//g },
          { type: 'string', re: /'(?:''|[^'])*'/g },
          { type: 'keyword', re: new RegExp(`\\b(?:${HL_SQL_KEYWORDS})\\b`, 'gi') },
          { type: 'number', re: /\b\d+(?:\.\d+)?\b/g },
          { type: 'punct', re: /[(),;.*=<>+-]+/g },
        ];
      }
      if (html.test(key)) {
        return [
          { type: 'comment', re: /<!--[\s\S]*?-->/g },
          { type: 'keyword', re: /<!doctype[^>]*>/gi },
          { type: 'tag', re: /<\/?[A-Za-z][\w:.-]*/g },
          { type: 'attr', re: /[A-Za-z_:][-\w:.]*(?=\s*=)/g },
          { type: 'string', re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
          { type: 'punct', re: /\/?>/g },
        ];
      }
      if (css.test(key)) {
        return [
          { type: 'comment', re: /\/\*[\s\S]*?\*\//g },
          { type: 'string', re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
          { type: 'keyword', re: new RegExp(`@(?:${HL_CSS_AT})\\b`, 'g') },
          { type: 'prop', re: /[-a-zA-Z]+(?=\s*:)/g },
          { type: 'number', re: /\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr)?\b/g },
          { type: 'string', re: /#[0-9a-fA-F]{3,8}\b/g },
          { type: 'punct', re: /[{}();:,]/g },
        ];
      }
      if (json.test(key)) {
        return [
          { type: 'prop', re: /"(?:\\.|[^"\\])*"(?=\s*:)/g },
          { type: 'string', re: /"(?:\\.|[^"\\])*"/g },
          { type: 'number', re: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g },
          { type: 'keyword', re: /\b(?:true|false|null)\b/g },
          { type: 'punct', re: /[{}[\],:]/g },
        ];
      }
      if (yaml.test(key)) {
        return [
          { type: 'comment', re: /#[^\n]*/g },
          { type: 'prop', re: /^[ \t-]*[\w.$-]+(?=\s*:)/gm },
          { type: 'string', re: /"(?:\\.|[^"\\])*"|'(?:''|[^'])*'/g },
          { type: 'keyword', re: /\b(?:true|false|null|yes|no|on|off)\b/gi },
          { type: 'number', re: /-?\b\d+(?:\.\d+)?\b/g },
          { type: 'punct', re: /^[ \t-]*(?:-|:)[ \t]*/gm },
        ];
      }
      if (toml.test(key)) {
        return [
          { type: 'comment', re: /[#;][^\n]*/g },
          { type: 'keyword', re: /^[ \t]*\[[^\]\n]+\]/gm },
          { type: 'prop', re: /^[ \t]*[\w.-]+(?=\s*=)/gm },
          { type: 'string', re: /"(?:\\.|[^"\\])*"|'(?:[^']*)'/g },
          { type: 'number', re: /-?\b\d+(?:\.\d+)?\b/g },
          { type: 'punct', re: /=/g },
        ];
      }
      return null;
    }

    function highlightCode(code, lang) {
      const text = String(code ?? '');
      const rules = hlRules(lang);
      if (!rules || text.length > 120000) return [text];
      const compiled = rules.map((rule) => ({
        type: rule.type,
        re: new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`),
      }));
      const nodes = [];
      let pos = 0;
      let key = 0;
      while (pos < text.length) {
        let best = null;
        for (const rule of compiled) {
          rule.re.lastIndex = pos;
          const match = rule.re.exec(text);
          if (!match) continue;
          if (!best || match.index < best.index) {
            best = { index: match.index, end: match.index + match[0].length, type: rule.type, text: match[0] };
          }
        }
        if (!best || best.index >= text.length) break;
        if (best.index > pos) nodes.push(text.slice(pos, best.index));
        if (best.text) {
          nodes.push(h('span', { key: `hl${key++}`, className: `kb-hl-${best.type}` }, best.text));
        }
        pos = Math.max(best.end, pos + 1);
      }
      if (pos < text.length) nodes.push(text.slice(pos));
      return nodes;
    }

    // --- Markdown 解析（CommonMark / GFM 常用子集） ---

    function mdHeading(line) {
      const match = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      return match ? { level: match[1].length, text: match[2] } : null;
    }

    function mdFence(line) {
      const match = /^ {0,3}(`{3,}|~{3,})\s*([\w#+.-]*)\s*$/.exec(line);
      return match ? { marker: match[1], lang: match[2] } : null;
    }

    function mdHr(line) {
      return /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line);
    }

    function mdList(line) {
      const match = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(line);
      if (!match) return null;
      return {
        indent: match[1].replaceAll('\t', '    ').length,
        ordered: /\d/.test(match[2]),
        start: Number.parseInt(match[2], 10) || 1,
        text: match[3],
      };
    }

    function mdSplitRow(line) {
      let text = String(line).trim();
      if (text.startsWith('|')) text = text.slice(1);
      if (text.endsWith('|')) text = text.slice(0, -1);
      const cells = [];
      let buffer = '';
      let escaped = false;
      for (const ch of text) {
        if (escaped) {
          buffer += ch;
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '|') {
          cells.push(buffer.trim());
          buffer = '';
        } else {
          buffer += ch;
        }
      }
      cells.push(buffer.trim());
      return cells;
    }

    function mdTableSeparator(line) {
      if (!String(line).includes('|')) return false;
      const cells = mdSplitRow(line);
      return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
    }

    function parseMarkdownDoc(source) {
      const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
      const blocks = [];
      let index = 0;

      if (lines[0]?.trim() === '---') {
        let close = 1;
        while (close < lines.length && !/^(---|\.\.\.)\s*$/.test(lines[close])) close += 1;
        if (close < lines.length) {
          const entries = [];
          for (let cursor = 1; cursor < close; cursor += 1) {
            const match = /^([^:\s][^:]*):\s*(.*)$/.exec(lines[cursor]);
            if (match) entries.push({ key: match[1].trim(), value: match[2].trim() });
          }
          blocks.push({ type: 'frontmatter', entries });
          index = close + 1;
        }
      }

      while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
          index += 1;
          continue;
        }

        const fence = mdFence(line);
        if (fence) {
          const fenceChar = fence.marker[0];
          const minimum = fence.marker.length;
          const buffer = [];
          index += 1;
          while (index < lines.length) {
            const candidate = lines[index].trim();
            const closing = new RegExp(`^ {0,3}${fenceChar}{${minimum},}\\s*$`);
            if (closing.test(candidate)) {
              index += 1;
              break;
            }
            buffer.push(lines[index]);
            index += 1;
          }
          blocks.push({ type: 'code', lang: fence.lang || '', text: buffer.join('\n') });
          continue;
        }

        const heading = mdHeading(line);
        if (heading) {
          blocks.push({ type: 'heading', level: heading.level, text: heading.text });
          index += 1;
          continue;
        }

        if (index + 1 < lines.length && line.trim() && /^ {0,3}=+\s*$/.test(lines[index + 1])) {
          blocks.push({ type: 'heading', level: 1, text: line.trim() });
          index += 2;
          continue;
        }
        if (
          index + 1 < lines.length &&
          line.trim() &&
          !mdList(line) &&
          /^ {0,3}-{2,}\s*$/.test(lines[index + 1])
        ) {
          blocks.push({ type: 'heading', level: 2, text: line.trim() });
          index += 2;
          continue;
        }

        if (mdHr(line)) {
          blocks.push({ type: 'hr' });
          index += 1;
          continue;
        }

        if (/^ {0,3}>/.test(line)) {
          const buffer = [];
          while (index < lines.length && /^ {0,3}>/.test(lines[index])) {
            buffer.push(lines[index].replace(/^ {0,3}>\s?/, ''));
            index += 1;
          }
          blocks.push({ type: 'quote', blocks: parseMarkdownDoc(buffer.join('\n')) });
          continue;
        }

        if (line.includes('|') && index + 1 < lines.length && mdTableSeparator(lines[index + 1])) {
          const header = mdSplitRow(line);
          const separators = mdSplitRow(lines[index + 1]);
          const align = separators.map((cell) => {
            const left = cell.startsWith(':');
            const right = cell.endsWith(':');
            return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
          });
          index += 2;
          const rows = [];
          while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
            rows.push(mdSplitRow(lines[index]));
            index += 1;
          }
          blocks.push({ type: 'table', header, align, rows });
          continue;
        }

        const list = mdList(line);
        if (list) {
          const ordered = list.ordered;
          const start = list.start;
          const indent = list.indent;
          const items = [];
          while (index < lines.length) {
            const current = mdList(lines[index]);
            if (!current || current.ordered !== ordered || current.indent !== indent) break;
            const itemLines = [current.text];
            index += 1;
            while (index < lines.length) {
              const next = lines[index];
              if (!next.trim()) {
                const following = mdList(lines[index + 1] || '');
                if (following && following.ordered === ordered && following.indent === indent) {
                  index += 1;
                  break;
                }
                break;
              }
              const leading = /^\s*/.exec(next)[0].replaceAll('\t', '    ').length;
              if (leading <= indent) break;
              itemLines.push(next.replace(/^\s{1,}/, ''));
              index += 1;
            }
            let checked = null;
            const task = /^\[([ xX])\]\s+(.*)$/.exec(itemLines[0]);
            if (task) {
              checked = task[1].toLowerCase() === 'x';
              itemLines[0] = task[2];
            }
            items.push({ checked, blocks: parseMarkdownDoc(itemLines.join('\n')) });
          }
          blocks.push({ type: 'list', ordered, start, items });
          continue;
        }

        if (/^(    |\t)/.test(line)) {
          const buffer = [];
          while (index < lines.length && (/^(    |\t)/.test(lines[index]) || !lines[index].trim())) {
            if (!lines[index].trim() && !/^(    |\t)/.test(lines[index + 1] || '')) break;
            buffer.push(lines[index].replace(/^(    |\t)/, ''));
            index += 1;
          }
          blocks.push({ type: 'code', lang: '', text: buffer.join('\n') });
          continue;
        }

        const paragraph = [];
        while (index < lines.length) {
          const candidate = lines[index];
          if (!candidate.trim()) break;
          if (mdFence(candidate) || mdHeading(candidate) || mdHr(candidate)) break;
          if (/^ {0,3}>/.test(candidate)) break;
          if (mdList(candidate)) break;
          if (candidate.includes('|') && index + 1 < lines.length && mdTableSeparator(lines[index + 1])) break;
          paragraph.push(candidate);
          index += 1;
        }
        if (!paragraph.length) {
          paragraph.push(lines[index] ?? '');
          index += 1;
        }
        blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
      }
      return blocks;
    }

    function mdSlug(text) {
      return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function mdParseLinkAt(text, start) {
      let depth = 0;
      let end = start;
      for (; end < text.length; end += 1) {
        const ch = text[end];
        if (ch === '\\') {
          end += 1;
          continue;
        }
        if (ch === '[') depth += 1;
        else if (ch === ']') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      if (end >= text.length) return null;
      const label = text.slice(start + 1, end);
      if (text[end + 1] !== '(') return null;
      let cursor = end + 2;
      let paren = 1;
      for (; cursor < text.length; cursor += 1) {
        const ch = text[cursor];
        if (ch === '\\') {
          cursor += 1;
          continue;
        }
        if (ch === '(') paren += 1;
        else if (ch === ')') {
          paren -= 1;
          if (paren === 0) break;
        }
      }
      if (cursor >= text.length) return null;
      const inside = text.slice(end + 2, cursor).trim();
      const match = /^(\S+?)(?:\s+"([^"]*)")?$/.exec(inside);
      if (!match) return null;
      return { label, target: match[1].replace(/^<|>$/g, ''), title: match[2] || '', end: cursor + 1 };
    }

    function mdResolvePath(ctx, target) {
      const clean = String(target || '').split('#')[0].split('?')[0];
      if (!clean) return '';
      if (clean.startsWith('/')) return clean.slice(1);
      return joinPath(parentDir(ctx?.path || ''), clean.replace(/^\.\//, ''));
    }

    function renderInlineMd(text, keyPrefix, ctx) {
      const nodes = [];
      let buffer = '';
      let key = 0;
      const push = (node) => {
        if (buffer) {
          nodes.push(buffer);
          buffer = '';
        }
        nodes.push(node);
      };
      let index = 0;
      while (index < text.length) {
        const rest = text.slice(index);
        if (rest[0] === '\\' && /[\\`*_{}[\]()#+\-.!~|>]/.test(rest[1] || '')) {
          buffer += rest[1];
          index += 2;
          continue;
        }
        if (rest[0] === '`') {
          const run = /^`+/.exec(rest)[0];
          const close = text.indexOf(run, index + run.length);
          if (close > index) {
            push(h('code', { key: `c${key++}`, className: 'kb-md-code' }, text.slice(index + run.length, close).replace(/^ | $/g, '')));
            index = close + run.length;
            continue;
          }
        }
        if (rest.startsWith('![')) {
          const parsed = mdParseLinkAt(text, index + 1);
          if (parsed) {
            const source = /^(https?:|data:|blob:)/i.test(parsed.target)
              ? parsed.target
              : rawUrl(ctx?.libId, mdResolvePath(ctx, parsed.target));
            push(
              h('img', {
                key: `i${key++}`,
                className: 'kb-md-img',
                src: source,
                alt: parsed.label,
                loading: 'lazy',
                title: parsed.title || undefined,
              }),
            );
            index = parsed.end;
            continue;
          }
        }
        if (rest[0] === '[') {
          const parsed = mdParseLinkAt(text, index);
          if (parsed) {
            const external = /^(https?:|mailto:)/i.test(parsed.target);
            const chunk = renderInlineMd(parsed.label, `${keyPrefix}-l${key}`, ctx);
            if (external) {
              push(
                h(
                  'a',
                  { key: `a${key++}`, href: parsed.target, target: '_blank', rel: 'noreferrer', title: parsed.title || undefined },
                  ...chunk,
                ),
              );
            } else if (parsed.target.startsWith('#') || parsed.target.includes('.md')) {
              const targetPath = mdResolvePath(ctx, parsed.target);
              push(
                h(
                  'a',
                  {
                    key: `a${key++}`,
                    href: '#',
                    className: 'kb-md-internal',
                    title: targetPath || parsed.title || undefined,
                    onClick: (event) => {
                      event.preventDefault();
                      if (parsed.target.startsWith('#')) {
                        const id = mdSlug(parsed.target.slice(1));
                        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      } else if (ctx?.onOpenLink) {
                        ctx.onOpenLink(targetPath);
                      }
                    },
                  },
                  ...chunk,
                ),
              );
            } else {
              push(
                h(
                  'a',
                  { key: `a${key++}`, href: rawUrl(ctx?.libId, mdResolvePath(ctx, parsed.target)), target: '_blank', rel: 'noreferrer' },
                  ...chunk,
                ),
              );
            }
            index = parsed.end;
            continue;
          }
        }
        if (rest[0] === '<') {
          const auto = /^<((?:https?:\/\/|mailto:)[^>\s]+)>/.exec(rest);
          if (auto) {
            push(h('a', { key: `a${key++}`, href: auto[1], target: '_blank', rel: 'noreferrer' }, auto[1]));
            index += auto[0].length;
            continue;
          }
        }
        if (rest.startsWith('**') || rest.startsWith('__')) {
          const marker = rest.slice(0, 2);
          const close = text.indexOf(marker, index + 2);
          if (close > index + 2) {
            push(h('strong', { key: `s${key++}` }, ...renderInlineMd(text.slice(index + 2, close), `${keyPrefix}-s${key}`, ctx)));
            index = close + 2;
            continue;
          }
        }
        if (rest.startsWith('~~')) {
          const close = text.indexOf('~~', index + 2);
          if (close > index + 2) {
            push(h('del', { key: `d${key++}` }, ...renderInlineMd(text.slice(index + 2, close), `${keyPrefix}-d${key}`, ctx)));
            index = close + 2;
            continue;
          }
        }
        if (rest[0] === '*' || rest[0] === '_') {
          const marker = rest[0];
          const close = text.indexOf(marker, index + 1);
          if (close > index + 1 && !/\s/.test(text[index + 1])) {
            push(h('em', { key: `e${key++}` }, ...renderInlineMd(text.slice(index + 1, close), `${keyPrefix}-e${key}`, ctx)));
            index = close + 1;
            continue;
          }
        }
        if (/^https?:\/\/[^\s<>()]+/.test(rest) && (index === 0 || /[\s(（]/.test(text[index - 1]))) {
          const url = /^https?:\/\/[^\s<>()]+/.exec(rest)[0].replace(/[.,;:!?]+$/, '');
          push(h('a', { key: `a${key++}`, href: url, target: '_blank', rel: 'noreferrer' }, url));
          index += url.length;
          continue;
        }
        if (rest.startsWith('  \n')) {
          push(h('br', { key: `b${key++}` }));
          index += 3;
          continue;
        }
        if (rest[0] === '\n') {
          buffer += ' ';
          index += 1;
          continue;
        }
        buffer += rest[0];
        index += 1;
      }
      if (buffer) nodes.push(buffer);
      return nodes.map((node, nodeIndex) =>
        typeof node === 'string' ? node : React.cloneElement(node, { key: `${keyPrefix}-${nodeIndex}` }),
      );
    }

    function CopyButton({ text, label }) {
      const [copied, setCopied] = useState(false);
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(String(text ?? ''));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      };
      return h(
        'button',
        { type: 'button', className: 'kb-copy', onClick: copy, title: label || '复制' },
        h(Icon, { name: copied ? 'check' : 'copy', size: 13 }),
        copied ? '已复制' : label || '复制',
      );
    }

    function CodeBlock({ text, lang }) {
      const key = String(lang || '').toLowerCase();
      const label = CODE_LANG[key] || (lang ? lang : 'text');
      return h(
        'div',
        { className: 'kb-codeblock' },
        h(
          'div',
          { className: 'kb-codeblock-head' },
          h('span', { className: 'kb-codeblock-lang' }, label),
          h(CopyButton, { text, label: '复制代码' }),
        ),
        h('pre', { className: 'kb-codeblock-pre' }, h('code', null, ...highlightCode(text, lang))),
      );
    }

    function MarkdownView({ text, libId, path, onOpenLink }) {
      const blocks = useMemo(() => parseMarkdownDoc(text || ''), [text]);
      const ctx = { libId, path, onOpenLink };

      const renderBlocks = (list, prefix) =>
        list.map((block, index) => {
          const key = `${prefix}-${index}`;
          if (block.type === 'frontmatter') {
            return h(
              'div',
              { key, className: 'kb-fm' },
              block.entries.map((entry) =>
                h(
                  'div',
                  { key: entry.key, className: 'kb-fm-row' },
                  h('span', { className: 'kb-fm-key' }, entry.key),
                  h('span', { className: 'kb-fm-value' }, entry.value),
                ),
              ),
            );
          }
          if (block.type === 'heading') {
            const Tag = `h${block.level}`;
            return h(Tag, { key, id: mdSlug(block.text), className: `kb-md-h${block.level}` }, ...renderInlineMd(block.text, key, ctx));
          }
          if (block.type === 'code') {
            return h(CodeBlock, { key, text: block.text, lang: block.lang });
          }
          if (block.type === 'hr') return h('hr', { key, className: 'kb-md-hr' });
          if (block.type === 'quote') {
            return h('blockquote', { key, className: 'kb-md-quote' }, ...renderBlocks(block.blocks, `${key}-q`));
          }
          if (block.type === 'table') {
            return h(
              'div',
              { key, className: 'kb-table-wrap' },
              h(
                'table',
                { className: 'kb-table' },
                h(
                  'thead',
                  null,
                  h(
                    'tr',
                    null,
                    block.header.map((cell, cellIndex) =>
                      h('th', { key: cellIndex, style: block.align[cellIndex] ? { textAlign: block.align[cellIndex] } : undefined }, ...renderInlineMd(cell, `${key}-th-${cellIndex}`, ctx)),
                    ),
                  ),
                ),
                h(
                  'tbody',
                  null,
                  block.rows.map((row, rowIndex) =>
                    h(
                      'tr',
                      { key: rowIndex },
                      block.header.map((_, cellIndex) =>
                        h('td', { key: cellIndex, style: block.align[cellIndex] ? { textAlign: block.align[cellIndex] } : undefined }, ...renderInlineMd(row[cellIndex] ?? '', `${key}-td-${rowIndex}-${cellIndex}`, ctx)),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }
          if (block.type === 'list') {
            const Tag = block.ordered ? 'ol' : 'ul';
            return h(
              Tag,
              { key, className: 'kb-md-list', start: block.ordered && block.start > 1 ? block.start : undefined },
              block.items.map((item, itemIndex) =>
                h(
                  'li',
                  { key: itemIndex, className: item.checked !== null ? 'kb-md-task' : undefined },
                  item.checked !== null ? h('input', { type: 'checkbox', checked: item.checked, readOnly: true }) : null,
                  ...renderBlocks(item.blocks, `${key}-li-${itemIndex}`),
                ),
              ),
            );
          }
          return h('p', { key, className: 'kb-md-p' }, ...renderInlineMd(block.text, key, ctx));
        });

      return h('div', { className: 'kb-md' }, ...renderBlocks(blocks, 'md'));
    }

    function CodeView({ text, path }) {
      const [wrap, setWrap] = useState(false);
      const content = String(text ?? '');
      const lines = content ? content.split('\n') : [''];
      const tokens = useMemo(() => highlightCode(content, extOf(path)), [content, path]);
      return h(
        'div',
        { className: 'kb-codeview' },
        h(
          'div',
          { className: 'kb-codeview-head' },
          h('span', { className: 'kb-codeview-lang' }, languageOf(path)),
          h('span', { className: 'kb-codeview-meta' }, `${lines.length} 行`),
          h('span', { className: 'kb-spacer' }),
          h(IconButton, { icon: 'wrap', label: wrap ? '取消自动换行' : '自动换行', active: wrap, onClick: () => setWrap((value) => !value) }),
          h(CopyButton, { text: content, label: '复制全文' }),
        ),
        h(
          'div',
          { className: cx('kb-codeview-body', wrap && 'wrap') },
          h(
            'div',
            { className: 'kb-codeview-gutter', 'aria-hidden': 'true' },
            ...lines.map((_, index) => h('span', { key: index }, index + 1)),
          ),
          h('pre', { className: 'kb-codeview-pre' }, h('code', null, ...tokens)),
        ),
      );
    }

    function parseCsvRows(text, delimiter) {
      const rows = [];
      let row = [];
      let field = '';
      let quoted = false;
      const source = String(text ?? '');
      for (let index = 0; index < source.length; index += 1) {
        const ch = source[index];
        if (quoted) {
          if (ch === '"') {
            if (source[index + 1] === '"') {
              field += '"';
              index += 1;
            } else {
              quoted = false;
            }
          } else {
            field += ch;
          }
          continue;
        }
        if (ch === '"') {
          quoted = true;
          continue;
        }
        if (ch === delimiter) {
          row.push(field);
          field = '';
          continue;
        }
        if (ch === '\n') {
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
          continue;
        }
        if (ch === '\r') continue;
        field += ch;
      }
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      return rows;
    }

    function CsvView({ text, path }) {
      const [raw, setRaw] = useState(false);
      const delimiter = extOf(path) === 'tsv' ? '\t' : ',';
      const all = useMemo(() => parseCsvRows(text, delimiter), [text, delimiter]);
      const rows = all.slice(0, 300);
      const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
      return h(
        'div',
        { className: 'kb-dataview' },
        h(
          'div',
          { className: 'kb-dataview-head' },
          h('span', { className: 'kb-codeview-lang' }, `${all.length} 行 × ${columns} 列`),
          h('span', { className: 'kb-spacer' }),
          h(CopyButton, { text, label: '复制原文' }),
          h(IconButton, { icon: raw ? 'eye' : 'file-text', label: raw ? '表格预览' : '原文', active: raw, onClick: () => setRaw((value) => !value) }),
        ),
        raw
          ? h('pre', { className: 'kb-codeview-pre kb-csv-raw' }, h('code', null, text))
          : h(
              'div',
              { className: 'kb-table-wrap kb-dataview-body' },
              h(
                'table',
                { className: 'kb-table kb-csv-table' },
                h(
                  'thead',
                  null,
                  h('tr', null, h('th', { className: 'kb-csv-rownum' }, '#'), ...Array.from({ length: columns }, (_, index) => h('th', { key: index }, rows[0]?.[index] ?? ''))),
                ),
                h(
                  'tbody',
                  null,
                  ...rows.slice(1).map((row, rowIndex) =>
                    h(
                      'tr',
                      { key: rowIndex },
                      h('td', { className: 'kb-csv-rownum' }, rowIndex + 2),
                      ...Array.from({ length: columns }, (_, cellIndex) => h('td', { key: cellIndex }, row[cellIndex] ?? '')),
                    ),
                  ),
                ),
              ),
            ),
        all.length > rows.length ? h('div', { className: 'kb-preview-note' }, `只预览前 ${rows.length} 行，共 ${all.length} 行。`) : null,
      );
    }

    function ImageView({ libId, path, name }) {
      const [full, setFull] = useState(false);
      const source = rawUrl(libId, path);
      return h(
        'div',
        { className: 'kb-imageview' },
        h(
          'div',
          { className: 'kb-imageview-head' },
          h('span', { className: 'kb-codeview-lang' }, name || baseName(path)),
          h('span', { className: 'kb-spacer' }),
          h('a', { className: 'kb-iconbtn', href: source, target: '_blank', rel: 'noreferrer', title: '在新窗口打开原图' }, h(Icon, { name: 'external', size: 16 })),
        ),
        h(
          'div',
          { className: cx('kb-image-stage', full && 'full'), onClick: () => setFull((value) => !value), title: full ? '点击适应窗口' : '点击查看原始大小' },
          h('img', { src: source, alt: name || baseName(path), loading: 'lazy' }),
        ),
      );
    }

    function PdfView({ libId, path, name }) {
      const source = rawUrl(libId, path);
      return h(
        'div',
        { className: 'kb-pdfview' },
        h('iframe', { className: 'kb-pdf-frame', src: source, title: name || baseName(path) }),
        h(
          'div',
          { className: 'kb-preview-note' },
          '如果 PDF 没有显示，',
          h('a', { href: source, target: '_blank', rel: 'noreferrer' }, '在新窗口打开'),
          '。',
        ),
      );
    }

    function MediaView({ libId, path, kind, name }) {
      const source = rawUrl(libId, path);
      return h(
        'div',
        { className: 'kb-mediaview' },
        kind === 'video'
          ? h('video', { className: 'kb-media', src: source, controls: true, preload: 'metadata' })
          : h('audio', { className: 'kb-media', src: source, controls: true, preload: 'metadata' }),
        h('div', { className: 'kb-preview-note' }, name || baseName(path)),
      );
    }

    function BinaryView({ libId, path, file }) {
      return h(
        'div',
        { className: 'kb-empty kb-binary' },
        h(Icon, { name: 'file-text', size: 28 }),
        h('b', null, '暂不支持内联预览'),
        h('span', null, `${baseName(path)} · ${formatBytes(file?.size ?? 0)}`),
        h(
          'div',
          { className: 'kb-binary-actions' },
          h('a', { className: 'kb-btn', href: rawUrl(libId, path), target: '_blank', rel: 'noreferrer' }, '在窗口打开'),
          h('a', { className: 'kb-btn', href: rawUrl(libId, path, { download: true }) }, h(Icon, { name: 'download', size: 14 }), '下载'),
        ),
      );
    }

    function OfficeView({ libId, path, name }) {
      const [state, setState] = useState({ phase: 'loading' });
      const [sheet, setSheet] = useState(0);
      useEffect(() => {
        let alive = true;
        setState({ phase: 'loading' });
        setSheet(0);
        getJson(previewUrl(libId, path))
          .then((payload) => {
            if (alive) setState({ phase: 'ready', preview: payload });
          })
          .catch((cause) => {
            if (alive) setState({ phase: 'error', error: errorText(cause) });
          });
        return () => {
          alive = false;
        };
      }, [libId, path]);

      if (state.phase === 'loading') {
        return h(
          'div',
          { className: 'kb-office-loading' },
          h('div', { className: 'kb-spinner' }),
          h('span', null, '正在解析 Office 文档…'),
        );
      }
      if (state.phase === 'error') {
        return h('div', { className: 'kb-empty' }, h('b', null, '解析失败'), h('span', null, state.error));
      }
      const preview = state.preview || {};
      if (preview.kind === 'docx') {
        return h(
          'div',
          { className: 'kb-office' },
          h('div', { className: 'kb-preview-note' }, `Word 文档 · ${preview.paragraphs ?? 0} 个段落`),
          h('div', { className: 'kb-docx', dangerouslySetInnerHTML: { __html: preview.html || '' } }),
        );
      }
      if (preview.kind === 'xlsx') {
        const sheets = preview.sheets || [];
        const current = sheets[Math.min(sheet, sheets.length - 1)] || { rows: [], columns: 0 };
        const header = current.rows[0] || [];
        const body = current.rows.slice(1);
        return h(
          'div',
          { className: 'kb-office kb-sheetview' },
          sheets.length > 1
            ? h(
                'div',
                { className: 'kb-sheet-tabs' },
                ...sheets.map((item, index) =>
                  h(
                    'button',
                    {
                      key: item.name,
                      type: 'button',
                      className: cx('kb-sheet-tab', index === sheet && 'on'),
                      onClick: () => setSheet(index),
                    },
                    item.name,
                  ),
                ),
              )
            : null,
          h('div', { className: 'kb-preview-note' }, `表格 · ${current.rows.length} 行 × ${current.columns} 列${preview.truncated ? '（已截断预览）' : ''}`),
          h(
            'div',
            { className: 'kb-table-wrap kb-sheet-body' },
            h(
              'table',
              { className: 'kb-table kb-sheet-table' },
              h(
                'thead',
                null,
                h(
                  'tr',
                  null,
                  h('th', { className: 'kb-csv-rownum' }, '#'),
                  ...Array.from({ length: current.columns }, (_, index) => h('th', { key: index }, header[index] ?? '')),
                ),
              ),
              h(
                'tbody',
                null,
                ...body.map((row, rowIndex) =>
                  h(
                    'tr',
                    { key: rowIndex },
                    h('td', { className: 'kb-csv-rownum' }, rowIndex + 2),
                    ...Array.from({ length: current.columns }, (_, cellIndex) => h('td', { key: cellIndex }, row[cellIndex] ?? '')),
                  ),
                ),
              ),
            ),
          ),
        );
      }
      if (preview.kind === 'pptx') {
        return h(
          'div',
          { className: 'kb-office kb-slides' },
          ...(preview.slides || []).map((slide) =>
            h(
              'div',
              { key: slide.index, className: 'kb-slide' },
              h('div', { className: 'kb-slide-index' }, `第 ${slide.index} 页`),
              h('h3', { className: 'kb-slide-title' }, slide.title || '（无标题）'),
              ...(slide.lines || []).map((line, index) => h('p', { key: index, className: 'kb-slide-line' }, line)),
            ),
          ),
        );
      }
      return h(
        'div',
        { className: 'kb-empty' },
        h(Icon, { name: 'file-text', size: 26 }),
        h('b', null, '暂不支持这种 Office 格式'),
        h('span', null, preview.reason || `${name || baseName(path)} 需要安装 LibreOffice 或另存为新格式后才能预览。`),
      );
    }

    function FilePreview({ libId, path, file, onOpenLink }) {
      const ext = extOf(path);
      if (!file) return h(Skeleton, { lines: 6 });
      if (ext === 'md' || ext === 'markdown' || ext === 'mdx') {
        return h('div', { className: 'kb-md-wrap' }, h(MarkdownView, { text: file.content ?? '', libId, path, onOpenLink }));
      }
      if (IMAGE_EXT.has(ext)) return h(ImageView, { libId, path, name: baseName(path) });
      if (ext === 'pdf') return h(PdfView, { libId, path, name: baseName(path) });
      if (AUDIO_EXT.has(ext)) return h(MediaView, { libId, path, kind: 'audio', name: baseName(path) });
      if (VIDEO_EXT.has(ext)) return h(MediaView, { libId, path, kind: 'video', name: baseName(path) });
      if (OFFICE_EXT.has(ext)) return h(OfficeView, { libId, path, name: baseName(path) });
      if ((ext === 'csv' || ext === 'tsv') && typeof file.content === 'string') {
        return h(CsvView, { text: file.content, path });
      }
      if (typeof file.content === 'string' && !file.binary) {
        return h(CodeView, { text: file.content, path });
      }
      return h(BinaryView, { libId, path, file });
    }

    // ---------------------------------------------------------------- styles

    const STYLES = `
.kb-app{display:flex;flex-direction:column;height:100%;width:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1,#fff);font-family:var(--dsw-font-family,system-ui,-apple-system,"Segoe UI",sans-serif);font-size:var(--dsw-font-xxs-12-font-size,12px);line-height:var(--dsw-font-xxs-12-line-height,18px)}
.kb-head{display:flex;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.kb-title{font-size:var(--dsw-font-s-14-font-size,14px);font-weight:650;margin-right:2px}
.kb-sub{font-size:var(--dsw-font-xxs-12-font-size,12px);color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px}
.kb-spacer{flex:1}
.kb-btn{box-sizing:border-box;appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;font-size:var(--dsw-font-xxs-12-font-size,12px);line-height:1;cursor:pointer;white-space:nowrap;transition:background-color .12s,border-color .12s}
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
.kb-select{box-sizing:border-box;appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 26px 0 9px;height:28px;font-size:var(--dsw-font-xxs-12-font-size,12px);cursor:pointer;max-width:220px}
.kb-select:hover{border-color:var(--dsw-alias-border-l2)}
.kb-input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 9px;font-size:var(--dsw-font-xxs-12-font-size,12px);min-width:0;outline:none}
.kb-input:focus{border-color:var(--dsw-alias-brand-primary)}
.kb-chip{font-size:var(--dsw-font-xxxs-11-font-size,11px);padding:1px 7px;border-radius:99px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.kb-chip.ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.kb-chip.warn{color:var(--dsw-alias-state-warning-primary);border-color:var(--dsw-alias-state-warning-primary)}
.kb-chip.err{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
button.kb-chip{cursor:pointer}
button.kb-chip:disabled{opacity:.6;cursor:default}
.kb-body{display:flex;flex:1;min-height:0}
.kb-side{width:320px;min-width:240px;max-width:420px;display:flex;flex-direction:column;border-right:1px solid var(--dsw-alias-border-l1);min-height:0}
.kb-side-tools{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.kb-tree{flex:1;overflow:auto;padding:6px 8px 16px}
.kb-row{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:7px;cursor:pointer;font-size:var(--dsw-font-xs-13-font-size,13px);line-height:18px;user-select:none;color:var(--dsw-alias-label-primary)}
.kb-row:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-row.active{background:var(--dsw-alias-bg-layer-2);outline:1px solid var(--dsw-alias-border-l1)}
.kb-row .kb-caret{width:14px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:var(--dsw-font-xxxs-11-font-size,11px);flex:none}
.kb-chev{transform:rotate(90deg);transition:transform .12s ease}
.kb-chev-closed{transform:rotate(0deg);transition:transform .12s ease}
.kb-row .kb-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-row .kb-meta{font-size:var(--dsw-font-xxxs-11-font-size,11px);color:var(--dsw-alias-label-tertiary);flex:none}
.kb-row.dir .kb-name{font-weight:550}
.kb-main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.kb-file-head{display:flex;flex-direction:column;gap:8px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-file-top{display:flex;align-items:center;gap:8px;min-width:0}
.kb-file-path{font-size:var(--dsw-font-xxs-12-font-size,12px);color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-file-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.kb-content{flex:1;overflow:auto;padding:0;min-height:0}
.kb-md-wrap{padding:20px 24px 60px;box-sizing:border-box;min-height:100%}
.kb-editor{width:100%;height:100%;min-height:320px;resize:none;border:0;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:var(--dsw-font-xs-13-font-size,13px);line-height:1.7;padding:18px 22px;box-sizing:border-box}
.kb-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:var(--dsw-font-xs-13-font-size,13px);padding:40px}
.kb-empty b{color:var(--dsw-alias-label-primary);font-size:var(--dsw-font-s-14-font-size,14px)}
.kb-md{font-size:var(--dsw-font-xs-13-font-size,13px);line-height:1.75;max-width:860px}
.kb-md-p{margin:0 0 10px}
.kb-md-h1{font-size:var(--dsw-font-l-20-font-size,20px);margin:18px 0 10px}
.kb-md-h2{font-size:var(--dsw-font-m-18-font-size,18px);margin:16px 0 8px}
.kb-md-h3{font-size:var(--dsw-font-s-14-font-size,14px);margin:14px 0 6px}
.kb-md-h4,.kb-md-h5,.kb-md-h6{font-size:var(--dsw-font-xs-13-font-size,13px);margin:12px 0 6px;color:var(--dsw-alias-label-secondary)}
.kb-md-code{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:0 4px;font-size:var(--dsw-font-xxs-12-font-size,12px)}
.kb-md-pre{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;overflow:auto;font-size:var(--dsw-font-xxs-12-font-size,12px);line-height:1.6;margin:0 0 12px}
.kb-md-list{margin:0 0 10px;padding-left:20px}
.kb-md-quote{margin:0 0 10px;padding:2px 12px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.kb-md-hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:14px 0}
.kb-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:7px 12px;font-size:var(--dsw-font-xxs-12-font-size,12px);box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:70%;z-index:30}
.kb-toast.err{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.kb-toast.ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}
.kb-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:120}
.kb-dialog{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:18px;width:520px;max-width:calc(100vw - 60px);box-shadow:0 18px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:10px}
.kb-dialog h3{margin:0 0 4px;font-size:var(--dsw-font-s-14-font-size,14px)}
.kb-field{display:flex;flex-direction:column;gap:4px;font-size:var(--dsw-font-xxs-12-font-size,12px);color:var(--dsw-alias-label-secondary)}
.kb-field .kb-input{width:100%}
.kb-hint{font-size:var(--dsw-font-xxxs-11-font-size,11px);color:var(--dsw-alias-label-tertiary)}
.kb-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
.kb-dialog-error{font-size:var(--dsw-font-xxs-12-font-size,12px);color:var(--dsw-alias-state-error-primary)}
.kb-search{position:relative;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-search .kb-input{width:100%}
.kb-hits{max-height:260px;overflow:auto;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-hit{padding:7px 12px;cursor:pointer;font-size:var(--dsw-font-xxs-12-font-size,12px);border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-hit:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-hit .kb-hit-name{color:var(--dsw-alias-label-primary)}
.kb-hit .kb-hit-snippet{color:var(--dsw-alias-label-tertiary);font-size:var(--dsw-font-xxxs-11-font-size,11px);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-skeleton{display:flex;flex-direction:column;gap:8px;padding:18px}
.kb-skeleton span{height:11px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);display:block}
.kb-spinner{width:22px;height:22px;border-radius:50%;border:2px solid var(--dsw-alias-border-l1);border-top-color:var(--dsw-alias-brand-primary);animation:kb-spin .8s linear infinite}
.kb-spinner-sm{width:13px;height:13px;border-width:1.5px}
@keyframes kb-spin{to{transform:rotate(360deg)}}
.kb-tree-skeleton{display:flex;flex-direction:column;gap:6px;padding:8px 6px}
.kb-tree-skeleton i{display:block;height:22px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);opacity:.7;animation:kb-pulse 1.4s ease-in-out infinite}
@keyframes kb-pulse{0%,100%{opacity:.45}50%{opacity:.8}}
.kb-msg-save{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:6px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:var(--dsw-font-xxxs-11-font-size,11px);cursor:pointer;white-space:nowrap}
.kb-msg-save:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.kb-msg-save:disabled{opacity:.45;cursor:default}
.kb-receipt{position:fixed;right:22px;bottom:22px;z-index:200;display:flex;align-items:center;gap:10px;max-width:420px;padding:9px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);box-shadow:0 10px 30px rgba(0,0,0,.28);font-size:var(--dsw-font-xxs-12-font-size,12px);color:var(--dsw-alias-label-primary)}
.kb-receipt .kb-receipt-path{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:230px}
.kb-receipt .kb-btn{padding:0 8px;height:24px;font-size:var(--dsw-font-xxxs-11-font-size,11px)}
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
.kb-ctx-item{display:flex;align-items:center;gap:9px;height:30px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font-size:var(--dsw-font-xs-13-font-size,13px);cursor:pointer;text-align:left;white-space:nowrap}
.kb-ctx-item:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-ctx-item .kb-ctx-icon{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.kb-ctx-sep{height:1px;background:var(--dsw-alias-border-l1);margin:4px 6px}
.kb-crumbs{display:flex;align-items:center;gap:2px;font-size:var(--dsw-font-xxs-12-font-size,12px);color:var(--dsw-alias-label-secondary);flex-wrap:wrap;min-width:0}
.kb-crumb{border:0;background:transparent;color:inherit;font:inherit;font-size:var(--dsw-font-xxs-12-font-size,12px);padding:2px 5px;border-radius:5px;cursor:pointer;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-crumb:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.kb-crumb:last-child{color:var(--dsw-alias-label-primary);font-weight:550}
.kb-pane{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.kb-pane-head{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;flex-wrap:wrap}
.kb-pane-body{flex:1;overflow:auto;min-height:0;padding:6px 8px 20px}
.kb-pane-doc{padding:0;overflow:auto;flex:1;min-height:0}
.kb-doc-pad{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;padding:8px;overflow:auto}
.kb-pane-doc .kb-md{font-size:var(--dsw-font-xs-13-font-size,13px);max-width:none;line-height:1.72}
.kb-pane-doc .kb-md-wrap{padding:0 0 32px;min-height:0}
.kb-pane-doc .kb-md-h1{font-size:19px;margin-top:14px}
.kb-pane-doc .kb-md-h2{font-size:17px;margin-top:18px}
.kb-pane-doc .kb-md-h3{font-size:15px;margin-top:16px}
.kb-pane-doc .kb-md-p{margin-bottom:11px}
.kb-pane-doc .kb-md-list{margin-bottom:11px}
.kb-pane-doc .kb-codeblock,.kb-pane-doc .kb-table-wrap{margin-bottom:12px}
.kb-file-item{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;font-size:var(--dsw-font-xs-13-font-size,13px);cursor:pointer;color:var(--dsw-alias-label-primary)}
.kb-file-item:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-file-item .kb-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-file-item .kb-meta{font-size:var(--dsw-font-xxxs-11-font-size,11px);color:var(--dsw-alias-label-tertiary);flex:none}
@media (max-width: 860px){.kb-side{width:240px;min-width:200px}}

/* ---- preview: markdown / code / table / office ---- */
.kb-md{font-size:var(--dsw-font-s-14-font-size,14px);line-height:1.78;max-width:920px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.kb-md-p{margin:0 0 14px}
.kb-md-h1,.kb-md-h2,.kb-md-h3,.kb-md-h4,.kb-md-h5,.kb-md-h6{color:var(--dsw-alias-label-primary);font-weight:650;line-height:1.35;margin:26px 0 12px}
.kb-md-h1{font-size:var(--dsw-font-xl-24-font-size,24px);padding-bottom:8px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-md-h2{font-size:var(--dsw-font-l-20-font-size,20px);padding-bottom:6px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-md-h3{font-size:var(--dsw-font-m-18-font-size,18px)}
.kb-md-h4{font-size:var(--dsw-font-s-14-font-size,15px)}
.kb-md-h5,.kb-md-h6{font-size:var(--dsw-font-xs-13-font-size,13px);color:var(--dsw-alias-label-secondary)}
.kb-md a{color:var(--dsw-alias-brand-primary);text-decoration:none}
.kb-md a:hover{text-decoration:underline}
.kb-md strong{font-weight:650}
.kb-md ul,.kb-md ol{margin:0 0 14px;padding-left:26px}
.kb-md li{margin:4px 0}
.kb-md li>p{margin:0 0 6px}
.kb-md li>ul,.kb-md li>ol{margin:4px 0}
.kb-md .kb-md-task{list-style:none;margin-left:-22px}
.kb-md .kb-md-task input{margin:0 8px 0 0;vertical-align:-1px}
.kb-md blockquote{margin:0 0 14px;padding:2px 16px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}
.kb-md blockquote .kb-md-p:last-child{margin-bottom:0}
.kb-md hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:22px 0}
.kb-md .kb-md-code{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 5px;font-size:.88em;font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace)}
.kb-md .kb-md-img{display:block;max-width:100%;height:auto;margin:10px 0;border-radius:8px;border:1px solid var(--dsw-alias-border-l1)}
.kb-table-wrap{overflow:auto;margin:0 0 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;max-width:100%}
.kb-table{border-collapse:separate;border-spacing:0;width:100%;font-size:var(--dsw-font-xs-13-font-size,13px);line-height:1.6}
.kb-table th,.kb-table td{padding:7px 11px;border-bottom:1px solid var(--dsw-alias-border-l1);border-right:1px solid var(--dsw-alias-border-l1);text-align:left;vertical-align:top}
.kb-table th:last-child,.kb-table td:last-child{border-right:0}
.kb-table tbody tr:last-child td{border-bottom:0}
.kb-table th{background:var(--dsw-alias-bg-layer-2);font-weight:600;position:sticky;top:0;z-index:1}
.kb-table tbody tr:hover td{background:var(--dsw-alias-bg-layer-1)}
.kb-fm{display:flex;flex-direction:column;gap:2px;margin:0 0 18px;padding:10px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:var(--dsw-font-xxs-12-font-size,12px)}
.kb-fm-row{display:flex;gap:12px}
.kb-fm-key{min-width:96px;color:var(--dsw-alias-label-tertiary)}
.kb-fm-value{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.kb-codeblock{margin:0 0 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.kb-codeblock-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);font-size:var(--dsw-font-xxs-12-font-size,11px);color:var(--dsw-alias-label-tertiary)}
.kb-codeblock-lang{letter-spacing:.02em;opacity:.85}
.kb-codeblock-pre{margin:0;padding:12px 14px;overflow:auto;background:var(--dsw-alias-bg-layer-1);font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:var(--dsw-font-xxs-12-font-size,12px);line-height:1.65;tab-size:2}
.kb-copy{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11.5px;cursor:pointer;white-space:nowrap}
.kb-copy:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.kb-codeview{display:flex;flex-direction:column;height:100%;min-height:0}
.kb-codeview-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.kb-codeview-lang{font-size:var(--dsw-font-xxs-12-font-size,11px);letter-spacing:.03em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.kb-codeview-meta{font-size:var(--dsw-font-xxs-12-font-size,11px);color:var(--dsw-alias-label-tertiary)}
.kb-codeview-body{flex:1;min-height:0;display:flex;overflow:auto;background:var(--dsw-alias-bg-layer-1);font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:var(--dsw-font-xxs-12-font-size,12px);line-height:19.5px}
.kb-codeview-gutter{position:sticky;left:0;z-index:1;flex:none;padding:12px 8px 24px 12px;text-align:right;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-1);border-right:1px solid var(--dsw-alias-border-l1);user-select:none;font-variant-numeric:tabular-nums}
.kb-codeview-gutter span{display:block;line-height:19.5px}
.kb-codeview-pre{flex:1;min-width:0;margin:0;padding:12px 18px 24px 14px;white-space:pre;tab-size:2}
.kb-codeview-body.wrap .kb-codeview-pre{white-space:pre-wrap;overflow-wrap:anywhere}
.kb-dataview{display:flex;flex-direction:column;height:100%;min-height:0}
.kb-dataview-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.kb-dataview-body{flex:1;min-height:0;margin:0;border:0;border-radius:0}
.kb-csv-raw{flex:1;min-height:0;overflow:auto;white-space:pre;padding:12px 16px}
.kb-csv-rownum{width:42px;min-width:42px;text-align:right;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);font-variant-numeric:tabular-nums;user-select:none}
.kb-sheet-table td{white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}
.kb-imageview{display:flex;flex-direction:column;height:100%;min-height:0}
.kb-imageview-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.kb-image-stage{flex:1;min-height:0;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:18px;cursor:zoom-in;background:var(--dsw-alias-bg-layer-1)}
.kb-image-stage.full{cursor:zoom-out;align-items:flex-start;justify-content:flex-start}
.kb-image-stage img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.kb-image-stage.full img{max-width:none;max-height:none}
.kb-pdfview{display:flex;flex-direction:column;height:100%;min-height:0}
.kb-pdf-frame{flex:1;min-height:0;width:100%;border:0;background:var(--dsw-alias-bg-layer-2)}
.kb-pdfview .kb-preview-note{flex:none;padding:6px 12px;border-top:1px solid var(--dsw-alias-border-l1)}
.kb-mediaview{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;height:100%;padding:24px}
.kb-media{max-width:100%;max-height:70vh;border-radius:8px;background:#000}
.kb-preview-note{padding:8px 14px;font-size:var(--dsw-font-xxs-12-font-size,11px);color:var(--dsw-alias-label-tertiary);border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.kb-office{height:100%;overflow:auto;padding:18px 22px 60px;box-sizing:border-box;display:flex;flex-direction:column}
.kb-office .kb-preview-note{margin:-18px -22px 14px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-office-loading{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.kb-docx{max-width:900px;font-size:var(--dsw-font-s-14-font-size,14px);line-height:1.85;color:var(--dsw-alias-label-primary)}
.kb-docx p{margin:0 0 12px}
.kb-docx h1,.kb-docx h2,.kb-docx h3,.kb-docx h4,.kb-docx h5,.kb-docx h6{margin:22px 0 10px;font-weight:650;line-height:1.4}
.kb-docx h1{font-size:22px}.kb-docx h2{font-size:19px}.kb-docx h3{font-size:17px}.kb-docx h4{font-size:15px}.kb-docx h5,.kb-docx h6{font-size:14px}
.kb-docx .kb-docx-li{display:flex;gap:8px;margin:0 0 8px;padding-left:8px}
.kb-docx .kb-docx-bullet{color:var(--dsw-alias-label-tertiary)}
.kb-docx .kb-docx-table{border-collapse:collapse;margin:10px 0 18px;font-size:var(--dsw-font-xs-13-font-size,13px)}
.kb-docx .kb-docx-table td{border:1px solid var(--dsw-alias-border-l2);padding:6px 10px;vertical-align:top}
.kb-docx .kb-docx-table tr:first-child td{background:var(--dsw-alias-bg-layer-2);font-weight:600}
.kb-sheetview{padding:0;gap:0}
.kb-sheetview .kb-preview-note{margin:0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-sheet-tabs{display:flex;gap:2px;padding:8px 12px 0;overflow:auto;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1)}
.kb-sheet-tab{height:30px;padding:0 12px;border:1px solid transparent;border-bottom:0;border-radius:8px 8px 0 0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;white-space:nowrap}
.kb-sheet-tab:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-sheet-tab.on{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);font-weight:600}
.kb-sheet-body{flex:1;min-height:0;margin:0;border:0;border-radius:0}
.kb-slides{padding:18px 22px 60px;gap:14px}
.kb-slide{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:16px 18px;background:var(--dsw-alias-bg-layer-1)}
.kb-slide-index{font-size:11px;color:var(--dsw-alias-label-tertiary);letter-spacing:.04em}
.kb-slide-title{margin:6px 0 10px;font-size:17px;font-weight:650}
.kb-slide-line{margin:0 0 6px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.7}
.kb-binary-actions{display:flex;gap:8px;margin-top:6px}

/* ---- syntax highlighting ---- */
.kb-hl-keyword{color:var(--dsw-alias-brand-primary)}
.kb-hl-string{color:var(--dsw-alias-state-success-primary,#2ea043)}
.kb-hl-number{color:var(--dsw-alias-state-warning-primary,#d29922)}
.kb-hl-comment{color:var(--dsw-alias-label-tertiary);font-style:italic}
.kb-hl-tag{color:var(--dsw-alias-state-error-primary,#e5534b)}
.kb-hl-attr{color:var(--dsw-alias-state-warning-primary,#d29922)}
.kb-hl-prop{color:var(--dsw-alias-label-primary);font-weight:550}
.kb-hl-func{color:var(--dsw-alias-brand-primary)}
.kb-hl-variable{color:var(--dsw-alias-state-warning-primary,#d29922)}
.kb-hl-decorator{color:var(--dsw-alias-state-warning-primary,#d29922)}
.kb-hl-flag{color:var(--dsw-alias-state-success-primary,#2ea043)}
.kb-hl-punct{color:var(--dsw-alias-label-tertiary)}

/* ---- markdown polish ---- */
.kb-md a{text-underline-offset:2px}
.kb-md a[target="_blank"]::after{content:"↗";font-size:.75em;margin-left:2px;opacity:.6;text-decoration:none}
.kb-md-internal{color:var(--dsw-alias-brand-primary)}
.kb-md blockquote{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 55%,transparent);border-radius:0 6px 6px 0}
.kb-md input[type="checkbox"]{accent-color:var(--dsw-alias-brand-primary);width:13px;height:13px}
.kb-table tbody tr:nth-child(even) td{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 45%,transparent)}
.kb-table tbody tr:hover td{background:var(--dsw-alias-bg-layer-2)}
.kb-table th{white-space:nowrap}
.kb-table td{min-width:56px}
.kb-pane-doc .kb-table{font-size:12px}
.kb-pane-doc .kb-table th,.kb-pane-doc .kb-table td{padding:5px 8px}
.kb-pane-doc .kb-codeblock-pre{font-size:11.5px;padding:10px 12px}
.kb-pane-doc .kb-md .kb-md-img{border-radius:6px}
.kb-tab-icon{flex:none;display:block;align-self:center;margin-right:4px;color:var(--dsw-alias-label-secondary)}
.kb-tree-row{padding-top:5px;padding-bottom:5px}
.kb-tree-row .kb-caret{width:14px;flex:none;color:var(--dsw-alias-label-tertiary)}
.kb-tree-row:hover{background:var(--dsw-alias-bg-layer-2)}
.kb-tree-row .kb-name{font-size:12.5px}
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
      return h('div', { className: cx('kb-toast', notice.kind === 'error' && 'err', notice.kind === 'ok' && 'ok') }, notice.text);
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
      const [parent, setParent] = useState('');
      const [folder, setFolder] = useState('');
      const [remote, setRemote] = useState('');
      const [git, setGit] = useState(true);
      const [adopt, setAdopt] = useState(false);
      const [mergeUnrelated, setMergeUnrelated] = useState(false);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [cred, setCred] = useState(null);
      const [token, setToken] = useState('');
      const [tokenBusy, setTokenBusy] = useState(false);

      const remoteText = remote.trim();
      const isHttp = /^https?:\/\//i.test(remoteText);
      const isSsh = /^(ssh:\/\/|git@|[a-z0-9_-]+@[^:]+:)/i.test(remoteText) && !isHttp;
      const lastSegment = (value) => value.split(/[\\/]/).filter(Boolean).pop() ?? '';
      const dirName = useMemo(
        () => folder.trim() || lastSegment(remoteText).replace(/\.git$/i, ''),
        [folder, remoteText],
      );
      const sep = parent.trim().endsWith('/') || parent.trim().endsWith('\\') ? '' : '/';
      const preview = parent.trim() && dirName ? `${parent.trim()}${sep}${dirName}` : '';

      useEffect(() => {
        if (!isHttp) {
          setCred(null);
          return;
        }
        let alive = true;
        const timer = setTimeout(async () => {
          try {
            const payload = await getJson(`/api/kb/credentials?remote=${encodeURIComponent(remoteText)}`);
            if (alive) setCred(payload);
          } catch {
            if (alive) setCred(null);
          }
        }, 400);
        return () => {
          alive = false;
          clearTimeout(timer);
        };
      }, [remoteText, isHttp]);

      const pick = async () => {
        if (!uiWorkspace?.pickDirectory) {
          setError('当前环境没有目录选择器，请手填本地目录。');
          return;
        }
        try {
          const picked = await uiWorkspace.pickDirectory();
          if (picked) {
            setParent(picked);
            if (!name) setName(baseName(picked) || '知识库');
          }
        } catch (cause) {
          setError(errorText(cause));
        }
      };

      const saveToken = async () => {
        if (!token.trim()) {
          setError('先把访问令牌粘进来。');
          return;
        }
        setTokenBusy(true);
        setError('');
        try {
          const payload = await postJson('/api/kb/credentials', { remote: remoteText, token: token.trim() });
          setCred({ ...(cred ?? {}), token: payload.token, remote: payload.remote ?? cred?.remote, probe: payload.probe });
          setToken('');
        } catch (cause) {
          setError(errorText(cause));
        } finally {
          setTokenBusy(false);
        }
      };

      const submit = async () => {
        if (!parent.trim()) {
          setError('先选一个本地父目录。');
          return;
        }
        setBusy(true);
        setError('');
        try {
          const result = await postJson('/api/kb/libraries', {
            name: name.trim() || undefined,
            parent: parent.trim(),
            folder: folder.trim() || undefined,
            remote: remoteText,
            git,
            adopt,
            mergeUnrelated,
          });
          onCreated?.(result);
        } catch (cause) {
          setError(errorText(cause));
        } finally {
          setBusy(false);
        }
      };

      const tokenConfigured = cred?.token?.configured === true;
      const systemReady = cred?.system?.available === true;

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
            placeholder: dirName ? `默认：${dirName}` : '例如：工作笔记',
            onChange: (event) => setName(event.target.value),
            autoFocus: true,
          }),
        ),
        h(
          'label',
          { className: 'kb-field' },
          '本地父目录',
          h(
            'div',
            { style: { display: 'flex', gap: '6px' } },
            h('input', {
              className: 'kb-input',
              value: parent,
              placeholder: '~/notes',
              onChange: (event) => setParent(event.target.value),
            }),
            h('button', { className: 'kb-btn', onClick: pick, type: 'button' }, '选择…'),
          ),
          h('span', { className: 'kb-hint' }, '知识库会建在这个目录下的「仓库名」文件夹里，不用自己先建目录。'),
        ),
        h(
          'label',
          { className: 'kb-field' },
          '目录名（可选）',
          h('input', {
            className: 'kb-input',
            value: folder,
            placeholder: dirName || '取自仓库名',
            onChange: (event) => setFolder(event.target.value),
          }),
          preview ? h('span', { className: 'kb-hint' }, `将创建：${preview}`) : null,
        ),
        h(
          'label',
          { className: 'kb-field' },
          '云端 Git 仓库（可选）',
          h('input', {
            className: 'kb-input',
            value: remote,
            placeholder: 'https://github.com/me/notes.git',
            onChange: (event) => setRemote(event.target.value),
          }),
          h(
            'span',
            { className: 'kb-hint' },
            isSsh
              ? 'SSH 地址走本机 ssh 配置，不需要令牌。'
              : '留空则只用本地 Git；填了地址会自动拉取已有内容，或把本地库首推到远端。',
          ),
        ),
        isHttp && cred
          ? h(
              'div',
              { style: { display: 'grid', gap: '6px' } },
              h(
                'span',
                { className: cx('kb-chip', tokenConfigured || systemReady ? 'ok' : 'warn') },
                tokenConfigured
                  ? `令牌已保存（${cred.token?.masked ?? '已配置'}）`
                  : systemReady
                    ? `将使用系统 Git 凭据${cred.system?.username ? `（${cred.system.username}）` : ''}`
                    : '还没有这个仓库的访问令牌',
              ),
              !tokenConfigured
                ? h(
                    'div',
                    { style: { display: 'flex', gap: '6px' } },
                    h('input', {
                      className: 'kb-input',
                      type: 'password',
                      value: token,
                      placeholder: '粘贴访问令牌（保存后不回显）',
                      onChange: (event) => setToken(event.target.value),
                    }),
                    h(
                      'button',
                      { className: 'kb-btn', onClick: saveToken, type: 'button', disabled: tokenBusy || busy },
                      tokenBusy ? '验证中…' : '保存令牌',
                    ),
                  )
                : null,
              h(
                'span',
                { className: 'kb-hint' },
                cred.token?.hint ?? '',
                cred.remote?.tokenUrl
                  ? h(
                      'a',
                      { href: cred.remote.tokenUrl, target: '_blank', rel: 'noreferrer', style: { marginLeft: '6px' } },
                      '去创建令牌',
                    )
                  : null,
              ),
            )
          : null,
        h(
          'label',
          { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' } },
          h('input', { type: 'checkbox', checked: git, onChange: (event) => setGit(event.target.checked) }),
          '用 Git 管理版本（推荐）',
        ),
        h(
          'details',
          { style: { fontSize: '12px', color: 'var(--dsh-text-3, #888)' } },
          h('summary', { style: { cursor: 'pointer' } }, '高级选项'),
          h(
            'label',
            { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' } },
            h('input', { type: 'checkbox', checked: adopt, onChange: (event) => setAdopt(event.target.checked) }),
            '目录已存在且非空时接管它（不删文件）',
          ),
          h(
            'label',
            { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' } },
            h('input', {
              type: 'checkbox',
              checked: mergeUnrelated,
              onChange: (event) => setMergeUnrelated(event.target.checked),
            }),
            '允许合并与本地无关的远端历史',
          ),
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

    function RemoveLibraryDialog({ library, onClose, onRemoved }) {
      const [deleteFiles, setDeleteFiles] = useState(false);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');

      const submit = async () => {
        setBusy(true);
        setError('');
        try {
          const payload = await postJson('/api/kb/libraries/remove', {
            id: library?.id,
            deleteFiles,
          });
          onRemoved?.(payload);
        } catch (cause) {
          setError(errorText(cause));
        } finally {
          setBusy(false);
        }
      };

      return h(
        Modal,
        { title: '删除知识库', onClose: busy ? undefined : onClose },
        h(
          'div',
          { className: 'kb-field' },
          h('span', { className: 'kb-name' }, library?.name || library?.id || ''),
          h('span', { className: 'kb-hint' }, library?.root ?? ''),
        ),
        h(
          'span',
          { className: 'kb-hint' },
          '默认只从列表里移除：文件夹、.kb/ 和 Git 历史都原样保留，之后还能再添加回来。',
        ),
        h(
          'label',
          { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' } },
          h('input', {
            type: 'checkbox',
            checked: deleteFiles,
            onChange: (event) => setDeleteFiles(event.target.checked),
          }),
          '同时删除本地文件夹（不可恢复，也不进 .kb/trash）',
        ),
        error ? h('div', { className: 'kb-dialog-error' }, error) : null,
        h(
          'div',
          { className: 'kb-dialog-actions' },
          h('button', { className: 'kb-btn ghost', onClick: onClose, disabled: busy, type: 'button' }, '取消'),
          h(
            'button',
            { className: 'kb-btn danger', onClick: submit, disabled: busy, type: 'button' },
            busy ? '删除中…' : deleteFiles ? '删除库和文件' : '从列表移除',
          ),
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
      const [busyKey, setBusyKey] = useState(null);
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

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      /** 统一忙态：至少显示 minMs，避免"一闪而过"看不出反馈。 */
      const runBusy = async (key, minMs, task) => {
        if (busyKey) return undefined;
        setBusyKey(key);
        const started = Date.now();
        try {
          return await task();
        } finally {
          const rest = minMs - (Date.now() - started);
          if (rest > 0) await sleep(rest);
          setBusyKey(null);
        }
      };

      const syncNow = () =>
        runBusy('sync', 900, async () => {
          try {
            const payload = await postJson('/api/kb/git', { lib: activeId, action: 'sync' });
            if (payload.ok === false) {
              const stage = { probe: '连接远端', fetch: '拉取', merge: '合并', diverge: '合并', push: '推送' }[payload.stage] ?? '同步';
              notify(`${stage}失败：${payload.message ?? payload.code}`, 'error');
            } else {
              const count = payload.committedCount ?? 0;
              if (payload.merged && count) notify(`已同步 · 合并了远端更新，并提交 ${count} 项改动`, 'ok');
              else if (payload.merged) notify('已同步 · 已拉取远端更新', 'ok');
              else if (count) notify(`已同步 · 已提交 ${count} 项改动`, 'ok');
              else notify('已是最新', 'ok');
            }
            await loadLibraries();
            loadGit(activeId);
          } catch (cause) {
            notify(errorText(cause), 'error');
          }
        });

      const refreshAll = () =>
        runBusy('refresh', 400, async () => {
          await loadLibraries();
          if (activeId) await loadTree(activeId, '');
        });

      /** 本地库已建好、云端还没初始化（首推失败或当时没联网）时的补救入口。 */
      const bootstrapRemote = () =>
        runBusy('bootstrap', 900, async () => {
          try {
            const payload = await postJson('/api/kb/libraries/bootstrap', { lib: activeId });
            if (payload.ok === false) {
              const stage = { probe: '连接远端', fetch: '拉取', merge: '合并', push: '推送' }[payload.stage] ?? '初始化';
              notify(`${stage}失败：${payload.message ?? payload.code}`, 'error');
            } else {
              notify(payload.warning ? `已推到云端。${payload.warning}` : '已推到云端', 'ok');
            }
            await loadLibraries();
            loadGit(activeId);
          } catch (cause) {
            notify(errorText(cause), 'error');
          }
        });

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
        active?.git?.needsPush
          ? h(
              'button',
              {
                className: 'kb-chip warn',
                type: 'button',
                title: '本地提交还没推到云端，点一下初始化远端',
                disabled: busyKey === 'bootstrap',
                onClick: bootstrapRemote,
              },
              busyKey === 'bootstrap' ? '推送中…' : '云端未初始化',
            )
          : null,
        h('span', { className: 'kb-spacer' }),
        h(
          'div',
          { className: 'kb-actions' },
          h(IconButton, { icon: 'plus', label: '新建知识库', tone: 'green', onClick: newLibrary }),
          h(IconButton, {
            icon: 'refresh',
            label: '刷新目录与 Git 状态',
            tone: 'blue',
            busy: busyKey === 'refresh',
            onClick: refreshAll,
          }),
          status?.remote
            ? h(IconButton, {
                icon: 'sync',
                label: '与远端同步（提交 → 拉取合并 → 推送）',
                tone: 'teal',
                busy: busyKey === 'sync',
                disabled: !active || !status?.repo,
                onClick: syncNow,
              })
            : null,
          h('span', { className: 'kb-divider' }),
          h(IconButton, {
            icon: 'trash',
            label: active ? `删除知识库「${active.name}」` : '删除知识库',
            danger: true,
            disabled: !active,
            onClick: () => setDialog({ type: 'remove' }),
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
                        busy,
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
                  ? h(FilePreview, { libId: activeId, path: opened.path, file: opened, onOpenLink: openFile })
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
                    : h(FilePreview, { libId: activeId, path: opened.path, file: opened, onOpenLink: openFile }),
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
              onCreated: async (result) => {
                setDialog(null);
                const payload = await loadLibraries();
                if (payload?.libraries?.length) setActiveId(payload.libraries[payload.libraries.length - 1].id);
                const notes = [];
                let tone;
                if (result?.target?.dirChanged) notes.push(`目录名整理为「${result.target.dir}」`);
                if (result?.bootstrap && result.bootstrap.ok === false) {
                  notes.push(`本地库已建好，但云端还没初始化：${result.bootstrap.message ?? result.bootstrap.code}。之后点顶部的「云端未初始化」可以补推`);
                  tone = 'error';
                } else if (result?.bootstrap?.warning) {
                  notes.push(result.bootstrap.warning);
                }
                notify(notes.length ? `知识库已创建。${notes.join('；')}` : '知识库已创建', tone);
                if (result?.library?.id) loadGit(result.library.id);
              },
            })
          : dialog?.type === 'remove'
            ? h(RemoveLibraryDialog, {
                library: active,
                onClose: () => setDialog(null),
                onRemoved: async (payload) => {
                  setDialog(null);
                  const next = await loadLibraries();
                  const remaining = next?.libraries ?? [];
                  setActiveId(remaining[0]?.id ?? null);
                  notify(payload?.deleted ? '知识库和本地文件已删除' : '知识库已从列表移除');
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

    // 右栏「知识库」页：库 -> 目录树 -> 文件，目录在当前页展开。
    // 记住上次展开状态与目录缓存：切走标签页、组件被卸载后回来仍停在同一处。
    const kbPaneMemory = { libId: '', tree: {}, expanded: new Set() };

    function libraryAbsolutePath(root, rel) {
      const base = String(root || '').replaceAll('\\', '/').replace(/\/+$/, '');
      const clean = String(rel || '').replaceAll('\\', '/').replace(/^\.?\/+/, '');
      return clean ? `${base}/${clean}` : base;
    }

    // 与 DSH 的 workspace-path 语法一致：\ -> /，逐段编码、保留 ':'。
    function sessionFileAddress(sessionId, absolutePath) {
      const normalized = String(absolutePath || '').replaceAll('\\', '/').replace(/^\.\//, '');
      const encoded = normalized
        .split('/')
        .map((segment) => encodeURIComponent(segment).replace(/%3A/gi, ':'))
        .join('/');
      return `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${encoded}`;
    }

    function KbBrowserPane(props) {
      const sessionId = props?.sessionId;
      const [libraries, setLibraries] = useState([]);
      const [libId, setLibId] = useState(kbPaneMemory.libId || '');
      const [tree, setTree] = useState(kbPaneMemory.tree || {});
      const [expanded, setExpanded] = useState(new Set(kbPaneMemory.expanded || []));
      const [booting, setBooting] = useState(true);
      const [loadingRoot, setLoadingRoot] = useState(false);
      const [error, setError] = useState('');

      const active = useMemo(() => libraries.find((row) => row.id === libId) ?? null, [libraries, libId]);

      useEffect(() => {
        let alive = true;
        getJson('/api/kb/libraries')
          .then((payload) => {
            if (!alive) return;
            const rows = Array.isArray(payload.libraries) ? payload.libraries : [];
            setLibraries(rows);
            const preferred =
              rows.find((row) => row.id === kbPaneMemory.libId) ||
              rows.find((row) => row.id === payload.activeId) ||
              rows[0];
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

      useEffect(() => {
        kbPaneMemory.tree = tree;
      }, [tree]);
      useEffect(() => {
        kbPaneMemory.expanded = expanded;
      }, [expanded]);

      const loadTree = useCallback(async (libraryId, path) => {
        if (!libraryId) return [];
        const key = `${libraryId}:${path || ''}`;
        try {
          const payload = await getJson(
            `/api/kb/tree?lib=${encodeURIComponent(libraryId)}&path=${encodeURIComponent(path || '')}`,
          );
          const list = payload.entries ?? [];
          setTree((current) => ({ ...current, [key]: list }));
          return list;
        } catch (cause) {
          setError(errorText(cause));
          setTree((current) => ({ ...current, [key]: [] }));
          return [];
        }
      }, []);

      useEffect(() => {
        if (!libId) return;
        kbPaneMemory.libId = libId;
        setLoadingRoot(true);
        setError('');
        loadTree(libId, '').finally(() => setLoadingRoot(false));
      }, [libId, loadTree]);

      const toggleDir = async (path) => {
        const next = new Set(expanded);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          if (!tree[`${libId}:${path}`]) await loadTree(libId, path);
        }
        setExpanded(next);
      };

      // 文件交给 DSH 自己的文档预览：新开一个右栏标签页，不在列表页里自绘。
      const openEntry = (entry) => {
        if (entry.type === 'dir') {
          toggleDir(entry.path);
          return;
        }
        if (!sessionId) {
          setError('当前没有可用的会话，无法打开文件预览。');
          return;
        }
        const library = libraries.find((row) => row.id === libId);
        const absolutePath = libraryAbsolutePath(library?.root, entry.path);
        const address = sessionFileAddress(sessionId, absolutePath);
        const right = safeGet('sidebarRight');
        try {
          if (right?.openResourceIn) {
            right.openResourceIn(sessionId, address, { destination: 'sidebar' });
            setError('');
            return;
          }
          if (right?.openResource) {
            right.openResource(address, { destination: 'sidebar' });
            setError('');
            return;
          }
        } catch (cause) {
          reportClientError('preview:dsh', cause);
          setError(errorText(cause));
        }
      };

      const renderTree = (path, depth) => {
        const key = `${libId}:${path || ''}`;
        const entries = tree[key];
        if (!entries) {
          return h(
            'div',
            { className: 'kb-tree-skeleton', style: { paddingLeft: `${8 + depth * 14}px` } },
            h('i', { style: { width: '78%' } }),
            h('i', { style: { width: '62%' } }),
            h('i', { style: { width: '70%' } }),
          );
        }
        if (!entries.length && !path) {
          return h('div', { className: 'kb-hint', style: { padding: '10px 12px' } }, '这个目录是空的');
        }
        return entries.map((entry) => {
          if (entry.type === 'dir') {
            const open = expanded.has(entry.path);
            return h(
              React.Fragment,
              { key: entry.path },
              h(
                'div',
                {
                  className: cx('kb-file-item', 'kb-tree-row'),
                  style: { paddingLeft: `${6 + depth * 14}px` },
                  onClick: () => toggleDir(entry.path),
                  title: entry.path,
                },
                h(
                  'span',
                  { className: 'kb-caret', style: { display: 'inline-flex', justifyContent: 'center' } },
                  h(Icon, { name: 'chevron', size: 12, className: open ? 'kb-chev' : 'kb-chev-closed' }),
                ),
                h(
                  'span',
                  { className: cx('kb-row-icon', dirIconName(entry.name)) },
                  h(Icon, { name: dirIconName(entry.name), size: 16 }),
                ),
                h('span', { className: 'kb-name' }, entry.name),
              ),
              open ? renderTree(entry.path, depth + 1) : null,
            );
          }
          return h(
            'div',
            {
              key: entry.path,
              className: cx('kb-file-item', 'kb-tree-row'),
              style: { paddingLeft: `${6 + depth * 14 + 20}px` },
              onClick: () => openEntry(entry),
              title: entry.path,
            },
            h(
              'span',
              { className: cx('kb-row-icon', fileIconName(entry.name)) },
              h(Icon, { name: fileIconName(entry.name), size: 16 }),
            ),
            h('span', { className: 'kb-name' }, entry.name),
            h('span', { className: 'kb-meta' }, formatBytes(entry.size)),
          );
        });
      };

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

      const head = h(
        'div',
        { className: 'kb-pane-head' },
        libraries.length
          ? h(
              'select',
              {
                className: 'kb-select',
                value: libId,
                title: active?.root,
                onChange: (event) => {
                  const nextId = event.target.value;
                  kbPaneMemory.libId = nextId;
                  kbPaneMemory.tree = {};
                  kbPaneMemory.expanded = new Set();
                  setTree({});
                  setExpanded(new Set());
                  setLibId(nextId);
                },
              },
              ...libraries.map((row) => h('option', { key: row.id, value: row.id }, row.name)),
            )
          : h('span', { className: 'kb-hint' }, '还没有知识库'),
        h(IconButton, {
          icon: 'refresh',
          label: '刷新',
          disabled: !libId,
          onClick: () => {
            setTree((current) => {
              const next = { ...current };
              for (const key of Object.keys(next)) {
                if (key.startsWith(`${libId}:`)) delete next[key];
              }
              return next;
            });
            setLoadingRoot(true);
            loadTree(libId, '').finally(() => setLoadingRoot(false));
          },
        }),
        h(IconButton, {
          icon: 'chevron',
          label: '全部收起',
          disabled: !expanded.size,
          onClick: () => setExpanded(new Set()),
        }),
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

      return h(
        'div',
        { className: 'kb-pane' },
        head,
        error ? h('div', { className: 'kb-hint', style: { padding: '2px 10px 6px' } }, error) : null,
        h(
          'div',
          { className: 'kb-pane-body' },
          loadingRoot && !tree[`${libId}:`] ? h(Skeleton, { lines: 5 }) : renderTree('', 0),
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
          { className: 'kb-content', style: { padding: 0, overflow: 'auto' } },
          h('div', { className: 'kb-doc-pad' }, h(FilePreview, { libId: parsed.lib, path: file.path, file })),
        ),
      );
    }

    // 右栏标签页标题：图标 + 名称，和 DSH 其它标签页一致（图标与文字同一行居中）。
    function KbPaneTitle() {
      return h(
        React.Fragment,
        null,
        h(Icon, { name: 'library', size: 16, className: 'kb-tab-icon' }),
        '知识库',
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
                    keepMounted: true,
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
                    keepMounted: true,
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
            ctx.slots.inject('sidebar.right.pane.tab.title', () =>
              ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: KB_PAGE_ID }, KbPaneTitle),
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
