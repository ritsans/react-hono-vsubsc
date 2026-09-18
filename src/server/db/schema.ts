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
// ただし image（プロフィール画像URL）は使わないため意図的に省略している。
// CLI 生成時に image 列の ADD が出た場合は、そのマイグレーションから当該行を消してから適用する。

// pgTable: PostgreSQL のテーブルを定義する関数
// pgEnum: PostgreSQL の列挙型を定義する関数

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// 通貨 (JPY, USD) の列挙型
export const currencyEnum = pgEnum("currency", ["JPY", "USD"]);
// 課金サイクル (月額 or 年額)
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
