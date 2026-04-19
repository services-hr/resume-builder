# 変更内容まとめ（GAS + スプレッドシート蓄積版）

## このバージョンの構成

```
[ビルダーUI]  →  [Vercel中継]  →  [GAS Webhook]
                                      ├─→ Googleドキュメント差し込み → PDF → Drive保存
                                      └─→ Googleスプレッドシートに1行追加
                                                ↓
                                        CSVエクスポート → HubSpotインポート
```

---

## 実現できること

| 要件 | 状態 |
|---|---|
| テキスト検索・コピー可能なPDF | ✅ Googleドキュメント経由で自動対応 |
| 日本語フォント | ✅ Googleが自動対応 |
| Drive自動保存 | ✅ 指定フォルダに自動アップロード |
| **候補者データのDB蓄積** | ✅ **スプレッドシートに1人1行で自動蓄積** |
| **HubSpot取り込み** | ✅ **CSVエクスポートで対応** |

---

## ファイル構成

```
resume-builder/
├── src/
│   ├── ResumeBuilder.jsx        ← 氏名を姓・名・姓カナ・名カナの4項目に分離
│   └── main.jsx
├── api/
│   ├── refine.js                ← AI整形API
│   └── generate-pdf.js          ← GAS Webhookへの中継
├── gas/
│   ├── Code.gs                  ← GAS本体（PDF生成＋シート追記）
│   ├── TEMPLATE_DESIGN.md       ← Googleドキュメント テンプレ設計書
│   └── SHEET_AND_HUBSPOT.md     ← スプレッドシート列設計＋HubSpot連携手順
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── DEPLOY_GUIDE.md              ← ゼロからのセットアップ手順
└── CHANGES.md                   ← このファイル
```

---

## 前バージョンからの変更点

### 1. 氏名フィールドを分離

HubSpotの標準プロパティ（`firstname` / `lastname` が別列）に合わせるため、入力フォームを姓・名の4項目に変更しました。

**Before：**
```
氏名：[山田 太郎]
フリガナ：[ヤマダ タロウ]
```

**After：**
```
姓：[山田]        名：[太郎]
姓フリガナ：[ヤマダ]  名フリガナ：[タロウ]
```

テンプレート側のプレースホルダも `{{lastName}}` `{{firstName}}` `{{lastNameKana}}` `{{firstNameKana}}` に変更。結合したい場合は `{{fullName}}` `{{fullNameKana}}` も使えます。

### 2. スプレッドシート自動蓄積を追加

PDFが生成されるたびに、HubSpot取り込み形式でフラット化された1行がスプレッドシートに自動追加されます。

**追加された列（全32列）：**
- メタ情報（`submitted_at`, `source`）
- HubSpot標準プロパティ（`firstname`, `lastname`, `email`, `phone`, `address`, `jobtitle`, `current_company`）
- カスタムプロパティ候補（`lastname_kana`, `firstname_kana`, `birth_date`, `age`, `nearest_station`）
- 直近3社の職歴（`company_1`〜`description_3`）
- 全体テキスト（`career_history_all`, `skills_summary`, `qualifications_list`, `self_pr`）
- PDFへのリンク（`pdf_drive_url`, `pdf_file_id`）

### 3. HubSpot連携手順書

`gas/SHEET_AND_HUBSPOT.md` に、HubSpotカスタムプロパティの作成から CSVインポートまでの手順を追加しました。

---

## 初回セットアップ

セットアップは1回だけ必要です。詳しくは `DEPLOY_GUIDE.md` を参照。

1. GASプロジェクト作成 → `Code.gs` をコピペ
2. Googleドキュメントでテンプレート作成（`TEMPLATE_DESIGN.md` 通り）
3. **Googleスプレッドシート作成**（※新規手順）
4. GASスクリプトプロパティに5件を設定（**`SPREADSHEET_ID` と `SHEET_NAME` を追加**）
5. `setupSheetHeaders()` を1回実行してシートに列ヘッダーを自動生成（※新規手順）
6. GASをウェブアプリとしてデプロイ、URL取得
7. Vercelに環境変数3件を設定

## 環境変数一覧

### Vercel側（変更なし）

| Key | 用途 |
|---|---|
| `ANTHROPIC_API_KEY` | AI整形機能で使用 |
| `GAS_WEBHOOK_URL` | GASウェブアプリのURL |
| `GAS_WEBHOOK_SECRET` | GASと共有するシークレットトークン |

### GAS側（2件追加）

| Key | 用途 |
|---|---|
| `TEMPLATE_DOC_ID` | 職務経歴書テンプレートのGoogleドキュメントID |
| `OUTPUT_FOLDER_ID` | PDF保存先のGoogle DriveフォルダID |
| **`SPREADSHEET_ID`** | **候補者データベースのスプレッドシートID** |
| **`SHEET_NAME`** | **書き込むシート名（例：`candidates`）** |
| `WEBHOOK_SECRET` | Vercelと共有するシークレットトークン |

---

## HubSpot連携の使い方（概要）

1. 初回だけ：HubSpotでカスタムプロパティを作成（`SHEET_AND_HUBSPOT.md` にリスト）
2. 月次運用：スプレッドシートから「ファイル → ダウンロード → CSV」
3. HubSpotで「コンタクト → インポート」からCSVアップロード
4. 重複キーを `email` にすれば、最新データで自動更新

---

## 動作確認チェックリスト

- [ ] GASエディタで `setupSheetHeaders` を実行 → シートに32列のヘッダーが入る
- [ ] GASエディタで `testGenerate` を実行 → サンプルPDFがDriveに保存 & シートに1行追加
- [ ] Vercel環境変数の設定後、「AIで整える」が動く
- [ ] ビルダーUIで「PDFを生成してGoogle Driveに保存」→ 成功メッセージ
- [ ] 生成されたPDFの日本語が崩れていない、文字選択・検索できる
- [ ] スプレッドシートに新しい行が追加されている
- [ ] CSVダウンロード → HubSpotインポート → コンタクトに正しく反映
