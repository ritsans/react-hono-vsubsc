# 進捗メモ

更新日：2026-09-18
目的：セッションを終えても次回すぐ再開できるように、現在地と次にやることを記録する。

## この文書の使い方

- セッション開始時にまずこれを読み、現在地と次のタスクを確認する。
- 区切りのよいタイミング（機能単位の実装完了、方針決定など）で更新する。

## 現在地

Better Auth（メール＋パスワード）と `subscription` の CRUD API、最小のフロント画面まで実装済み。マイグレーションは `0005` までNeonに適用済み。サインアップ・ログインはブラウザで確認済み。サブスクの追加・削除の実動作確認はまだ。

- `src/server/db/client.ts` … Neon HTTP + Drizzle の接続生成
- `src/server/auth/create-auth.ts` … `c.env` を受けて Better Auth インスタンスを作る
- `src/server/db/subscriptions.ts` … `subscription` テーブルへの唯一の窓口（全関数が `userId` 必須）
- `src/server/index.ts` … `/api/auth/*` と、セッション必須の `/api/subscriptions` (GET/POST/PUT/DELETE)
- `src/client/App.tsx` / `AuthForm.tsx` / `SubscriptionList.tsx` / `lib/auth-client.ts`

## 直近の作業ログ

- 2026-09-18: 開発用ユーザー（`DEV_USER_ID`）の段階を飛ばし、最初から Better Auth でセッション検証する形で認証と CRUD を実装。`session` / `account` / `verification` を CLI 出力と同じ形で `schema.ts` に手書き（`0002`）。`user.image` は Better Auth のコア列で外せない（列が無いと起動時のスキーマ検証とサインアップ時の INSERT の両方で落ちる）ため、`0003` で復活 → `0004` で削除 → `0005` で再復活と迷った末、nullable のまま持つことに決定。回避策（`validateSchema: false` と `databaseHooks`）は取り除いた。開発時は `localhost` と `127.0.0.1` の両方を `trustedOrigins` に許可。ブラウザでサインアップ・ログインが通ることを確認済み。テストは server 4件（401 フェイルクローズ等）/ client 2件。`/verify` 通過。

- 2026-09-18: 認証・CRUD実装着手前の漏れチェックを実施。`user` テーブルにマイグレーション適用済みの `image` 列（Better Auth CLI出力を参考にした自動生成の名残）が残っていたが不要と判断し、`schema.ts` は元々未定義のままで、差分マイグレーション（`drizzle/0001_*.sql`）でNeon側から `DROP COLUMN image` して整合させた。`.gitignore` の `drizzle/` 除外は作業ツリー上で既に削除済みだったため、生成物はコミット対象にした。
- 2026-09-17: `src/server/db/schema.ts` に `user` / `subscription` を定義し、`pnpm db:generate` / `pnpm db:migrate` でNeonに適用。認証方式をメールアドレス＋パスワードに決定し `docs/overview.md` に反映。
- 2026-09-17: Neon + Drizzleの依存関係と `drizzle.config.ts` を追加（`580d2c1`）。`src/server` 配下のコードは変更なし。
- 2026-09-17: 現行コードを確認し、最初のゴール・実装順序・完了条件を記録。機能実装は未着手。
- 2026-09-16: `docs/overview.md`（アプリ概要）を作成。
- 2026-09-16: `CLAUDE.md` にコーディング方針・docs 運用ルールを追記。

## 次にやること

1. ブラウザからサブスク追加→削除→ログアウトを試し、動かなければ直す
2. 本番用に `wrangler secret put` で `DATABASE_URL` / `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` を登録する
3. 編集（PUT）のフロント UI、集計表示、サジェストなど `docs/overview.md` の主要機能へ進む

## 保留中の主な確認事項
