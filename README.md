# local-agent-next-js-app

Next.js + Ollama（ローカル LLM）を使った AI エージェントアプリケーションです。
ブラウザのチャット UI からローカル LLM（gemma2:2b）とリアルタイムに対話でき、ファイル操作やコマンド実行などのツール呼び出し（Tool Calling）機能も備えています。

## 技術スタック

- **Next.js 16** - React フレームワーク（App Router を使用）
- **React 19** - ユーザーインターフェース構築
- **TypeScript** - 型安全性
- **Tailwind CSS 4** - スタイリング
- **SQLite** - データベース（better-sqlite3）
- **@mariozechner/pi-agent-core** - AI エージェント基盤（Pi Engine）
- **Ollama（gemma2:2b）** - ローカル LLM（OpenAI 互換 API）
- **ESLint** - コード品質管理

## 機能

- ローカル LLM（Ollama: gemma2:2b）と対話できる AI エージェント
- SSE（Server-Sent Events）によるリアルタイムストリーミング表示
- ファイル読み込み・書き込み・コマンド実行のツール呼び出し（Tool Calling）
- チャット履歴の時系列表示とユーザー/エージェント発言の視覚的区別
- レスポンシブデザイン対応
- ダークモード対応（手動切替機能付き）
- TypeScript による型安全性

## 始め方

### 前提条件

- Node.js 20.x 以上
- npm、yarn、または pnpm
- [Ollama](https://ollama.com/) がインストール済みであること

### Ollama のセットアップ

```bash
# モデルのダウンロードと起動
ollama pull gemma2:2b
ollama run gemma2:2b
```

### インストール

1. リポジトリをクローン：
    ```bash
    git clone https://github.com/TakuyaFukumura/local-agent-next-js-app.git
    ```
    ```bash
    cd local-agent-next-js-app
    ```

2. 依存関係をインストール：
    ```bash
    npm install
    ```
   または
    ```bash
    yarn install
    ```
   または
    ```bash
    pnpm install
    ```

### 開発サーバーの起動

```bash
npm run dev
```

または

```bash
yarn dev
```

または

```bash
pnpm dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションを確認してください。

### ビルドと本番デプロイ

本番用にアプリケーションをビルドする：

```bash
npm run build
```

```bash
npm start
```

## プロジェクト構造

```
├── lib/
│   ├── agent.ts             # Pi Engine 初期化・エージェントロジック
│   └── database.ts          # SQLiteデータベース接続・操作
├── src/
│   └── app/
│       ├── api/
│       │   ├── chat/
│       │   │   └── route.ts # チャット用 SSE エンドポイント
│       │   └── message/
│       │       └── route.ts # メッセージ API エンドポイント
│       ├── components/      # Reactコンポーネント
│       │   ├── ChatWindow.tsx        # チャット画面コンポーネント
│       │   ├── DarkModeProvider.tsx  # ダークモードProvider
│       │   └── Header.tsx   # ヘッダーコンポーネント
│       ├── globals.css      # グローバルスタイル
│       ├── layout.tsx       # アプリケーションレイアウト
│       └── page.tsx         # メインページコンポーネント
├── data/                    # SQLiteデータベースファイル（自動生成）
├── package.json
├── next.config.ts
└── tsconfig.json
```

## API エンドポイント

### POST /api/chat

AI エージェントにメッセージを送信し、SSE ストリームで応答を受け取ります。

**リクエスト:**

```json
{
  "message": "ユーザーからのメッセージ"
}
```

**レスポンス（SSE ストリーム）:**

```
data: {"type": "text", "content": "応答テキストの一部"}
data: {"type": "tool_call", "name": "readFile", "args": {"path": "..."}}
data: {"type": "tool_result", "name": "readFile", "result": "ファイル内容", "isError": false}
data: {"type": "done"}
```

### GET /api/message

データベースから最新のメッセージを取得します。

**レスポンス:**

```json
{
  "message": "Hello, world."
}
```

## 開発

### テスト

このプロジェクトはJestを使用したテストが設定されています。

#### テストの実行

```bash
npm test
```

#### テストの監視モード

```bash
npm run test:watch
```

#### カバレッジレポートの生成

```bash
npm run test:coverage
```

#### テストファイルの構成

- `__tests__/lib/database.test.ts`: データベース機能のテスト
- `__tests__/src/app/components/ChatWindow.test.tsx`: チャット UI コンポーネントのテスト
- `__tests__/src/app/components/DarkModeProvider.test.tsx`: ダークモードProvider のテスト
- `__tests__/src/app/components/Header.test.tsx`: ヘッダーコンポーネントのテスト

### リンティング

```bash
npm run lint
```

## CI/CD

このプロジェクトはGitHub Actionsを使用した継続的インテグレーション（CI）を設定しています。

### 自動テスト

以下の条件でCIが実行されます：

- `main`ブランチへのプッシュ時
- プルリクエストの作成・更新時

CIでは以下のチェックが行われます：

- ESLintによる静的解析
- TypeScriptの型チェック
- Jestを使用したユニットテストとインテグレーションテスト
- アプリケーションのビルド検証
- Node.js 20.x での動作確認

## 自動依存関係更新（Dependabot）

このプロジェクトでは、依存関係の安全性と最新化のために[Dependabot](https://docs.github.com/ja/code-security/dependabot)
を利用しています。

- GitHub Actionsおよびnpmパッケージの依存関係は**月次（月曜日 09:00 JST）**で自動チェック・更新されます。
- 更新内容は自動でプルリクエストとして作成されます。

## トラブルシューティング

### Ollama が起動していない場合

- Ollama を起動してください: `ollama run gemma2:2b`
- API エンドポイント `http://localhost:11434/v1` が利用可能かを確認してください

### データベース関連のエラー

- `data/` フォルダが存在しない場合、自動的に作成されます
- データベースファイルが破損した場合は、`data/app.db` を削除して再起動してください

### ポート競合

デフォルトのポート3000が使用中の場合：

```bash
npm run dev -- --port 3001
```

