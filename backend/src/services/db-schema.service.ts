import { pool } from '../config/db';

export interface ColumnSchema {
  columnName: string;
  dataType: string;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnSchema[];
}

export class DbSchemaService {
  // We restrict query access to these whitelist sandbox tables only
  public static readonly WHITELISTED_TABLES = ['products', 'customers', 'sales'];

  /**
   * Fetches schema information for all whitelisted tables.
   */
  static async getWhitelistedSchema(): Promise<TableSchema[]> {
    const query = `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ANY($1)
      ORDER BY table_name, ordinal_position;
    `;

    try {
      const { rows } = await pool.query(query, [this.WHITELISTED_TABLES]);
      const schemaMap = new Map<string, ColumnSchema[]>();

      // Initialize with whitelisted tables
      for (const table of this.WHITELISTED_TABLES) {
        schemaMap.set(table, []);
      }

      for (const row of rows) {
        const tableName = row.table_name;
        const columnName = row.column_name;
        const dataType = row.data_type;

        if (schemaMap.has(tableName)) {
          schemaMap.get(tableName)!.push({ columnName, dataType });
        }
      }

      const tableSchemas: TableSchema[] = [];
      for (const [tableName, columns] of schemaMap.entries()) {
        tableSchemas.push({ tableName, columns });
      }

      return tableSchemas;
    } catch (error) {
      console.error('Error fetching database schema:', error);
      // Return hardcoded schema fallback in case DB is not yet running or during early build
      return this.getFallbackSchema();
    }
  }

  /**
   * Formats the schema details into a clear SQL creation statement summary for the LLM prompt.
   */
  static async getFormattedSchemaForLLM(): Promise<string> {
    const schemas = await this.getWhitelistedSchema();
    let schemaStr = '';

    for (const schema of schemas) {
      schemaStr += `Table: ${schema.tableName}\nColumns:\n`;
      for (const col of schema.columns) {
        schemaStr += `  - ${col.columnName} (${col.dataType})\n`;
      }
      schemaStr += '\n';
    }

    return schemaStr;
  }

  /**
   * Safe fallback schema definitions.
   */
  private static getFallbackSchema(): TableSchema[] {
    return [
      {
        tableName: 'products',
        columns: [
          { columnName: 'id', dataType: 'integer' },
          { columnName: 'name', dataType: 'character varying' },
          { columnName: 'category', dataType: 'character varying' },
          { columnName: 'price', dataType: 'numeric' },
          { columnName: 'stock', dataType: 'integer' }
        ]
      },
      {
        tableName: 'customers',
        columns: [
          { columnName: 'id', dataType: 'integer' },
          { columnName: 'name', dataType: 'character varying' },
          { columnName: 'email', dataType: 'character varying' },
          { columnName: 'city', dataType: 'character varying' },
          { columnName: 'join_date', dataType: 'date' }
        ]
      },
      {
        tableName: 'sales',
        columns: [
          { columnName: 'id', dataType: 'integer' },
          { columnName: 'product_id', dataType: 'integer' },
          { columnName: 'customer_id', dataType: 'integer' },
          { columnName: 'quantity', dataType: 'integer' },
          { columnName: 'sale_date', dataType: 'date' },
          { columnName: 'total_amount', dataType: 'numeric' }
        ]
      }
    ];
  }
}
