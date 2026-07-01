'use client';
import { useState, useRef } from 'react';
import { extractVideoFrames, imageToDataUrl } from '@/lib/videoFrames';
import { runEditFromAssets } from '@/lib/pipeline';

export default function AssetsStudio({ profile }) {
  const [assets, setAssets] = useState([]);
  const [theme, setTheme] = useState('');
  const [tone, setTone] = useState('亲切真实、像本店老板在分享');
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const [plan, setPlan] = useState(null);
  const [draft, setDraft] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [composing, setComposing] = useState(false);   // 正在云端合成
  const [composeMsg, setComposeMsg] = useState('');     // 合成进度文字
  const [videoUrl, setVideoUrl] = useState('');         // 成片下载地址
  const COMPOSE_API = process.env.NEXT_PUBLIC_COMPOSE_API || '';  // 合成后端地址（配了才有一键合成）
  const [error, setError] = useState('');
  const [bgmFile, setBgmFile] = useState(null);
  const stopRef = useRef({ stop: false });
  const fileRef = useRef(null);
  const bgmRef = useRef(null);

  const log = (m, t) => setLogs((l) => [...l, { m, t, k: Date.now() + Math.random() }]);

  async function onPick(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setStatus('reading'); setError('');
    const next = [...assets];
    for (const file of files) {
      const isVideo = file.type.startsWith('video');
      const id = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      try {
        if (isVideo) {
          const { frames, duration } = await extractVideoFrames(file, 3);
          next.push({ id, file, name: file.name, kind: 'video', thumb: frames[0], frames, dur: duration });
        } else if (file.type.startsWith('image')) {
          const dataUrl = await imageToDataUrl(file);
          next.push({ id, file, name: file.name, kind: 'image', thumb: dataUrl, frames: [dataUrl] });
        }
      } catch (err) { log(`素材 ${file.name} 读取失败：${err.message}`, 'warn'); }
    }
    setAssets(next); setStatus('idle');
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeAsset(id) { setAssets((a) => a.filter((x) => x.id !== id)); }

  async function generate() {
    if (!assets.length) { setError('先上传一些素材（图片 / 视频）'); return; }
    setStatus('working'); setError(''); setLogs([]); setPlan(null); setDraft(null); setConfirmed(false);
    stopRef.current.stop = false;
    try {
      await runEditFromAssets({
        profile,
        assets: assets.map((a, i) => ({ idx: i + 1, file: a.name, kind: a.kind, frames: a.frames, dur: a.dur })),
        theme, tone,
        onLog: log,
        onResult: (p) => {
          setPlan(p);
          const caps = {};
          (p.captions || []).forEach((c) => { if (Number.isInteger(c.idx)) caps[c.idx] = c.sub || ''; });
          setDraft({
            title: p.title || '',
            tags: (p.tags || []).join(' '),
            narration: p.narration || '',
            order: (p.order && p.order.length) ? p.order : assets.map((_, i) => i + 1),
            caps,
          });
        },
        shouldStop: () => stopRef.current.stop,
      });
      setStatus('done');
    } catch (e) { setError(e.message || '生成失败'); setStatus('idle'); }
  }
  function stop() { stopRef.current.stop = true; }

  function setDraftField(k, v) { setDraft((d) => ({ ...d, [k]: v })); setConfirmed(false); }
  function setCap(idx, v) { setDraft((d) => ({ ...d, caps: { ...d.caps, [idx]: v } })); setConfirmed(false); }
  function moveShot(pos, dir) {
    setDraft((d) => {
      const order = [...d.order];
      const j = pos + dir;
      if (j < 0 || j >= order.length) return d;
      [order[pos], order[j]] = [order[j], order[pos]];
      return { ...d, order };
    });
    setConfirmed(false);
  }

  function exportForEngine() {
    if (!draft) return;
    const shots = draft.order.map((idx) => {
      const a = assets[idx - 1];
      if (!a) return null;
      return { file: a.name, sub: draft.caps[idx] || '' };
    }).filter(Boolean);
    const pyLines = shots.map((sh) => `    {"file": "${sh.file}", "sub": "${(sh.sub || '').replace(/"/g, '\\"')}"},`).join('\n');
    const pyBlock = `SHOTS = [\n${pyLines}\n]`;
    const content = [
      '═══ 阿抖剪辑配置 ═══', '',
      '【用法】把下面这段 SHOTS 整段复制，替换掉卡点引擎脚本里的 SHOTS = [] 那一段；',
      '素材（文件名与下面一致）放进「素材」文件夹 + 一首 bgm.mp3，跑脚本即出片。', '',
      '─── 复制这段到卡点引擎 ───', pyBlock, '',
      '─── 完整方案（备查）───',
      '标题：' + draft.title,
      '话题：' + draft.tags,
      '文案：' + draft.narration, '',
      '分镜：',
      ...shots.map((sh, i) => `  ${i + 1}. ${sh.file} -> ${sh.sub}`),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `阿抖剪辑配置_${draft.title || '未命名'}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }

  // 【全自动】把素材+方案发给合成后端，等成片回来
  async function composeOnCloud() {
    if (!draft || !COMPOSE_API) return;
    setComposing(true); setComposeMsg('正在上传素材…'); setVideoUrl('');
    try {
      // 组装 shots（按顺序，带字幕）
      const shots = draft.order.map((idx) => {
        const a = assets[idx - 1];
        return a ? { file: a.name, sub: draft.caps[idx] || '' } : null;
      }).filter(Boolean);

      const fd = new FormData();
      // 上传所有素材的原始文件
      const usedNames = new Set(shots.map((s) => s.file));
      for (const a of assets) {
        if (usedNames.has(a.name)) fd.append('files', a.file, a.name);
      }
      // BGM：用户要放一首；这里先要求页面已选 bgm（见下方 bgmFile）
      if (!bgmFile) { setComposeMsg('请先选一首背景音乐（BGM）'); setComposing(false); return; }
      fd.append('bgm', bgmFile, bgmFile.name);
      fd.append('plan', JSON.stringify({ shots, opts: { burn_sub: true } }));

      setComposeMsg('素材上传中，合成马上开始…');
      const res = await fetch(`${COMPOSE_API}/compose`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`提交失败 HTTP ${res.status}`);
      const { job_id } = await res.json();
      if (!job_id) throw new Error('没拿到任务号');

      // 轮询状态（最多等15分钟，视频转码较慢）
      let tries = 0;
      const MAX_TRIES = 450;  // 450 * 2秒 = 15分钟
      while (tries < MAX_TRIES) {
        await new Promise((r) => setTimeout(r, 2000));
        tries++;
        const elapsed = Math.floor(tries * 2 / 60);
        const secs = (tries * 2) % 60;
        setComposeMsg(`阿抖正在合成视频…（已用时 ${elapsed}分${secs}秒；素材含视频时需先转码，请耐心等）`);
        const st = await fetch(`${COMPOSE_API}/status/${job_id}`).then((r) => r.json()).catch(() => null);
        if (!st) continue;
        if (st.status === 'done') {
          setVideoUrl(`${COMPOSE_API}${st.download}`);
          setComposeMsg(`✓ 成片完成！时长约 ${st.duration}s${st.burn_sub ? '（已烧字幕）' : ''}${st.skipped && st.skipped.length ? `（${st.skipped.length}个素材因格式问题跳过）` : ''}`);
          setComposing(false);
          return;
        }
        if (st.status === 'error') throw new Error(st.message || '合成出错');
      }
      throw new Error('合成超时（15分钟）。素材可能太多，建议减少素材数量再试。');
    } catch (e) {
      setComposeMsg('合成失败：' + (e.message || e));
      setComposing(false);
    }
  }

  const descOf = (idx) => (plan?._assets || []).find((x) => x.idx === idx)?.desc || '';
  const working = status === 'working';
  const reading = status === 'reading';

  return (
    <div className="as">
      <p className="as-lead">丢给阿抖你随手拍的素材 + 一句主题，阿抖看懂画面、组织文案，给你一份可改的内容方案。</p>

      <section className="as-sec">
        <div className="as-secHd"><span className="as-secNo">1</span>素材<em>图片、视频都行</em></div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={onPick} hidden />
        {assets.length === 0 ? (
          <button className="as-drop" onClick={() => fileRef.current?.click()} disabled={reading || working}>
            <span className="as-dropIcon">＋</span>
            <span>{reading ? '读取中…' : '点此添加素材'}</span>
          </button>
        ) : (
          <>
            <div className="as-grid">
              {assets.map((a, i) => (
                <figure className="as-item" key={a.id}>
                  <div className="as-thumb" style={{ backgroundImage: `url(${a.thumb})` }}>
                    <span className="as-badge">{a.kind === 'video' ? `▶ ${a.dur}s` : '图'}</span>
                    <button className="as-x" onClick={() => removeAsset(a.id)} aria-label="删除">×</button>
                  </div>
                  <figcaption>{i + 1}</figcaption>
                </figure>
              ))}
              <button className="as-add" onClick={() => fileRef.current?.click()} disabled={reading || working}>＋</button>
            </div>
            <div className="as-count">共 {assets.length} 个素材{reading && ' · 读取中…'}</div>
          </>
        )}
      </section>

      <section className="as-sec">
        <div className="as-secHd"><span className="as-secNo">2</span>主题<em>一句话，说这条想讲什么</em></div>
        <input className="as-input" value={theme} onChange={(e) => setTheme(e.target.value)}
               placeholder="如：今天新上了牛肉煲 / 周末买一送一 / 发发店里日常" />
        <input className="as-input as-input--sub" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="文风（可改）" />
      </section>

      <button className={`btn btnBig ${working ? 'btnGhost' : 'btnPrimary'}`} onClick={working ? stop : generate} disabled={reading}>
        {working ? '■ 阿抖正在看素材、组织语言… 点此停' : status === 'done' ? '重新生成' : '阿抖，把素材做成内容'}
      </button>
      {error && <div className="hintErr">{error}</div>}

      {logs.length > 0 && !draft && (
        <div className="as-logs">
          {logs.map((l) => <div key={l.k} className={`as-log as-log--${l.t || 'i'}`}>{l.m}</div>)}
        </div>
      )}

      {draft && (
        <section className="as-plan">
          <header className="as-planHd">
            <h3>内容方案</h3>
            <span className="as-planTip">可直接修改 · 满意后确认导出</span>
          </header>

          <label className="as-field">
            <span className="as-label">标题</span>
            <input className="as-input as-input--title" value={draft.title} onChange={(e) => setDraftField('title', e.target.value)} />
          </label>

          <label className="as-field">
            <span className="as-label">话题标签</span>
            <input className="as-input" value={draft.tags} onChange={(e) => setDraftField('tags', e.target.value)} placeholder="#话题 空格分隔" />
          </label>

          <label className="as-field">
            <span className="as-label">口播 / 旁白文案</span>
            <textarea className="as-textarea" rows={5} value={draft.narration} onChange={(e) => setDraftField('narration', e.target.value)} />
          </label>

          <div className="as-field">
            <span className="as-label">分镜顺序 + 字幕<em className="as-labelEm">字幕可改，▲▼ 调顺序</em></span>
            <ol className="as-shots">
              {draft.order.map((idx, pos) => {
                const a = assets[idx - 1];
                if (!a) return null;
                return (
                  <li className="as-shot" key={a.id}>
                    <span className="as-shotNo">{pos + 1}</span>
                    <div className="as-shotThumb" style={{ backgroundImage: `url(${a.thumb})` }}>
                      {a.kind === 'video' && <span className="as-shotPlay">▶</span>}
                    </div>
                    <div className="as-shotMain">
                      <div className="as-shotDesc">{descOf(idx)}</div>
                      <input className="as-shotCap" value={draft.caps[idx] || ''} onChange={(e) => setCap(idx, e.target.value)} placeholder="这一镜的字幕" />
                    </div>
                    <div className="as-shotMove">
                      <button onClick={() => moveShot(pos, -1)} disabled={pos === 0} aria-label="上移">▲</button>
                      <button onClick={() => moveShot(pos, 1)} disabled={pos === draft.order.length - 1} aria-label="下移">▼</button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {plan?.tip && <div className="hintWarn">💡 {plan.tip}</div>}

          <div className="as-confirm">
            {!confirmed ? (
              <button className="btn btnPrimary btnBig" onClick={() => setConfirmed(true)}>✓ 确认这份方案</button>
            ) : COMPOSE_API ? (
              <>
                {/* 全自动：选BGM → 一键合成 */}
                <input ref={bgmRef} type="file" accept="audio/*" onChange={(e) => setBgmFile(e.target.files?.[0] || null)} hidden />
                <div className="as-bgmRow">
                  <button className="btn btnGhost" onClick={() => bgmRef.current?.click()} disabled={composing}>
                    🎵 {bgmFile ? `已选：${bgmFile.name}` : '选一首背景音乐'}
                  </button>
                </div>
                {!videoUrl ? (
                  <button className="btn btnPrimary btnBig" onClick={composeOnCloud} disabled={composing || !bgmFile}>
                    {composing ? '⏳ 合成中…' : '🎬 一键合成视频'}
                  </button>
                ) : null}
                {composeMsg && <div className={`as-composeMsg ${videoUrl ? 'ok' : ''}`}>{composeMsg}</div>}
                {videoUrl && (
                  <div className="as-result">
                    <video className="as-video" src={videoUrl} controls playsInline />
                    <a className="btn btnPrimary btnBig" href={videoUrl} download="阿抖成片.mp4">⬇ 下载成片</a>
                    <button className="btn btnGhost btnSmall" onClick={() => { setVideoUrl(''); setComposeMsg(''); }}>重新合成</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="as-confirmOk">✓ 已确认</div>
                <button className="btn btnPrimary btnBig" onClick={exportForEngine}>⬇ 导出剪辑配置</button>
                <p className="as-exportNote">（未配置合成后端，先用导出方式）把配置里的 SHOTS 贴进卡点引擎，素材 + bgm.mp3 放好跑一下出片。</p>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
