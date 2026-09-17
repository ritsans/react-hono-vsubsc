# サブスク登録CRUD（userIdをコードで強制する）

作成日: 2026-09-17 / 状態: 未着手（設計のみ、スキーマは適用済み）

**2026-09-17 追記:** テーブル名を `services` → `subscription` に変更（`.claude/plans/db-drizzle-users-subscriptions-stateful-sphinx.md` で決定・適用済み）。列も `name` だけでなく `amount` / `currency` / `billingCycle` / `nextBillingDate` / `url` / `note` を持つ。以下のコード例は `services` 表記のまま残しているが、実装時は `subscription` と実際の列構成（`src/server/db/schema.ts` を正とする）に置き換えること。

## Context

このアプリのメイン機能は「認証したユーザーが自分のサブスクサービス名を登録する」こと。
ただし認証（Better Auth）の組み込みは後回しにし、**先に開発用ユーザー1人でCRUDを固める**方針を採る。

その際のリスクは「認証を後から入れるときに `userId` での絞り込みを全クエリに後付けすることになり、1か所でも漏らすと他人のデータが見える」こと。`docs/overview.md` の「データ分離とセキュリティ」に直接反する。

そこで **「データの追加・取得・更新・削除は必ず userId を通る」を文章の仕様書ではなくコードで表現する**。`subscription` テーブルに触れるモジュールを1つに限定し、そこから公開する全関数の引数に `userId` を必須にする。渡し忘れは `tsc -b` が型エラーで落とす。

## 前提の訂正（解消済み・記録として残す）

以下はプラン作成当初のズレで、`.claude/plans/db-drizzle-users-subscriptions-stateful-sphinx.md` の実装で**すべて解消済み**。

- ~~`docs/progress.md:13,17` は `GET /api/db-version` を実装・動作確認済みと書いているが、コードは存在しない~~ → `docs/progress.md` は訂正済み。
- ~~`CLAUDE.md:111` は「データベース・ドライバ共に未導入」と書いているが、実際は導入済み~~ → `CLAUDE.md` はスキーマ・初回マイグレーション導入済みの状態に更新済み。
- ~~`drizzle.config.ts` は `schema: "./src/server/db/schema.ts"` を指すが `src/server/db/` 自体が無い~~ → `schema.ts` は作成済み（`user` / `subscription`）。
- ~~`drizzle.config.ts` は `.dev.vars` を読み込む仕組みが無い~~ → `process.loadEnvFile(".dev.vars")` を追加済み。

## 設計の核

```
リクエスト
  ↓
requireUserId ミドルウェア   … c.env.DEV_USER_ID が無ければ401（フェイルクローズ）
  ↓                           後で auth.api.getSession() に置き換わる唯一の場所
ハンドラ                      … c.get("userId") を取り出して窓口に渡す
  ↓
src/server/db/subscriptions.ts … subscription テーブルに触れる唯一のモジュール
                               全関数が userId を必須引数に取り、全WHEREに userId が入る
  ↓
Neon
```

3つの層で守る:

1. **DB層**: `subscription.user_id` は `NOT NULL` + `user.id` への外部キー（`onDelete: cascade`）。所有者なしの行は物理的に作れない。実装済み（`src/server/db/schema.ts`）。
2. **型層**: `subscription` テーブルを import するのは `db/subscriptions.ts` だけ。公開関数は `userId: string` を必須引数に取るので、**呼び出し側が userId を省略すると `tsc -b` が落ちる**。
3. **ルーティング層**: 保護対象を Hono のサブアプリにまとめ、サブアプリに1回だけ `.use("*", ...)` をかける。後からルートを足す人がミドルウェアの存在を知らなくても必ず通る。

**この仕組みの限界を正直に書いておく**: `schema.ts` の `subscription` は drizzle-kit のために export せざるを得ないので、他のファイルが直接 import して userId 無しのクエリを書くこと自体は型では防げない。防げるのは「窓口の関数を呼ぶときに userId を省略すること」。そのため**レビュー時のチェックを1行決めておく**:

```sh
grep -rn "db/schema" src/server --include=*.ts   # subscriptions.ts 以外が出たら赤信号
```

## 実装手順

### Step 1: 設定の修正とスキーマ（済み）

`drizzle.config.ts` の `process.loadEnvFile`、`biome.json` の `!drizzle`、`src/server/db/schema.ts`（`user` / `subscription`、`.claude/plans/db-drizzle-users-subscriptions-stateful-sphinx.md` の実際の列構成）、初回マイグレーション適用まで完了済み。以下は当時の設計メモとして残す（コード例は `services` 表記のまま。実装時は `subscription` に読み替える）。

**`drizzle.config.ts`（編集）** — 先頭に1行足す。依存の追加は不要（Node 24.12 の標準API）:

```ts
process.loadEnvFile(".dev.vars");
```

これで `db:generate` / `db:migrate` / `db:studio` の3つが揃って動くようになる（3つとも同じconfigを読むため）。

**`biome.json`（編集）** — `files.includes` に `"!drizzle"` を追加。生成されるマイグレーションのJSONスナップショットを `pnpm format` が書き換えないようにする（`worker-configuration.d.ts` を除外しているのと同じ理由）。

**`src/server/db/schema.ts`（新規）**:

```ts
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Better Auth 導入後は同ライブラリが管理するテーブル。
// 今は services の外部キー先として最小構成を手書きしておく。
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

`user.id` を `text` にするのは Better Auth の既定の型に合わせるため。ここを `uuid` にすると後で外部キーが繋がらない。
`src/server/` 配下なので `tsconfig.worker.json` に既に含まれる（tsconfigの変更は不要）。

検証: `pnpm db:generate` → `drizzle/0000_*.sql` が生成される → `pnpm db:migrate` → `pnpm db:studio` で2テーブルを目視。
`drizzle/` は `.gitignore` に入っていないのでコミットされる（マイグレーション履歴は残すべきなのでこのままでよい）。
`db:migrate` がドライバ検出で失敗した場合は**そこで止めて原因を確認する**。`pg` を devDependency に足して回避するのは CLAUDE.md の方針に反するのでやらない。

### Step 2: 開発用ユーザーと DEV_USER_ID

1. `.dev.vars` に `DEV_USER_ID="dev-user-0001"` を追加（gitignore済み。**本番には `wrangler secret put` しない**）。
2. `pnpm cf-typegen` で `Env` に `DEV_USER_ID` を生やす。
3. `pnpm db:studio` で `user` テーブルに1行入れる（SQLで入れる場合）:

```sql
INSERT INTO "user" (id, name, email, email_verified)
VALUES ('dev-user-0001', 'Dev User', 'dev@example.test', false);
```

**`.dev.vars` の値とこの `id` は完全一致させること。** 外部キーがあるので不一致だと最初のPOSTが500になる。

注意: `cf-typegen` は `.dev.vars` のキーを `Env` に含めるので `DEV_USER_ID` は型上 `string` になるが、**本番には存在しない**。つまり型が嘘をつくので、ミドルウェアの falsy チェックが実質的な防御になる。副作用として**この状態で本番デプロイすると `/api/services` は全て401になる**。これは意図した fail-closed であり、**認証を入れるまでデプロイしない**前提とする。

### Step 3: 接続と、単一の窓口

**`src/server/db/client.ts`（新規）** — 4つのハンドラから同じ2行を書くことになるのでここだけまとめる:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

export function createDb(databaseUrl: string) {
  return drizzle({ client: neon(databaseUrl) });
}

export type Db = ReturnType<typeof createDb>;
```

**`src/server/db/services.ts`（新規）** — `services` テーブルを import してよい唯一のファイル:

```ts
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "./client";
import { services } from "./schema";

// このファイルが services テーブルへの唯一の入口。
// 全関数が userId を必須引数に取ることで、所有者を指定しない読み書きを型で防いでいる。

export async function listServices(db: Db, userId: string) {
  return db
    .select()
    .from(services)
    .where(eq(services.userId, userId))
    .orderBy(desc(services.createdAt));
}

export async function createService(db: Db, userId: string, name: string) {
  const [row] = await db.insert(services).values({ userId, name }).returning();
  return row;
}

export async function renameService(db: Db, userId: string, id: string, name: string) {
  const [row] = await db
    .update(services)
    .set({ name })
    .where(and(eq(services.id, id), eq(services.userId, userId)))
    .returning();
  return row; // 他人の行・存在しない行なら undefined
}

export async function deleteService(db: Db, userId: string, id: string) {
  const [row] = await db
    .delete(services)
    .where(and(eq(services.id, id), eq(services.userId, userId)))
    .returning();
  return row; // 同上
}
```

更新・削除で `.returning()` を使うのは、**「他人の行を指定した」と「存在しないIDを指定した」を同じ404に倒す**ため。片方を403にすると、他人の行が存在することを教えてしまう。

### Step 4: ミドルウェアとルーティング（`src/server/index.ts`）

```ts
import { Hono } from "hono";
import { createDb } from "./db/client";
import { createService, deleteService, listServices, renameService } from "./db/services";

const app = new Hono<{ Bindings: Env }>();

// Variables を付けるのはこのサブアプリだけ。
// 保護外のルートで c.get("userId") を書くと型エラーになる。
const servicesApp = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

servicesApp.use("*", async (c, next) => {
  // 本番に DEV_USER_ID は存在しない。型は string だが実体は undefined なので必ず落とす。
  const userId = c.env.DEV_USER_ID;
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", userId);
  await next();
});

servicesApp.get("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await listServices(db, c.get("userId"));
  return c.json(rows);
});

servicesApp.post("/", async (c) => {
  const body = await c.req.json<{ name?: string }>();
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return c.json({ error: "name is required" }, 400);
  }
  const db = createDb(c.env.DATABASE_URL);
  const row = await createService(db, c.get("userId"), body.name.trim());
  return c.json(row, 201);
});

// PATCH "/:id" と DELETE "/:id" も同じ形。戻り値が undefined なら 404 を返す。

app.route("/api/services", servicesApp);

export default app;
```

- 親アプリは `{ Bindings: Env }` のまま。`app.route()` は親と型の違うサブアプリを受け取れる。
- Drizzleクライアントを各ハンドラで作るのは、`c.env` がリクエスト内でしか取れないため（モジュール先頭では作れない）。neon-http は接続確立を伴わないのでコストにならない。
- 入力チェックは上の4行で足りるので zod は入れない。

### Step 5: 実行可能な仕様としてのテスト（`src/server/index.test.ts` に追記）

```ts
it("DEV_USER_ID が無い環境では 401 を返す", async () => {
  const res = await app.request("/api/services", {}, {});

  expect(res.status).toBe(401);
});
```

**第3引数の `{}` は省略できない。** 省略すると `c.env` が undefined になり、401ではなくTypeErrorで500になる（実測確認済み）。
DBに触れる前に短絡するのでNode環境のvitestで動く。
「ユーザーAからユーザーBのデータが見えない」テストは実DBが必要で、現状のvitest構成（`@cloudflare/vitest-pool-workers` が vitest 5 と peer 衝突）では**書けない**。そこは型と単一窓口で担保する、というのが本プランの立場。

### Step 6: フロントエンド（`src/client/App.tsx` と `src/client/App.test.tsx`）

`App.tsx` に登録フォーム（input1つ＋送信ボタン）、一覧表示、削除ボタンを実装。`fetch("/api/services")` を直接呼び、状態は `useState` のみ。ルータもクライアント用ライブラリも入れない。

**`App.test.tsx` は今 `<h1>` の「Reactアプリが起動しました」を検証しているので必ず壊れる。** 同じStepで更新する:
- `global.fetch` を `vi.fn()` でスタブし、空配列を返させる（jsdomには実体のfetch先が無く、相対URLのままだと例外になる）
- アサーションを「フォームが表示される」「入力して送信すると POST /api/services が呼ばれる」に差し替える

### Step 7: ドキュメントの訂正

`docs/progress.md` の「現在地」から実在しない `/api/db-version` の記述を削り、今回の到達点に書き換える。`CLAUDE.md:111` の「未導入」を実態に合わせる。

## Better Auth を入れるときに変わる場所

**薄い部分（窓口とハンドラは無変更）**:
ミドルウェアの2行が `const session = await auth.api.getSession({ headers: c.req.raw.headers })` と `c.set("userId", session.user.id)` に置き換わるだけ。401分岐も `db/services.ts` も各ハンドラも**一切変わらない**。`.dev.vars` から `DEV_USER_ID` を削除して `cf-typegen` を再実行。

**追加になる部分**:
1. `better-auth` をインストールし、**`c.env` を受け取る関数**として auth インスタンスを作る（Workersに `process.env` は無いので、公式サンプルのモジュール先頭での生成は使えない）
2. 親アプリに `app.on(["POST", "GET"], "/api/auth/*", ...)` を追加（`run_worker_first: ["/api/*"]` の内側なのでwrangler設定の変更は不要）
3. Better Auth CLI で `session` / `account` / `verification` を生成し、手書きの `user` テーブルを生成物に差し替え → 差分マイグレーションを1本追加
4. `BETTER_AUTH_SECRET` を `.dev.vars` と `wrangler secret put` に追加
5. クライアントにログイン画面を追加

## 検証

- `pnpm db:generate` → `pnpm db:migrate` が通り、`pnpm db:studio` で `user` / `services` が見えること
- `pnpm dev` で `curl -X POST localhost:5173/api/services -H 'content-type: application/json' -d '{"name":"Netflix"}'` が201、`GET /api/services` で自分の行が返ること
- `.dev.vars` から `DEV_USER_ID` を一時的に外すと全エンドポイントが401になること（フェイルクローズの確認）
- `grep -rn "db/schema" src/server --include=*.ts` の結果が `db/services.ts` だけであること（単一窓口の確認）
- `pnpm test` が通ること（401テストと更新後のクライアントテストを含む）
- `/verify`（Biome → `tsc -b` → vite build → wrangler dry-run）が通ること
- ブラウザでフォームからサービス名を追加・削除できること
