import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Chapter } from '../../../utils/epubParser';
import { Settings } from '../types';
import { getDisplayWords } from '../utils/wordUtils';
import { getWordDelay } from '../utils/delayUtils';

export const useWordProcessing = (
  chapters: Chapter[],
  settings: Settings,
  currentChapterIndex: number,
  onComplete?: () => void
) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const allWords = chapters.flatMap(ch => ch.words);
  const delayMs = (60 / settings.wordsPerMinute) * 1000;

  // Word advancement effect
  useEffect(() => {
    if (!isPlaying || currentWordIndex >= allWords.length) {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Use setTimeout with dynamic delays based on punctuation
    const displayInfo = getDisplayWords(currentWordIndex, allWords);
    const wordDelay = getWordDelay(currentWordIndex, allWords, chapters, settings, delayMs);
    const nextIndex = displayInfo.nextIndex;
    
    const timeoutId = setTimeout(() => {
      setCurrentWordIndex((prev) => {
        const displayInfo = getDisplayWords(prev, allWords);
        const nextIdx = displayInfo.nextIndex;
        
        if (nextIdx >= allWords.length) {
          setIsPlaying(false);
          onComplete?.();
          return prev;
        }
        return nextIdx;
      });
    }, wordDelay);
    
    intervalRef.current = timeoutId as any; // Store timeout ID for cleanup

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (intervalRef.current) {
        clearTimeout(intervalRef.current as any);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, currentWordIndex, allWords.length, delayMs, onComplete, settings.wordsPerMinute, chapters, settings]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentWordIndex(0);
    setIsPlaying(false);
  };

  const handlePrevious = () => {
    setCurrentWordIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentWordIndex((prev) => Math.min(allWords.length - 1, prev + 1));
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearTimeout(intervalRef.current as any);
      intervalRef.current = null;
    }
  };

  // Memoize words before chapter (needed for other calculations)
  const wordsBeforeChapterMemo = useMemo(() => {
    return chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0);
  }, [chapters, currentChapterIndex]);

  // Memoize paragraph boundaries to avoid recalculation
  const paragraphBoundaries = useMemo(() => {
    const currentChapter = chapters[currentChapterIndex];
    if (!currentChapter) return { paraStart: 0, paraEnd: 0 };
    
    const chapterStart = wordsBeforeChapterMemo;
    const chapterEnd = chapterStart + currentChapter.words.length;
    
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
    
    return { paraStart, paraEnd };
  }, [currentWordIndex, allWords, wordsBeforeChapterMemo, chapters, currentChapterIndex]);

  return {
    isPlaying,
    setIsPlaying,
    currentWordIndex,
    setCurrentWordIndex,
    allWords,
    delayMs,
    handlePlayPause,
    handleReset,
    handlePrevious,
    handleNext,
    stopPlayback,
    wordsBeforeChapterMemo,
    paragraphBoundaries,
  };
};
