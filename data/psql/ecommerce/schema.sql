CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    category_description TEXT
);

CREATE TABLE product_categories (
    product_id INT REFERENCES products(product_id),
    category_id INT REFERENCES categories(category_id),
    PRIMARY KEY (product_id, category_id)
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(customer_id),
    order_date TIMESTAMP DEFAULT NOW(),
    total_amount DECIMAL(10, 2) NOT NULL,
    json_data JSON
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(order_id),
    product_id INT REFERENCES products(product_id),
    quantity INT NOT NULL,
    item_price DECIMAL(10, 2) NOT NULL
);


CREATE TABLE test_table (
    id SERIAL PRIMARY KEY,
    varchar_column VARCHAR(255),
    char_column CHAR(10),
    int_column INT,
    bigint_column BIGINT,
    smallint_column SMALLINT,
    numeric_column NUMERIC(10, 2),
    decimal_column DECIMAL(10, 2),
    real_column REAL,
    double_precision_column DOUBLE PRECISION,
    boolean_column BOOLEAN,
    date_column DATE,
    timestamp_column TIMESTAMP,
    time_column TIME,
    interval_column INTERVAL,
    bytea_column BYTEA,
    text_column TEXT,
    uuid_column UUID,
    json_column JSON,
    jsonb_column JSONB,
    xml_column XML
);
