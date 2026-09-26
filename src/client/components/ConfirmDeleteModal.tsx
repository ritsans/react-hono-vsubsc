import { useEffect, useRef } from "react";

// 削除確認モーダル。開閉は isOpen の state で持ち、useEffect から showModal()/close() を呼ぶ。
function ConfirmDeleteModal({
  isOpen,
  targetName,
  isSubmitting,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  targetName: string;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [isOpen]);

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
        <h3 className="text-lg font-bold">削除の確認</h3>
        <p className="py-2">「{targetName}」を削除しますか？</p>
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
            type="button"
            className="btn btn-error"
            disabled={isSubmitting}
            onClick={onConfirm}
          >
            {isSubmitting ? "削除中..." : "削除する"}
          </button>
        </div>
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

export default ConfirmDeleteModal;
