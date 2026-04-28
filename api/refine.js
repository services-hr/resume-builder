/**
 * AI整形API
 *
 * - career(最新の経歴)：Web検索で企業情報を取得し、フォーマットに沿った構造化出力
 * - career(それ以外)：業務内容メモを整形するだけ
 * - skills, pr：従来通りの整形
 */

/* ─── プロンプト定義 ─── */

// 最新の経歴用：Web検索を活用してフォーマット出力
const buildCurrentCareerPrompt = (text, context) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。

以下の経歴情報を、指定のフォーマットに沿って整えてください。

【入力された経歴情報】
${context || "（記載なし）"}

【会社情報の取得方法】
- 会社情報（事業内容・売上高・従業員数・上場区分）は、提供されている web_search ツールを使って取得してください。
- **検索クエリは、上記「入力された経歴情報」に記載された正式な会社名を必ず使ってください。** 業務内容メモから推測する必要はありません（会社名は既に与えられています）。
- 効率的に情報を取得するため、検索は **1回だけ** 実施してください。
- 検索クエリ例：「[正式な会社名] 売上高 従業員数 事業内容」のような形式で、1回でまとめて情報を取得する。
- 同名の企業が複数存在し判別が難しい場合は、業務内容メモの内容から推測して特定してください。
- 推測も困難な場合、または検索しても情報が取得できない場合は、該当項目を **空欄** としてください。
- **絶対に推測で数字や情報を埋めないでください**（誤情報は採用文書として致命的です）。

【出力フォーマット（厳守）】
[在籍期間]　社名 [正式な会社名]
事業内容：[Web検索で取得した事業内容、なければ空欄]
売上高　：[Web検索で取得、例：8666億円。なければ空欄]　　　従業員数：[Web検索で取得、例：20,510人。なければ空欄]　　　上場：[Web検索で取得、例：東証プライム。なければ空欄]
[雇用形態。メモから抽出。なければ空欄]
として勤務

期間
職務内容
[在籍期間]

【職種】
[業務内容メモから抽出。なければ空欄]

【対応商材】
[業務内容メモから抽出。なければ空欄]

【業務内容】
[業務内容メモを箇条書きで整形（・で始まる）]

【実績】
[業務内容メモから抽出。なければ空欄]

【工夫した点】
[業務内容メモから抽出。なければ空欄]

【ルール】
- 在籍期間・会社名・役職は、上記「入力された経歴情報」の値を使う。
- メモに記載がない項目は空欄でOK（無理に埋めない）。
- 数字は具体的に活かす。
- 出力本文の最後に、空欄になった項目があれば必ず以下の形式で **注意書き** を追加すること。
  すべての項目が埋まった場合は注意書きは不要。

注意書きの形式：
---
⚠️ 以下の項目は自動取得・抽出できなかったため、手動で記入してください：
・[項目名1]
・[項目名2]
（該当する項目だけを箇条書きにする）

【出力ルール（最重要）】
- 出力は上記フォーマット＋注意書きのみ。前置き・後書き・解説は一切不要。

--- 業務内容メモ ---
${text}`;

// それ以外の経歴用：業務内容のみ整える（検索なし）
const buildPastCareerPrompt = (text, context) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下のメモ書きを職務経歴書に載せるのにふさわしい文章に整えてください。
ルール：簡潔かつ具体的（数字を活かす）、体言止めや「〜を担当」の書き方、3〜5行、元の意味を変えない、整えた文章だけ返す。
${context ? `背景：${context}` : ""}
--- 入力 ---
${text}`;

const buildSkillsPrompt = (text) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下のメモ書きを職務経歴書の「スキル」欄にふさわしい形に整えてください。

ルール：
- ツール名・ソフトウェア名を正式名称に直す
- カテゴリごとに分類して見やすく箇条書きにする（例：「Office系」「デザイン系」「CRM・SFA」など）
- 習熟度や具体的な使い方が書かれている場合はそのまま活かす
- 余計な前置きは不要、整えた結果だけ返す

--- 入力 ---
${text}`;

const buildPrPrompt = (text) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下のメモ書きを職務経歴書の「自己PR」欄にふさわしい文章に整えてください。
ルール：200〜400文字、強み→エピソード→貢献の流れ、です・ます調、整えた文章だけ返す。
--- 入力 ---
${text}`;

/* ─── ハンドラ ─── */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { type, text, context, isLatest } = req.body;

  if (!type || !text) {
    return res.status(400).json({ error: "type and text are required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured" });
  }

  // プロンプトと検索ツール有無を決定
  let prompt;
  let useWebSearch = false;

  if (type === "career") {
    if (isLatest) {
      prompt = buildCurrentCareerPrompt(text, context);
      useWebSearch = true; // 最新の経歴のみWeb検索
    } else {
      prompt = buildPastCareerPrompt(text, context);
    }
  } else if (type === "skills") {
    prompt = buildSkillsPrompt(text);
  } else if (type === "pr") {
    prompt = buildPrPrompt(text);
  } else {
    return res.status(400).json({ error: `Unknown type: ${type}` });
  }

  // リクエストボディ組み立て
  const requestBody = {
    model: "claude-sonnet-4-20250514",
    max_tokens: useWebSearch ? 2500 : 1200,
    messages: [{ role: "user", content: prompt }],
  };

  // Web検索ツールを有効化（最新の経歴のみ）
  if (useWebSearch) {
    requestBody.tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 1, // コスト抑制：1回のみ許可
      },
    ];
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return res.status(response.status).json({ error: "AI API error", details: data });
    }

    // テキストブロックだけを連結（tool_use や tool_result ブロックは除外）
    const result = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("")
      .trim();

    return res.status(200).json({ result });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
