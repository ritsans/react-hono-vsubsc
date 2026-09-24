import { Hono } from "hono";
import { createAuth } from "./auth/create-auth";
import { createDb } from "./db/client";
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  type SubscriptionInput,
  updateSubscription,
} from "./db/subscriptions";

const app = new Hono<{ Bindings: Env }>();
// Bindings: Env は Hono の型パラメータで、c.env の型を決めるものです。

// ---- 認証 (Better Auth) ----
// サインアップ・サインイン・サインアウト・セッション取得は
// すべて /api/auth/* 配下Better Authに丸投げして処理します。ここではすべてを書きません。
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const auth = createAuth(db, c.env);
  return auth.handler(c.req.raw);
});

// ---- サブスク CRUD（ログイン必須） ----
// 小さいHonoサブアプリを作り、メインアプリに合体させる」ExpressのRouterに近い役割。
// 保護外のルートで c.get("userId") を書くと型エラーになる。
const subscriptionsApp = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// このサブアプリの全ルートはまずこのインスタンスを通る。
// Cookie のセッションが無効なら 401 で止め、有効なら userId を後続に渡す。
subscriptionsApp.use("*", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  const auth = createAuth(db, c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

subscriptionsApp.get("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const rows = await listSubscriptions(db, c.get("userId"));
  return c.json(rows);
});

subscriptionsApp.post("/", async (c) => {
  const input = parseSubscriptionInput(await c.req.json());
  if (!input) return c.json({ error: "invalid input" }, 400);

  const db = createDb(c.env.DATABASE_URL);
  const row = await createSubscription(db, c.get("userId"), input);
  return c.json(row, 201);
});

subscriptionsApp.put("/:id", async (c) => {
  const input = parseSubscriptionInput(await c.req.json());
  if (!input) return c.json({ error: "invalid input" }, 400);

  const db = createDb(c.env.DATABASE_URL);
  const row = await updateSubscription(db, c.get("userId"), c.req.param("id"), input);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

subscriptionsApp.delete("/:id", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const row = await deleteSubscription(db, c.get("userId"), c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

// ---  subscriptionsインスタンスここまで。ここから通常のappインスタンスが続きます ---
app.route("/api/subscriptions", subscriptionsApp);

export default app;

// リクエストボディをバリデーションチェックして、通ったときだけ SubscriptionInput を返す。 型と制約はここが正。引っかかるとnullを返します。
// JSONオブジェクトか？nameが文字列かつ空白のみか？など、リクエストボディ内容を上から下に１つづつチェックしています
function parseSubscriptionInput(body: unknown): SubscriptionInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim() === "") return null;
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount < 0) return null;
  if (b.currency !== "JPY" && b.currency !== "USD") return null;
  if (b.billingCycle !== "monthly" && b.billingCycle !== "yearly") return null;
  if (typeof b.nextBillingDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.nextBillingDate)) {
    return null;
  }
  if (b.url !== undefined && b.url !== null && typeof b.url !== "string") return null;
  if (b.note !== undefined && b.note !== null && typeof b.note !== "string") return null;

  return {
    name: b.name.trim(),
    amount: b.amount,
    currency: b.currency,
    billingCycle: b.billingCycle,
    nextBillingDate: b.nextBillingDate,
    url: b.url ? b.url : null,
    note: b.note ? b.note : null,
  };
}
