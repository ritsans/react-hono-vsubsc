import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import SubscriptionFormModal, {
  type SubscriptionFormValues,
} from "../components/SubscriptionFormModal";
import Alert from "../components/Alert";
import { authClient } from "../lib/auth-client";

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

const CYCLE_LABEL: Record<Subscription["billingCycle"], string> = {
  monthly: "月額",
  yearly: "年額",
};

function toFormValues(s: Subscription): SubscriptionFormValues {
  return {
    name: s.name,
    amount: String(s.amount),
    currency: s.currency,
    billingCycle: s.billingCycle,
    nextBillingDate: s.nextBillingDate,
  };
}

// ログイン後に表示する画面。一覧の取得・追加・編集・削除・円換算を fetch で直接行う。
function DashboardPage() {
  const { data: session } = authClient.useSession();
  const [items, setItems] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  // エラー/成功のどちらか一方だけを画面上部に表示する。次のメッセージが来たら置き換える。
  const [notice, setNotice] = useState<{ message: string; variant: "error" | "success" } | null>(
    null,
  );
  const [yenTotal, setYenTotal] = useState<number | null>(null);

  const [editingTarget, setEditingTarget] = useState<Subscription | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);

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
        setNotice(null);
      }
    } catch {
      if (currentRequest === requestId.current)
        setNotice({ message: "一覧の取得に失敗しました", variant: "error" });
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(); // StrictMode の再実行や画面の切り替え後に、古い応答を反映しない。
    return () => {
      requestId.current++;
    };
  }, [reload]);

  function openAddForm() {
    setEditingTarget(null);
    setIsFormOpen(true);
  }

  function openEditForm(s: Subscription) {
    setEditingTarget(s);
    setIsFormOpen(true);
  }

  async function handleFormSubmit(values: SubscriptionFormValues) {
    if (busy.current) return;
    busy.current = true;
    setIsBusy(true);
    setNotice(null);
    // 一覧が変わる可能性があるので、以前の一覧で計算した金額と取得結果を無効にする。
    setYenTotal(null);
    requestId.current++;

    // 編集時は url / note を画面に出していないので、元の行の値をそのまま送り返す。
    const body = {
      name: values.name,
      amount: Number(values.amount),
      currency: values.currency,
      billingCycle: values.billingCycle,
      nextBillingDate: values.nextBillingDate,
      url: editingTarget?.url ?? null,
      note: editingTarget?.note ?? null,
    };

    try {
      const res = editingTarget
        ? await fetch(`/api/subscriptions/${editingTarget.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/subscriptions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) throw new Error("Failed to save subscription");
      setIsFormOpen(false);
      await reload();
      setNotice({ message: editingTarget ? "更新しました" : "追加しました", variant: "success" });
    } catch {
      setNotice({
        message: editingTarget ? "更新に失敗しました" : "登録に失敗しました",
        variant: "error",
      });
    } finally {
      busy.current = false;
      setIsBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (busy.current || !deleteTarget) return;
    busy.current = true;
    setIsBusy(true);
    setNotice(null);
    // 削除前の一覧に基づく換算額と、進行中の古い一覧取得を無効にする。
    setYenTotal(null);
    requestId.current++;
    try {
      const res = await fetch(`/api/subscriptions/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete subscription");
      setDeleteTarget(null);
      await reload();
      setNotice({ message: "削除しました", variant: "success" });
    } catch {
      setNotice({ message: "削除に失敗しました", variant: "error" });
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
    setNotice(null);
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
      setNotice({ message: "レートを取得できませんでした", variant: "error" });
    } finally {
      busy.current = false;
      setIsBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      {notice && (
        <Alert
          message={notice.message}
          variant={notice.variant}
          onClose={() => setNotice(null)}
        />
      )}

      <header className="flex items-center justify-between py-2">
        <h1 className="text-xl font-bold">サブスク管理</h1>
        <div className="dropdown dropdown-end">
          <button
            type="button"
            tabIndex={0}
            className="btn btn-ghost"
          >
            {session?.user.name}
          </button>
          <ul className="dropdown-content menu z-10 w-40 rounded-box bg-base-100 p-2 shadow">
            <li>
              <Link to="/profile">プロフィール</Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => authClient.signOut()}
              >
                ログアウト
              </button>
            </li>
          </ul>
        </div>
      </header>

      <section className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">今月の支払い</h2>
          <button
            type="button"
            className="btn btn-sm btn-outline w-fit"
            onClick={handleConvertToYen}
            disabled={isBusy || isLoading}
          >
            円換算
          </button>
          {yenTotal !== null && <p>約 {yenTotal.toLocaleString()} 円（参考値）</p>}
        </div>
      </section>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">一覧</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openAddForm}
          disabled={isBusy}
        >
          追加
        </button>
      </div>

      {isLoading && <p className="mt-2">一覧を読み込み中...</p>}
      {!isLoading && notice?.message === "一覧の取得に失敗しました" && (
        <button
          type="button"
          className="btn btn-sm mt-2"
          onClick={() => void reload()}
          disabled={isBusy}
        >
          一覧を再読み込み
        </button>
      )}

      <div className="mt-2 flex flex-col gap-2">
        {items.map((s) => (
          <div
            key={s.id}
            className="card bg-base-100 shadow"
          >
            <div className="card-body flex-row items-center justify-between p-4">
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-sm text-base-content/70">
                  {s.amount} {s.currency} / {CYCLE_LABEL[s.billingCycle]} / 次回 {s.nextBillingDate}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => openEditForm(s)}
                  disabled={isBusy || isLoading}
                >
                  編集
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-error"
                  onClick={() => setDeleteTarget(s)}
                  disabled={isBusy || isLoading}
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SubscriptionFormModal
        isOpen={isFormOpen}
        title={editingTarget ? "サブスクを編集" : "サブスクを追加"}
        initialValues={editingTarget ? toFormValues(editingTarget) : null}
        isSubmitting={isBusy}
        onSubmit={handleFormSubmit}
        onClose={() => setIsFormOpen(false)}
      />

      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        targetName={deleteTarget?.name ?? ""}
        isSubmitting={isBusy}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </main>
  );
}

export default DashboardPage;
