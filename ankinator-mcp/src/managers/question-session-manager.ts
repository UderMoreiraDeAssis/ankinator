/**
 * Question Session Manager
 * Manages storage and retrieval of extracted questions per session
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Questao, QuestaoChunk, QuestaoSession } from '../types/questao-types.js';

export class QuestionSessionManager {
  private baseDir: string;
  private sessionsDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.sessionsDir = path.join(baseDir, 'question-sessions');
  }

  /**
   * Initialize session storage directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    } catch (error) {
      console.error('[QuestionSessionManager] Failed to create sessions directory:', error);
      throw error;
    }
  }

  /**
   * Get the path to a session's questions file
   */
  private getSessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}-questoes.jsonl`);
  }

  /**
   * Save questions for a specific chunk
   */
  async saveQuestions(
    sessionId: string,
    chunkIndex: number,
    pageStart: number,
    pageEnd: number,
    questoes: Questao[]
  ): Promise<void> {
    const filePath = this.getSessionFilePath(sessionId);

    const questaoChunk: QuestaoChunk = {
      chunk_index: chunkIndex,
      page_start: pageStart,
      page_end: pageEnd,
      questoes,
    };

    const line = JSON.stringify(questaoChunk) + '\n';

    try {
      // Append to JSONL file
      await fs.appendFile(filePath, line, 'utf8');
    } catch (error) {
      console.error('[QuestionSessionManager] Failed to save questions:', error);
      throw new Error(`Failed to save questions for session ${sessionId}: ${(error as Error).message}`);
    }
  }

  /**
   * Get all questions from a session
   */
  async getAllQuestions(sessionId: string): Promise<QuestaoChunk[]> {
    const filePath = this.getSessionFilePath(sessionId);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n');

      const chunks: QuestaoChunk[] = [];
      for (const line of lines) {
        if (line.trim()) {
          chunks.push(JSON.parse(line));
        }
      }

      // Sort by chunk_index
      chunks.sort((a, b) => a.chunk_index - b.chunk_index);

      return chunks;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist yet - no questions saved
        return [];
      }
      console.error('[QuestionSessionManager] Failed to read questions:', error);
      throw new Error(`Failed to read questions for session ${sessionId}: ${(error as Error).message}`);
    }
  }

  /**
   * Get flattened list of all questions (without chunk grouping)
   */
  async getAllQuestionsFlat(sessionId: string): Promise<Questao[]> {
    const chunks = await this.getAllQuestions(sessionId);
    const allQuestions: Questao[] = [];

    for (const chunk of chunks) {
      allQuestions.push(...chunk.questoes);
    }

    return allQuestions;
  }

  /**
   * Get statistics about saved questions
   */
  async getStatistics(sessionId: string): Promise<{
    totalChunks: number;
    totalQuestions: number;
    questoesExtraidas: number;
    questoesCriadas: number;
    chunkInfo: Array<{
      chunkIndex: number;
      pageRange: string;
      questionCount: number;
    }>;
  }> {
    const chunks = await this.getAllQuestions(sessionId);

    let totalQuestions = 0;
    let questoesExtraidas = 0;
    let questoesCriadas = 0;

    const chunkInfo = chunks.map(chunk => {
      totalQuestions += chunk.questoes.length;
      questoesExtraidas += chunk.questoes.filter(q => q.tipo === 'extraida').length;
      questoesCriadas += chunk.questoes.filter(q => q.tipo === 'criada').length;

      return {
        chunkIndex: chunk.chunk_index,
        pageRange: `${chunk.page_start}-${chunk.page_end}`,
        questionCount: chunk.questoes.length,
      };
    });

    return {
      totalChunks: chunks.length,
      totalQuestions,
      questoesExtraidas,
      questoesCriadas,
      chunkInfo,
    };
  }

  /**
   * Check if session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const filePath = this.getSessionFilePath(sessionId);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a session's questions
   */
  async deleteSession(sessionId: string): Promise<void> {
    const filePath = this.getSessionFilePath(sessionId);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error('[QuestionSessionManager] Failed to delete session:', error);
        throw new Error(`Failed to delete session ${sessionId}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      let cleaned = 0;

      for (const file of files) {
        if (!file.endsWith('-questoes.jsonl')) continue;

        const filePath = path.join(this.sessionsDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      console.error('[QuestionSessionManager] Failed to cleanup old sessions:', error);
      return 0;
    }
  }
}
