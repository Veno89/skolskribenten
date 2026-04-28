# Accessibility Audit

Performed: April 28, 2026.

## Scope

- Public pages: landing page, contact page, legal/content layout.
- Auth pages: login, registration, password reset.
- Dashboard pages: drafting station, planning workspace, account, settings, admin queues.
- Checks: landmark structure, skip link, keyboard order, visible focus, form labels, live regions, contrast-sensitive UI states, and responsive overflow.

## Findings and Fixes

- Skip navigation exists globally and is keyboard reachable on the first `Tab`.
- Contact and drafting primary controls have accessible names.
- Settings radio-card controls had a weak keyboard focus signal; fixed with `focus-within` ring styling.
- Settings now exposes the safe-word textarea with an explicit label and helper text.
- Planning workspace lazy-load state includes `aria-busy` and `aria-live`.
- Public smoke coverage was added in `e2e/accessibility.spec.ts` for skip navigation and contact-form labelling.
- `pnpm exec playwright test e2e/accessibility.spec.ts` passed on Chromium after installing the local Playwright browser.

## Manual Review Notes

- Screen-reader semantics were reviewed from the rendered markup and ARIA usage. A live NVDA/VoiceOver pass should still be repeated before broad public launch because that requires an interactive desktop environment.
- Colour contrast was reviewed against the current token palette. Primary text, muted text, red/green/amber notices, and focus rings remain distinguishable on the app backgrounds.
- Keyboard navigation is complete for the audited forms and dashboard controls. The mobile dashboard menu remains the primary narrow-screen navigation path.

## Regression Checklist

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm exec playwright test e2e/accessibility.spec.ts`
