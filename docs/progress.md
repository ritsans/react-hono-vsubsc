# 進捗メモ

更新日：2026-09-26

## 現在地

- フロントエンドを `.claude/plans/frontend-ui.md` の設計で作り直し済み。React Router（`/`, `/login`, `/dashboard`, `/profile`, `*`）、Tailwind v4 + DaisyUI（ライトテーマ固定）、追加/編集/削除は `<dialog>` モーダル。
- メッセージ表示は `Alert` コンポーネント（旧 `Toast`。DaisyUI `toast` + `alert`、成功/エラーをアイコンと色で区別）。追加・編集・削除の成功時にも成功アラートを出す。
- ダッシュボードは既存の安定性対策（`requestId` による古い応答の破棄、`busy` ref による多重操作防止、一覧変更時の円換算無効化）を引き継いだまま移植済み。編集（PUT）画面も追加した。プロフィールは名前・メール表示のみ（変更機能は未実装、手順は frontend-ui.md 末尾）。
- `RequireAuth` に `key={session.user.id}` を復元し、ユーザー切り替え時に前のユーザーの画面状態を破棄する。削除防止の重要コメントと回帰テストあり。
- `pnpm lint` / `pnpm check` / `pnpm test`（44件）通過。Biome に `css.parser.tailwindDirectives` を追加して DaisyUI のブロック構文に対応。
- サーバー側（認証・CRUD API・円換算・EUR 対応・安定性改善）は既存のまま。本番 URL：`https://react-hono-vsubsc.dazzling3season.workers.dev`。デプロイ状況は今回のフロント変更分含め未確認。
- 開発用と本番用で同じ Neon データベースを共有している。

## 次にやること

1. スマホ幅での見た目を `pnpm dev` で確認し、問題なければデプロイする。
2. `0006` の適用状況とデプロイ状況を確認し、未反映の変更を反映する。
3. 通貨別の集計表示、サービス名のサジェスト・公式リンク・ブランドアイコン、プロフィールのバックエンド（名前/メール変更・アカウント削除・アバター）は今回スコープ外。
