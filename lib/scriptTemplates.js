// 《抖音冷启动资产库》§2 剧本结构库（按时长×类型）

export const SCRIPT_TEMPLATES = {
  A: {
    id: 'A', name: '15~20s 口播干货', dur: [15, 22],
    blocks: '0-3s Hook（台词≤25字）→ 3-6s 痛点确认（一句话让目标人群对号入座）→ 6-15s 干货123（最多3个点，每点一句话+换画面/字卡）→ 15-20s CTA（互动指令只给一个）',
    fit: ['口播干货'],
  },
  B: {
    id: 'B', name: '30~45s 口播进阶', dur: [28, 48],
    blocks: '0-3s Hook → 3-8s 建立可信（我是谁/我做到过什么，一句话）→ 8-30s 三要点（每点=结论先行+一个例子，节奏点间隔≤8s）→ 30-38s 反转/加码（"但最关键的其实是…"）→ 38-45s CTA（评论钩优先）',
    fit: ['口播进阶'],
  },
  C: {
    id: 'C', name: '图文成片（字卡轮播）', dur: [28, 55],
    blocks: '0-2s 封面静帧（大字报Hook）→ 8~12张字卡轮播（每张3-4s，每张一句≤20字旁白，单图单句禁止跨图长句）→ 结尾互动卡停留3s',
    fit: ['图文成片'],
  },
  D: {
    id: 'D', name: '30s 产品种草', dur: [26, 35],
    blocks: '0-3s 痛点场景 → 3-8s 产品登场（"直到我遇到X"一句话定位）→ 8-22s 三个卖点演示（动作+一句结论，不念参数）→ 22-27s 价格钩（锚点对比）→ 27-30s 单一行动指令',
    fit: ['产品种草'],
  },
  E: {
    id: 'E', name: '60s 剧情（半成品）', dur: [50, 65],
    blocks: '0-5s 冲突开场 → 5-25s 冲突两次递进 → 25-40s 反转 → 40-52s 价值点落地（自然带出产品/观点）→ 52-60s CTA。此档交付剧本+分镜，需人工拍摄精剪',
    fit: ['剧情'],
  },
};

// 制作条件 → 允许的内容类型（入职档案约束选题引擎）
export const COND_TYPES = {
  '纯字卡+AI配音': ['图文成片', '口播干货'],
  '真人口播': ['口播干货', '口播进阶', '产品种草', '图文成片'],
  '可拍剧情': ['口播干货', '口播进阶', '产品种草', '图文成片', '剧情'],
};

export function templateForType(type) {
  for (const t of Object.values(SCRIPT_TEMPLATES)) {
    if (t.fit.includes(type)) return t;
  }
  return SCRIPT_TEMPLATES.A;
}

export function templatesDigest(allowedTypes) {
  return Object.values(SCRIPT_TEMPLATES)
    .filter((t) => t.fit.some((f) => allowedTypes.includes(f)))
    .map((t) => `模板${t.id}「${t.name}」时长${t.dur[0]}~${t.dur[1]}s，结构：${t.blocks}`)
    .join('\n');
}
