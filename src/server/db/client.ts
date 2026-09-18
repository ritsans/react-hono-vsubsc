import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// neon-http は 1 クエリ = 1 HTTP リクエストで、接続確立が無い。
// そのためリクエストごとに作り直してもコストにならず、
// c.env はリクエスト内でしか取れないのでハンドラの中で呼ぶ。
export function createDb(databaseUrl: string) {
  return drizzle({ client: neon(databaseUrl), schema });
}

export type Db = ReturnType<typeof createDb>;
