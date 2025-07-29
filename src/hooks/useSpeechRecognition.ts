import { useEffect, useCallback, useRef } from 'react';
import { useApp } from '../contexts/AppContext';

export function useSpeechRecognition() {
  const { state, dispatch } = useApp();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { isListening } = state;

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      dispatch({ type: 'SET_LISTENING', payload: true });
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      dispatch({ 
        type: 'SET_TRANSCRIPT', 
        payload: finalTranscript + interimTranscript 
      });
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      dispatch({ type: 'SET_LISTENING', payload: false });
    };

    recognition.onend = () => {
      dispatch({ type: 'SET_LISTENING', payload: false });
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [dispatch]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const clearTranscript = useCallback(() => {
    dispatch({ type: 'CLEAR_TRANSCRIPT' });
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    clearTranscript,
    transcript: state.transcript,
  };
}