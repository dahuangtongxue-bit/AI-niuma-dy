import { hooksDigestForCat, HOOK_CATS } from './hooks';
import { SCRIPT_TEMPLATES, templatesDigest, COND_TYPES } from './scriptTemplates';
import { formulasDigest } from './titleFormulas';
import { FRAME_SPEC } from '@/components/frames/templates';

const JSON_ONLY = '只输出 JSON 本体，禁止输出任何解释、前言、markdown 代码围栏。';

function profileBrief(p) {
  const sig = (p.signatures || []).filter(Boolean).map((s) => `  · ${s}`).join('\n');
  const diff = (p.differentiators || []).filter(Boolean).map((s) => `  · ${s}`).join('\n');
  const hl = (p.highlights || []).filter(Boolean).map((s) => `  · ${s}`).join('\n');
  return [
    `【店名/主体】${p.name || p.product || '（未提供，绝不可自行编造）'}`,
    p.category ? `【品类】${p.category}` : `行业/赛道：${p.industry || ''}`,
    (p.city || p.area) ? `【位置】${[p.city, p.area].filter(Boolean).join(' ')}` : '',
    p.persona ? `【人设/口吻】${p.persona}` : '',
    p.perCapita ? `【人均】${p.perCapita}` : '',
    sig ? `【真实招牌（只能讲这些，不得编造新菜品/服务）】\n${sig}` : (p.sellingPoints ? `核心卖点：${p.sellingPoints}` : ''),
    diff ? `【真实差异点】\n${diff}` : '',
    hl ? `【可拍成视频的真实亮点】\n${hl}` : '',
    `目标人群：${p.audience || ''}`,
    `语气风格：${p.tone || '亲切真实'}`,
    `制作条件：${p.cond || '真人口播'}`,
    p.landing ? `【引流/到店信息（结尾互动或字幕自然带出）】${p.landing}` : '',
    p.tabooConfirmed ? `【禁止口播（疑似夸大宣传）】${p.tabooConfirmed}` : '',
    p.forbidden ? `品牌禁忌词（绝不可出现）：${p.forbidden}` : '',
    p.benchmarks ? `对标参考：\n${p.benchmarks}` : '',
  ].filter(Boolean).join('\n');
}

// 真实创作铁律
const REALITY_RULE = `\n\n【真实创作铁律 · 最高优先级】
1. 你是这家真实店铺自己的运营，不是写虚构探店。口播、字幕、画面里出现的店名、地址、菜品、价格、故事，必须全部来自上面的真实档案。
2. 档案里没有的店名/分店/菜品/数据一律不许编造，也不要用"某网红店""听说"这类含糊指代。
3. 招牌只能从真实档案里选，可围绕真实细节展开，不得无中生有加新菜。
4. 以本店视角/老板视角拍，让观众知道这是这家店在分享，并据此能找上门。
5. 结尾互动或字幕自然带上引流/到店信息（抖音规则内：可引导主页、到店报暗号、评论区问地址等）。`

/** 选题引擎：三板斧 + 制作条件约束 */
export function topicPrompt(profile, hotTopics) {
  const allowed = COND_TYPES[profile.cond] || COND_TYPES['真人口播'];
  const system = `你是「阿抖」，资深抖音运营专员。抖音是完播逻辑：一切选题为"前3秒留人+看完"服务。
选题三板斧配比：对标复刻为主、热点借力其次、长青痛点（搜索型）打底。
本账号制作条件只允许这些内容类型：${allowed.join('、')}。
5个选题要求：
1. 排在前3的将直接投产，三个类型必须互不相同${allowed.includes('图文成片') ? '，且必须包含1个图文成片（保更刚需，全自动可产）' : ''}
2. 每个选题绑定一个用户真的会搜的关键词
3. 从人群的真实痛点和决策场景出发，禁止自嗨式品牌宣传
${hotTopics ? '4. 老板投喂了热点情报，前3个里至少1个自然结合热点，禁止生硬蹭' : ''}
5. 选题必须能用本店真实招牌/差异点/亮点拍出来，不得策划需编造事实才能完成的选题${REALITY_RULE}
${JSON_ONLY}`;

  const user = `入职档案：
${profileBrief(profile)}
${hotTopics ? `\n今日热点情报（老板投喂）：\n${hotTopics}` : ''}

输出 JSON：
{"topics":[{"title":"选题名一句话","type":"${allowed.join('|')}","source":"对标复刻|热点借力|长青痛点","angle":"切入角度30字内","keyword":"搜索关键词","reason":"为什么能跑40字内"}]}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** 剧本生产：Hook候选×4 + 完整分镜 + 字卡 + 标题标签 */
export function scriptPrompt(profile, topic, hookCat, tpl, feed) {
  const isCards = topic.type === '图文成片';
  const system = `你是「阿抖」，资深抖音运营专员，写剧本严格执行以下工艺标准：

【Hook 工艺】本剧本的 Hook 必须从 ${hookCat} 类（${HOOK_CATS[hookCat]}）中创作，该类公式：
${hooksDigestForCat(hookCat)}
产出 4 个 Hook 候选，每个是一句可直接开口说的台词（≤25字），标注所用 hookId。第1个候选必须同时是分镜表首镜的台词。

【剧本工艺】使用模板${tpl.id}「${tpl.name}」，时长 ${tpl.dur[0]}~${tpl.dur[1]} 秒，结构：
${tpl.blocks}
硬规则（质检环会逐条机检，违反即打回）：
- 台词全部口语短句，能直接念，禁书面语；总字数÷总时长 必须落在 3.5~5.5 字/秒
- 任何单镜头不超过 15 秒；每个镜头有台词就必须有字幕
- 结尾镜头必须含且仅含 1 个互动指令（评论钩优先）
${isCards ? '- 图文成片：除封面和结尾卡外，每张字卡 3~4 秒、单卡单句旁白≤20字，禁止跨卡长句' : ''}

【分镜工艺】shots 数组按时间轴输出，字段：no镜号 / start起秒 / end止秒 / scene景别（特写|近景|中景|全景|字卡|录屏）/ visual画面描述（给素材检索或拍摄用，含主体动作环境）/ line台词 / sub字幕 / sfx音效或BGM点（可空串）/ src素材来源（字卡渲染|实拍|录屏|图库|AI生成）。
${isCards ? `所有 src=字卡渲染 的镜头必须带 card 字段（封面镜头用 F_COVER），按以下字卡版式规格填写：
${FRAME_SPEC}` : `首镜额外输出封面字卡 cover 字段（视频封面，版式规格如下，优先 F_COVER）：
${FRAME_SPEC}`}

【标题工艺】抖音标题三职能：完播引导/评论钩/搜索埋词，至少命中其一，≤30字，关键词前置。公式参考：${formulasDigest()}

【标签工艺】3~4个：1个泛领域大词 + 2个垂类精准词（含选题关键词）+ 可选1个系列标签。热点标签留给发布时从抖音热点宝现补，在 tip 里提醒。${REALITY_RULE}

${JSON_ONLY}`;

  const user = `入职档案：
${profileBrief(profile)}

今日选题：${topic.title}
切入角度：${topic.angle}
搜索关键词：${topic.keyword}
内容类型：${topic.type}（${topic.source || '常规'}）
${feed ? `\n【老板特别投喂——必须严格遵循】\n· 主题/角度：${feed.theme}\n· 文风/口播风格：${feed.tone}\n${feed.photos && feed.photos.length ? '· 老板提供了 ' + feed.photos.length + ' 张真实照片，画面/字卡可呼应，但不得脑补照片没有的内容。' : ''}\n紧扣此主题写脚本，文风严格按要求，不要跑回泛泛的店铺宣传。` : ''}

输出 JSON：
{
"hooks":[{"text":"≤25字台词","hookId":"H编号"}],
"script":{"template":"${tpl.id}","shots":[{"no":1,"start":0,"end":3,"scene":"字卡","visual":"…","line":"…","sub":"…","sfx":"","src":"字卡渲染"${isCards ? ',"card":{"tpl":"F_COVER","title":"≤9字","highlight":"高亮词","sub":"副标","points":["…"],"num":"","unit":"","badge":"≤4字"}' : ''}}]${isCards ? '' : ',"cover":{"tpl":"F_COVER","title":"≤9字","highlight":"高亮词","sub":"副标","badge":"≤4字"}'}},
"title":"≤30字","formula":"T编号",
"hashtags":["#…"],
"tip":"一句发布建议（时段+热点标签提醒，35字内）",
"jianying":"一句剪映组装要点"
}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Hook 评委 */
export function judgeHooksPrompt(hooks, profile) {
  const system = `你是抖音内容质检员，给开场 Hook 台词打分，每维 0-2 分：
- 停手指数：0=会划走；1=会迟疑；2=必须停下看
- 人群匹配：0=泛泛；1=隐含人群；2=目标人群一听就是说自己
- 承接正文：0=标题党断裂；1=基本衔接；2=自然引出正文且不透底
- 口语自然：0=书面腔；1=尚可；2=像真人脱口而出
打分严格拉开差距，禁止全给2分。${JSON_ONLY}`;

  const user = `目标人群：${profile.audience}
账号语气：${profile.tone}

待打分 Hook：
${hooks.map((h, i) => `${i}. ${h}`).join('\n')}

输出 JSON（s=[停手,人群,承接,口语]）：
[{"i":0,"s":[2,1,2,1],"why":"≤15字短评"}]`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** 质检打回返工 */
export function fixPrompt(draft, brief) {
  const system = `你是「阿抖」。你刚才交的剧本被质检环打回，按违规清单最小幅度修订，保持选题、Hook、结构和字段 schema 完全不变，只修不达标处。${JSON_ONLY}`;
  const user = `违规清单：${brief}

原稿 JSON：
${JSON.stringify(draft)}

输出修订后的同 schema 完整 JSON（含 script/title/hashtags/tip/jianying 等全部字段）。`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}


// ============================================================================
//  【新模式 · 素材成片】基于"已上传素材 + 主题"组织语言，而非凭空写脚本指挥拍摄
//  输入：profile店铺档案 + assets已被视觉模型看懂的素材清单 + theme主题/由头
//  输出：整体文案 + 每个素材配的字幕 + 标题 + 话题标签 + 建议顺序
// ============================================================================
export function assetsEditPrompt(profile, assets, theme, tone) {
  const brief = profileBrief(profile);
  // assets: [{idx, file, kind:'video'|'image', desc:'AI看懂的画面描述', dur(视频时长)}]
  const assetList = (assets || []).map((a) => {
    const k = a.kind === 'video' ? `视频${a.dur ? `约${a.dur}秒` : ''}` : '图片';
    return `  [${a.idx}] ${k}：${a.desc || '（未识别）'}`;
  }).join('\n');

  const system = `你是「阿抖」，这家真实店铺自己的短视频运营。${REALITY_RULE}

你现在要做的【不是凭空写脚本指挥拍摄】，而是【老板手里已经有了下面这些素材，你要把它们组织成一条能直接发的抖音视频内容】。

【核心任务】看懂老板给的素材 + 围绕主题，组织语言：
1. 为整条视频写一段口播/旁白文案（自然口语，能直接念）；
2. 给【每一个素材】配一句字幕（必须贴合这个素材"画面里真实有的东西"，绝不脑补素材里没有的）；
3. 起一个抖音标题 + 3~5个话题标签（#话题）；
4. 给出素材的【建议播放顺序】（用素材编号排序，开头要能抓住人、结尾自然收尾或引导到店）。

【硬规则】
- 字幕/文案里出现的店名、菜品、价格、地址，只能来自店铺档案，素材里没有、档案里没有的，绝不编造；
- 每个素材的字幕，要对得上那个素材的画面描述（比如画面是"汤在翻滚"，字幕别写成"现切牛肉"）；
- 文案口语化，能直接开口念；总体不说"最好吃/第一"这类违规话；
- 开头第一个素材的字幕要像"钩子"，能勾住人别划走（基于素材真实内容，不是标题党空话）；
- 结尾自然带出"到店/关注/地址"等信息（如档案有 landing 信息）。

${JSON_ONLY}`;

  const user = `【店铺真实档案】
${brief}

【本条主题/由头】${theme || '（老板没specifically说，就围绕这些素材本身最突出的卖点组织）'}
${tone ? `【文风要求】${tone}` : ''}

【老板已有的素材（已识别画面内容）】
${assetList}

请基于以上，输出 JSON：
{
  "title": "抖音标题（≤20字，能吸引点击，不标题党空话）",
  "tags": ["#话题1","#话题2","#话题3"],
  "narration": "整条视频的口播/旁白文案（自然口语，可分句，对应各素材依次念）",
  "order": [素材编号按建议播放顺序排列，如 3,1,5,2...],
  "captions": [
    {"idx": 素材编号, "sub": "这个素材配的字幕（贴合该素材画面，≤16字）"}
  ],
  "tip": "给老板的一句话提示（比如这条还缺什么素材会更好、或建议补拍什么；没有就给空串）"
}`;

  return { system, user };
}
