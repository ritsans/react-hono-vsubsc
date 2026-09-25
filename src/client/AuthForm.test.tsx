import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AuthForm from "./AuthForm";
import { authClient } from "./lib/auth-client";

vi.mock("./lib/auth-client", () => ({
  authClient: { signIn: { email: vi.fn() }, signUp: { email: vi.fn() } },
}));

afterEach(() => vi.mocked(authClient.signIn.email).mockReset());

function fillSignIn() {
  fireEvent.change(screen.getByLabelText("メールアドレス"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password123" } });
}

it("prevents duplicate sign-in requests while waiting", async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(authClient.signIn.email).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }) as never,
  );
  render(<AuthForm />);
  fillSignIn();
  fireEvent.click(screen.getByRole("button", { name: "ログイン" }));
  expect(screen.getByRole("button", { name: "送信中..." })).toBeDisabled();
  expect(authClient.signIn.email).toHaveBeenCalledTimes(1);
  await act(async () => finish({ error: null }));
  await waitFor(() => expect(screen.getByRole("button", { name: "ログイン" })).toBeEnabled());
});

it("shows a network error and enables retry", async () => {
  vi.mocked(authClient.signIn.email).mockRejectedValueOnce(new Error("offline"));
  render(<AuthForm />);
  fillSignIn();
  fireEvent.click(screen.getByRole("button", { name: "ログイン" }));
  expect(await screen.findByText("通信に失敗しました。もう一度お試しください")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
});
