/**
 * 職務経歴書PDF生成Webhook + スプレッドシート蓄積 (Google Apps Script)
 * ================================================================
 *
 * このスクリプトは Google Apps Script の「ウェブアプリ」として公開することで、
 * 外部（Vercel）から叩けるWebhookエンドポイントになります。
 *
 * 【役割】
 *  1. Vercelから送られてきたJSONデータを受信
 *  2. シークレットトークンで認証
 *  3. Googleドキュメントのテンプレートを複製
 *  4. プレースホルダを実際の値で置換
 *  5. PDFに変換してDrive指定フォルダに保存
 *  6. スプレッドシートに1行追加（HubSpot取り込みを想定したフラット構造）
 *  7. DriveのURLを返す
 *
 * 【セットアップ】
 *  スクリプトのプロパティに以下を設定してください（「プロジェクトの設定」→「スクリプト プロパティ」）
 *    - TEMPLATE_DOC_ID     : 職務経歴書テンプレートのGoogleドキュメントID
 *    - OUTPUT_FOLDER_ID    : PDF保存先のGoogle DriveフォルダID
 *    - SPREADSHEET_ID      : データ蓄積用スプレッドシートのID
 *    - SHEET_NAME          : 書き込むシート名（例：candidates）
 *    - WEBHOOK_SECRET      : Vercelと共有する認証用の秘密トークン
 */

/* ═══════════════════════════════════════════════════════════
   エントリポイント
   ═══════════════════════════════════════════════════════════ */

/** POSTリクエストを受け取る（Webhookエンドポイント本体） */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // 認証チェック
    const secret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    if (!secret || body.secret !== secret) {
      return jsonResponse({ success: false, error: "認証に失敗しました" });
    }

    if (!body.data) {
      return jsonResponse({ success: false, error: "データが送信されていません" });
    }

    // 1. PDF生成
    const pdfResult = generateResumePDF(body.data);

    // 2. スプレッドシートに行追加（PDFのURLも含める）
    let sheetResult = { success: false };
    try {
      sheetResult = appendToSpreadsheet(body.data, pdfResult);
    } catch (sheetError) {
      // シート追加に失敗してもPDF生成は成功させる
      console.error("スプレッドシート追加エラー（PDFは生成済み）:", sheetError);
      sheetResult = { success: false, error: sheetError.message };
    }

    return jsonResponse({
      success: true,
      fileName: pdfResult.fileName,
      fileId: pdfResult.fileId,
      webViewLink: pdfResult.webViewLink,
      downloadLink: pdfResult.downloadLink,
      sheetAppended: sheetResult.success,
      sheetError: sheetResult.error,
      rowNumber: sheetResult.rowNumber,
    });
  } catch (error) {
    console.error("doPost error:", error);
    return jsonResponse({
      success: false,
      error: error.message || "不明なエラーが発生しました",
    });
  }
}

/** ブラウザ確認用（GETは動作確認のみ） */
function doGet() {
  return jsonResponse({
    success: true,
    message: "職務経歴書PDF生成Webhookは稼働中です。POSTリクエストを送信してください。",
    timestamp: new Date().toISOString(),
  });
}

/* ═══════════════════════════════════════════════════════════
   PDF生成
   ═══════════════════════════════════════════════════════════ */

function generateResumePDF(data) {
  const props = PropertiesService.getScriptProperties();
  const templateId = props.getProperty("TEMPLATE_DOC_ID");
  const folderId = props.getProperty("OUTPUT_FOLDER_ID");

  if (!templateId) throw new Error("TEMPLATE_DOC_ID が設定されていません");
  if (!folderId) throw new Error("OUTPUT_FOLDER_ID が設定されていません");

  const outputFolder = DriveApp.getFolderById(folderId);
  const tempName = `_temp_resume_${Date.now()}`;
  const templateFile = DriveApp.getFileById(templateId);
  const copiedFile = templateFile.makeCopy(tempName, outputFolder);
  const copiedDocId = copiedFile.getId();

  try {
    const doc = DocumentApp.openById(copiedDocId);
    replacePlaceholders(doc, data);
    doc.saveAndClose();

    const pdfBlob = DriveApp.getFileById(copiedDocId).getAs("application/pdf");
    const fileName = buildFileName(data);
    pdfBlob.setName(`${fileName}.pdf`);

    const pdfFile = outputFolder.createFile(pdfBlob);

    return {
      fileName: pdfFile.getName(),
      fileId: pdfFile.getId(),
      webViewLink: `https://drive.google.com/file/d/${pdfFile.getId()}/view`,
      downloadLink: `https://drive.google.com/uc?export=download&id=${pdfFile.getId()}`,
    };
  } finally {
    try {
      DriveApp.getFileById(copiedDocId).setTrashed(true);
    } catch (e) {
      console.warn("一時ファイルの削除に失敗:", e);
    }
  }
}

/**
 * ドキュメント内のプレースホルダを実データで置換
 *
 * 想定テンプレート構造：
 *  - {{lastName}}, {{firstName}}, {{lastNameKana}}, {{firstNameKana}}
 *  - {{fullName}}, {{fullNameKana}}（結合版。どちらを使ってもOK）
 *  - {{birthDate}}, {{age}}, {{email}}, {{phone}}, {{address}}, {{nearestStation}}, {{today}}
 *  - {{careers}}（この段落が職務経歴の繰り返しブロックに置換される）
 *  - {{skills}}, {{qualifications}}, {{pr}}
 */
function replacePlaceholders(doc, data) {
  const body = doc.getBody();
  const basic = data.basic || {};

  // 基本情報
  body.replaceText("{{lastName}}",       safe(basic.lastName));
  body.replaceText("{{firstName}}",      safe(basic.firstName));
  body.replaceText("{{lastNameKana}}",   safe(basic.lastNameKana));
  body.replaceText("{{firstNameKana}}",  safe(basic.firstNameKana));
  body.replaceText("{{fullName}}",       `${safe(basic.lastName)} ${safe(basic.firstName)}`.trim());
  body.replaceText("{{fullNameKana}}",   `${safe(basic.lastNameKana)} ${safe(basic.firstNameKana)}`.trim());
  body.replaceText("{{birthDate}}",      formatDateJP(basic.birthDate));
  body.replaceText("{{age}}",            calcAge(basic.birthDate));
  body.replaceText("{{email}}",          safe(basic.email));
  body.replaceText("{{phone}}",          safe(basic.phone));
  body.replaceText("{{address}}",        safe(basic.address));
  body.replaceText("{{nearestStation}}", safe(basic.nearestStation));
  body.replaceText("{{today}}",          todayJP());

  // 職務経歴（繰り返しブロック展開）
  replaceBlockSection(body, "{{careers}}", (insertIndex) => {
    const careers = data.careers || [];
    careers.forEach((c, idx) => {
      const periodStr = buildPeriod(c);
      const desc = (c.refinedDescription || c.rawDescription || "—").trim();
      const headingText = `${safe(c.company) || "—"}（${periodStr}）`;

      const heading = body.insertParagraph(insertIndex + idx * 4, headingText);
      heading.setHeading(DocumentApp.ParagraphHeading.HEADING3);

      if (c.position) {
        body.insertParagraph(insertIndex + idx * 4 + 1, `役職・部署：${c.position}`);
      } else {
        body.insertParagraph(insertIndex + idx * 4 + 1, "");
      }

      body.insertParagraph(insertIndex + idx * 4 + 2, `【業務内容】\n${desc}`);
      body.insertParagraph(insertIndex + idx * 4 + 3, "");
    });
  });

  // スキル
  const skillsText = (data.skillsRefined || data.skillsRaw || "").trim();
  body.replaceText("{{skills}}", skillsText || "（記載なし）");

  // 資格
  const quals = (data.qualifications || []).filter((q) => q && q.name && q.name.trim());
  if (quals.length === 0) {
    body.replaceText("{{qualifications}}", "（記載なし）");
  } else {
    const qualsText = quals.map((q) => {
      const date = q.year && q.month ? `${q.year}年${q.month}月` : q.year ? `${q.year}年` : "";
      return date ? `${date}\t${q.name}` : q.name;
    }).join("\n");
    body.replaceText("{{qualifications}}", qualsText);
  }

  // 自己PR
  const prText = (data.prRefined || data.prRaw || "").trim();
  body.replaceText("{{pr}}", prText || "（記載なし）");
}

/** {{careers}} のような繰り返しブロックを展開するヘルパー */
function replaceBlockSection(body, placeholder, insertFn) {
  const numChildren = body.getNumChildren();
  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    const text = child.asParagraph().getText();
    if (text.indexOf(placeholder) === -1) continue;
    body.removeChild(child);
    insertFn(i);
    return;
  }
}

/* ═══════════════════════════════════════════════════════════
   スプレッドシート蓄積（HubSpot取り込み対応）
   ═══════════════════════════════════════════════════════════ */

/**
 * スプレッドシートの列定義
 *
 * - HubSpot標準プロパティ名に合わせた列名（firstname, lastname, email, phone, address, jobtitle）
 * - カスタムプロパティ候補（lastname_kana, firstname_kana, birth_date, age, ...）
 * - 職歴は直近3件までを company_1/2/3、position_1/2/3 などに展開
 * - それ以上の職歴は career_history_all にテキスト結合
 *
 * この順序でシート1行目に列ヘッダーを置く必要があります。
 * setupSheetHeaders() 関数を実行すると自動で書き込まれます。
 */
const SHEET_COLUMNS = [
  "submitted_at",         // 送信日時
  "source",               // 固定値：resume_builder
  "lastname",             // 姓（HubSpot標準）
  "firstname",            // 名（HubSpot標準）
  "lastname_kana",        // 姓フリガナ（カスタム）
  "firstname_kana",       // 名フリガナ（カスタム）
  "email",                // メール（HubSpot標準）
  "phone",                // 電話（HubSpot標準）
  "address",              // 住所（HubSpot標準）
  "birth_date",           // 生年月日（カスタム・YYYY-MM-DD）
  "age",                  // 年齢（カスタム・数値）
  "nearest_station",      // 最寄駅（カスタム）
  "jobtitle",             // 現職役職（HubSpot標準）
  "current_company",      // 現職会社名（HubSpot標準 company）

  "company_1", "period_1", "position_1", "description_1",
  "company_2", "period_2", "position_2", "description_2",
  "company_3", "period_3", "position_3", "description_3",

  "career_history_all",   // 全職歴を結合したテキスト
  "skills_summary",       // スキル整形結果
  "qualifications_list",  // 資格一覧
  "self_pr",              // 自己PR整形結果
  "pdf_drive_url",        // 生成PDFのDriveリンク
  "pdf_file_id",          // PDFのファイルID
];

/** 受信データをフラット化してスプレッドシートに1行追加 */
function appendToSpreadsheet(data, pdfResult) {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("SPREADSHEET_ID");
  const sheetName = props.getProperty("SHEET_NAME") || "candidates";

  if (!spreadsheetId) throw new Error("SPREADSHEET_ID が設定されていません");

  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // シートがなければ作って列ヘッダーを書く
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, SHEET_COLUMNS.length).setValues([SHEET_COLUMNS]);
    sheet.getRange(1, 1, 1, SHEET_COLUMNS.length)
      .setBackground("#e8f0eb")
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  const row = buildSheetRow(data, pdfResult);
  sheet.appendRow(row);
  const rowNumber = sheet.getLastRow();

  return { success: true, rowNumber };
}

/** フラット化：ネストされた受信データを1行分の配列に変換 */
function buildSheetRow(data, pdfResult) {
  const basic = data.basic || {};
  const careers = data.careers || [];

  // 現職を特定（isCurrent=true があればそれ、なければ配列の最初）
  const currentCareer = careers.find((c) => c.isCurrent) || careers[0] || {};

  // 直近3件分の職歴を展開
  const c = [0, 1, 2].map((idx) => careers[idx] || {});

  // 全職歴を1つのテキストに結合
  const allHistory = careers.map((career) => {
    const period = buildPeriod(career);
    const pos = career.position ? `（${career.position}）` : "";
    const desc = (career.refinedDescription || career.rawDescription || "").trim();
    return `■ ${safe(career.company)}${pos} ${period}\n${desc}`;
  }).join("\n\n");

  // 資格一覧を1つのテキストに
  const qualsText = (data.qualifications || [])
    .filter((q) => q && q.name && q.name.trim())
    .map((q) => {
      const date = q.year && q.month ? `${q.year}/${q.month}` : q.year ? `${q.year}` : "";
      return date ? `${date} ${q.name}` : q.name;
    }).join("\n");

  const colMap = {
    submitted_at: new Date(),
    source: "resume_builder",
    lastname: safe(basic.lastName),
    firstname: safe(basic.firstName),
    lastname_kana: safe(basic.lastNameKana),
    firstname_kana: safe(basic.firstNameKana),
    email: safe(basic.email),
    phone: safe(basic.phone),
    address: safe(basic.address),
    birth_date: safe(basic.birthDate),
    age: basic.birthDate ? parseInt(calcAge(basic.birthDate), 10) : "",
    nearest_station: safe(basic.nearestStation),
    jobtitle: safe(currentCareer.position),
    current_company: safe(currentCareer.company),

    company_1: safe(c[0].company), period_1: buildPeriod(c[0]),
    position_1: safe(c[0].position),
    description_1: (c[0].refinedDescription || c[0].rawDescription || "").trim(),
    company_2: safe(c[1].company), period_2: buildPeriod(c[1]),
    position_2: safe(c[1].position),
    description_2: (c[1].refinedDescription || c[1].rawDescription || "").trim(),
    company_3: safe(c[2].company), period_3: buildPeriod(c[2]),
    position_3: safe(c[2].position),
    description_3: (c[2].refinedDescription || c[2].rawDescription || "").trim(),

    career_history_all: allHistory,
    skills_summary: (data.skillsRefined || data.skillsRaw || "").trim(),
    qualifications_list: qualsText,
    self_pr: (data.prRefined || data.prRaw || "").trim(),
    pdf_drive_url: pdfResult.webViewLink || "",
    pdf_file_id: pdfResult.fileId || "",
  };

  // SHEET_COLUMNS の順に並び替えて配列化
  return SHEET_COLUMNS.map((col) => colMap[col] !== undefined ? colMap[col] : "");
}

/* ═══════════════════════════════════════════════════════════
   ユーティリティ
   ═══════════════════════════════════════════════════════════ */

function safe(v) {
  return (v == null || v === "") ? "" : String(v);
}

function formatDateJP(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function calcAge(dateStr) {
  if (!dateStr) return "";
  const b = new Date(dateStr);
  if (isNaN(b.getTime())) return "";
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return `${a}歳`;
}

function todayJP() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function buildPeriod(c) {
  if (!c) return "";
  const from = c.fromYear && c.fromMonth ? `${c.fromYear}年${c.fromMonth}月` : "";
  const to = c.isCurrent ? "現在" : (c.toYear && c.toMonth ? `${c.toYear}年${c.toMonth}月` : "");
  if (from && to) return `${from} 〜 ${to}`;
  if (from) return `${from} 〜`;
  return "";
}

function buildFileName(data) {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  const basic = data.basic || {};
  const fullName = `${safe(basic.lastName)} ${safe(basic.firstName)}`.trim();
  const name = fullName || "名前未入力";
  return `${name}_職務経歴書_${yyyymmdd}`;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════════════════════════════════════
   手動テスト・セットアップ用関数
   ═══════════════════════════════════════════════════════════ */

/** 動作確認用：GASエディタから実行してサンプルPDF＋シート行が生成されることを確認 */
function testGenerate() {
  const sampleData = {
    basic: {
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
      birthDate: "1990-05-15",
      email: "yamada@example.com",
      phone: "090-1234-5678",
      address: "東京都渋谷区恵比寿1-2-3",
      nearestStation: "JR恵比寿駅 徒歩5分",
    },
    careers: [
      {
        company: "株式会社サンプル",
        fromYear: "2020", fromMonth: "4",
        toYear: "", toMonth: "", isCurrent: true,
        position: "営業部 主任",
        rawDescription: "",
        refinedDescription: "法人向けITソリューションの提案営業を担当。\n新規開拓で年間売上1.2億円を達成。\n5名チームのリーダーとしてメンバー育成にも従事。",
      },
      {
        company: "株式会社前職",
        fromYear: "2016", fromMonth: "4",
        toYear: "2020", toMonth: "3", isCurrent: false,
        position: "営業アシスタント",
        rawDescription: "",
        refinedDescription: "営業部の事務・資料作成を担当。\n月次売上レポートの作成プロセスを改善。",
      },
    ],
    skillsRaw: "",
    skillsRefined: "【Office系】\n・Microsoft Excel（VLOOKUP、ピボットテーブル）\n・Microsoft PowerPoint（提案資料作成）\n\n【CRM・SFA】\n・Salesforce（3年）",
    qualifications: [
      { name: "普通自動車第一種運転免許", year: "2010", month: "8" },
      { name: "TOEIC 780点", year: "2019", month: "3" },
    ],
    prRaw: "",
    prRefined: "営業職として5年間、法人向けITソリューションの提案営業を担当してまいりました。数字に基づいた論理的な提案を強みとし、クライアントの課題を深く理解した上でのソリューション提案で、年間売上1.2億円を達成しました。",
  };

  const pdfResult = generateResumePDF(sampleData);
  console.log("PDF生成成功:", pdfResult);

  try {
    const sheetResult = appendToSpreadsheet(sampleData, pdfResult);
    console.log("シート追加成功:", sheetResult);
  } catch (e) {
    console.log("シート追加失敗:", e.message);
  }

  return pdfResult;
}

/** シートの列ヘッダーだけをセットアップしたい時に使う関数 */
function setupSheetHeaders() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("SPREADSHEET_ID");
  const sheetName = props.getProperty("SHEET_NAME") || "candidates";

  if (!spreadsheetId) throw new Error("SPREADSHEET_ID が設定されていません");

  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  sheet.getRange(1, 1, 1, SHEET_COLUMNS.length).setValues([SHEET_COLUMNS]);
  sheet.getRange(1, 1, 1, SHEET_COLUMNS.length)
    .setBackground("#e8f0eb")
    .setFontWeight("bold");
  sheet.setFrozenRows(1);

  console.log(`シート「${sheetName}」に${SHEET_COLUMNS.length}列のヘッダーをセットアップしました`);
}
