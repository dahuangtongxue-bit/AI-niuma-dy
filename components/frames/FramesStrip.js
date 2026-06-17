'use client';

import { useRef, useState } from 'react';
import { FRAMES, PALETTES } from './templates';

const W = 1080;
const H = 1920;

function normalize(card) {
  if (!card) return null;
  const tpl = String(card.tpl || 'F_COVER').replace(/-/g, '_').toUpperCase();
  return { ...card, tpl: FRAMES[tpl] ? tpl : 'F_COVER', title: (card.title || '').slice(0, 14) };
}

/**
 * 字卡条：cover + 各分镜字卡的预览/下载
 * props: cards = [{tpl, title, highlight, sub, points, num, unit, badge, label}], scheme, filename
 */
export default function FramesStrip({ cards, scheme = 'noir', filename = '字卡' }) {
  const refs = useRef([]);
  const [busy, setBusy] = useState('');
  const p = PALETTES[scheme] || PALETTES.noir;
  const list = (cards || []).map(normalize).filter(Boolean);
  const previewW = 150;
  const scale = previewW / W;

  async function exportOne(i) {
    const node = refs.current[i];
    if (!node || busy) return;
    setBusy(`one-${i}`);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(node, { width: W, height: H, pixelRatio: 1, cacheBust: true, style: { transform: 'none' } });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${String(i).padStart(2, '0')}_${list[i].label || FRAMES[list[i].tpl].name}.png`;
      a.click();
    } catch (e) { /* 重试即可 */ } finally { setBusy(''); }
  }

  async function exportZip() {
    if (busy) return;
    setBusy('zip');
    try {
      const [{ toPng }, { default: JSZip }] = await Promise.all([import('html-to-image'), import('jszip')]);
      const zip = new JSZip();
      for (let i = 0; i < list.length; i++) {
        const node = refs.current[i];
        if (!node) continue;
        const url = await toPng(node, { width: W, height: H, pixelRatio: 1, cacheBust: true, style: { transform: 'none' } });
        zip.file(`${String(i).padStart(2, '0')}_${list[i].label || 'card'}.png`, url.split(',')[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}_字卡包_1080x1920.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { /* 忽略，可重试 */ } finally { setBusy(''); }
  }

  if (list.length === 0) return null;

  return (
    <div className="framesBlock">
      <div className="framesStrip">
        {list.map((card, i) => {
          const Comp = FRAMES[card.tpl].Comp;
          return (
            <div className="frameCell" key={i}>
              <div className="frameViewport" style={{ width: previewW, height: H * scale }}>
                <div
                  ref={(el) => { refs.current[i] = el; }}
                  style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                >
                  <Comp d={card} p={p} />
                </div>
              </div>
              <button className="linkBtn frameDl" onClick={() => exportOne(i)} disabled={!!busy}>
                {busy === `one-${i}` ? '出图…' : (card.label || `卡${i}`) + ' ↓'}
              </button>
            </div>
          );
        })}
      </div>
      <button className="btn btnGhost btnSmall" onClick={exportZip} disabled={!!busy} style={{ marginTop: 8 }}>
        {busy === 'zip' ? '正在打包出图…' : `打包下载全部 ${list.length} 张字卡（zip）`}
      </button>
    </div>
  );
}
