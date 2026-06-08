import { DbSchemaService } from '../services/db-schema.service';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  cleanedSql?: string;
}

export class SqlValidator {
  private static FORBIDDEN_WORDS = [
    'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
    'replace', 'upsert', 'grant', 'revoke', 'execute', 'exec', 'declare',
    'merge', 'copy', 'into', 'pg_sleep', 'pg_authid', 'pg_user', 'pg_shadow',
    'information_schema', 'pg_catalog'
  ];

  /**
   * Sanitizes and validates a generated SQL query.
   * Returns validation status, clean SQL, and detailed error messages if invalid.
   */
  static validate(sql: string): ValidationResult {
    if (!sql || typeof sql !== 'string') {
      return { isValid: false, error: 'Query is empty' };
    }

    // 1. Clean query: strip block comments and single-line comments
    let cleaned = sql
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* ... */
      .replace(/--.*$/gm, '')           // Remove -- ...
      .trim();

    if (cleaned.endsWith(';')) {
      cleaned = cleaned.slice(0, -1).trim();
    }

    if (!cleaned) {
      return { isValid: false, error: 'Query contains only comments' };
    }

    // 2. Prevent multi-statement query execution (semicolons)
    if (cleaned.includes(';')) {
      return { isValid: false, error: 'Multiple SQL statements are not allowed (semicolons detected)' };
    }

    // 3. Lowercase check for matching forbidden actions
    const lowerSql = cleaned.toLowerCase();

    // The query MUST start with select or with (for CTEs)
    if (!lowerSql.startsWith('select') && !lowerSql.startsWith('with')) {
      return { isValid: false, error: 'Only SELECT queries are allowed' };
    }

    // Check for forbidden keywords anywhere in the query
    for (const word of this.FORBIDDEN_WORDS) {
      // Use word boundaries to avoid matching things like "description" for "drop"
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(lowerSql)) {
        return { isValid: false, error: `Unauthorized SQL keyword detected: "${word.toUpperCase()}"` };
      }
    }

    // 4. Validate tables queried are strictly whitelisted
    const tables = this.extractTables(lowerSql);
    if (tables.length === 0) {
      return { isValid: false, error: 'No query source tables detected' };
    }

    const whitelist = DbSchemaService.WHITELISTED_TABLES;
    for (const table of tables) {
      if (!whitelist.includes(table)) {
        return { 
          isValid: false, 
          error: `Table "${table}" is not whitelisted. Access is restricted to: [${whitelist.join(', ')}]` 
        };
      }
    }

    return {
      isValid: true,
      cleanedSql: cleaned + ';'
    };
  }

  private static extractTables(sql: string): string[] {
    const tables = new Set<string>();
    const cteNames = new Set<string>();

    // Detect CTE definitions (e.g., WITH cte_name AS (, or , cte_name AS ()
    const cteRegex = /(?:with|,)\s+([a-zA-Z0-9_]+)\s+as\s*\(/gi;
    let cteMatch;
    while ((cteMatch = cteRegex.exec(sql)) !== null) {
      if (cteMatch[1]) {
        cteNames.add(cteMatch[1].toLowerCase());
      }
    }
    
    // Regular expression to capture table names in FROM and JOIN clauses
    const fromJoinRegex = /(?:from|join)\s+([a-zA-Z0-9_\.\"\']+)/gi;
    let match;

    while ((match = fromJoinRegex.exec(sql)) !== null) {
      if (match[1]) {
        let tableName = match[1]
          .replace(/['""\s]/g, '') // Strip quotes and spaces
          .split('.')              // Extract table name from public.table
          .pop();                  // Get actual table name
        
        if (tableName) {
          const lowerTable = tableName.toLowerCase();
          if (!cteNames.has(lowerTable)) {
            tables.add(lowerTable);
          }
        }
      }
    }

    // Handle comma-separated tables in FROM clause
    const commaTablesRegex = /from\s+([a-zA-Z0-9_\.\"\',\s]+)(?:where|group|order|limit|join|left|right|inner|outer|cross|select|\)|$)/gi;
    let commaMatch;
    
    commaTablesRegex.lastIndex = 0;
    while ((commaMatch = commaTablesRegex.exec(sql)) !== null) {
      if (commaMatch[1]) {
        const parts = commaMatch[1].split(',');
        for (let part of parts) {
          part = part.trim().split(/\s+/)[0]; // Get the table name before any alias
          let tableName = part
            .replace(/['""\s]/g, '')
            .split('.')
            .pop();
          
          if (tableName && tableName !== 'select' && tableName !== 'with') {
            const lowerTable = tableName.toLowerCase();
            if (!cteNames.has(lowerTable)) {
              tables.add(lowerTable);
            }
          }
        }
      }
    }

    return Array.from(tables);
  }
}
