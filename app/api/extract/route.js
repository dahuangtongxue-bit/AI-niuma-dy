export const runtime = 'edge';

// 素材提取代理：把"链接抓取"和"多模态读图"两种素材，统一交给模型整理成「店铺档案 JSON」。
// 注意：本路由只负责"取素材 + 调模型整理"，结果必须回前端让用户过目确认后才入库（AI 看图/读网页会出错，不能直接进生产）。

const FIELDS = `{
  "name": "店名（招牌上的正式名称，没有就留空）",
  "category": "品类，如 兰州牛肉面 / 咖啡馆 / 火锅",
  "city": "所在城市",
  "area": "商圈/地址（有多详细写多详细，至少到街道或商圈）",
  "persona": "老板/品牌人设一句话，如 '在苏州开店的兰州人，做正宗牛大'",
  "perCapita": "人均消费，如 25元",
  "hours": "营业时间",
  "signatures": ["招牌项目1（菜品/服务，带一个真实细节）", "招牌项目2", "招牌项目3"],
  "differentiators": ["和同行不一样的真实差异点1", "差异点2"],
  "highlights": ["可写成笔记的真实亮点/故事1", "亮点2"],
  "landing": "引流/到店信息：地址定位、预约或排队方式、私域入口（如有）",
  "tabooConfirmed": "若素材里有明显夸大宣传（最好吃/第一），这里列出来提醒用户别写"
}`;

function buildMessages({ pageText, hasImages }) {
  const sys = `你是品牌/商户信息整理员。根据用户提供的素材（网页正文 / 店铺或产品截图 / 资料文档），如实整理出一份「主体档案 JSON」，供后续小红书运营创作使用。
铁律：
1. 只整理素材里**真实出现**的信息，绝对禁止编造店名、地址、菜品、价格——素材里没有的字段就留空字符串或空数组；
2. signatures/highlights 要保留能写进笔记的真实细节（如"汤每天凌晨现熬""面型分九种"），不要泛泛而谈；
3. 如果素材里有"最好吃/全城第一/绝对正宗"这类违反广告法的话，放进 tabooConfirmed 提醒，不要当成卖点；
4. 严格只输出 JSON 本体，第一个字符是 {，禁止任何解释或代码围栏。
输出字段：
${FIELDS}`;

  const userContent = [];
  if (pageText) {
    userContent.push({ type: 'text', text: `【网页/文章正文素材】\n${pageText.slice(0, 8000)}` });
  }
  if (hasImages) {
    userContent.push({ type: 'text', text: '【以下是店铺相关图片：可能是大众点评页截图、菜单、门头、营业执照等，请从中识别真实信息】' });
  }
  // 图片块由调用处 push 进来（见下）
  return { sys, userContent };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { url, images, texts, mode, freeText } = body; // images: ['data:image/...;base64,...'] 前端传入

    // 【新模式 · describe】只描述单个素材的画面（用于阿抖"素材成片"逐个看懂素材），不整理档案
    if (mode === 'describe') {
      const base2 = (process.env.VISION_API_BASE || process.env.LLM_API_BASE || '').replace(/\/+$/, '');
      const key2 = process.env.VISION_API_KEY || process.env.LLM_API_KEY;
      const model2 = process.env.LLM_MODEL_VISION || process.env.LLM_MODEL;
      if (!base2 || !key2 || !model2) {
        return Response.json({ error: '缺少视觉模型环境变量 VISION_API_BASE/KEY/LLM_MODEL_VISION' }, { status: 500 });
      }
      const imgs2 = Array.isArray(images) ? images.filter((s) => typeof s === 'string' && s.startsWith('data:image')).slice(0, 3) : [];
      if (!imgs2.length) return Response.json({ error: '没有可识别的画面' }, { status: 400 });
      const content2 = [{ type: 'text', text: (freeText || '用一句话描述这张图里有什么，不超过30字，只回一句话。') }];
      for (const u of imgs2) content2.push({ type: 'image_url', image_url: { url: u } });
      try {
        const up = await fetch(`${base2}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key2}` },
          body: JSON.stringify({ model: model2, messages: [{ role: 'user', content: content2 }], temperature: 0.2, max_tokens: 100, stream: false, thinking: { type: 'disabled' } }),
        });
        if (!up.ok) { const t = await up.text(); return Response.json({ error: `视觉模型 ${up.status}: ${t.slice(0,150)}` }, { status: 502 }); }
        const d = await up.json();
        let desc = (d.choices?.[0]?.message?.content || '').toString();
        if (Array.isArray(desc)) desc = desc.map(x => x.text || '').join('');
        desc = desc.replace(/```/g, '').trim().slice(0, 40);
        return Response.json({ desc });
      } catch (e) {
        return Response.json({ error: String(e.message || e).slice(0, 150) }, { status: 500 });
      }
    }

    // 读图模型可独立部署（如 deepseek 走官网、MiniMax 也走官网，两套 base/key 不同）。
    // 优先用 VISION_API_BASE / VISION_API_KEY / LLM_MODEL_VISION；任一缺省则回退复用 LLM_* 那套。
    const base = (process.env.VISION_API_BASE || process.env.LLM_API_BASE || '').replace(/\/+$/, '');
    const key = process.env.VISION_API_KEY || process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL_VISION || process.env.LLM_MODEL;

    if (!base || !key || !model) {
      return Response.json({ error: '缺少环境变量：读图需要 VISION_API_BASE / VISION_API_KEY / LLM_MODEL_VISION（或回退用的 LLM_API_BASE / LLM_API_KEY / LLM_MODEL）' }, { status: 500 });
    }

    let pageText = '';
    let fetchNote = '';
    // ── 链接抓取（官网/公众号文章可行；大众点评等强反爬大概率失败，失败就提示改用截图）──
    if (url && /^https?:\/\//i.test(url)) {
      try {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });
        if (resp.ok) {
          const html = await resp.text();
          pageText = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (pageText.length < 80) {
            fetchNote = '该链接抓到的正文极少（可能是反爬或动态渲染页面，如大众点评）。建议改用「上传截图」方式提供素材。';
          }
        } else {
          fetchNote = `链接抓取失败（${resp.status}）。如果是大众点评这类强反爬站点，请改用「上传截图」。`;
        }
      } catch (e) {
        fetchNote = `链接无法访问（${String(e.message || e).slice(0, 80)}）。可改用「上传截图」提供素材。`;
      }
    }

    // ── 资料文档文本（前端解析的 PDF/Word/Excel/PPT/txt）拼进正文一起识别 ──
    const docs = Array.isArray(texts) ? texts.filter((t) => t && t.content).slice(0, 8) : [];
    if (docs.length) {
      const docText = docs.map((d) => `【文档：${String(d.name || '资料').slice(0, 60)}】\n${String(d.content).slice(0, 8000)}`).join('\n\n');
      pageText = (pageText ? pageText + '\n\n' : '') + docText;
    }

    const imgs = Array.isArray(images) ? images.filter((s) => typeof s === 'string' && s.startsWith('data:image')).slice(0, 4) : [];

    if (!pageText && imgs.length === 0) {
      return Response.json({ error: fetchNote || '没有可用素材：请提供有效链接或上传图片/资料文档', fetchNote }, { status: 400 });
    }

    const { sys, userContent } = buildMessages({ pageText, hasImages: imgs.length > 0 });
    for (const dataUrl of imgs) {
      userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
    }

    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 3000,
        stream: false,
        // MiniMax-M3 默认自适应思考会吐 reasoning_content、烧 token；显式关闭。非 MiniMax 网关会忽略此字段，无害。
        thinking: { type: 'disabled' },
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return Response.json({ error: `提取模型 ${upstream.status}：${text.slice(0, 300)}（若提示不支持图片，请把 LLM_MODEL_VISION 配成多模态模型，如 MiniMax）` }, { status: 502 });
    }

    const data = await upstream.json();
    const choice = data?.choices?.[0];
    let content = choice?.message?.content ?? '';
    if (Array.isArray(content)) content = content.map((c) => c?.text || '').join('');
    content = String(content).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/gi, '').trim();

    let profile = null;
    try {
      const m = content.match(/\{[\s\S]*\}/);
      profile = JSON.parse(m ? m[0] : content);
    } catch (e) {
      return Response.json({ error: '模型返回的档案无法解析，请重试或改用手动填写', raw: content.slice(0, 200) }, { status: 502 });
    }

    return Response.json({ profile, fetchNote, usedImages: imgs.length, usedText: !!pageText });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
