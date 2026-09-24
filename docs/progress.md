# 進捗メモ

更新日：2026-09-24
目的：セッションを終えても次回すぐ再開できるように、現在地と次にやることを記録する。

## この文書の使い方

- セッション開始時にまずこれを読み、現在地と次のタスクを確認する。
- 区切りのよいタイミング（機能単位の実装完了、方針決定など）で更新する。

## 現在地

Better Auth（メール＋パスワード）と `subscription` の CRUD API、最小のフロント画面まで実装済み。マイグレーションは `0005` までNeonに適用済み。**Cloudflare Workers への初回デプロイ済み**（`https://react-hono-vsubsc.dazzling3season.workers.dev`）。本番で認証（サインアップ・セッション確認）とサブスクの追加/一覧/削除まで curl で実動作確認済み。

- `src/server/db/client.ts` … Neon HTTP + Drizzle の接続生成
- `src/server/auth/create-auth.ts` … `c.env` を受けて Better Auth インスタンスを作る
- `src/server/db/subscriptions.ts` … `subscription` テーブルへの唯一の窓口（全関数が `userId` 必須）
- `src/server/index.ts` … `/api/auth/*` と、セッション必須の `/api/subscriptions` (GET/POST/PUT/DELETE)・`/api/exchange-rates` (GET)
- `src/client/App.tsx` / `AuthForm.tsx` / `SubscriptionList.tsx` / `lib/auth-client.ts`

円換算（`GET /api/exchange-rates`）と通貨 EUR の追加を実装済み。**ただし未コミット・未デプロイ**。設計は `.claude/plans/exchange-rates.md`。

## 直近の作業ログ

- 2026-09-24: 円換算 API `GET /api/exchange-rates?currency=USD|EUR` を実装（ログイン必須。Frankfurter v2 を通貨ごとに1回だけ呼び、`{ date, currency, rate }` を返す。失敗時は 502）。通貨に EUR を追加（`schema.ts` の `currencyEnum`、`SubscriptionInput`、`parseSubscriptionInput`、フロントの型と選択肢）し、マイグレーション `0006`（`ALTER TYPE currency ADD VALUE 'EUR'`）を生成。フロントに「円換算」ボタンを追加（登録済みサブスクに含まれる外貨だけレートを取得し、合計後に1回だけ丸める）。Frankfurter v2 のレスポンスはオブジェクトではなく**1要素の配列**であることを実測で確認し、プランの記載を修正。テストは server/client 合わせて 14件通過、`pnpm check` 通過。

- 2026-09-18: Cloudflare Workers に初回デプロイ（`wrangler deploy`）。`BETTER_AUTH_URL` / `BETTER_AUTH_SECRET` / `DATABASE_URL` を `wrangler secret put`コマンドでWorkerに登録（Secret Store への書き込みはユーザー自身が対話式コマンドを実行して登録）。本番URLに対して curl でサインアップ→セッション確認→サブスク登録→一覧→削除→（Cookie無しで再度401）まで一通り確認し、正常動作を確認。**開発用と本番用で同じ Neon データベースを共有している**ため、確認に使ったテストアカウント（`deploy-check@example.test`）は動作確認後に削除済み（`user` 行の削除で `onDelete: cascade` により `session` / `account` も連動して消える）。
- 2026-09-18: 開発用ユーザー（`DEV_USER_ID`）の段階を飛ばし、最初から Better Auth でセッション検証する形で認証と CRUD を実装。`session` / `account` / `verification` を CLI 出力と同じ形で `schema.ts` に手書き（`0002`）。`user.image` は Better Auth のコア列で外せない（列が無いと起動時のスキーマ検証とサインアップ時の INSERT の両方で落ちる）ため、`0003` で復活 → `0004` で削除 → `0005` で再復活と迷った末、nullable のまま持つことに決定。回避策（`validateSchema: false` と `databaseHooks`）は取り除いた。開発時は `localhost` と `127.0.0.1` の両方を `trustedOrigins` に許可。ブラウザでサインアップ・ログインが通ることを確認済み。テストは server 4件（401 フェイルクローズ等）/ client 2件。`/verify` 通過。
- 
## 次にやること

1. 編集（PUT）のフロント UI、サジェスト（Logo.dev）、アラート通知など `docs/overview.md` の残りの主要機能へ進む

## 保留中の主な確認事項

- 円換算の丸め方：プランの要件欄は「小数点以下切り捨て」、フロント側の節と実装は `Math.round`（四捨五入）で食い違っている。どちらに揃えるか未決定
- 円換算の合計：現状は月額と年額をそのまま足している。月額換算にそろえるなど、集計の単位をどうするか未決定
