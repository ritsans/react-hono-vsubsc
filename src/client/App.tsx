import AuthForm from "./AuthForm";
import { authClient } from "./lib/auth-client";
import SubscriptionList from "./SubscriptionList";

// セッションの有無で「ログイン画面」か「一覧画面」かを切り替えるだけの入口。
function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <main className="app-shell">
        <p>読み込み中...</p>
      </main>
    );
  }

  if (!session) return <AuthForm />;

  // ユーザーが変わったら画面を作り直し、前の人の一覧や入力内容を引き継がない。
  // React は key が同じなら以前の表示内容をできるだけ使い回そうとする癖がある
  return (
    <SubscriptionList
      key={session.user.id}
      userName={session.user.name}
    />
  );
}

export default App;
