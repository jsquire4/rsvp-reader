// Helper function to get clean word length (without punctuation)
export const getCleanWordLength = (word: string): number => {
  if (!word) return 0;
  return word.replace(/[.,!?;:—–()[\]{}"'«‹»›-]/g, '').length;
};

// Determine if we should combine current word with next word for display
export const getDisplayWords = (wordIndex: number, allWords: string[]): { words: string[], nextIndex: number } => {
  const currentWord = allWords[wordIndex] || '';
  const currentCleanLength = getCleanWordLength(currentWord);
  
  // Single letter words: always combine with next word
  if (currentCleanLength === 1 && wordIndex < allWords.length - 1) {
    const nextWord = allWords[wordIndex + 1] || '';
    return {
      words: [currentWord, nextWord],
      nextIndex: wordIndex + 2 // Skip both words
    };
  }
  
  // Two letter words: combine with next word if next word is less than 5 letters
  if (currentCleanLength === 2 && wordIndex < allWords.length - 1) {
    const nextWord = allWords[wordIndex + 1] || '';
    const nextCleanLength = getCleanWordLength(nextWord);
    if (nextCleanLength < 5) {
      return {
        words: [currentWord, nextWord],
        nextIndex: wordIndex + 2 // Skip both words
      };
    }
  }
  
  // Default: display single word
  return {
    words: [currentWord],
    nextIndex: wordIndex + 1
  };
};

// Calculate accent letter position based on word length
export const getAccentIndex = (word: string): number => {
  if (!word || word.length === 0) return 0;
  
  // Find all letter positions in the word
  const letterPositions: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (/[a-zA-Z]/.test(word[i])) {
      letterPositions.push(i);
    }
  }
  
  if (letterPositions.length === 0) return 0;
  if (letterPositions.length === 1) return letterPositions[0];
  
  let targetLetterIndex = 0; // 0-indexed position in letterPositions array
  
  if (letterPositions.length >= 2 && letterPositions.length <= 4) {
    // 2-4 letters: highlight 2nd letter (index 1)
    targetLetterIndex = 1;
  } else if (letterPositions.length >= 5 && letterPositions.length <= 6) {
    // 5-6 letters: highlight 3rd letter (index 2)
    targetLetterIndex = 2;
  } else if (letterPositions.length >= 7) {
    if (letterPositions.length % 2 === 0) {
      // Even: first letter of middle pair
      // For 8 letters: positions 0,1,2,3,4,5,6,7, middle pair is 3,4, first is 3
      targetLetterIndex = letterPositions.length / 2 - 1;
    } else {
      // Odd: letter just before middle
      // For 7 letters: positions 0,1,2,3,4,5,6, middle is 3, before is 2
      targetLetterIndex = Math.floor(letterPositions.length / 2) - 1;
    }
  }
  
  return letterPositions[targetLetterIndex] || letterPositions[0];
};

// Format chapter title - add "Chapter" prefix if it's just a number
export const formatChapterTitle = (title: string): string => {
  const trimmed = title.trim();
  // Check if title is just a number (with optional whitespace)
  if (/^\d+$/.test(trimmed)) {
    return `Chapter ${trimmed}`;
  }
  return trimmed;
};
