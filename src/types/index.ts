export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface ChartData {
  x: any[];
  y: any[];
  type: 'bar' | 'line' | 'scatter' | 'pie';
  name?: string;
  values?: any[];
  labels?: string[];
}

export interface QueryResult {
  data: ChartData[];
  metadata: {
    title: string;
    description: string;
    chartType: 'bar' | 'line' | 'scatter' | 'pie';
    columns: string[];
    rowCount: number;
  };
  rawData: any[];
}

export interface VoiceQuery {
  id: string;
  query: string;
  timestamp: Date;
  result?: QueryResult;
  status: 'processing' | 'success' | 'error';
  error?: string;
}

export interface AppState {
  currentQuery: VoiceQuery | null;
  queryHistory: VoiceQuery[];
  isListening: boolean;
  transcript: string;
  theme: 'light' | 'dark';
}