import { type FormEvent, useEffect, useRef, useState } from "react";

export type SubscriptionFormValues = {
  name: string;
  amount: string;
  currency: "JPY" | "USD" | "EUR";
  billingCycle: "monthly" | "yearly";
  nextBillingDate: string;
};

const emptyValues: SubscriptionFormValues = {
  name: "",
  amount: "",
  currency: "JPY",
  billingCycle: "monthly",
  nextBillingDate: "",
};

// 追加と編集で共用（入力項目が同じため）。開くたびに initialValues で内容を作り直す。
function SubscriptionFormModal({
  isOpen,
  title,
  initialValues,
  isSubmitting,
  onSubmit,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  initialValues: SubscriptionFormValues | null;
  isSubmitting: boolean;
  onSubmit: (values: SubscriptionFormValues) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<SubscriptionFormValues>(emptyValues);

  // biome-ignore lint/correctness/useExhaustiveDependencies: initialValues はモーダルを開く瞬間だけ反映すればよく、開いている間の再生成では無視する
  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ?? emptyValues);
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    onSubmit(values);
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClose={onClose}
    >
      <div className="modal-box">
        <button
          type="button"
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
        >
          ✕
        </button>
        <h3 className="text-lg font-bold">{title}</h3>
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-3"
        >
          <label className="form-control">
            <span className="label-text">サービス名</span>
            <input
              className="input w-full"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              disabled={isSubmitting}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text">金額</span>
            <input
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              className="input w-full"
              value={values.amount}
              onChange={(e) => setValues({ ...values, amount: e.target.value })}
              disabled={isSubmitting}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text">通貨</span>
            <select
              className="select w-full"
              value={values.currency}
              onChange={(e) =>
                setValues({
                  ...values,
                  currency: e.target.value as SubscriptionFormValues["currency"],
                })
              }
              disabled={isSubmitting}
            >
              <option value="JPY">JPY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">課金サイクル</span>
            <select
              className="select w-full"
              value={values.billingCycle}
              onChange={(e) =>
                setValues({
                  ...values,
                  billingCycle: e.target.value as SubscriptionFormValues["billingCycle"],
                })
              }
              disabled={isSubmitting}
            >
              <option value="monthly">月額</option>
              <option value="yearly">年額</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">次回請求日</span>
            <input
              type="date"
              className="input w-full"
              value={values.nextBillingDate}
              onChange={(e) => setValues({ ...values, nextBillingDate: e.target.value })}
              disabled={isSubmitting}
              required
            />
          </label>
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              disabled={isSubmitting}
              onClick={onClose}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "送信中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
      <form
        method="dialog"
        className="modal-backdrop"
      >
        <button
          type="button"
          onClick={onClose}
        >
          close
        </button>
      </form>
    </dialog>
  );
}

export default SubscriptionFormModal;
