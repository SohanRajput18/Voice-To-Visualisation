import { Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { LlmService } from '../services/llm.service';
import { SqlValidator } from '../utils/sql-validator';
import { ConnectionController } from './connection.controller';
import { RagSchemaService } from '../services/rag-schema.service';
import { DbAdapterFactory, DiscoveredTable } from '../services/db-adapter';

// In-memory guest query histories registry
const guestHistories = new Map<string, any[]>();

export class QueryController {
  /**
   * Processes natural language query using RAG Context and active Database Adapters.
   */
  static async processQuery(req: AuthenticatedRequest, res: Response) {
    const { prompt } = req.body;
    const userId = req.user?.id;
    const guestSessionId = req.user?.guestSessionId;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt query is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let activeConn = await ConnectionController.getActiveAdapter(userId, guestSessionId);
    let adapter = activeConn?.adapter;
    let connectionId = activeConn?.connectionId || null;

    // Fallback: If no custom database is active, use the seeded sandbox postgres database
    if (!adapter) {
      const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vtov_db';
      adapter = DbAdapterFactory.create('postgres', { connectionString: databaseUrl });
    }

    let fullSchema: DiscoveredTable[] = [];
    let relevantSchema: DiscoveredTable[] = [];
    let generatedSql = '';
    let explanation = '';
    let confidence = 0.0;
    const startTime = Date.now();

    try {
      // 1. Discover full schema dynamically
      fullSchema = await adapter.discoverSchema();

      // 2. Retrieve relevant schema context using RAG
      relevantSchema = await RagSchemaService.getRelevantSchema(prompt, fullSchema);

      // 3. Compile SQL query, explanation, and confidence
      const llmResult = await LlmService.translateToSql(prompt, relevantSchema);
      generatedSql = llmResult.sql;
      explanation = llmResult.explanation;
      confidence = llmResult.confidence;

      // 4. Validate generated SQL against discovered schema
      const validation = SqlValidator.validate(generatedSql, fullSchema);

      if (!validation.isValid) {
        const latency = Date.now() - startTime;
        await QueryController.logAudit(
          userId, connectionId, prompt, generatedSql, 'invalid', latency, 'table', explanation, confidence, validation.error, guestSessionId
        );

        return res.status(400).json({
          error: validation.error,
          sql: generatedSql,
          explanation,
          confidence,
          status: 'invalid'
        });
      }

      const sqlToRun = validation.cleanedSql!;

      // 5. Execute query on the active database adapter
      const queryResult = await adapter.executeReadOnly(sqlToRun);
      const rows = queryResult.rows;
      
      const columns = (queryResult.fields || []).map((f: any) => ({
        name: f.name,
        dataType: f.dataTypeID || 'unknown'
      }));

      // 6. smart recommend chart
      const chartType = QueryController.recommendChart(columns, rows);
      const latency = Date.now() - startTime;

      // 7. Audit log success
      await QueryController.logAudit(
        userId, connectionId, prompt, sqlToRun, 'success', latency, chartType, explanation, confidence, null, guestSessionId
      );

      // Clean up connection pool if using transient fallback adapter
      if (!activeConn) {
        await adapter.disconnect();
      }

      return res.status(200).json({
        sql: sqlToRun,
        columns,
        rows,
        chartType,
        explanation,
        confidence,
        status: 'success'
      });

    } catch (error: any) {
      const latency = Date.now() - startTime;
      const errorMsg = error.message && error.message.startsWith('TRANSLATION_ERROR:') 
        ? error.message.replace('TRANSLATION_ERROR:', '') 
        : error.message;

      console.error('Error executing generated SQL:', error);

      await QueryController.logAudit(
        userId, connectionId, prompt, generatedSql || 'Failed during generation', 'failed', latency, 'table', explanation, confidence, errorMsg, guestSessionId
      );

      // Clean up fallback pool
      if (!activeConn && adapter) {
        try { await adapter.disconnect(); } catch (_) {}
      }

      const isUserFriendly = error.message && error.message.startsWith('TRANSLATION_ERROR:');
      return res.status(isUserFriendly ? 400 : 500).json({
        error: isUserFriendly ? errorMsg : `Query execution failure: ${errorMsg}`,
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
    const guestSessionId = req.user?.guestSessionId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (guestSessionId) {
      const history = guestHistories.get(guestSessionId) || [];
      return res.status(200).json({ history });
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
      return res.status(500).json({ error: 'Failed to fetch query history' });
    }
  }

  /**
   * Clears query history logs.
   */
  static async clearHistory(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const guestSessionId = req.user?.guestSessionId;
    if (!userId) return res.status(401).json({ error: 'Not authorized' });

    if (guestSessionId) {
      guestHistories.set(guestSessionId, []);
      return res.status(200).json({ message: 'History cleared' });
    }

    try {
      await pool.query('DELETE FROM query_history WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM query_audit_logs WHERE user_id = $1', [userId]);
      return res.status(200).json({ message: 'History cleared' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to clear history' });
    }
  }

  /**
   * Deletes a specific history item.
   */
  static async deleteHistoryItem(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const guestSessionId = req.user?.guestSessionId;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Not authorized' });

    if (guestSessionId) {
      let history = guestHistories.get(guestSessionId) || [];
      history = history.filter(item => item.id !== Number(id));
      guestHistories.set(guestSessionId, history);
      return res.status(200).json({ message: 'Item deleted' });
    }

    try {
      await pool.query('DELETE FROM query_history WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({ message: 'Item deleted' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete item' });
    }
  }

  /**
   * Exposes active discovered database schema metadata.
   */
  static async getSchema(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const guestSessionId = req.user?.guestSessionId;
    if (!userId) return res.status(401).json({ error: 'Not authorized' });

    let activeConn = await ConnectionController.getActiveAdapter(userId, guestSessionId);
    let adapter = activeConn?.adapter;

    if (!adapter) {
      const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vtov_db';
      adapter = DbAdapterFactory.create('postgres', { connectionString: databaseUrl });
    }

    try {
      const schema = await adapter.discoverSchema();
      if (!activeConn) {
        await adapter.disconnect();
      }
      return res.status(200).json({ schema });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to discover schema' });
    }
  }

  /**
   * Aggregates usage audit logs to generate dashboard analytics.
   */
  static async getAnalytics(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const guestSessionId = req.user?.guestSessionId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (guestSessionId) {
      return res.status(200).json({
        summary: {
          totalQueries: 0,
          successCount: 0,
          invalidCount: 0,
          failedCount: 0,
          avgLatencyMs: 0
        },
        chartDistribution: [],
        logs: []
      });
    }

    try {
      // 1. Total queries, success counts, invalid counts, failed counts
      const countsRes = await pool.query(
        `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
            COUNT(CASE WHEN status = 'invalid' THEN 1 END) as invalid,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
            AVG(CASE WHEN status = 'success' THEN execution_time_ms END) as avg_latency
         FROM query_audit_logs 
         WHERE user_id = $1`,
        [userId]
      );

      // 2. Chart type distribution
      const chartsRes = await pool.query(
        `SELECT chart_type, COUNT(*) as count 
         FROM query_audit_logs 
         WHERE user_id = $1 AND status = 'success' 
         GROUP BY chart_type`,
        [userId]
      );

      // 3. Retrieve audit logs list
      const logsRes = await pool.query(
        `SELECT id, prompt, generated_sql, status, execution_time_ms, chart_type, confidence, created_at 
         FROM query_audit_logs 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 30`,
        [userId]
      );

      return res.status(200).json({
        summary: {
          totalQueries: Number(countsRes.rows[0].total || 0),
          successCount: Number(countsRes.rows[0].success || 0),
          invalidCount: Number(countsRes.rows[0].invalid || 0),
          failedCount: Number(countsRes.rows[0].failed || 0),
          avgLatencyMs: Math.round(Number(countsRes.rows[0].avg_latency || 0))
        },
        chartDistribution: chartsRes.rows,
        logs: logsRes.rows
      });

    } catch (error) {
      console.error('Analytics retrieve error:', error);
      return res.status(500).json({ error: 'Failed to fetch analytics metrics' });
    }
  }

  /**
   * Helper logger mapping audit writes to database or guest in-memory logs.
   */
  private static async logAudit(
    userId: number,
    connectionId: number | null,
    prompt: string,
    sql: string | null,
    status: 'success' | 'failed' | 'invalid',
    latencyMs: number,
    chartType: string,
    explanation: string | null = null,
    confidence: number = 0.0,
    errorMsg: string | null = null,
    guestSessionId?: string
  ) {
    try {
      if (guestSessionId) {
        // Save to guest in-memory logs
        const history = guestHistories.get(guestSessionId) || [];
        const mockId = Math.floor(Math.random() * 1000000) + 1;
        const mockItem = {
          id: mockId,
          prompt,
          generated_sql: sql,
          status,
          error_message: errorMsg,
          chart_type: chartType,
          created_at: new Date().toISOString(),
          explanation,
          confidence
        };
        guestHistories.set(guestSessionId, [mockItem, ...history].slice(0, 20));
        return;
      }

      // Save history log (legacy compatibility)
      await pool.query(
        `INSERT INTO query_history (user_id, prompt, generated_sql, status, error_message, chart_type) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, prompt, sql, status, errorMsg, chartType]
      );

      // Save complete audit log
      await pool.query(
        `INSERT INTO query_audit_logs 
          (user_id, connection_id, prompt, generated_sql, status, execution_time_ms, chart_type, explanation, confidence, error_message) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, connectionId, prompt, sql, status, latencyMs, chartType, explanation, confidence, errorMsg]
      );
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }

  /**
   * Smart chart classification heuristic.
   */
  private static recommendChart(columns: any[], rows: any[]): 'bar' | 'line' | 'pie' | 'table' {
    if (!rows || rows.length === 0) return 'table';

    const sample = rows[0];
    const numericKeys: string[] = [];
    const temporalKeys: string[] = [];
    const categoricalKeys: string[] = [];

    for (const [key, val] of Object.entries(sample)) {
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '')) {
        if (key.toLowerCase() !== 'id' && !key.toLowerCase().endsWith('_id')) {
          numericKeys.push(key);
        }
      } else if (val instanceof Date || (typeof val === 'string' && QueryController.isValidDate(val))) {
        temporalKeys.push(key);
      } else if (typeof val === 'string') {
        categoricalKeys.push(key);
      }
    }

    if (temporalKeys.length > 0 && numericKeys.length > 0) return 'line';

    if (categoricalKeys.length > 0 && numericKeys.length > 0) {
      const uniqueCategories = new Set(rows.map(r => r[categoricalKeys[0]])).size;
      if (uniqueCategories > 1 && uniqueCategories <= 6) return 'pie';
      return 'bar';
    }

    if (numericKeys.length > 1) return 'bar';

    return 'table';
  }

  private static isValidDate(val: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
    if (!dateRegex.test(val)) return false;
    const time = Date.parse(val);
    return !isNaN(time);
  }
}
