import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chapter } from '../../../utils/epubParser';

export const useProgress = (
  chapters: Chapter[],
  bookUri: string | undefined,
  currentWordIndex: number, // Accept currentWordIndex from wordProcessing (single source of truth)
  onInitialLoad?: (wordIndex: number) => void // Callback to set initial state (chapterIndex is derived automatically)
) => {
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  // Calculate current chapter index from currentWordIndex
  const currentChapterIndex = useMemo(() => {
    if (chapters.length === 0) return 0;
    
    let wordCount = 0;
    for (let i = 0; i < chapters.length; i++) {
      const chapterEnd = wordCount + chapters[i].words.length;
      if (currentWordIndex < chapterEnd) {
        return i;
      }
      wordCount = chapterEnd;
    }
    return chapters.length - 1;
  }, [currentWordIndex, chapters]);

  // Load saved progress on mount and call callback to set initial state
  useEffect(() => {
    const loadProgress = async () => {
      if (!bookUri || chapters.length === 0) {
        setIsLoadingProgress(false);
        return;
      }
      
      try {
        const savedProgress = await AsyncStorage.getItem(`book_progress_${bookUri}`);
        if (savedProgress && onInitialLoad) {
          const { wordIndex } = JSON.parse(savedProgress);
          if (wordIndex >= 0) {
            onInitialLoad(wordIndex);
          }
        }
      } catch (error) {
        console.error('Error loading progress:', error);
      } finally {
        setIsLoadingProgress(false);
      }
    };
    
    loadProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookUri, chapters.length]); // onInitialLoad intentionally excluded - should only run on mount

  // Save progress whenever it changes (debounced to avoid excessive writes)
  useEffect(() => {
    if (!bookUri || isLoadingProgress || chapters.length === 0) return;

    const timeoutId = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(`book_progress_${bookUri}`, JSON.stringify({
          chapterIndex: currentChapterIndex,
          wordIndex: currentWordIndex,
        }));
      } catch (error) {
        console.error('Error saving progress:', error);
      }
    }, 1000); // Wait 1 second after last change before saving

    return () => clearTimeout(timeoutId);
  }, [bookUri, currentChapterIndex, currentWordIndex, isLoadingProgress, chapters.length]);

  return {
    currentChapterIndex,
    isLoadingProgress,
  };
};
