CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  stock INTEGER NOT NULL CHECK(stock >= 0),
  category TEXT NOT NULL,
  image TEXT NOT NULL
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_sessions (
  token TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  total INTEGER NOT NULL CHECK(total >= 0),
  receipt_name TEXT NOT NULL,
  receipt_type TEXT NOT NULL,
  receipt_size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
  PRIMARY KEY (order_id, product_id)
);

-- Every order item reduces shared stock inside the same D1 batch. If any item
-- lacks stock, RAISE(ABORT) rolls back the entire order and all stock changes.
CREATE TRIGGER reduce_stock_before_order_item
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
  SELECT CASE WHEN COALESCE((SELECT stock >= NEW.quantity FROM products WHERE id = NEW.product_id), 0) = 0
    THEN RAISE(ABORT, 'Insufficient stock') END;
  UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
END;

CREATE INDEX orders_by_customer ON orders(customer_id, created_at DESC);

INSERT INTO products (id, name, price, stock, category, image) VALUES
  (1, 'Maxi Tea 1.2L', 610, 20, 'Drinks', 'product-images/product-1.png'),
  (2, 'Lay''s Chili Lime 140g', 1100, 18, 'Chips', 'product-images/product-2.png'),
  (3, 'Babyfox Chocolate', 300, 25, 'Chocolate & Sweets', 'product-images/product-3.png'),
  (4, 'Ozera Chocolate', 400, 22, 'Chocolate & Sweets', 'product-images/product-4.png'),
  (5, 'Snickers Bar', 350, 30, 'Chocolate & Sweets', 'product-images/product-5.jpg'),
  (6, 'Coca-Cola 0.5L', 450, 24, 'Drinks', 'product-images/product-6.jpg'),
  (7, 'Lay''s Sour Cream & Herbs 140g', 1100, 18, 'Chips', 'product-images/product-7.png'),
  (8, 'Tassay Water 0.5L', 200, 40, 'Drinks', 'product-images/product-8.png'),
  (10, 'Orbit Classic Mint', 250, 35, 'Other', 'product-images/product-10.jpg'),
  (11, 'Fanta Orange 0.5L', 450, 20, 'Drinks', 'product-images/product-11.png'),
  (12, 'Lipton Ice Tea 0.5L', 500, 18, 'Drinks', 'product-images/product-12.jpg'),
  (13, 'Lay''s Cheese 140g', 1100, 20, 'Chips', 'product-images/product-13.png'),
  (14, 'Lay''s Crab 140g', 1100, 20, 'Chips', 'product-images/product-14.webp'),
  (15, 'Kinder Bueno', 500, 24, 'Chocolate & Sweets', 'product-images/product-15.png'),
  (16, 'Джумка Wafer Bar', 300, 25, 'Chocolate & Sweets', 'product-images/product-16.png'),
  (17, 'Orbit Strawberry-Banana', 250, 30, 'Other', 'product-images/product-17.jpg'),
  (18, 'Orbit Sweet Mint', 250, 30, 'Other', 'product-images/product-18.png');
