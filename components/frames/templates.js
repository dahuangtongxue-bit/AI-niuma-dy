// 字卡工厂：抖音 9:16 字卡/封面模板（1080×1920）
// 安全区：顶部 13%、底部 19%、右侧 12% 为抖音 UI 遮挡位，关键信息避开

const SANS = "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif";

export const PALETTES = {
  noir:  { bg: '#141414', ink: '#FFFFFF', accent: '#FE2C55', soft: 'rgba(254,44,85,.18)', sub: 'rgba(255,255,255,.72)' },
  cyber: { bg: 'linear-gradient(170deg,#0D1B2E 0%,#090F1E 100%)', ink: '#FFFFFF', accent: '#25F4EE', soft: 'rgba(37,244,238,.16)', sub: 'rgba(255,255,255,.72)' },
  cream: { bg: 'linear-gradient(165deg,#FFF6E0 0%,#FFE2AE 100%)', ink: '#2B1D0E', accent: '#E8590C', soft: 'rgba(232,89,12,.14)', sub: 'rgba(43,29,14,.7)' },
  mint:  { bg: 'linear-gradient(165deg,#E9FBF2 0%,#C5F2DD 100%)', ink: '#0A3D2E', accent: '#F76707', soft: 'rgba(10,61,46,.10)', sub: 'rgba(10,61,46,.7)' },
  paper: { bg: '#F5EFE0', ink: '#3A332A', accent: '#C92A2A', soft: 'rgba(58,51,42,.10)', sub: 'rgba(58,51,42,.7)' },
};

function sizeFor(t) {
  const n = (t || '').length;
  if (n <= 5) return 200;
  if (n <= 7) return 175;
  if (n <= 9) return 150;
  if (n <= 12) return 125;
  return 105;
}

function Title({ text, highlight, p, size }) {
  const fs = size || sizeFor(text);
  const base = { fontSize: fs, fontWeight: 900, lineHeight: 1.22, letterSpacing: 2, color: p.ink, wordBreak: 'break-all' };
  if (highlight && text && text.includes(highlight)) {
    const i = text.indexOf(highlight);
    return (
      <div style={base}>
        {text.slice(0, i)}
        <span style={{ color: p.accent, backgroundImage: `linear-gradient(transparent 62%, ${p.soft} 62%)` }}>{highlight}</span>
        {text.slice(i + highlight.length)}
      </div>
    );
  }
  return <div style={base}>{text}</div>;
}

// 9:16 画布 + 抖音 UI 安全区内边距
const frame = (p, extra) => ({
  width: 1080,
  height: 1920,
  background: p.bg,
  fontFamily: SANS,
  color: p.ink,
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  overflow: 'hidden',
  position: 'relative',
  padding: '260px 200px 380px 100px',
  ...extra,
});

/* F_COVER 封面/Hook大字报 */
function F_COVER({ d, p }) {
  return (
    <div style={frame(p, { justifyContent: 'center', gap: 56 })}>
      <div style={{ alignSelf: 'flex-start', border: `5px solid ${p.accent}`, color: p.accent, borderRadius: 12, padding: '12px 32px', fontSize: 44, fontWeight: 900, transform: 'rotate(-4deg)' }}>
        {d.badge || '今日干货'}
      </div>
      <Title text={d.title} highlight={d.highlight} p={p} />
      {d.sub ? <div style={{ fontSize: 56, fontWeight: 500, color: p.sub }}>{d.sub}</div> : null}
      <div style={{ position: 'absolute', bottom: 300, left: 100, fontSize: 44, color: p.sub }}>完整版看到最后 ▸</div>
    </div>
  );
}

/* F_POINT 序号要点卡（图文成片主力帧） */
function F_POINT({ d, p }) {
  return (
    <div style={frame(p, { justifyContent: 'center', gap: 48 })}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
        <span style={{ fontSize: 230, fontWeight: 900, lineHeight: 1, color: p.accent, textShadow: `0 12px 0 ${p.soft}` }}>{d.num || '1'}</span>
        <span style={{ fontSize: 52, fontWeight: 700, color: p.sub }}>{d.badge || ''}</span>
      </div>
      <Title text={d.title} highlight={d.highlight} p={p} size={Math.min(sizeFor(d.title), 130)} />
      {d.sub ? <div style={{ fontSize: 52, lineHeight: 1.6, color: p.sub }}>{d.sub}</div> : null}
    </div>
  );
}

/* F_QUOTE 金句卡 */
function F_QUOTE({ d, p }) {
  return (
    <div style={frame(p, { justifyContent: 'center' })}>
      <div style={{ fontSize: 220, fontWeight: 900, color: p.accent, lineHeight: 0.6, marginBottom: 30 }}>“</div>
      <Title text={d.title} highlight={d.highlight} p={p} size={Math.min(sizeFor(d.title), 135)} />
      {d.sub ? <div style={{ fontSize: 50, color: p.sub, marginTop: 50 }}>—— {d.sub}</div> : null}
    </div>
  );
}

/* F_LIST 迷你清单卡 */
function F_LIST({ d, p }) {
  const points = (d.points || []).slice(0, 4);
  return (
    <div style={frame(p, { justifyContent: 'center', gap: 44 })}>
      <Title text={d.title} highlight={d.highlight} p={p} size={Math.min(sizeFor(d.title), 130)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, marginTop: 24 }}>
        {points.map((pt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            <span style={{ width: 70, height: 70, flex: 'none', borderRadius: '50%', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900 }}>{i + 1}</span>
            <span style={{ fontSize: 58, fontWeight: 700 }}>{pt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* F_COMPARE 对比卡 */
function F_COMPARE({ d, p }) {
  const pts = d.points || [];
  return (
    <div style={frame(p, { justifyContent: 'center', gap: 40 })}>
      <Title text={d.title} highlight={d.highlight} p={p} size={Math.min(sizeFor(d.title), 120)} />
      <div style={{ background: 'rgba(127,127,127,.12)', borderRadius: 22, padding: '36px 40px', fontSize: 56, fontWeight: 700 }}>
        <span style={{ color: p.sub }}>✗ </span>{pts[0] || ''}
      </div>
      <div style={{ alignSelf: 'center', fontSize: 56, fontWeight: 900, color: p.accent }}>VS</div>
      <div style={{ background: p.soft, borderRadius: 22, padding: '36px 40px', fontSize: 56, fontWeight: 900 }}>
        <span style={{ color: p.accent }}>✓ </span>{pts[1] || ''}
      </div>
    </div>
  );
}

/* F_END 结尾互动卡 */
function F_END({ d, p }) {
  const pillColor = p.ink === '#FFFFFF' ? '#141414' : '#FFFFFF';
  return (
    <div style={frame(p, { justifyContent: 'center', alignItems: 'flex-start', gap: 60 })}>
      <Title text={d.title} highlight={d.highlight} p={p} size={Math.min(sizeFor(d.title), 130)} />
      <div style={{ background: p.accent, color: pillColor === '#141414' ? '#141414' : '#fff', borderRadius: 999, padding: '26px 58px', fontSize: 54, fontWeight: 900 }}>
        {d.sub || '评论区告诉我 👇'}
      </div>
      <div style={{ fontSize: 46, color: p.sub }}>{d.badge || '关注我，明天继续更'}</div>
    </div>
  );
}

/* F_PHOTO 真实照片封面（照片铺满 9:16 + 渐变压暗 + 叠 Hook 大字，安全区内） */
function F_PHOTO({ d, p }) {
  return (
    <div style={{ width: 1080, height: 1920, background: '#000', fontFamily: SANS, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', boxSizing: 'border-box' }}>
      {d.bgDataUrl ? (
        <img src={d.bgDataUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.05) 40%, rgba(0,0,0,.75) 100%)' }} />
      <div style={{ position: 'relative', padding: '0 100px 380px', display: 'flex', flexDirection: 'column', gap: 40 }}>
        {d.badge ? (
          <div style={{ alignSelf: 'flex-start', border: `5px solid ${p.accent}`, color: '#fff', background: p.accent, borderRadius: 12, padding: '12px 32px', fontSize: 44, fontWeight: 900, transform: 'rotate(-4deg)' }}>
            {d.badge}
          </div>
        ) : null}
        <div style={{ fontSize: sizeFor(d.title), fontWeight: 900, lineHeight: 1.2, letterSpacing: 2, color: '#fff', textShadow: '0 6px 30px rgba(0,0,0,.85)', wordBreak: 'break-all' }}>
          {d.highlight && d.title && d.title.includes(d.highlight) ? (
            <>
              {d.title.slice(0, d.title.indexOf(d.highlight))}
              <span style={{ color: p.accent }}>{d.highlight}</span>
              {d.title.slice(d.title.indexOf(d.highlight) + d.highlight.length)}
            </>
          ) : d.title}
        </div>
        {d.sub ? <div style={{ fontSize: 48, color: 'rgba(255,255,255,.9)', fontWeight: 500, textShadow: '0 3px 16px rgba(0,0,0,.8)' }}>{d.sub}</div> : null}
      </div>
    </div>
  );
}

export const FRAMES = {
  F_PHOTO: { name: '真实照片封面', Comp: F_PHOTO },
  F_COVER: { name: '封面大字报', Comp: F_COVER },
  F_POINT: { name: '序号要点卡', Comp: F_POINT },
  F_QUOTE: { name: '金句卡', Comp: F_QUOTE },
  F_LIST: { name: '迷你清单卡', Comp: F_LIST },
  F_COMPARE: { name: '对比卡', Comp: F_COMPARE },
  F_END: { name: '结尾互动卡', Comp: F_END },
};

// 注入提示词的字卡规格
export const FRAME_SPEC = `F_COVER 封面大字报：title≤9字, highlight, sub≤16字, badge≤4字
F_POINT 序号要点卡（轮播主力）：num序号, title≤10字, highlight, sub一句补充≤22字, badge可空
F_QUOTE 金句卡：title金句≤14字, highlight, sub署名可空
F_LIST 迷你清单卡：title≤9字, points×3~4每条≤10字
F_COMPARE 对比卡：title≤9字, points=[错误做法,正确做法]各≤12字
F_END 结尾互动卡：title互动问题≤12字, sub行动指令≤10字, badge关注引导≤10字
配色 scheme：noir(抖音黑红)/cyber(赛博青)/cream(奶油暖)/mint(薄荷)/paper(纸感)，整条视频所有字卡必须同一 scheme。`;
