import { topicPrompt, scriptPrompt, judgeHooksPrompt, fixPrompt } from './prompts';
import { combineHookScore } from './scoring';
import { runQC, violationBrief } from './qc';
import { TYPE_HOOK_FIT, HOOK_CATS, hookById } from './hooks';
import { templateForType, COND_TYPES } from './scriptTemplates';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripThink(s) {
  let t = String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  const i = t.search(/<think>/i);
  if (i >= 0) t = t.slice(0, i);
  return t.trim();
}

// 加固版 chat：流式直通（绕开 Netlify 首字节 504），兼容非流式
async function chat(messages, { temperature = 0.7, judge = false, max_tokens = 3500 } = {}) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, temperature, judge, max_tokens }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); if (d.error) msg = d.error; } catch (e) {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', delta = '', snapshot = '', sawDelta = false;
    const feed = (payload) => {
      try {
        const j = JSON.parse(payload);
        const c0 = j?.choices?.[0];
        const d = c0?.delta?.content;
        if (typeof d === 'string' && d) { delta += d; sawDelta = true; return; }
        const full = c0?.message?.content ?? c0?.text;
        if (typeof full === 'string' && full) snapshot = full;
      } catch (e) {}
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        feed(payload);
      }
    }
    const tail = buf.trim();
    if (tail.startsWith('data:')) { const p = tail.slice(5).trim(); if (p && p !== '[DONE]') feed(p); }
    const content = stripThink(sawDelta ? delta : snapshot);
    if (!content) throw new Error('流式返回为空：当前模型可能只输出思考过程，请把 LLM_MODEL 换成非思考版');
    return content;
  }
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error);
  let c = data.content ?? data?.choices?.[0]?.message?.content ?? '';
  if (Array.isArray(c)) c = c.map((x) => x?.text || '').join('');
  c = stripThink(c);
  if (!c) throw new Error('上游返回空内容');
  return c;
}

function extractCandidates(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== '{' && ch !== '[') continue;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (esc) { esc = false; continue; }
      if (inStr) { if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') { inStr = true; continue; }
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end > i) { out.push(s.slice(i, end + 1)); i = end; }
  }
  return out;
}

function repairJSON(s) {
  let r = '', inStr = false, esc = false;
  for (const c of s) {
    if (esc) { r += c; esc = false; continue; }
    if (inStr) {
      if (c === '\\') { r += c; esc = true; continue; }
      if (c === '"') { inStr = false; r += c; continue; }
      if (c === '\n') { r += '\\n'; continue; }
      if (c === '\r') { r += '\\r'; continue; }
      if (c === '\t') { r += '\\t'; continue; }
      r += c; continue;
    }
    if (c === '"') inStr = true;
    r += c;
  }
  return r.replace(/,\s*([}\]])/g, '$1');
}

function parseJSON(text) {
  const cleaned = String(text).replace(/```json|```/gi, '').trim();
  const cands = extractCandidates(cleaned);
  cands.sort((a, b) => b.length - a.length);
  const tries = cands.length ? cands : [cleaned];
  let lastErr;
  for (const c of tries) {
    try { return JSON.parse(c); } catch (e) { lastErr = e; }
    try { return JSON.parse(repairJSON(c)); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('未找到可解析的 JSON');
}

async function chatJSON(messages, opts) {
  let lastErr, lastRaw = '';
  for (let i = 0; i < 2; i++) {
    try { lastRaw = await chat(messages, opts); return parseJSON(lastRaw); }
    catch (e) { lastErr = e; if (i === 0) await sleep(1500); }
  }
  const head = String(lastRaw).slice(0, 100).replace(/\s+/g, ' ');
  throw new Error(`输出解析失败：${lastErr?.message || lastErr}${head ? `｜原文开头：${head}…` : ''}`);
}

const now = () =>
  new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/** 给三个剧本分配互不相同的 Hook 大类（质检规则10由构造保证） */
function assignHookCats(picked) {
  const used = new Set();
  const ALL = Object.keys(HOOK_CATS);
  return picked.map((t) => {
    const prefs = TYPE_HOOK_FIT[t.type] || ALL;
    let cat = prefs.find((c) => !used.has(c)) || ALL.find((c) => !used.has(c)) || prefs[0];
    used.add(cat);
    return cat;
  });
}

export async function runProduction({ profile, hot, onLog, onNote, shouldStop, feed }) {
  const log = (text, type = 'info') => onLog && onLog({ time: now(), text, type });

  log('打卡上班 ✓ 正在复习《Hook 24式》《剧本结构库》和质检硬规则…');

  let topics = [];
  let picked = [];
  let cats = [];
  if (feed && feed.theme) {
    // ─ 投喂模式：跳过选题，按老板指定主题精做 1 个剧本 ─
    log(`收到本篇投喂任务：「${feed.theme}」 · 文风：${feed.tone}`);
    if (feed.photos && feed.photos.length) log(`已收到 ${feed.photos.length} 张真实照片${feed.coverDataUrl && !feed.useAIImage ? '，其中 1 张将作封面字卡底图' : ''}`);
    const fType = feed.structureKey && feed.structureKey !== 'auto' ? feed.structure : '真人口播';
    picked = [{ title: feed.theme, type: fType, angle: '紧扣投喂主题展开', keyword: feed.theme, score: '-' }];
    cats = assignHookCats(picked);
  } else {
    // ─ 选题引擎 ─
    const allowed = COND_TYPES[profile.cond] || COND_TYPES['真人口播'];
    log(hot ? '收到热点情报，按"对标复刻+热点借力+长青痛点"三板斧选题…' : `按三板斧选题（制作条件：${profile.cond}，可产类型：${allowed.join('/')}）…`);
    const topicData = await chatJSON(topicPrompt(profile, hot), { temperature: 0.85 });
    topics = (topicData.topics || []).filter((t) => t && t.title).slice(0, 5);
    if (topics.length === 0) throw new Error('选题引擎未返回有效选题');
    const seenTypes = new Set();
    for (const t of topics) {
      if (picked.length >= 3) break;
      if (!seenTypes.has(t.type)) { picked.push(t); seenTypes.add(t.type); }
    }
    for (const t of topics) {
      if (picked.length >= 3) break;
      if (!picked.includes(t)) picked.push(t);
    }
    cats = assignHookCats(picked);
    log(`选题完成：锁定 ${picked.length} 个投产。Hook 大类分配：${picked.map((t, i) => `剧本${i + 1}=${cats[i]}类${HOOK_CATS[cats[i]]}`).join('，')}（规则10：互不相同 ✓）`, 'ok');
  }

  // ─ 三剧本串行生产（避开网关并发限流 429）─
  const notes = [];
  for (let idx = 0; idx < picked.length; idx++) {
    if (shouldStop && shouldStop()) { log(`收到叫停指令，已停在第 ${idx} 个之后，保留已完成的 ${notes.length} 个剧本。`, 'warn'); break; }
    const topic = picked[idx];
    const tag = `剧本${idx + 1}`;
    try {
        const tpl = templateForType(topic.type);
        log(`${tag}「${topic.title}」开写：模板${tpl.id}（${tpl.name}），先出 4 个 ${cats[idx]} 类 Hook 候选…`);
        let draft = await chatJSON(scriptPrompt(profile, topic, cats[idx], tpl, feed), { temperature: 0.9, max_tokens: 6000 });

        // ─ Hook 评分定稿 ─
        const rawHooks = (draft.hooks || []).filter((h) => h && h.text).slice(0, 4);
        if (rawHooks.length === 0) throw new Error(`未生成有效 Hook（模型返回字段：${Object.keys(draft || {}).join(',') || '空'}）`);
        let judged = [];
        try {
          judged = await chatJSON(judgeHooksPrompt(rawHooks.map((h) => h.text), profile), { temperature: 0.2, judge: true });
        } catch (e) {
          log(`${tag} 评分模型异常，Hook 降级为硬规则打分（${e.message}）`, 'warn');
        }
        const jm = {};
        if (Array.isArray(judged)) for (const j of judged) if (j && typeof j === 'object' && Number.isInteger(j.i)) jm[j.i] = j;
        const scoredHooks = rawHooks.map((h, i) => {
          const j = jm[i] || {};
          const s = combineHookScore(h.text, j.s, j.why);
          const lib = hookById(h.hookId);
          return { ...h, hookName: lib ? `${lib.id} ${lib.name}` : h.hookId, ...s };
        });
        scoredHooks.sort((a, b) => b.total - a.total);
        const winner = scoredHooks[0];
        const losers = scoredHooks.slice(1);
        log(`${tag} Hook 定稿：「${winner.text}」（${winner.total}分·${winner.hookName}），淘汰 ${losers.length} 条`, 'cut');

        // 首镜台词与定稿 Hook 对齐
        if (draft.script?.shots?.length) {
          draft.script.shots[0].line = winner.text;
          draft.script.shots[0].sub = draft.script.shots[0].sub || winner.text;
        }

        // ─ 质检环 + 打回返工（最多1次）─
        let qc = runQC(draft.script, draft.title, topic.type);
        log(`${tag} 质检：${qc.rules.filter((r) => r.pass).length}/${qc.rules.length} 项通过，语速 ${qc.speed} 字/秒，成片约 ${qc.duration}s`, qc.pass ? 'ok' : 'warn');
        if (!qc.pass) {
          const brief = violationBrief(qc);
          log(`${tag} 硬规则未达标，打回返工：${brief}`, 'warn');
          try {
            const fixed = await chatJSON(fixPrompt(draft, brief), { temperature: 0.4, max_tokens: 4000 });
            if (fixed?.script?.shots?.length) {
              fixed.hooks = draft.hooks;
              fixed.script.shots[0].line = winner.text;
              fixed.script.shots[0].sub = fixed.script.shots[0].sub || winner.text;
              draft = fixed;
              qc = runQC(draft.script, draft.title, topic.type);
              log(`${tag} 返工后复检：${qc.rules.filter((r) => r.pass).length}/${qc.rules.length} 项通过${qc.pass ? ' ✓' : '（仍有未达标项，已标注，请验收时留意）'}`, qc.pass ? 'ok' : 'warn');
            }
          } catch (e) {
            log(`${tag} 返工失败（${e.message}），按原稿交付并标注问题`, 'warn');
          }
        }

        // ─ 字卡收集（封面 + 分镜内字卡）；投喂的真实照片优先作封面底图 ─
        const scheme = draft.script?.shots?.find((s) => s.card?.scheme)?.card?.scheme || draft.script?.cover?.scheme || (idx % 2 === 0 ? 'noir' : 'cyber');
        const cards = [];
        if (feed && feed.coverDataUrl && !feed.useAIImage) {
          cards.push({ tpl: 'F_PHOTO', bgDataUrl: feed.coverDataUrl, title: (draft.script?.cover?.title) || winner.text.slice(0, 9), badge: draft.script?.cover?.badge || '', label: '封面(真实照片)' });
          log(`${tag} 封面字卡采用老板提供的真实照片 ✓`, 'ok');
        } else if (draft.script?.cover) cards.push({ ...draft.script.cover, label: '封面' });
        (draft.script?.shots || []).forEach((s) => {
          if (s.card) cards.push({ ...s.card, label: `镜${s.no}` });
        });
        if (cards.length === 0 && draft.script?.shots?.length) {
          cards.push({ tpl: 'F_COVER', title: (winner.text || '').slice(0, 9), badge: '今日更新', label: '封面' });
        }
        log(`${tag} 字卡工厂已排版 ${cards.length} 张（9:16），交付打包完成 ✓`, 'ok');

        const note = {
          id: idx,
          topic,
          hookCat: cats[idx],
          winner,
          losers,
          script: draft.script,
          qc,
          title: draft.title || '',
          formula: draft.formula || '',
          hashtags: (draft.hashtags || []).slice(0, 5),
          tip: draft.tip || '',
          jianying: draft.jianying || '',
          cards,
          scheme,
          photos: (feed && feed.photos) || [],
        };
        onNote && onNote(note);
        notes.push(note);
      } catch (e) {
        log(`${tag} 生产失败：${e.message}`, 'warn');
      }
      if (idx < picked.length - 1) await sleep(1500);
  }

  const ok = notes.filter(Boolean);
  if (ok.length === 0) throw new Error('三个剧本全部生产失败，请检查模型配置后重试');
  log(`今日交付完成：${ok.length} 个剧本包已上架交付区，请老板验收 ✓`, 'ok');
  return { topics, notes: ok };
}


// ============================================================================
//  【新模式 · 素材成片】runEditFromAssets
//  输入：profile + assets(前端已抽好帧的素材) + theme + tone
//  流程：① 逐个素材送视觉模型"看懂" → ② 基于看懂的素材+主题组织语言 → 输出内容方案
//  assets 每项：{ idx, file, kind:'video'|'image', frames:[dataUrl...], dur? }
// ============================================================================
import { assetsEditPrompt } from './prompts';

// 调视觉模型识别单个素材的画面内容（复用 /api/extract 的视觉能力）
async function recognizeAsset(frames) {
  const prompt = '用一句话描述这张图里有什么（如果是食物，说清楚是什么菜、什么状态：如热气腾腾的牛肉煲/切好的生牛肉/汤在翻滚）。只回一句话，不超过30字，不要解释。';
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: frames, freeText: prompt, mode: 'describe' }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); if (d.error) msg = d.error; } catch (e) {}
    throw new Error(msg);
  }
  const data = await res.json();
  // extract 可能返回 {desc} 或 {raw} 或 JSON；尽量取一句话描述
  return (data.desc || data.description || data.raw || data.text || '').toString().slice(0, 40).trim();
}

export async function runEditFromAssets({ profile, assets, theme, tone, onLog, onResult, shouldStop }) {
  const log = (m, t) => onLog && onLog(m, t);
  if (!assets || !assets.length) { log('没有收到素材', 'err'); return; }

  log(`收到 ${assets.length} 个素材，并行识别画面中…`);
  // 并行识别（同时发，快很多），但控制并发数避免限流（每批4个）
  const recognized = [];
  const BATCH = 4;
  for (let i = 0; i < assets.length; i += BATCH) {
    if (shouldStop && shouldStop()) { log('已停止', 'warn'); return; }
    const batch = assets.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (a) => {
      let desc = '（未能识别）';
      try { desc = await recognizeAsset(a.frames || []); if (!desc) desc = '（画面不清晰）'; }
      catch (e) { desc = '（识别失败）'; }
      return { idx: a.idx, file: a.file, kind: a.kind, dur: a.dur, desc };
    }));
    for (const r of results) {
      log(`  看懂素材[${r.idx}]（${r.kind === 'video' ? '视频' : '图片'}）：${r.desc}`, 'ok');
      recognized.push(r);
    }
  }
  recognized.sort((a, b) => a.idx - b.idx);

  if (shouldStop && shouldStop()) return;
  log('素材都看懂了，开始围绕主题组织语言（文案/字幕/标题/顺序）…');

  const { system, user } = assetsEditPrompt(profile, recognized, theme, tone);
  let plan;
  try {
    plan = await chatJSON([{ role: 'system', content: system }, { role: 'user', content: user }],
                          { temperature: 0.8, max_tokens: 8000 });
  } catch (e) {
    log(`组织语言失败：${e.message}`, 'err');
    return;
  }

  // 字幕兜底：模型可能漏配某些素材的字幕，给漏的补上（用识别描述截断兜底）
  if (!Array.isArray(plan.captions)) plan.captions = [];
  const capMap = {};
  for (const c of plan.captions) if (c && Number.isInteger(c.idx)) capMap[c.idx] = c.sub || '';
  for (const r of recognized) {
    if (!capMap[r.idx]) {
      const fallback = (r.desc || '').replace(/[（(].*?[)）]/g, '').slice(0, 14);
      plan.captions.push({ idx: r.idx, sub: fallback });
    }
  }
  plan.captions.sort((a, b) => a.idx - b.idx);
  // 顺序兜底：模型没给全的，补上缺的素材编号
  if (!Array.isArray(plan.order) || !plan.order.length) plan.order = recognized.map(r => r.idx);
  else { const inOrder = new Set(plan.order); for (const r of recognized) if (!inOrder.has(r.idx)) plan.order.push(r.idx); }
  // 把识别到的素材信息合并进结果，方便前端展示和后续合成
  plan._assets = recognized;
  log('内容方案已生成 ✓', 'ok');
  onResult && onResult(plan);
  return plan;
}
