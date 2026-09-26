// 画面上部にエラー/成功メッセージを表示する。次のメッセージが来たら置き換える。自動で消すタイマーは入れない。
function Alert({
  message,
  variant,
  onClose,
}: {
  message: string;
  variant: "error" | "success";
  onClose: () => void;
}) {
  return (
    <div className="toast toast-top toast-center z-50">
      <div className={`alert ${variant === "error" ? "alert-error" : "alert-success"}`}>
        {variant === "error" ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zM12 15.75h.007"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12.75l2.25 2.25L15 9m-3-9a9 9 0 100 18 9 9 0 000-18z"
            />
          </svg>
        )}
        <span>{message}</span>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default Alert;
