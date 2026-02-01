import { Chapter } from '../../../utils/epubParser';

/**
 * Result of finding paragraph boundaries
 */
export interface ParagraphBoundaries {
  paraStart: number;
  paraEnd: number;
  currentParaIndex: number;
  totalParagraphs: number;
}

/**
 * Result of finding paragraph at a specific word index
 */
export interface ParagraphAtIndex {
  paraIndex: number;
  startWordCount: number;
}

/**
 * Extracts paragraphs from raw text or HTML content
 * @param chapter - Chapter object with rawText or htmlContent
 * @returns Array of paragraph strings
 */
export function extractParagraphs(chapter: Chapter): string[] {
  // Try rawText first (more reliable for paragraph detection)
  if (chapter.rawText) {
    return chapter.rawText.split(/\n\n+/).filter(p => p.trim());
  }
  
  // Fallback to HTML paragraph tags
  if (chapter.htmlContent) {
    const paraMatches = chapter.htmlContent.match(/<(p|div)[^>]*>[\s\S]*?<\/(p|div)>/gi);
    if (paraMatches && paraMatches.length > 0) {
      return paraMatches;
    }
  }
  
  return [];
}

/**
 * Counts words in a paragraph, handling both plain text and HTML
 */
function countWordsInParagraph(paragraph: string): number {
  // Remove HTML tags if present
  const text = paragraph.replace(/<[^>]*>/g, '');
  return text.split(/\s+/).filter(w => w.trim()).length;
}

/**
 * Finds which paragraph contains a specific word index within a chapter
 * @param paragraphs - Array of paragraph strings (from rawText or htmlContent)
 * @param wordIndex - Word index within the chapter (0-based)
 * @returns Object with paragraph index and cumulative word count at start of that paragraph
 */
export function getParagraphAtIndex(
  paragraphs: string[],
  wordIndex: number
): ParagraphAtIndex {
  let wordCount = 0;
  let paraIndex = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paraWordCount = countWordsInParagraph(paragraphs[i]);
    if (wordCount + paraWordCount > wordIndex) {
      paraIndex = i;
      break;
    }
    wordCount += paraWordCount;
    // If we've reached the last paragraph, use it
    if (i === paragraphs.length - 1) {
      paraIndex = i;
    }
  }
  
  return {
    paraIndex,
    startWordCount: wordCount,
  };
}

/**
 * Calculates the start and end word indices for a specific paragraph
 * @param paragraphs - Array of paragraph strings
 * @param paraIndex - Index of the paragraph
 * @param chapterStart - Word index where the chapter starts (in global word array)
 * @returns Object with start and end word indices (in global word array)
 */
export function calculateParagraphWordIndices(
  paragraphs: string[],
  paraIndex: number,
  chapterStart: number
): { start: number; end: number } {
  // Calculate cumulative word count up to the start of this paragraph
  let paraStartWordCount = 0;
  for (let i = 0; i < paraIndex; i++) {
    paraStartWordCount += countWordsInParagraph(paragraphs[i]);
  }
  
  // Calculate word count for the current paragraph
  const currentParaWordCount = countWordsInParagraph(paragraphs[paraIndex]);
  const paraEndWordCount = paraStartWordCount + currentParaWordCount;
  
  return {
    start: chapterStart + paraStartWordCount,
    end: chapterStart + paraEndWordCount,
  };
}

/**
 * Finds paragraph boundaries based on the current word position
 * Handles both rawText and htmlContent, with fallback to sentence endings
 * @param chapter - Current chapter object
 * @param currentWordIndex - Current word index in the global word array
 * @param wordsBeforeChapter - Number of words before this chapter starts
 * @param allWords - Complete array of all words across all chapters
 * @returns Paragraph boundaries with start/end indices and paragraph info
 */
export function findParagraphBoundaries(
  chapter: Chapter,
  currentWordIndex: number,
  wordsBeforeChapter: number,
  allWords: string[]
): ParagraphBoundaries {
  const chapterStart = wordsBeforeChapter;
  const chapterEnd = chapterStart + chapter.words.length;
  const currentWordInChapter = currentWordIndex - chapterStart;
  
  // Extract paragraphs (handles both rawText and htmlContent)
  const paragraphs = extractParagraphs(chapter);
  
  if (paragraphs.length > 0) {
    // Find which paragraph contains the current word
    const { paraIndex, startWordCount } = getParagraphAtIndex(paragraphs, currentWordInChapter);
    
    // Calculate word indices for the current paragraph
    const { start, end } = calculateParagraphWordIndices(paragraphs, paraIndex, chapterStart);
    
    return {
      paraStart: start,
      paraEnd: Math.min(chapterEnd, end),
      currentParaIndex: paraIndex,
      totalParagraphs: paragraphs.length,
    };
  }
  
  // Fallback: use sentence endings if no paragraph structure found
  let paraStart = chapterStart;
  let paraEnd = chapterEnd;
  
  for (let i = currentWordIndex; i >= chapterStart; i--) {
    const word = allWords[i];
    if (word.match(/[.!?]$/)) {
      paraStart = i + 1;
      break;
    }
    if (i === chapterStart) paraStart = i;
  }
  
  for (let i = currentWordIndex; i < chapterEnd; i++) {
    const word = allWords[i];
    if (word.match(/[.!?]$/)) {
      paraEnd = i + 1;
      break;
    }
  }
  
  return {
    paraStart,
    paraEnd,
    currentParaIndex: 0,
    totalParagraphs: 1,
  };
}
