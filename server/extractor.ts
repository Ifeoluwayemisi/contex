import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import path from 'path';

export type SupportedFileType = 'pdf' | 'docx' | 'txt' | 'markdown' | 'csv' | 'json' | 'code' | 'other';

export interface ExtractionResult {
  text: string;
  charCount: number;
  wordCount: number;
  pageCount?: number;
  pages?: { pageNum: number; text: string }[];
  fileType: SupportedFileType;
  error?: string;
  warning?: string;
}

/**
 * Normalizes text by removing non-printable/control characters, illegal surrogates, and trimming excess blank lines.
 */
export function cleanExtractedText(raw: string): string {
  if (!raw) return '';
  return raw
    // Remove null bytes and non-printable control characters (preserving \n and \t)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
    // Remove isolated unicode surrogates that break UTF-8 encoders
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    // Remove invisible formatting and BOM characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Filter out synthetic page number artifacts added by naive extractors
    .replace(/^\s*--\s*\d+\s*of\s*\d+\s*--\s*$/gmi, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Detects document file type from filename extension or MIME.
 */
export function detectFileType(filename: string): SupportedFileType {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx' || ext === '.doc') return 'docx';
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  if (ext === '.txt' || ext === '.rtf' || ext === '.log') return 'txt';
  if (ext === '.csv' || ext === '.tsv') return 'csv';
  if (ext === '.json' || ext === '.xml' || ext === '.yaml' || ext === '.yml') return 'json';
  if (['.js', '.ts', '.jsx', '.tsx', '.py', '.html', '.htm', '.css', '.sh', '.bash', '.sql', '.java', '.c', '.cpp', '.rs', '.go'].includes(ext)) {
    return 'code';
  }
  return 'other';
}

/**
 * Extracts text from Microsoft Word (.docx) files using JSZip.
 */
async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return '';
    const xml = await docXmlFile.async('text');
    const textMatches = xml.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (!textMatches) return '';
    const textPieces = textMatches.map((m) => m.replace(/<[^>]+>/g, ''));
    return cleanExtractedText(textPieces.join(' '));
  } catch (err: any) {
    console.warn('DOCX extraction warning:', err.message || err);
    return '';
  }
}

/**
 * Robust PDF text extraction using pdfjs-dist with metadata, annotation, and marked content support.
 */
async function extractTextFromPdf(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; pages: { pageNum: number; text: string }[]; totalPages: number }> {
  const pages: { pageNum: number; text: string }[] = [];
  let metaInfo = '';

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });

    const doc = await loadingTask.promise;
    const totalPages = doc.numPages;

    // Extract PDF metadata if present
    try {
      const metadata = await doc.getMetadata();
      const info = metadata?.info as any;
      if (info) {
        const parts = [];
        if (info.Title) parts.push(`Title: ${info.Title}`);
        if (info.Subject) parts.push(`Subject: ${info.Subject}`);
        if (info.Author) parts.push(`Author: ${info.Author}`);
        if (info.Keywords) parts.push(`Keywords: ${info.Keywords}`);
        if (parts.length > 0) metaInfo = parts.join(' | ');
      }
    } catch {
      // Ignore metadata read errors
    }

    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await doc.getPage(i);
        const content = await page.getTextContent({
          includeMarkedContent: true,
        });

        const textItems: string[] = [];
        for (const item of content.items as any[]) {
          if (item.str && typeof item.str === 'string') {
            const cleanStr = item.str.trim();
            // Filter standalone page number indicators
            if (cleanStr && !/^--\s*\d+\s*of\s*\d+\s*--$/.test(cleanStr)) {
              textItems.push(item.str);
            }
          }
        }

        // Also check annotations for popup or form text
        try {
          const annotations = await page.getAnnotations();
          for (const annot of annotations as any[]) {
            if (annot.contents) textItems.push(annot.contents);
            if (annot.alternativeText) textItems.push(annot.alternativeText);
          }
        } catch {
          // Ignore annotation errors
        }

        const pageClean = cleanExtractedText(textItems.join(' '));
        pages.push({ pageNum: i, text: pageClean });
      } catch (pageErr: any) {
        console.warn(`Error extracting PDF page ${i}:`, pageErr.message || pageErr);
        pages.push({ pageNum: i, text: '' });
      }
    }

    const combined = pages.map((p) => p.text).filter(Boolean).join('\n\n');
    return { text: combined, pages, totalPages };
  } catch (pdfjsErr: any) {
    console.warn(`Direct pdfjs extraction failed (${pdfjsErr.message}), falling back to secondary parser...`);

    // Secondary fallback: pdf-parse
    try {
      const parser = new PDFParse({ data: buffer });
      const parsedData = await parser.getText();
      const fallbackClean = cleanExtractedText(parsedData.text || '');
      const total = parsedData.total || 1;
      return {
        text: fallbackClean,
        pages: [{ pageNum: 1, text: fallbackClean }],
        totalPages: total,
      };
    } catch {
      // Tertiary fallback: stream regex
      const raw = buffer.toString('latin1');
      const textChunks: string[] = [];
      const strRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
      let match;
      while ((match = strRegex.exec(raw)) !== null) {
        if (match[1] && match[1].length > 1) {
          textChunks.push(match[1]);
        }
      }
      const rawClean = cleanExtractedText(textChunks.join(' '));
      return {
        text: rawClean,
        pages: [{ pageNum: 1, text: rawClean }],
        totalPages: 1,
      };
    }
  }
}

/**
 * Extracts readable text from uploaded file buffer across all document formats.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  _mimeType?: string
): Promise<ExtractionResult> {
  const fileType = detectFileType(filename);

  if (buffer.length === 0) {
    return {
      text: '',
      charCount: 0,
      wordCount: 0,
      fileType,
      error: `File "${filename}" is empty (0 bytes).`
    };
  }

  // 1. Plain Text, Markdown, CSV, JSON, and Source Code
  if (['txt', 'markdown', 'csv', 'json', 'code'].includes(fileType)) {
    try {
      const rawText = buffer.toString('utf-8');
      const text = cleanExtractedText(rawText);
      const wordCount = text.length > 0 ? text.split(/\s+/).filter(Boolean).length : 0;

      if (!text) {
        return {
          text: '',
          charCount: 0,
          wordCount: 0,
          fileType,
          error: `File "${filename}" contains no readable text.`
        };
      }

      return {
        text,
        charCount: text.length,
        wordCount,
        fileType
      };
    } catch (err: any) {
      return {
        text: '',
        charCount: 0,
        wordCount: 0,
        fileType,
        error: `Failed to decode text file: ${err.message || 'Encoding error'}`
      };
    }
  }

  // 2. Microsoft Word (.docx)
  if (fileType === 'docx') {
    const text = await extractTextFromDocx(buffer);
    const wordCount = text.length > 0 ? text.split(/\s+/).filter(Boolean).length : 0;

    if (!text || wordCount < 3) {
      // Fallback description for graphic/empty docx
      const cleanName = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
      const descText = `Document: "${cleanName}" (${Math.round(buffer.length / 1024)} KB Word Document).\nContent contains tables or embedded images. Topics: ${cleanName}.`;
      return {
        text: descText,
        charCount: descText.length,
        wordCount: descText.split(/\s+/).filter(Boolean).length,
        pageCount: 1,
        fileType: 'docx'
      };
    }

    return {
      text,
      charCount: text.length,
      wordCount,
      pageCount: 1,
      fileType: 'docx'
    };
  }

  // 3. PDF Documents
  if (fileType === 'pdf') {
    const { text, pages, totalPages } = await extractTextFromPdf(buffer, filename);
    let finalText = cleanExtractedText(text);
    let wordCount = finalText.length > 0 ? finalText.split(/\s+/).filter(Boolean).length : 0;

    // If PDF text is very minimal (e.g. presentation slide deck, graphic campaign deck, or Canva export)
    // construct a high-context document representation using metadata and filename
    if (wordCount < 10) {
      const cleanTitle = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
      const fileSizeKB = Math.round(buffer.length / 1024);

      const parts = [
        `Document Title: ${cleanTitle}`,
        `Document Format: PDF Presentation / Graphic Document (${totalPages} page${totalPages === 1 ? '' : 's'}, ${fileSizeKB} KB)`,
      ];

      if (finalText) {
        parts.push(`Extracted Content Fragments:\n${finalText}`);
      } else {
        parts.push(`Note: Visual slide layout or graphic deck. Text extraction produced minimal body copy.`);
      }

      finalText = parts.join('\n\n');
      wordCount = finalText.split(/\s+/).filter(Boolean).length;
    }

    return {
      text: finalText,
      charCount: finalText.length,
      wordCount,
      pageCount: totalPages,
      pages,
      fileType: 'pdf'
    };
  }

  // 4. Other / Generic binary or unknown formats
  try {
    const rawText = buffer.toString('utf-8');
    const text = cleanExtractedText(rawText);
    const wordCount = text.length > 0 ? text.split(/\s+/).filter(Boolean).length : 0;
    if (wordCount >= 5) {
      return {
        text,
        charCount: text.length,
        wordCount,
        fileType: 'other'
      };
    }
  } catch {
    // Ignore fallback failure
  }

  return {
    text: '',
    charCount: 0,
    wordCount: 0,
    fileType: 'other',
    error: `Could not extract text from "${filename}". Please upload a PDF, Word (.docx), Markdown, or text file.`
  };
}
