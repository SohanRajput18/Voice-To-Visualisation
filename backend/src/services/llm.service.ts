import { DbSchemaService } from './db-schema.service';

export class LlmService {
  private static getApiConfig() {
    const baseUrl = process.env.LLM_API_URL || 'http://localhost:11434';
    const model = process.env.LLM_MODEL || 'llama3';
    return { baseUrl, model };
  }

  /**
   * Translates natural language prompt into SQL query.
   */
  static async translateToSql(userPrompt: string): Promise<string> {
    const { baseUrl, model } = this.getApiConfig();

    // 1. Sanity check for greetings and unrelated prompts
    if (this.isGreetingOrUnrelated(userPrompt)) {
      throw new Error('TRANSLATION_ERROR:Your request does not appear to be related to database analytics. Please ask a business question related to products, customers, or sales.');
    }

    const formattedSchema = await DbSchemaService.getFormattedSchemaForLLM();

    const systemPrompt = `You are a PostgreSQL expert that translates natural language questions into single valid SQL queries.
You must use only the tables and columns specified in the schema below.

Allowed Tables and Columns:
${formattedSchema}

Schema Joins details:
- Table "sales" connects to "products" via "sales.product_id = products.id"
- Table "sales" connects to "customers" via "sales.customer_id = customers.id"

Rules:
1. Output ONLY the raw SQL statement. Do not wrap it in markdown code blocks like \`\`\`sql. Do not include any explanation or extra text.
2. Only write SELECT queries. Do not perform INSERT, UPDATE, DELETE, or drop operations.
3. Ensure aliases are defined when joining tables.
4. Ensure grouping fields are correct.

Translate the following user question: "${userPrompt}"
SQL Query:`;

    try {
      console.log(`Connecting to Ollama at: ${baseUrl}/api/generate using model "${model}"`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for fast response

      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: systemPrompt,
          stream: false,
          options: {
            temperature: 0.0,
            num_predict: 120
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const data = (await response.json()) as { response: string };
      let sql = data.response.trim();

      // Clean up markdown code blocks if the model ignored instructions
      if (sql.includes('```')) {
        const matches = sql.match(/```(?:sql)?\s*([\s\S]*?)\s*```/i);
        if (matches && matches[1]) {
          sql = matches[1].trim();
        }
      }

      console.log(`Generated SQL from LLM: ${sql}`);
      return sql;

    } catch (error: any) {
      if (error.message && error.message.startsWith('TRANSLATION_ERROR:')) {
        throw error;
      }
      console.warn('Ollama service offline or timed out. Using pattern-matching fallback SQL generator...');
      return this.generateFallbackSql(userPrompt);
    }
  }

  /**
   * Premium heuristic SQL generator fallback.
   * Ensures the platform works interactively even if the local Ollama service is offline.
   */
  private static generateFallbackSql(prompt: string): string {
    const p = prompt.toLowerCase();

    // 1. Transaction/Sales count
    if (p.includes('transaction') || p.includes('sales count') || p.includes('number of sales') || p.includes('how many sales')) {
      return `SELECT COUNT(*) AS total_transactions FROM sales;`;
    }

    // 2. Sales by category
    if (p.includes('sales') && p.includes('category')) {
      return `SELECT p.category, SUM(s.total_amount) AS total_revenue, SUM(s.quantity) AS total_quantity 
FROM sales s 
JOIN products p ON s.product_id = p.id 
GROUP BY p.category 
ORDER BY total_revenue DESC;`;
    }

    // 3. Sales over time
    if (p.includes('sales') && (p.includes('time') || p.includes('over time') || p.includes('monthly') || p.includes('date') || p.includes('daily'))) {
      return `SELECT s.sale_date, SUM(s.total_amount) AS daily_revenue 
FROM sales s 
GROUP BY s.sale_date 
ORDER BY s.sale_date ASC;`;
    }

    // 4. Top customers
    if (p.includes('customer') || p.includes('customers')) {
      return `SELECT c.name, c.city, SUM(s.total_amount) AS total_spent 
FROM sales s 
JOIN customers c ON s.customer_id = c.id 
GROUP BY c.name, c.city 
ORDER BY total_spent DESC 
LIMIT 5;`;
    }

    // 5. Products list or stock
    if (p.includes('product') || p.includes('stock') || p.includes('inventory')) {
      return `SELECT name, category, price, stock 
FROM products 
ORDER BY stock ASC;`;
    }

    // 6. Total sales summary
    if (p.includes('total sales') || p.includes('revenue') || p.includes('how much')) {
      return `SELECT SUM(total_amount) AS total_revenue, COUNT(*) AS transaction_count 
FROM sales;`;
    }

    // If it reaches here, it means we don't have a valid fallback pattern
    throw new Error('TRANSLATION_ERROR:I was unable to map your request to a database action. Please ask a clear analytics question (e.g., "sales by category" or "top customers").');
  }

  /**
   * Helper to detect if a prompt is unrelated or a generic greeting.
   */
  private static isGreetingOrUnrelated(prompt: string): boolean {
    const p = prompt.toLowerCase().trim();
    const greetings = [
      'hi', 'hello', 'hey', 'yo', 'sup', 'test', 'demo', 'greetings', 'hola', 
      'good morning', 'good afternoon', 'what is this', 'who are you', 'how are you', 'help',
      'ok', 'okay', 'yes', 'no'
    ];
    
    if (greetings.includes(p) || p.length < 3) {
      return true;
    }

    const keywords = [
      'product', 'customer', 'sale', 'revenue', 'stock', 'inventory', 'transaction', 
      'spent', 'price', 'category', 'city', 'daily', 'weekly', 'monthly', 'yearly', 
      'timeline', 'over time', 'trend', 'top', 'total', 'count', 'list', 'show', 'find', 'get'
    ];

    return !keywords.some(kw => p.includes(kw));
  }
}
