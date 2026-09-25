import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "./auth/create-auth";
import { createSubscription } from "./db/subscriptions";
import app from "./index";

// createAuth をラップしてモック可能にする。デフォルトは本物の実装をそのまま呼ぶので、
// ログイン不要な既存のテスト（Cookie 無し→401 など）はそのまま動く。
// ログイン済みを再現したいテストだけ、この下で1回だけ差し替える。
vi.mock("./auth/create-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth/create-auth")>();
  return { ...actual, createAuth: vi.fn(actual.createAuth) };
});

vi.mock("./db/subscriptions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/subscriptions")>();
  return { ...actual, createSubscription: vi.fn(actual.createSubscription) };
});

function mockLoggedIn() {
  vi.mocked(createAuth).mockReturnValueOnce({
    api: { getSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) },
  } as unknown as ReturnType<typeof createAuth>);
}

// DB には繋がないダミー。セッション Cookie が無ければ Better Auth は DB を見る前に null を返す。
const env = {
  DATABASE_URL: "postgres://user:pass@localhost/db",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
  BETTER_AUTH_URL: "http://localhost",
};

describe("worker app", () => {
  it("returns 404 for an unregistered path", async () => {
    const res = await app.request("/api/unknown", {}, env);

    expect(res.status).toBe(404);
  });

  it("returns 401 for subscriptions without a session cookie", async () => {
    const res = await app.request("/api/subscriptions", {}, env);

    expect(res.status).toBe(401);
  });

  it("returns 401 for POST without a session cookie before reading the body", async () => {
    const res = await app.request(
      "/api/subscriptions",
      { method: "POST", body: "not json", headers: { "content-type": "text/plain" } },
      env,
    );

    expect(res.status).toBe(401);
  });

  it("serves the Better Auth handler under /api/auth", async () => {
    const res = await app.request("/api/auth/ok", {}, env);

    expect(res.status).toBe(200);
  });
});

describe("GET /api/exchange-rates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await app.request("/api/exchange-rates?currency=USD", {}, env);

    expect(res.status).toBe(401);
  });

  it("returns 400 when currency is missing", async () => {
    mockLoggedIn();
    const res = await app.request("/api/exchange-rates", {}, env);

    expect(res.status).toBe(400);
  });

  it("returns 400 for JPY (no conversion needed)", async () => {
    mockLoggedIn();
    const res = await app.request("/api/exchange-rates?currency=JPY", {}, env);

    expect(res.status).toBe(400);
  });

  it("returns 400 for an unsupported currency", async () => {
    mockLoggedIn();
    const res = await app.request("/api/exchange-rates?currency=GBP", {}, env);

    expect(res.status).toBe(400);
  });

  it("returns the rate when Frankfurter responds normally", async () => {
    mockLoggedIn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify([{ date: "2026-09-24", base: "USD", quote: "JPY", rate: 157.66 }]),
            { status: 200 },
          ),
        ),
    );

    const res = await app.request("/api/exchange-rates?currency=USD", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ date: "2026-09-24", currency: "USD", rate: 157.66 });
  });

  it("returns 502 when Frankfurter is unreachable", async () => {
    mockLoggedIn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { status: 500 })));

    const res = await app.request("/api/exchange-rates?currency=USD", {}, env);

    expect(res.status).toBe(502);
  });

  it("returns 502 when Frankfurter's response has no numeric rate", async () => {
    mockLoggedIn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ date: "2026-09-24", rate: "not a number" }]), {
          status: 200,
        }),
      ),
    );

    const res = await app.request("/api/exchange-rates?currency=USD", {}, env);

    expect(res.status).toBe(502);
  });
});

describe("POST /api/subscriptions with EUR", () => {
  afterEach(() => vi.mocked(createSubscription).mockReset());

  it("accepts EUR as a valid currency", async () => {
    mockLoggedIn();
    vi.mocked(createSubscription).mockResolvedValue({ id: "subscription-1" } as never);
    const res = await app.request(
      "/api/subscriptions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Spotify",
          amount: 9.99,
          currency: "EUR",
          billingCycle: "monthly",
          nextBillingDate: "2026-10-01",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(createSubscription).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({ currency: "EUR", amount: 9.99 }),
    );
  });

  it.each([
    ["an amount too large for numeric(10,2)", 100000000, "2026-10-01"],
    ["an amount with too many decimal places", 1.001, "2026-10-01"],
    ["an invalid February date", 1, "2026-02-31"],
    ["a non-leap February 29", 1, "2026-02-29"],
    ["a year zero date", 1, "0000-01-01"],
  ])("rejects %s before writing", async (_label, amount, nextBillingDate) => {
    mockLoggedIn();
    const res = await app.request(
      "/api/subscriptions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Spotify",
          amount,
          currency: "EUR",
          billingCycle: "monthly",
          nextBillingDate,
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("accepts a valid leap day and an amount with two decimal places", async () => {
    mockLoggedIn();
    vi.mocked(createSubscription).mockResolvedValue({ id: "subscription-1" } as never);
    const res = await app.request(
      "/api/subscriptions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Spotify",
          amount: 0.29,
          currency: "EUR",
          billingCycle: "monthly",
          nextBillingDate: "2028-02-29",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
  });
});
