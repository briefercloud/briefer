const fs = require('fs')
const path = require('path')

// Function to generate random integer within a range
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Function to generate random decimal within a range
function getRandomDecimal(min, max, decimals) {
  const rand = Math.random() * (max - min) + min
  const power = Math.pow(10, decimals)
  return Math.floor(rand * power) / power
}

// Function to generate random timestamp within a range
function getRandomTimestamp(startDate, endDate) {
  const start = startDate.getTime()
  const end = endDate.getTime()
  const randomDate = new Date(start + Math.random() * (end - start))
  return randomDate.toISOString().slice(0, 19).replace('T', ' ')
}

// Function to generate random JSON data
function generateRandomJSON() {
  const randomChance = Math.random()
  if (randomChance < 0.05) {
    return 'NULL'
  } else if (randomChance < 0.1) {
    return `JSON_OBJECT('random_number', ${getRandomDecimal(0, 100, 2)})`
  } else if (randomChance < 0.15) {
    return `JSON_OBJECT('just_a_string', 'Just a string')`
  } else if (randomChance < 0.2) {
    return `JSON_OBJECT('just_a_boolean', ${Math.random() > 0.5})`
  } else {
    const jsonTemplates = [
      `JSON_OBJECT('simple_key', 'value', 'random_number', ${getRandomDecimal(0, 100, 2)})`,
      `JSON_ARRAY(${getRandomDecimal(0, 100, 2)}, 'Element', NULL, TRUE, JSON_OBJECT('nested_key', ${getRandomInt(0, 100)}))`,
      `JSON_OBJECT('array_of_objects', JSON_ARRAY(JSON_OBJECT('id', ${getRandomInt(0, 10)}, 'value', ${Math.random()}), JSON_OBJECT('id', ${getRandomInt(0, 10)}, 'value', ${Math.random()})), 'another_key', 'another_value')`,
      `JSON_OBJECT('random_value', '${getRandomDecimal(0, 100, 2)}')`,
      `JSON_OBJECT('nested_structure', JSON_OBJECT('array', JSON_ARRAY(1, 2, 3, 4, JSON_OBJECT('deep', 'deep_value', 'deeper', JSON_ARRAY('deep_array_value', NULL))), 'boolean', ${Math.random() > 0.5}))`,
    ]
    const randomTemplate =
      jsonTemplates[getRandomInt(0, jsonTemplates.length - 1)]
    return randomTemplate
  }
}

// Function to generate a random value for the test_table_all_types table
function generateTestTableAllTypesValues(index) {
  const bitVal = Math.random() > 0.5
  const tinyIntVal = getRandomInt(-128, 127)
  const smallIntVal = getRandomInt(-32768, 32767)
  const mediumIntVal = getRandomInt(-8388608, 8388607)
  const intVal = getRandomInt(-2147483648, 2147483647)
  const integerVal = getRandomInt(-2147483648, 2147483647)
  const bigIntVal = `${getRandomInt(-2147483648, 2147483647)}${getRandomInt(
    -128,
    127
  )}`
  const floatVal1 = getRandomDecimal(0, 100, 2)
  const floatVal2 = getRandomDecimal(0, 100, 2)
  const floatVal3 = getRandomDecimal(0, 100, 2)
  const floatVal4 = getRandomDecimal(0, 100, 2)
  const floatVal5 = getRandomDecimal(0, 100, 2)
  const booleanVal = Math.random() > 0.5
  const dateVal = getRandomTimestamp(new Date(2020, 0, 1), new Date())
  const datetimeVal = getRandomTimestamp(new Date(2020, 0, 1), new Date())
  const timestampVal = getRandomTimestamp(new Date(2020, 0, 1), new Date())
  const timeVal = `${getRandomInt(0, 23)}:${getRandomInt(0, 59)}:${getRandomInt(
    0,
    59
  )}`
  const yearVal = getRandomInt(1901, 2155)
  const stringVal1 = String.fromCharCode(65 + getRandomInt(0, 25))
  const stringVal2 = `varchar_${index.toString().padStart(5, '0')}`
  const binaryVal = `UNHEX(SUBSTRING(MD5(RAND()), 1, 10))`
  const varbinaryVal = `UNHEX(SUBSTRING(MD5(RAND()), 1, 10))`
  const blobVal = `UNHEX(SUBSTRING(MD5(RAND()), 1, 10))`
  const tinyblobVal = `UNHEX(SUBSTRING(MD5(RAND()), 1, 10))`
  const mediumblobVal = `UNHEX(SUBSTRING(MD5(RAND()), 1, 10))`
  const longblobVal = `UNHEX(SUBSTRING(MD5(RAND()), 1, 10))`
  const textVal = `'text_${index.toString().padStart(5, '0')}'`
  const tinytextVal = `'tinytext_${index.toString().padStart(5, '0')}'`
  const mediumtextVal = `'mediumtext_${index.toString().padStart(5, '0')}'`
  const longtextVal = `'longtext_${index.toString().padStart(5, '0')}'`
  const enumVal = `'value${getRandomInt(1, 3)}'`
  const setVal = `'option${getRandomInt(1, 3)}'`
  const jsonVal = generateRandomJSON()

  return `${bitVal}, ${tinyIntVal}, ${smallIntVal}, ${mediumIntVal}, ${intVal}, ${integerVal}, ${bigIntVal}, ${floatVal1}, ${floatVal2}, ${floatVal3}, ${floatVal4}, ${floatVal5}, ${booleanVal}, '${dateVal}', '${datetimeVal}', '${timestampVal}', '${timeVal}', '${yearVal}', '${stringVal1}', '${stringVal2}', ${binaryVal}, ${varbinaryVal}, ${blobVal}, ${tinyblobVal}, ${mediumblobVal}, ${longblobVal}, ${textVal}, ${tinytextVal}, ${mediumtextVal}, ${longtextVal}, ${enumVal}, ${setVal}, ${jsonVal}`
}

// Function to generate inserts for a table and append to a file
function generateInserts(
  fileName,
  tableName,
  columns,
  numInserts,
  generateValues
) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(fileName, { flags: 'a' })
    stream.on('error', reject)
    stream.on('finish', resolve)

    stream.write(`DELETE FROM ${tableName};\n`)

    for (let i = 1; i <= numInserts; i++) {
      const values = generateValues(i)
      const insertStatement = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});\n`
      stream.write(insertStatement)
    }
    stream.end()
    console.log(
      `Generated ${numInserts} INSERT statements for table ${tableName}`
    )
  })
}

const filePath = path.join(__dirname, '2_seed.sql')

// Delete existing 2_seed.sql if it exists
try {
  fs.unlinkSync(filePath)
  console.log('Deleted existing 2_seed.sql')
} catch {}

// Define number of inserts to generate
const NUM_CATEGORIES = 5
const NUM_PRODUCTS = 20
const NUM_CUSTOMERS = 50
const NUM_ORDERS = 200000
const NUM_TEST_DATA = 1000000

// Generate inserts for categories
generateInserts(
  filePath,
  'categories',
  ['category_name', 'category_description'],
  NUM_CATEGORIES,
  () =>
    `'Category ${getRandomInt(
      1,
      NUM_CATEGORIES
    )}', 'Description for Category ${getRandomInt(1, NUM_CATEGORIES)}'`
)
  .then(() =>
    generateInserts(
      filePath,
      'products',
      ['product_name', 'product_description', 'price', 'stock_quantity'],
      NUM_PRODUCTS,
      (i) =>
        `'Product ${i}', 'Description for Product ${i}', ${getRandomDecimal(
          1,
          100,
          2
        )}, ${getRandomInt(1, 100)}`
    )
  )
  .then(() =>
    generateInserts(
      filePath,
      'customers',
      ['first_name', 'last_name', 'email', 'password_hash'],
      NUM_CUSTOMERS,
      (i) =>
        `'Customer ${i}', 'Lastname ${i}', 'customer${i}@example.com', 'password${i}'`
    )
  )
  .then(() =>
    generateInserts(
      filePath,
      'orders',
      ['customer_id', 'order_date', 'total_amount', 'json_data'],
      NUM_ORDERS,
      () =>
        `${getRandomInt(1, NUM_CUSTOMERS)}, '${getRandomTimestamp(
          new Date(2020, 0, 1),
          new Date()
        )}', ${getRandomDecimal(1, 500, 2)}, ${generateRandomJSON()}`
    )
  )
  .then(() =>
    generateInserts(
      filePath,
      'test_table',
      [
        'col_bit',
        'col_tinyint',
        'col_smallint',
        'col_mediumint',
        'col_int',
        'col_integer',
        'col_bigint',
        'col_decimal',
        'col_numeric',
        'col_float',
        'col_double',
        'col_real',
        'col_boolean',
        'col_date',
        'col_datetime',
        'col_timestamp',
        'col_time',
        'col_year',
        'col_char',
        'col_varchar',
        'col_binary',
        'col_varbinary',
        'col_blob',
        'col_tinyblob',
        'col_mediumblob',
        'col_longblob',
        'col_text',
        'col_tinytext',
        'col_mediumtext',
        'col_longtext',
        'col_enum',
        'col_set',
        'col_json',
      ],
      NUM_TEST_DATA,
      (i) => generateTestTableAllTypesValues(i)
    )
  )
  .then(() => console.log('Seed generation completed successfully.'))
  .catch((err) => console.error('Error generating seed data:', err))
