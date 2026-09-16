# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト構成

Cloudflare Workers 上で動く React (client) + Hono (server) の単一 Worker アプリ。

- `src/client` — Frontend i.e React SPA。`dist/client` にビルドされ、Worker の `ASSETS` バインディング経由で配信
- `src/server` — Backend i.e Hono。Worker のエントリポイント (`wrangler.jsonc` の `main`)

## コーディング方針

**「効率化」「実装の速さ」よりも、非エンジニアが読んでも処理の流れを追えるシンプルさを優先する。**

- 処理は上から下への一本道に書く。
- 先回りした抽象化・汎用化をしない。1 箇所でしか使わないものをわざわざ共通化しない
- 「何をしているか」はコードで表し、コメントには「なぜそうしているか」を書く
- パフォーマンス最適化は、実測で問題が出てから行う。**推測で最適化しない**
- 迷ったらユーザーに尋ねる

## ドキュメント (`docs/`)

仕様・設計書は `docs/` に置く。常時読み込まず、**仕様判断・設計意図・ドメイン用語の確認時のみ** `ls docs/` で一覧を確認して参照する（リファクタや型修正時は不要）。

### 責務の分担 (SSOT)

- **コードが正**: データ構造・型・バリデーション・制約
  - docs に型の詳細や制約値を転記しない。食い違いはコードを正として docs を修正する。

- **docs が正**: 目的・設計意図・採用理由（「なぜ」の部分）
  - 実装と食い違う場合は、意図的な変更か実装漏れかを判断して対応する。

### セッション再開

新しいセッションの開始時、または前回の作業を引き継ぐ時は、まず `docs/progress.md` を読み、現在地と次にやることを確認する。作業が一区切りついたら（機能単位の実装完了・方針決定など）`docs/progress.md` を更新する。

## パッケージマネージャ

Use **pnpm only**. The `preview` script directly invokes `pnpm run build`, and the project uses a single lockfile: `pnpm-lock.yaml`.

Do not remove `allowBuilds` (esbuild / workerd) from `pnpm-workspace.yaml`. Removing it causes pnpm 11+ to abort installation with `ERR_PNPM_IGNORED_BUILDS`.

## 型チェックの落とし穴

`tsconfig.json` は `files: []` + project references のソリューション形式。
そのため **`tsc` 単体では 1 ファイルも型チェックせず exit 0 になる**（実測確認済み）。

- 型チェックは必ず **`tsc -b`** を使う。`tsc` 単体を新しいスクリプトに書かないこと
- `pnpm check` / `pnpm build` / `/verify` はいずれも `tsc -b` を使うので安全

project references の対応:

| tsconfig | 対象 |
|---|---|
| `tsconfig.app.json` | `src/client` |
| `tsconfig.worker.json` | `src/server` |
| `tsconfig.node.json` | `vite.config.ts` |

新しいトップレベルディレクトリを追加した場合、いずれかの `include` に入れないと型チェックの対象外になる。

## Lint / Format

**Biome** を使う（ESLint / Prettier ではない）。`biome.json` の設定に従うこと:

- インデント 2 スペース、行幅 100、ダブルクォート、末尾カンマあり (`all`)、LF
- `useHookAtTopLevel` は error、`useExhaustiveDependencies` と `noUnusedImports` は warn

`pnpm lint` / `pnpm format` は **リポジトリ全体**が対象（`biome.json` の `files.includes` が実質的な範囲を決める）。**`src` もルートの設定ファイルも一律 2 スペース**で、タブは使わない。

明示的な除外（`files.includes` の `!` エントリ）とその理由:

- `dist` / `build` / `.vite` — ビルド成果物
- `worker-configuration.d.ts` — `pnpm cf-typegen` の生成物。整形しても次回の生成で巻き戻る
- `.claude` — Claude Code が書き換えるツール管理ファイル。**`vcs.useIgnoreFile` はリポジトリの `.gitignore` / `.ignore` / `.git/info/exclude` しか読まず、ユーザのグローバル gitignore は見ない**ため、`.claude/settings.local.json` が除外されず対象に入ってしまっていた

その他の注意:

- `README.md` / `CLAUDE.md` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` は Biome が扱わない形式なので、除外指定は不要

## テスト (Vitest)

`vite.config.ts` とは**別ファイル**の `vitest.config.ts` で、`test.projects` を 2 つに分けている。

| project | environment | include |
|---|---|---|
| `server` | `node` | `src/server/**/*.test.ts` |
| `client` | `jsdom` | `src/client/**/*.test.{ts,tsx}`（`vitest.setup.ts` を setupFiles に指定） |

- **テストファイルは必ず `src/server` / `src/client` 配下に co-locate する。** ルートに `tests/` を作ると project references の `include` から外れ、**`tsc -b` が素通りして型エラーを検出しない**（Biome は通るので気づきにくい）
- ルート直下にファイルを足したら tsconfig の `include` に入れること。現状 `vitest.config.ts` → `tsconfig.node.json`、`vitest.setup.ts` → `tsconfig.app.json`。後者を外すと jest-dom のマッチャ型が効かなくなる
- `globals: true` は使わない。`describe` / `it` / `expect` は `vitest` から明示 import する
- `pnpm test` (= `vitest run`) / `pnpm test:watch`。`check` / `build` / `/verify` には含めていない
- server project は node 環境なので、`app.request()` で検証できるのは **Hono のルーティングとハンドラのみ**。`ASSETS` バインディングや `run_worker_first` / SPA フォールバックの挙動は対象外
- 実ランタイムで検証したくなっても **`@cloudflare/vitest-pool-workers` は現状使えない**（0.22.0 の peer は `vitest ^4.1.0`、本プロジェクトは vitest 5 系）。使うなら vitest のダウングレードが必要

## API ルート

`wrangler.jsonc` の `run_worker_first: ["/api/*"]` により、**Worker に到達するのは `/api/*` のみ**。それ以外のパスは静的アセット→SPA フォールバック (`not_found_handling: "single-page-application"`) に流れる。

新しい API エンドポイントは必ず `/api/` 配下に定義すること。

## Cloudflare バインディング / 環境変数

`Env` 型は `worker-configuration.d.ts` に自動生成される。**`wrangler.jsonc` の bindings / vars を変更したら `pnpm cf-typegen` を再実行**すること（しないと `Env` に型が生えない）。

Hono からは `c.env.XXX` でアクセスする。Workers には `process.env` は存在しない。

## データベース (Neon + Drizzle ORM)

※ データベース・ドライバ共に未導入（`package.json` に依存はまだない）。導入する際は以下に従うこと。

- ドライバは **`drizzle-orm/neon-http` + `@neondatabase/serverless`** を使う。HTTP 経由なので**接続プールもHyperdriveも不要**（1 リクエスト = 1 クエリ。トランザクションが必要なら `drizzle-orm/neon-serverless` の WebSocket 版に切り替える）
- **`pg` / `postgres.js` は使わない。** `nodejs_compat` があるので技術的には動くが、TCP 接続のたびにハンドシェイクのコストがかかり、Cloudflare は別途 Hyperdrive バインディングの併用を推奨しているため、この構成とは噛み合わない
- 接続文字列はローカルは `.dev.vars` の `DATABASE_URL`、本番は `wrangler secret put DATABASE_URL`
- `drizzle-kit` はビルド時ツールなので `process.env.DATABASE_URL` を読むが、**ランタイム側は `c.env.DATABASE_URL`**（混同しないこと）

## コミット規約

Conventional Commits (`feat:` / `fix:` / `chore:` / `add:` / `refactor:` など) に従う。
