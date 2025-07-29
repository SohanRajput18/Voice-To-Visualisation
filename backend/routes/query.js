const express = require('express');
const Joi = require('joi');
const nlpService = require('../services/nlpService');
const dbService = require('../services/dbService');
const formatter = require('../utils/formatter');

const router = express.Router();

// Validation schema
const querySchema = Joi.object({
  text: Joi.string().min(3).max(500).required()
});

// Process natural language query
router.post('/process', async (req, res) => {
  try {
    // Validate input
    const { error, value } = querySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { text } = value;

    console.log(`Processing query: "${text}"`);

    // Step 1: Convert natural language to SQL using Python NLP service
    const sqlQuery = await nlpService.generateSQL(text);
    
    if (!sqlQuery) {
      return res.status(400).json({
        error: 'Query processing failed',
        message: 'Could not understand the query. Please try rephrasing.'
      });
    }

    console.log('Generated SQL:', sqlQuery);

    // Step 2: Execute SQL query on database
    const rawData = await dbService.executeQuery(sqlQuery);

    if (!rawData || rawData.length === 0) {
      return res.status(404).json({
        error: 'No data found',
        message: 'The query returned no results'
      });
    }

    // Step 3: Format data for visualization
    const formattedResult = formatter.formatForVisualization(rawData, text);

    res.json({
      success: true,
      data: formattedResult.data,
      metadata: {
        title: formattedResult.title,
        description: formattedResult.description,
        chartType: formattedResult.chartType,
        columns: formattedResult.columns,
        rowCount: rawData.length
      },
      rawData,
      query: {
        original: text,
        sql: sqlQuery,
        executedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Query processing error:', error);

    if (error.message.includes('SQL syntax error')) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'The generated query contains syntax errors'
      });
    }

    if (error.message.includes('NLP service unavailable')) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Natural language processing service is currently unavailable'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process query'
    });
  }
});

module.exports = router;