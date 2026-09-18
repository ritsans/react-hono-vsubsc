import { type FormEvent, useState } from "react";
import { authClient } from "./lib/auth-client";

// 未ログイン時に表示する画面。サインインとサインアップを1つのフォームで切り替える。
function AuthForm() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const result =
      mode === "signIn"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name, email, password });

    // 成功時は useSession が更新されて App 側で画面が切り替わるので、ここでは何もしない。
    if (result.error) setError(result.error.message ?? "認証に失敗しました");
  }

  return (
    <main className="app-shell">
      <h1>{mode === "signIn" ? "ログイン" : "アカウント作成"}</h1>
      <form
        onSubmit={handleSubmit}
        className="stack"
      >
        {mode === "signUp" && (
          <label>
            名前
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        )}
        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">{mode === "signIn" ? "ログイン" : "登録する"}</button>
      </form>
      <button
        type="button"
        className="link"
        onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
      >
        {mode === "signIn" ? "アカウントを作成する" : "ログイン画面へ戻る"}
      </button>
    </main>
  );
}

export default AuthForm;
