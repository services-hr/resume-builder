/**
 * AI整形API
 *
 * - career ：職務経歴の「実績・課題・課題解決にあたり行った行動」だけを整え、JSONで返す（Web検索なし）
 * - summary：職務要約を作成（通算年数・在籍社数はフロントで計算した値を使う）
 * - skills, pr：通常の整形
 */

// ─────────────────────────────────────────────
// 使用モデル（退役時はここ1箇所だけ直せばOK）
//   コスパ重視（推奨）: "claude-sonnet-4-6"
//   最高品質         : "claude-opus-4-8"
// ─────────────────────────────────────────────
const MODEL = "claude-opus-5-5";

/* ─── 職務経歴（実績・課題・行動）のブラッシュアップ ─── */

const blankOr = (v) => (v && String(v).trim() ? String(v).trim() : "（記載なし）");

// 1社分の部署リストを、AIに渡す①〜⑧のテキストにする
const buildCareerInput = (departments) => departments.map((d, i) => {
  const tasks = Array.isArray(d.tasks) && d.tasks.length
    ? d.tasks.map((t) => `・${t}`).join("\n")
    : "（記載なし）";
  return `【部署${i + 1}】
①所属部署：${blankOr(d.name)}／役職：${blankOr(d.title)}
②所属期間：${blankOr(d.period)}
③職種：${blankOr(d.jobType)}
④業務内容：
${tasks}
⑤取扱商材：${blankOr(d.products)}
⑥実績：
${blankOr(d.achievements)}
⑦課題：
${blankOr(d.challenge)}
⑧課題解決にあたり行った行動：
${blankOr(d.actions)}`;
}).join("\n\n");

const buildCareerPrompt = (departments) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下は、求職者が1つの会社について部署ごとに入力した内容です。
各部署の「⑥実績」「⑦課題」「⑧課題解決にあたり行った行動」を、職務経歴書にそのまま載せられる表現に整えてください。
①〜⑤は内容を理解するための参考情報です。①〜⑤は書き換えず、出力にも含めないでください。

【厳守事項】
- 入力にない数字・事実・固有名詞を書き足さない。表現を整えるだけで、成果を誇張しない。
- 入力にある数字・固有名詞・事実は、省略せずに残す。
- 「（記載なし）」の項目は補完せず、空欄のまま返す（achievements・actions は空の配列 []、challenge は空文字 ""）。
- 各項目の内容は、その項目の中だけで整える。別の項目へ移したり、①〜⑤の内容を書き写したりしない。
- 「大幅に」「圧倒的な」など、入力にない強調表現を足さない。

【書き方】
- achievements（実績）：1要素に1つの実績を入れた配列。体言止めを基本に、1要素は1文で簡潔に。
- challenge（課題）：1〜3文の文章。「〜していた」「〜だった」などの常体で書く。
- actions（課題解決にあたり行った行動）：1要素に1つの行動を入れた配列。体言止めを基本に、行動ごとに分ける。
- 配列の各要素の先頭に「・」や番号は付けない。

【出力形式】
次の形のJSONだけを出力してください。前置き・説明・コードブロック記号は付けないでください。
departments は入力の部署と同じ数・同じ順番にし、index には部署番号（1から）を入れてください。
{"departments":[{"index":1,"achievements":["..."],"challenge":"...","actions":["..."]}]}

--- 入力 ---
${buildCareerInput(departments)}`;

const buildSkillsPrompt = (text) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下のメモ書きを職務経歴書の「スキル」欄にふさわしい形に整えてください。

【整形ルール】
- ツール名・ソフトウェア名を**正式名称**に直す（例：「エクセル」→「Microsoft Excel」、「セルフォース」→「Salesforce」）
- カテゴリごとに分類して見やすく箇条書きにする（例：「Office系」「デザイン系」「CRM・SFA」「コミュニケーション」「開発ツール」「語学」など）

【スキル説明の書き方（最重要）】
本人のレベル・年数・経験記述から、**「そのレベルなら何ができるか」を一般論として推測補足**してください。
ツール自体の業務スタンダード説明（「データ集計・分析の業務スタンダード」など）は**書かない**。求職者本人の能力範囲を示すこと。

■ ケース1：レベルだけ書かれている場合（初心者／初級／中級／上級／上級者など）
→ そのレベルでできることを一般論として補足する。
→ 入力例：「エクセルは中級」
→ 出力例：「・Microsoft Excel（中級）：関数（VLOOKUP、IF）、ピボットテーブル、グラフ作成が可能」

■ ケース2：年数や経験範囲が書かれている場合
→ 本人の記述（年数・範囲）を尊重しつつ、その経験で何ができるかを補足する。
→ 入力例：「hubspotは2年触って管理や構築まで」
→ 出力例：「・HubSpot（2年）：管理画面の運用、ワークフロー構築、データ整理が可能」

■ ケース3：客観的なスコア・資格の場合（TOEIC、英検、各種認定試験など）
→ 一切手を加えず、そのまま記載。
→ 入力例：「TOEIC800点」
→ 出力例：「・英語：TOEIC 800点」

■ ケース4：本人がレベルも経験も書かず、ツール名だけ記載している場合
→ 説明は付けず、ツール名だけ表記。
→ 出力例：「・Microsoft Word」

【レベル別「何ができるか」の推測の目安（一般論）】
- **初心者・初級**：基本的な操作・作成が可能
- **中級**：実務でよく使う機能を一通り扱える（具体的な機能名を1〜3個含めるとよい）
- **上級・上級者**：応用・自動化・高度な分析が可能（具体的な高度機能を含める）

業界特有のツール（HubSpot、Salesforce、Figmaなど）についても、本人のレベル・年数記述に応じて「できること」を推測補足してください。

【厳守事項】
- **本人がメモに書いていない定量情報を勝手に追加しない**。
  - 年数（「5年」「3年」）は本人が書いていない限り絶対に追加しない。
  - スコア（「TOEIC 800点」など）も本人が書いていない限り絶対に追加しない。
- ツール自体の一般的な業務スタンダード説明（「〇〇は△△の標準ツール」など）は**書かない**。求職者本人のスキル説明にすること。
- 余計な前置き・後書きは不要、整えた結果だけ返す。

【出力形式の例】
【Office系】
・Microsoft Excel（中級）：関数（VLOOKUP、IF）、ピボットテーブル、グラフ作成が可能
・Microsoft PowerPoint（初級）：基本的な資料作成が可能

【CRM・MA】
・HubSpot（2年）：管理画面の運用、ワークフロー構築、データ整理が可能

【語学】
・英語：TOEIC 800点

--- 入力 ---
${text}`;

const buildPrPrompt = (text) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下のメモ書きを職務経歴書の「自己PR」欄にふさわしい文章に整えてください。

【自己PRの理想的な構成】
1. 素養（強み）：自分の核となる能力・特長
2. その素養が活かされた経験の概要：いつ・どこで・何の業務で
3. 当時の課題：何が問題だったか
4. そこに対する施策：具体的にどう動いたか
5. 成果：できれば数字や具体的な変化で

【整形ルール】
- 上記の構成順序で自然な文章に整える（です・ます調）
- 200〜400文字程度
- メモに記載がない項目は**無理に作成・捏造せず**、書かれている内容だけで構成する
- 数字や固有名詞はメモから取り、勝手に作らない
- 余計な前置き・後書きは不要、整えた文章だけ返す

--- 入力 ---
${text}`;

// 職務要約：通算年数・在籍社数はフロントで計算した値をそのまま使わせる
const buildSummaryPrompt = (careersText, stats) => `あなたは中途採用向けの職務経歴書を作成するプロのキャリアアドバイザーです。
以下の職務経歴をもとに、職務経歴書の冒頭に置く「職務要約」を作成してください。

【職務要約の役割】
- 採用担当者が3秒で「どんなキャリアの人か」を把握できる、キャリア全体のサマリー文
- 200〜300字程度
- 通算年数・在籍社数・主な職種・得意領域を含める
- 直近の業務がわかるように記載
- です・ます調

【厳守事項】
- 入力にない数字・事実を書き足さない。表現を整えるだけで、成果を誇張しない。
- 通算年数・在籍社数は、下記【通算年数・在籍社数】の値をそのまま使う。自分で計算し直さない。
- 値が「（記載なし）」の項目には触れない。
- 余計な前置き・後書きは不要、本文だけ返す

【通算年数・在籍社数】
${stats || "（記載なし）"}

--- 職務経歴 ---
${careersText}`;

/* ─── 職務経歴のAI応答（JSON）を読み取る ─── */

const BULLET_RE = /^\s*(?:[・･*＊•●○◦]|[-－‐](?![0-9０-９])|[0-9]{1,2}[.．)）](?![0-9])|[①-⑳])\s*/;
const isBlank = (v) => !v || !String(v).trim();

const toList = (v) => {
  const arr = Array.isArray(v) ? v : String(v || "").split("\n");
  return arr.map((x) => String(x == null ? "" : x).replace(BULLET_RE, "").trim()).filter(Boolean);
};

// ```json などの囲みや前後の文章があっても、{ 〜 } を取り出して読む
const extractJson = (text) => {
  const cleaned = String(text || "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("JSONが見つかりません");
  return JSON.parse(cleaned.slice(start, end + 1));
};

// 入力が空の項目は必ず空で返す。AIが落とした項目は入力をそのまま使う（内容を消さないため）
const normalizeCareerResult = (parsed, departments) => {
  const list = Array.isArray(parsed && parsed.departments) ? parsed.departments : [];
  return departments.map((d, i) => {
    const hit = list.find((x) => x && Number(x.index) === i + 1) || list[i] || {};

    const achievements = isBlank(d.achievements) ? [] : toList(hit.achievements);
    const actions = isBlank(d.actions) ? [] : toList(hit.actions);
    const challenge = isBlank(d.challenge) ? "" : String(hit.challenge || "").trim();

    return {
      achievements: achievements.length || isBlank(d.achievements) ? achievements : toList(d.achievements),
      challenge: challenge || (isBlank(d.challenge) ? "" : String(d.challenge).trim()),
      actions: actions.length || isBlank(d.actions) ? actions : toList(d.actions),
    };
  });
};

/* ─── ハンドラ ─── */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { type, text, context, departments } = req.body || {};

  if (!type) {
    return res.status(400).json({ error: "type が指定されていません" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY が設定されていません" });
  }

  // プロンプトと出力形式を決定
  let prompt;
  let maxTokens = 1200;
  let expectJson = false;

  if (type === "career") {
    if (!Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ error: "部署の情報が送られていません" });
    }
    prompt = buildCareerPrompt(departments);
    maxTokens = 3000;
    expectJson = true;
  } else {
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "入力が空です" });
    }
    if (type === "skills") {
      prompt = buildSkillsPrompt(text);
    } else if (type === "pr") {
      prompt = buildPrPrompt(text);
    } else if (type === "summary") {
      prompt = buildSummaryPrompt(text, context);
    } else {
      return res.status(400).json({ error: `不明な type です: ${type}` });
    }
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
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return res.status(response.status).json({
        error: "AIの処理に失敗しました。時間をおいて、もう一度お試しください",
        details: data,
      });
    }

    const resultText = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("")
      .trim();

    if (!expectJson) {
      return res.status(200).json({ result: resultText });
    }

    let parsed;
    try {
      parsed = extractJson(resultText);
    } catch (parseError) {
      console.error("Career JSON parse error. stop_reason:", data.stop_reason, "Raw:", resultText.substring(0, 500));
      return res.status(502).json({
        error: "AIの応答を読み取れませんでした。もう一度「AIで整える」を押してください",
      });
    }

    return res.status(200).json({
      result: { departments: normalizeCareerResult(parsed, departments) },
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "サーバーでエラーが発生しました。時間をおいて、もう一度お試しください" });
  }
}
