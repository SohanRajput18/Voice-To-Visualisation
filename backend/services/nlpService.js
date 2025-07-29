const axios = require('axios');

class NLPService {
  constructor() {
    this.baseURL = process.env.NLP_SERVICE_URL || 'http://localhost:5000';
    this.timeout = 30000; // 30 seconds timeout
  }

  /**
   * Generate SQL query from natural language text
   * @param {string} text - Natural language query
   * @returns {Promise<string>} - Generated SQL query
   */
  async generateSQL(text) {
    try {
      console.log(`Sending text to NLP service: "${text}"`);

      const response = await axios.post(
        `${this.baseURL}/generate-sql`,
        { text },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data || !response.data.sql) {
        throw new Error('Invalid response from NLP service');
      }

      const sqlQuery = response.data.sql.trim();
      console.log('Generated SQL from NLP service:', sqlQuery);

      return sqlQuery;

    } catch (error) {
      console.error('NLP service error:', error.message);

      if (error.code === 'ECONNREFUSED') {
        throw new Error('NLP service unavailable: Connection refused');
      }

      if (error.code === 'ETIMEDOUT') {
        throw new Error('NLP service unavailable: Request timeout');
      }

      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error || 'Unknown error';
        throw new Error(`NLP service error (${status}): ${message}`);
      }

      throw new Error(`NLP service failed: ${error.message}`);
    }
  }

  /**
   * Health check for NLP service
   * @returns {Promise<boolean>} - Service health status
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
      });

      return response.status === 200 && response.data.status === 'healthy';

    } catch (error) {
      console.error('NLP service health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get supported query types from NLP service
   * @returns {Promise<Array>} - List of supported query types
   */
  async getSupportedQueryTypes() {
    try {
      const response = await axios.get(`${this.baseURL}/query-types`, {
        timeout: 5000,
      });

      return response.data.types || [];

    } catch (error) {
      console.error('Failed to get supported query types:', error.message);
      return [
        'sales_analysis',
        'revenue_trends',
        'customer_demographics',
        'product_performance',
        'time_series_analysis'
      ];
    }
  }

  /**
   * Validate natural language query before processing
   * @param {string} text - Natural language query
   * @returns {Promise<Object>} - Validation result
   */
  async validateQuery(text) {
    try {
      const response = await axios.post(
        `${this.baseURL}/validate-query`,
        { text },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        isValid: response.data.valid,
        confidence: response.data.confidence || 0,
        suggestions: response.data.suggestions || [],
        queryType: response.data.query_type || 'unknown'
      };

    } catch (error) {
      console.error('Query validation failed:', error.message);
      return {
        isValid: true, // Default to valid if validation service fails
        confidence: 0.5,
        suggestions: [],
        queryType: 'unknown'
      };
    }
  }
}

module.exports = new NLPService();