# 現状システム仕様書

## 1. このドキュメントの目的

このドキュメントは、`local-agent-next-js-app` の現状実装を読み解くための仕様書です。  
利用手順だけでなく、**どの責務がどこにあり、どの順番でコードを読むと理解しやすいか** を把握できることを目的にしています。

## 2. システム概要

本システムは、Next.js 上に構築されたローカル AI エージェント用のチャットアプリケーションです。

- フロントエンドは React ベースのチャット UI を提供する
- サーバーは `/api/chat` で SSE によるストリーミング応答を返す
- AI エージェントは `@earendil-works/pi-agent-core` を利用して生成される
- モデル呼び出し先は Ollama の OpenAI 互換 API（`gemma2:2b`）である
- 補助的な永続化として SQLite を利用し、メッセージ取得 API を提供する

## 3. 主要ディレクトリ構成

```text
.
├── docs/
│   └── system-specification.md
├── lib/
│   ├── agent.ts
│   └── database.ts
├── src/
│   └── app/
│       ├── api/
│       │   ├── chat/route.ts
│       │   └── message/route.ts
│       ├── components/
│       │   ├── ChatWindow.tsx
│       │   ├── DarkModeProvider.tsx
│       │   └── Header.tsx
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── __tests__/
├── next.config.ts
├── jest.config.mjs
└── package.json
```

### ディレクトリごとの責務

- `src/app/`
  - Next.js App Router ベースの画面・API エンドポイントを配置する
- `src/app/components/`
  - チャット UI、ヘッダー、ダークモード制御などのクライアントコンポーネントを配置する
- `lib/`
  - エージェント生成や SQLite 操作など、アプリの中核ロジックを配置する
- `__tests__/`
  - Jest によるユニットテスト、コンポーネントテストを配置する
- `docs/`
  - 設計理解や運用補助のためのドキュメントを配置する

## 4. 画面構成

### 4.1 ルートページ

- `src/app/page.tsx`
  - 画面本体として `ChatWindow` を表示するだけの薄い構成

### 4.2 共通レイアウト

- `src/app/layout.tsx`
  - `DarkModeProvider` で全体をラップする
  - `Header` を全ページ共通で表示する
  - `metadata` を定義する

### 4.3 ヘッダー

- `src/app/components/Header.tsx`
  - アプリ名の表示
  - ライト / ダークモード切替ボタンの表示
  - 実際のテーマ状態は `DarkModeProvider` から受け取る

### 4.4 ダークモード

- `src/app/components/DarkModeProvider.tsx`
  - `localStorage` から保存済みテーマを読み込む
  - `document.documentElement` に `dark` クラスを付与・削除する
  - `useDarkMode()` を通じて子コンポーネントへテーマ状態を提供する

### 4.5 チャット UI

- `src/app/components/ChatWindow.tsx`
  - ユーザー入力の送信
  - メッセージ一覧の表示
  - SSE の受信処理
  - ツール呼び出し情報の表示
  - ストリーミング中の状態管理

## 5. API と実行フロー

### 5.1 チャット API

- エンドポイント: `POST /api/chat`
- 実装: `src/app/api/chat/route.ts`

#### 受信する入力

```json
{
  "message": "ユーザー入力"
}
```

#### 主な処理

1. JSON ボディを読み込む
2. `message` が空でないことを検証する
3. 本番環境では `CHAT_API_TOKEN` を `Authorization` ヘッダーと照合する
4. `createAgent()` でエージェントを生成する
5. エージェントイベントを購読し、SSE イベントへ変換する
6. `agent.prompt(userMessage)` を実行する
7. 最後に `done` イベントを送ってストリームを閉じる

#### SSE で返すイベント

- `text`
  - アシスタントのテキスト差分
- `tool_call`
  - ツール実行開始通知
- `tool_result`
  - ツール実行結果
- `error`
  - エージェント実行中エラー
- `done`
  - ストリーム終了

#### クライアント側の受信処理

`ChatWindow.tsx` では `fetch('/api/chat')` のレスポンスボディを読み取り、`data: ...` 形式の各行を JSON として解釈し、以下のように UI 状態へ反映する。

- `text`: アシスタントメッセージ末尾へ追記
- `tool_call`: 当該メッセージの `toolCalls` に追加
- `error`: 応答文の代わりにエラーメッセージを表示
- `done`: ストリーミング終了

### 5.2 メッセージ取得 API

- エンドポイント: `GET /api/message`
- 実装: `src/app/api/message/route.ts`

#### 主な処理

1. `lib/database.ts` の `getMessage()` を呼ぶ
2. 最新メッセージを JSON で返す
3. 例外発生時は `500` を返す

この API はチャット本体のストリーミング処理とは独立した、SQLite 読み出しのシンプルな入口です。

## 6. エージェント層の仕様

- 実装: `lib/agent.ts`

### 6.1 モデル設定

- モデル ID: `gemma2:2b`
- 接続先: `http://localhost:11434/v1`
- API 形式: OpenAI 互換 completions API
- システムプロンプト: 日本語で回答する汎用アシスタント

### 6.2 提供しているツール

#### `readFile`

- 指定ファイルを UTF-8 で読み取る
- `AGENT_WORKSPACE_ROOT` 配下のみ許可する

#### `writeFile`

- 指定ファイルへ UTF-8 で書き込む
- `AGENT_WORKSPACE_ROOT` 配下のみ許可する

#### `runCommand`

- シェルコマンドを実行する
- `AGENT_ENABLE_COMMANDS=true` の場合のみ有効
- `AGENT_ALLOWED_COMMANDS` に含まれるコマンド名のみ実行可能
- `execFile` を用い、タイムアウトは 30 秒

### 6.3 パス制御

`resolveWorkspacePath()` により、ツール経由で参照するファイルパスが作業ディレクトリ外へ出ないよう制限している。  
そのため、エージェントのファイル操作はプロジェクト全域に無制限でアクセスする設計ではない。

## 7. データ永続化

- 実装: `lib/database.ts`
- DB ファイル: `data/app.db`
- ライブラリ: `better-sqlite3`

### 初期化仕様

- `data/` ディレクトリが無ければ自動作成する
- 初回アクセス時に SQLite 接続を作成する
- `messages` テーブルが無ければ作成する
- データが 0 件なら `Hello, world.` を初期値として投入する

### `messages` テーブル

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `content` | TEXT | メッセージ本文 |
| `created_at` | DATETIME | 作成日時 |

### 提供関数

- `getDatabase()`
  - 接続生成と初期化を担当する
- `getMessage()`
  - `created_at` 降順で 1 件取得し、本文を返す

## 8. 環境変数

| 変数名 | 用途 |
| --- | --- |
| `CHAT_API_TOKEN` | 本番環境で `/api/chat` のトークン照合に使う |
| `AGENT_WORKSPACE_ROOT` | `readFile` / `writeFile` / `runCommand` の作業ルート |
| `AGENT_ENABLE_COMMANDS` | `runCommand` 有効化フラグ |
| `AGENT_ALLOWED_COMMANDS` | 実行を許可するコマンド名一覧（カンマ区切り） |

## 9. 開発時の確認手段

`package.json` では以下のスクリプトが定義されている。

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm start` | 本番サーバー起動 |
| `npm run lint` | ESLint 実行 |
| `npm test` | Jest 実行 |
| `npm run test:watch` | Jest watch |
| `npm run test:coverage` | カバレッジ付きテスト |

Jest 設定は `jest.config.mjs` にあり、主に `src/` と `lib/` 配下を対象としている。

## 10. コードリーディングの推奨順

設計理解の入口として、以下の順に読むと全体像を掴みやすい。

1. `src/app/page.tsx`
   - 画面の入口が `ChatWindow` であることを確認する
2. `src/app/components/ChatWindow.tsx`
   - UI 状態管理と SSE 受信の流れを把握する
3. `src/app/api/chat/route.ts`
   - クライアント送信がどのようにサーバー処理へつながるか把握する
4. `lib/agent.ts`
   - エージェント生成、Ollama 接続、ツール制約を理解する
5. `lib/database.ts`
   - SQLite 初期化とメッセージ取得の仕組みを確認する
6. `src/app/components/DarkModeProvider.tsx` / `Header.tsx`
   - UI 共通機能の実装方針を確認する

## 11. 現状設計の特徴

- チャット体験の中心は SSE ストリーミングであり、逐次的に UI を更新する構造になっている
- AI エージェントのツール実行結果をフロントへ可視化するため、UI 側に `toolCalls` の表示欄を持っている
- エージェント機能はローカル LLM 前提で、外部クラウド API を必須としない
- ファイル操作・コマンド実行には明示的な制限があり、安全側の設計が意識されている
- SQLite 利用部分は限定的で、現状はシンプルなメッセージ取得用途に留まっている

## 12. 参考にすべき重要ファイル

- `/home/runner/work/local-agent-next-js-app/local-agent-next-js-app/src/app/components/ChatWindow.tsx`
- `/home/runner/work/local-agent-next-js-app/local-agent-next-js-app/src/app/api/chat/route.ts`
- `/home/runner/work/local-agent-next-js-app/local-agent-next-js-app/lib/agent.ts`
- `/home/runner/work/local-agent-next-js-app/local-agent-next-js-app/lib/database.ts`
- `/home/runner/work/local-agent-next-js-app/local-agent-next-js-app/src/app/components/DarkModeProvider.tsx`
- `/home/runner/work/local-agent-next-js-app/local-agent-next-js-app/src/app/components/Header.tsx`
