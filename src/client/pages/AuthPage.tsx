import { type FormEvent, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import Alert from "../components/Alert";
import { authClient } from "../lib/auth-client";

// 未ログイン時に表示する画面。サインインとサインアップを1つのフォームで切り替える。
// ログイン済みなら App 側のルーティングではなくここで /dashboard へ送る（"/" と同じ扱い）。
function AuthPage() {
  const { data: session, isPending } = authClient.useSession();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"signIn" | "signUp">(
    searchParams.get("mode") === "signup" ? "signUp" : "signIn",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isPending) return null;
  if (session)
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result =
        mode === "signIn"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ name, email, password });

      // 成功時は useSession が更新されて画面が切り替わるので、ここでは何もしない。
      if (result.error) setError(result.error.message ?? "認証に失敗しました");
    } catch {
      setError("通信に失敗しました。もう一度お試しください");
    } finally {
      // 成功・失敗のどちらでも送信ボタンを元に戻す。
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      {error && (
        <Alert
          message={error}
          variant="error"
          onClose={() => setError(null)}
        />
      )}
      <h1 className="text-center text-2xl font-bold">
        {mode === "signIn" ? "ログイン" : "アカウント作成"}
      </h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
      >
        {mode === "signUp" && (
          <label className="form-control">
            <span className="label-text">名前</span>
            <input
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        )}
        <label className="form-control">
          <span className="label-text">メールアドレス</span>
          <input
            type="email"
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="form-control">
          <span className="label-text">パスワード</span>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "送信中..." : mode === "signIn" ? "ログイン" : "登録する"}
        </button>
      </form>
      <button
        type="button"
        className="link link-primary text-center text-sm"
        disabled={isSubmitting}
        onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
      >
        {mode === "signIn" ? "アカウントを作成する" : "ログイン画面へ戻る"}
      </button>
    </main>
  );
}

export default AuthPage;
