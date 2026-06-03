import { promises as fs } from 'fs';
import { PDFParse } from 'pdf-parse';

export interface PdfChunk {
  pages: string[];
  pageStart: number;
  pageEnd: number;
  chunkIndex: number;
  text: string;
}

export interface PdfMetadata {
  text: string;
  numPages: number;
}

/**
 * Manager class for PDF extraction and processing operations.
 * Separates PDF logic from MCP tool handlers.
 */
export class PdfManager {
  /**
   * Extracts text from a PDF file
   * @param pdfPath - Absolute path to the PDF file
   * @returns Extracted text content
   */
  async extractText(pdfPath: string): Promise<string> {
    const dataBuffer = await fs.readFile(pdfPath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  /**
   * Extracts text and metadata from a PDF file
   * @param pdfPath - Absolute path to the PDF file
   * @returns Object containing text and number of pages
   */
  async extractWithMetadata(pdfPath: string): Promise<PdfMetadata> {
    const dataBuffer = await fs.readFile(pdfPath);
    const parser = new PDFParse({ data: dataBuffer });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    await parser.destroy();

    return {
      text: textResult.text,
      numPages: infoResult.total || 1,
    };
  }

  /**
   * Simulates page division based on estimated characters per page
   * @param text - Full PDF text
   * @param numPages - Number of pages in the PDF
   * @returns Array of page texts
   */
  simulatePages(text: string, numPages: number): string[] {
    const avgCharsPerPage = Math.ceil(text.length / numPages);
    const pages: string[] = [];

    for (let i = 0; i < numPages; i++) {
      const start = i * avgCharsPerPage;
      const end = Math.min((i + 1) * avgCharsPerPage, text.length);
      pages.push(text.substring(start, end));
    }

    return pages;
  }

  /**
   * Creates chunks from pages with overlap
   * @param pages - Array of page texts
   * @param chunkSize - Number of pages per chunk
   * @param overlap - Number of pages to overlap between chunks
   * @returns Array of PDF chunks
   */
  createChunks(pages: string[], chunkSize: number, overlap: number): PdfChunk[] {
    const chunks: PdfChunk[] = [];
    let chunkIndex = 0;

    for (let i = 0; i < pages.length; i += (chunkSize - overlap)) {
      const end = Math.min(i + chunkSize, pages.length);
      const chunkPages = pages.slice(i, end);

      chunks.push({
        pages: chunkPages,
        pageStart: i + 1,
        pageEnd: end,
        chunkIndex: chunkIndex++,
        text: chunkPages.join('\n\n--- PÁGINA ---\n\n'),
      });

      if (end >= pages.length) break;
    }

    return chunks;
  }

  /**
   * Determines optimal chunk size based on PDF length
   * @param numPages - Total number of pages
   * @param requestedSize - User-requested chunk size
   * @returns Optimal chunk size
   */
  getAdaptiveChunkSize(numPages: number, requestedSize: number): number {
    if (numPages < 20) {
      return numPages; // Process all at once
    } else if (numPages >= 20 && numPages < 100) {
      return Math.min(10, requestedSize);
    } else {
      return Math.min(5, requestedSize);
    }
  }
}
