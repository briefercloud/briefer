-- Insert 5 categories
INSERT INTO categories (category_name, category_description) VALUES
    ('Electronics', 'Electronic products'),
    ('Tools', 'Various tools'),
    ('Widgets', 'Small widgets'),
    ('Clothing', 'Fashion items'),
    ('Books', 'Literary works');

-- Insert 20 random products
DO $$
BEGIN
    FOR i IN 1..20 LOOP
        INSERT INTO products (product_name, product_description, price, stock_quantity) VALUES
            ('Product ' || i, 'Description for Product ' || i, RANDOM() * 100, FLOOR(RANDOM() * 100));

        -- Assign a random category to each product
        INSERT INTO product_categories (product_id, category_id) VALUES
            (currval('products_product_id_seq'), 1 + FLOOR(RANDOM() * 5));
    END LOOP;
END $$;

-- Insert 50 random customers
DO $$
BEGIN
    FOR i IN 1..50 LOOP
        INSERT INTO customers (first_name, last_name, email, password_hash) VALUES
            ('Customer' || i, 'Lastname' || i, 'customer' || i || '@example.com', 'password' || i);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION random_json() RETURNS JSON AS $$
DECLARE
    json_template INT;
    result JSON;
    random_chance NUMERIC;
BEGIN
    -- Determine random chance to return NULL or specific JSON types
    random_chance := RANDOM();
    IF random_chance < 0.05 THEN  -- 5% chance to return NULL
        RETURN NULL;
    ELSIF random_chance < 0.1 THEN  -- 5% chance to return just a number
        RETURN to_json(RANDOM() * 100);
    ELSIF random_chance < 0.15 THEN  -- 5% chance to return just a string
        RETURN to_json('Just a string'::text);  -- Trick to convert text to JSON text
    ELSIF random_chance < 0.2 THEN  -- 5% chance to return just a boolean
        RETURN to_json(RANDOM() > 0.5);  -- Trick to convert boolean to JSON boolean
    END IF;

    -- Randomly choose a JSON structure template
    json_template := FLOOR(RANDOM() * 5) + 1;

    CASE json_template
        WHEN 1 THEN
            result := json_build_object(
                'simple_key', 'value',
                'random_number', RANDOM() * 100
            );
        WHEN 2 THEN
            result := json_build_array(
                RANDOM() * 100, 
                'Element', 
                NULL, 
                TRUE, 
                json_build_object('nested_key', FLOOR(RANDOM() * 100))
            );
        WHEN 3 THEN
            result := json_build_object(
                'array_of_objects', json_build_array(
                    json_build_object('id', FLOOR(RANDOM() * 10), 'value', RANDOM()),
                    json_build_object('id', FLOOR(RANDOM() * 10), 'value', RANDOM())
                ),
                'another_key', 'another_value'
            );
        WHEN 4 THEN
            result := '{"random":' || (RANDOM() * 100)::text || '}';
        WHEN 5 THEN
            result := json_build_object(
                'nested_structure', json_build_object(
                    'array', json_build_array(
                        1, 2, 3, 4, json_build_object(
                            'deep', 'deep_value', 
                            'deeper', json_build_array('deep_array_value', NULL)
                        )
                    ),
                    'boolean', (RANDOM() > 0.5)
                )
            );
    END CASE;

    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Insert 2000000 random orders
DO $$
BEGIN
    FOR i IN 1..2000000 LOOP
        -- randomized order date including the hours, minutes, seconds and milliseconds, for the last year
        INSERT INTO orders (customer_id, order_date, total_amount, json_data) VALUES
            (
              1 + FLOOR(RANDOM() * 50),
              NOW() - (RANDOM() * 365) * INTERVAL '1 day' +
                (RANDOM() * 24) * INTERVAL '1 hour' +
                (RANDOM() * 60) * INTERVAL '1 minute' +
                (RANDOM() * 60) * INTERVAL '1 second' +
                (RANDOM() * 1000) * INTERVAL '1 millisecond',
              RANDOM() * 500,
              random_json() -- Call the random_json function to generate random JSON data
            );

        -- Create order items for each order
        FOR j IN 1..FLOOR(RANDOM() * 5) + 1 LOOP
            INSERT INTO order_items (order_id, product_id, quantity, item_price) VALUES
                (currval('orders_order_id_seq'), 1 + FLOOR(RANDOM() * 20), FLOOR(RANDOM() * 5) + 1, RANDOM() * 100);
        END LOOP;
    END LOOP;
END $$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

INSERT INTO test_table (
    varchar_column,
    char_column,
    int_column,
    bigint_column,
    smallint_column,
    numeric_column,
    decimal_column,
    real_column,
    double_precision_column,
    boolean_column,
    date_column,
    timestamp_column,
    time_column,
    interval_column,
    bytea_column,
    text_column,
    uuid_column,
    json_column,
    jsonb_column,
    xml_column
)
SELECT
    CASE WHEN random() < 0.05 THEN NULL ELSE md5(random()::text) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE substr(md5(random()::text), 1, 10) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE floor(random() * 1000) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE floor(random() * 1000000000) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE floor(random() * 10000) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE random() * 1000 END,
    CASE WHEN random() < 0.05 THEN NULL ELSE random() * 1000 END,
    CASE WHEN random() < 0.05 THEN NULL ELSE random() * 1000 END,
    CASE WHEN random() < 0.05 THEN NULL ELSE random() * 1000 END,
    CASE WHEN random() < 0.05 THEN NULL ELSE random() < 0.5 END,
    CASE WHEN random() < 0.05 THEN NULL ELSE current_date - CAST(floor(random() * 1000) AS INTEGER) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE current_timestamp - CAST(floor(random() * 1000) AS INTEGER) * INTERVAL '1 day' END,
    CASE WHEN random() < 0.05 THEN NULL ELSE current_time - CAST(floor(random() * 1000) AS INTEGER) * INTERVAL '1 hour' END,
    CASE WHEN random() < 0.05 THEN NULL ELSE floor(random() * 1000) * INTERVAL '1 hour' END,
    CASE WHEN random() < 0.05 THEN NULL ELSE gen_random_bytes(8) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE md5(random()::text) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE uuid_generate_v4() END,
    CASE WHEN random() < 0.05 THEN NULL ELSE json_build_object('key', md5(random()::text)) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE jsonb_build_object('key', md5(random()::text)) END,
    CASE WHEN random() < 0.05 THEN NULL ELSE xmlparse(document '<root>' || md5(random()::text) || '</root>') END
FROM generate_series(1, 100000);
