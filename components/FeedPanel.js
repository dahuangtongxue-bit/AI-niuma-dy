'use client';

import { useState } from 'react';

// 文风预设：给固定选项 + 自定义
export const TONE_PRESETS = [
  { key: 'real', label: '亲切真实', hint: '像本地老板/熟人分享，口语、有细节、不端着' },
  { key: 'review', label: '专业测评', hint: '理性对比、有维度、给结论，可信感强' },
  { key: 'funny', label: '搞笑玩梗', hint: '夸张、自嘲、网感强，适合年轻人' },
  { key: 'literary', label: '文艺细腻', hint: '画面感、情绪、慢节奏，适合氛围向' },
  { key: 'custom', label: '自己描述…', hint: '' },
];

const STRUCTURES = [
  { key: 'auto', label: '让阿抖自己定' },
  { key: '真人口播', label: '真人口播' },
  { key: '图文成片', label: '图文成片（轮播字卡）' },
  { key: '探店vlog', label: '探店/制作过程 Vlog' },
  { key: '剧情演绎', label: '剧情演绎' },
];

export default function FeedPanel({ working, onProduce, onStop }) {
  const [images, setImages] = useState([]); // {dataUrl, asCover}
  const [theme, setTheme] = useState('');
  const [structure, setStructure] = useState('auto');
  const [toneKey, setToneKey] = useState('real');
  const [toneCustom, setToneCustom] = useState('');
  const [useAIImage, setUseAIImage] = useState(false);
  const [err, setErr] = useState('');

  function pickFiles(e) {
    const files = [...(e.target.files || [])].slice(0, 6 - images.length);
    Promise.all(files.map((f) => new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(f);
    }))).then((urls) => {
      setImages((prev) => {
        const next = [...prev, ...urls.map((u) => ({ dataUrl: u, asCover: false }))].slice(0, 6);
        // 默认第一张作封面
        if (next.length && !next.some((x) => x.asCover)) next[0].asCover = true;
        return next;
      });
    });
  }

  function setCover(i) {
    setImages(images.map((x, j) => ({ ...x, asCover: j === i })));
  }
  function removeImg(i) {
    const next = images.filter((_, j) => j !== i);
    if (next.length && !next.some((x) => x.asCover)) next[0].asCover = true;
    setImages(next);
  }

  function go() {
    setErr('');
    if (!theme.trim()) { setErr('给这一篇一个主题/角度，阿桃才知道写什么'); return; }
    if (toneKey === 'custom' && !toneCustom.trim()) { setErr('选了"自己描述"，请填一下想要的文风'); return; }

    const toneObj = TONE_PRESETS.find((t) => t.key === toneKey);
    const tone = toneKey === 'custom' ? toneCustom.trim() : `${toneObj.label}（${toneObj.hint}）`;
    const cover = images.find((x) => x.asCover);
    const feed = {
      theme: theme.trim(),
      structure: STRUCTURES.find((s) => s.key === structure).label,
      structureKey: structure,
      tone,
      photos: images.map((x) => x.dataUrl),
      coverDataUrl: cover ? cover.dataUrl : '',
      useAIImage: useAIImage || images.length === 0, // 没传图则强制走AI兜底
    };
    onProduce(feed);
  }

  return (
    <div className="feedPanel">
      <div className="feedRow">
        <div className="feedField">
          <div className="sectionLabel">① 本篇照片（做正文素材，第一张默认当封面字卡底图）</div>
          <input type="file" accept="image/*" multiple onChange={pickFiles} disabled={working} />
          {images.length ? (
            <div className="feedThumbs">
              {images.map((x, i) => (
                <div className={`feedThumb ${x.asCover ? 'isCover' : ''}`} key={i}>
                  <img src={x.dataUrl} alt="" onClick={() => setCover(i)} title="点此设为封面底图" />
                  {x.asCover ? <span className="coverTag">封面</span> : null}
                  <button className="thumbDel" onClick={() => removeImg(i)}>×</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="feedNoImg">没传图也能写，封面字卡会用纯色版式（可能较慢）。建议传 1-3 张你店里的真实照片。</div>
          )}
          {images.length ? (
            <label className="feedCheck">
              <input type="checkbox" checked={useAIImage} onChange={(e) => setUseAIImage(e.target.checked)} disabled={working} />
              封面字卡改用纯色版式（默认用你选的真实照片）
            </label>
          ) : null}
        </div>
      </div>

      <div className="feedRow feedRow2">
        <div className="feedField">
          <div className="sectionLabel">② 本篇主题 / 角度 <i>*</i></div>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例：牛肉面隐藏吃法 / 老板凌晨4点熬汤 / 5块钱加面随便加"
            disabled={working}
          />
        </div>
        <div className="feedField feedFieldSm">
          <div className="sectionLabel">③ 结构（可选）</div>
          <select value={structure} onChange={(e) => setStructure(e.target.value)} disabled={working}>
            {STRUCTURES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="feedRow">
        <div className="feedField">
          <div className="sectionLabel">④ 文风</div>
          <div className="toneChips">
            {TONE_PRESETS.map((t) => (
              <button
                key={t.key}
                className={`toneChip ${toneKey === t.key ? 'on' : ''}`}
                onClick={() => setToneKey(t.key)}
                disabled={working}
                title={t.hint}
              >{t.label}</button>
            ))}
          </div>
          {toneKey === 'custom' ? (
            <input
              style={{ marginTop: 8 }}
              value={toneCustom}
              onChange={(e) => setToneCustom(e.target.value)}
              placeholder="描述你想要的感觉，例：像发朋友圈一样随意，带点东北话的幽默"
              disabled={working}
            />
          ) : null}
        </div>
      </div>

      {err ? <div className="hintErr">{err}</div> : null}

      <button
        className={`btn btnBig ${working ? 'btnStop' : 'btnPrimary'}`}
        onClick={working ? onStop : go}
        style={{ width: '100%' }}
      >
        {working ? '⏹ 阿抖创作中…点此叫停' : '让阿抖写这一条 →'}
      </button>
    </div>
  );
}
