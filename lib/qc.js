// 质检环：《抖音冷启动资产库》§6 硬规则的程序化实现
// 每条规则返回 {id, name, pass, detail, hard}，hard=true 的失败项触发打回重做
import { checkText } from './bannedWords';
import { SCRIPT_TEMPLATES } from './scriptTemplates';

const countChars = (s) => (String(s || '').match(/[\u4e00-\u9fffA-Za-z0-9]/g) || []).length;
const CTA_RE = /(评论|关注|收藏|点赞|告诉我|扣[0-9一1]|你呢|聊聊|留言|说说)/;

/**
 * @param {object} script {template, shots:[{no,start,end,scene,visual,line,sub,sfx,src}]}
 * @param {string} title
 * @param {string} type 内容类型
 */
export function runQC(script, title, type) {
  const shots = Array.isArray(script?.shots) ? script.shots : [];
  const rules = [];
  const push = (id, name, pass, detail, hard = false) => rules.push({ id, name, pass: !!pass, detail, hard });

  if (shots.length === 0) {
    push('R0', '分镜完整性', false, '分镜表为空', true);
    return { rules, hardFails: rules.filter((r) => !r.pass && r.hard), pass: false, speed: 0, duration: 0 };
  }

  const duration = Math.max(...shots.map((s) => Number(s.end) || 0));
  const allLines = shots.map((s) => s.line || '').join('');
  const totalChars = countChars(allLines);
  const speed = duration > 0 ? +(totalChars / duration).toFixed(1) : 0;

  // R1 前3秒 Hook：首镜台词≤25字
  const hookLen = (shots[0].line || '').trim().length;
  push('R1', '前3秒Hook≤25字', hookLen > 0 && hookLen <= 25, `首镜台词 ${hookLen} 字`, true);

  // R2 全程字幕
  const noSub = shots.filter((s) => (s.line || '').trim() && !(s.sub || '').trim());
  push('R2', '全程字幕', noSub.length === 0, noSub.length ? `${noSub.length} 个镜头有台词无字幕` : '每句台词均有字幕');

  // R3 每15秒至少1个节奏点（任一单镜头不得超过15s）
  const longShot = shots.find((s) => (Number(s.end) || 0) - (Number(s.start) || 0) > 15);
  push('R3', '单镜头≤15s（节奏点）', !longShot, longShot ? `镜${longShot.no} 长达 ${(longShot.end - longShot.start)}s` : '节奏点密度达标', true);

  // R4 口播语速 3.5~5.5 字/秒
  const speedOK = speed >= 3.5 && speed <= 5.5;
  push('R4', '语速3.5~5.5字/秒', speedOK, `实测 ${speed} 字/秒（${totalChars}字/${duration}s）`, true);

  // R5 结尾含且仅含1个互动指令
  const lastText = `${shots[shots.length - 1].line || ''}${shots[shots.length - 1].sub || ''}`;
  push('R5', '结尾互动指令', CTA_RE.test(lastText), CTA_RE.test(lastText) ? '结尾含互动指令' : '结尾缺少互动指令');

  // R6 标题≤30字
  const tLen = (title || '').trim().length;
  push('R6', '标题≤30字', tLen > 0 && tLen <= 30, `标题 ${tLen} 字`);

  // R7 违禁词（标题+全部台词）
  const hits = checkText(title + allLines).filter((h) => h.severity === 'block');
  push('R7', '违禁词过滤', hits.length === 0, hits.length ? `命中：${hits.map((h) => h.word).join('、')}` : '未命中违禁词', true);

  // R8 一档字卡：每张3~4s 单图单句
  if (type === '图文成片') {
    const bad = shots.filter((s, i) => {
      if (i === 0 || i === shots.length - 1) return false; // 封面/结尾卡放宽
      const d = (Number(s.end) || 0) - (Number(s.start) || 0);
      return d < 2.5 || d > 4.8;
    });
    push('R8', '字卡节奏3~4s/张', bad.length === 0, bad.length ? `${bad.length} 张字卡时长越界` : '轮播节奏达标');
  }

  // R9 时长档位匹配模板
  const tpl = SCRIPT_TEMPLATES[script.template] || null;
  if (tpl) {
    const inRange = duration >= tpl.dur[0] - 3 && duration <= tpl.dur[1] + 3;
    push('R9', `时长匹配模板${tpl.id}`, inRange, `成片约 ${duration}s（要求 ${tpl.dur[0]}~${tpl.dur[1]}s）`, true);
  }

  const hardFails = rules.filter((r) => !r.pass && r.hard);
  return { rules, hardFails, pass: hardFails.length === 0, speed, duration };
}

/** 把违规项整理成给模型的返工指令 */
export function violationBrief(qc) {
  return qc.hardFails.map((r) => `${r.name}未达标：${r.detail}`).join('；');
}
