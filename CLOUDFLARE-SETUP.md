# Deploy the shared-inventory canteen

This version is a Cloudflare Worker with D1, not a static Pages site. D1 holds one shared inventory for every browser. Each browser receives a private, secure session cookie; the history endpoint only returns orders attached to that cookie.

## One-time Cloudflare setup

1. Install Node.js 20+ and sign in to Cloudflare:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. In this folder, create the database:
   ```bash
   wrangler d1 create canteenqbil1
   ```
3. Copy the `database_id` printed by that command into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. Create the tables and initial menu stock:
   ```bash
   wrangler d1 migrations apply canteenqbil1 --remote
   ```
5. Deploy the site and API together:
   ```bash
   wrangler deploy
   ```

Open the Workers URL that Wrangler prints. Do not deploy this version as GitHub Pages or Cloudflare Pages: static hosting cannot run the `/api` endpoints.

## Important behaviour

- Stock is shared and refreshes every 20 seconds (also immediately after an order).
- D1 atomically reserves stock only once the customer confirms an order. It rejects the entire order if even one product is sold out.
- Order history is private to the browser session. Clearing browser cookies creates a new history; a customer cannot transfer this history to another device.
- The receipt currently stores its filename/type/size, just like the old site. It does **not** upload the receipt image. Add Cloudflare R2 plus customer login if you need staff review, multi-device customer history, or stronger identity verification.

## Changing menu stock later

Use the D1 console or Wrangler, for example:
```bash
wrangler d1 execute canteenqbil1 --remote --command "UPDATE products SET stock = 25 WHERE id = 1"
```
