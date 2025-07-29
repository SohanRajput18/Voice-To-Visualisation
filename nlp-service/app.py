from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import logging
from nlp_to_sql import NLPToSQL

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize NLP service
nlp_service = NLPToSQL()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        return jsonify({
            'status': 'healthy',
            'service': 'NLP-to-SQL Service',
            'version': '1.0.0',
            'timestamp': str(pd.Timestamp.now())
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 503

@app.route('/generate-sql', methods=['POST'])
def generate_sql():
    """Generate SQL query from natural language text"""
    try:
        # Validate request
        if not request.json or 'text' not in request.json:
            return jsonify({
                'error': 'Missing required field: text'
            }), 400

        text = request.json['text'].strip()
        
        if not text:
            return jsonify({
                'error': 'Text field cannot be empty'
            }), 400

        logger.info(f"Processing query: {text}")

        # Generate SQL using NLP service
        sql_query = nlp_service.convert_to_sql(text)
        
        if not sql_query:
            return jsonify({
                'error': 'Could not generate SQL from the provided text',
                'suggestions': [
                    'Try being more specific about what data you want',
                    'Include table names or column names if known',
                    'Use keywords like "show", "get", "find", "list"'
                ]
            }), 400

        logger.info(f"Generated SQL: {sql_query}")

        return jsonify({
            'sql': sql_query,
            'confidence': nlp_service.get_last_confidence(),
            'query_type': nlp_service.get_last_query_type(),
            'timestamp': str(pd.Timestamp.now())
        }), 200

    except Exception as e:
        logger.error(f"SQL generation error: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': 'Failed to process natural language query'
        }), 500

@app.route('/validate-query', methods=['POST'])
def validate_query():
    """Validate natural language query before processing"""
    try:
        if not request.json or 'text' not in request.json:
            return jsonify({
                'error': 'Missing required field: text'
            }), 400

        text = request.json['text'].strip()
        
        if not text:
            return jsonify({
                'valid': False,
                'confidence': 0,
                'reason': 'Empty query'
            }), 200

        # Validate query using NLP service
        validation_result = nlp_service.validate_query(text)
        
        return jsonify(validation_result), 200

    except Exception as e:
        logger.error(f"Query validation error: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': 'Failed to validate query'
        }), 500

@app.route('/query-types', methods=['GET'])
def get_query_types():
    """Get supported query types"""
    try:
        query_types = nlp_service.get_supported_query_types()
        
        return jsonify({
            'types': query_types,
            'count': len(query_types)
        }), 200

    except Exception as e:
        logger.error(f"Query types error: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': 'Failed to get query types'
        }), 500

@app.route('/examples', methods=['GET'])
def get_examples():
    """Get example queries for different types"""
    try:
        examples = nlp_service.get_example_queries()
        
        return jsonify({
            'examples': examples
        }), 200

    except Exception as e:
        logger.error(f"Examples error: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': 'Failed to get examples'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'message': 'The requested endpoint does not exist'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f"Starting NLP-to-SQL service on port {port}")
    logger.info(f"Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)