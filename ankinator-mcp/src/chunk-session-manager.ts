/**
 * Session-based chunk management for large PDF processing.
 * Stores chunks on disk in JSONL format to avoid exceeding token limits.
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { TokenEstimator } from './token-utils.js';

export interface ChunkSession {
  sessionId: string;
  pdfPath: string;
  totalChunks: number;
  chunkSize: number;
  overlap: number;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface ChunkMetadata {
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  charCount: number;
  preview: string;
}

export interface ChunkData {
  chunk_index: number;
  page_start: number;
  page_end: number;
  texto: string;
  num_chars: number;
}

/**
 * Manages sessions for chunked PDF processing.
 * Uses JSONL (JSON Lines) format for efficient storage and retrieval.
 */
export class ChunkSessionManager {
  private sessions: Map<string, ChunkSession> = new Map();
  private chunksDir: string;

  constructor(baseDir: string) {
    this.chunksDir = path.join(baseDir, 'chunk-sessions');
  }

  /**
   * Initialize the session directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.chunksDir, { recursive: true });
      console.error(`[ChunkSessionManager] Initialized: ${this.chunksDir}`);
    } catch (error) {
      console.error(`[ChunkSessionManager] Failed to initialize: ${error}`);
      throw error;
    }
  }

  /**
   * Create a new session and save chunks to JSONL file
   */
  async createSession(
    pdfPath: string,
    chunks: any[],
    chunkSize: number,
    overlap: number
  ): Promise<string> {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const sessionFile = path.join(this.chunksDir, `${sessionId}.jsonl`);

    // Save chunks as JSONL (one chunk per line)
    const lines = chunks.map(chunk =>
      JSON.stringify({
        chunk_index: chunk.chunkIndex,
        page_start: chunk.pageStart,
        page_end: chunk.pageEnd,
        texto: chunk.text,
        num_chars: chunk.text.length,
      })
    );

    await fs.writeFile(sessionFile, lines.join('\n'));

    // Store session metadata
    const session: ChunkSession = {
      sessionId,
      pdfPath,
      totalChunks: chunks.length,
      chunkSize,
      overlap,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };
    this.sessions.set(sessionId, session);

    console.error(
      `[ChunkSessionManager] Created session ${sessionId}: ${chunks.length} chunks, ${sessionFile}`
    );

    return sessionId;
  }

  /**
   * Get metadata for all chunks (lightweight - no full text)
   */
  async getChunkMetadata(sessionId: string): Promise<ChunkMetadata[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionFile = path.join(this.chunksDir, `${sessionId}.jsonl`);
    const content = await fs.readFile(sessionFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    // Update last accessed
    session.lastAccessedAt = new Date();

    return lines.map(line => {
      const chunk = JSON.parse(line);
      return {
        chunkIndex: chunk.chunk_index,
        pageStart: chunk.page_start,
        pageEnd: chunk.page_end,
        charCount: chunk.num_chars,
        preview: chunk.texto.substring(0, 200) + '...',
      };
    });
  }

  /**
   * Get specific chunks by index
   */
  async getChunks(sessionId: string, indices: number[]): Promise<ChunkData[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionFile = path.join(this.chunksDir, `${sessionId}.jsonl`);
    const content = await fs.readFile(sessionFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    // Update last accessed
    session.lastAccessedAt = new Date();

    // Only return requested chunks
    return indices
      .map(index => {
        if (index >= lines.length) return null;
        return JSON.parse(lines[index]) as ChunkData;
      })
      .filter((chunk): chunk is ChunkData => chunk !== null);
  }

  /**
   * Get chunks in a range with automatic token limit management
   */
  async getChunkBatch(
    sessionId: string,
    startIndex: number,
    maxTokens: number = TokenEstimator.SAFE_LIMIT_TOKENS
  ): Promise<{ chunks: ChunkData[]; hasMore: boolean; nextIndex: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionFile = path.join(this.chunksDir, `${sessionId}.jsonl`);
    const content = await fs.readFile(sessionFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    // Update last accessed
    session.lastAccessedAt = new Date();

    const chunks: ChunkData[] = [];
    let estimatedTokens = 0;
    let currentIndex = startIndex;

    // Reserve some tokens for response metadata
    const availableTokens = maxTokens - 2000;

    while (currentIndex < lines.length && estimatedTokens < availableTokens) {
      const chunk = JSON.parse(lines[currentIndex]) as ChunkData;
      const chunkTokens = TokenEstimator.estimateTokens(chunk.texto);

      // If adding this chunk would exceed limit and we already have chunks, stop
      if (estimatedTokens + chunkTokens > availableTokens && chunks.length > 0) {
        break;
      }

      chunks.push(chunk);
      estimatedTokens += chunkTokens;
      currentIndex++;
    }

    console.error(
      `[ChunkSessionManager] Batch ${sessionId}: returned ${chunks.length} chunks, ` +
      `${TokenEstimator.formatTokenCount(estimatedTokens)}, ` +
      `${currentIndex}/${lines.length} total`
    );

    return {
      chunks,
      hasMore: currentIndex < lines.length,
      nextIndex: currentIndex,
    };
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): ChunkSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Clean up old sessions (TTL: 24 hours)
   */
  async cleanupOldSessions(): Promise<number> {
    const now = new Date();
    const ttl = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.lastAccessedAt.getTime();
      if (age > ttl) {
        const sessionFile = path.join(this.chunksDir, `${sessionId}.jsonl`);
        try {
          await fs.unlink(sessionFile);
          this.sessions.delete(sessionId);
          cleaned++;
          console.error(`[ChunkSessionManager] Cleaned up expired session: ${sessionId}`);
        } catch (error) {
          console.error(`[ChunkSessionManager] Failed to delete session ${sessionId}:`, error);
        }
      }
    }

    if (cleaned > 0) {
      console.error(`[ChunkSessionManager] Cleanup complete: ${cleaned} sessions removed`);
    }

    return cleaned;
  }

  /**
   * Delete a specific session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionFile = path.join(this.chunksDir, `${sessionId}.jsonl`);
    await fs.unlink(sessionFile);
    this.sessions.delete(sessionId);

    console.error(`[ChunkSessionManager] Deleted session: ${sessionId}`);
  }
}
