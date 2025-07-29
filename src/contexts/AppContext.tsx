import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, VoiceQuery } from '../types';

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

type AppAction =
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_TRANSCRIPT'; payload: string }
  | { type: 'SET_CURRENT_QUERY'; payload: VoiceQuery }
  | { type: 'ADD_QUERY_TO_HISTORY'; payload: VoiceQuery }
  | { type: 'DELETE_QUERY_FROM_HISTORY'; payload: string }
  | { type: 'CLEAR_QUERY_HISTORY' }
  | { type: 'TOGGLE_THEME' }
  | { type: 'CLEAR_TRANSCRIPT' };

const initialState: AppState = {
  currentQuery: null,
  queryHistory: [],
  isListening: false,
  transcript: '',
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LISTENING':
      return { ...state, isListening: action.payload };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload };
    case 'SET_CURRENT_QUERY':
      return { ...state, currentQuery: action.payload };
    case 'ADD_QUERY_TO_HISTORY':
      return {
        ...state,
        queryHistory: [action.payload, ...state.queryHistory.slice(0, 9)],
      };
    case 'DELETE_QUERY_FROM_HISTORY':
      return {
        ...state,
        queryHistory: state.queryHistory.filter(query => query.id !== action.payload),
      };
    case 'CLEAR_QUERY_HISTORY':
      return {
        ...state,
        queryHistory: [],
      };
    case 'TOGGLE_THEME':
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      // Apply theme immediately
      setTimeout(() => {
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }, 0);
      return { ...state, theme: newTheme };
    case 'CLEAR_TRANSCRIPT':
      return { ...state, transcript: '' };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Initialize theme on mount
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}