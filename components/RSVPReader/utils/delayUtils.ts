import { Settings } from '../types';
import { getCleanWordLength, getDisplayWords } from './wordUtils';

// Calculate swing variation based on word length
// Adds +/- 10% variation, biased toward longer words (slower) and shorter words (faster)
export const calculateSwing = (word: string): number => {
  if (!word || word.length === 0) return 0;
  
  // Remove punctuation to get actual word length
  const cleanWord = word.replace(/[.,!?;:—–()[\]{}"'«‹»›]/g, '');
  const wordLength = cleanWord.length;
  
  // Normalize word length to 0-1 scale (assuming words range from 1-15 characters typically)
  // Cap at 15 for normalization, but allow longer words
  const normalizedLength = Math.min(wordLength / 15, 1);
  
  // Generate random value between -0.10 and +0.10
  const randomVariation = (Math.random() * 0.2) - 0.10; // Range: -0.10 to +0.10
  
  // Bias factor: shifts the random variation based on word length
  // Short words (normalizedLength ~ 0): bias toward -0.10 (faster)
  // Long words (normalizedLength ~ 1): bias toward +0.10 (slower)
  // Medium words (normalizedLength ~ 0.5): neutral bias
  const biasFactor = (normalizedLength - 0.5) * 0.133; // Range: -0.0665 to +0.0665 (reduced to fit within +/- 10%)
  
  // Combine random variation with bias
  // The bias shifts the center of the random distribution
  const swing = randomVariation + biasFactor;
  
  // Clamp to +/- 10% to ensure we stay within bounds
  return Math.max(-0.10, Math.min(0.10, swing));
};

// Calculate delay for current word based on punctuation
// Punctuation pauses are ADDITIONAL to the base word delay
export const getWordDelay = (
  wordIndex: number,
  allWords: string[],
  chapters: { words: string[] }[],
  settings: Settings,
  delayMs: number
): number => {
  const displayInfo = getDisplayWords(wordIndex, allWords);
  const wordsToDisplay = displayInfo.words;
  const isMultipleWords = wordsToDisplay.length > 1;
  
  // When multiple words are displayed together, calculate delay scaling based on WPM
  // At slower speeds (< 250 WPM): single word delay
  // From 250-600 WPM: scale from single to double word delay
  // At 600+ WPM: full two-word delay (double)
  // Exception: If total letter count exceeds 11 letters, always use full two-word delay
  let delayMultiplier = 1.0;
  if (isMultipleWords) {
    // Calculate total letter count (excluding spaces and punctuation)
    const totalLetters = wordsToDisplay.reduce((sum, word) => {
      return sum + getCleanWordLength(word);
    }, 0);
    
    const wpm = settings.wordsPerMinute;
    
    // If total letters exceed 11, always use full two-word delay
    if (totalLetters > 11) {
      delayMultiplier = 2.0; // Full two-word delay
    } else if (wpm < 250) {
      delayMultiplier = 1.0; // Single word delay
    } else if (wpm >= 250 && wpm <= 600) {
      // Linear scaling from 1.0 to 2.0 over 250-600 WPM range
      const scaleFactor = (wpm - 250) / (600 - 250); // 0.0 to 1.0
      delayMultiplier = 1.0 + scaleFactor; // 1.0 to 2.0
    } else {
      delayMultiplier = 2.0; // Full two-word delay
    }
  }
  
  // Calculate delay for first word (or single word)
  const wordToUse = wordsToDisplay[0] || '';
  
  if (!wordToUse || wordToUse.length === 0) return delayMs;
  
  // Check if word is hyphenated (contains hyphen, em dash, en dash, or double dashes)
  // Match: regular hyphen (-), em dash (—), en dash (–), or double hyphens/dashes (--)
  const hyphenPattern = /[-—–]{1,2}/g;
  const isHyphenated = hyphenPattern.test(wordToUse);
  
  // Count number of hyphenated parts
  // Count all hyphen/dash occurrences (including em dashes, en dashes, and double dashes)
  let hyphenatedParts = 1; // Default to 1 part (non-hyphenated word)
  if (isHyphenated) {
    // Reset regex lastIndex to ensure accurate counting
    hyphenPattern.lastIndex = 0;
    const matches = wordToUse.match(hyphenPattern) || [];
    // Count all hyphen/dash occurrences and add 1 to get number of parts
    hyphenatedParts = matches.length + 1;
  }
  
  // Apply swing to base delay
  const swingFactor = calculateSwing(wordToUse);
  let baseDelayWithSwing = delayMs * (1 + swingFactor);
  
  // For hyphenated words, pause for the same number of parts as hyphenated words
  // e.g., 3 parts = 3x delay, 4 parts = 4x delay
  if (isHyphenated) {
    baseDelayWithSwing = delayMs * hyphenatedParts * (1 + swingFactor);
  }
  
  // Apply multiplier for multiple words (scales based on WPM)
  baseDelayWithSwing = baseDelayWithSwing * delayMultiplier;
  
  // Use the last word for punctuation detection
  const lastWord = wordsToDisplay[wordsToDisplay.length - 1] || wordToUse;
  const lastWordIndex = wordIndex + wordsToDisplay.length - 1;
  let totalDelay = baseDelayWithSwing;
  
  // Check for opening quotation marks at the start of the last word
  const startsWithQuote = /^["'«‹]/.test(lastWord);
  
  // Check if this is the end of a paragraph
  // A paragraph ends if we're at the end of a chapter
  let isEndOfParagraph = false;
  if (lastWordIndex >= 0) {
    let wordCount = 0;
    for (let i = 0; i < chapters.length; i++) {
      const chapterEnd = wordCount + chapters[i].words.length;
      if (lastWordIndex < chapterEnd) {
        // Check if this is the last word in this chapter
        isEndOfParagraph = (lastWordIndex === chapterEnd - 1);
        break;
      }
      wordCount = chapterEnd;
    }
  }
  
  // Check for comma
  if (/,$/.test(lastWord)) {
    // Comma pause: additional pause equal to 75% of word pause (delayMs * 0.75)
    totalDelay += delayMs * 0.75;
  }
  // Check for opening quotation marks
  else if (startsWithQuote) {
    // Opening quote pause: additional pause equal to 75% of word pause (delayMs * 0.75)
    totalDelay += delayMs * 0.75;
  }
  // Check for end-of-sentence punctuation: . ! ? ; : — –
  else if (/[.!?;:]$/.test(lastWord) || lastWord.endsWith('—') || lastWord.endsWith('–')) {
    // End of sentence pause: additional pause equal to 75% of word pause (delayMs * 0.75) - same as comma
    totalDelay += delayMs * 0.75;
    
    // If this is also the end of a paragraph, add paragraph pause
    if (isEndOfParagraph) {
      // End of paragraph: additional pause equal to 150% of word pause (delayMs * 1.5)
      totalDelay += delayMs * 1.5;
    }
  }
  // Check for other grammatical markings: closing quotes, parentheses, brackets, etc.
  else if (/[)\]}"'»›]$/.test(lastWord)) {
    // Other grammatical markings: additional pause equal to 37.5% of word pause (delayMs * 0.375)
    totalDelay += delayMs * 0.375;
  }
  
  // Also check if this word is at the end of a paragraph (even without sentence-ending punctuation)
  if (isEndOfParagraph && !/[.!?;:]$/.test(lastWord) && !lastWord.endsWith('—') && !lastWord.endsWith('–')) {
    // End of paragraph: additional pause equal to 150% of word pause (delayMs * 1.5)
    totalDelay += delayMs * 1.5;
  }
  
  return totalDelay;
};
