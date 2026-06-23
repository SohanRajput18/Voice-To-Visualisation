import { SqlValidator } from '../utils/sql-validator';
import { DiscoveredTable } from '../services/db-adapter';

interface TestCase {
  name: string;
  sql: string;
  expectedValid: boolean;
}

const mockSchema: DiscoveredTable[] = [
  {
    name: 'sales',
    columns: [
      { name: 'id', dataType: 'integer', isPrimaryKey: true, isForeignKey: false },
      { name: 'product_id', dataType: 'integer', isPrimaryKey: false, isForeignKey: true, referencedTable: 'products', referencedColumn: 'id' },
      { name: 'customer_id', dataType: 'integer', isPrimaryKey: false, isForeignKey: true, referencedTable: 'customers', referencedColumn: 'id' },
      { name: 'quantity', dataType: 'integer', isPrimaryKey: false, isForeignKey: false },
      { name: 'sale_date', dataType: 'date', isPrimaryKey: false, isForeignKey: false },
      { name: 'total_amount', dataType: 'numeric', isPrimaryKey: false, isForeignKey: false }
    ]
  },
  {
    name: 'products',
    columns: [
      { name: 'id', dataType: 'integer', isPrimaryKey: true, isForeignKey: false },
      { name: 'name', dataType: 'varchar', isPrimaryKey: false, isForeignKey: false },
      { name: 'category', dataType: 'varchar', isPrimaryKey: false, isForeignKey: false },
      { name: 'price', dataType: 'numeric', isPrimaryKey: false, isForeignKey: false },
      { name: 'stock', dataType: 'integer', isPrimaryKey: false, isForeignKey: false }
    ]
  },
  {
    name: 'customers',
    columns: [
      { name: 'id', dataType: 'integer', isPrimaryKey: true, isForeignKey: false },
      { name: 'name', dataType: 'varchar', isPrimaryKey: false, isForeignKey: false },
      { name: 'email', dataType: 'varchar', isPrimaryKey: false, isForeignKey: false },
      { name: 'city', dataType: 'varchar', isPrimaryKey: false, isForeignKey: false },
      { name: 'join_date', dataType: 'date', isPrimaryKey: false, isForeignKey: false }
    ]
  }
];

const testCases: TestCase[] = [
  {
    name: 'Simple valid SELECT',
    sql: 'SELECT * FROM sales',
    expectedValid: true
  },
  {
    name: 'Valid SELECT with JOIN and alias',
    sql: 'SELECT s.total_amount, p.name FROM sales s JOIN products p ON s.product_id = p.id',
    expectedValid: true
  },
  {
    name: 'Valid SELECT with CTE and Group By',
    sql: 'WITH category_sales AS (SELECT category, sum(price) FROM products GROUP BY category) SELECT * FROM category_sales',
    expectedValid: true
  },
  {
    name: 'Invalid: Destructive DELETE query',
    sql: 'DELETE FROM sales',
    expectedValid: false
  },
  {
    name: 'Invalid: DROP TABLE query',
    sql: 'DROP TABLE sales',
    expectedValid: false
  },
  {
    name: 'Invalid: Semicolon injection/multiple statements',
    sql: 'SELECT * FROM sales; DROP TABLE products;',
    expectedValid: false
  },
  {
    name: 'Invalid: Accessing forbidden system catalogs',
    sql: 'SELECT * FROM pg_user',
    expectedValid: false
  },
  {
    name: 'Invalid: Accessing non-whitelisted user table',
    sql: 'SELECT * FROM users',
    expectedValid: false
  },
  {
    name: 'Valid SELECT with subquery',
    sql: 'SELECT name, price FROM products WHERE id IN (SELECT product_id FROM sales)',
    expectedValid: true
  }
];

function runTests() {
  console.log('Running SQL Validator Tests...\n');
  let passedCount = 0;

  for (const tc of testCases) {
    const res = SqlValidator.validate(tc.sql, mockSchema);
    const passed = res.isValid === tc.expectedValid;
    
    if (passed) {
      passedCount++;
      console.log(`✅ [PASS] ${tc.name}`);
    } else {
      console.log(`❌ [FAIL] ${tc.name}`);
      console.log(`   SQL:      ${tc.sql}`);
      console.log(`   Expected: ${tc.expectedValid ? 'VALID' : 'INVALID'}`);
      console.log(`   Got:      ${res.isValid ? 'VALID' : 'INVALID'}`);
      if (res.error) {
        console.log(`   Error:    ${res.error}`);
      }
    }
  }

  console.log(`\nTests completed: ${passedCount}/${testCases.length} passed.`);
  process.exit(passedCount === testCases.length ? 0 : 1);
}

runTests();
