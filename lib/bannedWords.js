// 违禁/高危词检测（《标题公式库》附录的程序化版本）
// severity: 'block' = 硬打回；'warn' = 建议复查（可能误伤，人工确认）

const RULES = [
  { re: /最[强好佳优高全顶贵便宜]/g, label: '绝对化用语（最X）', severity: 'warn' },
  { re: /(全网|史上|世界|全国)第一|第一名|销量第一|排名第一/g, label: '绝对化用语（第一）', severity: 'block' },
  { re: /100%|百分之百|绝对(有效|不|安全)/g, label: '绝对化承诺', severity: 'block' },
  { re: /国家级|顶级|极品|王牌/g, label: '广告法限用词', severity: 'warn' },
  { re: /(根治|治疗|治愈|消炎|抗炎|药用|疗效|修复屏障)/g, label: '医疗功效用语', severity: 'block' },
  { re: /(瘦\d+斤|月瘦|暴瘦|7天瘦)/g, label: '减肥功效承诺', severity: 'block' },
  { re: /(稳赚|躺赚|包赚|保底月入|无风险.{0,4}(收益|赚))/g, label: '夸大收益', severity: 'block' },
  { re: /(微信|weixin|VX|vx|V信|加我|私聊|私我|滴滴我)/g, label: '站外引流', severity: 'block' },
  { re: /(代购|代写|代考|刷单|刷量)/g, label: '平台高危行为词', severity: 'warn' },
];

/**
 * 检查文本，返回命中项
 * @returns {Array<{word:string,label:string,severity:'block'|'warn'}>}
 */
export function checkText(text) {
  if (!text) return [];
  const hits = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      hits.push({ word: m[0], label: rule.label, severity: rule.severity });
      if (m.index === rule.re.lastIndex) rule.re.lastIndex++;
    }
  }
  // 去重
  const seen = new Set();
  return hits.filter((h) => {
    const k = h.word + h.label;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function hasBlocked(text) {
  return checkText(text).some((h) => h.severity === 'block');
}
