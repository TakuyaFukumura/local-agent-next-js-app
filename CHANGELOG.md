# Changelog

このプロジェクトのすべての変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に従っています。

## [Unreleased]

### 修正

- `Header` コンポーネントでテーマアイコン・ラベルの SSR/クライアント間のハイドレーションミスマッチを解消 ([#10](https://github.com/TakuyaFukumura/local-agent-next-js-app/issues/10))
- `next.config.ts` に `serverExternalPackages` を追加し、`@earendil-works/pi-ai` および `@earendil-works/pi-agent-core` をバンドル対象外にすることで非同期エラー（`Cannot find module as expression is too dynamic`）を解消 ([#12](https://github.com/TakuyaFukumura/local-agent-next-js-app/issues/12))
  - `mounted` ステートを導入し、クライアントマウント後のみテーマ依存の UI を描画するよう変更

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
