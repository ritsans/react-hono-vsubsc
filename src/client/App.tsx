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

  return <SubscriptionList userName={session.user.name} />;
}

export default App;
