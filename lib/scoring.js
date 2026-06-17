import { checkText } from './bannedWords';

/**
 * Hook 候选打分：模型 4 维（停手指数/人群匹配/承接正文/口语自然，各0-2）
 * + 代码合规维（≤25字且无block违禁=2，否则0且不合格），总分10，取最高分定稿
 */
export function combineHookScore(text, judgeDims, why) {
  const t = (text || '').trim();
  const issues = checkText(t);
  const blocked = issues.filter((i) => i.severity === 'block');
  const dims = Array.isArray(judgeDims) && judgeDims.length === 4
    ? judgeDims.map((d) => Math.max(0, Math.min(2, Number(d) || 0)))
    : [0, 0, 0, 0];

  const lenOK = t.length > 0 && t.length <= 25;
  const compliance = lenOK && blocked.length === 0 ? 2 : 0;
  const total = dims.reduce((a, b) => a + b, 0) + compliance;

  const reasons = [];
  if (!lenOK) reasons.push(`超长（${t.length}字>25）`);
  for (const b of blocked) reasons.push(`违禁词「${b.word}」`);
  if (why) reasons.push(why);

  return {
    total,
    pass: total >= 7 && lenOK && blocked.length === 0,
    dims: { 停手: dims[0], 人群: dims[1], 承接: dims[2], 口语: dims[3], 合规: compliance },
    reasons,
  };
}
