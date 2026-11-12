# Setup

The app is an npm workspace:

- `frontend` — Next.js storefront
- `backend` — Express API and Prisma
- `shared` — price, opening-hour, and delivery rules
- `data` — extracted restaurant content

Docker is not required to read the code. PostgreSQL is required to take orders. `docker-compose.yml` starts Postgres 16:

```bash
docker compose up -d
```

This machine did not have Docker or a local PostgreSQL server when the project was built. Install one of those, then:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm install
npm run db:generate --workspace backend
npm run migrate --workspace backend
npm run db:seed
```

Change `ADMIN_EMAIL` and `ADMIN_PASSWORD` before seeding a shared environment. The example password is only for local use.

## Commands

```bash
npm run dev:backend
npm run dev:frontend
npm test
npm run build
npm run extract
```

Frontend: http://localhost:3000  
API: http://localhost:4000

`npm run build` typechecks the API and builds the storefront. The storefront can render the extracted menu from `data/` when the API is offline. Saving an order, signing in, and the admin panel need the database.

## Production

Set real secrets in the environment. Use `SECURE_COOKIES=true` behind HTTPS. Point `CLIENT_ORIGIN` at the public site and `BACKEND_URL` at the API. Run `npx prisma migrate deploy` and `npm run db:seed` once. Start the API with `npm start --workspace backend` and the frontend with `npm start --workspace frontend`.

Cash on delivery and pickup creates a real unpaid order. PayPal, card, and Sofort stay unavailable until `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, or `SOFORT_API_KEY` are set. The API never marks those payments as paid.

## Still needs the restaurant

- Deals Mo–Fr could not be read. The category URL returns 403.
- No public email address.
- No published delivery fee. Fees stay empty until an admin enters them.
- Pickup minimum is stored as 0 because the old site shows 0,00 € before an area is chosen.
- Letter allergen codes are shown as printed. The allergen page does not define them.
- Drink Pfand stays in the description and is not added again.
- Angebot 1 describes a cheese crust at 4 €. The button price on the old popup is higher. Ordering uses the button price.
- Card, PayPal, and Sofort need merchant credentials.
- Holiday hours are stored, but no holiday calendar was published. An admin can switch holiday mode on for a day.
- The phone gift is shown because it is on the current homepage. It is not deducted in the cart.
- No verified reviews are shown.
