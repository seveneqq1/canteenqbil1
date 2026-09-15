const SESSION_COOKIE = 'canteen_session';
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 90;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

        try {
            const { customerId, cookie } = await getCustomer(request, env.DB);
            let response;
            if (url.pathname === '/api/products' && request.method === 'GET') response = await products(env.DB);
            else if (url.pathname === '/api/orders' && request.method === 'GET') response = await orders(env.DB, customerId);
            else if (url.pathname === '/api/orders' && request.method === 'POST') response = await createOrder(request, env.DB, customerId);
            else response = json({ error: 'Not found.' }, 404);
            if (cookie) response.headers.append('Set-Cookie', cookie);
            return response;
        } catch (error) {
            console.error(error);
            return json({ error: error.message || 'Server error.' }, 500);
        }
    }
};

async function getCustomer(request, db) {
    const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)canteen_session=([^;]+)/)?.[1];
    if (token) {
        const session = await db.prepare('SELECT customer_id FROM customer_sessions WHERE token = ? AND expires_at > unixepoch()').bind(token).first();
        if (session) return { customerId: session.customer_id };
    }
    const customerId = crypto.randomUUID();
    const newToken = crypto.randomUUID() + crypto.randomUUID();
    await db.batch([
        db.prepare('INSERT INTO customers (id) VALUES (?)').bind(customerId),
        db.prepare('INSERT INTO customer_sessions (token, customer_id, expires_at) VALUES (?, ?, unixepoch() + ?)').bind(newToken, customerId, SESSION_AGE_SECONDS)
    ]);
    return { customerId, cookie: `${SESSION_COOKIE}=${newToken}; Max-Age=${SESSION_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax` };
}

async function products(db) {
    const { results } = await db.prepare('SELECT id, name, price, stock, category, image FROM products ORDER BY category, id').all();
    return json({ products: results });
}

async function orders(db, customerId) {
    const { results: orderRows } = await db.prepare('SELECT id, total, receipt_name, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC').bind(customerId).all();
    if (!orderRows.length) return json({ orders: [] });
    const { results: itemRows } = await db.prepare(`SELECT oi.order_id, oi.quantity, p.name FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id IN (${orderRows.map(() => '?').join(',')})`).bind(...orderRows.map(order => order.id)).all();
    const itemsByOrder = new Map(orderRows.map(order => [order.id, []]));
    itemRows.forEach(item => itemsByOrder.get(item.order_id).push({ name: item.name, quantity: item.quantity }));
    return json({ orders: orderRows.map(order => ({ id: order.id, total: order.total, receiptName: order.receipt_name, createdAt: order.created_at, items: itemsByOrder.get(order.id) })) });
}

async function createOrder(request, db, customerId) {
    const body = await request.json().catch(() => null);
    const items = body?.items;
    const receipt = body?.receipt;
    if (!Array.isArray(items) || !items.length || items.length > 30) return json({ error: 'Your cart is invalid.' }, 400);
    if (!receipt || typeof receipt.name !== 'string' || receipt.name.length > 255) return json({ error: 'Please attach a receipt.' }, 400);

    const requested = new Map();
    for (const item of items) {
        const id = Number(item.productId);
        const quantity = Number(item.quantity);
        if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return json({ error: 'Your cart contains an invalid quantity.' }, 400);
        requested.set(id, (requested.get(id) || 0) + quantity);
    }
    const ids = [...requested.keys()];
    const { results: productRows } = await db.prepare(`SELECT id, price FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    if (productRows.length !== ids.length) return json({ error: 'One of the products no longer exists.' }, 409);
    const prices = new Map(productRows.map(product => [product.id, product.price]));
    const total = [...requested].reduce((sum, [id, quantity]) => sum + prices.get(id) * quantity, 0);
    const orderId = crypto.randomUUID();

    try {
        await db.batch([
            db.prepare('INSERT INTO orders (id, customer_id, total, receipt_name, receipt_type, receipt_size) VALUES (?, ?, ?, ?, ?, ?)').bind(orderId, customerId, total, receipt.name, String(receipt.type || 'unknown').slice(0, 100), Math.max(0, Number(receipt.size) || 0)),
            ...[...requested].map(([productId, quantity]) => db.prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').bind(orderId, productId, quantity, prices.get(productId)))
        ]);
    } catch (error) {
        if (String(error.message).includes('Insufficient stock')) return json({ error: 'An item just sold out. Please review your cart.' }, 409);
        throw error;
    }
    return json({ orderId }, 201);
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' } });
}
