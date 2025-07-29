import spacy
import re
import pandas as pd
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class NLPToSQL:
    def __init__(self):
        """Initialize the NLP to SQL converter"""
        try:
            # Load spaCy model (install with: python -m spacy download en_core_web_sm)
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model not found. Install with: python -m spacy download en_core_web_sm")
            self.nlp = None
        
        # Database schema mapping
        self.schema = {
            'sales': {
                'columns': ['id', 'product_name', 'category', 'city', 'region', 'sales_amount', 'quantity', 'sale_date', 'customer_segment'],
                'types': {
                    'id': 'integer',
                    'product_name': 'string',
                    'category': 'string',
                    'city': 'string',
                    'region': 'string',
                    'sales_amount': 'decimal',
                    'quantity': 'integer',
                    'sale_date': 'date',
                    'customer_segment': 'string'
                }
            },
            'revenue': {
                'columns': ['id', 'quarter', 'year', 'department', 'revenue_amount', 'target_amount'],
                'types': {
                    'id': 'integer',
                    'quarter': 'string',
                    'year': 'integer',
                    'department': 'string',
                    'revenue_amount': 'decimal',
                    'target_amount': 'decimal'
                }
            },
            'customers': {
                'columns': ['id', 'name', 'email', 'age', 'gender', 'city', 'signup_date', 'total_purchases', 'customer_segment'],
                'types': {
                    'id': 'integer',
                    'name': 'string',
                    'email': 'string',
                    'age': 'integer',
                    'gender': 'string',
                    'city': 'string',
                    'signup_date': 'date',
                    'total_purchases': 'decimal',
                    'customer_segment': 'string'
                }
            }
        }
        
        # Query patterns and mappings
        self.query_patterns = {
            'select_all': [
                r'show\s+(?:me\s+)?(?:all\s+)?(.+)',
                r'get\s+(?:me\s+)?(?:all\s+)?(.+)',
                r'list\s+(?:all\s+)?(.+)',
                r'display\s+(?:all\s+)?(.+)',
                r'find\s+(?:all\s+)?(.+)'
            ],
            'aggregate': [
                r'total\s+(.+)',
                r'sum\s+(?:of\s+)?(.+)',
                r'count\s+(?:of\s+)?(.+)',
                r'average\s+(?:of\s+)?(.+)',
                r'avg\s+(?:of\s+)?(.+)',
                r'maximum\s+(?:of\s+)?(.+)',
                r'max\s+(?:of\s+)?(.+)',
                r'minimum\s+(?:of\s+)?(.+)',
                r'min\s+(?:of\s+)?(.+)'
            ],
            'filter': [
                r'(.+)\s+(?:in|from)\s+(.+)',
                r'(.+)\s+(?:where|with)\s+(.+)',
                r'(.+)\s+(?:for|of)\s+(.+)'
            ],
            'time_filter': [
                r'(.+)\s+(?:in|for|during)\s+(january|february|march|april|may|june|july|august|september|october|november|december)',
                r'(.+)\s+(?:in|for|during)\s+(q1|q2|q3|q4|quarter\s+\d)',
                r'(.+)\s+(?:in|for|during)\s+(\d{4})',
                r'(.+)\s+(?:last|past)\s+(week|month|quarter|year)',
                r'(.+)\s+(?:this|current)\s+(week|month|quarter|year)'
            ]
        }
        
        # Word to table/column mappings
        self.word_mappings = {
            'sales': ['sales', 'sale', 'selling', 'sold', 'purchase', 'buy', 'bought'],
            'revenue': ['revenue', 'income', 'earnings', 'profit', 'money'],
            'customers': ['customers', 'customer', 'clients', 'client', 'users', 'user'],
            'products': ['products', 'product', 'items', 'item', 'goods'],
            'amount': ['amount', 'value', 'price', 'cost', 'total'],
            'quantity': ['quantity', 'qty', 'count', 'number', 'amount'],
            'city': ['city', 'cities', 'location', 'place'],
            'region': ['region', 'area', 'zone', 'territory'],
            'category': ['category', 'type', 'kind', 'group'],
            'date': ['date', 'time', 'when', 'period']
        }
        
        # Last query metadata
        self.last_confidence = 0.0
        self.last_query_type = 'unknown'

    def convert_to_sql(self, text: str) -> Optional[str]:
        """Convert natural language text to SQL query"""
        try:
            text = text.lower().strip()
            logger.info(f"Converting to SQL: {text}")
            
            # Determine query type and generate SQL
            if self._is_pie_chart_query(text):
                return self._generate_pie_chart_sql(text)
            elif self._is_line_chart_query(text):
                return self._generate_line_chart_sql(text)
            elif self._is_aggregate_query(text):
                return self._generate_aggregate_sql(text)
            else:
                return self._generate_basic_select_sql(text)
                
        except Exception as e:
            logger.error(f"Error converting to SQL: {str(e)}")
            return None

    def _is_pie_chart_query(self, text: str) -> bool:
        """Check if query is asking for pie chart data"""
        pie_indicators = ['pie', 'distribution', 'share', 'percentage', 'proportion', 'breakdown']
        return any(indicator in text for indicator in pie_indicators)

    def _is_line_chart_query(self, text: str) -> bool:
        """Check if query is asking for line chart data"""
        line_indicators = ['line', 'trend', 'over time', 'timeline', 'time series', 'monthly', 'quarterly', 'yearly']
        return any(indicator in text for indicator in line_indicators)

    def _is_aggregate_query(self, text: str) -> bool:
        """Check if query requires aggregation"""
        agg_indicators = ['total', 'sum', 'count', 'average', 'avg', 'max', 'min', 'group by']
        return any(indicator in text for indicator in agg_indicators)

    def _generate_pie_chart_sql(self, text: str) -> str:
        """Generate SQL for pie chart visualization"""
        self.last_query_type = 'pie_chart'
        self.last_confidence = 0.8
        
        if 'device' in text or 'usage' in text:
            # Mock device usage data
            return """
            SELECT 'Desktop' as device, 35 as usage_percentage
            UNION ALL SELECT 'Mobile', 25
            UNION ALL SELECT 'Tablet', 20
            UNION ALL SELECT 'Smart TV', 15
            UNION ALL SELECT 'Other', 5
            """
        elif 'sales' in text and ('category' in text or 'product' in text):
            return "SELECT category, SUM(sales_amount) as total_sales FROM sales GROUP BY category ORDER BY total_sales DESC"
        elif 'customer' in text and 'segment' in text:
            return "SELECT customer_segment, COUNT(*) as customer_count FROM customers GROUP BY customer_segment ORDER BY customer_count DESC"
        else:
            # Default pie chart query
            return "SELECT category, SUM(sales_amount) as total_sales FROM sales GROUP BY category ORDER BY total_sales DESC LIMIT 5"

    def _generate_line_chart_sql(self, text: str) -> str:
        """Generate SQL for line chart visualization"""
        self.last_query_type = 'line_chart'
        self.last_confidence = 0.85
        
        if 'performance' in text or 'trend' in text:
            # Mock performance trend data
            return """
            SELECT 'Jan' as month, 65 as performance_score
            UNION ALL SELECT 'Feb', 72
            UNION ALL SELECT 'Mar', 68
            UNION ALL SELECT 'Apr', 75
            UNION ALL SELECT 'May', 82
            UNION ALL SELECT 'Jun', 78
            ORDER BY 
                CASE month 
                    WHEN 'Jan' THEN 1 WHEN 'Feb' THEN 2 WHEN 'Mar' THEN 3 
                    WHEN 'Apr' THEN 4 WHEN 'May' THEN 5 WHEN 'Jun' THEN 6 
                END
            """
        elif 'revenue' in text and ('quarter' in text or 'time' in text):
            return "SELECT quarter, SUM(revenue_amount) as total_revenue FROM revenue GROUP BY quarter ORDER BY quarter"
        elif 'sales' in text and 'month' in text:
            return "SELECT EXTRACT(MONTH FROM sale_date) as month, SUM(sales_amount) as monthly_sales FROM sales GROUP BY EXTRACT(MONTH FROM sale_date) ORDER BY month"
        else:
            # Default line chart query
            return "SELECT quarter, SUM(revenue_amount) as total_revenue FROM revenue GROUP BY quarter ORDER BY quarter"

    def _generate_aggregate_sql(self, text: str) -> str:
        """Generate SQL for aggregate queries"""
        self.last_query_type = 'aggregate'
        self.last_confidence = 0.9
        
        table = self._identify_table(text)
        
        if 'total' in text or 'sum' in text:
            if table == 'sales':
                return "SELECT SUM(sales_amount) as total_sales FROM sales"
            elif table == 'revenue':
                return "SELECT SUM(revenue_amount) as total_revenue FROM revenue"
        elif 'count' in text:
            if table == 'customers':
                return "SELECT COUNT(*) as customer_count FROM customers"
            elif table == 'sales':
                return "SELECT COUNT(*) as sales_count FROM sales"
        elif 'average' in text or 'avg' in text:
            if table == 'sales':
                return "SELECT AVG(sales_amount) as average_sales FROM sales"
            elif table == 'customers':
                return "SELECT AVG(age) as average_age FROM customers"
        
        # Default aggregate query
        return "SELECT quarter, SUM(revenue_amount) as total_revenue FROM revenue GROUP BY quarter ORDER BY quarter"

    def _generate_basic_select_sql(self, text: str) -> str:
        """Generate basic SELECT SQL query"""
        self.last_query_type = 'basic_select'
        self.last_confidence = 0.7
        
        table = self._identify_table(text)
        columns = self._identify_columns(text, table)
        where_clause = self._generate_where_clause(text, table)
        
        # Build SQL query
        if columns:
            column_str = ', '.join(columns)
        else:
            column_str = '*'
        
        sql = f"SELECT {column_str} FROM {table}"
        
        if where_clause:
            sql += f" WHERE {where_clause}"
        
        sql += " LIMIT 100"  # Add limit for safety
        
        return sql

    def _identify_table(self, text: str) -> str:
        """Identify the main table from the query text"""
        for table, keywords in self.word_mappings.items():
            if table in self.schema and any(keyword in text for keyword in keywords):
                return table
        
        # Default to sales table
        return 'sales'

    def _identify_columns(self, text: str, table: str) -> List[str]:
        """Identify relevant columns from the query text"""
        if table not in self.schema:
            return ['*']
        
        columns = []
        table_columns = self.schema[table]['columns']
        
        # Check for specific column mentions
        for column in table_columns:
            if column in text or column.replace('_', ' ') in text:
                columns.append(column)
        
        # Check for mapped words
        for column_key, keywords in self.word_mappings.items():
            if any(keyword in text for keyword in keywords):
                # Find matching column in table
                matching_cols = [col for col in table_columns if column_key in col.lower()]
                columns.extend(matching_cols)
        
        return list(set(columns)) if columns else []

    def _generate_where_clause(self, text: str, table: str) -> Optional[str]:
        """Generate WHERE clause from query text"""
        conditions = []
        
        # Look for city filters
        cities = ['new york', 'los angeles', 'chicago', 'miami', 'seattle', 'boston', 'austin', 'denver', 'portland', 'atlanta']
        for city in cities:
            if city in text:
                conditions.append(f"LOWER(city) = '{city}'")
                break
        
        # Look for date filters
        months = ['january', 'february', 'march', 'april', 'may', 'june', 
                 'july', 'august', 'september', 'october', 'november', 'december']
        for i, month in enumerate(months, 1):
            if month in text:
                if table == 'sales':
                    conditions.append(f"EXTRACT(MONTH FROM sale_date) = {i}")
                elif table == 'customers':
                    conditions.append(f"EXTRACT(MONTH FROM signup_date) = {i}")
                break
        
        # Look for year filters
        year_match = re.search(r'\b(20\d{2})\b', text)
        if year_match:
            year = year_match.group(1)
            if table == 'sales':
                conditions.append(f"EXTRACT(YEAR FROM sale_date) = {year}")
            elif table == 'revenue':
                conditions.append(f"year = {year}")
        
        return ' AND '.join(conditions) if conditions else None

    def validate_query(self, text: str) -> Dict:
        """Validate natural language query"""
        try:
            text = text.lower().strip()
            
            # Basic validation
            if len(text) < 3:
                return {
                    'valid': False,
                    'confidence': 0,
                    'reason': 'Query too short',
                    'suggestions': ['Please provide a more detailed query']
                }
            
            # Check for data-related keywords
            data_keywords = ['show', 'get', 'find', 'list', 'display', 'sales', 'revenue', 'customer', 'product']
            has_data_keyword = any(keyword in text for keyword in data_keywords)
            
            if not has_data_keyword:
                return {
                    'valid': False,
                    'confidence': 0.3,
                    'reason': 'No data-related keywords found',
                    'suggestions': ['Try using words like "show", "get", "sales", "revenue"']
                }
            
            # Determine confidence based on keyword matches
            confidence = 0.5
            if any(table in text for table in self.schema.keys()):
                confidence += 0.2
            if any(pattern_list for pattern_list in self.query_patterns.values() 
                   if any(re.search(pattern, text) for pattern in pattern_list)):
                confidence += 0.2
            
            return {
                'valid': True,
                'confidence': min(confidence, 1.0),
                'query_type': self._classify_query_type(text),
                'suggestions': []
            }
            
        except Exception as e:
            logger.error(f"Query validation error: {str(e)}")
            return {
                'valid': False,
                'confidence': 0,
                'reason': 'Validation error',
                'suggestions': ['Please try rephrasing your query']
            }

    def _classify_query_type(self, text: str) -> str:
        """Classify the type of query"""
        if self._is_pie_chart_query(text):
            return 'pie_chart'
        elif self._is_line_chart_query(text):
            return 'line_chart'
        elif self._is_aggregate_query(text):
            return 'aggregate'
        else:
            return 'basic_select'

    def get_last_confidence(self) -> float:
        """Get confidence score of last query"""
        return self.last_confidence

    def get_last_query_type(self) -> str:
        """Get type of last query"""
        return self.last_query_type

    def get_supported_query_types(self) -> List[str]:
        """Get list of supported query types"""
        return [
            'basic_select',
            'aggregate',
            'pie_chart',
            'line_chart',
            'filter',
            'time_series'
        ]

    def get_example_queries(self) -> Dict[str, List[str]]:
        """Get example queries for each type"""
        return {
            'basic_select': [
                'Show me all sales',
                'Get customer data',
                'List all products'
            ],
            'aggregate': [
                'Total sales amount',
                'Count of customers',
                'Average revenue'
            ],
            'pie_chart': [
                'Show me a pie chart of sales by category',
                'Device usage distribution',
                'Customer segment breakdown'
            ],
            'line_chart': [
                'Show revenue trends over time',
                'Performance trend analysis',
                'Monthly sales timeline'
            ],
            'filter': [
                'Sales in New York',
                'Revenue for Q1',
                'Customers from last month'
            ]
        }