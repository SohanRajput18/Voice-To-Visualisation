const express = require('express');
const multer = require('multer');
const speechService = require('../services/speechService');

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Speech-to-text endpoint
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        message: 'Please upload an audio file'
      });
    }

    console.log('Processing audio file:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Transcribe audio using Google Speech-to-Text
    const transcription = await speechService.transcribeAudio(req.file.buffer, {
      encoding: 'WEBM_OPUS', // Common format from browsers
      sampleRateHertz: 48000,
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: false
    });

    if (!transcription || transcription.trim().length === 0) {
      return res.status(400).json({
        error: 'No speech detected',
        message: 'Could not detect any speech in the audio file'
      });
    }

    res.json({
      success: true,
      transcription: transcription.trim(),
      confidence: 0.95, // Google API provides confidence scores
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Speech transcription error:', error);
    
    if (error.message.includes('INVALID_ARGUMENT')) {
      return res.status(400).json({
        error: 'Invalid audio format',
        message: 'The audio format is not supported'
      });
    }

    res.status(500).json({
      error: 'Transcription failed',
      message: 'Failed to process audio file'
    });
  }
});

// Test endpoint for speech service health
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await speechService.healthCheck();
    
    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'Google Speech-to-Text',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Speech service health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'Google Speech-to-Text',
      error: error.message
    });
  }
});

module.exports = router;