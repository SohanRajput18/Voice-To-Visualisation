# NLP-to-SQL Microservice

A Python Flask microservice that converts natural language queries into SQL statements using spaCy for natural language processing.

## Features

- **Natural Language Processing**: Converts human-readable queries to SQL
- **Multiple Query Types**: Supports basic SELECT, aggregations, pie charts, line charts
- **Query Validation**: Validates queries before processing
- **Flexible Schema**: Configurable database schema mapping
- **RESTful API**: Clean REST endpoints for integration

## Installation

1. **Install Python Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Install spaCy Model**:
   ```bash
   python -m spacy download en_core_web_sm
   ```

3. **Set Environment Variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Usage

### Start the Service

```bash
python app.py
```

The service will start on `http://localhost:5000`

### API Endpoints

#### Generate SQL
```bash
POST /generate-sql
Content-Type: application/json

{
  "text": "Show me sales by category"
}
```

Response:
```json
{
  "sql": "SELECT category, SUM(sales_amount) as total_sales FROM sales GROUP BY category ORDER BY total_sales DESC",
  "confidence": 0.85,
  "query_type": "aggregate",
  "timestamp": "2024-01-15T10:30:00"
}
```

#### Validate Query
```bash
POST /validate-query
Content-Type: application/json

{
  "text": "Show me revenue trends"
}
```

#### Health Check
```bash
GET /health
```

#### Get Query Types
```bash
GET /query-types
```

#### Get Examples
```bash
GET /examples
```

## Supported Query Types

### Basic Select
- "Show me all sales"
- "Get customer data"
- "List products"

### Aggregations
- "Total sales amount"
- "Count of customers"
- "Average revenue by quarter"

### Pie Charts
- "Show me a pie chart of sales by category"
- "Customer segment distribution"
- "Device usage breakdown"

### Line Charts
- "Show revenue trends over time"
- "Monthly sales performance"
- "Quarterly growth analysis"

### Filters
- "Sales in New York"
- "Revenue for Q1 2024"
- "Customers from last month"

## Database Schema

The service supports these tables:

### Sales Table
- `id`, `product_name`, `category`, `city`, `region`
- `sales_amount`, `quantity`, `sale_date`, `customer_segment`

### Revenue Table
- `id`, `quarter`, `year`, `department`
- `revenue_amount`, `target_amount`

### Customers Table
- `id`, `name`, `email`, `age`, `gender`, `city`
- `signup_date`, `total_purchases`, `customer_segment`

## Development

### Adding New Query Types

1. **Update Query Patterns**:
   ```python
   self.query_patterns['new_type'] = [
       r'pattern1',
       r'pattern2'
   ]
   ```

2. **Add Detection Method**:
   ```python
   def _is_new_type_query(self, text: str) -> bool:
       indicators = ['keyword1', 'keyword2']
       return any(indicator in text for indicator in indicators)
   ```

3. **Add Generation Method**:
   ```python
   def _generate_new_type_sql(self, text: str) -> str:
       # SQL generation logic
       return sql_query
   ```

### Testing

```bash
# Test the service
curl -X POST http://localhost:5000/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"text": "Show me total sales by region"}'
```

## Production Deployment

### Using Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Docker Deployment

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN python -m spacy download en_core_web_sm

COPY . .
EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

## Error Handling

The service includes comprehensive error handling:

- **Validation Errors**: Invalid input format
- **Processing Errors**: NLP processing failures
- **SQL Generation Errors**: Failed query generation
- **Service Errors**: Internal server errors

## Logging

Logs include:
- Query processing steps
- Generated SQL queries
- Error details and stack traces
- Performance metrics

## Security Considerations

- Input validation and sanitization
- SQL injection prevention
- Rate limiting (recommended for production)
- Authentication (can be added as middleware)