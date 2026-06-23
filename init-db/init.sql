-- Create Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Query History table
CREATE TABLE IF NOT EXISTS query_history (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    generated_sql TEXT,
    status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'invalid'
    error_message TEXT,
    chart_type VARCHAR(20), -- 'bar', 'line', 'pie', 'table'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Analytics Tables (Sandbox)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    city VARCHAR(100) NOT NULL,
    join_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    sale_date DATE NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL
);

-- Insert Sample Products
INSERT INTO products (name, category, price, stock) VALUES
('Quantum Laptop', 'Electronics', 1299.99, 45),
('Nebula Smartphone', 'Electronics', 799.99, 120),
('Acoustic Pro Headphones', 'Electronics', 199.99, 85),
('Ergonomic Mesh Chair', 'Furniture', 249.99, 30),
('Solid Oak Dining Table', 'Furniture', 599.99, 10),
('Bamboo Standing Desk', 'Furniture', 449.99, 15),
('Thermal Water Bottle', 'Accessories', 34.99, 250),
('Leather Messenger Bag', 'Accessories', 129.99, 60),
('Smart Fitness Band', 'Electronics', 79.99, 150),
('Memory Foam Pillow', 'Furniture', 49.99, 90),
('Wireless Charger Stand', 'Electronics', 29.99, 200),
('Canvas Backpack', 'Accessories', 59.99, 110);

-- Insert Sample Customers
INSERT INTO customers (name, email, city, join_date) VALUES
('Alice Johnson', 'alice@example.com', 'New York', '2025-01-15'),
('Bob Smith', 'bob@example.com', 'San Francisco', '2025-02-10'),
('Charlie Brown', 'charlie@example.com', 'Chicago', '2025-02-22'),
('Diana Prince', 'diana@example.com', 'Seattle', '2025-03-05'),
('Evan Wright', 'evan@example.com', 'Austin', '2025-03-12'),
('Fiona Gallagher', 'fiona@example.com', 'Boston', '2025-04-01'),
('George Costanza', 'george@example.com', 'New York', '2025-04-18'),
('Hannah Abbott', 'hannah@example.com', 'Denver', '2025-04-29'),
('Ian Malcolm', 'ian@example.com', 'Austin', '2025-05-02'),
('Julia Roberts', 'julia@example.com', 'Los Angeles', '2025-05-15');

-- Insert Sample Sales (representing transactions over early 2026 / late 2025)
INSERT INTO sales (product_id, customer_id, quantity, sale_date, total_amount) VALUES
(1, 1, 1, '2026-01-05', 1299.99),
(3, 1, 2, '2026-01-06', 399.98),
(7, 2, 3, '2026-01-10', 104.97),
(2, 3, 1, '2026-01-15', 799.99),
(4, 4, 2, '2026-01-20', 499.98),
(8, 5, 1, '2026-01-25', 129.99),
(9, 6, 2, '2026-02-02', 159.98),
(10, 7, 1, '2026-02-05', 49.99),
(6, 8, 1, '2026-02-08', 449.99),
(11, 9, 2, '2026-02-12', 59.98),
(1, 10, 1, '2026-02-15', 1299.99),
(2, 1, 1, '2026-02-20', 799.99),
(3, 2, 1, '2026-02-25', 199.99),
(4, 3, 1, '2026-03-01', 249.99),
(5, 4, 1, '2026-03-05', 599.99),
(7, 5, 4, '2026-03-10', 139.96),
(8, 6, 1, '2026-03-15', 129.99),
(12, 7, 2, '2026-03-20', 119.98),
(9, 8, 1, '2026-03-25', 79.99),
(10, 9, 2, '2026-04-02', 99.98),
(1, 2, 1, '2026-04-05', 1299.99),
(2, 4, 1, '2026-04-08', 799.99),
(3, 6, 2, '2026-04-12', 399.98),
(8, 8, 1, '2026-04-15', 129.99),
(11, 10, 3, '2026-04-20', 89.97),
(4, 1, 1, '2026-04-25', 249.99),
(6, 3, 1, '2026-05-02', 449.99),
(7, 5, 2, '2026-05-05', 69.98),
(9, 7, 3, '2026-05-08', 239.97),
(5, 9, 1, '2026-05-12', 599.99),
(12, 2, 1, '2026-05-15', 59.99),
(1, 3, 1, '2026-05-20', 1299.99),
(2, 5, 1, '2026-05-25', 799.99),
(3, 7, 1, '2026-06-01', 199.99),
(8, 9, 2, '2026-06-03', 259.98),
(10, 1, 2, '2026-06-05', 99.98),
(7, 10, 5, '2026-06-06', 174.95);

-- Create User DB Connections configuration table
CREATE TABLE IF NOT EXISTS db_connections (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    engine VARCHAR(20) NOT NULL, -- 'postgres', 'mysql', 'sqlite'
    connection_data TEXT NOT NULL, -- AES-256-GCM encrypted JSON parameters
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Query Audit Logs table for Enterprise Analytics
CREATE TABLE IF NOT EXISTS query_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    connection_id INT REFERENCES db_connections(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    generated_sql TEXT,
    status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'invalid'
    execution_time_ms INT,
    chart_type VARCHAR(20),
    explanation TEXT,
    confidence DECIMAL(3, 2),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

