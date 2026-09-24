import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "./auth/create-auth";
import app from "./index";

// createAuth をラップしてモック可能にする。デフォルトは本物の実装をそのまま呼ぶので、
// ログイン不要な既存のテスト（Cookie 無し→401 など）はそのまま動く。
// ログイン済みを再現したいテストだけ、この下で1回だけ差し替える。
vi.mock("./auth/create-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth/create-auth")>();
  return { ...actual, createAuth: vi.fn(actual.createAuth) };
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
  it("accepts EUR as a valid currency", async () => {
    mockLoggedIn();
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

    // DB には繋がっていないため作成自体は失敗するが、
    // 400 (invalid input) にならないことで currency のバリデーションを通過したと分かる。
    expect(res.status).not.toBe(400);
  });
});
