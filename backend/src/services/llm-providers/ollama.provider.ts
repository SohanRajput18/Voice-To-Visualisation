import { ILlmProvider } from './llm-provider.interface';
import { LlmResult } from '../llm.service';

export class OllamaProvider implements ILlmProvider {
  async generateSql(prompt: string, schemaContext: string): Promise<LlmResult> {
    const baseUrl = process.env.OLLAMA_BASE_URL || process.env.LLM_API_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || process.env.LLM_MODEL || 'llama3';

    const systemPrompt = `You are a database analytics AI. Translate the user's question into a valid SQL query.
You must use only the tables and columns specified in the schema context below.

Schema Context:
${schemaContext}

Rules:
1. Output ONLY a valid JSON object. Do not wrap in markdown \`\`\`json block. Do not include any explanations outside the JSON object.
2. The JSON object must match this schema:
   {
     "sql": "A single line SELECT query using the tables and columns above",
     "explanation": "A short sentence explaining what database properties are filtered and why",
     "confidence": 0.95
   }
3. Only write read-only SELECT queries. Do not perform write operations.
4. Ensure aliases are defined when joining tables.

Translate the user question: "${prompt}"
JSON Output:`;

    try {
      console.log(`Connecting to Ollama at: ${baseUrl}/api/generate using model "${model}"`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: systemPrompt,
          stream: false,
          options: {
            temperature: 0.0,
            num_predict: 250
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const data = (await response.json()) as { response: string };
      const rawText = data.response.trim();
      
      console.log('Ollama raw output:', rawText);
      return this.parseLlmResponse(rawText);

    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed') || error.name === 'AbortError') {
        throw new Error('TRANSLATION_ERROR:Ollama server is offline or unreachable. Please make sure Ollama is running.');
      }
      throw error;
    }
  }

  private parseLlmResponse(text: string): LlmResult {
    let cleaned = text.trim();
    
    // Remove markdown json wrappers if present
    if (cleaned.includes('```')) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match && match[1]) {
        cleaned = match[1].trim();
      }
    }

    // Try parsing
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.sql === 'string') {
        return {
          sql: parsed.sql.trim(),
          explanation: parsed.explanation || 'SQL query compiled successfully.',
          confidence: Number(parsed.confidence || 0.8)
        };
      }
    } catch (_) {
      const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed.sql === 'string') {
            return {
              sql: parsed.sql.trim(),
              explanation: parsed.explanation || 'SQL query compiled successfully.',
              confidence: Number(parsed.confidence || 0.8)
            };
          }
        } catch (__) {}
      }
    }

    let fallbackSql = cleaned;
    const selectIdx = cleaned.toLowerCase().indexOf('select');
    const withIdx = cleaned.toLowerCase().indexOf('with');
    const startIdx = selectIdx !== -1 && (withIdx === -1 || selectIdx < withIdx) ? selectIdx : withIdx;
    
    if (startIdx !== -1) {
      fallbackSql = cleaned.substring(startIdx);
      const endQueryIdx = fallbackSql.indexOf('\n');
      if (endQueryIdx !== -1) {
        fallbackSql = fallbackSql.substring(0, endQueryIdx);
      }
    }

    return {
      sql: fallbackSql,
      explanation: 'Extracted raw SQL query from LLM completion block.',
      confidence: 0.6
    };
  }
}
