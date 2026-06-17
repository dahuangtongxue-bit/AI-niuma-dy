'use client';

import { useState } from 'react';
import FramesStrip from './frames/FramesStrip';
import { HOOK_CATS } from '@/lib/hooks';
import { SCRIPT_TEMPLATES } from '@/lib/scriptTemplates';

function CopyBtn({ text, label = '复制' }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch (e) { /* 忽略 */ }
  }
  return (
    <button className="btn btnGhost btnSmall" onClick={copy}>
      {done ? '已复制 ✓' : label}
    </button>
  );
}

const JY_STEPS = {
  default: ['新建项目，按分镜表顺序导入素材/字卡', '逐镜对齐时间轴（看分镜表 start/end）', '添加"文本朗读"：粘贴完整台词，选与账号语气匹配的音色', '自动识别字幕并校对', '从抖音热门 BGM 榜挑一条卡点', '导出 1080P，按发布建议时段发出'],
  图文成片: ['下载字卡包 zip，按编号顺序导入剪映', '每张字卡设 3~4 秒（封面 2 秒、结尾卡 3 秒）', '添加"文本朗读"：粘贴完整台词（单卡单句已对齐）', '选热门 BGM，开"自动踩点"对齐切换', '自动字幕校对后导出发布'],
};

export default function ScriptCard({ note, index }) {
  const [showLosers, setShowLosers] = useState(false);
  const [showJY, setShowJY] = useState(false);

  const shots = note.script?.shots || [];
  const tpl = SCRIPT_TEMPLATES[note.script?.template];
  const fullLines = shots.map((s) => s.line).filter(Boolean).join('\n');
  const tsv = ['镜号\t时间\t景别\t画面\t台词\t字幕\t音效\t素材来源']
    .concat(shots.map((s) => [s.no, `${s.start}-${s.end}s`, s.scene, s.visual, s.line, s.sub, s.sfx || '', s.src || ''].map((x) => String(x ?? '').replace(/\t|\n/g, ' ')).join('\t')))
    .join('\n');
  const steps = JY_STEPS[note.topic.type] || JY_STEPS.default;

  return (
    <div className="card noteCard">
      <div className="noteHead">
        <span className="noteIndex mono">交付 {String(index + 1).padStart(2, '0')}</span>
        <span className="noteTopic">{note.topic.title}</span>
        <span className="chip">{note.topic.type}</span>
        {note.topic.source ? <span className="chip">{note.topic.source}</span> : null}
        {tpl ? <span className="chip">模板{tpl.id}·约{note.qc?.duration || ''}s</span> : null}
        <span className="chip">{note.hookCat}类·{HOOK_CATS[note.hookCat]}</span>
      </div>

      <div className="publishBar">
        <div className="publishSteps">
          <span className="pStep">① 复制完整台词 → 剪映「文本朗读」配音</span>
          <span className="pStep">② 下方字卡按编号导入</span>
          <span className="pStep">③ 套 BGM 导出 → 发抖音</span>
        </div>
        <div className="publishBtns">
          <CopyBtn text={fullLines} label="📋 复制完整台词（配音用）" />
          <CopyBtn text={note.title + '\n' + note.hashtags.map((t) => (t.startsWith('#') ? t : '#' + t)).join(' ')} label="复制标题+话题" />
        </div>
      </div>

      {/* Hook 定稿 */}
      <div className="hookQuote">
        <div className="hookLabel">黄金3秒 · 定稿 <span className={`scoreBadge ${note.winner.total >= 9 ? 'scoreHigh' : ''}`}>{note.winner.total}分</span> <span className="hookName mono">{note.winner.hookName}</span></div>
        <div className="hookText">「{note.winner.text}」</div>
      </div>
      <button className="linkBtn" onClick={() => setShowLosers(!showLosers)}>
        {showLosers ? '收起落选 Hook ▲' : `查看落选的 ${note.losers.length} 条 Hook 及原因 ▼`}
      </button>
      {showLosers ? (
        <div className="rejectedBox">
          {note.losers.map((h, i) => (
            <div className="rejectedRow" key={i}>
              <span className="mono rejectedScore">{h.total}分</span>
              <span className="rejectedText">{h.text}</span>
              {h.reasons?.length ? <span className="rejectedWhy">{h.reasons[0]}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* 标题与标签 */}
      <div className="sectionLabel" style={{ marginTop: 16 }}>标题（{note.formula || '—'}） <CopyBtn text={note.title} /></div>
      <div className="dyTitle">{note.title}</div>
      <div className="tagRow" style={{ marginTop: 8 }}>
        {note.hashtags.map((t, i) => (
          <span className="chip" key={i}>{t}</span>
        ))}
        <CopyBtn text={note.hashtags.join(' ')} label="复制标签" />
      </div>

      {/* 质检报告 */}
      <div className="sectionLabel" style={{ marginTop: 18 }}>质检报告（硬规则机检）</div>
      <div className="qcGrid">
        {(note.qc?.rules || []).map((r) => (
          <div className={`qcChip ${r.pass ? 'qcPass' : 'qcFail'}`} key={r.id} title={r.detail}>
            {r.pass ? '✓' : '✗'} {r.name}
          </div>
        ))}
      </div>
      {(note.qc?.rules || []).filter((r) => !r.pass).map((r) => (
        <div className="hintWarn" key={r.id}>✗ {r.name}：{r.detail}</div>
      ))}

      {/* 字卡 */}
      {note.cards?.length ? (
        <>
          <div className="sectionLabel" style={{ marginTop: 18 }}>字卡（1080×1920 · {note.scheme}）· 下方可一键打包下载</div>
          <FramesStrip cards={note.cards} scheme={note.scheme} filename={`剧本${index + 1}`} />
        </>
      ) : null}

      {/* 投喂的真实照片素材 */}
      {note.photos?.length ? (
        <>
          <div className="sectionLabel" style={{ marginTop: 18 }}>本条真实素材（点图下载，导入剪映）</div>
          <div className="notePhotosRow">
            {note.photos.map((src, i) => (
              <a href={src} download={`剧本${index + 1}_素材${i + 1}.jpg`} key={i} title="点击下载"><img src={src} alt="" /></a>
            ))}
          </div>
        </>
      ) : null}

      {/* 分镜表 */}
      <div className="sectionLabel" style={{ marginTop: 18 }}>
        分镜表 <CopyBtn text={fullLines} label="复制完整台词（配音用）" /> <CopyBtn text={tsv} label="复制分镜表（可贴表格）" />
      </div>
      <div className="shotTableWrap">
        <table className="shotTable">
          <thead>
            <tr><th>镜</th><th>时间</th><th>画面</th><th>台词</th></tr>
          </thead>
          <tbody>
            {shots.map((s) => (
              <tr key={s.no}>
                <td className="mono">{s.no}</td>
                <td className="mono">{s.start}-{s.end}s</td>
                <td className="shotVisual">{s.scene}｜{s.visual}{s.src ? <i className="shotSrc">［{s.src}］</i> : null}</td>
                <td>{s.line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 剪映指引 */}
      <button className="linkBtn" onClick={() => setShowJY(!showJY)}>
        {showJY ? '收起剪映组装指引 ▲' : '展开剪映组装指引（约10分钟成片）▼'}
      </button>
      {showJY ? (
        <div className="rejectedBox">
          {steps.map((s, i) => (
            <div className="jyStep" key={i}><span className="mono">{i + 1}.</span> {s}</div>
          ))}
          {note.jianying ? <div className="jyStep"><span className="mono">★</span> {note.jianying}</div> : null}
        </div>
      ) : null}

      {note.tip ? <div className="tipLine">📮 发布建议：{note.tip}</div> : null}
    </div>
  );
}
