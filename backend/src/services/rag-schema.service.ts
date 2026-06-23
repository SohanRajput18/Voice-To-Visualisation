import { DiscoveredTable } from './db-adapter';

export class RagSchemaService {
  private static getOllamaConfig() {
    const baseUrl = process.env.LLM_API_URL || 'http://localhost:11434';
    // Use standard embedding model or default back to standard LLM model
    const model = process.env.LLM_EMBEDDING_MODEL || 'nomic-embed-text';
    return { baseUrl, model };
  }

  /**
   * Returns the most relevant tables for the user query using either semantic embeddings or keyword matching.
   */
  static async getRelevantSchema(
    userPrompt: string,
    fullSchema: DiscoveredTable[],
    topK: number = 4
  ): Promise<DiscoveredTable[]> {
    // Optimization: If the schema is small (<= 6 tables), return everything directly
    if (fullSchema.length <= 6) {
      return fullSchema;
    }

    try {
      console.log(`Running semantic RAG search for prompt: "${userPrompt}"`);
      const { baseUrl, model } = this.getOllamaConfig();

      // 1. Generate description documents for all tables
      const tableDocs = fullSchema.map(tbl => ({
        table: tbl,
        doc: this.generateTableDescription(tbl)
      }));

      // 2. Fetch embedding for user prompt
      const promptEmbedding = await this.getEmbedding(userPrompt, baseUrl, model);

      // 3. Fetch embeddings for table descriptions and calculate similarities
      const scoredTables = await Promise.all(
        tableDocs.map(async item => {
          try {
            const tableEmbedding = await this.getEmbedding(item.doc, baseUrl, model);
            const score = this.cosineSimilarity(promptEmbedding, tableEmbedding);
            return { table: item.table, score };
          } catch (err) {
            // Fall back to keyword score if single embedding fails
            const score = this.calculateKeywordScore(userPrompt, item.doc);
            return { table: item.table, score };
          }
        })
      );

      // 4. Sort and return top K
      scoredTables.sort((a, b) => b.score - a.score);
      console.log('Semantic match scores:', scoredTables.map(t => `${t.table.name}: ${t.score.toFixed(3)}`));
      
      return scoredTables.slice(0, topK).map(t => t.table);

    } catch (error) {
      console.warn('Ollama semantic RAG failed or model not pulled. Falling back to Keyword similarity matching...');
      return this.getKeywordMatchedSchema(userPrompt, fullSchema, topK);
    }
  }

  /**
   * Keyword-matching fallback schema selector.
   */
  private static getKeywordMatchedSchema(
    prompt: string,
    fullSchema: DiscoveredTable[],
    topK: number
  ): DiscoveredTable[] {
    const tableScores = fullSchema.map(table => {
      const doc = this.generateTableDescription(table);
      const score = this.calculateKeywordScore(prompt, doc);
      return { table, score };
    });

    tableScores.sort((a, b) => b.score - a.score);
    console.log('Keyword match scores:', tableScores.map(t => `${t.table.name}: ${t.score.toFixed(3)}`));

    return tableScores.slice(0, topK).map(t => t.table);
  }

  /**
   * Builds a text string mapping columns and relations for RAG search context.
   */
  private static generateTableDescription(table: DiscoveredTable): string {
    let doc = `Table "${table.name}" has columns: `;
    const colDescs = table.columns.map(c => {
      let desc = `${c.name} (${c.dataType})`;
      if (c.isPrimaryKey) desc += ' [Primary Key]';
      if (c.isForeignKey && c.referencedTable) {
        desc += ` [References table ${c.referencedTable} column ${c.referencedColumn}]`;
      }
      return desc;
    });
    doc += colDescs.join(', ') + '.';
    return doc;
  }

  /**
   * Invokes Ollama embeddings endpoint.
   */
  private static async getEmbedding(text: string, baseUrl: string, model: string): Promise<number[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s fast timeout

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Embedding query failed with status ${response.status}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  /**
   * Cosine Similarity Vector calculation.
   */
  private static cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0.0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Computes a score based on intersecting keywords between prompt and document.
   */
  private static calculateKeywordScore(prompt: string, document: string): number {
    const pWords = this.tokenize(prompt);
    const dWords = this.tokenize(document);

    if (pWords.length === 0) return 0;

    let matches = 0;
    for (const word of pWords) {
      if (dWords.includes(word)) {
        matches++;
      }
    }

    // Return fraction of matches normalized
    return matches / pWords.length;
  }

  /**
   * Basic string tokenization helper.
   */
  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2); // only keywords > 2 chars
  }
}
