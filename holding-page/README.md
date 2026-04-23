# Holding Page

This folder is a self-contained static placeholder site for `skolskribenten.com`.

## Deploy To Netlify

1. Log in to Netlify.
2. Create a new site with manual deploy / drag and drop.
3. Upload the contents of this folder or upload the whole `holding-page` folder.
4. Confirm that the deployed Netlify URL loads the temporary page.

## Connect The Domain

In Netlify:

1. Open the site dashboard.
2. Go to `Domain management`.
3. Add `www.skolskribenten.com`.
4. Add `skolskribenten.com`.
5. Set `www.skolskribenten.com` as the primary domain if you want Netlify to handle redirects cleanly.

In Porkbun DNS:

1. Point `www` to your Netlify site with a `CNAME`.
2. Point the apex/root domain `@` to Netlify's apex target.
3. Remove any conflicting old `@` or `www` records.

Use the exact DNS targets Netlify shows in the custom-domain flow, since those are the values you need to copy into Porkbun.

## Notes

- The page includes `noindex, nofollow` so search engines do not treat the temporary page as the final public site.
- The page is intentionally static and has no app dependencies, which makes it safe to host on a free Netlify plan.
