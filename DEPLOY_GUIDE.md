# 職務経歴書ビルダー デプロイ手順書（GAS連携版）

GitHub・Vercel・Google Apps Script を初めて触る方向けに、ゼロからデプロイするまでの手順をまとめています。

---

## 全体の流れ

1. **Google Apps Script（GAS）を準備**：PDF生成+シート書き込みの本体
2. **Googleドキュメントのテンプレートを作成**：PDFのレイアウト元
3. **Googleスプレッドシートを作成**：候補者データを蓄積
4. **GitHub にコードをアップロード**
5. **Vercel でビルダーUIをデプロイ**
6. **環境変数を設定**して動作確認
7. **（必要に応じて）HubSpotにCSVインポート**

---

## 事前に必要なもの

- **パソコン**（Windows / Mac どちらでもOK）
- **Googleアカウント**（Apps Script と Drive で使用）
- **GitHubアカウント**（なければステップ3で作成）
- **Anthropic の APIキー**（AI整形機能用。https://console.anthropic.com で取得）

---

## ステップ1：Google Apps Script を準備する

### 1-1. スクリプトプロジェクトを作成

1. https://script.google.com にアクセス（Googleアカウントでログイン）
2. 左上の「**+ 新しいプロジェクト**」をクリック
3. プロジェクト名を「**職務経歴書PDFビルダー**」に変更
4. デフォルトで開いている `Code.gs` の中身を **すべて削除**
5. 本プロジェクトの `gas/Code.gs` の中身を **まるごとコピー＆ペースト**
6. 💾 保存アイコンをクリック（または Ctrl/Cmd + S）

### 1-2. Googleドキュメントのテンプレートを作る

`gas/TEMPLATE_DESIGN.md` を開いて、記載されている手順どおりに**Googleドキュメントで**テンプレートを作成します（所要時間：15〜20分）。

作ったら、そのドキュメントのURLから**ドキュメントID**をメモしてください。

```
https://docs.google.com/document/d/【このIDをメモ】/edit
```

### 1-3. スプレッドシートを作成してデータベースにする

候補者データを1人1行で蓄積するためのスプレッドシートを用意します。

1. https://sheets.google.com で新規スプレッドシート作成
2. ファイル名を「**候補者データベース**」に変更
3. デフォルトの「シート1」を右クリック→名前変更→`candidates` に変更
4. URL から**スプレッドシートID**をメモ：
   ```
   https://docs.google.com/spreadsheets/d/【このIDをメモ】/edit
   ```
5. 列ヘッダーは後でGASの `setupSheetHeaders()` 関数で自動生成します

詳細は `gas/SHEET_AND_HUBSPOT.md` を参照してください。

### 1-4. 保存先のGoogle Driveフォルダを用意

既に用意済みのフォルダIDを使います：

```
1qxKR7J4SPiCL-aqf6Hh7AIC30FjaY0xC
```

※ 別のフォルダを使いたい場合は、対象フォルダをブラウザで開いてURL末尾のIDを控えてください。

### 1-5. スクリプトプロパティを設定

1. GASエディタの左サイドバーの **⚙️（歯車）アイコン＝プロジェクトの設定** をクリック
2. 下にスクロールして「**スクリプト プロパティ**」セクションまで行く
3. 「**スクリプト プロパティを追加**」をクリックして、以下の5つを登録：

| プロパティ名 | 値 |
|---|---|
| `TEMPLATE_DOC_ID` | 1-2 でメモしたテンプレートのドキュメントID |
| `OUTPUT_FOLDER_ID` | `1qxKR7J4SPiCL-aqf6Hh7AIC30FjaY0xC` |
| `SPREADSHEET_ID` | 1-3 で作成したスプレッドシートのID |
| `SHEET_NAME` | `candidates`（または自分で付けたシート名） |
| `WEBHOOK_SECRET` | 自分で決めたランダムな文字列（例：`abcd1234-rand0m-secret`）※後でVercelにも設定します |

4. 「保存」をクリック

### 1-6. シートの列ヘッダーを自動セットアップ

1. 関数選択プルダウンで `setupSheetHeaders` を選ぶ
2. 「▶ 実行」
3. 初回は権限承認画面が出るので許可
4. スプレッドシートを開くと、1行目に32列のヘッダー（`submitted_at`, `lastname`, `firstname`, ...）が緑背景で入っていればOK

### 1-7. 動作テスト

1. エディタ画面の上部で、関数選択プルダウンから「**testGenerate**」を選ぶ
2. 「▶ 実行」ボタンをクリック
3. 実行ログで `PDF生成成功: {...}` と `シート追加成功: {...}` が表示されればOK
4. Driveフォルダ：サンプルPDFが保存されている
5. スプレッドシート：2行目にサンプルデータが入っている

レイアウトに問題があれば、テンプレートを調整してから再度 `testGenerate` を実行してください。

### 1-8. ウェブアプリとしてデプロイ

1. 右上の「**デプロイ**」→「**新しいデプロイ**」
2. 種類：**ウェブアプリ** を選択（歯車アイコン）
3. 設定：
   - 説明：`職務経歴書PDF Webhook v1`（任意）
   - 次のユーザーとして実行：**自分**
   - アクセスできるユーザー：**全員**
4. 「**デプロイ**」をクリック
5. 表示される「**ウェブアプリのURL**」を**必ずコピーしてメモ**します（後で Vercel に設定）

⚠️ **重要**：このURLは外部から叩けるWebhookになります。`WEBHOOK_SECRET` を知らない人がリクエストしても認証で弾かれる設計ですが、URLは人に教えないでください。

---

## ステップ2：GitHubにプロジェクトをアップロード

### 2-1. GitHubアカウントを作る（既に持っていればスキップ）

1. https://github.com/signup で登録
2. メールアドレス、パスワード、ユーザー名を入力
3. メール認証を完了

### 2-2. 新しいリポジトリを作成

1. https://github.com/new にアクセス
2. Repository name：`resume-builder`
3. Public を選択 → 「**Create repository**」

### 2-3. ファイルをアップロード

**方法A：画面から直接アップロード（かんたん）**

1. 作成されたページで「**uploading an existing file**」リンクをクリック
2. このプロジェクトのZIPを解凍した中身**すべて**をドラッグ＆ドロップ：
   - `package.json`、`vite.config.js`、`vercel.json`、`index.html`、`.gitignore`
   - `src/` フォルダ
   - `api/` フォルダ（`refine.js`、`generate-pdf.js`）
   - ※ `gas/` フォルダと `CHANGES.md`、`DEPLOY_GUIDE.md` もアップしてOK（Vercelは自動で無視します）
3. 「**Commit changes**」をクリック

⚠️ GitHub画面からのアップロードではフォルダ構造が維持されない場合があります。その場合は方法Bを使ってください。

**方法B：コマンドラインから**

```bash
cd ~/Downloads/resume-builder
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/あなたのユーザー名/resume-builder.git
git branch -M main
git push -u origin main
```

---

## ステップ3：Vercelでデプロイ

1. https://vercel.com にアクセス
2. 「**Sign Up**」→「**Continue with GitHub**」で GitHub 連携
3. ログイン後、「**Add New...**」→「**Project**」
4. `resume-builder` を選んで「**Import**」
5. 設定はそのまま「**Deploy**」

数分待つとビルドが完了し、URL（`https://resume-builder-xxxxx.vercel.app`）が発行されます。

---

## ステップ4：環境変数を設定する

この時点でデプロイされたURLにアクセスしても、まだ「AI整形」も「PDF生成」も動きません。環境変数を設定します。

1. Vercel のダッシュボードで `resume-builder` プロジェクトを開く
2. **Settings** → **Environment Variables**
3. 以下の **3つ** を登録：

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...`（Anthropic APIキー） |
| `GAS_WEBHOOK_URL` | ステップ1-6 でコピーした GAS ウェブアプリのURL |
| `GAS_WEBHOOK_SECRET` | ステップ1-4 で決めた秘密トークン（GASと同じ値） |

4. それぞれ「**Save**」
5. 上部タブの「**Deployments**」→ 最新のデプロイの「**...**」メニュー →「**Redeploy**」

---

## ステップ5：動作確認

1. Vercelが発行したURLにアクセス
2. ステップ①〜⑤にサンプルデータを入力
3. 各ステップで「✨ AIで整える」が動くことを確認
4. ステップ⑥のプレビューで「📄 PDFを生成してGoogle Driveに保存」をクリック
5. 数秒後に「✅ PDF生成・Google Drive保存が完了しました」と表示されればOK
6. 「→ Google Driveで開く」リンクで生成されたPDFを確認

---

## 完了！🎉

このURLを誰にでも共有できます。PDFは**テキスト検索・コピー可能な形式**で、Google Driveの指定フォルダに自動保存されます。

---

## トラブルシューティング

### Q: 「GAS からの応答を解析できませんでした」と出る
A: GASのウェブアプリの「アクセスできるユーザー」が「全員」になっているか確認してください。「自分のみ」だとVercelからはアクセスできません。

### Q: 「認証に失敗しました」と出る
A: `WEBHOOK_SECRET`（GAS側）と `GAS_WEBHOOK_SECRET`（Vercel側）が**完全に同じ文字列**になっているか確認してください。

### Q: PDFの見た目がプレビューと違う
A: Googleドキュメントの制約でCSSスタイルは完全には再現できません。`gas/TEMPLATE_DESIGN.md` を参考にテンプレートを調整し、`testGenerate` で繰り返し確認してください。

### Q: PDFは生成されるけどスプレッドシートに行が追加されない
A: 以下を順番に確認してください：
1. GASのスクリプトプロパティに `SPREADSHEET_ID` と `SHEET_NAME` が設定されているか
2. `SHEET_NAME` とスプレッドシート内のシート名（タブ名）が一致しているか
3. GASを実行しているGoogleアカウントがそのスプレッドシートに**編集権限**を持っているか
4. GASエディタから `setupSheetHeaders` を実行して、シートに列ヘッダーが作られるか

### Q: スプレッドシートから CSV を HubSpot に取り込めない
A: `gas/SHEET_AND_HUBSPOT.md` のステップ2で、HubSpot側にカスタムプロパティを事前作成できているか確認してください。列名の**内部名（Internal name）**が完全一致している必要があります。

### Q: GASのコードを更新したい
A: GASエディタでコードを編集した後、**「デプロイ」→「デプロイを管理」→該当デプロイの鉛筆アイコン→バージョンを「新しいバージョン」に変更→デプロイ**をすると反映されます。URLは変わりません。

### Q: Anthropic APIの費用は？
A: 「AIで整える」1回あたり 0.1〜0.5円程度の従量課金です。GAS・Vercelは無料枠で運用可能です。

---

## コスト・制限まとめ

| 項目 | 費用 | 制限 |
|---|---|---|
| Vercel Hobby | 無料 | 月 100GB 転送、100,000 関数実行 |
| Google Apps Script | 無料 | 1日 90分実行、1日 250回PDF変換 |
| Google Drive | 無料 | 15GB（個人アカウント） |
| Google スプレッドシート | 無料 | 1シート 1,000万セルまで（実務上無制限） |
| HubSpot CRM | 無料プランでもCSVインポート可 | 無料プランでコンタクト100万件まで |
| Anthropic API | 従量課金 | 1整形 0.1〜0.5円程度 |

実務利用（月数百人分）でも月数百〜数千円の範囲に収まる想定です。
