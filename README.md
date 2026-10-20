# Commerce Suite

A TypeScript e-commerce monorepo with a customer storefront, an administration dashboard, and a shared API. The storefront includes DS Mart branding that can be adapted for your store.

## Applications

| Application | Stack | Local URL |
| --- | --- | --- |
| Storefront | Next.js 16, React 19 | http://localhost:3000 |
| Admin | Next.js 16, React 19 | http://localhost:3001 |
| API | NestJS 12, Prisma 6 | http://localhost:4000/api/v1 |
| Database | PostgreSQL 17 | localhost:5434 |

The workspace uses pnpm and Turborepo. PostgreSQL runs through Docker Compose during local development.

## Features

- Product catalog with categories, variants, images, stock, search, and filtering.
- Customer storefront with product pages, cart, wishlist, guest checkout, and customer accounts.
- Order management, payments records, shipping, returns, and reports.
- Admin authentication with roles and cookie-based sessions.
- CMS pages, navigation, themes, media, drafts, publishing, and scheduling.
- Local or Amazon S3 media storage.
- Product metadata, sitemap, and robots configuration.

Payment records and checkout payment options do not imply a configured online payment gateway. Configure and verify your store's payment workflow before accepting orders.

## Repository structure

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

## Requirements

- Node.js 22
- pnpm 10.34.7 (declared in the root package.json)
- Docker with Docker Compose, or an existing PostgreSQL 17 database

Run commands below from the repository root unless stated otherwise. File copy examples use PowerShell.

## Local setup

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

## Useful commands

| Purpose | Command |
| --- | --- |
| Generate API database client | `pnpm --filter api exec prisma generate` |
| Build all applications | `pnpm build` |
| Lint the workspace | `pnpm lint` |
| API tests | `pnpm --filter api test` |
| Apply committed migrations | `pnpm --filter api exec prisma migrate deploy` |
| Inspect local database | `pnpm --filter api exec prisma studio` |

Generate the Prisma client before building the API. Database-backed regression and HTTP/browser checks have additional prerequisites described in `docs/` and their scripts. Always use separate test databases; never point regression checks at production.

## Deploy with Coolify on a Hostinger VPS

Deploy this repository as **three Node applications and one PostgreSQL database**. The root Docker Compose file provisions only the local development database; it is not a complete production stack. Production Dockerfiles are not included.

### 1. Prepare the server and domains

Install Coolify on the VPS or use [Hostinger's Coolify template](https://www.hostinger.com/support/9615197-how-to-use-the-coolify-vps-template-at-hostinger/). Reinstalling a VPS template can erase existing server data.

Point your domain's DNS A records to the VPS IP:

| Service | Example domain | Container port |
| --- | --- | --- |
| Storefront | `https://example.com` | 3000 |
| Admin | `https://admin.example.com` | 3000 |
| API | `https://api.example.com` | 4000 |
| Coolify dashboard | `https://coolify.example.com` | Managed by Coolify |

Allow SSH and HTTP/HTTPS through the VPS firewall. Follow [Coolify's firewall guide](https://coolify.io/docs/core/infrastructure/servers/firewall) for dashboard and terminal ports. Keep database access private.

### 2. Create PostgreSQL

Create a PostgreSQL 17 resource in Coolify with a strong password and persistent storage. Copy its internal connection URL into the API's `DATABASE_URL`. The API and database must share a reachable Docker network. `localhost` inside an API container does not refer to the database container.

### 3. Add the applications

Connect this GitHub repository and select the `main` branch. Create separate API, admin, and storefront resources using Nixpacks. Keep the base directory at `/` for each application so the workspace and root lockfile are available.

Configure Node.js 22 and pnpm 10.34.7. Keep development dependencies available for compilation, Prisma generation, and migration commands.

Common install command:

```sh
pnpm install --frozen-lockfile
```

| Application | Build command | Start command |
| --- | --- | --- |
| API | `pnpm --filter api exec prisma generate && pnpm --filter api build` | `pnpm --filter api start:prod` |
| Admin | `pnpm --filter admin build` | `pnpm --filter admin start --hostname 0.0.0.0 --port 3000` |
| Storefront | `pnpm --filter storefront build` | `pnpm --filter storefront start --hostname 0.0.0.0 --port 3000` |

Set the exposed port and HTTPS domain for each resource using the table above. Both Next.js applications need Node servers; do not configure them as static exports.

### 4. Configure production variables

API:

```dotenv
NODE_ENV=production
PORT=4000
DATABASE_URL=<internal-postgresql-connection-url>
ADMIN_ORIGINS=https://admin.example.com
MEDIA_STORAGE=local
MEDIA_ROOT=/var/lib/commerce/media
STOREFRONT_CHECKOUT_SECRET=<random-secret-at-least-32-characters>
ORDER_RETURN_WINDOW_DAYS=14
```

Make `DATABASE_URL` available during the API build because Prisma configuration reads it during client generation. Use Coolify's secret settings for credentials.

Mount persistent storage at `/var/lib/commerce/media`. Without durable storage, local uploads can be lost during redeployment. Alternatively, configure S3 using the variables in `apps/api/.env.example`; migrate existing media when changing storage providers.

Admin:

```dotenv
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
```

Storefront:

```dotenv
NODE_ENV=production
STOREFRONT_API_BASE_URL=https://api.example.com/api/v1
STOREFRONT_ORIGIN=https://example.com
```

Make frontend configuration available during build and runtime. `NEXT_PUBLIC_API_URL` is embedded in the admin build; rebuild after changing it. Use HTTPS and keep the admin/API under the same parent domain to match the current cookie authentication setup. Origins must match exactly, without trailing slashes.

### 5. Migrate, deploy, and create the admin

Configure the API's pre-deployment command, running from the repository root with database network access:

```sh
pnpm --filter api exec prisma migrate deploy
```

Start the database, deploy the API, then deploy the admin and storefront. Temporarily add `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` to the API environment and run the bootstrap command from the API container terminal. Remove those variables afterward.

For production schema changes, use committed migrations with `migrate deploy`. Do not use `migrate dev`, `migrate reset`, or `db push` against the production database.

### 6. Verify the deployment

- Sign in to the admin and create a product.
- Upload an image and confirm it loads on the storefront.
- Complete a checkout and confirm the order appears in the admin.
- Redeploy the API and confirm uploaded images remain available.
- Configure database and media backups, then verify a restore.

These settings describe the intended deployment; a successful live deployment is not implied by this README.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Database connection fails | Internal database hostname, credentials, network, and migration logs |
| Admin calls localhost in production | Set `NEXT_PUBLIC_API_URL` as a build variable and rebuild |
| Login or writes are rejected | HTTPS, exact `ADMIN_ORIGINS`, same-site domains, and browser cookie settings |
| Checkout origin is rejected | Exact `STOREFRONT_ORIGIN`, including the scheme and selected hostname |
| Images disappear after deployment | Persistent mount at `MEDIA_ROOT`, or S3 configuration |
| Prisma imports fail during build | Run `prisma generate` before building the API |
| Both local frontends try port 3000 | Start the admin explicitly with `--port 3001` |

## Further documentation

- [Catalog implementation](docs/catalog-implementation.md)
- [Order management](docs/orders-implementation.md)
- [CMS foundation](docs/cms-foundation.md)
- [CMS administration](docs/cms-admin-ui.md)
- [CMS and storefront integration](docs/cms-storefront-integration.md)
- [Storefront design](docs/ds-mart-storefront.md)
- [Product details](docs/product-details.md)
- [Shopping and checkout](docs/storefront-shopping.md)

## License

No repository-wide license is included. Confirm usage and redistribution permissions with the repository owner.
