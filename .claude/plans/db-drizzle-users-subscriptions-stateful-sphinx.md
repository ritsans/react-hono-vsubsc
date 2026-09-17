# DBスキーマの土台：user / subscription

作成日: 2026-09-17 / 状態: 完了（Neon に適用済み）

## Context

`docs/progress.md` の「次にやること」は「Neon と Better Auth による認証・永続化の土台を作る」。その最初の具体物が DB スキーマ。
`drizzle.config.ts` は `src/server/db/schema.ts` を参照しているが、このファイルはまだ無く、`pnpm db:generate` は今必ず失敗する。

このプランは **スキーマ定義とマイグレーション生成・適用まで** を扱う。接続コード・ミドルウェア・CRUD API は既存プラン `.claude/plans/services-crud-userid.md` の範囲で、本プランの後に続ける。

### 既存プランとの関係

- `services-crud-userid.md` の `services` テーブルは本プランの `subscription` に**置き換える**（名前変更＋列の拡張）。本プラン承認後、既存プランの `services` 記述を `subscription` に書き換え、重複する Step 1 を削る（ドキュメント編集のみ）。
- 既存プラン Step 1 の設定修正は**このブランチで済んでいる**: `drizzle.config.ts` の `process.loadEnvFile(".dev.vars")`、`biome.json` の `!drizzle`、`.dev.vars` の `DATABASE_URL`。再作業は不要。

### ユーザーと合意した方針

| 項目 | 決定 |
|---|---|
| 認証方式 | **メールアドレス＋パスワード**（Better Auth の `emailAndPassword: { enabled: true }`）。ソーシャルログインは使わない |
| 認証テーブル | `user` だけ最小構成で手書き。session/account/verification は Better Auth 導入時に CLI 生成で差し替え |
| テーブル名 | 単数形 `user` / `subscription`（Better Auth の既定に合わせ、`usePlural` 設定を不要にする） |
| subscription の任意列 | `url`（公式サイト）と `note`（メモ）を含める。`trialEndsAt` / `status` は今回入れない |
| 金額の型 | `numeric(10,2)` を `mode: "number"` で扱う |

## 設計

### `src/server/db/schema.ts`（新規・唯一のソース変更）

```ts
import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Better Auth 導入後は同ライブラリの CLI が生成するファイルに差し替える。
// そのとき差分マイグレーションに user の ALTER が出ないよう、
// CLI の出力（列名・型・timestamp のタイムゾーン無し・$onUpdate）と完全に同じ形で書いている。
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const currencyEnum = pgEnum("currency", ["JPY", "USD"]);
export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly"]);

export const subscription = pgTable(
  "subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 所有者なしの行を物理的に作れないようにする。ユーザー削除時は契約情報も消す。
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // JPY は 1500.00 のように小数部ゼロで入る。読みやすさを優先して通貨ごとの最小単位変換はしない。
    amount: numeric("amount", { precision: 10, scale: 2, mode: "number" }).notNull(),
    currency: currencyEnum("currency").notNull(),
    billingCycle: billingCycleEnum("billing_cycle").notNull(),
    // 「日付だけ」の値を JS の Date にするとタイムゾーンで前後にずれるため、"YYYY-MM-DD" の文字列で扱う。
    nextBillingDate: date("next_billing_date", { mode: "string" }).notNull(),
    url: text("url"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  // 全クエリが user_id で絞るので外部キー列に索引を張る（Better Auth も自前の userId に同じ索引を生成する）。
  (table) => [index("subscription_user_id_idx").on(table.userId)],
);
```

補足:

- メール＋パスワード認証でも `user` テーブルの形は変わらない。パスワードのハッシュは Better Auth が `account.password`（`providerId = "credential"`）に保存するため、**`user` にパスワード列は作らない**。`account` テーブルは Better Auth 導入時に CLI で生成する。
- `user.id` は `text`。Better Auth の既定と揃えるため `uuid` にしない。
- `relations()` は書かない。リレーショナルクエリ API をまだ誰も使わない。
- `src/server/` 配下なので `tsconfig.worker.json` に既に含まれる。tsconfig の変更は不要。

### マイグレーション

1. `pnpm db:generate` → `drizzle/0000_*.sql` と `drizzle/meta/` が生成される。`drizzle/` は `.gitignore` に無いので**コミットする**（履歴として残す）。
2. `pnpm db:migrate` で Neon に適用する。
3. `db:migrate` がドライバ検出で失敗したら**そこで止めて報告する**。`pg` を devDependency に足して回避するのは CLAUDE.md の方針に反するのでやらない。

### ドキュメント更新（スキーマ適用後）

- `docs/progress.md`: 「現在地」を「schema.ts と初回マイグレーション適用済み」に、作業ログに 1 行追加。
- `docs/overview.md` の「認証: Better Auth」を「Better Auth（メールアドレス＋パスワード）」に更新し、認証方式の決定を残す。
- `CLAUDE.md` DB 節の「スキーマ・接続コード・マイグレーションはまだ存在しない」を実態に合わせる。列の型や制約値は docs に転記しない（コードが正）。
- `.claude/plans/services-crud-userid.md`: `services` → `subscription`、Step 1 を「済み」に。

## 検証

- 生成された SQL に以下があること: `CREATE TYPE "public"."currency"` と `"billing_cycle"` の 2 つ、`numeric(10, 2)`、`ON DELETE cascade`、`subscription_user_id_idx`
- `pnpm db:migrate` が成功し、`pnpm db:studio` で `user` / `subscription` の 2 テーブルが見えること
- `pnpm lint` と `tsc -b`（`pnpm check` 経由）が通ること
- `pnpm test` の既存テストがそのまま通ること（`src/server/index.ts` は変更しないため）
