# フロントエンド UI 設計

作成日：2026-09-26
ステータス：プラン（未実装。実装はユーザーの指示後）
要件の出どころ：`docs/frontend.md` とセッション内の回答
MVP：サジェスト等の便利な機能は、基本的なUIと動作が完全に確認できてから実施すること。途中から提案したり実装しない

## 決定事項

| 項目 | 決定 |
|---|---|
| 既存コード | 画面は作り直す。`SubscriptionList` / `AuthForm` の通信・多重操作防止・古い応答の破棄の仕組みは引き継ぐ |
| ルーティング | React Router（Declarative Mode：`BrowserRouter` / `Routes` / `Route`） |
| CRUD の UI | ダッシュボード 1 画面で完結。追加・編集・削除確認は閉じるボタン付きのモーダル（DaisyUI `modal` + `<dialog>`） |
| レスポンシブ | スマホ対応 |
| スタイル | Tailwind CSS v4 + DaisyUI v5。ライトテーマのみ（ダークは今後追加するかも） |
| データ取得 | `fetch` + `useState`。Hono RPC（`hc`）は使わない（理由は下記） |
| メッセージ表示 | DaisyUI の `toast` + `alert` で画面内に表示（`window.alert` は使わない） |
| 円換算の丸め | 四捨五入（`Math.round`）で統一。実装は既に四捨五入なので、docs 側の記述を揃えるだけ |
| テスト | 新しい構成に合わせて作り直す |
| 今回やらない | サービス名サジェスト・Logo.dev アイコン・公式リンク・`url` / `note` の入力と表示・通貨別集計・アラート通知（UI 完成後）。プロフィールのバックエンド（手順だけ下に残す） |
| `url` / `note` を後で入れるとき | `url` をリンク表示する前に、サーバー側で `http://` / `https://` で始まるものだけ受け付ける検証を足す（`javascript:` URL によるスクリプト実行を防ぐため） |

### Hono RPC を使わない理由

- リクエストボディに型を付けるには zod 等のバリデーターが必要で、手書きの `parseSubscriptionInput` を書き換えることになる
- 型推論のためにルート定義をメソッドチェーンに書き換える必要があり、「上から下への一本道」が崩れる
- client と server は別の tsconfig プロジェクトで、型を跨がせる配線が増える
- `fetch("/api/subscriptions/" + id)` の方が URL と処理の対応を追いやすい
- エンドポイントは 5 本、使うのは client の 1 箇所だけで、手書きの型は現状スキーマと一致している

**ルール**：API のレスポンス形を変えたら、同じ変更の中で client 側の型も直す。エンドポイントが大幅に増えたり、型ずれの不具合が出たら再検討する。

## 画面とルート

| パス | 画面 | ログイン | 内容 |
|---|---|---|---|
| `/` | TopPage | 不要 | 簡素なタイトル、「ログイン」「新規登録」へのリンクだけ |
| `/login` | AuthPage | 不要 | 既存 `AuthForm` の作り直し。`?mode=signup` で新規登録から開く。失敗は toast |
| `/dashboard` | DashboardPage | 必要 | 一覧・円換算・追加/編集/削除モーダル・ログアウト |
| `/profile` | ProfilePage | 必要 | 今回は名前とメールの表示のみ（変更機能はバックエンド実装後） |
| `*` | NotFoundPage | 不要 | 「ページが見つかりません」とトップへのリンク |

- 未ログインで `/dashboard` / `/profile` に来たら `/login` へ `<Navigate replace>`
- ログイン済みで `/` / `/login` に来たら `/dashboard` へ
- 判定は `authClient.useSession()` の結果だけで行い、`isPending` の間は読み込み表示
- ユーザーが変わったら `key={session.user.id}` でダッシュボードを作り直す（既存の方針を引き継ぐ）
- ログアウト後は `/` に戻す
- 本番の直リンク・リロードは `wrangler.jsonc` の SPA フォールバックで `index.html` が返るので、サーバー側の変更は不要

## ファイル構成（案）

```
src/client/
  main.tsx                     BrowserRouter で App を包む
  App.tsx                      Routes の一覧（URL と画面の対応はここだけ見れば分かる）
  RequireAuth.tsx              ログイン必須ページの門番
  pages/
    TopPage.tsx
    AuthPage.tsx
    DashboardPage.tsx          一覧・円換算・モーダルの開閉・API 呼び出し
    ProfilePage.tsx
    NotFoundPage.tsx
  components/
    SubscriptionFormModal.tsx  追加と編集で共用（入力項目が同じため）
    ConfirmDeleteModal.tsx
    Toast.tsx                  エラー/成功メッセージの表示
  lib/auth-client.ts           既存のまま
  index.css                    Tailwind + DaisyUI の読み込みのみ（旧 .app-shell 等は削除）
```

API 呼び出しは `DashboardPage` に置いたまま（使うのが 1 画面だけなので共通化しない）。

## ダッシュボードの構成

- ヘッダー：アプリ名、ユーザー名、メニュー（プロフィール / ログアウト）
- 「今月の支払い」カード：円換算ボタンと結果（約 ○○ 円・参考値）。集計ルールは既存のまま
- 「追加」ボタン → `SubscriptionFormModal`（空の状態）
- 一覧：1 件 = 1 カード（名前・金額・通貨・月額/年額・次回請求日）。スマホでもそのまま縦に並ぶ。各カードに「編集」「削除」
  - 編集 → `SubscriptionFormModal`（その行の値を入れた状態）→ `PUT /api/subscriptions/:id`
  - 削除 → `ConfirmDeleteModal` → `DELETE`
- 読み込み中・取得失敗時の「再読み込み」ボタンは既存どおり
- フォーム項目：サービス名・金額・通貨・課金サイクル・次回請求日のみ。`url` / `note` は出さない
  - PUT は全項目を送る作りで、送らない項目は `null` で上書きされる。編集時は元の行の `url` / `note` をそのまま送り返す

既存から引き継ぐ仕組み：`requestId` による古い一覧応答の破棄、`busy` ref による連打防止、一覧が変わる操作での円換算結果の無効化。

### モーダルの扱い

- 開閉は React の state で持ち、`useEffect` で `<dialog>` の `showModal()` / `close()` を呼ぶ（DOM の id を直接触らない）
- ESC・✕ボタン・背景クリックで閉じたら `onClose` で state も戻す
- 送信中はフォームを無効化。成功したら閉じて一覧を再取得、失敗したらモーダルは開いたまま toast を出す

### Toast

- 画面上部に DaisyUI `toast` + `alert alert-error` / `alert-success`
- ✕ボタンで閉じる。次のメッセージが来たら置き換える（自動で消すタイマーは入れない。必要になったら追加）

## 導入・設定

作業ツリーにユーザーが入れた変更がある（`tailwindcss` / `@tailwindcss/vite` / `daisyui`、`vite.config.ts`、`index.css`）。これを前提に:

1. `tailwindcss` と `@tailwindcss/vite` は `dependencies` から `devDependencies` へ移す（ビルド時にだけ使うため）
2. `pnpm add react-router`
3. `index.css` の DaisyUI 設定を `@plugin "daisyui" { themes: light --default; }` にする。何も指定しないと OS のダークモードで dark テーマに切り替わるため
4. `vite.config.ts` を Biome の書式（ダブルクォート・セミコロン）に揃える

## テスト（作り直し）

旧 `App.test.tsx` / `AuthForm.test.tsx` / `SubscriptionList.test.tsx` は削除して書き直す。

- `App.test.tsx`：`MemoryRouter` で各 URL を開き、ログイン有無によるリダイレクトと 404 を確認
- `AuthPage.test.tsx`：ログイン/新規登録の切り替え、失敗時に toast が出る
- `DashboardPage.test.tsx`：一覧表示、追加・編集・削除（モーダル経由）、円換算、通信失敗時の表示、古い応答の破棄
- 注意：jsdom で `HTMLDialogElement.showModal` が未実装なら `vitest.setup.ts` で最小限の代替を入れる（実装時に確認）

## 実装順

各ステップの後に `pnpm lint` → `pnpm check` → `pnpm test`。

1. 依存の整理（上の「導入・設定」）と `index.css` の旧スタイル削除
2. ルーティングの骨組み：`App.tsx`（Routes）、`RequireAuth`、Top / NotFound / Profile（表示のみ）
3. AuthPage（既存 `AuthForm` を移植）+ Toast
4. DashboardPage：一覧・円換算・ログアウト（既存 `SubscriptionList` を移植）
5. 追加/編集モーダル、削除確認モーダル
6. テストの作り直し
7. スマホ幅での見た目確認（`pnpm dev`）
8. docs 更新：`docs/progress.md`（丸めの未決事項を解消）、`.claude/plans/exchange-rates.md` の「切り捨て」の残り（107 行目）を修正

## 後回し：プロフィールのバックエンド手順

実装時に Better Auth のドキュメントで再確認すること。

1. **名前の変更**：設定変更は不要。client から `authClient.updateUser({ name })`
2. **メールアドレスの変更**：`create-auth.ts` に `user.changeEmail: { enabled: true, updateEmailWithoutVerification: true }`。メール送信の仕組みが無いため即時変更にする（現在のメールが未認証のユーザーに限り有効）。client は `authClient.changeEmail({ newEmail })`
3. **アカウント削除**：`user.deleteUser: { enabled: true }`。client は `authClient.deleteUser({ password })` でパスワード再入力を求める。サブスクは FK の `onDelete: "cascade"` で一緒に消える
4. **アバター**：`user.image` 列は既存。未決定 → 画像アップロード（R2 等の保存先が必要）/ 用意したアイコンから選ぶ / 頭文字＋色
5. **カラー**：何の色か未決定（アバター背景・テーマ等）。DB に保存するなら `user` に列を追加（Better Auth の `additionalFields`）＋マイグレーション。端末ごとで良ければ `localStorage`
6. 設定を変えたら `pnpm test` と本番での動作確認
