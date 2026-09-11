const DATABASE_KEY = 'bil-canteen-database-v1';
let database = { products: [], purchases: [] };
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

async function loadDatabase() {
    const savedDatabase = localStorage.getItem(DATABASE_KEY);
    if (savedDatabase) {
        database = JSON.parse(savedDatabase);
        return;
    }

    try {
        const response = await fetch('database.json');
        if (!response.ok) throw new Error('Could not load database.json');
        database = await response.json();
    } catch (error) {
        console.warn(error);
        database = { products: [], purchases: [] };
    }
    saveDatabase();
}

function saveDatabase() {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(database));
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
    productList.innerHTML = database.products.map(product => {
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
    }).join('');
}

function syncProductButtons() {
    document.querySelectorAll('[data-add-product]').forEach(button => {
        const productId = Number(button.dataset.addProduct);
        const product = database.products.find(item => item.id === productId);
        const hasReachedCartLimit = cartQuantity(productId) >= product.stock;
        button.disabled = hasReachedCartLimit;
        button.textContent = product.stock === 0 ? 'Sold out' : hasReachedCartLimit ? 'Maximum in cart' : 'Add to Cart';
    });
}

function renderHistory() {
    const history = document.getElementById('purchase-history');
    const count = document.getElementById('history-count');
    const purchases = database.purchases || [];
    count.textContent = purchases.length ? `${purchases.length} recorded purchase${purchases.length === 1 ? '' : 's'}.` : 'No purchases yet.';

    if (!purchases.length) {
        history.innerHTML = '<p class="empty-history">Confirmed Kaspi orders will appear here.</p>';
        return;
    }

    history.innerHTML = [...purchases].reverse().map(purchase => {
        const time = new Date(purchase.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
        const items = purchase.items.map(item => `${escapeHtml(item.name)} × ${item.quantity}`).join(', ');
        return `
            <article class="history-card">
                <h3>Order #${purchase.id} · ${formatMoney(purchase.total)} ₸</h3>
                <p>${items}</p>
                <p>${time} · Receipt: ${escapeHtml(purchase.receipt.name)}</p>
            </article>`;
    }).join('');
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
        const cannotIncrease = item.quantity >= window.getCurrentStock(item.productId);
        return `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${escapeHtml(item.name)}</h4>
                <p>${formatMoney(item.price)} ₸ each</p>
                <span class="cart-quantity">${item.quantity} of ${item.stockAtAdd} available</span>
            </div>
            <div class="item-controls">
                <button class="quantity-btn" type="button" aria-label="Remove one ${escapeHtml(item.name)}" onclick="changeQuantity(${item.productId}, -1)">−</button>
                <strong>${item.quantity}</strong>
                <button class="quantity-btn" type="button" aria-label="Add one ${escapeHtml(item.name)}" onclick="changeQuantity(${item.productId}, 1)" ${cannotIncrease ? 'disabled' : ''}>+</button>
            </div>
        </div>`;
    }).join('');
    payBtn.disabled = false;
    syncProductButtons();
}

window.getCurrentStock = productId => database.products.find(product => product.id === productId)?.stock || 0;

window.addToCart = function (productId) {
    const product = database.products.find(item => item.id === productId);
    if (!product || cartQuantity(productId) >= product.stock) return;

    const existingItem = productInCart(productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ productId, name: product.name, price: product.price, quantity: 1, stockAtAdd: product.stock });
    }
    updateCart();
};

window.changeQuantity = function (productId, adjustment) {
    const item = productInCart(productId);
    if (!item) return;
    const stock = window.getCurrentStock(productId);
    const nextQuantity = item.quantity + adjustment;
    if (nextQuantity <= 0) cart = cart.filter(cartItem => cartItem.productId !== productId);
    else if (nextQuantity <= stock) item.quantity = nextQuantity;
    updateCart();
};

function setupTabs() {
    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(item => item.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.target).classList.add('active');
            if (button.dataset.target === 'history-tab') {
                renderHistory();
            }
        });
    });
}

function resetReceipt() {
    attachedReceipt = null;
    receiptUpload.value = '';
    receiptStatus.textContent = 'No receipt attached.';
    confirmPaymentBtn.disabled = true;
}

function setupModal() {
    payBtn.addEventListener('click', () => {
        resetReceipt();
        modal.classList.add('active');
    });

    receiptUpload.addEventListener('change', () => {
        const file = receiptUpload.files[0];
        if (!file) return resetReceipt();
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            receiptStatus.textContent = 'Please select a receipt smaller than 10 MB.';
            receiptUpload.value = '';
            return;
        }
        attachedReceipt = { name: file.name, type: file.type || 'unknown', size: file.size };
        receiptStatus.textContent = `Attached: ${file.name}`;
        confirmPaymentBtn.disabled = false;
    });

    document.getElementById('close-modal').addEventListener('click', () => modal.classList.remove('active'));
    confirmPaymentBtn.addEventListener('click', confirmPayment);
}

function confirmPayment() {
    if (!attachedReceipt || !cart.length) return;

    for (const item of cart) {
        const product = database.products.find(product => product.id === item.productId);
        if (!product || product.stock < item.quantity) {
            alert(`${item.name} no longer has enough stock. Please update your cart.`);
            modal.classList.remove('active');
            updateCart();
            return;
        }
    }

    const purchase = {
        id: String(Date.now()).slice(-8),
        createdAt: new Date().toISOString(),
        total: cartTotal(),
        items: cart.map(({ productId, name, price, quantity }) => ({ productId, name, price, quantity })),
        receipt: attachedReceipt
    };
    cart.forEach(item => {
        const product = database.products.find(product => product.id === item.productId);
        product.stock -= item.quantity;
    });
    database.purchases = database.purchases || [];
    database.purchases.push(purchase);
    saveDatabase();
    cart = [];
    modal.classList.remove('active');
    // Stock is changed only here, after receipt attachment and payment confirmation.
    renderProducts();
    updateCart();
    renderHistory();
    alert('Payment recorded. Thank you for your order!');
}

function setupReset() {
    document.getElementById('reset-database').addEventListener('click', async () => {
        if (!confirm('Reset stock and delete all saved purchase history on this device?')) return;
        localStorage.removeItem(DATABASE_KEY);
        cart = [];
        await loadDatabase();
        renderProducts();
        updateCart();
        renderHistory();
    });
}

async function init() {
    await loadDatabase();
    renderProducts();
    updateCart();
    renderHistory();
    setupTabs();
    setupModal();
    setupReset();
}

init();
