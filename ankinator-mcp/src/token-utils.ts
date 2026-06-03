/**
 * Token estimation and validation utilities for MCP responses.
 * Ensures responses stay within the 25,000 token limit.
 */

export class TokenEstimator {
  // Conservative estimate: 1 token ≈ 4 characters
  static readonly CHARS_PER_TOKEN = 4;
  static readonly MAX_RESPONSE_TOKENS = 25000;
  static readonly SAFE_LIMIT_TOKENS = 22000; // Leave buffer for metadata

  /**
   * Estimate tokens from text using conservative character-based calculation
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Estimate tokens from any object by stringifying it
   */
  static estimateObjectTokens(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return this.estimateTokens(jsonString);
  }

  /**
   * Check if text fits within token limit
   */
  static canFit(text: string, maxTokens: number = this.SAFE_LIMIT_TOKENS): boolean {
    return this.estimateTokens(text) <= maxTokens;
  }

  /**
   * Truncate text to fit within token limit
   */
  static truncateToFit(text: string, maxTokens: number = this.SAFE_LIMIT_TOKENS): {
    text: string;
    truncated: boolean;
    originalTokens: number;
    finalTokens: number;
  } {
    const originalTokens = this.estimateTokens(text);

    if (originalTokens <= maxTokens) {
      return {
        text,
        truncated: false,
        originalTokens,
        finalTokens: originalTokens,
      };
    }

    const maxChars = maxTokens * this.CHARS_PER_TOKEN;
    const truncatedText = text.substring(0, maxChars) + '\n\n[... truncated to fit token limit]';

    return {
      text: truncatedText,
      truncated: true,
      originalTokens,
      finalTokens: this.estimateTokens(truncatedText),
    };
  }

  /**
   * Validate response size and throw error if too large
   */
  static validateResponseSize(obj: any): void {
    const tokens = this.estimateObjectTokens(obj);
    if (tokens > this.MAX_RESPONSE_TOKENS) {
      throw new Error(
        `Response too large: ${tokens} tokens (max: ${this.MAX_RESPONSE_TOKENS}). ` +
        `Consider using pagination or reducing chunk size.`
      );
    }
  }

  /**
   * Calculate recommended chunk batch size based on average chunk size
   */
  static getRecommendedChunkBatchSize(avgChunkSize: number): number {
    const avgTokensPerChunk = Math.ceil(avgChunkSize / this.CHARS_PER_TOKEN);
    const maxChunks = Math.floor(this.SAFE_LIMIT_TOKENS / avgTokensPerChunk);
    return Math.max(1, Math.min(maxChunks, 10)); // Between 1 and 10
  }

  /**
   * Get a human-readable size description
   */
  static formatTokenCount(tokens: number): string {
    if (tokens < 1000) {
      return `${tokens} tokens`;
    } else if (tokens < 10000) {
      return `${(tokens / 1000).toFixed(1)}K tokens`;
    } else {
      return `${(tokens / 1000).toFixed(0)}K tokens`;
    }
  }

  /**
   * Calculate percentage of safe limit used
   */
  static getLimitPercentage(tokens: number): number {
    return Math.round((tokens / this.SAFE_LIMIT_TOKENS) * 100);
  }
}
