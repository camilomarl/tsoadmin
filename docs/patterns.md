# Feature patterns

Each feature lives in `src/<feature>/` and follows the Product example:

| File            | Responsibility                                                       |
| --------------- | -------------------------------------------------------------------- |
| `types.ts`      | Request/response interfaces and aliases, with tsoa field annotations |
| `validation.ts` | Synchronous domain validation, independent of HTTP and persistence   |
| `errors.ts`     | Named validation-error subclasses and their messages                 |
| `service.ts`    | Calls validators before database operations                          |
| `admin.ts`      | AdminJS resource and feature-specific property/action customization  |
| `controller.ts` | Routes, HTTP status codes, and calls to the service                  |

Dependencies flow from controller to service, then from service to validators and persistence. Import feature types directly from `types.ts` using `import type`. Avoid re-exporting types from the service. The shared `src/validation-error.ts` contains the transport-independent base error; `src/errors.ts` is the HTTP error handler.

## Types and API metadata

```ts
// src/products/types.ts
export interface ProductInput {
  /** @minLength 1 */
  name: string;
  /**
   * @isInt
   * @minimum 0
   */
  priceInCents: number;
}
```

Keep tsoa field annotations on the shared DTOs. Keep route/path annotations on controller methods. TypeScript types do not validate runtime input by themselves: tsoa checks HTTP request shapes, and feature validators check domain rules. Define explicit controller response types so OpenAPI generation does not need to interpret Prisma's inferred generics.

## Validation errors

```ts
// src/products/errors.ts
import { ValidationError } from '../validation-error.js';

export class InvalidProductNameError extends ValidationError {
  constructor() {
    super('Name must not be blank');
  }
}
```

```ts
// src/products/validation.ts
import { InvalidProductNameError } from './errors.js';
import type { ProductPatch } from './types.js';

export function validateProduct(data: ProductPatch) {
  if (data.name !== undefined && !data.name.trim()) {
    throw new InvalidProductNameError();
  }
}
```

The real Product validator also checks empty input and price boundaries. Services call the appropriate field and ID validators before accessing Prisma. Validators throw errors; they never construct HTTP responses or assign HTTP status codes.

The shared handler checks `error instanceof ValidationError` and returns HTTP 400 with `{ message: error.message }`. This also recognizes subclasses. Messages are intentionally exposed to callers, so keep credentials and internal implementation details out of them. tsoa's separate `ValidateError` retains its field-level response. Unexpected errors return a generic 500 response.

## Shared database constraints

AdminJS uses its Prisma adapter directly and bypasses feature services and validators. Enforce shared data invariants with database constraints. For workflows requiring service logic, add matching admin hooks or custom actions. Extracting validators does not automatically make AdminJS run them.

## Automatic enforcement

`eslint.config.mjs` applies the following rules to `src/<feature>/` files:

- Interfaces and type aliases are forbidden in controllers, services, and validators; put them in `types.ts`.
- `types.ts` rejects runtime variable, function, class, and enum declarations and requires type-only imports.
- Validators may import only `./types.js` and `./errors.js`.
- Controllers cannot import Prisma, PostgreSQL, or `db.js` directly.
- Classes in feature `errors.ts` must directly extend `ValidationError`, and that file may import only the shared base error.

The shared HTTP handler at `src/errors.ts` is outside these feature rules. Generated files are excluded. `tests/architecture.test.ts` exercises allowed examples and verifies that prohibited patterns produce lint errors.

```sh
npm run check
```

This runs formatting checks, ESLint, TypeScript checks, the build, and unit tests. Database integration tests remain separate: `npm run test:integration` requires a dedicated test database.

ESLint checks syntax and declared imports. It cannot prove that every persistence operation calls the right validator, that messages are useful, or that database constraints cover every admin path. Regression tests and review cover those requirements. Helpers that would require widening the validator import boundary should be considered deliberately and accompanied by updates to these rules and their tests.

`AGENTS.md` gives Codex the same conventions. It is guidance, while ESLint and tests are executable checks. For mandatory team enforcement, run `npm run check` in CI and require that job to pass before merging; no remote repository or CI provider is configured in this starter yet.

## Configuration helpers

`src/config.ts` assembles the configuration object and its defaults. Parsing, required-value checks, secret validation, and the test-database guard live in `src/config-utils.ts`. Import helpers directly from that utility file; configuration values and credentials never belong in error messages.

## Admin composition

Each feature exports its own AdminJS resource from `src/<feature>/admin.ts`. The shared `src/admin.ts` explicitly imports those resources into its `resources` array. Product fields, actions, filters, and permissions belong in `src/products/admin.ts`; global adapter registration, sessions, router setup, and cleanup belong in the shared bootstrap.

Branding and login translations live in `src/admin-branding.ts`. Authentication lives in `src/admin-auth.ts`: its factory accepts an optional `AdminCredentialVerifier`, while preserving input checks and session regeneration. The verifier takes email/password and resolves to an AdminJS `CurrentAdmin` or `null`. Verifiers must validate credentials and authorization before returning an admin; an email lookup alone is insufficient. Exceptions fail authentication rather than returning a user.

For a different credential source, pass a verifier to `createApp(config, verifyCredentials)` (or directly to `createAdmin`). For example, import a verifier implemented by your authentication module:

```ts
import { createApp } from './app.js';
import { verifyAdminCredentials } from './authentication/verifier.js';

const { app, close } = await createApp(config, verifyAdminCredentials);
```

The verifier module in this example is supplied by your application; this starter retains its environment-based default. The existing configuration still requires ADMIN_EMAIL and ADMIN_PASSWORD; adapting configuration to an external identity provider is a separate change. Session secrets, persistent sessions, cookie security, origin checks, and login rate limits remain shared controls.

AdminJS adapter writes still bypass feature services. Registering a feature resource does not make its service validators run automatically; shared invariants need database constraints or explicit admin actions/hooks.
