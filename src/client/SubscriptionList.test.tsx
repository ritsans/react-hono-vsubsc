import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SubscriptionList from "./SubscriptionList";

// 年払い 6,800円（次回支払日 12月1日）が、ボタンを押した日によって含まれたり含まれなかったりすることを確かめる。
const items = [
  {
    id: "1",
    name: "月払いJPY",
    amount: 1000,
    currency: "JPY",
    billingCycle: "monthly",
    nextBillingDate: "2027-03-15",
    url: null,
    note: null,
  },
  {
    id: "2",
    name: "月払いUSD",
    amount: 10,
    currency: "USD",
    billingCycle: "monthly",
    nextBillingDate: "2026-10-05",
    url: null,
    note: null,
  },
  {
    id: "3",
    name: "年払い12月",
    amount: 6800,
    currency: "JPY",
    billingCycle: "yearly",
    nextBillingDate: "2026-12-01",
    url: null,
    note: null,
  },
  {
    id: "4",
    name: "年払い1月EUR",
    amount: 50,
    currency: "EUR",
    billingCycle: "yearly",
    nextBillingDate: "2027-01-02",
    url: null,
    note: null,
  },
];

// 一覧取得には items を、レート取得には 1 USD = 150円 / 1 EUR = 160円 を返す。
function stubFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/subscriptions") return { ok: true, json: async () => items };
    if (url === "/api/exchange-rates?currency=USD") {
      return { ok: true, json: async () => ({ date: "2026-12-01", currency: "USD", rate: 150 }) };
    }
    if (url === "/api/exchange-rates?currency=EUR") {
      return { ok: true, json: async () => ({ date: "2026-12-01", currency: "EUR", rate: 160 }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function convertOn(date: Date) {
  // setTimeout 等まで止めると findBy の待機が進まなくなるので、Date だけを差し替える。
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);
  const fetchMock = stubFetch();

  render(<SubscriptionList userName="Taro" />);
  await screen.findByText(/年払い12月/);
  fireEvent.click(screen.getByRole("button", { name: "円換算" }));

  return fetchMock;
}

describe("SubscriptionList 円換算", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("11月29日: 12月の年払いは含まれない", async () => {
    const fetchMock = await convertOn(new Date(2026, 10, 29));

    // 月払い 1000円 + 月払い 10ドル × 150円
    expect(await screen.findByText(/今月の支払い 約 2,500 円/)).toBeInTheDocument();
    // 今月の対象に EUR が無いので問い合わせない
    expect(fetchMock).not.toHaveBeenCalledWith("/api/exchange-rates?currency=EUR");
  });

  it("12月1日: 12月の年払いが含まれる", async () => {
    await convertOn(new Date(2026, 11, 1));

    // 1000円 + 1500円 + 年払い 6800円
    expect(await screen.findByText(/今月の支払い 約 9,300 円/)).toBeInTheDocument();
  });

  it("1月2日: 12月の年払いは含まれず、1月の年払い（EUR）が含まれる", async () => {
    const fetchMock = await convertOn(new Date(2027, 0, 2));

    // 1000円 + 1500円 + 年払い 50ユーロ × 160円
    expect(await screen.findByText(/今月の支払い 約 10,500 円/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/exchange-rates?currency=EUR");
  });
});
