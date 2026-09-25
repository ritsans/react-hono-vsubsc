import { render, screen, waitFor } from "@testing-library/react";
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

afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("shows the login form when there is no session", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ログイン");
  });

  it("shows the subscription list when signed in", async () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { name: "Taro" } },
      isPending: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    // jsdom には fetch の接続先が無いので、空の一覧を返すスタブに差し替える。
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("サブスク一覧");
    expect(await screen.findByText("Taro さん")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/subscriptions");
  });

  it("clears the previous user's data when the session changes", async () => {
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
            nextBillingDate: "2026-09-01",
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
    const view = render(<App />);
    await screen.findByText(/Aの契約/);

    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: "b", name: "B" } },
      isPending: false,
    } as never);
    view.rerender(<App />);

    expect(screen.getByText("B さん")).toBeInTheDocument();
    expect(screen.queryByText(/Aの契約/)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
