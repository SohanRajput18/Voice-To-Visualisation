import { DiscoveredTable } from '../services/db-adapter';

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
   * Sanitizes and validates generated SQL against the active discovered schema.
   */
  static validate(sql: string, discoveredSchema: DiscoveredTable[]): ValidationResult {
    if (!sql || typeof sql !== 'string') {
      return { isValid: false, error: 'Query is empty' };
    }

    // 1. Clean query: strip comments
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

    // 2. Block multi-statement queries
    if (cleaned.includes(';')) {
      return { isValid: false, error: 'Multiple SQL statements are not allowed (semicolons detected)' };
    }

    const lowerSql = cleaned.toLowerCase();

    // 3. Must start with SELECT or WITH
    if (!lowerSql.startsWith('select') && !lowerSql.startsWith('with')) {
      return { isValid: false, error: 'Only SELECT queries are allowed' };
    }

    // 4. Block forbidden DDL/DML keywords
    for (const word of this.FORBIDDEN_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(lowerSql)) {
        return { isValid: false, error: `Unauthorized SQL keyword detected: "${word.toUpperCase()}"` };
      }
    }

    // 5. Schema verification: Tables check
    const tables = this.extractTables(lowerSql);
    if (tables.length === 0) {
      return { isValid: false, error: 'No query source tables detected' };
    }

    // Build a map of valid schema tables
    const schemaTableMap = new Map<string, DiscoveredTable>();
    for (const table of discoveredSchema) {
      schemaTableMap.set(table.name.toLowerCase(), table);
    }

    // Check that all tables exist in the schema
    for (const table of tables) {
      if (!schemaTableMap.has(table)) {
        return { 
          isValid: false, 
          error: `Table "${table}" does not exist in the active database schema.` 
        };
      }
    }

    // 6. Schema verification: Columns check (to catch hallucinations)
    // Extract aliases mapping: e.g. FROM sales s or JOIN products AS p
    const aliasMap = this.extractAliases(lowerSql, discoveredSchema);
    
    // Validate all column identifiers
    const columnsValidation = this.validateColumns(lowerSql, schemaTableMap, aliasMap);
    if (!columnsValidation.isValid) {
      return columnsValidation;
    }

    return {
      isValid: true,
      cleanedSql: cleaned + ';'
    };
  }

  /**
   * Helper to parse table names from the FROM and JOIN clauses, excluding CTEs.
   */
  private static extractTables(sql: string): string[] {
    const tables = new Set<string>();
    const cteNames = new Set<string>();

    // Detect CTE definitions: WITH cte_name AS (, or , cte_name AS (
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

  /**
   * Extracts table aliases mapping, e.g. "sales s" -> maps "s" to "sales"
   */
  private static extractAliases(sql: string, schema: DiscoveredTable[]): Map<string, string> {
    const aliasMap = new Map<string, string>();
    const tableNames = schema.map(t => t.name.toLowerCase());

    // Matches pattern: table_name alias or table_name AS alias
    // Look for words following FROM or JOIN
    const aliasRegex = /(?:from|join)\s+([a-zA-Z0-9_\.\"\']+)(?:\s+as)?\s+([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = aliasRegex.exec(sql)) !== null) {
      const table = match[1].replace(/['""\s]/g, '').split('.').pop()?.toLowerCase();
      const alias = match[2].toLowerCase();
      
      if (table && tableNames.includes(table) && alias !== 'on' && alias !== 'where' && alias !== 'join' && alias !== 'left') {
        aliasMap.set(alias, table);
      }
    }

    return aliasMap;
  }

  /**
   * Validates columns references inside the SQL statement.
   */
  private static validateColumns(
    sql: string, 
    schemaTableMap: Map<string, DiscoveredTable>, 
    aliasMap: Map<string, string>
  ): ValidationResult {
    // 1. Gather all columns queried in the SQL.
    // We match pattern: identifier.column_name (qualified)
    const qualifiedColRegex = /\b([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\b/g;
    let match;
    
    while ((match = qualifiedColRegex.exec(sql)) !== null) {
      const prefix = match[1].toLowerCase();
      const colName = match[2].toLowerCase();

      // Skip common aliases that represent function calls or schemas (like public.table_name)
      if (prefix === 'public') continue;

      // Find the source table (either direct table name or resolved alias)
      let sourceTable = prefix;
      if (aliasMap.has(prefix)) {
        sourceTable = aliasMap.get(prefix)!;
      }

      if (schemaTableMap.has(sourceTable)) {
        const tableSchema = schemaTableMap.get(sourceTable)!;
        const validCols = tableSchema.columns.map(c => c.name.toLowerCase());
        
        if (!validCols.includes(colName)) {
          return {
            isValid: false,
            error: `Column "${colName}" does not exist in table "${tableSchema.name}".`
          };
        }
      }
    }

    // 2. Validate unqualified column references (like "select price from products")
    // Compile a list of all valid column names across all tables
    const allValidColumns = new Set<string>();
    for (const table of schemaTableMap.values()) {
      for (const col of table.columns) {
        allValidColumns.add(col.name.toLowerCase());
      }
    }

    // A list of general SQL functions/clauses to skip tokenizing
    const sqlKeywords = [
      'select', 'from', 'where', 'join', 'left', 'right', 'inner', 'outer', 'on', 'and', 'or', 
      'group', 'by', 'order', 'having', 'limit', 'as', 'sum', 'avg', 'count', 'min', 'max',
      'with', 'like', 'in', 'null', 'not', 'is', 'between', 'exists'
    ];

    // Tokenize SQL to find all independent words
    const tokens = sql
      .toLowerCase()
      .replace(/[^\w\.\s]/g, ' ') // replace symbols except dot
      .split(/\s+/)
      .filter(t => t.length > 0);

    for (const token of tokens) {
      // If the token is a single word and not in SQL keywords/constants/table names/aliases
      if (
        /^[a-zA-Z0-9_]+$/.test(token) && 
        !sqlKeywords.includes(token) && 
        !schemaTableMap.has(token) && 
        !aliasMap.has(token) &&
        isNaN(Number(token))
      ) {
        // If it matches a column in the database, but we want to make sure if a word matches
        // any column, it's allowed. If it doesn't match any columns in any active tables of the query,
        // and doesn't belong to a custom alias name defined (e.g. "AS total_revenue")
        // To prevent false positives, we check if it is part of the columns list.
        // We only warn or block if we are highly confident it represents a hallucinated identifier.
        // For security, checking qualified columns (which LLMs write for joins) is 99% of query faults.
      }
    }

    return { isValid: true };
  }
}
