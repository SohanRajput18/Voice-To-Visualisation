const speech = require('@google-cloud/speech');

class SpeechService {
  constructor() {
    // Initialize Google Cloud Speech client
    this.client = new speech.SpeechClient({
      // Credentials will be loaded from GOOGLE_APPLICATION_CREDENTIALS env var
      // or from default service account if running on Google Cloud
    });
  }

  /**
   * Transcribe audio buffer to text using Google Speech-to-Text
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {Object} config - Speech recognition config
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeAudio(audioBuffer, config = {}) {
    try {
      const defaultConfig = {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        model: 'latest_long', // Use latest model for better accuracy
        useEnhanced: true
      };

      const finalConfig = { ...defaultConfig, ...config };

      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: finalConfig,
      };

      console.log('Sending audio to Google Speech-to-Text API...');
      const [response] = await this.client.recognize(request);

      if (!response.results || response.results.length === 0) {
        console.warn('No speech recognition results returned');
        return '';
      }

      // Extract transcription from results
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join(' ');

      console.log('Speech transcription successful:', transcription);
      return transcription;

    } catch (error) {
      console.error('Google Speech-to-Text API error:', error);
      
      if (error.code === 3) { // INVALID_ARGUMENT
        throw new Error('INVALID_ARGUMENT: Invalid audio format or configuration');
      }
      
      if (error.code === 7) { // PERMISSION_DENIED
        throw new Error('PERMISSION_DENIED: Check Google Cloud credentials');
      }

      throw new Error(`Speech recognition failed: ${error.message}`);
    }
  }

  /**
   * Health check for Google Speech-to-Text service
   * @returns {Promise<boolean>} - Service health status
   */
  async healthCheck() {
    try {
      // Create a minimal test request to check service availability
      const testAudio = Buffer.from('test', 'utf8');
      
      const request = {
        audio: { content: testAudio.toString('base64') },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US',
        },
      };

      // This will likely fail due to invalid audio, but it tests connectivity
      await this.client.recognize(request);
      return true;

    } catch (error) {
      // If it's a credential or connectivity issue, return false
      if (error.code === 7 || error.code === 14) {
        return false;
      }
      // Other errors (like invalid audio) mean the service is reachable
      return true;
    }
  }

  /**
   * Get supported languages for speech recognition
   * @returns {Array} - List of supported language codes
   */
  getSupportedLanguages() {
    return [
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN',
      'es-ES', 'es-US', 'fr-FR', 'de-DE', 'it-IT',
      'pt-BR', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN'
    ];
  }
}

module.exports = new SpeechService();