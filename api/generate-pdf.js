// Vercel serverless function: /api/generate-pdf.js
// Receives resume data from the browser, forwards to Google Apps Script webhook

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const gasUrl = process.env.GAS_WEBHOOK_URL;
  const gasSecret = process.env.GAS_WEBHOOK_SECRET;

  if (!gasUrl || !gasSecret) {
    return res.status(500).json({
      error: "サーバー設定が不足しています（GAS_WEBHOOK_URL または GAS_WEBHOOK_SECRET）",
    });
  }

  const { data } = req.body || {};
  if (!data) {
    return res.status(400).json({ error: "data is required" });
  }

  try {
    // Google Apps Script Webhookに転送
    const gasRes = await fetch(gasUrl, {
      method: "POST",
      // GASのウェブアプリはリダイレクトを返すことがあるため follow する
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: gasSecret,
        data,
      }),
    });

    const responseText = await gasRes.text();

    let gasData;
    try {
      gasData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("GAS response parse error. Raw:", responseText.substring(0, 500));
      return res.status(502).json({
        error: "GAS からの応答を解析できませんでした",
        hint: "GAS のウェブアプリが正しくデプロイされているか、アクセス権限が「全員」になっているかを確認してください",
      });
    }

    if (!gasData.success) {
      console.error("GAS returned error:", gasData);
      return res.status(502).json({
        error: gasData.error || "PDF生成に失敗しました",
        details: gasData,
      });
    }

    return res.status(200).json({
      success: true,
      fileName: gasData.fileName,
      fileId: gasData.fileId,
      webViewLink: gasData.webViewLink,
      downloadLink: gasData.downloadLink,
    });
  } catch (error) {
    console.error("generate-pdf error:", error);
    return res.status(500).json({
      error: "PDF生成リクエストに失敗しました",
      details: error.message,
    });
  }
}
