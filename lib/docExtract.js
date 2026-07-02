// ============================================================================
//  司南 · 资料文档解析（浏览器端）
//  把 txt / Word / Excel / PPT / PDF 降解成纯文本，喂给识别接口建档。
//  全部按需动态加载（不拖慢首屏）；解析失败给出明确提示。
// ============================================================================
'use client';

const MAX_CHARS_PER_FILE = 8000; // 单文件文本上限（防止超长撑爆prompt）

function clip(text) {
  const t = (text || '').replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();
  return t.length > MAX_CHARS_PER_FILE ? t.slice(0, MAX_CHARS_PER_FILE) + '\n…（内容过长已截断）' : t;
}

const extOf = (name) => (name.split('.').pop() || '').toLowerCase();

// 主入口：返回 { kind:'text', name, content } 或 { kind:'images', name, images:[dataURL] } 或抛错
export async function extractDoc(file) {
  const ext = extOf(file.name);

  if (ext === 'txt' || ext === 'md' || ext === 'csv') {
    return { kind: 'text', name: file.name, content: clip(await file.text()) };
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const { value } = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { kind: 'text', name: file.name, content: clip(value) };
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx');
    const wb = (XLSX.default || XLSX).read(await file.arrayBuffer(), { type: 'array' });
    const X = XLSX.default || XLSX;
    const parts = [];
    for (const sn of wb.SheetNames.slice(0, 5)) {
      const csv = X.utils.sheet_to_csv(wb.Sheets[sn]);
      if (csv.trim()) parts.push(`【表：${sn}】\n${csv}`);
    }
    return { kind: 'text', name: file.name, content: clip(parts.join('\n\n')) };
  }

  if (ext === 'pptx') {
    const JSZipMod = await import('jszip');
    const JSZip = JSZipMod.default || JSZipMod;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideNames = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    const parts = [];
    for (const sn of slideNames.slice(0, 40)) {
      const xml = await zip.files[sn].async('string');
      const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]).filter(Boolean);
      if (texts.length) parts.push(`【第${sn.match(/\d+/)[0]}页】${texts.join(' ')}`);
    }
    if (!parts.length) throw new Error('这份PPT没有可提取的文字（可能是纯图片页），请截图上传');
    return { kind: 'text', name: file.name, content: clip(parts.join('\n')) };
  }

  if (ext === 'pdf') {
    return await extractPdf(file);
  }

  if (ext === 'doc' || ext === 'ppt') {
    throw new Error(`老版 .${ext} 格式暂不支持，请另存为 .${ext}x 或截图上传`);
  }

  throw new Error(`不支持的文件类型 .${ext}`);
}

// PDF：优先提取文本层；文本太少（扫描版）则渲染前2页成图片走视觉识别
async function extractPdf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url
    ).toString();
  } catch (e) { /* worker配不上就走主线程 */ }

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const nPages = Math.min(doc.numPages, 15);
  const parts = [];
  for (let i = 1; i <= nPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const t = tc.items.map((it) => it.str).join(' ').trim();
    if (t) parts.push(`【第${i}页】${t}`);
  }
  const text = parts.join('\n');

  if (text.replace(/【第\d+页】/g, '').trim().length >= 60) {
    return { kind: 'text', name: file.name, content: clip(text) };
  }

  // 文本太少 → 扫描版PDF，渲染前2页成图片
  const images = [];
  for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.85));
  }
  if (!images.length) throw new Error('这份PDF无法解析，请截图上传');
  return { kind: 'images', name: file.name, images };
}

// 支持的扩展名（给 input accept 和提示用）
export const DOC_EXTS = ['.txt', '.md', '.csv', '.pdf', '.docx', '.xlsx', '.xls', '.pptx'];
export const ACCEPT = 'image/*,' + DOC_EXTS.join(',');
