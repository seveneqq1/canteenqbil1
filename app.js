let database = { products: [] };
let cart = [];
let attachedReceipt = null;

const productList = document.getElementById('product-list');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const cartBadge = document.getElementById('cart-badge');
const payBtn = document.getElementById('pay-btn');
const modal = document.getElementById('payment-modal');
const modalTotal = document.getElementById('modal-total');
const receiptUpload = document.getElementById('receipt-upload');
const receiptStatus = document.getElementById('receipt-status');
const confirmPaymentBtn = document.getElementById('confirm-payment');

function formatMoney(value) {
    return new Intl.NumberFormat('ru-RU').format(value);
}

function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = value;
    return element.innerHTML;
}

async function api(path, options) {
    const response = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
        ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
}

async function loadProducts() {
    const data = await api('/api/products');
    database.products = data.products;
    renderProducts();
    updateCart();
}

function productInCart(productId) {
    return cart.find(item => item.productId === productId);
}

function cartQuantity(productId) {
    return productInCart(productId)?.quantity || 0;
}

function cartTotal() {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
}

function renderProducts() {
    const productsByCategory = database.products.reduce((groups, product) => {
        (groups[product.category || 'Other'] ||= []).push(product);
        return groups;
    }, {});

    productList.innerHTML = Object.entries(productsByCategory).map(([category, products]) => `
        <section class="category-section" aria-label="${escapeHtml(category)}">
            <h2 class="category-title">${escapeHtml(category)}</h2>
            <div class="category-grid">
                ${products.map(product => {
                    const isSoldOut = product.stock === 0;
                    const stockClass = product.stock <= 5 ? 'low-stock' : '';
                    return `
            <article class="product-card" data-product-id="${product.id}">
                <img class="product-image" src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy">
                <div>
                    <div class="product-name">${escapeHtml(product.name)}</div>
                    <div class="product-price">${formatMoney(product.price)} ₸</div>
                    <div class="stock-label ${stockClass}">${isSoldOut ? 'Out of stock' : `${product.stock} in stock`}</div>
                </div>
                <button class="add-btn" type="button" data-add-product="${product.id}" onclick="addToCart(${product.id})" ${isSoldOut ? 'disabled' : ''}>
                    ${isSoldOut ? 'Sold out' : 'Add to Cart'}
                </button>
            </article>`;
                }).join('')}
            </div>
        </section>`).join('');
}

function syncProductButtons() {
    document.querySelectorAll('[data-add-product]').forEach(button => {
        const productId = Number(button.dataset.addProduct);
        const product = database.products.find(item => item.id === productId);
        if (!product) return;
        const hasReachedCartLimit = cartQuantity(productId) >= product.stock;
        button.disabled = hasReachedCartLimit;
        button.textContent = product.stock === 0 ? 'Sold out' : hasReachedCartLimit ? 'Maximum in cart' : 'Add to Cart';
    });
}

async function renderHistory() {
    const history = document.getElementById('purchase-history');
    const count = document.getElementById('history-count');
    history.innerHTML = '<p class="empty-history">Loading your orders…</p>';
    try {
        const { orders } = await api('/api/orders');
        count.textContent = orders.length ? `${orders.length} recorded purchase${orders.length === 1 ? '' : 's'}.` : 'No purchases yet.';
        history.innerHTML = orders.length ? orders.map(order => {
            const time = new Date(order.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
            const items = order.items.map(item => `${escapeHtml(item.name)} × ${item.quantity}`).join(', ');
            return `<article class="history-card">
                <h3>Order #${escapeHtml(order.id.slice(0, 8))} · ${formatMoney(order.total)} ₸</h3>
                <p>${items}</p>
                <p>${time} · Receipt: ${escapeHtml(order.receiptName)}</p>
            </article>`;
        }).join('') : '<p class="empty-history">Confirmed Kaspi orders will appear here.</p>';
    } catch (error) {
        count.textContent = 'Could not load your history.';
        history.innerHTML = `<p class="empty-history">${escapeHtml(error.message)}</p>`;
    }
}

function updateCart() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartBadge.textContent = totalItems;
    cartTotalElement.textContent = formatMoney(cartTotal());
    modalTotal.textContent = formatMoney(cartTotal());
    if (!cart.length) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
        payBtn.disabled = true;
        syncProductButtons();
        return;
    }
    cartItemsContainer.innerHTML = cart.map(item => {
        const cannotIncrease = item.quantity >= getCurrentStock(item.productId);
        return `<div class="cart-item"><div class="cart-item-info"><h4>${escapeHtml(item.name)}</h4><p>${formatMoney(item.price)} ₸ each</p><span class="cart-quantity">${item.quantity} selected</span></div><div class="item-controls"><button class="quantity-btn" type="button" onclick="changeQuantity(${item.productId}, -1)">−</button><strong>${item.quantity}</strong><button class="quantity-btn" type="button" onclick="changeQuantity(${item.productId}, 1)" ${cannotIncrease ? 'disabled' : ''}>+</button></div></div>`;
    }).join('');
    payBtn.disabled = false;
    syncProductButtons();
}

function getCurrentStock(productId) {
    return database.products.find(product => product.id === productId)?.stock || 0;
}

window.addToCart = productId => {
    const product = database.products.find(item => item.id === productId);
    if (!product || cartQuantity(productId) >= product.stock) return;
    const existingItem = productInCart(productId);
    if (existingItem) existingItem.quantity += 1;
    else cart.push({ productId, name: product.name, price: product.price, quantity: 1 });
    updateCart();
};

window.changeQuantity = (productId, adjustment) => {
    const item = productInCart(productId);
    if (!item) return;
    const nextQuantity = item.quantity + adjustment;
    if (nextQuantity <= 0) cart = cart.filter(cartItem => cartItem.productId !== productId);
    else if (nextQuantity <= getCurrentStock(productId)) item.quantity = nextQuantity;
    updateCart();
};

function setupTabs() {
    document.querySelectorAll('.nav-btn').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.target).classList.add('active');
        if (button.dataset.target === 'history-tab') renderHistory();
    }));
}

function resetReceipt() {
    attachedReceipt = null;
    receiptUpload.value = '';
    receiptStatus.textContent = 'No receipt attached.';
    confirmPaymentBtn.disabled = true;
}

function setupModal() {
    payBtn.addEventListener('click', () => { resetReceipt(); modal.classList.add('active'); });
    receiptUpload.addEventListener('change', () => {
        const file = receiptUpload.files[0];
        if (!file) return resetReceipt();
        if (file.size > 10 * 1024 * 1024) { receiptStatus.textContent = 'Please select a receipt smaller than 10 MB.'; receiptUpload.value = ''; return; }
        attachedReceipt = { name: file.name, type: file.type || 'unknown', size: file.size };
        receiptStatus.textContent = `Attached: ${file.name}`;
        confirmPaymentBtn.disabled = false;
    });
    document.getElementById('close-modal').addEventListener('click', () => modal.classList.remove('active'));
    confirmPaymentBtn.addEventListener('click', confirmPayment);
}

async function confirmPayment() {
    if (!attachedReceipt || !cart.length) return;
    confirmPaymentBtn.disabled = true;
    try {
        await api('/api/orders', { method: 'POST', body: JSON.stringify({ items: cart.map(({ productId, quantity }) => ({ productId, quantity })), receipt: attachedReceipt }) });
        cart = [];
        modal.classList.remove('active');
        await loadProducts();
        await renderHistory();
        alert('Payment submitted. Thank you for your order!');
    } catch (error) {
        alert(`${error.message} Stock has been refreshed.`);
        await loadProducts();
        updateCart();
    } finally {
        confirmPaymentBtn.disabled = false;
    }
}

async function init() {
    try { await loadProducts(); } catch (error) { productList.innerHTML = `<p class="empty-history">${escapeHtml(error.message)}</p>`; }
    setupTabs();
    setupModal();
    setInterval(() => loadProducts().catch(() => {}), 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadProducts().catch(() => {}); });
}

init();
