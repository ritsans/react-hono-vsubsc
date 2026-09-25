---
name: verify
description: このリポジトリの変更を検証する。Biome lint → tsc -b による型チェック → Vite ビルド → wrangler dry-run デプロイを順に実行し、失敗したら止める。コード変更後の確認や「ビルド通る？」「検証して」と言われたときに使う。
---

以下を順に実行する。失敗した時点で止めて、原因を報告すること。

```bash
pnpm lint
pnpm exec tsc -b
pnpm exec vite build
pnpm exec wrangler deploy --dry-run
```

## 注意

- **`tsc` を `-b` なしで呼ばないこと。** `tsconfig.json` が `files: []` + project references のソリューション形式のため、`tsc` 単体は 1 ファイルも型チェックせず exit 0 になる。
- `tsc -b` はインクリメンタルビルド。結果が怪しいときは `pnpm exec tsc -b --force` で再実行する。
- lint エラーのうち機械的に直せるものは `pnpm format` で解消できる。対象はリポジトリ全体（`src` もルートの設定ファイルも含む。範囲は `biome.json` の `files.includes` が決める）。
- `wrangler deploy --dry-run` は実際のデプロイを行わない。バンドルと設定の検証のみ。
