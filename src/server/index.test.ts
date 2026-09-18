import { describe, expect, it } from "vitest";
import app from "./index";

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
