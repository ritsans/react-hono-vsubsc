import { Link } from "react-router";

function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-content-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">ページが見つかりません</h1>
      <Link
        to="/"
        className="link link-primary"
      >
        トップへ戻る
      </Link>
    </main>
  );
}

export default NotFoundPage;
