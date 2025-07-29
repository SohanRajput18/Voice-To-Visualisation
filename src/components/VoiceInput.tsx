import React, { useState } from 'react';
import { Mic, MicOff, Send, Trash2, Type } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useApp } from '../contexts/AppContext';
import { queryService } from '../services/api';

export function VoiceInput() {
  const { state, dispatch } = useApp();
  const { isListening, startListening, stopListening, clearTranscript, transcript } = useSpeechRecognition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleToggleInputMode = () => {
    setInputMode(prev => prev === 'voice' ? 'text' : 'voice');
    if (inputMode === 'text') {
      setManualInput('');
    } else {
      clearTranscript();
    }
  };
  const handleSubmitQuery = async () => {
    const queryText = inputMode === 'voice' ? transcript : manualInput;
    if (!queryText.trim()) return;

    setIsProcessing(true);
    
    const query = {
      id: Date.now().toString(),
      query: queryText,
      timestamp: new Date(),
      status: 'processing' as const,
    };

    dispatch({ type: 'SET_CURRENT_QUERY', payload: query });

    try {
      const result = await queryService.processVoiceQuery(queryText);
      
      const updatedQuery = {
        ...query,
        result,
        status: 'success' as const,
      };

      dispatch({ type: 'SET_CURRENT_QUERY', payload: updatedQuery });
      dispatch({ type: 'ADD_QUERY_TO_HISTORY', payload: updatedQuery });
      
      if (inputMode === 'voice') {
        clearTranscript();
      } else {
        setManualInput('');
      }
    } catch (error) {
      const errorQuery = {
        ...query,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
      
      dispatch({ type: 'SET_CURRENT_QUERY', payload: errorQuery });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    if (inputMode === 'voice') {
      clearTranscript();
    } else {
      setManualInput('');
    }
  };

  const currentInput = inputMode === 'voice' ? transcript : manualInput;
  return (
    <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-600 rounded-xl shadow-lg border border-blue-100 dark:border-gray-600 p-6 mb-6 transition-all duration-300">
      <div className="flex items-center gap-4 mb-4">
        {inputMode === 'voice' ? (
          <button
            onClick={handleToggleListening}
            className={`p-4 rounded-full transition-all duration-200 ${
              isListening
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white animate-pulse shadow-lg'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
            }`}
            disabled={isProcessing}
          >
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
        ) : (
          <div className="p-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
            <Type size={24} />
          </div>
        )}
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
              {inputMode === 'voice' 
                ? (isListening ? 'Listening...' : 'Voice Query')
                : 'Text Query'
              }
            </h3>
            <button
              onClick={handleToggleInputMode}
              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Switch to {inputMode === 'voice' ? 'Text' : 'Voice'}
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {inputMode === 'voice'
              ? (isListening 
                  ? 'Speak your data query now' 
                  : 'Click the microphone to start voice input'
                )
              : 'Type your data query below'
            }
          </p>
        </div>
      </div>

      <div className="mb-4">
        {inputMode === 'voice' ? (
          <div className="w-full p-4 bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-lg min-h-[80px] flex items-center justify-center">
            {transcript ? (
              <p className="text-gray-800 dark:text-gray-200 text-center leading-relaxed">{transcript}</p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center">
                {isListening 
                  ? 'Listening... Speak your query now' 
                  : 'Voice transcription will appear here. Try: "Show me a pie chart of device usage"'
                }
              </p>
            )}
          </div>
        ) : (
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Type your query here... e.g., 'Show me a bar chart of quarterly revenue'"
            className="w-full p-4 bg-gray-50 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg min-h-[80px] text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isProcessing}
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmitQuery}
          disabled={!currentInput.trim() || isProcessing}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        >
          <Send size={16} />
          {isProcessing ? 'Processing...' : 'Submit Query'}
        </button>
        
        <button
          onClick={handleClear}
          disabled={!currentInput.trim()}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <Trash2 size={16} />
          Clear
        </button>
      </div>

      {isProcessing && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-blue-700 dark:text-blue-300 font-medium">Processing your query...</span>
          </div>
        </div>
      )}
    </div>
  );
}