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

// ---- 円換算レート（ログイン必須） ----
// サブスクの外貨（USD/EUR）を円に換算するための参考レートを返す窓口。
// 精密さは不要で「だいたいの参考値」として使うだけなので、換算自体はフロントで行い、
// ここでは Frankfurter から取得した1通貨ぶんのレートを中継するだけにする。
const exchangeRatesApp = new Hono<{ Bindings: Env }>();

exchangeRatesApp.use("*", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  const auth = createAuth(db, c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  await next();
});

exchangeRatesApp.get("/", async (c) => {
  const currency = c.req.query("currency");
  if (currency !== "USD" && currency !== "EUR") {
    return c.json({ error: "currency must be USD or EUR" }, 400);
  }

  const rate = await fetchYenRate(currency);
  if (!rate) return c.json({ error: "failed to fetch exchange rate" }, 502);

  return c.json(rate);
});

app.route("/api/exchange-rates", exchangeRatesApp);

export default app;

// Frankfurter から「1 currency が何円か」を1回のリクエストで取得する。
// 対象通貨ごとに呼び分け、必要な通貨だけを取得する（全通貨まとめての取得はしない）。
async function fetchYenRate(currency: "USD" | "EUR") {
  const url = `https://api.frankfurter.dev/v2/rates?base=${currency}&quotes=JPY`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const body = (await res.json()) as unknown;
  if (!Array.isArray(body) || body.length !== 1) return null;

  const entry = body[0] as Record<string, unknown>;
  if (typeof entry.date !== "string" || typeof entry.rate !== "number") return null;

  return { date: entry.date, currency, rate: entry.rate };
}

// ----------------------------------
//  リクエストボディの事前バリデーション
// ----------------------------------
// ボディをチェックして、通ったときだけ SubscriptionInput を返す。 型と制約はここが正。引っかかるとnullを返します。
// JSONオブジェクトか？nameが文字列かつ空白のみか？など、リクエストボディ内容を上から下に１つづつチェックしています
function parseSubscriptionInput(body: unknown): SubscriptionInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim() === "") return null;

  // DB の numeric(10,2) に保存できない金額は、DB エラーになる前に入力不正として返す。
  if (
    typeof b.amount !== "number" ||
    !Number.isFinite(b.amount) ||
    b.amount < 0 ||
    b.amount > 99999999.99 ||
    !/^\d+(\.\d{1,2})?$/.test(String(b.amount))
  )
    return null;
  if (b.currency !== "JPY" && b.currency !== "USD" && b.currency !== "EUR") return null;
  if (b.billingCycle !== "monthly" && b.billingCycle !== "yearly") return null;
  if (typeof b.nextBillingDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.nextBillingDate)) {
    return null;
  }
  // うるう年(leapYear) を含め実在する日付かチェック。
  const [year, month, day] = b.nextBillingDate.split("-").map(Number);

  //  4で割り切れる年はうるう年。ただし100で割り切れる年は除き、400で割り切れる年は再び含める
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
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
