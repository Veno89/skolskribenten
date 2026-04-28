# Performance Audit

Performed: April 28, 2026.

## Changes

- The planning workspace is now loaded through `PlanningWorkspaceLoader`, so the heavy checklist, sync, import/export, and AI planning UI is split out of the initial server-rendered route.
- Admin pages remain isolated under `/admin/*` route segments, which keeps their server components and page bundles out of public and standard dashboard routes.
- Runtime billing display config is read on the server, and the public landing page is dynamic so pricing changes can be applied by environment/config without a code deploy.

## Bundle Review

Use `pnpm build` for the current route-size table. The key route to watch is `/lektionsplanering`: the initial route should render the lightweight loader while the planning workspace client chunk loads after hydration.

April 28, 2026 build snapshot:

- `/lektionsplanering`: 1.62 kB route size, 162 kB first-load JS.
- `/skrivstation`: 14.2 kB route size, 212 kB first-load JS.
- Admin routes (`/admin/account-requests`, `/admin/ai-governance`, `/admin/planning-sync`, `/admin/support`): 371-373 B route size, 163 kB first-load JS each.
- Shared first-load JS: 160 kB.

## Follow-Up Watchpoints

- Add a bundle-analyzer package if route sizes start growing again.
- Keep admin-only helpers out of client components.
- Re-run the Playwright public accessibility smoke spec after visual navigation changes because layout overflow often shows up there first.
