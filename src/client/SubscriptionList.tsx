import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "./lib/auth-client";

// サーバーの GET /api/subscriptions が返す 1 行の形。
type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: "JPY" | "USD";
  billingCycle: "monthly" | "yearly";
  nextBillingDate: string;
  url: string | null;
  note: string | null;
};

// ログイン後に表示する画面。一覧の取得・追加・削除を fetch で直接行う。
function SubscriptionList({ userName }: { userName: string }) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"JPY" | "USD">("JPY");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/subscriptions");
    if (!res.ok) {
      setError("一覧の取得に失敗しました");
      return;
    }
    setItems(await res.json());
  }

  // 初回表示時に一度だけ一覧を読む。reload は再描画のたびに作り直されるので
  // 依存配列に入れず、中身をここに書いている。
  useEffect(() => {
    fetch("/api/subscriptions").then(async (res) => {
      if (!res.ok) {
        setError("一覧の取得に失敗しました");
        return;
      }
      setItems(await res.json());
    });
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        amount: Number(amount),
        currency,
        billingCycle,
        nextBillingDate,
      }),
    });
    if (!res.ok) {
      setError("登録に失敗しました");
      return;
    }
    setName("");
    setAmount("");
    setNextBillingDate("");
    await reload();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("削除に失敗しました");
      return;
    }
    await reload();
  }

  return (
    <main className="app-shell">
      <p className="eyebrow">{userName} さん</p>
      <h1>サブスク一覧</h1>

      <form
        onSubmit={handleAdd}
        className="stack"
      >
        <label>
          サービス名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          金額
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          通貨
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "JPY" | "USD")}
          >
            <option value="JPY">JPY</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label>
          課金サイクル
          <select
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as "monthly" | "yearly")}
          >
            <option value="monthly">月額</option>
            <option value="yearly">年額</option>
          </select>
        </label>
        <label>
          次回請求日
          <input
            type="date"
            value={nextBillingDate}
            onChange={(e) => setNextBillingDate(e.target.value)}
            required
          />
        </label>
        <button type="submit">追加</button>
      </form>

      {error && <p className="error">{error}</p>}

      <ul className="list">
        {items.map((s) => (
          <li key={s.id}>
            <span>
              {s.name} / {s.amount} {s.currency} / {s.billingCycle === "monthly" ? "月額" : "年額"}{" "}
              / 次回 {s.nextBillingDate}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(s.id)}
            >
              削除
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="link"
        onClick={() => authClient.signOut()}
      >
        ログアウト
      </button>
    </main>
  );
}

export default SubscriptionList;
