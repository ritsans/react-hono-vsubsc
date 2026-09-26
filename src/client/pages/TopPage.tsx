import { Link, Navigate } from "react-router";
import { authClient } from "../lib/auth-client";

function TopPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;
  if (session)
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );

  return (
    <main className="grid min-h-screen place-content-center gap-4 p-8 text-center">
      <p className="font-bold text-primary text-sm tracking-widest">SUBSC</p>
      <h1 className="text-3xl font-bold">サブスク管理</h1>
      <div className="flex justify-center gap-3">
        <Link
          to="/login"
          className="btn btn-primary"
        >
          ログイン
        </Link>
        <Link
          to="/login?mode=signup"
          className="btn btn-outline"
        >
          新規登録
        </Link>
      </div>
    </main>
  );
}

export default TopPage;
