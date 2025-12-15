import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView, TextInput, Switch, Platform } from 'react-native';
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
  wordsPerMinute: number;
}

// Default color palettes (first 5 of each)
const DEFAULT_COMMON_COLORS = [
  { name: 'Green', value: '#00ff88' },
  { name: 'Yellow', value: '#ffeb3b' },
  { name: 'Cyan', value: '#00bcd4' },
  { name: 'Orange', value: '#ff9800' },
  { name: 'Pink', value: '#e91e63' },
];

const DEFAULT_BACKGROUND_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Dark Gray', value: '#1a1a1a' },
  { name: 'Gray', value: '#2a2a2a' },
  { name: 'Navy', value: '#0a0a1a' },
  { name: 'Dark Blue', value: '#0a1a2a' },
];

const DEFAULT_TEXT_COLORS = [
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
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [showWordSelection, setShowWordSelection] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerType, setColorPickerType] = useState<'accent' | 'word' | 'background' | 'text' | 'contextWords' | null>(null);
  const [colorPickerCurrentColor, setColorPickerCurrentColor] = useState('#000000');
  const [colorPickerRgb, setColorPickerRgb] = useState({ r: 0, g: 0, b: 0 });
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);

  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  // Convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number) => {
    return `#${[r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`.toUpperCase();
  };
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
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
    wordsPerMinute: Math.round(initialWordsPerMinute),
  });
  const [customAccentColorInput, setCustomAccentColorInput] = useState('');
  const [customWordColorInput, setCustomWordColorInput] = useState('');
  const [customBackgroundColorInput, setCustomBackgroundColorInput] = useState('');
  const [customTextColorInput, setCustomTextColorInput] = useState('');
  const [customContextWordsColorInput, setCustomContextWordsColorInput] = useState('');
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [recentColors, setRecentColors] = useState<{
    accent: string[];
    word: string[];
    background: string[];
    text: string[];
    contextWords: string[];
  }>({
    accent: [],
    word: [],
    background: [],
    text: [],
    contextWords: [],
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get display colors (recent + defaults, max 5)
  const getDisplayColors = (type: 'accent' | 'word' | 'background' | 'text' | 'contextWords'): Array<{ name: string; value: string }> => {
    const defaults: Array<{ name: string; value: string }> = 
      type === 'accent' ? DEFAULT_COMMON_COLORS :
      type === 'word' ? DEFAULT_TEXT_COLORS :
      type === 'background' ? DEFAULT_BACKGROUND_COLORS :
      type === 'text' ? DEFAULT_TEXT_COLORS :
      DEFAULT_COMMON_COLORS;
    
    const recent = recentColors[type].map((color: string) => ({ name: '', value: color }));
    const combined = [...recent, ...defaults];
    
    // Remove duplicates and limit to 5
    const unique = combined.filter((color, index, self) => 
      index === self.findIndex(c => c.value === color.value)
    ).slice(0, 5);
    
    return unique;
  };

  // Helper function to add color to recent colors (only if it's a new color)
  const addToRecentColors = (type: 'accent' | 'word' | 'background' | 'text' | 'contextWords', color: string) => {
    setRecentColors(prev => {
      const current = prev[type];
      // If color already exists, don't reorder - just return current state
      if (current.includes(color)) {
        return prev;
      }
      // Add new color to front and drop oldest if over limit
      const updated = [color, ...current].slice(0, 5); // Keep max 5
      return { ...prev, [type]: updated };
    });
  };

  // Handler to open color picker
  const handleOpenColorPicker = (type: 'accent' | 'word' | 'background' | 'text' | 'contextWords') => {
    const currentColor = 
      type === 'accent' ? settings.accentColor :
      type === 'word' ? settings.wordColor :
      type === 'background' ? settings.backgroundColor :
      type === 'text' ? settings.textColor :
      settings.contextWordsColor;
    
    setColorPickerCurrentColor(currentColor);
    setColorPickerRgb(hexToRgb(currentColor));
    setColorPickerType(type);
    setShowColorPicker(true);
  };

  // Handler for color picker selection
  const handleColorPickerSelect = () => {
    if (!colorPickerType) return;
    
    const hexColor = rgbToHex(colorPickerRgb.r, colorPickerRgb.g, colorPickerRgb.b);
    
    // Update settings based on type
    if (colorPickerType === 'accent') {
      setSettings({ ...settings, accentColor: hexColor });
      setCustomAccentColorInput(hexColor);
    } else if (colorPickerType === 'word') {
      setSettings({ ...settings, wordColor: hexColor });
      setCustomWordColorInput(hexColor);
    } else if (colorPickerType === 'background') {
      setSettings({ ...settings, backgroundColor: hexColor });
      setCustomBackgroundColorInput(hexColor);
    } else if (colorPickerType === 'text') {
      setSettings({ ...settings, textColor: hexColor });
      setCustomTextColorInput(hexColor);
    } else if (colorPickerType === 'contextWords') {
      setSettings({ ...settings, contextWordsColor: hexColor });
      setCustomContextWordsColorInput(hexColor);
    }
    
    addToRecentColors(colorPickerType, hexColor);
    setShowColorPicker(false);
  };

  // Update hex color when RGB changes
  useEffect(() => {
    if (showColorPicker) {
      const hex = rgbToHex(colorPickerRgb.r, colorPickerRgb.g, colorPickerRgb.b);
      setColorPickerCurrentColor(hex);
    }
  }, [colorPickerRgb, showColorPicker]);

  // Flatten all words from all chapters for continuous reading
  const allWords = chapters.flatMap(ch => ch.words);
  const currentChapter = chapters[currentChapterIndex];
  const currentWord = allWords[currentWordIndex] || '';

  // Load saved settings and recent colors on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem('rsvp_reader_settings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          setSettings((prevSettings) => ({
            ...prevSettings,
            ...parsedSettings,
            // Ensure wordsPerMinute is set, defaulting to initialWordsPerMinute if not in saved settings
            wordsPerMinute: parsedSettings.wordsPerMinute ?? prevSettings.wordsPerMinute,
          }));
        }
        
        const savedRecentColors = await AsyncStorage.getItem('rsvp_recent_colors');
        if (savedRecentColors) {
          const parsedColors = JSON.parse(savedRecentColors);
          setRecentColors(parsedColors);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    
    loadSettings();
  }, []);

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

  // Save settings whenever they change (but not during initial load)
  useEffect(() => {
    if (isLoadingSettings) return;
    
    const saveSettings = async () => {
      try {
        await AsyncStorage.setItem('rsvp_reader_settings', JSON.stringify(settings));
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    };
    
    saveSettings();
  }, [settings, isLoadingSettings]);

  // Save recent colors whenever they change
  useEffect(() => {
    if (isLoadingSettings) return;
    
    const saveRecentColors = async () => {
      try {
        await AsyncStorage.setItem('rsvp_recent_colors', JSON.stringify(recentColors));
      } catch (error) {
        console.error('Error saving recent colors:', error);
      }
    };
    
    saveRecentColors();
  }, [recentColors, isLoadingSettings]);

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
  const delayMs = (60 / settings.wordsPerMinute) * 1000;

  // Calculate swing variation based on word length
  // Adds +/- 15% variation, biased toward longer words (slower) and shorter words (faster)
  const calculateSwing = (word: string): number => {
    if (!word || word.length === 0) return 0;
    
    // Remove punctuation to get actual word length
    const cleanWord = word.replace(/[.,!?;:—–()[\]{}"'«‹»›]/g, '');
    const wordLength = cleanWord.length;
    
    // Normalize word length to 0-1 scale (assuming words range from 1-15 characters typically)
    // Cap at 15 for normalization, but allow longer words
    const normalizedLength = Math.min(wordLength / 15, 1);
    
    // Generate random value between -0.15 and +0.15
    const randomVariation = (Math.random() * 0.3) - 0.15; // Range: -0.15 to +0.15
    
    // Bias factor: shifts the random variation based on word length
    // Short words (normalizedLength ~ 0): bias toward -0.15 (faster)
    // Long words (normalizedLength ~ 1): bias toward +0.15 (slower)
    // Medium words (normalizedLength ~ 0.5): neutral bias
    const biasFactor = (normalizedLength - 0.5) * 0.2; // Range: -0.1 to +0.1
    
    // Combine random variation with bias
    // The bias shifts the center of the random distribution
    const swing = randomVariation + biasFactor;
    
    // Clamp to +/- 15% to ensure we stay within bounds
    return Math.max(-0.15, Math.min(0.15, swing));
  };

  // Calculate delay for current word based on punctuation
  // Punctuation pauses are ADDITIONAL to the base word delay
  const getWordDelay = (word: string, wordIndex: number): number => {
    if (!word || word.length === 0) return delayMs;
    
    // Check if word is hyphenated (contains hyphen)
    const isHyphenated = /-/.test(word);
    
    // Apply swing to base delay (only affects the base word timing, not punctuation pauses)
    const swingFactor = calculateSwing(word);
    let baseDelayWithSwing = delayMs * (1 + swingFactor);
    
    // For hyphenated words, add the pause of two words combined (double the base delay)
    if (isHyphenated) {
      baseDelayWithSwing = delayMs * 2 * (1 + swingFactor);
    }
    
    let totalDelay = baseDelayWithSwing; // Start with base word delay + swing (and double for hyphenated)
    
    // Check for opening quotation marks at the start of the word
    const startsWithQuote = /^["'«‹]/.test(word);
    
    // Check if this is the end of a paragraph
    // A paragraph ends if we're at the end of a chapter
    let isEndOfParagraph = false;
    if (wordIndex >= 0) {
      let wordCount = 0;
      for (let i = 0; i < chapters.length; i++) {
        const chapterEnd = wordCount + chapters[i].words.length;
        if (wordIndex < chapterEnd) {
          // Check if this is the last word in this chapter
          isEndOfParagraph = (wordIndex === chapterEnd - 1);
          break;
        }
        wordCount = chapterEnd;
      }
    }
    
    // Check for comma
    if (/,$/.test(word)) {
      // Comma pause: additional pause equal to 75% of word pause (delayMs * 0.75)
      totalDelay += delayMs * 0.75;
    }
    // Check for opening quotation marks
    else if (startsWithQuote) {
      // Opening quote pause: additional pause equal to 75% of word pause (delayMs * 0.75)
      totalDelay += delayMs * 0.75;
    }
    // Check for end-of-sentence punctuation: . ! ? ; : — –
    else if (/[.!?;:]$/.test(word) || word.endsWith('—') || word.endsWith('–')) {
      // End of sentence pause: additional pause equal to 75% of word pause (delayMs * 0.75) - same as comma
      totalDelay += delayMs * 0.75;
      
      // If this is also the end of a paragraph, add paragraph pause
      if (isEndOfParagraph) {
        // End of paragraph: additional pause equal to 150% of word pause (delayMs * 1.5)
        totalDelay += delayMs * 1.5;
      }
    }
    // Check for other grammatical markings: closing quotes, parentheses, brackets, etc.
    else if (/[)\]}"'»›]$/.test(word)) {
      // Other grammatical markings: additional pause equal to 37.5% of word pause (delayMs * 0.375)
      totalDelay += delayMs * 0.375;
    }
    
    // Also check if this word is at the end of a paragraph (even without sentence-ending punctuation)
    if (isEndOfParagraph && !/[.!?;:]$/.test(word) && !word.endsWith('—') && !word.endsWith('–')) {
      // End of paragraph: additional pause equal to 150% of word pause (delayMs * 1.5)
      totalDelay += delayMs * 1.5;
    }
    
    return totalDelay;
  };

  // Calculate estimated time to completion
  const remainingWords = allWords.length - currentWordIndex - 1;
  const estimatedMinutes = remainingWords > 0 ? remainingWords / settings.wordsPerMinute : 0;
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
    if (!isPlaying || currentWordIndex >= allWords.length) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Use setTimeout with dynamic delays based on punctuation
    const currentWord = allWords[currentWordIndex] || '';
    const wordDelay = getWordDelay(currentWord, currentWordIndex);
    
    const timeoutId = setTimeout(() => {
      setCurrentWordIndex((prev) => {
        if (prev >= allWords.length - 1) {
          setIsPlaying(false);
          onComplete?.();
          return prev;
        }
        return prev + 1;
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
  }, [isPlaying, currentWordIndex, allWords.length, delayMs, onComplete, settings.wordsPerMinute]);

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
    setSettings((prev) => ({
      ...prev,
      wordsPerMinute: Math.max(50, Math.min(1000, Math.round(prev.wordsPerMinute + delta)))
    }));
  };

  const handleSpeedSliderChange = (value: number) => {
    setSettings((prev) => ({
      ...prev,
      wordsPerMinute: Math.round(value)
    }));
  };

  const handlePreviousChapter = () => {
    if (currentChapterIndex > 0) {
      // Stop playback first
      setIsPlaying(false);
      // Clear any pending timeouts
      if (intervalRef.current) {
        clearTimeout(intervalRef.current as any);
        intervalRef.current = null;
      }
      // Calculate word index for start of previous chapter
      let wordCount = 0;
      for (let i = 0; i < currentChapterIndex - 1; i++) {
        wordCount += chapters[i].words.length;
      }
      setCurrentWordIndex(wordCount);
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      // Stop playback first
      setIsPlaying(false);
      // Clear any pending timeouts
      if (intervalRef.current) {
        clearTimeout(intervalRef.current as any);
        intervalRef.current = null;
      }
      // Calculate word index for start of next chapter
      let wordCount = 0;
      for (let i = 0; i <= currentChapterIndex; i++) {
        wordCount += chapters[i].words.length;
      }
      setCurrentWordIndex(wordCount);
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
            value={settings.wordsPerMinute}
            onValueChange={handleSpeedSliderChange}
            minimumTrackTintColor={settings.accentColor}
            maximumTrackTintColor="#333"
            thumbTintColor={settings.accentColor}
            step={1}
          />
          <View style={styles.speedInfo}>
            <Text style={styles.speedText}>{settings.wordsPerMinute} WPM</Text>
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
                  {getDisplayColors('word').map((color) => (
                    <TouchableOpacity
                      key={color.value}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color.value },
                        settings.wordColor === color.value && styles.colorOptionSelected,
                      ]}
                      onPress={() => {
                        setSettings({ ...settings, wordColor: color.value });
                        setCustomWordColorInput('');
                        addToRecentColors('word', color.value);
                      }}
                    >
                      {settings.wordColor === color.value && (
                        <Text style={styles.colorCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.customColorContainer}>
                  <Text style={styles.settingSubLabel}>Custom Color (Hex):</Text>
                  <TextInput
                    style={styles.colorInput}
                    value={customWordColorInput}
                    onChangeText={(text) => {
                      setCustomWordColorInput(text);
                      if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
                        setSettings({ ...settings, wordColor: text });
                        addToRecentColors('word', text);
                      }
                    }}
                    placeholder="#ffffff"
                    placeholderTextColor="#666"
                    maxLength={7}
                  />
                  <TouchableOpacity
                    style={styles.colorPickerButton}
                    onPress={() => handleOpenColorPicker('word')}
                  >
                    <Text style={styles.colorPickerButtonText}>🎨</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Accent Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Highlighted Letter Color</Text>
                <View style={styles.colorGrid}>
                  {getDisplayColors('accent').map((color) => (
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
                        addToRecentColors('accent', color.value);
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
                        addToRecentColors('accent', text);
                      }
                    }}
                    placeholder="#00ff88"
                    placeholderTextColor="#666"
                    maxLength={7}
                  />
                  <TouchableOpacity
                    style={styles.colorPickerButton}
                    onPress={() => handleOpenColorPicker('accent')}
                  >
                    <Text style={styles.colorPickerButtonText}>🎨</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Background Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Background Color</Text>
                <View style={styles.colorGrid}>
                  {getDisplayColors('background').map((color) => (
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
                        addToRecentColors('background', color.value);
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
                        addToRecentColors('background', text);
                      }
                    }}
                    placeholder="#000000"
                    placeholderTextColor="#666"
                    maxLength={7}
                  />
                  <TouchableOpacity
                    style={styles.colorPickerButton}
                    onPress={() => handleOpenColorPicker('background')}
                  >
                    <Text style={styles.colorPickerButtonText}>🎨</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Text Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Text Color (Paragraph/Page View)</Text>
                <View style={styles.colorGrid}>
                  {getDisplayColors('text').map((color) => (
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
                        addToRecentColors('text', color.value);
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
                        addToRecentColors('text', text);
                      }
                    }}
                    placeholder="#ffffff"
                    placeholderTextColor="#666"
                    maxLength={7}
                  />
                  <TouchableOpacity
                    style={styles.colorPickerButton}
                    onPress={() => handleOpenColorPicker('text')}
                  >
                    <Text style={styles.colorPickerButtonText}>🎨</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Context Words Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Previous/Next Words Color</Text>
                <View style={styles.colorGrid}>
                  {getDisplayColors('contextWords').map((color) => (
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
                        addToRecentColors('contextWords', color.value);
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
                        addToRecentColors('contextWords', text);
                      }
                    }}
                    placeholder="#999999"
                    placeholderTextColor="#666"
                    maxLength={7}
                  />
                  <TouchableOpacity
                    style={styles.colorPickerButton}
                    onPress={() => handleOpenColorPicker('contextWords')}
                  >
                    <Text style={styles.colorPickerButtonText}>🎨</Text>
                  </TouchableOpacity>
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

              {/* Font Family */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Font Family</Text>
                <TouchableOpacity
                  style={styles.fontPickerButton}
                  onPress={() => setShowFontPicker(true)}
                >
                  <Text style={styles.fontPickerButtonText}>{settings.fontFamily}</Text>
                  <Text style={styles.fontPickerButtonArrow}>▼</Text>
                </TouchableOpacity>
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

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowColorPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.colorPickerModalContent}
          >
            <Text style={styles.modalTitle}>Select Color</Text>
            
            {/* Color Preview */}
            <View style={[styles.colorPreview, { backgroundColor: colorPickerCurrentColor }]}>
              <Text style={styles.colorPreviewText}>{colorPickerCurrentColor}</Text>
            </View>
            
            {/* RGB Sliders */}
            <View style={styles.colorPickerSliders}>
              <View style={styles.colorSliderRow}>
                <Text style={styles.colorSliderLabel}>R: {Math.round(colorPickerRgb.r)}</Text>
                <Slider
                  style={styles.colorSlider}
                  minimumValue={0}
                  maximumValue={255}
                  value={colorPickerRgb.r}
                  onValueChange={(value) => setColorPickerRgb({ ...colorPickerRgb, r: value })}
                  minimumTrackTintColor="#f44336"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#f44336"
                  step={1}
                />
              </View>
              <View style={styles.colorSliderRow}>
                <Text style={styles.colorSliderLabel}>G: {Math.round(colorPickerRgb.g)}</Text>
                <Slider
                  style={styles.colorSlider}
                  minimumValue={0}
                  maximumValue={255}
                  value={colorPickerRgb.g}
                  onValueChange={(value) => setColorPickerRgb({ ...colorPickerRgb, g: value })}
                  minimumTrackTintColor="#4caf50"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#4caf50"
                  step={1}
                />
              </View>
              <View style={styles.colorSliderRow}>
                <Text style={styles.colorSliderLabel}>B: {Math.round(colorPickerRgb.b)}</Text>
                <Slider
                  style={styles.colorSlider}
                  minimumValue={0}
                  maximumValue={255}
                  value={colorPickerRgb.b}
                  onValueChange={(value) => setColorPickerRgb({ ...colorPickerRgb, b: value })}
                  minimumTrackTintColor="#2196f3"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#2196f3"
                  step={1}
                />
              </View>
            </View>
            
            {/* Quick Color Presets */}
            <View style={styles.quickColorsContainer}>
              <Text style={styles.quickColorsLabel}>Quick Colors:</Text>
              <View style={styles.quickColorsGrid}>
                {['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A'].map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.quickColorOption, { backgroundColor: color }]}
                    onPress={() => {
                      setColorPickerRgb(hexToRgb(color));
                    }}
                  />
                ))}
              </View>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.colorPickerActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#333', flex: 1, marginRight: 10 }]}
                onPress={() => setShowColorPicker(false)}
              >
                <Text style={styles.modalButtonTextWhite}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#00ff88', flex: 1 }]}
                onPress={handleColorPickerSelect}
              >
                <Text style={styles.modalButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Font Picker Modal */}
      <Modal
        visible={showFontPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFontPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Font Family</Text>
            <FlatList
              data={FONT_FAMILIES}
              keyExtractor={(item) => item}
              style={styles.fontList}
              contentContainerStyle={styles.fontListContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.fontMenuItem,
                    settings.fontFamily === item && styles.fontMenuItemSelected,
                  ]}
                  onPress={() => {
                    setSettings({ ...settings, fontFamily: item });
                    setShowFontPicker(false);
                  }}
                >
                  <Text style={styles.fontMenuItemText}>{item}</Text>
                  {settings.fontFamily === item && (
                    <Text style={styles.fontMenuCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#333' }]}
              onPress={() => setShowFontPicker(false)}
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
    marginBottom: 25,
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
    width: 33,
    height: 33,
    borderRadius: 8,
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
    fontSize: 16,
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
    marginTop: 165, // Space for chapter name (40) + progress bar (~100) + 25px margin
    paddingBottom: 20, // Extra padding at bottom for scrolling
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
  colorPickerButton: {
    backgroundColor: '#444',
    padding: 10,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickerButtonText: {
    fontSize: 20,
  },
  colorPickerModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  colorPreview: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#555',
  },
  colorPreviewText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  colorPickerSliders: {
    width: '100%',
    marginBottom: 20,
  },
  colorSliderRow: {
    marginBottom: 15,
  },
  colorSliderLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
    fontWeight: '600',
  },
  colorSlider: {
    width: '100%',
    height: 40,
  },
  quickColorsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  quickColorsLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
    fontWeight: '600',
  },
  quickColorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickColorOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#555',
  },
  colorPickerActions: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 10,
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
  fontPickerButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  fontPickerButtonText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  fontPickerButtonArrow: {
    color: '#999',
    fontSize: 12,
    marginLeft: 10,
  },
  fontList: {
    maxHeight: 400,
  },
  fontListContent: {
    paddingBottom: 10,
  },
  fontMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 8,
    marginBottom: 8,
  },
  fontMenuItemSelected: {
    backgroundColor: '#444',
  },
  fontMenuItemText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  fontMenuCheck: {
    color: '#00ff88',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
