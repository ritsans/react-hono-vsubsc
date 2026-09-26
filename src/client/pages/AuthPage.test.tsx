import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthPage from "./AuthPage";

vi.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  },
}));

import { authClient } from "../lib/auth-client";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthPage />
    </MemoryRouter>,
  );
}

function fillSignIn() {
  fireEvent.change(screen.getByLabelText("メールアドレス"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password123" } });
}

afterEach(() => vi.mocked(authClient.signIn.email).mockReset());

describe("AuthPage", () => {
  it("デフォルトはログインモードで開く", () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);

    renderAt("/login");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ログイン");
  });

  it("?mode=signup で新規登録モードから開く", () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);

    renderAt("/login?mode=signup");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("アカウント作成");
  });

  it("送信中は二重送信を防ぎ、完了後にボタンが戻る", async () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
    let finish!: (value: unknown) => void;
    vi.mocked(authClient.signIn.email).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }) as never,
    );

    renderAt("/login");
    fillSignIn();
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(screen.getByRole("button", { name: "送信中..." })).toBeDisabled();
    expect(authClient.signIn.email).toHaveBeenCalledTimes(1);

    await act(async () => finish({ error: null }));
    await waitFor(() => expect(screen.getByRole("button", { name: "ログイン" })).toBeEnabled());
  });

  it("失敗すると toast にエラーが表示される", async () => {
    vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
    vi.mocked(authClient.signIn.email).mockRejectedValueOnce(new Error("offline"));

    renderAt("/login");
    fillSignIn();
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByText("通信に失敗しました。もう一度お試しください"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
  });
});
