# tsoadmin

TypeScript starter combining Express, tsoa, Prisma, PostgreSQL, and AdminJS.

## Requirements

Node.js 22.13+ or 24+, npm, and Docker with Compose. Prisma 6 is used because the AdminJS Prisma adapter supports Prisma 5/6. The lockfile records the tested dependency versions.

## Start locally

```sh
npm ci
cp .env.example .env
```

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in `.env`. Use your own password and generate a session secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then:

```sh
docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

- Admin panel: http://127.0.0.1:3000/admin
- Swagger UI: http://127.0.0.1:3000/docs
- OpenAPI: http://127.0.0.1:3000/openapi.json
- Health: http://127.0.0.1:3000/health

The admin panel and REST API manage the same Product records. Prices are integer cents. List responses return the first 100 products, ordered by ID.

## API example

```sh
curl -X POST http://127.0.0.1:3000/api/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bread","priceInCents":250}'
```

The sample CRUD API is unauthenticated and intended for local development. Add authentication and authorization before exposing it to a network. The server and database bind to localhost by default.

## Formatting and linting

```sh
npm run format
npm run format:check
npm run lint
npm run lint:fix
```

Prettier uses two spaces, single quotes, and semicolons. ESLint checks TypeScript and JavaScript with recommended rules; formatting is handled by Prettier. Generated routes, build output, and AdminJS assets are excluded.

## Tests

```sh
npm run typecheck
npm run build
npm test
```

Unit tests run without PostgreSQL; database integration tests are explicitly skipped in `npm test`. To run all CRUD and admin integration checks, create a dedicated database once:

```sh
docker compose exec db createdb -U tsoadmin tsoadmin_test
npm run test:integration
```

`TEST_DATABASE_URL` must identify a distinct database whose name ends in `_test`. Integration tests migrate and clear Product records in that database. Never point it at data you need to keep.

## Continuous integration

The GitHub Actions `checks` job runs formatting, lint, typecheck, build, unit tests, and PostgreSQL integration tests on main pushes and pull requests. Use this status check when protecting the main branch. Runtime dependency advisories are tracked separately with `npm run audit:runtime`.

## Production build

```sh
npm run build
NODE_ENV=production npm start
```

Set all required environment variables, apply migrations, and serve through HTTPS. Production admin cookies require HTTPS. Set `TRUST_PROXY=true` only when the app sits behind exactly one trusted reverse proxy. The admin uses a single environment-configured account; multi-user roles and password recovery are not included.

## Admin branding

The admin panel uses tsoadmin branding, a blue primary palette, and custom login text. The AdminJS logo and attribution footer are hidden. See [branding customization](docs/admin-branding.md) to change the name, logo, colors, or login copy.

## HTTP security

Helmet, restricted CORS, API/login rate limits, admin origin checks, session rotation, and request limits are enabled. Set `PUBLIC_ORIGIN` to the exact browser origin and list additional API frontend origins in `CORS_ORIGINS`. See [security controls and remaining dependency advisories](docs/security.md) before deploying.

## Logging and request IDs

JSON logs go to stdout using Pino. All routes return `X-Request-ID`, and request-scoped logs share that ID across async code. Configure `LOG_LEVEL`, `SERVICE_NAME`, and optional `DD_ENV` / `DD_VERSION` tags. See [logging and collection setup](docs/logging.md) for CloudWatch, Datadog, and application examples.

## Feature structure

See [the architecture patterns](docs/patterns.md) for examples and enforcement rules. Run `npm run check` to verify formatting, architecture lint rules, types, build, and unit tests.

Keep each feature's files together. The Product feature establishes this pattern:

- `types.ts`: request and response types, including tsoa schema annotations.
- `validation.ts`: runtime rules for product fields and IDs.
- `errors.ts`: feature-specific subclasses of the shared `ValidationError`.
- `service.ts`: database operations that call the validators.
- `controller.ts`: HTTP routes and API responses.
- `admin.ts`: AdminJS resource definitions and feature-specific customizations.

Validators throw domain validation errors with custom messages. The shared HTTP error handler maps any `ValidationError` subclass to status 400; validators do not depend on HTTP status codes. tsoa request validation retains its existing field-level error responses.

Controllers and services import types directly from `types.ts`. Keep tsoa path-parameter annotations on controller methods so generated request validation and API documentation stay aligned.

## Extend

1. Add models to `prisma/schema.prisma` and create migrations with `npx prisma migrate dev --name your_change`.
2. Add REST DTOs/controllers, include their paths in `tsoa.json`, and regenerate routes.
3. Define each feature resource in `src/<feature>/admin.ts` and import it into the shared `src/admin.ts` resource list.
4. Add database constraints for invariants that must hold in both API and admin writes.

AdminJS writes use its Prisma adapter directly, bypassing the API service. The migration enforces nonblank names and nonnegative prices for both paths. Custom business workflows need equivalent admin hooks or custom actions.

Admin sessions are stored in PostgreSQL's `admin_session` table, created automatically on first session use. The application database role needs permission to create that table, or provision the connect-pg-simple session schema yourself.

Generated routes, OpenAPI files, build output, admin assets, and `.env` are ignored. `npm run dev`, `build`, and `typecheck` regenerate required files.
