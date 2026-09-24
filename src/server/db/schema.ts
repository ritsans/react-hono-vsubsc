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

// pgTable: PostgreSQL のテーブルを定義する関数
// pgEnum: PostgreSQL の列挙型を定義する関数

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

// ログイン中のセッション。Cookie に入るトークンとこの行を突き合わせて本人確認する。
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

// ログイン手段ごとの資格情報。メール＋パスワード方式では password 列にハッシュが入る。
// ソーシャルログインは使わないが、Better Auth が列の存在を前提にするので省略しない。
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

// メール確認やパスワードリセット用のワンタイムトークン置き場。
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// 通貨 (JPY, USD) の列挙型
export const currencyEnum = pgEnum("currency", ["JPY", "USD", "EUR"]);
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
