const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'voice_visualization',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    console.log('✅ PostgreSQL connection pool initialized');
  }

  /**
   * Execute a SQL query
   * @param {string} query - SQL query to execute
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Query results
   */
  async executeQuery(query, params = []) {
    const client = await this.pool.connect();
    
    try {
      console.log('Executing SQL query:', query);
      const result = await client.query(query, params);
      return result.rows;

    } catch (error) {
      console.error('Database query error:', error);
      throw new Error(`SQL execution failed: ${error.message}`);

    } finally {
      client.release();
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = new DatabaseService();