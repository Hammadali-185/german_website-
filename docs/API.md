# API

Base URL in development: `http://localhost:4000/api`.

The browser calls `/api` on the Next.js app, which proxies to the backend. Mutations need the `x-csrf-token` header returned by `GET /api/auth/csrf`. The session cookie is httpOnly.

Prices sent by the browser are ignored. The server loads the current size, choice, and extra prices.

## Public

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products?category=&q=&offers=true&full=true`
- `GET /api/products/:id`
- `GET /api/offers`
- `GET /api/restaurant`
- `GET /api/restaurant/hours`
- `GET /api/legal/:page` where page is `impressum`, `agb`, `datenschutz`, or `allergene`
- `GET /api/delivery/areas`
- `POST /api/delivery/check` with `{ postalCode, locality?, subtotalCents? }`
- `GET /api/payments/methods`
- `POST /api/orders/quote`
- `POST /api/orders`
- `POST /api/contact`

Quote and order items look like:

```json
{
  "productId": "cuid",
  "variantId": "cuid",
  "quantity": 1,
  "choiceOptionIds": [],
  "extraIds": []
}
```

An order also needs `fulfillment` (`DELIVERY` or `PICKUP`), `customer`, `address`, `notes`, and `paymentMethod`. `CASH` creates an unpaid order. Other methods return 503 until credentials exist.

Orders are rejected outside the published Europe/Berlin hours, below the area minimum, or outside the delivery list.

## Account

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `GET /api/account/addresses`
- `POST /api/account/addresses`
- `DELETE /api/account/addresses/:id`
- `GET /api/orders/my-orders`
- `GET /api/orders/:id`

## Admin

All `/api/admin` routes require an `ADMIN` session.

- `GET /api/admin/stats`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id` with `{ status }`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `PATCH /api/admin/variants/:id/extras`
- `GET /api/admin/extras`
- `POST /api/admin/extras`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:id`
- `PATCH /api/admin/areas/:id`
- `PATCH /api/admin/hours/:id`
- `PATCH /api/admin/restaurant`
- `PATCH /api/admin/promotions/:slug`
- `GET /api/admin/messages`
