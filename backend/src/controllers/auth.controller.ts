import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'vtov_jwt_secure_secret_key_12345';
const TOKEN_EXPIRY = '7d';

export class AuthController {
  /**
   * Registers a new user.
   */
  static async register(req: AuthenticatedRequest, res: Response) {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    try {
      // 1. Check if user already exists
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email, username]
      );

      if (userCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }

      // 2. Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // 3. Create user in DB
      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
        [username, email, passwordHash]
      );

      const user = result.rows[0];

      // 4. Generate JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'An error occurred during registration' });
    }
  }

  /**
   * Authenticates an existing user.
   */
  static async login(req: AuthenticatedRequest, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      // 1. Find user by email
      const result = await pool.query(
        'SELECT id, username, email, password_hash FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = result.rows[0];

      // 2. Compare passwords
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // 3. Generate JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'An error occurred during login' });
    }
  }

  /**
   * Returns current user details based on verification token.
   */
  static async getMe(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.status(200).json({ user: req.user });
  }
}
