const PROMPTS = {
  career: (text, context) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下のメモ書きを職務経歴書に載せるのにふさわしい文章に整えてください。
ルール：簡潔かつ具体的（数字を活かす）、体言止めや「〜を担当」の書き方、3〜5行、元の意味を変えない、整えた文章だけ返す。
${context ? `背景：${context}` : ""}
--- 入力 ---
${text}`,

  skills: (text) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下のメモ書きを職務経歴書の「スキル」欄にふさわしい形に整えてください。

ルール：
- ツール名・ソフトウェア名を正式名称に直す
- カテゴリごとに分類して見やすく箇条書きにする（例：「Office系」「デザイン系」「CRM・SFA」など）
- 習熟度や具体的な使い方が書かれている場合はそのまま活かす
- 余計な前置きは不要、整えた結果だけ返す

--- 入力 ---
${text}`,

  pr: (text) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下のメモ書きを職務経歴書の「自己PR」欄にふさわしい文章に整えてください。
ルール：200〜400文字、強み→エピソード→貢献の流れ、です・ます調、整えた文章だけ返す。
--- 入力 ---
${text}`,
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, text, context } = req.body;

  if (!type || !text) {
    return res.status(400).json({ error: "type and text are required" });
  }

  const promptFn = PROMPTS[type];
  if (!promptFn) {
    return res.status(400).json({ error: `Unknown type: ${type}. Use: career, skills, pr` });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          { role: "user", content: promptFn(text, context) },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return res.status(response.status).json({ error: "AI API error", details: data });
    }

    const result = data.content?.map((b) => b.text || "").join("").trim() || "";
    return res.status(200).json({ result });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
