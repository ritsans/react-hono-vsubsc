import { Fragment, type ReactNode } from "react";
import { Navigate } from "react-router";
import { authClient } from "./lib/auth-client";

// ログイン必須ページの門番。未ログインなら /login へ送り、判定中は何も表示しない。
function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <main className="grid min-h-screen place-content-center">
        <p>読み込み中...</p>
      </main>
    );
  }

  if (!session)
    return (
      <Navigate
        to="/login"
        replace
      />
    );

  // 重要: この key は削除しないこと。ユーザー切り替え時に子ページを作り直し、
  // 前のユーザーの一覧・入力内容・円換算結果が次のユーザーに残るのを防ぐ。
  return <Fragment key={session.user.id}>{children}</Fragment>;
}

export default RequireAuth;
