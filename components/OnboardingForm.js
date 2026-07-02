'use client';

import { useState, useRef } from 'react';
import { extractDoc, ACCEPT } from '@/lib/docExtract';
import { addDNA } from '@/lib/dna';

const TONES = ['接地气老板风', '专业讲师风', '活泼搞笑风', '犀利毒舌风'];
const CONDS = ['纯字卡+AI配音', '真人口播', '可拍剧情'];
const condLabel = (c) => c === '纯字卡+AI配音' ? '纯字卡+AI配音（最省事，不用出镜）' : c === '真人口播' ? '真人口播（可出镜或配音）' : '可拍剧情（有出镜+拍摄条件）';

function toProfile(d, tone, cond) {
  const signatures = (d.signatures || []).filter(Boolean);
  const diffs = (d.differentiators || []).filter(Boolean);
  const today = new Date();
  const joinedAt = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  return {
    name: d.name || '', category: d.category || '', city: d.city || '', area: d.area || '',
    persona: d.persona || '', perCapita: d.perCapita || '', hours: d.hours || '',
    signatures, differentiators: diffs, highlights: (d.highlights || []).filter(Boolean),
    landing: d.landing || '', tabooConfirmed: d.tabooConfirmed || '', audience: d.audience || '',
    tone: tone || TONES[0], cond: cond || CONDS[0],
    industry: d.category || d.industry || '',
    product: [d.name, d.persona].filter(Boolean).join('，') || d.category || '',
    sellingPoints: [...signatures, ...diffs].join('\n'),
    forbidden: '', benchmarks: '', joinedAt,
  };
}

const EMPTY = {
  name: '', category: '', city: '', area: '', persona: '', perCapita: '', hours: '',
  signatures: ['', '', ''], differentiators: ['', ''], highlights: [''], landing: '', audience: '', tabooConfirmed: '',
};

export default function OnboardingForm({ onHire }) {
  const [mode, setMode] = useState('smart');
  const [url, setUrl] = useState('');
  const [images, setImages] = useState([]);
  const [texts, setTexts] = useState([]);   // 资料文档文本 [{name, content}]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState(null);
  const [tone, setTone] = useState(TONES[0]);
  const [cond, setCond] = useState(CONDS[0]);
  const fileRef = useRef(null);

  const dnaFileRef = useRef(null);

  // —— DNA 快速上岗：司南建好的品牌，导入即完成入职，不用重新登记 ——
  function hireByDna(dna) {
    addDNA(dna);  // 校验、入库并设为当前品牌
    onHire(toProfile(dna.profile || {}, TONES[0]));
  }
  async function pasteDna() {
    setErr('');
    try {
      const text = await navigator.clipboard.readText();
      hireByDna(JSON.parse(text));
    } catch (e) {
      setErr('剪贴板里不是有效的品牌DNA——先在司南品牌卡上点「📋 复制DNA」，再回来点这里。');
    }
  }
  async function pickDnaFile(e) {
    setErr('');
    const f = e.target.files?.[0];
    if (!f) return;
    try { hireByDna(JSON.parse(await f.text())); }
    catch (err) { setErr('不是有效的品牌DNA文件（请从司南导出）'); }
    if (e.target) e.target.value = '';
  }

  async function pickFiles(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    const fails = [];
    for (const f of files) {
      try {
        if (f.type.startsWith('image/')) {
          const dataUrl = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(f);
          });
          setImages((prev) => [...prev, dataUrl].slice(0, 4));
        } else {
          const r = await extractDoc(f);
          if (r.kind === 'text' && r.content) {
            setTexts((prev) => [...prev.filter((t) => t.name !== r.name), { name: r.name, content: r.content }].slice(0, 8));
          } else if (r.kind === 'images') {
            for (const u of r.images) setImages((prev) => [...prev, u].slice(0, 4));
          }
        }
      } catch (err) {
        fails.push(`${f.name}（${err.message || '读取失败'}）`);
      }
    }
    if (fails.length) setErr(`部分文件未能读取：${fails.join('；')}`);
    if (e.target) e.target.value = '';
  }

  async function extract() {
    setErr(''); setNote('');
    if (!url.trim() && images.length === 0 && texts.length === 0) { setErr('贴一个链接，或上传截图/资料文档（店铺页、产品页、介绍PDF/Word都行）'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), images, texts }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) {
        setErr(d.error || `提取失败 HTTP ${r.status}`);
        if (d.fetchNote) setNote(d.fetchNote);
      } else {
        const p = d.profile || {};
        setDraft({
          ...EMPTY, ...p,
          signatures: [...(p.signatures || []), '', '', ''].slice(0, 4),
          differentiators: [...(p.differentiators || []), '', ''].slice(0, 3),
          highlights: [...(p.highlights || []), ''].slice(0, 3),
        });
        if (d.fetchNote) setNote(d.fetchNote);
      }
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  function startManual() { setDraft({ ...EMPTY }); setErr(''); }
  function setD(k) { return (e) => setDraft({ ...draft, [k]: e.target.value }); }
  function setArr(k, i) {
    return (e) => { const arr = [...(draft[k] || [])]; arr[i] = e.target.value; setDraft({ ...draft, [k]: arr }); };
  }
  function confirmHire() {
    if (!draft.name.trim() && !draft.category.trim()) { setErr('至少要有店名或品类，阿抖才知道在给谁拍'); return; }
    onHire(toProfile(draft, tone, cond));
  }

  if (draft) {
    return (
      <div className="card formCard">
        <div className="formHead">
          <h2>确认店铺档案</h2>
          <p>这是阿抖读到的信息，<b>请你核对修改</b>——她以后只基于这份真实档案拍，绝不编造。制作条件决定她给你排什么类型的片。</p>
        </div>
        {note ? <div className="hintNote">ℹ️ {note}</div> : null}

        <div className="grid2">
          <label className="field"><span>店名 <i>*</i></span><input value={draft.name} onChange={setD('name')} placeholder="一把抓牛肉面" /></label>
          <label className="field"><span>品类 <i>*</i></span><input value={draft.category} onChange={setD('category')} placeholder="兰州牛肉面" /></label>
          <label className="field"><span>城市</span><input value={draft.city} onChange={setD('city')} placeholder="苏州" /></label>
          <label className="field"><span>商圈/地址</span><input value={draft.area} onChange={setD('area')} placeholder="相城区元和街道XX路" /></label>
        </div>
        <label className="field"><span>老板/品牌人设 <i>*</i></span><input value={draft.persona} onChange={setD('persona')} placeholder="在苏州开店的兰州人，只做正宗牛大" /></label>
        <label className="field"><span>真实招牌（带细节）<i>*</i></span>
          {draft.signatures.map((v, i) => <input key={i} value={v} onChange={setArr('signatures', i)} placeholder={`招牌 ${i + 1}：如 牛肉面（汤每天凌晨现熬）`} style={{ marginBottom: 6 }} />)}
        </label>
        <label className="field"><span>真实差异点</span>
          {draft.differentiators.map((v, i) => <input key={i} value={v} onChange={setArr('differentiators', i)} placeholder={`差异点 ${i + 1}：如 蓬灰和面不用碱`} style={{ marginBottom: 6 }} />)}
        </label>
        <label className="field"><span>可拍成视频的真实亮点/故事</span>
          {draft.highlights.map((v, i) => <input key={i} value={v} onChange={setArr('highlights', i)} placeholder={`亮点 ${i + 1}：如 老板凌晨3点到店熬汤`} style={{ marginBottom: 6 }} />)}
        </label>
        <label className="field"><span>引流/到店信息（结尾互动带出）<i>*</i></span><textarea rows={2} value={draft.landing} onChange={setD('landing')} placeholder="主页有定位；到店报『抖音』送小菜；评论区问地址" /></label>

        <div className="grid2">
          <label className="field"><span>目标人群</span><input value={draft.audience} onChange={setD('audience')} placeholder="本地上班族 + 想吃正宗牛肉面的人" /></label>
          <label className="field"><span>口播/语气风格</span><select value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        </div>
        <label className="field"><span>制作条件（决定可产的内容类型）</span>
          <select value={cond} onChange={(e) => setCond(e.target.value)}>{CONDS.map((c) => <option key={c} value={c}>{condLabel(c)}</option>)}</select>
        </label>

        {draft.tabooConfirmed ? <div className="hintWarn">⚠️ 素材里疑似夸大宣传：{draft.tabooConfirmed}。阿抖不会写进脚本。</div> : null}
        {err ? <div className="hintErr">{err}</div> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btnGhost" onClick={() => { setDraft(null); setErr(''); }}>← 重新提供素材</button>
          <button className="btn btnPrimary" style={{ flex: 1 }} onClick={confirmHire}>档案没问题，正式入职</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card formCard">
      <div className="formHead">
        <h2>入职登记 · 岗前培训</h2>
        <p>给阿抖一个链接或几张截图，她先读懂你的品牌——这样拍出来的每一条，都是<b>你家的真东西</b>。</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', margin: '4px 0 14px', background: 'rgba(46,164,79,.07)', border: '1px solid rgba(46,164,79,.3)', borderRadius: 10, fontSize: 13 }}>
        <span>🧬 <b>已在司南建好品牌DNA？</b>不用重新登记——</span>
        <button className="btn btnPrimary btnSmall" onClick={pasteDna}>📋 粘贴导入，直接上岗</button>
        <button className="btn btnGhost btnSmall" onClick={() => dnaFileRef.current?.click()}>⬆ DNA文件</button>
        <input ref={dnaFileRef} type="file" accept=".json,application/json" hidden onChange={pickDnaFile} />
      </div>

      </div>
      <div className="segTabs">
        <button className={`segTab ${mode === 'smart' ? 'on' : ''}`} onClick={() => setMode('smart')}>🔗 贴链接 / 传截图</button>
        <button className={`segTab ${mode === 'manual' ? 'on' : ''}`} onClick={() => setMode('manual')}>✍️ 直接手填</button>
      </div>

      {mode === 'smart' ? (
        <>
          <label className="field"><span>主体链接（官网 / 店铺 / 公众号文章皆可）</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… 官网或一篇公众号推文链接" />
          </label>
          <div className="hintNote" style={{ marginTop: -4 }}>💡 大众点评等链接常因反爬抓不到，<b>最稳的是上传截图或资料文档</b>：点评/店铺页、产品页、门头菜单，或介绍PDF、产品资料Word/Excel都行（多模态识别）。</div>
          <label className="field"><span>上传图片 / 资料文档（图片最多4张，支持 PDF/Word/Excel/PPT/txt）</span>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple onChange={pickFiles} />
          </label>
          {images.length ? (
            <div className="thumbRow">
              {images.map((src, i) => (
                <div className="thumb" key={i}><img src={src} alt="" /><button onClick={() => setImages(images.filter((_, j) => j !== i))}>×</button></div>
              ))}
            </div>
          ) : null}

          {texts.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {texts.map((t, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.08)' }}>
                  📄 {t.name}
                  <button onClick={() => setTexts(texts.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
          ) : null}
          {note ? <div className="hintNote">ℹ️ {note}</div> : null}
          {err ? <div className="hintErr">{err}</div> : null}
          <button className="btn btnPrimary" onClick={extract} disabled={busy}>{busy ? '阿抖正在读资料…' : '让阿抖读取素材 →'}</button>
        </>
      ) : (
        <>
          <div className="hintNote">手填也可以，下一步进档案表，按提示填真实信息即可。</div>
          {err ? <div className="hintErr">{err}</div> : null}
          <button className="btn btnPrimary" onClick={startManual}>开始手动填写 →</button>
        </>
      )}
    </div>
  );
}
