import { LlmResult } from '../llm.service';

export interface ILlmProvider {
  generateSql(prompt: string, schemaContext: string): Promise<LlmResult>;
}
