# ローカルエージェントアプリ仕様書

## 1. 概要

本ドキュメントは、ローカル LLM（Ollama）を基盤とした AI エージェントアプリケーションの仕様を定義します。
既存の Next.js アプリに AI エージェント機能を追加し、ブラウザ UI からローカル LLM とのリアルタイムな対話を実現します。

---

## 2. システム構成

```
[ブラウザ UI] (自作のフロントエンド)
       │ (WebSocket / SSE ストリーミング通信)
[Node.js バックエンド] (自作テンプレートのサーバー)
       │
   [Pi Engine] (@mariozechner/pi-agent-core)
       │ (Tool Calling & ファイル/コマンド操作)
       │ (OpenAI 互換 REST API: http://localhost:11434/v1)
[ローカル LLM] (Ollama: gemma2:2b)
```

### 2.1 各コンポーネントの役割

| コンポーネント | 技術 | 役割 |
|---|---|---|
| ブラウザ UI | Next.js (React) | ユーザーとのチャット対話インターフェース |
| Node.js バックエンド | Next.js API Routes | フロントエンドとエージェントの仲介、SSE/WebSocket 配信 |
| Pi Engine | `@mariozechner/pi-agent-core` | エージェントロジック、ツール呼び出し、LLM との通信管理 |
| ローカル LLM | Ollama (gemma2:2b) | 自然言語処理・推論（OpenAI 互換 API で提供） |

---

## 3. 必要なツール・ライブラリ

### 3.1 推論環境（ローカル LLM）

- **Ollama**
  - ダウンロード: <https://ollama.com/>
  - 使用モデル: `gemma2:2b`
  - 起動コマンド:
    ```bash
    ollama run gemma2:2b
    ```
  - API エンドポイント: `http://localhost:11434/v1`（OpenAI 互換）

### 3.2 エージェント基盤

- **`@mariozechner/pi-agent-core`**（または `@mariozechner/pi-ai`）
  - Pi Engine のコアパッケージ
  - ツール呼び出し（Tool Calling）機能を提供
  - ファイル操作・コマンド実行ツールを内包

### 3.3 アプリ基盤

- **既存の Next.js リポジトリ**（本リポジトリ）
  - フロントエンド + バックエンドを一体管理
  - 技術スタック: Next.js / React / TypeScript / Tailwind CSS / SQLite

---

## 4. 機能要件

### 4.1 チャット UI

- ユーザーがテキストメッセージを入力し、AI エージェントへ送信できること
- エージェントからの応答をリアルタイムにストリーミング表示できること（SSE または WebSocket）
- チャット履歴を画面上に時系列で表示すること
- ユーザーのメッセージとエージェントの応答を視覚的に区別して表示すること

### 4.2 エージェント機能

- ユーザーの自然言語入力をローカル LLM に渡し、回答を生成すること
- LLM が必要と判断した場合、定義されたツールを呼び出せること（Tool Calling）
- ツール実行結果を LLM にフィードバックし、最終的な回答を生成すること

### 4.3 ツール一覧（想定）

| ツール名 | 概要 |
|---|---|
| ファイル読み込み | 指定パスのファイル内容を読み取る |
| ファイル書き込み | 指定パスにテキストを書き込む |
| コマンド実行 | シェルコマンドを実行し、標準出力を返す |

### 4.4 ストリーミング通信

- バックエンドからフロントエンドへの応答配信方式として **SSE（Server-Sent Events）** を第一候補とする
- WebSocket は双方向通信が必要な場合の代替候補とする

---

## 5. 非機能要件

| 項目 | 内容 |
|---|---|
| 動作環境 | ローカルマシン（インターネット接続不要） |
| Node.js バージョン | 20.x 以上 |
| LLM モデル | gemma2:2b（Ollama 経由） |
| セキュリティ | ローカル専用のため、外部公開は対象外とする |
| レスポンス性能 | LLM の推論速度に依存するため、ストリーミング表示で体感速度を向上させる |

---

## 6. ディレクトリ構成（想定）

```
├── docs/
│   └── specification.md        # 本仕様書
├── lib/
│   ├── database.ts              # SQLite 接続
│   └── agent.ts                 # Pi Engine 初期化・エージェントロジック（新規）
├── src/
│   └── app/
│       ├── api/
│       │   ├── message/
│       │   │   └── route.ts     # 既存 API
│       │   └── chat/
│       │       └── route.ts     # チャット用 SSE エンドポイント（新規）
│       ├── components/
│       │   ├── ChatWindow.tsx   # チャット画面コンポーネント（新規）
│       │   ├── DarkModeProvider.tsx
│       │   └── Header.tsx
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── package.json
└── tsconfig.json
```

---

## 7. シーケンス図

```
ユーザー       ブラウザ UI      バックエンド (Next.js)    Pi Engine       Ollama
   │               │                    │                     │               │
   │ メッセージ入力  │                    │                     │               │
   │──────────────>│                    │                     │               │
   │               │ POST /api/chat     │                     │               │
   │               │───────────────────>│                     │               │
   │               │                    │ agent.run(message)  │               │
   │               │                    │────────────────────>│               │
   │               │                    │                     │ /v1/chat/completions
   │               │                    │                     │──────────────>│
   │               │                    │                     │<──────────────│
   │               │                    │                     │ (ツール呼び出し)│
   │               │                    │                     │ ツール実行     │
   │               │                    │                     │──────────────>│
   │               │                    │                     │<──────────────│
   │               │  SSE ストリーミング  │                     │               │
   │               │<───────────────────│                     │               │
   │ 応答表示       │                    │                     │               │
   │<──────────────│                    │                     │               │
```

---

## 8. API 仕様

### 8.1 POST /api/chat（新規）

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
data: {"type": "tool_result", "name": "readFile", "result": "ファイル内容"}
data: {"type": "done"}
```

---

## 9. セットアップ手順

1. **Ollama のインストールとモデルのダウンロード**

    ```bash
    # Ollama のインストール（公式サイト参照: https://ollama.com/）
    ollama pull gemma2:2b
    ollama run gemma2:2b
    ```

2. **依存パッケージのインストール**

    ```bash
    npm install @mariozechner/pi-agent-core
    ```

3. **アプリの起動**

    ```bash
    npm run dev
    ```

4. **動作確認**
    - ブラウザで `http://localhost:3000` を開く
    - チャット UI にメッセージを入力し、AI エージェントからの応答を確認する

---

## 10. 今後の検討事項

- 使用するツールのスコープ（セキュリティリスク軽減のための制限）
- チャット履歴の永続化（SQLite への保存）
- 複数の LLM モデルへの切り替え対応
- WebSocket 採用の是非（SSE で十分か検討）
- エラーハンドリング（Ollama 未起動時のフォールバック処理）
