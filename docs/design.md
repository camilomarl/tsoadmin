# tsoadmin starter design

## Goal

Create a reusable TypeScript backend combining Express, tsoa, Prisma, PostgreSQL, and AdminJS. Demonstrate managing the same records through a REST API and an authenticated admin interface.

## Location and scope

Create `tsoadmin` alongside the project's read-only `sources/` directory. Use PostgreSQL and Prisma as the default database stack. This starter includes one example Product model, local database setup, API documentation, and tests. Deployment and a public frontend are outside the initial scope.

## Architecture

- Express hosts the API, health endpoint, Swagger UI, and AdminJS.
- tsoa controllers define API contracts and generate routes, OpenAPI documentation, and request validation during the build.
- Prisma manages the database schema, migrations, and application queries.
- AdminJS uses its Prisma adapter to expose the Product model at `/admin`.
- A small Product service implements API operations. AdminJS uses its adapter directly; API service rules are not automatically applied to admin writes. The sample uses database constraints for shared invariants.
- Use ESM and select mutually compatible dependency versions before installation, including checking AdminJS's Prisma adapter against the chosen Prisma release.

## Example behavior

Product fields: generated ID, name, nonnegative integer price in cents, and timestamps. API routes support listing, reading, creating, updating, and deleting products. Invalid requests return 400; missing products return 404; unexpected errors return a generic 500 response without internal details.

## Authentication and configuration

Admin access requires credentials configured through environment variables and persistent PostgreSQL-backed sessions. Do not supply working default credentials. Fail startup if required secrets are missing. Keep session cookies HTTP-only, use secure cookies in production, and configure proxy trust explicitly. API authentication is outside this sample's scope; document that the sample CRUD API is intended for local development.

## Deliverables

Package scripts for development, generation, build, type checking, tests, migrations, and seeding; `.env.example`; ignored local secrets; PostgreSQL Compose configuration; initial migration; example seed data; and README instructions for starting and verifying the application.

## Acceptance checks

Verify type checking and production compilation. Run database-backed API tests covering CRUD, invalid input, and missing records. Smoke-test generated OpenAPI paths and Swagger UI. Verify unauthenticated admin access does not expose data, invalid credentials fail, and valid credentials permit managing Product records. Report any checks blocked by unavailable dependencies or database runtime.
