import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import path from 'path';

export interface DiscoveredColumn {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
}

export interface DiscoveredTable {
  name: string;
  columns: DiscoveredColumn[];
}

export abstract class DbAdapter {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract executeReadOnly(sql: string): Promise<{ rows: any[]; fields: any[] }>;
  abstract discoverSchema(): Promise<DiscoveredTable[]>;
}

// 1. PostgreSQL Adapter
export class PostgresAdapter extends DbAdapter {
  private pool: PgPool | null = null;
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const connectionString = this.config.connectionString || 
      `postgres://${this.config.user}:${encodeURIComponent(this.config.password)}@${this.config.host}:${this.config.port || 5432}/${this.config.database}`;
    
    let isLocal = false;
    try {
      const parsed = new URL(connectionString);
      const hostname = parsed.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'db' || hostname === 'host.docker.internal') {
        isLocal = true;
      }
    } catch (e) {
      isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || connectionString.includes('db:') || connectionString.includes('host.docker.internal');
    }

    const isProduction = process.env.NODE_ENV === 'production' || !isLocal;

    this.pool = new PgPool({ 
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : false
    });
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.pool) await this.connect();
    try {
      const { rows } = await this.pool!.query('SELECT 1 as ping');
      return rows.length > 0;
    } catch (error) {
      console.error('Postgres connection test failed:', error);
      return false;
    }
  }

  async executeReadOnly(sql: string): Promise<{ rows: any[]; fields: any[] }> {
    if (!this.pool) await this.connect();
    // Double check it's a select query
    const cleanSql = sql.trim().toLowerCase();
    if (!cleanSql.startsWith('select') && !cleanSql.startsWith('with')) {
      throw new Error('Only SELECT queries are allowed for execution');
    }
    const result = await this.pool!.query(sql);
    return {
      rows: result.rows,
      fields: (result.fields || []).map(f => ({ name: f.name, dataTypeID: f.dataTypeID }))
    };
  }

  async discoverSchema(): Promise<DiscoveredTable[]> {
    if (!this.pool) await this.connect();
    
    // Discover all user tables and columns
    const columnsQuery = `
      SELECT 
          c.table_name,
          c.column_name,
          c.data_type,
          (EXISTS (
              SELECT 1 FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
              WHERE tc.table_name = c.table_name AND kcu.column_name = c.column_name AND tc.constraint_type = 'PRIMARY KEY'
          )) AS is_primary,
          (EXISTS (
              SELECT 1 FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
              WHERE tc.table_name = c.table_name AND kcu.column_name = c.column_name AND tc.constraint_type = 'FOREIGN KEY'
          )) AS is_foreign,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.referential_constraints rc ON kcu.constraint_name = rc.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position;
    `;

    const { rows } = await this.pool!.query(columnsQuery);
    
    const tableMap = new Map<string, DiscoveredColumn[]>();

    for (const r of rows) {
      const tableName = r.table_name;
      if (!tableMap.has(tableName)) {
        tableMap.set(tableName, []);
      }

      tableMap.get(tableName)!.push({
        name: r.column_name,
        dataType: r.data_type,
        isPrimaryKey: !!r.is_primary,
        isForeignKey: !!r.is_foreign,
        referencedTable: r.referenced_table || undefined,
        referencedColumn: r.referenced_column || undefined
      });
    }

    const discoveredTables: DiscoveredTable[] = [];
    for (const [tableName, columns] of tableMap.entries()) {
      discoveredTables.push({ name: tableName, columns });
    }

    return discoveredTables;
  }
}

// 2. MySQL Adapter
export class MySqlAdapter extends DbAdapter {
  private connection: mysql.Connection | null = null;
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection({
      host: this.config.host,
      port: Number(this.config.port || 3306),
      user: this.config.user,
      password: this.config.password,
      database: this.config.database
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.connection) await this.connect();
      const [rows] = await this.connection!.query('SELECT 1 as ping');
      return Array.isArray(rows) && rows.length > 0;
    } catch (error) {
      console.error('MySQL connection test failed:', error);
      return false;
    }
  }

  async executeReadOnly(sql: string): Promise<{ rows: any[]; fields: any[] }> {
    if (!this.connection) await this.connect();
    const cleanSql = sql.trim().toLowerCase();
    if (!cleanSql.startsWith('select') && !cleanSql.startsWith('with')) {
      throw new Error('Only SELECT queries are allowed for execution');
    }
    const [rows, fields] = await this.connection!.query(sql);
    return {
      rows: rows as any[],
      fields: (fields || []).map(f => ({ name: f.name }))
    };
  }

  async discoverSchema(): Promise<DiscoveredTable[]> {
    if (!this.connection) await this.connect();

    const columnsQuery = `
      SELECT 
          c.TABLE_NAME as table_name,
          c.COLUMN_NAME as column_name,
          c.DATA_TYPE as data_type,
          IF(c.COLUMN_KEY = 'PRI', 1, 0) as is_primary,
          IF(k.REFERENCED_TABLE_NAME IS NOT NULL, 1, 0) as is_foreign,
          k.REFERENCED_TABLE_NAME as referenced_table,
          k.REFERENCED_COLUMN_NAME as referenced_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage k ON c.TABLE_SCHEMA = k.TABLE_SCHEMA 
          AND c.TABLE_NAME = k.TABLE_NAME AND c.COLUMN_NAME = k.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = ?
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;
    `;

    const [rows] = await this.connection!.query(columnsQuery, [this.config.database]);
    const list = rows as any[];
    
    const tableMap = new Map<string, DiscoveredColumn[]>();

    for (const r of list) {
      const tableName = r.table_name;
      if (!tableMap.has(tableName)) {
        tableMap.set(tableName, []);
      }

      tableMap.get(tableName)!.push({
        name: r.column_name,
        dataType: r.data_type,
        isPrimaryKey: r.is_primary === 1,
        isForeignKey: r.is_foreign === 1,
        referencedTable: r.referenced_table || undefined,
        referencedColumn: r.referenced_column || undefined
      });
    }

    const discoveredTables: DiscoveredTable[] = [];
    for (const [tableName, columns] of tableMap.entries()) {
      discoveredTables.push({ name: tableName, columns });
    }

    return discoveredTables;
  }
}

// 3. SQLite Adapter
export class SqliteAdapter extends DbAdapter {
  private db: sqlite3.Database | null = null;
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const dbPath = this.config.filepath || path.join(process.cwd(), 'database.sqlite');
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else {
            this.db = null;
            resolve();
          }
        });
      });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.db) await this.connect();
      const rows = await this.query('SELECT 1 as ping');
      return rows.length > 0;
    } catch (error) {
      console.error('SQLite connection test failed:', error);
      return false;
    }
  }

  async executeReadOnly(sql: string): Promise<{ rows: any[]; fields: any[] }> {
    if (!this.db) await this.connect();
    const cleanSql = sql.trim().toLowerCase();
    if (!cleanSql.startsWith('select') && !cleanSql.startsWith('with')) {
      throw new Error('Only SELECT queries are allowed for execution');
    }
    const rows = await this.query(sql);
    const fields = rows.length > 0 ? Object.keys(rows[0]).map(key => ({ name: key })) : [];
    return { rows, fields };
  }

  async discoverSchema(): Promise<DiscoveredTable[]> {
    if (!this.db) await this.connect();

    // 1. Get all tables
    const tablesQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`;
    const tablesList = await this.query(tablesQuery);
    
    const discoveredTables: DiscoveredTable[] = [];

    for (const tbl of tablesList) {
      const tableName = tbl.name;
      
      // 2. Fetch table column details: cid, name, type, notnull, dflt_value, pk
      const colInfo = await this.query(`PRAGMA table_info("${tableName}");`);
      
      // 3. Fetch foreign key constraints: id, seq, table, from, to, on_update, on_delete, match
      const fkInfo = await this.query(`PRAGMA foreign_key_list("${tableName}");`);
      
      const columns: DiscoveredColumn[] = colInfo.map(col => {
        const isPk = col.pk > 0;
        const fkMatch = fkInfo.find((fk: any) => fk.from === col.name);
        
        return {
          name: col.name,
          dataType: col.type || 'text',
          isPrimaryKey: isPk,
          isForeignKey: !!fkMatch,
          referencedTable: fkMatch ? fkMatch.table : undefined,
          referencedColumn: fkMatch ? fkMatch.to : undefined
        };
      });

      discoveredTables.push({ name: tableName, columns });
    }

    return discoveredTables;
  }

  private query(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

// 4. Factory Method
export class DbAdapterFactory {
  static create(engine: 'postgres' | 'mysql' | 'sqlite', config: any): DbAdapter {
    switch (engine) {
      case 'postgres':
        return new PostgresAdapter(config);
      case 'mysql':
        return new MySqlAdapter(config);
      case 'sqlite':
        return new SqliteAdapter(config);
      default:
        throw new Error(`Unsupported database engine: ${engine}`);
    }
  }
}
