import { Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { DbAdapterFactory } from '../services/db-adapter';
import { encrypt, decrypt } from '../utils/db-encryption';

// In-memory guest connections registry
const guestConnections = new Map<string, any[]>();

export class ConnectionController {
  /**
   * Tests a database connection configuration before saving.
   */
  static async testConnection(req: AuthenticatedRequest, res: Response) {
    const { engine, config } = req.body;

    if (!engine || !config) {
      return res.status(400).json({ error: 'Engine type and config parameters are required' });
    }

    try {
      const adapter = DbAdapterFactory.create(engine, config);
      const isConnected = await adapter.testConnection();
      await adapter.disconnect();

      if (isConnected) {
        return res.status(200).json({ success: true, message: 'Database connection test successful!' });
      } else {
        return res.status(400).json({ success: false, error: 'Database connection test failed. Please check credentials.' });
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      return res.status(500).json({ success: false, error: `Connection test error: ${error.message}` });
    }
  }

  /**
   * Saves a new database connection configuration (encrypted parameters).
   */
  static async saveConnection(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const guestSessionId = req.user?.guestSessionId;
    const { name, engine, config, is_active } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!name || !engine || !config) {
      return res.status(400).json({ error: 'Name, engine type, and config parameters are required' });
    }

    try {
      // 1. Verify connection works
      const adapter = DbAdapterFactory.create(engine, config);
      const works = await adapter.testConnection();
      await adapter.disconnect();

      if (!works) {
        return res.status(400).json({ error: 'Could not connect to the database. Verify connection details first.' });
      }

      // 2. Encrypt connection data
      const encryptedData = encrypt(JSON.stringify(config));

      // Guest flow
      if (guestSessionId) {
        let userConns = guestConnections.get(guestSessionId) || [];
        
        // If active, deactivate others
        if (is_active) {
          userConns = userConns.map(c => ({ ...c, is_active: false }));
        }

        const connId = Math.floor(Math.random() * 1000000) + 1;
        const newConn = {
          id: connId,
          name,
          engine,
          connection_data: encryptedData,
          is_active: !!is_active,
          created_at: new Date().toISOString()
        };

        guestConnections.set(guestSessionId, [...userConns, newConn]);

        return res.status(201).json({
          message: 'Database connection saved successfully',
          connection: {
            id: newConn.id,
            name: newConn.name,
            engine: newConn.engine,
            is_active: newConn.is_active,
            created_at: newConn.created_at
          }
        });
      }

      // 3. Save to DB (regular user)
      const result = await pool.query(
        `INSERT INTO db_connections (user_id, name, engine, connection_data, is_active) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, engine, is_active, created_at`,
        [userId, name, engine, encryptedData, !!is_active]
      );

      const savedConn = result.rows[0];

      // 4. If active, deactivate others
      if (is_active) {
        await pool.query(
          'UPDATE db_connections SET is_active = false WHERE user_id = $1 AND id != $2',
          [userId, savedConn.id]
        );
      }

      return res.status(201).json({
        message: 'Database connection saved successfully',
        connection: savedConn
      });

    } catch (error: any) {
      console.error('Save connection error:', error);
      return res.status(500).json({ error: `Failed to save connection: ${error.message}` });
    }
  }

  /**
   * Lists all saved connection configurations for the user.
   * Redacts sensitive password strings.
   */
  static async listConnections(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const guestSessionId = req.user?.guestSessionId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      let conns: any[] = [];

      if (guestSessionId) {
        conns = guestConnections.get(guestSessionId) || [];
      } else {
        const { rows } = await pool.query(
          `SELECT id, name, engine, connection_data, is_active, created_at 
           FROM db_connections 
           WHERE user_id = $1 
           ORDER BY created_at DESC`,
          [userId]
        );
        conns = rows;
      }

      const parsedRows = conns.map(r => {
        let host = 'localhost';
        let database = '';
        try {
          const config = JSON.parse(decrypt(r.connection_data));
          host = config.host || 'localhost';
          database = config.database || '';
          if (r.engine === 'sqlite') {
            host = config.filepath || 'database.sqlite';
          }
        } catch (_) {}

        return {
          id: r.id,
          name: r.name,
          engine: r.engine,
          is_active: r.is_active,
          created_at: r.created_at,
          host,
          database
        };
      });

      return res.status(200).json({ connections: parsedRows });
    } catch (error) {
      console.error('List connections error:', error);
      return res.status(500).json({ error: 'Failed to list connections' });
    }
  }

  /**
   * Activates a database connection.
   */
  static async activateConnection(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const guestSessionId = req.user?.guestSessionId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      if (guestSessionId) {
        let userConns = guestConnections.get(guestSessionId) || [];
        const connExists = userConns.some(c => c.id === Number(id));
        
        if (!connExists) {
          return res.status(404).json({ error: 'Connection profile not found' });
        }

        userConns = userConns.map(c => ({
          ...c,
          is_active: c.id === Number(id)
        }));

        guestConnections.set(guestSessionId, userConns);
        return res.status(200).json({ message: 'Database connection activated' });
      }

      const checkResult = await pool.query(
        'SELECT id FROM db_connections WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Connection profile not found' });
      }

      await pool.query(
        'UPDATE db_connections SET is_active = (id = $1) WHERE user_id = $2',
        [id, userId]
      );

      return res.status(200).json({ message: 'Database connection activated' });
    } catch (error) {
      console.error('Activate connection error:', error);
      return res.status(500).json({ error: 'Failed to activate connection' });
    }
  }

  /**
   * Deletes a connection configuration.
   */
  static async deleteConnection(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const guestSessionId = req.user?.guestSessionId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      if (guestSessionId) {
        let userConns = guestConnections.get(guestSessionId) || [];
        const targetConn = userConns.find(c => c.id === Number(id));

        if (!targetConn) {
          return res.status(404).json({ error: 'Connection profile not found' });
        }

        userConns = userConns.filter(c => c.id !== Number(id));
        if (targetConn.is_active && userConns.length > 0) {
          userConns[0].is_active = true;
        }

        guestConnections.set(guestSessionId, userConns);
        return res.status(200).json({ message: 'Database connection deleted' });
      }

      const result = await pool.query(
        'DELETE FROM db_connections WHERE id = $1 AND user_id = $2 RETURNING is_active',
        [id, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Connection profile not found' });
      }

      // If we deleted the active connection, set another one active if possible
      if (result.rows[0].is_active) {
        await pool.query(
          `UPDATE db_connections SET is_active = true 
           WHERE id = (SELECT id FROM db_connections WHERE user_id = $1 LIMIT 1)`,
          [userId]
        );
      }

      return res.status(200).json({ message: 'Database connection deleted' });
    } catch (error) {
      console.error('Delete connection error:', error);
      return res.status(500).json({ error: 'Failed to delete connection' });
    }
  }

  /**
   * Internal helper to retrieve user's active database adapter.
   */
  static async getActiveAdapter(userId: number, guestSessionId?: string): Promise<{ adapter: any; connectionId: number } | null> {
    if (guestSessionId) {
      const userConns = guestConnections.get(guestSessionId) || [];
      const activeConn = userConns.find(c => c.is_active === true);
      
      if (!activeConn) return null;

      const decryptedConfig = JSON.parse(decrypt(activeConn.connection_data));
      const adapter = DbAdapterFactory.create(activeConn.engine, decryptedConfig);
      
      return {
        adapter,
        connectionId: activeConn.id
      };
    }

    const { rows } = await pool.query(
      `SELECT id, engine, connection_data FROM db_connections 
       WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    const decryptedConfig = JSON.parse(decrypt(row.connection_data));
    const adapter = DbAdapterFactory.create(row.engine, decryptedConfig);
    
    return {
      adapter,
      connectionId: row.id
    };
  }
}
