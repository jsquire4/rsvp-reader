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
  // Uses actual paragraph breaks (line breaks or HTML tags) instead of sentence endings
  const paragraphBoundaries = useMemo(() => {
    const currentChapter = chapters[currentChapterIndex];
    if (!currentChapter) return { paraStart: 0, paraEnd: 0 };
    
    const chapterStart = wordsBeforeChapterMemo;
    const chapterEnd = chapterStart + currentChapter.words.length;
    const currentWordInChapter = currentWordIndex - chapterStart;
    
    // Try to use rawText first (more reliable for paragraph detection)
    if (currentChapter.rawText) {
      const paragraphs = currentChapter.rawText.split(/\n\n+/).filter(p => p.trim());
      
      // Find which paragraph contains the current word
      let wordCount = 0;
      let currentParaIndex = 0;
      for (let i = 0; i < paragraphs.length; i++) {
        const paraWordCount = paragraphs[i].split(/\s+/).filter(w => w.trim()).length;
        if (wordCount + paraWordCount > currentWordInChapter) {
          currentParaIndex = i;
          break;
        }
        wordCount += paraWordCount;
        if (i === paragraphs.length - 1) currentParaIndex = i;
      }
      
      // Calculate word indices for current paragraph
      let paraStartWordCount = 0;
      for (let i = 0; i < currentParaIndex; i++) {
        const paraWordCount = paragraphs[i].split(/\s+/).filter(w => w.trim()).length;
        paraStartWordCount += paraWordCount;
      }
      
      const currentParaWordCount = paragraphs[currentParaIndex].split(/\s+/).filter(w => w.trim()).length;
      const paraEndWordCount = paraStartWordCount + currentParaWordCount;
      
      return {
        paraStart: chapterStart + paraStartWordCount,
        paraEnd: Math.min(chapterEnd, chapterStart + paraEndWordCount)
      };
    }
    
    // Fallback to HTML paragraph tags
    if (currentChapter.htmlContent) {
      const html = currentChapter.htmlContent;
      const paraMatches = html.match(/<(p|div)[^>]*>[\s\S]*?<\/(p|div)>/gi);
      if (paraMatches && paraMatches.length > 0) {
        let wordCount = 0;
        let currentParaIndex = 0;
        
        for (let i = 0; i < paraMatches.length; i++) {
          const text = paraMatches[i].replace(/<[^>]*>/g, '');
          const paraWordCount = text.split(/\s+/).filter(w => w.trim()).length;
          if (wordCount + paraWordCount > currentWordInChapter) {
            currentParaIndex = i;
            break;
          }
          wordCount += paraWordCount;
          if (i === paraMatches.length - 1) currentParaIndex = i;
        }
        
        let paraStartWordCount = 0;
        for (let i = 0; i < currentParaIndex; i++) {
          const text = paraMatches[i].replace(/<[^>]*>/g, '');
          const paraWordCount = text.split(/\s+/).filter(w => w.trim()).length;
          paraStartWordCount += paraWordCount;
        }
        
        const currentParaText = paraMatches[currentParaIndex].replace(/<[^>]*>/g, '');
        const currentParaWordCount = currentParaText.split(/\s+/).filter(w => w.trim()).length;
        const paraEndWordCount = paraStartWordCount + currentParaWordCount;
        
        return {
          paraStart: chapterStart + paraStartWordCount,
          paraEnd: Math.min(chapterEnd, chapterStart + paraEndWordCount)
        };
      }
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
