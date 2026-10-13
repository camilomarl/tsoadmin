# Express security baseline

The shared `src/security.ts` middleware runs before all routes and body parsing. The application disables `x-powered-by`, and Helmet also removes it. API, admin, documentation, redirects, and application errors do not advertise Express in response headers.

## Controls

- Helmet supplies security headers, including MIME-sniffing protection, framing protection, and CSP. Framing is denied. HSTS and insecure-request upgrades are enabled in production and disabled for local HTTP development. HSTS does not automatically cover subdomains.
- API CORS allows the configured application origin and explicitly listed frontend origins. Other browser origins receive 403. Credentials are not enabled, and `X-Request-ID` is exposed to permitted browser clients. Requests without an Origin header still work; CORS is not API authentication.
- API traffic is limited per IP to 100 requests per minute by default. Admin login is limited to 20 attempts per IP per 15 minutes, including successful attempts.
- Admin state-changing requests require an Origin header exactly matching `PUBLIC_ORIGIN`. API CORS permissions do not grant access to admin writes. Cross-site logout requests identified by browser Fetch Metadata are rejected.
- Successful admin login regenerates the session ID. Cookies are HTTP-only, SameSite Strict, secure in production, and expire after eight hours. Admin responses use `Cache-Control: no-store`.
- JSON bodies are limited to 100 KiB. Compressed JSON request bodies are rejected rather than inflated. Oversized and unsupported-encoding requests return controlled 413/415 responses.
- Admin requests with a declared body larger than 100 KiB are rejected before parsing. Formidable additionally limits fields to 20, field data to 100 KiB, and file data to one byte; this starter has no file-upload feature. Introducing uploads requires a dedicated design rather than loosening these limits blindly.
- HTTP request receipt is limited to 30 seconds, headers to 10 seconds, idle keep-alive to five seconds, and a connection to 1,000 requests. These do not impose a timeout on application/database execution after a request is received.
- tsoa rejects unexpected body fields, and domain validators enforce field and ID constraints. Prisma parameterizes normal ORM queries; do not introduce user-controlled raw SQL.

## Browser policies

The API CSP disallows inline scripts and styles. Swagger UI permits inline styles while scripts remain restricted to the same origin. AdminJS's current templates require inline scripts and styles, so that allowance is restricted to `/admin`; arbitrary external script sources and eval are not allowed. Google Fonts and the known admin logo origin are permitted only for the admin UI. This exception reduces CSP's protection against inline-script XSS in AdminJS and requires care with custom admin components and rich text.

`Referrer-Policy: same-origin` prevents cross-origin referrers while preserving same-origin form behavior. Helmet's default `no-referrer` made native browser login submit an unusable Origin for the CSRF guard; the selected policy was verified through a real browser login.

## Configuration

```dotenv
PUBLIC_ORIGIN=http://127.0.0.1:3000
CORS_ORIGINS=http://localhost:5173
API_RATE_LIMIT=100
ADMIN_LOGIN_RATE_LIMIT=20
```

`PUBLIC_ORIGIN` must be the exact origin users visit, with scheme and port when applicable, and no trailing slash or path. It defaults to `http://HOST:PORT`. In production, set it explicitly to the public HTTPS origin. Use that same origin to open AdminJS. CLI clients making admin writes must send the matching Origin header.

`CORS_ORIGINS` is a comma-separated list of additional HTTP(S) origins for the API. It defaults to an empty list; wildcards, credentials in URLs, and paths are rejected. Rate limits must be positive integers.

TLS must be provided by your deployment/reverse proxy. `TRUST_PROXY=true` assumes exactly one trusted proxy; prevent clients from reaching the application directly when using it. Incorrect proxy trust can undermine per-IP limits and secure-cookie handling.

Rate-limit counters are in memory and reset on restart. Multiple replicas need a shared store or gateway/WAF rate limits. Infrastructure request-size and connection limits should complement application controls.

The sample REST API remains unauthenticated. Add authentication and authorization before exposing sensitive data; CORS and rate limits do not provide either.

## Checks and dependency advisories

`npm run check` exercises security headers, CORS, origin validation, rate limits, and body limits. Database integration tests also cover session rotation and normal admin/API behavior. Browser verification covered native login, the authenticated admin home, and Swagger UI rendering with CSP enabled.

Run `npm run audit:runtime` to check runtime dependency advisories. This check is separate from `npm run check` because the current upstream dependency tree has unresolved advisories.

Audit on 2026-10-12 reported **47 entries: 43 moderate, four high, zero critical**. Compatible `npm audit fix` did not clear them. The high entries are:

| Package                    | Advisory category                                       |
| -------------------------- | ------------------------------------------------------- |
| `tinymce`                  | XSS advisories in the AdminJS rich-text dependency tree |
| `deepmerge-ts`             | Stack exhaustion on recursive object graphs             |
| `@prisma/config`, `prisma` | Depend on the affected deepmerge-ts version             |

These are dependency advisories, not evidence that every listed issue is reachable through this application. The added middleware does not patch them. Resolving them requires compatible upstream updates or separately verified dependency changes; forced major changes were not applied. The existing Product feature does not use rich-text fields. Review remaining moderate findings as well before deploying.

References: [Express security guidance](https://expressjs.com/en/advanced/best-practice-security/), [Helmet](https://helmet.js.org/), [CORS middleware](https://expressjs.com/en/resources/middleware/cors/), and [express-rate-limit](https://express-rate-limit.mintlify.app/reference/configuration).
