import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

// useSession はサーバーに /api/auth/get-session を問い合わせるので、テストでは差し替える。
vi.mock("./lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
    signOut: vi.fn(),
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  },
}));

import { authClient } from "./lib/auth-client";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("App のルーティング", () => {
  it("未ログインで / を開くとトップページが出る", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as never);

    renderAt("/");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("サブスク管理");
  });

  it("未ログインで /dashboard に来たら /login へリダイレクトされる", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as never);

    renderAt("/dashboard");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ログイン");
  });

  it("未ログインで /profile に来たら /login へリダイレクトされる", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as never);

    renderAt("/profile");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ログイン");
  });

  it("ログイン済みで / に来たらダッシュボードへリダイレクトされる", async () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: "u1", name: "Taro", email: "taro@example.com" } },
      isPending: false,
    } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    renderAt("/");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("サブスク管理");
    expect(screen.getByText("Taro")).toBeInTheDocument();
  });

  it("ログイン済みで /login に来たらダッシュボードへリダイレクトされる", async () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: "u1", name: "Taro", email: "taro@example.com" } },
      isPending: false,
    } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    renderAt("/login");

    expect(await screen.findByText("Taro")).toBeInTheDocument();
  });

  it("ユーザーが切り替わると前のユーザーの一覧を消し、一覧を再取得する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "1",
            name: "Aの契約",
            amount: 1000,
            currency: "JPY",
            billingCycle: "monthly",
            nextBillingDate: "2026-10-01",
            url: null,
            note: null,
          },
        ],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: "a", name: "A" } },
      isPending: false,
    } as never);

    const view = renderAt("/dashboard");
    await screen.findByText("Aの契約");

    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: "b", name: "B" } },
      isPending: false,
    } as never);
    view.rerender(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("Aの契約")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("一覧を読み込み中...")).not.toBeInTheDocument(),
    );
  });

  it("存在しないパスは 404 になる", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as never);

    renderAt("/no-such-page");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ページが見つかりません");
  });
});
