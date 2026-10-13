# tsoadmin conventions

- Follow docs/patterns.md and keep features in src/<feature>/.
- Put DTOs and type aliases in types.ts; import them directly with import type.
- Keep runtime validation in validation.ts and feature-specific ValidationError subclasses in errors.ts.
- Validators import only local types and domain errors; they do not know HTTP or database APIs.
- Services call validators before persistence; controllers call services.
- Map domain validation errors to HTTP 400 in the shared error handler.
- Preserve tsoa field and path annotations and explicit controller response types.
- AdminJS bypasses services; shared invariants must be enforced in the database.
- Run npm run check after changes. Run database integration tests when changing persistence or admin behavior if a dedicated test database is available.
- Do not weaken architecture lint rules to make a change pass without documenting the reason and updating regression tests.

- Follow docs/logging.md. Use getLogger() for request-scoped logs and the shared logger for lifecycle events. Never use console logging in application source.
- Do not log request bodies, headers, query strings, credentials, or sensitive exception messages.

- Follow docs/security.md. Keep security and request logging middleware before parsers/routes, preserve admin origin checks and session regeneration, and scope CSP exceptions to the UI that requires them.
- Do not add wildcard CORS or enable credentialed API CORS without an explicit design. Keep PUBLIC_ORIGIN aligned with the actual admin browser origin.

- Define feature-specific AdminJS resources in src/<feature>/admin.ts and import them explicitly in the shared admin bootstrap. Keep branding in src/admin-branding.ts and credential verification in src/admin-auth.ts. Custom verifiers must preserve the shared authentication/session safeguards.
