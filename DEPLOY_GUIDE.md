# 職務経歴書ビルダー デプロイ手順書

GitHub・Vercel が初めての方向けに、ゼロからデプロイするまでの手順をまとめています。

---

## 事前に必要なもの

- **パソコン**（Windows / Mac どちらでもOK）
- **メールアドレス**（GitHub・Vercel のアカウント作成用）
- **Anthropic の API キー**（AI機能に必要。https://console.anthropic.com で取得）

---

## ステップ 1：GitHub アカウントを作る

1. https://github.com にアクセス
2. 「Sign up」をクリック
3. メールアドレス、パスワード、ユーザー名を入力して登録
4. メールに届く確認コードを入力して完了

---

## ステップ 2：GitHub にプロジェクトをアップロードする

### 方法 A：GitHub の画面から直接アップロード（かんたん）

1. GitHub にログインした状態で https://github.com/new にアクセス
2. 「Repository name」に `resume-builder` と入力
3. 「Public」を選択 → 「Create repository」をクリック
4. 作成されたページで「uploading an existing file」というリンクをクリック
5. ダウンロードしたプロジェクトフォルダの **中身すべて** をドラッグ＆ドロップ
   - ⚠️ フォルダ自体ではなく、中のファイル・フォルダをすべて選択してドロップ
   - アップロードするもの：
     - `package.json`
     - `vite.config.js`
     - `vercel.json`
     - `index.html`
     - `.gitignore`
     - `src/` フォルダ（中に `main.jsx`, `ResumeBuilder.jsx`）
     - `api/` フォルダ（中に `refine.js`）
6. 「Commit changes」をクリック

> **💡 注意：** GitHub の画面アップロードではフォルダ構造が維持されない場合があります。
> その場合は下記の「方法 B」をお試しください。

### 方法 B：コマンドラインからアップロード（確実）

まず Git をインストールします：
- **Windows**: https://git-scm.com/download/win からダウンロード＆インストール
- **Mac**: ターミナルで `git --version` を実行（未インストールなら自動で案内が出ます）

ターミナル（Windowsの場合は Git Bash）を開いて、以下を順番に実行：

```bash
# 1. プロジェクトフォルダに移動（ダウンロード先に合わせて変更）
cd ~/Downloads/resume-builder

# 2. Git を初期化
git init

# 3. すべてのファイルを追加
git add .

# 4. コミット（保存）
git commit -m "初回コミット"

# 5. GitHub のリポジトリと接続（ユーザー名を自分のものに変更）
git remote add origin https://github.com/あなたのユーザー名/resume-builder.git

# 6. GitHub にアップロード
git branch -M main
git push -u origin main
```

※ GitHub のユーザー名・パスワードを聞かれたら入力してください。

---

## ステップ 3：Vercel でデプロイする

1. https://vercel.com にアクセス
2. 「Sign Up」→ 「Continue with GitHub」を選択して GitHub 連携
3. ログイン後、「Add New...」→「Project」をクリック
4. 「Import Git Repository」で `resume-builder` を選択して「Import」
5. 設定画面が出ますが、**そのまま何も変えずに**「Deploy」をクリック
6. 数分待つと自動でデプロイが完了します 🎉

---

## ステップ 4：API キーを設定する（AI機能を有効にする）

デプロイしただけでは AI 機能が動きません。API キーを設定します。

1. Vercel のダッシュボードで `resume-builder` プロジェクトを開く
2. 上部タブの「Settings」をクリック
3. 左メニューの「Environment Variables」をクリック
4. 以下を入力：
   - **Key**: `ANTHROPIC_API_KEY`
   - **Value**: あなたの Anthropic API キー（`sk-ant-...` で始まる文字列）
5. 「Save」をクリック

---

## ステップ 5：Google Drive連携を設定する（PDF保存機能）

PDFをGoogle Driveに自動保存するには、Googleのサービスアカウントが必要です。

### 5-1. Google Cloud プロジェクトを作る

1. https://console.cloud.google.com にアクセス（Googleアカウントでログイン）
2. 上部の「プロジェクトを選択」→「新しいプロジェクト」
3. プロジェクト名に `resume-builder` と入力 →「作成」

### 5-2. Google Drive API を有効にする

1. 左メニュー →「APIとサービス」→「ライブラリ」
2. 「Google Drive API」を検索してクリック
3. 「有効にする」をクリック

### 5-3. サービスアカウントを作成する

1. 左メニュー →「APIとサービス」→「認証情報」
2. 「＋ 認証情報を作成」→「サービスアカウント」
3. サービスアカウント名に `resume-uploader` と入力 →「作成して続行」
4. ロールは選択せずに「完了」をクリック
5. 作成されたサービスアカウントのメールアドレスをコピー（`resume-uploader@xxx.iam.gserviceaccount.com` のような形式）

### 5-4. JSON キーをダウンロードする

1. 作成したサービスアカウントをクリック
2. 「キー」タブ →「鍵を追加」→「新しい鍵を作成」
3. 「JSON」を選択 →「作成」
4. JSONファイルが自動ダウンロードされます（**このファイルは大切に保管してください**）

### 5-5. Google Drive フォルダにサービスアカウントを招待する

1. Google Driveで対象のフォルダを開く
2. フォルダを右クリック →「共有」
3. 5-3でコピーしたサービスアカウントのメールアドレスを入力
4. 権限を「編集者」に設定 →「送信」

### 5-6. Vercel に環境変数を追加する

1. Vercel の Settings → Environment Variables
2. 以下を追加：
   - **Key**: `GOOGLE_SERVICE_ACCOUNT_JSON`
   - **Value**: ダウンロードしたJSONファイルの**中身をまるごとコピー＆ペースト**
3. 「Save」をクリック

### 5-7. 再デプロイする

1. 上部タブの「Deployments」→ 最新のデプロイの「...」メニュー →「Redeploy」をクリック
2. 環境変数を反映させるために再デプロイが必要です

---

## ステップ 6：動作確認

1. Vercel が表示する URL（`https://resume-builder-xxxxx.vercel.app` のような形式）にアクセス
2. 各ステップを入力してみる
3. 「✨ AIで整える」ボタンが動作することを確認

---

## 完了！🎉

この URL を誰にでも共有できます。
スマートフォンからもアクセス可能です。

---

## よくある質問

### Q: API キーが漏れる心配は？
A: APIキーは Vercel のサーバー側（環境変数）にのみ保存されます。ブラウザには一切送られないので安全です。

### Q: 費用はかかる？
A: Vercel は無料プランで月 100GB の転送量があり、通常利用には十分です。Anthropic API は従量課金（使った分だけ）です。

### Q: URL を変更したい（独自ドメインにしたい）
A: Vercel の Settings → Domains から独自ドメインを設定できます。

### Q: コードを修正したい
A: GitHub のリポジトリでファイルを編集して保存すると、Vercel が自動で再デプロイしてくれます。
