// Office 预览：不依赖 LibreOffice，直接在 Node 里读 OOXML（zip + XML）。
// 目标是把 docx / xlsx / pptx 转成前端能直接渲染的结构，旧版二进制格式给出明确提示。
import zlib from 'node:zlib';
import path from 'node:path';

import { KbError, readBytes } from './store.mjs';

const MAX_ROWS = 200;
const MAX_COLS = 40;
const MAX_SHEETS = 20;
const MAX_ENTRIES = 20000;

function decodeXml(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(Number(dec));
      } catch {
        return '';
      }
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attr(tag, name) {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return match ? decodeXml(match[1]) : '';
}

// ---------------------------------------------------------------- ZIP reader

function openZip(buffer) {
  let eocd = -1;
  const floor = Math.max(0, buffer.length - 22 - 65535);
  for (let index = buffer.length - 22; index >= floor; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new KbError('E_BAD_OFFICE', '不是有效的 Office/ZIP 文件。');
  const count = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (count > MAX_ENTRIES) throw new KbError('E_BAD_OFFICE', '压缩包条目过多。');
  const entries = new Map();
  let cursor = cdOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const uncompressed = buffer.readUInt32LE(cursor + 24);
    const nameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLen);
    entries.set(name, { method, compressed, uncompressed, localOffset });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  const read = (name) => {
    const entry = entries.get(name);
    if (!entry) return null;
    const local = entry.localOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new KbError('E_BAD_OFFICE', '压缩包目录损坏。');
    const nameLen = buffer.readUInt16LE(local + 26);
    const extraLen = buffer.readUInt16LE(local + 28);
    const start = local + 30 + nameLen + extraLen;
    const data = buffer.subarray(start, start + entry.compressed);
    if (entry.method === 0) return data;
    if (entry.method === 8) {
      try {
        return zlib.inflateRawSync(data);
      } catch {
        throw new KbError('E_BAD_OFFICE', '压缩包解压失败。');
      }
    }
    throw new KbError('E_BAD_OFFICE', `不支持的压缩方式（${entry.method}）。`);
  };
  return {
    names: () => [...entries.keys()],
    has: (name) => entries.has(name),
    read,
    text(name) {
      const data = read(name);
      return data ? data.toString('utf8') : null;
    },
  };
}

// ---------------------------------------------------------------- DOCX

function runHtml(runXml) {
  const runProps = /<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/.exec(runXml)?.[1] ?? '';
  const parts = [];
  const textRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
  let match;
  while ((match = textRe.exec(runXml)) !== null) {
    if (match[0] === '<w:tab/>') parts.push('\t');
    else if (match[0] === '<w:br/>') parts.push('\n');
    else parts.push(decodeXml(match[1]));
  }
  let text = parts.join('');
  if (!text) return '';
  text = escapeHtml(text).replace(/\n/g, '<br>').replace(/\t/g, '    ');
  const bold = /<w:b(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(runProps);
  const italic = /<w:i(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(runProps);
  const underline = /<w:u\s+w:val="(?!none)/.test(runProps);
  const strike = /<w:strike(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(runProps);
  let html = text;
  if (bold) html = `<strong>${html}</strong>`;
  if (italic) html = `<em>${html}</em>`;
  if (underline) html = `<u>${html}</u>`;
  if (strike) html = `<s>${html}</s>`;
  return html;
}

function paragraphHtml(xml) {
  const style = /<w:pStyle\s+w:val="([^"]+)"/.exec(xml)?.[1] ?? '';
  const outline = /<w:outlineLvl\s+w:val="(\d+)"/.exec(xml)?.[1];
  let level = 0;
  const heading = /(?:heading|标题)\s*([1-6])/i.exec(style);
  if (heading) level = Number(heading[1]);
  else if (outline !== undefined) level = Math.min(6, Number(outline) + 1);
  const runs = [];
  const runRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let match;
  while ((match = runRe.exec(xml)) !== null) runs.push(runHtml(match[1]));
  const html = runs.join('');
  const isList = /<w:numPr\b/.test(xml);
  const plain = html.replace(/<[^>]+>/g, '').trim();
  if (!plain && !html.includes('<br>')) return '';
  if (level) return `<h${level}>${html || '&nbsp;'}</h${level}>`;
  if (isList) return `<div class="kb-docx-li"><span class="kb-docx-bullet">•</span>${html}</div>`;
  return `<p>${html || '&nbsp;'}</p>`;
}

function tableHtml(xml) {
  const rows = [];
  const rowRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const cells = [];
    const cellRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const texts = [];
      const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
      let pMatch;
      while ((pMatch = pRe.exec(cellMatch[1])) !== null) {
        const runs = [];
        const rRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
        let rMatch;
        while ((rMatch = rRe.exec(pMatch[1])) !== null) {
          const textRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
          let tMatch;
          while ((tMatch = textRe.exec(rMatch[1])) !== null) runs.push(decodeXml(tMatch[1]));
        }
        texts.push(runs.join(''));
      }
      cells.push(`<td>${escapeHtml(texts.join(' ').trim())}</td>`);
    }
    if (cells.length) rows.push(`<tr>${cells.join('')}</tr>`);
  }
  if (!rows.length) return '';
  return `<table class="kb-docx-table"><tbody>${rows.join('')}</tbody></table>`;
}

function previewDocx(zip) {
  const xml = zip.text('word/document.xml');
  if (!xml) throw new KbError('E_BAD_OFFICE', 'Word 文档缺少正文内容。');
  const body = /<w:body\b[^>]*>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
  const html = [];
  const blockRe = /<w:(p|tbl)\b[^>]*>[\s\S]*?<\/w:\1>/g;
  let match;
  while ((match = blockRe.exec(body)) !== null) {
    const chunk = blockHtml(match);
    if (chunk) html.push(chunk);
  }
  return {
    kind: 'docx',
    html: html.join('\n'),
    paragraphs: html.length,
    truncated: false,
  };

  function blockHtml(found) {
    return found[1] === 'tbl' ? tableHtml(found[0]) : paragraphHtml(found[0]);
  }
}

// ---------------------------------------------------------------- XLSX

function parseSharedStrings(zip) {
  const xml = zip.text('xl/sharedStrings.xml');
  if (!xml) return [];
  const list = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siRe.exec(xml)) !== null) {
    let text = '';
    const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let tMatch;
    while ((tMatch = tRe.exec(match[1])) !== null) text += decodeXml(tMatch[1]);
    list.push(text);
  }
  return list;
}

function columnIndex(ref) {
  const letters = String(ref || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

function cellValue(cellTag, inner, shared) {
  const type = attr(cellTag, 't');
  const vMatch = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner);
  const raw = vMatch ? decodeXml(vMatch[1]) : '';
  if (type === 's') return shared[Number(raw)] ?? '';
  if (type === 'inlineStr') {
    let text = '';
    const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let tMatch;
    while ((tMatch = tRe.exec(inner)) !== null) text += decodeXml(tMatch[1]);
    return text;
  }
  if (type === 'b') return raw === '1' ? 'TRUE' : raw === '0' ? 'FALSE' : raw;
  if (type === 'str' || type === 'e') return raw;
  if (!raw) return '';
  const number = Number(raw);
  if (Number.isFinite(number) && String(number) === raw) {
    if (Number.isInteger(number)) return String(number);
    return String(Math.round(number * 1e10) / 1e10);
  }
  return raw;
}

function sheetRows(xml, shared) {
  const rows = [];
  let truncated = false;
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[2])) !== null) {
      const ref = attr(cellMatch[1], 'r');
      const column = columnIndex(ref);
      if (column < 0 || column >= MAX_COLS) {
        truncated = true;
        continue;
      }
      cells[column] = cellValue(cellMatch[1], cellMatch[2] ?? '', shared);
    }
    rows.push(cells);
  }
  return { rows, truncated };
}

function previewXlsx(zip) {
  const shared = parseSharedStrings(zip);
  const workbook = zip.text('xl/workbook.xml') ?? '';
  const relsXml = zip.text('xl/_rels/workbook.xml.rels') ?? '';
  const rels = new Map();
  const relRe = /<Relationship\b[^>]*>/g;
  let relMatch;
  while ((relMatch = relRe.exec(relsXml)) !== null) {
    rels.set(attr(relMatch[0], 'Id'), attr(relMatch[0], 'Target'));
  }
  const sheets = [];
  const sheetRe = /<sheet\b[^>]*>/g;
  let sheetMatch;
  while ((sheetMatch = sheetRe.exec(workbook)) !== null && sheets.length < MAX_SHEETS) {
    const name = attr(sheetMatch[0], 'name') || `Sheet${sheets.length + 1}`;
    const rid = attr(sheetMatch[0], 'r:id');
    let target = rels.get(rid) || '';
    if (!target) continue;
    target = target.replace(/^\//, '');
    if (!target.startsWith('xl/')) target = `xl/${target}`;
    const xml = zip.text(target);
    if (!xml) continue;
    const parsed = sheetRows(xml, shared);
    const columns = parsed.rows.reduce((max, row) => Math.max(max, row.length), 0);
    const normalized = parsed.rows.map((row) =>
      Array.from({ length: columns }, (_, index) => (row[index] === undefined ? '' : String(row[index]))),
    );
    sheets.push({ name, rows: normalized, columns, truncated: parsed.truncated });
  }
  if (!sheets.length) throw new KbError('E_BAD_OFFICE', '工作簿里没有可预览的工作表。');
  return {
    kind: 'xlsx',
    sheets,
    truncated: sheets.some((sheet) => sheet.truncated),
    maxRows: MAX_ROWS,
    maxCols: MAX_COLS,
  };
}

// ---------------------------------------------------------------- PPTX

function previewPptx(zip) {
  const names = zip
    .names()
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(/(\d+)/.exec(a)[1]) - Number(/(\d+)/.exec(b)[1]));
  if (!names.length) throw new KbError('E_BAD_OFFICE', '演示文稿里没有幻灯片。');
  const slides = [];
  for (const name of names.slice(0, 100)) {
    const xml = zip.text(name) || '';
    const paragraphs = [];
    const pRe = /<a:p>([\s\S]*?)<\/a:p>/g;
    let pMatch;
    while ((pMatch = pRe.exec(xml)) !== null) {
      let text = '';
      const tRe = /<a:t>([\s\S]*?)<\/a:t>/g;
      let tMatch;
      while ((tMatch = tRe.exec(pMatch[1])) !== null) text += decodeXml(tMatch[1]);
      text = text.trim();
      if (text) paragraphs.push(text);
    }
    slides.push({ index: slides.length + 1, title: paragraphs[0] || '', lines: paragraphs.slice(1) });
  }
  return { kind: 'pptx', slides };
}

// ---------------------------------------------------------------- 入口

export function previewOffice(root, rel) {
  const ext = path.extname(String(rel || '')).toLowerCase();
  if (['.doc', '.xls', '.ppt'].includes(ext)) {
    return {
      kind: 'unsupported',
      reason: `旧版 ${ext.slice(1).toUpperCase()} 是二进制格式，浏览器里无法直接解析；请另存为 ${ext} x 后重试。`,
      ext,
    };
  }
  if (!['.docx', '.xlsx', '.pptx'].includes(ext)) {
    return { kind: 'none', ext };
  }
  const bytes = readBytes(root, rel, { maxBytes: 64 * 1024 * 1024 });
  let zip;
  try {
    zip = openZip(bytes.bytes);
  } catch (error) {
    if (error instanceof KbError) throw error;
    throw new KbError('E_BAD_OFFICE', 'Office 文件解析失败。');
  }
  if (ext === '.docx') return { ...previewDocx(zip), ext, size: bytes.size };
  if (ext === '.xlsx') return { ...previewXlsx(zip), ext, size: bytes.size };
  return { ...previewPptx(zip), ext, size: bytes.size };
}
