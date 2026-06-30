import { ILlmProvider } from './llm-provider.interface';
import { LlmResult } from '../llm.service';

export class GeminiProvider implements ILlmProvider {
  async generateSql(prompt: string, schemaContext: string): Promise<LlmResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
      throw new Error('TRANSLATION_ERROR:Gemini API key is missing. Please configure GEMINI_API_KEY in the environment variables.');
    }

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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      console.log(`Connecting to Gemini API using model "${model}"`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: systemPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.0,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('TRANSLATION_ERROR:Gemini API quota exceeded. Please try again later.');
        }
        if (response.status === 400 || response.status === 403) {
          throw new Error('TRANSLATION_ERROR:Gemini API request failed. Invalid API key or request format.');
        }
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = (await response.json()) as any;
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      if (!rawText) {
        throw new Error('Gemini API returned empty response');
      }

      console.log('Gemini raw output:', rawText);
      return this.parseLlmResponse(rawText);

    } catch (error: any) {
      if (error.message?.startsWith('TRANSLATION_ERROR:')) {
        throw error;
      }
      throw new Error(`TRANSLATION_ERROR:Failed to fetch query from Gemini: ${error.message}`);
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
