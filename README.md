# E-Commerce Template

A modern, full-stack e-commerce starter built as a TypeScript monorepo. It brings together a responsive customer storefront, an administration dashboard, and a centralized REST API. The storefront currently uses **DS Mart** branding, which can be customized for your business.

> **Project scope:** Storefront, admin panel, API, and local development infrastructure. This guide covers local setup and development.

## Tech Stack & Applications

| Application | Stack | Local URL |
| --- | --- | --- |
| Storefront | Next.js 16, React 19 | http://localhost:3000 |
| Admin | Next.js 16, React 19 | http://localhost:3001 |
| API | NestJS 12, Prisma 6 | http://localhost:4000/api/v1 |
| Database | PostgreSQL 17 | localhost:5434 |

The workspace uses pnpm and Turborepo. PostgreSQL runs through Docker Compose during local development.

## Key Features

- Product catalog with categories, variants, images, stock, search, and filtering.
- Customer storefront with product pages, cart, wishlist, guest checkout, and customer accounts.
- Order management, payments records, shipping, returns, and reports.
- Admin authentication with roles and cookie-based sessions.
- CMS pages, navigation, themes, media, drafts, publishing, and scheduling.
- Local or Amazon S3 media storage.
- Product metadata, sitemap, and robots configuration.

Payment records and checkout payment options do not imply a configured online payment gateway. Configure and verify your store's payment workflow before accepting orders.

## Project Structure

```text
apps/
  admin/          Administration dashboard
  api/            NestJS API, Prisma schema, and migrations
  storefront/     Customer-facing Next.js application
docs/             Implementation notes and validation guides
docker-compose.yml
pnpm-workspace.yaml
turbo.json
```

## Prerequisites

- Node.js 22
- pnpm 10.34.7 (declared in the root package.json)
- Docker with Docker Compose, or an existing PostgreSQL 17 database

Run commands below from the repository root unless stated otherwise. File copy examples use PowerShell.

## Getting Started

### 1. Clone and install

```sh
git clone https://github.com/fatema-alt/E-Commerce-Template.git
cd E-Commerce-Template
corepack enable
corepack prepare pnpm@10.34.7 --activate
pnpm install --frozen-lockfile
```

### 2. Start PostgreSQL

```sh
docker compose up -d postgres
```

The development database is `commerce_db`, with user `commerce`, password `commerce_dev_password`, and host port `5434`. These credentials are for local development only. Data persists in the `commerce_postgres_data` Docker volume.

### 3. Configure environment files

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

Set these values in `apps/api/.env`:

```dotenv
DATABASE_URL=postgresql://commerce:commerce_dev_password@localhost:5434/commerce_db?schema=public
PORT=4000
ADMIN_ORIGINS=http://localhost:3001
NODE_ENV=development
MEDIA_STORAGE=local
```

Create `apps/admin/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

Create `apps/storefront/.env.local`:

```dotenv
STOREFRONT_API_BASE_URL=http://localhost:4000/api/v1
STOREFRONT_ORIGIN=http://localhost:3000
```

Environment files and local uploaded media are excluded from Git. The API's `.env.example` documents additional storage and order settings.

### 4. Generate the Prisma client and apply migrations

```sh
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
```

Migrations initialize the schema; they do not import an existing store's products, orders, or media.

### 5. Create the first administrator

Temporarily add the following to `apps/api/.env`, using your own email and a unique password of at least 16 characters:

```dotenv
ADMIN_BOOTSTRAP_EMAIL=admin@example.com
ADMIN_BOOTSTRAP_PASSWORD=replace-with-a-unique-long-password
```

```sh
pnpm --filter api exec tsx scripts/bootstrap-admin.ts
```

The script creates a `SUPER_ADMIN` and refuses to overwrite an existing one. Remove the bootstrap variables after the account is created.

### 6. Start the applications

Open three terminals and run one command in each:

```sh
pnpm --filter api start:dev
```

```sh
pnpm --filter admin dev --port 3001
```

```sh
pnpm --filter storefront dev --port 3000
```

Sign in at http://localhost:3001/login. Add catalog data and configure/publish CMS content through the admin before checking the storefront.

## Development Commands

| Purpose | Command |
| --- | --- |
| Generate API database client | `pnpm --filter api exec prisma generate` |
| Build all applications | `pnpm build` |
| Lint the workspace | `pnpm lint` |
| API tests | `pnpm --filter api test` |
| Apply committed migrations | `pnpm --filter api exec prisma migrate deploy` |
| Inspect local database | `pnpm --filter api exec prisma studio` |

Generate the Prisma client before building the API. Database-backed regression and HTTP/browser checks have additional prerequisites described in `docs/` and their scripts. Always use separate test databases; never point regression checks at production.

## Troubleshooting

| Issue | Suggested check |
| --- | --- |
| Cannot connect to PostgreSQL | Confirm the Docker container is running and `DATABASE_URL` targets port `5434`. |
| Prisma client is missing or imports fail | Run `pnpm --filter api exec prisma generate`. |
| Admin cannot reach the API | Verify the API is running on port `4000` and `NEXT_PUBLIC_API_URL` is correct. |
| Admin login or write operations fail | Verify `ADMIN_ORIGINS`, session cookies, and local API availability. |
| Checkout origin is rejected | Confirm `STOREFRONT_ORIGIN=http://localhost:3000`. |
| Admin and storefront have a port conflict | Start the admin on `3001` and storefront on `3000` as shown above. |
| Storefront appears empty | Add catalog data and publish relevant CMS content in the admin panel. |

## Documentation

- [Dynamic dashboard and deployment](docs/dashboard.md)
- [Catalog implementation](docs/catalog-implementation.md)
- [Order management](docs/orders-implementation.md)
- [CMS foundation](docs/cms-foundation.md)
- [CMS administration](docs/cms-admin-ui.md)
- [CMS and storefront integration](docs/cms-storefront-integration.md)
- [Storefront design](docs/ds-mart-storefront.md)
- [Product details](docs/product-details.md)
- [Shopping and checkout](docs/storefront-shopping.md)

## License

No repository-wide license is currently included. Contact the repository owner to confirm usage and redistribution permissions.

