import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chapter } from '../../../utils/epubParser';

export const useProgress = (chapters: Chapter[], bookUri?: string) => {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  // Load saved progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      if (!bookUri || chapters.length === 0) {
        setIsLoadingProgress(false);
        return;
      }
      
      try {
        const savedProgress = await AsyncStorage.getItem(`book_progress_${bookUri}`);
        if (savedProgress) {
          const { chapterIndex, wordIndex } = JSON.parse(savedProgress);
          if (chapterIndex >= 0 && chapterIndex < chapters.length && wordIndex >= 0) {
            setCurrentChapterIndex(chapterIndex);
            setCurrentWordIndex(wordIndex);
          }
        }
      } catch (error) {
        console.error('Error loading progress:', error);
      } finally {
        setIsLoadingProgress(false);
      }
    };
    
    loadProgress();
  }, [bookUri, chapters.length]);

  // Find which chapter the current word belongs to
  useEffect(() => {
    if (isLoadingProgress || chapters.length === 0) return;
    
    const allWords = chapters.flatMap(ch => ch.words);
    let wordCount = 0;
    for (let i = 0; i < chapters.length; i++) {
      const chapterEnd = wordCount + chapters[i].words.length;
      if (currentWordIndex < chapterEnd) {
        if (i !== currentChapterIndex) {
          setCurrentChapterIndex(i);
        }
        break;
      }
      wordCount = chapterEnd;
    }
  }, [currentWordIndex, chapters, currentChapterIndex, isLoadingProgress]);

  // Save progress whenever it changes
  useEffect(() => {
    if (!bookUri || isLoadingProgress || chapters.length === 0) return;
    
    const saveProgress = async () => {
      try {
        await AsyncStorage.setItem(`book_progress_${bookUri}`, JSON.stringify({
          chapterIndex: currentChapterIndex,
          wordIndex: currentWordIndex,
        }));
      } catch (error) {
        console.error('Error saving progress:', error);
      }
    };
    
    saveProgress();
  }, [bookUri, currentChapterIndex, currentWordIndex, isLoadingProgress, chapters.length]);

  return {
    currentChapterIndex,
    setCurrentChapterIndex,
    currentWordIndex,
    setCurrentWordIndex,
    isLoadingProgress,
  };
};
