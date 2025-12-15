import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView, TextInput, Switch, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import RenderHTML from 'react-native-render-html';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chapter } from '../utils/epubParser';

interface RSVPReaderProps {
  chapters: Chapter[];
  initialWordsPerMinute?: number;
  onComplete?: () => void;
  bookUri?: string; // Book URI for saving progress
}

interface Settings {
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  backgroundColor: string;
  textColor: string;
  contextWordsColor: string;
  showContextWords: boolean;
  contextWordsSpacing: number;
  wordColor: string;
}

const COMMON_COLORS = [
  { name: 'Green', value: '#00ff88' },
  { name: 'Yellow', value: '#ffeb3b' },
  { name: 'Cyan', value: '#00bcd4' },
  { name: 'Orange', value: '#ff9800' },
  { name: 'Pink', value: '#e91e63' },
  { name: 'Blue', value: '#2196f3' },
  { name: 'Red', value: '#f44336' },
  { name: 'Purple', value: '#9c27b0' },
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
];

const BACKGROUND_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Dark Gray', value: '#1a1a1a' },
  { name: 'Gray', value: '#2a2a2a' },
  { name: 'Navy', value: '#0a0a1a' },
  { name: 'Dark Blue', value: '#0a1a2a' },
];

const TEXT_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Light Gray', value: '#e0e0e0' },
  { name: 'Beige', value: '#f5f5dc' },
  { name: 'Light Blue', value: '#add8e6' },
  { name: 'Yellow', value: '#ffffcc' },
];

const FONT_FAMILIES = [
  'System',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
  'Trebuchet MS',
  'Palatino',
  'Garamond',
  'Bookman',
  'Comic Sans MS',
  'Impact',
  'Lucida Console',
  'Tahoma',
  'Courier',
  'Monaco',
  'Menlo',
  'Consolas',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Raleway',
  'Oswald',
  'Source Sans Pro',
  'PT Sans',
  'Ubuntu',
  'Playfair Display',
  'Merriweather',
];

type ViewMode = 'speed' | 'paragraph' | 'page';

export default function RSVPReader({ 
  chapters, 
  initialWordsPerMinute = 250,
  onComplete,
  bookUri 
}: RSVPReaderProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('speed');
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordsPerMinute, setWordsPerMinute] = useState(Math.round(initialWordsPerMinute));
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [showWordSelection, setShowWordSelection] = useState(false);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>({
    accentColor: '#00ff88',
    fontFamily: 'System',
    fontSize: 48,
    backgroundColor: '#000000',
    textColor: '#ffffff',
    contextWordsColor: '#999999',
    showContextWords: true,
    contextWordsSpacing: 10,
    wordColor: '#ffffff',
  });
  const [customAccentColorInput, setCustomAccentColorInput] = useState('');
  const [customWordColorInput, setCustomWordColorInput] = useState('');
  const [customBackgroundColorInput, setCustomBackgroundColorInput] = useState('');
  const [customTextColorInput, setCustomTextColorInput] = useState('');
  const [customContextWordsColorInput, setCustomContextWordsColorInput] = useState('');
  const [tooltip, setTooltip] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Flatten all words from all chapters for continuous reading
  const allWords = chapters.flatMap(ch => ch.words);
  const currentChapter = chapters[currentChapterIndex];
  const currentWord = allWords[currentWordIndex] || '';

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

  // Calculate delay in milliseconds based on words per minute
  const delayMs = (60 / wordsPerMinute) * 1000;

  // Calculate estimated time to completion
  const remainingWords = allWords.length - currentWordIndex - 1;
  const estimatedMinutes = remainingWords > 0 ? remainingWords / wordsPerMinute : 0;
  const estimatedTime = estimatedMinutes < 1 
    ? `${Math.round(estimatedMinutes * 60)}s`
    : estimatedMinutes < 60
    ? `${Math.round(estimatedMinutes)}m`
    : `${Math.floor(estimatedMinutes / 60)}h ${Math.round(estimatedMinutes % 60)}m`;

  // Find which chapter the current word belongs to
  useEffect(() => {
    if (isLoadingProgress || chapters.length === 0) return;
    
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

  useEffect(() => {
    if (isPlaying && currentWordIndex < allWords.length) {
      intervalRef.current = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= allWords.length - 1) {
            setIsPlaying(false);
            onComplete?.();
            return prev;
          }
          return prev + 1;
        });
      }, delayMs);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, currentWordIndex, allWords.length, delayMs, onComplete]);

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

  const handleSpeedChange = (delta: number) => {
    setWordsPerMinute((prev) => Math.max(50, Math.min(1000, Math.round(prev + delta))));
  };

  const handleSpeedSliderChange = (value: number) => {
    setWordsPerMinute(Math.round(value));
  };

  const handlePreviousChapter = () => {
    if (currentChapterIndex > 0) {
      let wordCount = 0;
      for (let i = 0; i < currentChapterIndex; i++) {
        wordCount += chapters[i].words.length;
      }
      setCurrentWordIndex(wordCount);
      setIsPlaying(false);
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      let wordCount = 0;
      for (let i = 0; i <= currentChapterIndex; i++) {
        wordCount += chapters[i].words.length;
      }
      setCurrentWordIndex(wordCount);
      setIsPlaying(false);
    }
  };

  const handleChapterSelect = (chapterIndex: number) => {
    let wordCount = 0;
    for (let i = 0; i < chapterIndex; i++) {
      wordCount += chapters[i].words.length;
    }
    setCurrentWordIndex(wordCount);
    setShowChapterMenu(false);
    setIsPlaying(false);
  };

  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    // Immediately update view mode for instant feedback
    if (newMode === 'speed' && viewMode !== 'speed') {
      // If coming from paragraph/page view and word is selected, use that
      if (selectedWordIndex !== null) {
        setCurrentWordIndex(selectedWordIndex);
        setSelectedWordIndex(null);
        setViewMode('speed');
        setIsPlaying(false);
      } else {
        // Show word selection modal when switching to speed reading
        setShowWordSelection(true);
      }
    } else {
      // Immediate mode switch - works for all transitions including speed -> page/paragraph
      setViewMode(newMode);
      setIsPlaying(false);
      // Clear selection when switching away from paragraph/page views
      if (newMode === 'speed') {
        setSelectedWordIndex(null);
      }
    }
  }, [viewMode, selectedWordIndex]);

  const handleWordSelectionConfirm = (wordIndex: number) => {
    setCurrentWordIndex(wordIndex);
    setViewMode('speed');
    setShowWordSelection(false);
    setIsPlaying(false);
    setSelectedWordIndex(null);
  };

  const handleWordPress = (wordIndex: number) => {
    if (viewMode === 'paragraph' || viewMode === 'page') {
      setSelectedWordIndex(wordIndex);
    }
  };

  // Memoize words before chapter (needed for other calculations)
  const wordsBeforeChapterMemo = useMemo(() => {
    return chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0);
  }, [chapters, currentChapterIndex]);

  // Memoize paragraph boundaries to avoid recalculation
  const paragraphBoundaries = useMemo(() => {
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
  }, [currentWordIndex, currentChapterIndex, allWords, currentChapter, wordsBeforeChapterMemo]);

  // Memoize paragraph text
  const paragraphText = useMemo(() => {
    return allWords.slice(paragraphBoundaries.paraStart, paragraphBoundaries.paraEnd).join(' ');
  }, [allWords, paragraphBoundaries]);

  // Memoize paragraph HTML - extract only current paragraph (optimized)
  const paragraphHTML = useMemo(() => {
    if (!currentChapter?.htmlContent) return null;
    
    // Use paragraph boundaries to find the paragraph in HTML
    const { paraStart, paraEnd } = paragraphBoundaries;
    const wordsBeforeChapter = wordsBeforeChapterMemo;
    const paraStartInChapter = paraStart - wordsBeforeChapter;
    const paraEndInChapter = paraEnd - wordsBeforeChapter;
    
    // Extract text up to paragraph start to count words in HTML
    // This is faster than parsing all HTML
    const html = currentChapter.htmlContent;
    
    // Simple approach: find paragraph tags and extract the one containing our word range
    // Split by <p> or <div> tags
    const paraMatches = html.match(/<(p|div)[^>]*>[\s\S]*?<\/(p|div)>/gi);
    if (!paraMatches || paraMatches.length === 0) return null;
    
    // Count words in each paragraph to find the right one
    let wordCount = 0;
    let targetPara = paraMatches[0]; // Default to first paragraph
    
    for (const para of paraMatches) {
      const text = para.replace(/<[^>]*>/g, '');
      const paraWordCount = text.split(/\s+/).filter(w => w.trim()).length;
      
      if (wordCount + paraWordCount > paraStartInChapter) {
        targetPara = para;
        break;
      }
      wordCount += paraWordCount;
    }
    
    return targetPara || null;
  }, [currentChapter, paragraphBoundaries, wordsBeforeChapterMemo]);

  // Memoize page text - limit to 5-6 paragraphs
  const pageText = useMemo(() => {
    if (currentChapter.rawText) {
      // Split by double newlines (paragraphs)
      const paragraphs = currentChapter.rawText.split(/\n\n+/).filter(p => p.trim());
      // Find which paragraph contains current word
      const wordsBeforeChapter = wordsBeforeChapterMemo;
      const currentWordInChapter = currentWordIndex - wordsBeforeChapter;
      
      // Find paragraph index containing current word
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
      
      // Get 5-6 paragraphs starting from current paragraph
      const startIndex = Math.max(0, currentParaIndex);
      const endIndex = Math.min(paragraphs.length, startIndex + 6);
      return paragraphs.slice(startIndex, endIndex).join('\n\n');
    }
    // Fallback to words if no rawText
    return currentChapter.words.join(' ');
  }, [currentChapter, currentWordIndex, wordsBeforeChapterMemo]);

  // Memoize effective font size
  const effectiveFontSize = useMemo(() => {
    if (viewMode === 'paragraph' || viewMode === 'page') {
      return Math.max(16, settings.fontSize * 0.6);
    }
    return settings.fontSize;
  }, [viewMode, settings.fontSize]);

  // Navigate to previous paragraph
  const handlePreviousParagraph = useCallback(() => {
    const { paraStart } = paragraphBoundaries;
    
    // Find previous paragraph start
    let prevParaStart = wordsBeforeChapterMemo;
    for (let i = paraStart - 2; i >= wordsBeforeChapterMemo; i--) {
      const word = allWords[i];
      if (word.match(/[.!?]$/)) {
        prevParaStart = i + 1;
        break;
      }
      if (i === wordsBeforeChapterMemo) {
        prevParaStart = wordsBeforeChapterMemo;
        break;
      }
    }
    
    setCurrentWordIndex(prevParaStart);
  }, [paragraphBoundaries, wordsBeforeChapterMemo, allWords]);

  // Navigate to next paragraph
  const handleNextParagraph = useCallback(() => {
    const { paraEnd } = paragraphBoundaries;
    const chapterEnd = wordsBeforeChapterMemo + currentChapter.words.length;
    
    if (paraEnd < chapterEnd) {
      setCurrentWordIndex(paraEnd);
    }
  }, [paragraphBoundaries, wordsBeforeChapterMemo, currentChapter]);

  // Navigate to previous page (chapter)
  const handlePreviousPage = () => {
    handlePreviousChapter();
  };

  // Navigate to next page (chapter)
  const handleNextPage = () => {
    handleNextChapter();
  };

  // Calculate accent letter position based on word length
  const getAccentIndex = (word: string): number => {
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

  // Render word with color accent on dynamically positioned letter
  const renderWordWithAccent = (word: string) => {
    if (!word || word.length === 0) return <Text style={[styles.word, { fontSize: settings.fontSize, color: settings.wordColor }]}>{word}</Text>;
    
    const accentIndex = getAccentIndex(word);
    const before = word.substring(0, accentIndex);
    const accent = word[accentIndex];
    const after = word.substring(accentIndex + 1);

    const fontFamily = settings.fontFamily === 'System' ? undefined : settings.fontFamily;

    return (
      <Text style={[styles.word, { fontSize: settings.fontSize, fontFamily }]}>
        <Text style={{ color: settings.wordColor }}>{before}</Text>
        <Text style={[styles.accentLetter, { color: settings.accentColor }]}>{accent}</Text>
        <Text style={{ color: settings.wordColor }}>{after}</Text>
      </Text>
    );
  };

  const progress = allWords.length > 0 ? ((currentWordIndex + 1) / allWords.length) * 100 : 0;
  const chapterProgress = currentChapter ? 
    ((currentWordIndex - chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0) + 1) / currentChapter.words.length) * 100 : 0;

  // Format chapter title - add "Chapter" prefix if it's just a number
  const formatChapterTitle = (title: string): string => {
    const trimmed = title.trim();
    // Check if title is just a number (with optional whitespace)
    if (/^\d+$/.test(trimmed)) {
      return `Chapter ${trimmed}`;
    }
    return trimmed;
  };

  // Calculate current word index within chapter
  const currentWordInChapter = currentWordIndex - wordsBeforeChapterMemo + 1;
  const totalWordsInChapter = currentChapter?.words.length || 0;
  const bookRemainingPercent = allWords.length > 0 
    ? Math.round(((allWords.length - currentWordIndex - 1) / allWords.length) * 100)
    : 0;

  // Get previous and next words for display
  const prevWords: string[] = [];
  const nextWords: string[] = [];
  const wordsToShow = 3;
  
  for (let i = 1; i <= wordsToShow; i++) {
    if (currentWordIndex - i >= 0) {
      prevWords.unshift(allWords[currentWordIndex - i]);
    }
    if (currentWordIndex + i < allWords.length) {
      nextWords.push(allWords[currentWordIndex + i]);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Chapter name at top */}
      {currentChapter?.title && (
        <View style={styles.chapterNameContainer}>
          <Text style={styles.chapterName}>{formatChapterTitle(currentChapter.title)}</Text>
        </View>
      )}

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.progressSlider}
          minimumValue={0}
          maximumValue={allWords.length - 1}
          value={currentWordIndex}
          onValueChange={(value) => {
            setCurrentWordIndex(Math.round(value));
            setIsPlaying(false);
          }}
          minimumTrackTintColor={settings.accentColor}
          maximumTrackTintColor="#333"
          thumbTintColor={settings.accentColor}
          step={1}
        />
        <Text style={styles.progressText}>
          {currentWordInChapter} / {totalWordsInChapter} • {bookRemainingPercent}% remaining
        </Text>
      </View>

      {/* Reader area - different views */}
      <View style={viewMode === 'speed' ? styles.readerAreaSpeed : styles.readerArea}>
        {viewMode === 'speed' && (
          <View style={styles.readerContentSpeed}>
            {/* Previous words with fade effect - horizontal layout */}
            {settings.showContextWords && (
              <View style={styles.contextWordsLeft}>
                <Text style={styles.contextWordsContainer} numberOfLines={1}>
                  {prevWords.map((word, idx) => {
                    // Left side: fade left (idx=0 furthest left = lowest opacity, idx=2 closest to center = highest opacity)
                    // Opacity increases as idx increases (closer to center)
                    const opacity = Math.max(0.1, 0.1 + (idx / wordsToShow) * 0.5);
                    const fontFamily = settings.fontFamily === 'System' ? undefined : settings.fontFamily;
                    return (
                      <Text 
                        key={`prev-${idx}`} 
                        style={[
                          styles.contextWord, 
                          { 
                            opacity, 
                            fontSize: settings.fontSize,
                            fontFamily,
                            color: settings.contextWordsColor,
                          }
                        ]}
                      >
                        {word}{idx < prevWords.length - 1 ? ' ' : ''}
                      </Text>
                    );
                  })}
                </Text>
              </View>
            )}

            {/* Current word */}
            <View style={[
              styles.currentWordContainer,
              {
                // User-adjustable spacing
                paddingHorizontal: settings.contextWordsSpacing,
              }
            ]}>
              {renderWordWithAccent(currentWord)}
            </View>

            {/* Next words with fade effect - horizontal layout */}
            {settings.showContextWords && (
              <View style={styles.contextWordsRight}>
                <Text style={styles.contextWordsContainer} numberOfLines={1}>
                  {nextWords.map((word, idx) => {
                    // Right side: fade right (idx=0 closest to center = highest opacity, idx=2 furthest right = lowest opacity)
                    const distanceFromRightEdge = idx + 1;
                    const opacity = Math.max(0.1, 0.6 - (distanceFromRightEdge / wordsToShow) * 0.5);
                    const fontFamily = settings.fontFamily === 'System' ? undefined : settings.fontFamily;
                    return (
                      <Text 
                        key={`next-${idx}`} 
                        style={[
                          styles.contextWord, 
                          { 
                            opacity, 
                            fontSize: settings.fontSize,
                            fontFamily,
                            color: settings.contextWordsColor,
                          }
                        ]}
                      >
                        {idx > 0 ? ' ' : ''}{word}
                      </Text>
                    );
                  })}
                </Text>
              </View>
            )}
          </View>
        )}
        
        {viewMode === 'paragraph' && (
          <View style={styles.textViewContainer}>
            <ScrollView 
              style={styles.textView} 
              contentContainerStyle={styles.textViewContent}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.centeredTextView}>
                {paragraphHTML ? (
                  <RenderHTML
                    contentWidth={800}
                    source={{ html: paragraphHTML }}
                    baseStyle={{
                      color: settings.textColor,
                      fontSize: effectiveFontSize,
                      fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
                      textAlign: 'left',
                      lineHeight: effectiveFontSize * 1.5,
                    }}
                    tagsStyles={{
                      p: { marginBottom: effectiveFontSize * 0.8, marginTop: effectiveFontSize * 0.4 },
                      div: { marginBottom: effectiveFontSize * 0.8 },
                      br: { height: effectiveFontSize * 0.5 },
                      strong: { fontWeight: 'bold' },
                      b: { fontWeight: 'bold' },
                      em: { fontStyle: 'italic' },
                      i: { fontStyle: 'italic' },
                      u: { textDecorationLine: 'underline' },
                      h1: { fontSize: effectiveFontSize * 1.5, fontWeight: 'bold', marginBottom: effectiveFontSize },
                      h2: { fontSize: effectiveFontSize * 1.3, fontWeight: 'bold', marginBottom: effectiveFontSize * 0.8 },
                      h3: { fontSize: effectiveFontSize * 1.1, fontWeight: 'bold', marginBottom: effectiveFontSize * 0.6 },
                    }}
                  />
                ) : (
                  <Text 
                    selectable
                    onPress={() => {
                      // When text is tapped, use current word index
                      setSelectedWordIndex(currentWordIndex);
                    }}
                    onLongPress={() => {
                      // Long press also selects current word position
                      setSelectedWordIndex(currentWordIndex);
                    }}
                    style={[
                      styles.paragraphText, 
                      { 
                        fontSize: effectiveFontSize, 
                        fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
                        color: settings.textColor,
                      }
                    ]}
                  >
                    {paragraphText}
                  </Text>
                )}
              </View>
            </ScrollView>
            {selectedWordIndex !== null && (
              <View style={[styles.rsvpPrompt, { borderColor: settings.accentColor }]}>
                <TouchableOpacity
                  style={[styles.rsvpPromptButton, { backgroundColor: settings.accentColor }]}
                  onPress={() => handleViewModeChange('speed')}
                >
                  <Text style={styles.rsvpPromptButtonText}>Start RSVP here</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        
        {viewMode === 'page' && (
          <View style={styles.textViewContainer}>
            <ScrollView 
              style={styles.textView} 
              contentContainerStyle={styles.textViewContent}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.centeredTextView}>
                {currentChapter?.htmlContent ? (
                  <RenderHTML
                    contentWidth={800}
                    source={{ html: (() => {
                      // Extract HTML for current 5-6 paragraphs
                      const paragraphs = currentChapter.htmlContent.split(/<\/p>|<\/div>/).filter(p => p.trim());
                      // Find paragraph containing current word
                      const wordsBeforeChapter = wordsBeforeChapterMemo;
                      const currentWordInChapter = currentWordIndex - wordsBeforeChapter;
                      let wordCount = 0;
                      let startIndex = 0;
                      for (let i = 0; i < paragraphs.length; i++) {
                        const text = paragraphs[i].replace(/<[^>]*>/g, '');
                        const paraWordCount = text.split(/\s+/).filter(w => w.trim()).length;
                        if (wordCount + paraWordCount > currentWordInChapter) {
                          startIndex = i;
                          break;
                        }
                        wordCount += paraWordCount;
                      }
                      const endIndex = Math.min(paragraphs.length, startIndex + 6);
                      return paragraphs.slice(startIndex, endIndex).join('</p>') + '</p>';
                    })() }}
                    baseStyle={{
                      color: '#fff',
                      fontSize: effectiveFontSize,
                      fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
                      textAlign: 'left',
                      lineHeight: effectiveFontSize * 1.5,
                    }}
                    tagsStyles={{
                      p: { marginBottom: effectiveFontSize * 0.8, marginTop: effectiveFontSize * 0.4 },
                      div: { marginBottom: effectiveFontSize * 0.8 },
                      br: { height: effectiveFontSize * 0.5 },
                      strong: { fontWeight: 'bold' },
                      b: { fontWeight: 'bold' },
                      em: { fontStyle: 'italic' },
                      i: { fontStyle: 'italic' },
                      u: { textDecorationLine: 'underline' },
                      h1: { fontSize: effectiveFontSize * 1.5, fontWeight: 'bold', marginBottom: effectiveFontSize },
                      h2: { fontSize: effectiveFontSize * 1.3, fontWeight: 'bold', marginBottom: effectiveFontSize * 0.8 },
                      h3: { fontSize: effectiveFontSize * 1.1, fontWeight: 'bold', marginBottom: effectiveFontSize * 0.6 },
                    }}
                  />
                ) : (
                  <Text 
                    selectable
                    onPress={() => {
                      // When text is tapped, use current word index
                      setSelectedWordIndex(currentWordIndex);
                    }}
                    onLongPress={() => {
                      // Long press selects current word position
                      setSelectedWordIndex(currentWordIndex);
                    }}
                    style={[
                      styles.pageText, 
                      { 
                        fontSize: effectiveFontSize, 
                        fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
                        lineHeight: effectiveFontSize * 1.5,
                        color: settings.textColor,
                      }
                    ]}
                  >
                    {pageText}
                  </Text>
                )}
              </View>
            </ScrollView>
            {selectedWordIndex !== null && (
              <View style={[styles.rsvpPrompt, { borderColor: settings.accentColor }]}>
                <TouchableOpacity
                  style={[styles.rsvpPromptButton, { backgroundColor: settings.accentColor }]}
                  onPress={() => handleViewModeChange('speed')}
                >
                  <Text style={styles.rsvpPromptButtonText}>Start RSVP here</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Tooltip */}
      {tooltip && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{tooltip}</Text>
        </View>
      )}

      {/* Main controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => setShowChapterMenu(true)}
          onPressIn={() => setTooltip('Select chapter')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={styles.buttonText}>📖</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.button} 
          onPress={handlePreviousChapter}
          onPressIn={() => setTooltip('Previous chapter')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={styles.buttonText}>⏮</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => {
            if (viewMode === 'speed') {
              handlePrevious();
            } else if (viewMode === 'paragraph') {
              handlePreviousParagraph();
            } else if (viewMode === 'page') {
              handlePreviousPage();
            }
          }}
          onPressIn={() => {
            if (viewMode === 'speed') setTooltip('Previous word');
            else if (viewMode === 'paragraph') setTooltip('Previous paragraph');
            else if (viewMode === 'page') setTooltip('Previous page');
          }}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={styles.buttonText}>{'<'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, viewMode !== 'speed' && styles.buttonDisabled]} 
          onPress={() => {
            if (viewMode === 'speed') {
              handlePlayPause();
            } else {
              // Show tooltip when play button is clicked in paragraph/page view
              setTooltip('Speed reading controls available in Speed view');
              setTimeout(() => setTooltip(null), 2000);
            }
          }}
          onPressIn={() => {
            if (viewMode === 'speed') {
              setTooltip(isPlaying ? 'Pause' : 'Play');
            }
          }}
          onPressOut={() => {
            if (viewMode === 'speed') {
              setTooltip(null);
            }
          }}
        >
          <Text style={[styles.buttonText, viewMode !== 'speed' && styles.buttonTextDisabled]}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => {
            if (viewMode === 'speed') {
              handleNext();
            } else if (viewMode === 'paragraph') {
              handleNextParagraph();
            } else if (viewMode === 'page') {
              handleNextPage();
            }
          }}
          onPressIn={() => {
            if (viewMode === 'speed') setTooltip('Next word');
            else if (viewMode === 'paragraph') setTooltip('Next paragraph');
            else if (viewMode === 'page') setTooltip('Next page');
          }}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={styles.buttonText}>{'>'}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleNextChapter}
          onPressIn={() => setTooltip('Next chapter')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={styles.buttonText}>⏭</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleReset}
          onPressIn={() => setTooltip('Reset to beginning')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={styles.buttonText}>↻</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => setShowSettings(true)}
          onPressIn={() => setTooltip('Settings')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={styles.buttonText}>⚙</Text>
        </TouchableOpacity>
        
        {/* View Mode Buttons */}
        <TouchableOpacity
          style={[styles.button, styles.viewModeButton, viewMode === 'speed' && styles.viewModeButtonActive]}
          onPress={() => handleViewModeChange('speed')}
          onPressIn={() => setTooltip('Speed reading')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={[styles.buttonText, viewMode === 'speed' && { color: settings.accentColor }]}>S</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.viewModeButton, viewMode === 'paragraph' && styles.viewModeButtonActive]}
          onPress={() => handleViewModeChange('paragraph')}
          onPressIn={() => setTooltip('Paragraph view')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={[styles.buttonText, viewMode === 'paragraph' && { color: settings.accentColor }]}>P</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.viewModeButton, viewMode === 'page' && styles.viewModeButtonActive]}
          onPress={() => handleViewModeChange('page')}
          onPressIn={() => setTooltip('Page view')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={[styles.buttonText, viewMode === 'page' && { color: settings.accentColor }]}>Pg</Text>
        </TouchableOpacity>
      </View>

      {/* Speed controls with slider - disabled when not in speed view */}
      {viewMode === 'speed' && (
        <View style={styles.speedControls}>
        <TouchableOpacity 
          style={styles.speedButton} 
          onPress={() => handleSpeedChange(-25)}
          onPressIn={() => setTooltip('Decrease speed')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={styles.speedButtonText}>−</Text>
        </TouchableOpacity>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={50}
            maximumValue={1000}
            value={wordsPerMinute}
            onValueChange={handleSpeedSliderChange}
            minimumTrackTintColor={settings.accentColor}
            maximumTrackTintColor="#333"
            thumbTintColor={settings.accentColor}
            step={1}
          />
          <View style={styles.speedInfo}>
            <Text style={styles.speedText}>{wordsPerMinute} WPM</Text>
            <Text style={styles.timeEstimate}>Est: {estimatedTime}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.speedButton} 
          onPress={() => handleSpeedChange(25)}
          onPressIn={() => setTooltip('Increase speed')}
          onPressOut={() => setTooltip(null)}
        >
          <Text style={styles.speedButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Word Selection Modal */}
      <Modal
        visible={showWordSelection}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWordSelection(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Starting Word</Text>
            <Text style={styles.modalSubtitle}>
              Choose where to start speed reading from
            </Text>
            <View style={styles.wordSelectionContainer}>
              <Text style={styles.wordSelectionText}>
                Current position: Word {currentWordIndex + 1} of {allWords.length}
              </Text>
              <TouchableOpacity
                style={styles.wordSelectionButton}
                onPress={() => handleWordSelectionConfirm(currentWordIndex)}
              >
                <Text style={styles.wordSelectionButtonText}>Start from current position</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.wordSelectionButton}
                onPress={() => {
                  // Find start of current paragraph
                  let paraStart = wordsBeforeChapterMemo;
                  for (let i = currentWordIndex; i >= wordsBeforeChapterMemo; i--) {
                    const word = allWords[i];
                    if (word.match(/[.!?]$/)) {
                      paraStart = i + 1;
                      break;
                    }
                    if (i === wordsBeforeChapterMemo) paraStart = i;
                  }
                  handleWordSelectionConfirm(paraStart);
                }}
              >
                <Text style={styles.wordSelectionButtonText}>Start from paragraph beginning</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.wordSelectionButton}
                onPress={() => {
                  handleWordSelectionConfirm(wordsBeforeChapterMemo);
                }}
              >
                <Text style={styles.wordSelectionButtonText}>Start from chapter beginning</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#333' }]}
              onPress={() => setShowWordSelection(false)}
            >
              <Text style={styles.modalButtonTextWhite}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            
            <ScrollView style={styles.scrollView}>
              {/* Word Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Current Word Color</Text>
                <View style={styles.colorGrid}>
                  {TEXT_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color.value}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color.value },
                        settings.wordColor === color.value && styles.colorOptionSelected,
                      ]}
                      onPress={() => setSettings({ ...settings, wordColor: color.value })}
                    >
                      {settings.wordColor === color.value && (
                        <Text style={styles.colorCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Accent Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Highlighted Letter Color</Text>
                <View style={styles.colorGrid}>
                  {COMMON_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color.value}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color.value },
                        settings.accentColor === color.value && styles.colorOptionSelected,
                      ]}
                      onPress={() => {
                        setSettings({ ...settings, accentColor: color.value });
                        setCustomAccentColorInput('');
                      }}
                    >
                      {settings.accentColor === color.value && (
                        <Text style={styles.colorCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.customColorContainer}>
                  <Text style={styles.settingSubLabel}>Custom Color (Hex):</Text>
                  <TextInput
                    style={styles.colorInput}
                    value={customAccentColorInput}
                    onChangeText={(text) => {
                      setCustomAccentColorInput(text);
                      if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
                        setSettings({ ...settings, accentColor: text });
                      }
                    }}
                    placeholder="#00ff88"
                    placeholderTextColor="#666"
                    maxLength={7}
                  />
                </View>
              </View>

              {/* Background Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Background Color</Text>
                <View style={styles.colorGrid}>
                  {BACKGROUND_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color.value}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color.value },
                        settings.backgroundColor === color.value && styles.colorOptionSelected,
                      ]}
                      onPress={() => {
                        setSettings({ ...settings, backgroundColor: color.value });
                        setCustomBackgroundColorInput('');
                      }}
                    >
                      {settings.backgroundColor === color.value && (
                        <Text style={styles.colorCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.customColorContainer}>
                  <Text style={styles.settingSubLabel}>Custom Color (Hex):</Text>
                  <TextInput
                    style={styles.colorInput}
                    value={customBackgroundColorInput}
                    onChangeText={(text) => {
                      setCustomBackgroundColorInput(text);
                      if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
                        setSettings({ ...settings, backgroundColor: text });
                      }
                    }}
                    placeholder="#000000"
                    placeholderTextColor="#666"
                    maxLength={7}
                  />
                </View>
              </View>

              {/* Text Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Text Color (Paragraph/Page View)</Text>
                <View style={styles.colorGrid}>
                  {TEXT_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color.value}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color.value },
                        settings.textColor === color.value && styles.colorOptionSelected,
                      ]}
                      onPress={() => {
                        setSettings({ ...settings, textColor: color.value });
                        setCustomTextColorInput('');
                      }}
                    >
                      {settings.textColor === color.value && (
                        <Text style={styles.colorCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.customColorContainer}>
                  <Text style={styles.settingSubLabel}>Custom Color (Hex):</Text>
                  <TextInput
                    style={styles.colorInput}
                    value={customTextColorInput}
                    onChangeText={(text) => {
                      setCustomTextColorInput(text);
                      if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
                        setSettings({ ...settings, textColor: text });
                      }
                    }}
                    placeholder="#ffffff"
                    placeholderTextColor="#666"
                    maxLength={7}
                  />
                </View>
              </View>

              {/* Context Words Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Previous/Next Words Color</Text>
                <View style={styles.colorGrid}>
                  {COMMON_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color.value}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color.value },
                        settings.contextWordsColor === color.value && styles.colorOptionSelected,
                      ]}
                      onPress={() => {
                        setSettings({ ...settings, contextWordsColor: color.value });
                        setCustomContextWordsColorInput('');
                      }}
                    >
                      {settings.contextWordsColor === color.value && (
                        <Text style={styles.colorCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.customColorContainer}>
                  <Text style={styles.settingSubLabel}>Custom Color (Hex):</Text>
                  <TextInput
                    style={styles.colorInput}
                    value={customContextWordsColorInput}
                    onChangeText={(text) => {
                      setCustomContextWordsColorInput(text);
                      if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
                        setSettings({ ...settings, contextWordsColor: text });
                      }
                    }}
                    placeholder="#999999"
                    placeholderTextColor="#666"
                    maxLength={7}
                  />
                </View>
              </View>

              {/* Show Context Words Toggle */}
              <View style={styles.settingSection}>
                <View style={styles.toggleContainer}>
                  <Text style={styles.settingLabel}>Show Previous/Next Words</Text>
                  <Switch
                    value={settings.showContextWords}
                    onValueChange={(value) => setSettings({ ...settings, showContextWords: value })}
                    trackColor={{ false: '#333', true: settings.accentColor }}
                    thumbColor={settings.showContextWords ? '#fff' : '#999'}
                  />
                </View>
              </View>

              {/* Context Words Spacing */}
              {settings.showContextWords && (
                <View style={styles.settingSection}>
                  <Text style={styles.settingLabel}>Spacing: {settings.contextWordsSpacing}px</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={40}
                    value={settings.contextWordsSpacing}
                    onValueChange={(value) => setSettings({ ...settings, contextWordsSpacing: Math.round(value) })}
                    minimumTrackTintColor={settings.accentColor}
                    maximumTrackTintColor="#333"
                    thumbTintColor={settings.accentColor}
                    step={1}
                  />
                </View>
              )}

              {/* Font Family */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Font Family</Text>
                {FONT_FAMILIES.map((font) => (
                  <TouchableOpacity
                    key={font}
                    style={[
                      styles.fontOption,
                      settings.fontFamily === font && styles.fontOptionSelected,
                    ]}
                    onPress={() => setSettings({ ...settings, fontFamily: font })}
                  >
                    <Text style={styles.fontOptionText}>{font}</Text>
                    {settings.fontFamily === font && (
                      <Text style={styles.fontCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Font Size */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Font Size: {Math.round(settings.fontSize)}pt</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={24}
                  maximumValue={96}
                  value={settings.fontSize}
                  onValueChange={(value) => setSettings({ ...settings, fontSize: Math.round(value) })}
                  minimumTrackTintColor={settings.accentColor}
                  maximumTrackTintColor="#333"
                  thumbTintColor={settings.accentColor}
                  step={1}
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#333' }]}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.modalButtonTextWhite}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Chapter Menu Modal */}
      <Modal
        visible={showChapterMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChapterMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Chapter</Text>
            <FlatList
              data={chapters}
              keyExtractor={(item, index) => index.toString()}
              style={styles.chapterList}
              contentContainerStyle={styles.chapterListContent}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.chapterMenuItem,
                    index === currentChapterIndex && styles.chapterMenuItemSelected,
                  ]}
                  onPress={() => handleChapterSelect(index)}
                >
                  <Text style={styles.chapterMenuItemText}>
                    {formatChapterTitle(item.title)}
                  </Text>
                  {index === currentChapterIndex && (
                    <Text style={styles.chapterMenuCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#333' }]}
              onPress={() => setShowChapterMenu(false)}
            >
              <Text style={styles.modalButtonTextWhite}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  chapterNameContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  chapterName: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 5,
  },
  progressContainer: {
    position: 'absolute',
    top: 75,
    left: 0,
    right: 0,
    width: '100%',
    alignItems: 'center',
    zIndex: 1,
  },
  readerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  readerAreaSpeed: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  readerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 600,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  readerContentSpeed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 1000,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  contextWordsLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 0,
    maxWidth: 200,
    overflow: 'hidden',
  },
  contextWordsRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 0,
    maxWidth: 200,
    overflow: 'hidden',
  },
  contextWordsContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  contextWord: {
    fontWeight: '300',
  },
  currentWordContainer: {
    flex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    minWidth: 200,
  },
  word: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  accentLetter: {
    // Color set dynamically
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  speedButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  speedButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  sliderContainer: {
    flex: 1,
    alignItems: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  speedInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 5,
  },
  speedText: {
    color: '#fff',
    fontSize: 14,
  },
  timeEstimate: {
    color: '#999',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    gap: 4,
    flexWrap: 'nowrap',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: 5,
  },
  button: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
    flexShrink: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
  },
  tooltip: {
    position: 'absolute',
    bottom: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
    zIndex: 1000,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
  },
  progressSlider: {
    width: '100%',
    maxWidth: 600,
    height: 40,
    marginBottom: 10,
  },
  progressText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 5,
    marginBottom: 10,
    width: '100%',
    maxWidth: 600,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },
  settingSection: {
    marginBottom: 30,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
  },
  colorCheck: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  fontOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    marginBottom: 8,
  },
  fontOptionSelected: {
    backgroundColor: '#444',
  },
  fontOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  fontCheck: {
    color: '#00ff88',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalButton: {
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chapterList: {
    maxHeight: 400,
  },
  chapterListContent: {
    paddingBottom: 10,
  },
  chapterMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 8,
    marginBottom: 8,
  },
  chapterMenuItemSelected: {
    backgroundColor: '#444',
  },
  chapterMenuItemText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  chapterMenuCheck: {
    color: '#00ff88',
    fontSize: 20,
    fontWeight: 'bold',
  },
  viewModeButton: {
    minWidth: 35,
    maxWidth: 40,
  },
  viewModeButtonActive: {
    backgroundColor: '#555',
  },
  buttonDisabled: {
    backgroundColor: '#222',
    opacity: 0.5,
  },
  buttonTextDisabled: {
    color: '#666',
  },
  textViewContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    marginTop: 120, // Space for chapter name and progress bar
  },
  textView: {
    flex: 1,
    width: '100%',
  },
  textViewContent: {
    padding: 20,
    paddingTop: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  centeredTextView: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  paragraphText: {
    lineHeight: 32,
    textAlign: 'left',
  },
  pageText: {
    lineHeight: 32,
    textAlign: 'left',
  },
  customColorContainer: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingSubLabel: {
    fontSize: 14,
    color: '#ccc',
    marginRight: 10,
  },
  colorInput: {
    flex: 1,
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    borderRadius: 6,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#555',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordSelectionContainer: {
    marginVertical: 20,
  },
  wordSelectionText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  wordSelectionButton: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  wordSelectionButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  modalSubtitle: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  rsvpPrompt: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    zIndex: 1000,
    minWidth: 140,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  rsvpPromptButton: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
  },
  rsvpPromptButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalButtonTextWhite: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
