# Voice-to-Visualization Backend

A Node.js + Express backend API that processes voice queries and converts them into data visualizations through natural language processing and SQL generation.

## Architecture

```
[Voice Input] → [Speech-to-Text] → [NLP Service] → [SQL Execution] → [Data Visualization]
```

## Features

- **🎤 Speech Processing**: Google Speech-to-Text integration
- **🧠 NLP Integration**: Python microservice for natural language to SQL conversion
- **🗄️ Database Management**: PostgreSQL with sample data
- **🔐 Authentication**: JWT-based user authentication
- **📊 Query History**: Track and manage user queries
- **🛡️ Security**: Helmet, CORS, input validation
- **📝 Logging**: Comprehensive request and error logging

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Speech**: Google Cloud Speech-to-Text
- **NLP**: Python Flask microservice
- **Validation**: Joi
- **Security**: Helmet, CORS, bcryptjs

## Installation

### Prerequisites

- Node.js 16+
- PostgreSQL 12+
- Google Cloud account (for Speech-to-Text)
- Python 3.8+ (for NLP service)

### Setup

1. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**:
   ```bash
   # Create PostgreSQL database
   createdb voice_visualization
   
   # Tables will be created automatically on first run
   ```

4. **Google Cloud Setup**:
   ```bash
   # Download service account key from Google Cloud Console
   # Set GOOGLE_APPLICATION_CREDENTIALS in .env
   ```

5. **Start NLP Service**:
   ```bash
   cd ../nlp-service
   pip install -r requirements.txt
   python -m spacy download en_core_web_sm
   python app.py
   ```

6. **Start Backend**:
   ```bash
   cd ../backend
   npm run dev
   ```

## API Endpoints

### Authentication

#### Register User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword"
}
```

#### Get Profile
```bash
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

### Speech Processing

#### Transcribe Audio
```bash
POST /api/speech/transcribe
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

# Form data with 'audio' file field
```

Response:
```json
{
  "success": true,
  "transcription": "Show me sales by category",
  "confidence": 0.95,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Query Processing

#### Process Natural Language Query
```bash
POST /api/query/process
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "text": "Show me quarterly revenue trends"
}
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "x": ["Q1", "Q2", "Q3", "Q4"],
      "y": [125000, 142000, 138000, 165000],
      "type": "bar",
      "name": "Revenue"
    }
  ],
  "metadata": {
    "title": "Quarterly Revenue Performance",
    "description": "Revenue growth across fiscal quarters",
    "chartType": "bar",
    "columns": ["Quarter", "Revenue"],
    "rowCount": 4
  },
  "rawData": [...],
  "query": {
    "original": "Show me quarterly revenue trends",
    "sql": "SELECT quarter, SUM(revenue_amount) as total_revenue FROM revenue GROUP BY quarter ORDER BY quarter",
    "executedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Get Query History
```bash
GET /api/query/history?limit=10&offset=0
Authorization: Bearer <jwt_token>
```

#### Delete Query from History
```bash
DELETE /api/query/history/:queryId
Authorization: Bearer <jwt_token>
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Query History Table
```sql
CREATE TABLE query_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  original_query TEXT NOT NULL,
  sql_query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Sample Data Tables

#### Sales Table
- Product sales data with categories, regions, amounts
- Used for sales analysis and product performance queries

#### Revenue Table
- Quarterly revenue data by department
- Used for financial trend analysis

#### Customers Table
- Customer demographics and purchase history
- Used for customer segmentation and analysis

## Services

### Speech Service (`services/speechService.js`)
- Google Cloud Speech-to-Text integration
- Audio format handling and validation
- Confidence scoring and error handling

### NLP Service (`services/nlpService.js`)
- Communication with Python NLP microservice
- Query validation and type classification
- Error handling and fallback mechanisms

### Database Service (`services/dbService.js`)
- PostgreSQL connection management
- Query execution and result formatting
- User management and query history

## Middleware

### Authentication Middleware (`middleware/authMiddleware.js`)
- JWT token validation
- User context injection
- Protected route handling

### Error Handler (`middleware/errorHandler.js`)
- Global error handling
- Structured error responses
- Security-conscious error messages

## Utilities

### Data Formatter (`utils/formatter.js`)
- Raw data to visualization format conversion
- Chart type determination
- Color palette generation

## Development

### Running in Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Production Deployment

### Environment Variables
```bash
NODE_ENV=production
PORT=3001
DB_HOST=your-db-host
DB_PASSWORD=your-secure-password
JWT_SECRET=your-super-secret-key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Process Management
```bash
# Using PM2
npm install -g pm2
pm2 start server.js --name voice-backend

# Using Docker
docker build -t voice-backend .
docker run -p 3001:3001 voice-backend
```

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs with salt rounds
- **Input Validation**: Joi schema validation
- **SQL Injection Prevention**: Parameterized queries
- **CORS Protection**: Configurable origin restrictions
- **Helmet Security**: Security headers and protections
- **Rate Limiting**: (Recommended for production)

## Monitoring and Logging

- **Request Logging**: Morgan HTTP request logger
- **Error Logging**: Comprehensive error tracking
- **Health Checks**: Service health monitoring endpoints
- **Performance Metrics**: Query execution timing

## Error Handling

The API provides structured error responses:

```json
{
  "error": "Validation error",
  "message": "Invalid input format",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/query/process",
  "method": "POST"
}
```

## Integration with Frontend

The backend is designed to work seamlessly with the React frontend:

1. **Authentication Flow**: Login/register with JWT tokens
2. **Voice Processing**: Audio upload and transcription
3. **Query Processing**: Natural language to visualization
4. **Real-time Updates**: WebSocket support (can be added)

## Troubleshooting

### Common Issues

1. **Google Speech API Errors**:
   - Check service account credentials
   - Verify API is enabled in Google Cloud Console

2. **Database Connection Issues**:
   - Verify PostgreSQL is running
   - Check connection parameters in .env

3. **NLP Service Unavailable**:
   - Ensure Python service is running on port 5000
   - Check NLP_SERVICE_URL configuration

4. **JWT Token Issues**:
   - Verify JWT_SECRET is set
   - Check token expiration settings

### Debugging

Enable debug logging:
```bash
DEBUG=* npm run dev
```

Check service health:
```bash
curl http://localhost:3001/health
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details