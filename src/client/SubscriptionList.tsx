import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "./lib/auth-client";

// サーバーの GET /api/subscriptions が返す 1 行の形。
type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: "JPY" | "USD" | "EUR";
  billingCycle: "monthly" | "yearly";
  nextBillingDate: string;
  url: string | null;
  note: string | null;
};

// GET /api/exchange-rates が返す1通貨ぶんのレート。
type ExchangeRate = {
  date: string;
  currency: "USD" | "EUR";
  rate: number;
};

// ログイン後に表示する画面。一覧の取得・追加・削除を fetch で直接行う。
function SubscriptionList({ userName }: { userName: string }) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"JPY" | "USD" | "EUR">("JPY");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [yenTotal, setYenTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  // 通信の返答順が逆転しても、最新の一覧取得だけを画面に反映する。
  const requestId = useRef(0);
  // state の反映を待たずに連打を止める。isBusy はボタンの表示制御に使う。
  const busy = useRef(false);

  const reload = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    try {
      const res = await fetch("/api/subscriptions");
      if (!res.ok) throw new Error("Failed to load subscriptions");
      const rows: Subscription[] = await res.json();
      if (currentRequest === requestId.current) {
        setItems(rows);
        setError(null);
      }
    } catch {
      if (currentRequest === requestId.current) setError("一覧の取得に失敗しました");
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();    // StrictMode の再実行や画面の切り替え後に、古い応答を反映しない。
    return () => {
      requestId.current++;
    };
  }, [reload]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (busy.current || isLoading) return;
    busy.current = true;
    setIsBusy(true);
    setError(null);
    // 一覧が変わる可能性があるので、以前の一覧で計算した金額と取得結果を無効にする。
    setYenTotal(null);
    requestId.current++;
    try {
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
      if (!res.ok) throw new Error("Failed to add subscription");
      setName("");
      setAmount("");
      setNextBillingDate("");
      await reload();
    } catch {
      setError("登録に失敗しました");
    } finally {
      busy.current = false;
      setIsBusy(false);
    }
  }

  // 今月支払うサブスクの合計額を円換算する。
  // 今月の対象に実際に使われている外貨（USD/EUR）だけレートを取りに行き、使われていない通貨は問い合わせない。
  async function handleConvertToYen() {
    if (busy.current || isLoading) return;
    busy.current = true;
    setIsBusy(true);
    setError(null);
    // レート取得が失敗したとき、前回の換算額を今回の結果と誤認させない。
    setYenTotal(null);

    // 今月支払うものだけに絞る。月額と年額をそのまま足すと「いくら払うか」が分からなくなるため。
    // 月払いは毎月必ず払うので常に含める。
    // 年払いは次回支払日の「月」だけを見る。年払いは毎年同じ月に請求されるので、
    // 支払後に次回支払日を更新し忘れていても翌年以降も正しく含まれる。
    const thisMonth = new Date().getMonth() + 1; // ブラウザのローカル日付で「今月」を決める
    const thisMonthItems = items.filter((s) => {
      if (s.billingCycle === "monthly") return true;
      const billingMonth = Number(s.nextBillingDate.slice(5, 7)); // "YYYY-MM-DD" の MM
      return billingMonth === thisMonth;
    });

    let total = thisMonthItems
      .filter((s) => s.currency === "JPY")
      .reduce((sum, s) => sum + s.amount, 0);

    try {
      for (const currency of ["USD", "EUR"] as const) {
        const foreignSum = thisMonthItems
          .filter((s) => s.currency === currency)
          .reduce((sum, s) => sum + s.amount, 0);
        if (foreignSum === 0) continue;

        const res = await fetch(`/api/exchange-rates?currency=${currency}`);
        if (!res.ok) throw new Error("Failed to load exchange rate");
        const rate: ExchangeRate = await res.json();
        total += foreignSum * rate.rate;
      }
      // 通貨ごとの合計を出してから最後に1回だけ四捨五入する（1件ずつ丸めると誤差が積み上がるため）。
      setYenTotal(Math.round(total));
    } catch {
      setError("レートを取得できませんでした");
    } finally {
      busy.current = false;
      setIsBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (busy.current || isLoading) return;
    busy.current = true;
    setIsBusy(true);
    setError(null);
    // 削除前の一覧に基づく換算額と、進行中の古い一覧取得を無効にする。
    setYenTotal(null);
    requestId.current++;
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete subscription");
      await reload();
    } catch {
      setError("削除に失敗しました");
    } finally {
      busy.current = false;
      setIsBusy(false);
    }
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
            max="99999999.99"
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
            onChange={(e) => setCurrency(e.target.value as "JPY" | "USD" | "EUR")}
          >
            <option value="JPY">JPY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
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
        <button
          type="submit"
          disabled={isBusy || isLoading}
        >
          追加
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {error === "一覧の取得に失敗しました" && (
        <button
          type="button"
          onClick={() => void reload()}
          disabled={isLoading || isBusy}
        >
          一覧を再読み込み
        </button>
      )}
      {isLoading && <p>一覧を読み込み中...</p>}

      <button
        type="button"
        onClick={handleConvertToYen}
        disabled={isBusy || isLoading}
      >
        円換算
      </button>
      {yenTotal !== null && <p>今月の支払い 約 {yenTotal.toLocaleString()} 円（参考値）</p>}

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
              disabled={isBusy || isLoading}
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
