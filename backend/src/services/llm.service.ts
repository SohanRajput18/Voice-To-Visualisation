import { DiscoveredTable } from './db-adapter';
import { ILlmProvider } from './llm-providers/llm-provider.interface';
import { OllamaProvider } from './llm-providers/ollama.provider';
import { GeminiProvider } from './llm-providers/gemini.provider';

export interface LlmResult {
  sql: string;
  explanation: string;
  confidence: number;
}

export class LlmService {
  private static getProvider(): ILlmProvider {
    const providerType = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
    if (providerType === 'gemini') {
      return new GeminiProvider();
    }
    return new OllamaProvider();
  }

  /**
   * Translates natural language prompt into SQL query, explanation, and confidence score.
   */
  static async translateToSql(userPrompt: string, relevantSchema: DiscoveredTable[]): Promise<LlmResult> {
    // 1. Sanity check for greetings and unrelated prompts
    if (this.isGreetingOrUnrelated(userPrompt)) {
      throw new Error('TRANSLATION_ERROR:Your request does not appear to be related to database analytics. Please ask a business question related to products, customers, or sales.');
    }

    // 2. Format discovered schema for LLM context
    const formattedSchema = this.formatSchemaForLLM(relevantSchema);

    try {
      const provider = this.getProvider();
      return await provider.generateSql(userPrompt, formattedSchema);
    } catch (error: any) {
      if (error.message && error.message.startsWith('TRANSLATION_ERROR:')) {
        throw error;
      }
      console.warn('Selected LLM provider failed or offline. Falling back to local pattern-matching heuristic...');
      return this.generateFallbackLlmResult(userPrompt);
    }
  }

  /**
   * Helper to format a database schema into readable schema summaries.
   */
  private static formatSchemaForLLM(schema: DiscoveredTable[]): string {
    let schemaStr = '';
    for (const table of schema) {
      schemaStr += `Table: ${table.name}\nColumns:\n`;
      for (const col of table.columns) {
        let typeStr = col.dataType;
        if (col.isPrimaryKey) typeStr += ', Primary Key';
        if (col.isForeignKey && col.referencedTable) {
          typeStr += `, Foreign Key referencing ${col.referencedTable}.${col.referencedColumn}`;
        }
        schemaStr += `  - ${col.name} (${typeStr})\n`;
      }
      schemaStr += '\n';
    }
    return schemaStr;
  }

  /**
   * Safe parser extracting JSON content from LLM strings.
   */
  private static parseLlmResponse(text: string): LlmResult {
    let cleaned = text.trim();
    
    // Remove markdown json wrappers if present
    if (cleaned.includes('```')) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match && match[1]) {
        cleaned = match[1].trim();
      }
    }

    // Try parsing
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.sql === 'string') {
        return {
          sql: parsed.sql.trim(),
          explanation: parsed.explanation || 'SQL query compiled successfully.',
          confidence: Number(parsed.confidence || 0.8)
        };
      }
    } catch (_) {
      // Fallback: If JSON parsing fails, extract using regex boundaries
      const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed.sql === 'string') {
            return {
              sql: parsed.sql.trim(),
              explanation: parsed.explanation || 'SQL query compiled successfully.',
              confidence: Number(parsed.confidence || 0.8)
            };
          }
        } catch (__) {}
      }
    }

    // Secondary fallback: assume the text itself is raw SQL
    // Extract first SELECT or WITH keyword
    let fallbackSql = cleaned;
    const selectIdx = cleaned.toLowerCase().indexOf('select');
    const withIdx = cleaned.toLowerCase().indexOf('with');
    const startIdx = selectIdx !== -1 && (withIdx === -1 || selectIdx < withIdx) ? selectIdx : withIdx;
    
    if (startIdx !== -1) {
      fallbackSql = cleaned.substring(startIdx);
      // Strip trailing conversational sentences if any
      const endQueryIdx = fallbackSql.indexOf('\n');
      if (endQueryIdx !== -1) {
        fallbackSql = fallbackSql.substring(0, endQueryIdx);
      }
    }

    return {
      sql: fallbackSql,
      explanation: 'Extracted raw SQL query from LLM completion block.',
      confidence: 0.6
    };
  }

  /**
   * Premium heuristic SQL query explanation generator.
   */
  private static generateFallbackLlmResult(prompt: string): LlmResult {
    const p = prompt.toLowerCase();

    // 1. Transactions Count
    if (p.includes('transaction') || p.includes('sales count') || p.includes('number of sales') || p.includes('how many sales')) {
      return {
        sql: `SELECT COUNT(*) AS total_transactions FROM sales;`,
        explanation: 'Queries the sales table to return the aggregate count of transaction rows.',
        confidence: 0.95
      };
    }

    // 2. Sales by category
    if (p.includes('sales') && p.includes('category')) {
      return {
        sql: `SELECT p.category, SUM(s.total_amount) AS total_revenue, SUM(s.quantity) AS total_quantity \nFROM sales s \nJOIN products p ON s.product_id = p.id \nGROUP BY p.category \nORDER BY total_revenue DESC;`,
        explanation: 'Joins sales transactions with products on product_id, groups by category, and sums total amount to rank revenues.',
        confidence: 0.95
      };
    }

    // 3. Sales over time
    if (p.includes('sales') && (p.includes('time') || p.includes('over time') || p.includes('monthly') || p.includes('date') || p.includes('daily'))) {
      return {
        sql: `SELECT s.sale_date, SUM(s.total_amount) AS daily_revenue \nFROM sales s \nGROUP BY s.sale_date \nORDER BY s.sale_date ASC;`,
        explanation: 'Groups sales ledger records by chronological date and aggregates totals sequentially.',
        confidence: 0.90
      };
    }

    // 4. Top customers
    if (p.includes('customer') || p.includes('customers')) {
      return {
        sql: `SELECT c.name, c.city, SUM(s.total_amount) AS total_spent \nFROM sales s \nJOIN customers c ON s.customer_id = c.id \nGROUP BY c.name, c.city \nORDER BY total_spent DESC \nLIMIT 5;`,
        explanation: 'Joins customer accounts with transactions, computes aggregated purchases, and displays top 5 spenders.',
        confidence: 0.95
      };
    }

    // 5. Products list or stock
    if (p.includes('product') || p.includes('stock') || p.includes('inventory')) {
      return {
        sql: `SELECT name, category, price, stock \nFROM products \nORDER BY stock ASC;`,
        explanation: 'Selects the product catalog list sorted by available stock levels to locate items near depletion.',
        confidence: 0.90
      };
    }

    // 6. Total sales summary
    if (p.includes('total sales') || p.includes('revenue') || p.includes('how much')) {
      return {
        sql: `SELECT SUM(total_amount) AS total_revenue, COUNT(*) AS transaction_count \nFROM sales;`,
        explanation: 'Retrieves total turnover revenue and count of operations from the ledger ledger table.',
        confidence: 0.95
      };
    }

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
