> **Canonical reference:** https://www.logo.dev/docs/logo-images/introduction
> If anything below is outdated or contradicts the live API, fetch that URL — it is the source of truth. Tell me if something looks stale.

---

# Logo.dev setup — Show company logos

Paste this into Claude Code to wire up the integration.

Logo.dev's Logo API returns any company's logo as a cacheable image URL — no SDK, just an `<img>` with your publishable key. You're looking up by company name.

## Your publishable key (safe client-side)
`pk_LkJZJD0fTnagtKuKMeVf3Q`

## Render a logo (by company name)
```jsx
function CompanyLogo({ name }) {
  return (
    <img
      src={`https://img.logo.dev/name/${encodeURIComponent(name)}?token=pk_LkJZJD0fTnagtKuKMeVf3Q`}
      alt={`${name} logo`}
      width={128}
      height={128}
    />
  );
}
```

## Look up by any identifier
Same CDN, just swap the path:
- Domain — `stripe.com`
- Company name — `name/Stripe`
- Stock ticker — `ticker/AAPL` (non-US: `ticker/AAPL.L`)
- Crypto symbol — `crypto/BTC`
- ISIN — `isin/US0378331005`

## Customize with query params
- `size` — pixels, default 128, max 800
- `format` — `jpg` (default), `png`, `webp`
- `theme` — `auto`, `light`, or `dark` for the background
- `retina` — render at 2× for high-DPI screens
- `fallback` — `monogram` (default) or `404`

## Handle a missing logo
By default a black-and-white monogram is returned with `200 OK`, so images never break. Pass `fallback=404` to get a 404 instead and swap in your own image on error.

> Free tier: commercial use needs an attribution link back to Logo.dev (personal projects don't). Paid plans remove it.

## Docs
- Logo API overview: https://www.logo.dev/docs/logo-images/introduction
- All parameters: https://www.logo.dev/docs/logo-images/get
