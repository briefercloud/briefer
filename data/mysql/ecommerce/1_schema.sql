CREATE TABLE IF NOT EXISTS customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    product_id INT PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    category_description TEXT
);

CREATE TABLE IF NOT EXISTS product_categories (
    product_id INT NOT NULL REFERENCES products(product_id),
    category_id INT NOT NULL REFERENCES categories(category_id),
    PRIMARY KEY (product_id, category_id)
);

CREATE TABLE IF NOT EXISTS orders (
    order_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT REFERENCES customers(customer_id),
    order_date TIMESTAMP DEFAULT NOW(),
    total_amount DECIMAL(10, 2) NOT NULL,
    json_data JSON
);

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT REFERENCES orders(order_id),
    product_id INT REFERENCES products(product_id),
    quantity INT NOT NULL,
    item_price DECIMAL(10, 2) NOT NULL
);


CREATE TABLE test_table (
    id INT PRIMARY KEY AUTO_INCREMENT,
    col_bit BIT(8),
    col_tinyint TINYINT,
    col_smallint SMALLINT,
    col_mediumint MEDIUMINT,
    col_int INT,
    col_integer INTEGER,
    col_bigint BIGINT,
    col_decimal DECIMAL(10, 2),
    col_numeric NUMERIC(10, 2),
    col_float FLOAT(10, 2),
    col_double DOUBLE(10, 2),
    col_real REAL,
    col_boolean BOOLEAN,
    col_date DATE,
    col_datetime DATETIME,
    col_timestamp TIMESTAMP,
    col_time TIME,
    col_year YEAR,
    col_char CHAR(10),
    col_varchar VARCHAR(255),
    col_binary BINARY(10),
    col_varbinary VARBINARY(255),
    col_blob BLOB,
    col_tinyblob TINYBLOB,
    col_mediumblob MEDIUMBLOB,
    col_longblob LONGBLOB,
    col_text TEXT,
    col_tinytext TINYTEXT,
    col_mediumtext MEDIUMTEXT,
    col_longtext LONGTEXT,
    col_enum ENUM('value1', 'value2', 'value3'),
    col_set SET('option1', 'option2', 'option3'),
    col_json JSON,
    col_geometry GEOMETRY,
    col_point POINT,
    col_linestring LINESTRING,
    col_polygon POLYGON,
    col_multipoint MULTIPOINT,
    col_multilinestring MULTILINESTRING,
    col_multipolygon MULTIPOLYGON,
    col_geometrycollection GEOMETRYCOLLECTION
);
