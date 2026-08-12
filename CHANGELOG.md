# Changelog

このプロジェクトのすべての変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に従っています。

## [Unreleased]

### 変更

- ここに書く

## [0.2.0] - 2026-08-12

### 追加

- ローカル LLM（Ollama: gemma2:2b）と対話できる AI エージェント機能を実装
- `lib/agent.ts`: Pi Engine（`@mariozechner/pi-agent-core`）を使用したエージェント初期化・ロジック
- `src/app/api/chat/route.ts`: SSE ストリーミング対応のチャット API エンドポイント（POST /api/chat）
- `src/app/components/ChatWindow.tsx`: リアルタイムストリーミング表示対応のチャット UI コンポーネント
- ファイル読み込み・書き込み・コマンド実行のツール呼び出し（Tool Calling）機能
- `__tests__/src/app/components/ChatWindow.test.tsx`: ChatWindow コンポーネントのテスト

### 削除

- `docs/specification.md`: 実装完了のため削除

## [0.1.0] - 2026-08-12

### 追加

- 初期リリース
