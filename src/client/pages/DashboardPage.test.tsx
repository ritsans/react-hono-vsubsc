import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";

vi.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
    signOut: vi.fn(),
  },
}));

import { authClient } from "../lib/auth-client";

const sampleRow = {
  id: "1",
  name: "Netflix",
  amount: 1980,
  currency: "JPY" as const,
  billingCycle: "monthly" as const,
  nextBillingDate: "2026-10-01",
  url: null,
  note: null,
};

function renderPage() {
  vi.mocked(authClient.useSession).mockReturnValue({
    data: { user: { id: "u1", name: "Taro", email: "taro@example.com" } },
    isPending: false,
  } as never);
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("DashboardPage", () => {
  it("一覧を表示する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [sampleRow] }));

    renderPage();

    expect(await screen.findByText("Netflix")).toBeInTheDocument();
  });

  it("取得に失敗したら再読み込みボタンが出る", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    renderPage();

    expect(await screen.findByText("一覧の取得に失敗しました")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一覧を再読み込み" })).toBeInTheDocument();
  });

  it("追加モーダルから POST し、一覧を再取得する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // 初回一覧
      .mockResolvedValueOnce({ ok: true, json: async () => sampleRow }) // POST
      .mockResolvedValueOnce({ ok: true, json: async () => [sampleRow] }); // 再取得
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    fireEvent.change(screen.getByLabelText("サービス名"), { target: { value: "Netflix" } });
    fireEvent.change(screen.getByLabelText("金額"), { target: { value: "1980" } });
    fireEvent.change(screen.getByLabelText("次回請求日"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/subscriptions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("Netflix")).toBeInTheDocument();
  });

  it("削除確認モーダルから DELETE する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [sampleRow] }) // 初回一覧
      .mockResolvedValueOnce({ ok: true, json: async () => sampleRow }) // DELETE
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // 再取得
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await screen.findByText("Netflix");

    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/subscriptions/1", { method: "DELETE" });
    await waitFor(() => expect(screen.queryByText("Netflix")).not.toBeInTheDocument());
  });

  it("円換算ボタンで JPY のみの合計を表示する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [sampleRow] }));

    renderPage();
    await screen.findByText("Netflix");

    fireEvent.click(screen.getByRole("button", { name: "円換算" }));

    expect(await screen.findByText(/約 1,980 円/)).toBeInTheDocument();
  });

  it("一覧を変える操作をすると、古い円換算結果が消える", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [sampleRow] }) // 初回一覧
      .mockResolvedValueOnce({ ok: true, json: async () => sampleRow }) // DELETE
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // 再取得
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await screen.findByText("Netflix");
    fireEvent.click(screen.getByRole("button", { name: "円換算" }));
    expect(await screen.findByText(/約 1,980 円/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(screen.queryByText(/約 1,980 円/)).not.toBeInTheDocument());
  });
});
