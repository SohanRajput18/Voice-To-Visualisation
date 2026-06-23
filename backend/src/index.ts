import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AuthController } from './controllers/auth.controller';
import { QueryController } from './controllers/query.controller';
import { ConnectionController } from './controllers/connection.controller';
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
app.post('/api/auth/guest', AuthController.guestLogin);
app.get('/api/auth/me', authenticateToken as any, AuthController.getMe as any);

// Voice-to-SQL Analytics Routes
app.post('/api/query/process', authenticateToken as any, QueryController.processQuery as any);
app.get('/api/query/history', authenticateToken as any, QueryController.getHistory as any);
app.delete('/api/query/history', authenticateToken as any, QueryController.clearHistory as any);
app.delete('/api/query/history/:id', authenticateToken as any, QueryController.deleteHistoryItem as any);
app.get('/api/query/schema', authenticateToken as any, QueryController.getSchema as any);
app.get('/api/query/analytics', authenticateToken as any, QueryController.getAnalytics as any);

// Database Connections Profiles Management Routes
app.post('/api/connection/test', authenticateToken as any, ConnectionController.testConnection as any);
app.post('/api/connection/save', authenticateToken as any, ConnectionController.saveConnection as any);
app.get('/api/connection/list', authenticateToken as any, ConnectionController.listConnections as any);
app.post('/api/connection/activate/:id', authenticateToken as any, ConnectionController.activateConnection as any);
app.delete('/api/connection/:id', authenticateToken as any, ConnectionController.deleteConnection as any);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error occurred' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
