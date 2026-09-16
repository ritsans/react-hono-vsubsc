import { describe, expect, it } from "vitest";
import app from "./index";

describe("worker app", () => {
  it("returns 404 for an unregistered path", async () => {
    const res = await app.request("/api/unknown");

    expect(res.status).toBe(404);
  });
});
