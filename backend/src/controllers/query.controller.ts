import { Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { LlmService } from '../services/llm.service';
import { SqlValidator } from '../utils/sql-validator';
import { DbSchemaService } from '../services/db-schema.service';

export class QueryController {
  /**
   * Processes a voice or text natural language query.
   * Steps: LLM Text-to-SQL -> Safe Validation -> Execute -> Recommend Chart -> Save History.
   */
  static async processQuery(req: AuthenticatedRequest, res: Response) {
    const { prompt } = req.body;
    const userId = req.user?.id;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt query is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let generatedSql = '';
    
    try {
      // 1. Run LLM translation
      generatedSql = await LlmService.translateToSql(prompt);

      // 2. Run SQL safety validation
      const validation = SqlValidator.validate(generatedSql);

      if (!validation.isValid) {
        // Save query history as invalid
        await pool.query(
          `INSERT INTO query_history (user_id, prompt, generated_sql, status, error_message, chart_type) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, prompt, generatedSql, 'invalid', validation.error, 'table']
        );

        return res.status(400).json({
          error: validation.error,
          sql: generatedSql,
          status: 'invalid'
        });
      }

      const sqlToRun = validation.cleanedSql!;

      // 3. Execute query on PostgreSQL
      const queryResult = await pool.query(sqlToRun);
      const rows = queryResult.rows;
      const fields = queryResult.fields || [];

      const columns = fields.map(f => ({
        name: f.name,
        dataType: f.dataTypeID // Can map to type names or keep simple
      }));

      // 4. Determine chart recommendations
      const chartType = QueryController.recommendChart(columns, rows);

      // 5. Store successful history record
      await pool.query(
        `INSERT INTO query_history (user_id, prompt, generated_sql, status, chart_type) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, prompt, sqlToRun, 'success', chartType]
      );

      return res.status(200).json({
        sql: sqlToRun,
        columns,
        rows,
        chartType,
        status: 'success'
      });

    } catch (error: any) {
      if (error.message && error.message.startsWith('TRANSLATION_ERROR:')) {
        const cleanMsg = error.message.replace('TRANSLATION_ERROR:', '');
        console.warn(`Translation blocked: ${cleanMsg}`);
        
        if (userId) {
          await pool.query(
            `INSERT INTO query_history (user_id, prompt, generated_sql, status, error_message, chart_type) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, prompt, null, 'invalid', cleanMsg, 'table']
          );
        }

        return res.status(400).json({
          error: cleanMsg,
          sql: '',
          status: 'invalid'
        });
      }

      console.error('Error executing generated SQL:', error);

      // Store failed query history record
      if (userId) {
        await pool.query(
          `INSERT INTO query_history (user_id, prompt, generated_sql, status, error_message, chart_type) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, prompt, generatedSql || 'Failed during generation', 'failed', error.message, 'table']
        );
      }

      return res.status(500).json({
        error: `Database execution error: ${error.message}`,
        sql: generatedSql,
        status: 'failed'
      });
    }
  }

  /**
   * Retrieves previous query histories for the logged in user.
   */
  static async getHistory(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      const { rows } = await pool.query(
        `SELECT id, prompt, generated_sql, status, error_message, chart_type, created_at 
         FROM query_history 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 20`,
        [userId]
      );
      return res.status(200).json({ history: rows });
    } catch (error: any) {
      console.error('Error fetching query history:', error);
      return res.status(500).json({ error: 'Failed to fetch query history' });
    }
  }

  /**
   * Clears all query history for the logged in user.
   */
  static async clearHistory(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await pool.query('DELETE FROM query_history WHERE user_id = $1', [userId]);
      return res.status(200).json({ message: 'Query history cleared successfully' });
    } catch (error: any) {
      console.error('Error clearing history:', error);
      return res.status(500).json({ error: 'Failed to clear query history' });
    }
  }

  /**
   * Deletes a single history item for the logged in user.
   */
  static async deleteHistoryItem(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      const result = await pool.query(
        'DELETE FROM query_history WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'History item not found' });
      }
      return res.status(200).json({ message: 'History item deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting history item:', error);
      return res.status(500).json({ error: 'Failed to delete history item' });
    }
  }

  /**
   * Exposes database schema metadata to the frontend.
   */
  static async getSchema(req: AuthenticatedRequest, res: Response) {
    try {
      const schema = await DbSchemaService.getWhitelistedSchema();
      return res.status(200).json({ schema });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch schema' });
    }
  }

  /**
   * Smart chart classification heuristic.
   */
  private static recommendChart(columns: any[], rows: any[]): 'bar' | 'line' | 'pie' | 'table' {
    if (!rows || rows.length === 0) return 'table';

    // Identify types of columns
    // We check the first row values to guess data types
    const sample = rows[0];
    const numericKeys: string[] = [];
    const temporalKeys: string[] = [];
    const categoricalKeys: string[] = [];

    for (const [key, val] of Object.entries(sample)) {
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '')) {
        // Exclude ID fields from numeric analytics keys
        if (key.toLowerCase() !== 'id' && !key.toLowerCase().endsWith('_id')) {
          numericKeys.push(key);
        }
      } else if (val instanceof Date || (typeof val === 'string' && QueryController.isValidDate(val))) {
        temporalKeys.push(key);
      } else if (typeof val === 'string') {
        categoricalKeys.push(key);
      }
    }

    // Rule 1: Chronological timeline (Time-series line chart)
    if (temporalKeys.length > 0 && numericKeys.length > 0) {
      return 'line';
    }

    // Rule 2: Has categories/labels and numeric metrics
    if (categoricalKeys.length > 0 && numericKeys.length > 0) {
      const uniqueCategories = new Set(rows.map(r => r[categoricalKeys[0]])).size;
      
      // If categories represent a small proportion of partitions (e.g. <= 6 categories), use a Pie Chart
      if (uniqueCategories > 1 && uniqueCategories <= 6) {
        return 'pie';
      }
      
      // Otherwise, default to Bar Chart
      return 'bar';
    }

    // Rule 3: Multiple numeric dimensions or large distributions (Bar chart fallback)
    if (numericKeys.length > 1) {
      return 'bar';
    }

    // Default: Raw table representation
    return 'table';
  }

  /**
   * Safe date validator string check.
   */
  private static isValidDate(val: string): boolean {
    // Check if the string matches common date formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
    if (!dateRegex.test(val)) return false;
    
    const time = Date.parse(val);
    return !isNaN(time);
  }
}
