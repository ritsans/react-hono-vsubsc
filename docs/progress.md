# 進捗メモ

更新日：2026-09-17
目的：セッションを終えても次回すぐ再開できるように、現在地と次にやることを記録する。

## この文書の使い方

- セッション開始時にまずこれを読み、現在地と次のタスクを確認する。
- 区切りのよいタイミング（機能単位の実装完了、方針決定など）で更新する。

## 現在地

`src/server/db/schema.ts` に `user` / `subscription` テーブルを定義し、初回マイグレーションをNeonに適用済み。認証はメールアドレス＋パスワード（Better Auth）に決定。`src/server/index.ts` は4行のみでルートは1つもなく、DB接続コード・APIエンドポイント・認証・サブスク管理画面はすべて未着手。

## 直近の作業ログ

- 2026-09-17: `src/server/db/schema.ts` に `user` / `subscription` を定義し、`pnpm db:generate` / `pnpm db:migrate` でNeonに適用。認証方式をメールアドレス＋パスワードに決定し `docs/overview.md` に反映。
- 2026-09-17: Neon + Drizzleの依存関係と `drizzle.config.ts` を追加（`580d2c1`）。`src/server` 配下のコードは変更なし。
- 2026-09-17: 現行コードを確認し、最初のゴール・実装順序・完了条件を記録。機能実装は未着手。
- 2026-09-16: `docs/overview.md`（アプリ概要）を作成。
- 2026-09-16: `CLAUDE.md` にコーディング方針・docs 運用ルールを追記。

## 次にやること

`.claude/plans/services-crud-userid.md`（`subscription` に読み替え済み）に沿って、DB接続コード・開発用ユーザーでのCRUD API・フロントの登録フォームを実装する。その後Better Authを導入し、`DEV_USER_ID` ミドルウェアをセッション検証に置き換える。

## 保留中の主な確認事項
