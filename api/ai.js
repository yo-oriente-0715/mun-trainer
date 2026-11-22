// 模擬国連トレーニング: AI中継用のサーバー関数(Vercel)
// APIキーはここ(サーバー側の環境変数)にだけ置き、ブラウザには絶対に渡さない。
//
// 環境変数
//   ANTHROPIC_API_KEY   … Claude を使う場合(どちらか一方が必須)
//   GEMINI_API_KEY      … Gemini を使う場合
//   ACCESS_CODE         … 合言葉。設定すると、知っている人だけが使える(強く推奨)
//   RATE_PER_MIN        … 1人あたり1分間の上限回数(既定 12)
//   ANTHROPIC_MODEL / ANTHROPIC_MODEL_COMPLEX / GEMINI_MODEL … モデル名を変えたいとき

const hits = new Map();

const SYSTEM =
  "You are a training assistant for high school Model United Nations practice. " +
  "Stay on Model UN, diplomacy, international affairs and the practice task you are given. " +
  "Keep everything appropriate for high school students. Do not invent facts; mark uncertain points.";

function bad(res, status, error) {
  res.status(status).json({ error });
}

function clean(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 60) return null;
  let total = 0;
  const out = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const content = m.content.slice(0, 20000);
    total += content.length;
    if (!content.trim()) continue;
    // 同じ役割が続いたらまとめる(APIの決まりに合わせる)
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += "\n\n" + content;
    else out.push({ role: m.role, content });
  }
  if (total > 80000 || !out.length || out[0].role !== "user" || out[out.length - 1].role !== "user") return null;
  return out;
}

async function callAnthropic(messages, tier, json) {
  const model =
    tier === "complex"
      ? process.env.ANTHROPIC_MODEL_COMPLEX || "claude-sonnet-5-5"
      : process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: SYSTEM + (json ? " Reply with JSON only." : ""),
      messages,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d?.error?.message || "anthropic error"), { status: r.status });
  const text = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return { text, truncated: d.stop_reason === "max_tokens" };
}

async function callGemini(messages, tier, json) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 2000, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d?.error?.message || "gemini error"), { status: r.status });
  const c = (d.candidates || [])[0] || {};
  const text = ((c.content || {}).parts || []).map((p) => p.text || "").join("");
  return { text, truncated: c.finishReason === "MAX_TOKENS" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "POSTのみ受け付けます");

  const code = process.env.ACCESS_CODE;
  if (code && req.headers["x-access-code"] !== code) return bad(res, 401, "合言葉が違います");

  // 簡易的な回数制限(サーバーが再起動するとリセットされる、あくまで保険)
  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const now = Date.now();
  const limit = Number(process.env.RATE_PER_MIN || 12);
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= limit) return bad(res, 429, "呼び出しが多すぎます");
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return bad(res, 400, "形式が正しくありません"); }
  }
  const messages = clean(body && body.messages);
  if (!messages) return bad(res, 400, "形式が正しくありません");
  const tier = body.tier === "complex" ? "complex" : "default";
  const json = !!body.json;

  try {
    let out;
    if (process.env.ANTHROPIC_API_KEY) out = await callAnthropic(messages, tier, json);
    else if (process.env.GEMINI_API_KEY) out = await callGemini(messages, tier, json);
    else return bad(res, 500, "サーバーにAPIキーが設定されていません");
    res.status(200).json(out);
  } catch (e) {
    console.error(e);
    bad(res, e.status === 429 ? 429 : 502, "AIの呼び出しに失敗しました");
  }
}
