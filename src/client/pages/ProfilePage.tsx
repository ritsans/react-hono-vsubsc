import { Link } from "react-router";
import { authClient } from "../lib/auth-client";

// 表示のみ。名前・メールの変更はバックエンド未実装のため今回は出さない。
function ProfilePage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  return (
    <main className="mx-auto max-w-md p-4">
      <Link
        to="/dashboard"
        className="link link-primary text-sm"
      >
        ← ダッシュボードへ戻る
      </Link>
      <h1 className="mt-4 text-2xl font-bold">プロフィール</h1>
      <div className="mt-4 flex flex-col gap-2">
        <div>
          <p className="text-sm text-base-content/60">名前</p>
          <p>{user?.name}</p>
        </div>
        <div>
          <p className="text-sm text-base-content/60">メールアドレス</p>
          <p>{user?.email}</p>
        </div>
      </div>
    </main>
  );
}

export default ProfilePage;
