import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AuthController } from './controllers/auth.controller';
import { QueryController } from './controllers/query.controller';
import { authenticateToken } from './middleware/auth.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // For dev environments. In production, configure explicitly.
  credentials: true
}));

// Parse body JSON
app.use(express.json());

// Base health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'Voice-to-Visualization API' });
});

// Authentication Routes
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/me', authenticateToken as any, AuthController.getMe as any);

// Voice-to-SQL Analytics Routes
app.post('/api/query/process', authenticateToken as any, QueryController.processQuery as any);
app.get('/api/query/history', authenticateToken as any, QueryController.getHistory as any);
app.get('/api/query/schema', authenticateToken as any, QueryController.getSchema as any);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error occurred' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
