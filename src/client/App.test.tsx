import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
