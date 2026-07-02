// ============================================================================
//  阿抖 · 品牌DNA（员工侧）
//  从司南导出的品牌DNA在这里导入。支持同时装多个品牌、随时切换——
//  代运营管 N 个客户，切到哪个品牌，阿抖就用哪个品牌的口径和调性干活。
// ============================================================================
'use client';

const KEY = 'adou-dnas';           // [{ key, dna }]
const CUR = 'adou-dna-current';    // 当前品牌 key

// 阿抖的平台微调（随DNA一起拼进prompt）
export const PLATFORM_TONE = '抖音节奏快、更外放，钩子要狠，前3秒抓人；可比全局再活泼一点。';

function read() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}
function write(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }

export function listDNAs() { return read(); }

export function addDNA(dna) {
  if (!dna || dna._type !== 'shop-dna' || !dna.profile) {
    throw new Error('不是有效的品牌DNA文件（请从司南导出）');
  }
  const key = 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const list = read();
  // 同名品牌视为更新（覆盖旧的）
  const name = dna.profile?.name || '';
  const existed = list.findIndex((x) => (x.dna?.profile?.name || '') === name && name);
  if (existed >= 0) {
    list[existed] = { key: list[existed].key, dna };
    write(list);
    setCurrent(list[existed].key);
    return list[existed].key;
  }
  list.unshift({ key, dna });
  write(list);
  setCurrent(key);
  return key;
}

export function removeDNA(key) {
  write(read().filter((x) => x.key !== key));
  if (getCurrentKey() === key) {
    const rest = read();
    setCurrent(rest.length ? rest[0].key : '');
  }
}

export function setCurrent(key) {
  try { localStorage.setItem(CUR, key || ''); } catch (e) {}
}

export function getCurrentKey() {
  try { return localStorage.getItem(CUR) || ''; } catch (e) { return ''; }
}

export function getCurrentDNA() {
  const key = getCurrentKey();
  if (!key) return null;
  const item = read().find((x) => x.key === key);
  return item ? item.dna : null;
}

// 把 DNA 翻译成可直接拼进 prompt 的文本（与司南 dnaToPromptBlock 对齐）
export function dnaToPromptBlock(dna, { platformTone } = {}) {
  if (!dna) return '';
  const p = dna.profile || {};
  const s = dna.soul || {};
  const meta = dna.subjectMeta;
  const parts = [];
  if (meta && Array.isArray(meta.fields) && meta.fields.length) {
    // —— v2：按主体类型 schema 渲染（实体店/电商/品牌/个人IP，schema随DNA携带）——
    parts.push(`【品牌DNA · ${meta.name || '主体'}真相（只能讲这些真实信息，绝不编造）】`);
    if (meta.firstPerson) parts.push(`【身份视角】${meta.firstPerson}`);
    for (const f of meta.fields) {
      const v = p[f.key];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      parts.push(`${f.label}：${Array.isArray(v) ? v.join('、') : v}`);
    }
    parts.push('');
    parts.push(s.instruction || '');
    if (platformTone) parts.push(`\n【本平台微调】${platformTone}`);
    return parts.join('\n');
  }
  // —— v1 老DNA兼容：按原实体店字段渲染 ——
  parts.push('【品牌DNA · 店铺真相（只能讲这些真实信息，绝不编造）】');
  if (p.name) parts.push(`店名：${p.name}`);
  if (p.category) parts.push(`品类：${p.category}`);
  if (p.city || p.area) parts.push(`位置：${[p.city, p.area].filter(Boolean).join(' ')}`);
  if (p.persona) parts.push(`老板人设：${p.persona}`);
  if (p.perCapita) parts.push(`人均：${p.perCapita}`);
  if ((p.signatures || []).length) parts.push(`真实招牌：${p.signatures.join('、')}`);
  if ((p.differentiators || []).length) parts.push(`真实差异点：${p.differentiators.join('、')}`);
  if ((p.highlights || []).length) parts.push(`可拍亮点：${p.highlights.join('、')}`);
  if (p.landing) parts.push(`引流/到店：${p.landing}`);
  if (p.taboo) parts.push(`⚠️禁止夸大：${p.taboo}`);
  parts.push('');
  parts.push(s.instruction || '');
  if (platformTone) parts.push(`\n【本平台微调】${platformTone}`);
  return parts.join('\n');
}

// 给 prompts.js 用：取当前品牌的完整 prompt 块（无DNA返回空串）
export function currentDnaBlock() {
  try {
    const dna = getCurrentDNA();
    if (!dna) return '';
    return dnaToPromptBlock(dna, { platformTone: PLATFORM_TONE });
  } catch (e) { return ''; }
}
