import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "../db/client";
import * as schema from "../db/schema";

export type AuthEnv = {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
};

// Workers には process.envの仕組みが無いので、モジュール先頭でauthを作ることができない。
// リクエストごとに c.env を受け取って作る。

export function createAuth(db: Db, env: AuthEnv) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    // 開発時は localhost と 127.0.0.1 のどちらで開くか揺れるのでオリジン両方を許可しておく。
    // 本番は baseURL（BETTER_AUTH_URL）と同一オリジンなので追加不要。
    trustedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],

    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),

    emailAndPassword: {
      enabled: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
