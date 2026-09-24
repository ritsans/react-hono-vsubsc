import { and, desc, eq } from "drizzle-orm";
import type { Db } from "./client";
import { subscription } from "./schema";

// このファイルが subscription テーブルへの唯一の入口。
// 全関数が userId を必須引数に取ることで、所有者を指定しない読み書きを型で防いでいる。
// レビュー時の確認: grep -rn "db/schema" src/server --include=*.ts に
// このファイルと client.ts / auth 以外が出たら赤信号。

export type SubscriptionInput = {
  name: string;
  amount: number;
  currency: "JPY" | "USD" | "EUR";
  billingCycle: "monthly" | "yearly";
  nextBillingDate: string; // "YYYY-MM-DD"
  url: string | null;
  note: string | null;
};

export async function listSubscriptions(db: Db, userId: string) {
  return db
    .select()
    .from(subscription)
    .where(eq(subscription.userId, userId))
    .orderBy(desc(subscription.createdAt));
}

export async function createSubscription(db: Db, userId: string, input: SubscriptionInput) {
  const [row] = await db
    .insert(subscription)
    .values({ userId, ...input })
    .returning();
  return row;
}

// 更新・削除で returning() を使うのは、「他人の行」と「存在しない行」を同じ
// undefined（=404）に倒すため。403 で分けると他人の行の存在を教えてしまう。
export async function updateSubscription(
  db: Db,
  userId: string,
  id: string,
  input: SubscriptionInput,
) {
  const [row] = await db
    .update(subscription)
    .set(input)
    .where(and(eq(subscription.id, id), eq(subscription.userId, userId)))
    .returning();
  return row;
}

export async function deleteSubscription(db: Db, userId: string, id: string) {
  const [row] = await db
    .delete(subscription)
    .where(and(eq(subscription.id, id), eq(subscription.userId, userId)))
    .returning();
  return row;
}
