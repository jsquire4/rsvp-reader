import React, { useState, useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { RSVPReaderProps, ViewMode, ColorType } from './types';
import { useSettings } from './hooks/useSettings';
import { useProgress } from './hooks/useProgress';
import { useColorPicker } from './hooks/useColorPicker';
import { useWordProcessing } from './hooks/useWordProcessing';
import { rgbToHex } from './utils/colorUtils';
import {
  findParagraphBoundaries,
  getParagraphAtIndex,
  calculateParagraphWordIndices,
  extractParagraphs,
} from './utils/paragraphUtils';
import { ProgressBar } from './components/ProgressBar';
import { SpeedControls } from './components/SpeedControls';
import { SettingsModal } from './components/SettingsModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { FontPickerModal } from './components/FontPickerModal';
import { ChapterMenuModal } from './components/ChapterMenuModal';
import { WordSelectionModal } from './components/WordSelectionModal';
import { ChapterHeader } from './components/ChapterHeader';
import { ReaderViewport } from './components/ReaderViewport';
import { NavigationControls } from './components/NavigationControls';
import { styles } from './styles';

export default function RSVPReader({ 
  chapters, 
  initialWordsPerMinute = 250,
  onComplete,
  bookUri 
}: RSVPReaderProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('speed');
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [showWordSelection, setShowWordSelection] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; position: number } | null>(null);
  const [customAccentColorInput, setCustomAccentColorInput] = useState('');
  const [customWordColorInput, setCustomWordColorInput] = useState('');
  const [customBackgroundColorInput, setCustomBackgroundColorInput] = useState('');
  const [customTextColorInput, setCustomTextColorInput] = useState('');
  const [customContextWordsColorInput, setCustomContextWordsColorInput] = useState('');

  // Custom hooks
  const { settings, setSettings, getDisplayColors, addToRecentColors } = useSettings(initialWordsPerMinute);
  const colorPicker = useColorPicker(settings);
  
  // wordProcessing is the single source of truth for currentWordIndex
  // It derives currentChapterIndex internally from currentWordIndex
  const wordProcessing = useWordProcessing(chapters, settings, onComplete);
  
  // useProgress only handles persistence, derives chapterIndex from currentWordIndex
  const { currentChapterIndex, isLoadingProgress } = useProgress(
    chapters,
    bookUri,
    wordProcessing.currentWordIndex,
    React.useCallback((wordIndex: number) => {
      // Initial load callback: set the word index (chapterIndex is derived automatically)
      wordProcessing.setCurrentWordIndex(wordIndex);
    }, [wordProcessing])
  );

  // Use wordProcessing as single source of truth
  const allWords = wordProcessing.allWords;
  const currentWordIndex = wordProcessing.currentWordIndex;
  const currentChapter = chapters[wordProcessing.currentChapterIndex];
  const wordsBeforeChapterMemo = wordProcessing.wordsBeforeChapterMemo;
  const paragraphBoundaries = wordProcessing.paragraphBoundaries;

  // REAL-TIME SPEED MONITOR
  // Tracks actual delays from last 100 words to calculate true reading speed
  // Accounts for:
  // - Actual punctuation density in THIS text (commas, periods, paragraphs)
  // - Hyphenated word frequency
  // - Multi-word display delays
  // - Swing variation
  // Falls back to estimated 0.82x multiplier when not enough data yet (first 10 words)
  const estimatedEffectiveWPM = Math.round(settings.wordsPerMinute * 0.82);
  const effectiveWPM = wordProcessing.measuredWPM > 0 ? wordProcessing.measuredWPM : estimatedEffectiveWPM;

  // Calculate estimated time to completion using effective WPM
  const remainingWords = allWords.length - currentWordIndex - 1;
  const estimatedMinutes = remainingWords > 0 ? remainingWords / effectiveWPM : 0;
  const estimatedTime = estimatedMinutes < 1
    ? `${Math.round(estimatedMinutes * 60)}s`
    : estimatedMinutes < 60
    ? `${Math.round(estimatedMinutes)}m`
    : `${Math.floor(estimatedMinutes / 60)}h ${Math.round(estimatedMinutes % 60)}m`;

  // Memoize paragraph text
  const paragraphText = useMemo(() => {
    return allWords.slice(paragraphBoundaries.paraStart, paragraphBoundaries.paraEnd).join(' ');
  }, [allWords, paragraphBoundaries]);

  // Memoize paragraph HTML
  const paragraphHTML = useMemo(() => {
    if (!currentChapter?.htmlContent) return null;
    
    const { paraStart, paraEnd } = paragraphBoundaries;
    const paraStartInChapter = paraStart - wordsBeforeChapterMemo;
    const paraEndInChapter = paraEnd - wordsBeforeChapterMemo;
    
    const html = currentChapter.htmlContent;
    const paraMatches = html.match(/<(p|div)[^>]*>[\s\S]*?<\/(p|div)>/gi);
    if (!paraMatches || paraMatches.length === 0) return null;
    
    let wordCount = 0;
    let targetPara = paraMatches[0];
    
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

  // Memoize page text
  const pageText = useMemo(() => {
    if (currentChapter.rawText) {
      const paragraphs = currentChapter.rawText.split(/\n\n+/).filter(p => p.trim());
      const currentWordInChapter = currentWordIndex - wordsBeforeChapterMemo;
      
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
      
      const startIndex = Math.max(0, currentParaIndex);
      const endIndex = Math.min(paragraphs.length, startIndex + 6);
      return paragraphs.slice(startIndex, endIndex).join('\n\n');
    }
    return currentChapter.words.join(' ');
  }, [currentChapter, currentWordIndex, wordsBeforeChapterMemo]);

  // Memoize effective font size
  const effectiveFontSize = useMemo(() => {
    if (viewMode === 'paragraph' || viewMode === 'page') {
      return Math.max(16, settings.fontSize * 0.6);
    }
    return settings.fontSize;
  }, [viewMode, settings.fontSize]);

  // Navigation handlers
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
    if (wordProcessing.currentChapterIndex > 0) {
      wordProcessing.stopPlayback();
      
      const newChapterIndex = wordProcessing.currentChapterIndex - 1;
      let wordCount = 0;
      for (let i = 0; i < newChapterIndex; i++) {
        wordCount += chapters[i].words.length;
      }
      
      // wordProcessing is the single source of truth
      wordProcessing.setCurrentWordIndex(wordCount);
    }
  };

  const handleNextChapter = useCallback(() => {
    const nextChapterIndex = wordProcessing.currentChapterIndex + 1;
    if (nextChapterIndex >= chapters.length) {
      return; // Already at last chapter
    }
    
    // Stop playback first
    wordProcessing.stopPlayback();
    
    // Calculate word index for the start of the next chapter
    let wordCount = 0;
    for (let i = 0; i < nextChapterIndex; i++) {
      wordCount += chapters[i].words.length;
    }
    
    // Ensure wordCount is within bounds
    const maxWords = allWords.length;
    if (wordCount >= maxWords) {
      return; // Invalid calculation
    }
    
    // wordProcessing is the single source of truth
    wordProcessing.setCurrentWordIndex(wordCount);
  }, [chapters, allWords.length, wordProcessing]);

  const handleChapterSelect = (chapterIndex: number) => {
    wordProcessing.stopPlayback();
    
    let wordCount = 0;
    for (let i = 0; i < chapterIndex; i++) {
      wordCount += chapters[i].words.length;
    }
    
    // wordProcessing is the single source of truth
    wordProcessing.setCurrentWordIndex(wordCount);
    setShowChapterMenu(false);
  };

  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    if (newMode === 'speed' && viewMode !== 'speed') {
      if (selectedWordIndex !== null) {
        wordProcessing.setCurrentWordIndex(selectedWordIndex);
        setSelectedWordIndex(null);
        setViewMode('speed');
        wordProcessing.stopPlayback();
      } else {
        setShowWordSelection(true);
      }
    } else {
      setViewMode(newMode);
      wordProcessing.stopPlayback();
      if (newMode === 'speed') {
        setSelectedWordIndex(null);
      }
    }
  }, [viewMode, selectedWordIndex]);

  const handleWordSelectionConfirm = (wordIndex: number) => {
    wordProcessing.setCurrentWordIndex(wordIndex);
    setViewMode('speed');
    setShowWordSelection(false);
    wordProcessing.stopPlayback();
    setSelectedWordIndex(null);
  };

  // Helper function to find actual paragraph boundaries based on line breaks or HTML tags
  const getParagraphBoundaries = useCallback(() => {
    return findParagraphBoundaries(
      currentChapter,
      currentWordIndex,
      wordsBeforeChapterMemo,
      allWords
    );
  }, [currentChapter, currentWordIndex, wordsBeforeChapterMemo, allWords]);

  // TODO: See handleNextParagraph for notes on paragraph navigation behavior across different EPUB formats
  const handlePreviousParagraph = useCallback(() => {
    const boundaries = getParagraphBoundaries();
    const { currentParaIndex } = boundaries;

    if (currentParaIndex === 0) {
      // At first paragraph of chapter - move to previous chapter (lands at chapter start)
      if (wordProcessing.currentChapterIndex > 0) {
        wordProcessing.stopPlayback();
        const newChapterIndex = wordProcessing.currentChapterIndex - 1;
        let wordCount = 0;
        for (let i = 0; i < newChapterIndex; i++) {
          wordCount += chapters[i].words.length;
        }
        wordProcessing.setCurrentWordIndex(wordCount);
      }
      return;
    }

    // Find the start of the previous paragraph
    const prevParaIndex = currentParaIndex - 1;
    const chapterStart = wordsBeforeChapterMemo;

    // Extract paragraphs using utility (handles both rawText and htmlContent)
    const paragraphs = extractParagraphs(currentChapter);

    if (paragraphs.length > 0) {
      const { start } = calculateParagraphWordIndices(paragraphs, prevParaIndex, chapterStart);
      wordProcessing.setCurrentWordIndex(start);
    }
  }, [getParagraphBoundaries, currentChapter, wordsBeforeChapterMemo, chapters]);

  // TODO: PARAGRAPH NAVIGATION BEHAVIOR - NEEDS REFINEMENT FOR DIFFERENT EPUB FORMATS
  //
  // Current implementation is optimized for EPUBs with large paragraph blocks (like "Of Mice and Men")
  // where chapters typically have only 1-2 large <div> or <p> blocks instead of many small paragraphs.
  //
  // CURRENT BEHAVIOR:
  // - Within chapter: advances from one paragraph to the next
  // - At last paragraph: auto-advances to next chapter and lands at paragraph 1 (skips paragraph 0)
  //   This skipping behavior prevents having to click twice per chapter in large-block EPUBs
  //
  // KNOWN LIMITATIONS / NEEDS TESTING:
  // 1. EPUBs with many small paragraphs (novels with normal formatting)
  //    - Current behavior might skip too much content
  //    - Should landing at paragraph 0 be the default, with skipping only for large blocks?
  //
  // 2. Different EPUB structures:
  //    - Some use <p> tags (good semantic paragraphs)
  //    - Some use <div> blocks (often very large, few per chapter)
  //    - Some mix both or use other elements
  //    - Current paragraph detection (utils/paragraphUtils.ts) tries both rawText (\n\n splits) and HTML
  //
  // 3. Edge cases to test:
  //    - EPUBs with single-paragraph chapters
  //    - EPUBs with 50+ small paragraphs per chapter
  //    - EPUBs with no clear paragraph structure
  //    - Poetry, technical books, special formatting
  //
  // POTENTIAL IMPROVEMENTS:
  // - Detect paragraph size/count and adjust navigation behavior dynamically
  // - Add user preference for paragraph navigation style (skip first para vs always land at chapter start)
  // - Consider "smart" navigation that detects content density
  // - Test with diverse EPUB library and adjust heuristics
  //
  // See also: handlePreviousParagraph, handleNextPage, handlePreviousPage
  const handleNextParagraph = useCallback(() => {
    const boundaries = getParagraphBoundaries();
    const { currentParaIndex, totalParagraphs, paraEnd } = boundaries;

    if (currentParaIndex >= totalParagraphs - 1) {
      // At last paragraph of chapter - move to next chapter
      const nextChapterIndex = wordProcessing.currentChapterIndex + 1;
      if (nextChapterIndex < chapters.length) {
        wordProcessing.stopPlayback();

        // Calculate word index for start of next chapter
        let wordCount = 0;
        for (let i = 0; i < nextChapterIndex; i++) {
          wordCount += chapters[i].words.length;
        }

        // BEHAVIOR NOTE: Skip to paragraph 1 instead of paragraph 0 for smoother navigation
        // This works well for EPUBs with large blocks, but may skip content in EPUBs with many small paragraphs
        const nextChapter = chapters[nextChapterIndex];
        const nextChapterParagraphs = extractParagraphs(nextChapter);

        if (nextChapterParagraphs.length > 1) {
          // Move to start of paragraph 1 (second paragraph)
          const { start } = calculateParagraphWordIndices(nextChapterParagraphs, 1, wordCount);
          wordProcessing.setCurrentWordIndex(start);
        } else {
          // Only one paragraph, just go to chapter start
          wordProcessing.setCurrentWordIndex(wordCount);
        }
      }
      return;
    }

    // Move to start of next paragraph (which is the end of current paragraph)
    wordProcessing.setCurrentWordIndex(paraEnd);
  }, [getParagraphBoundaries, chapters, currentWordIndex]);

  const handlePreviousPage = useCallback(() => {
    const paragraphs = extractParagraphs(currentChapter);
    if (paragraphs.length === 0) return;

    const currentWordInChapter = currentWordIndex - wordsBeforeChapterMemo;

    // Find current paragraph index using utility
    const { paraIndex: currentParaIndex } = getParagraphAtIndex(paragraphs, currentWordInChapter);

    // Move back 6 paragraphs (or to start of chapter)
    const targetParaIndex = Math.max(0, currentParaIndex - 6);

    // Calculate word index for start of target paragraph using utility
    const { start } = calculateParagraphWordIndices(paragraphs, targetParaIndex, wordsBeforeChapterMemo);

    wordProcessing.setCurrentWordIndex(start);
  }, [currentChapter, currentWordIndex, wordsBeforeChapterMemo]);

  const handleNextPage = useCallback(() => {
    const paragraphs = extractParagraphs(currentChapter);
    if (paragraphs.length === 0) return;

    const currentWordInChapter = currentWordIndex - wordsBeforeChapterMemo;

    // Find current paragraph index using utility
    const { paraIndex: currentParaIndex } = getParagraphAtIndex(paragraphs, currentWordInChapter);

    // Move forward 6 paragraphs (or to end of chapter)
    const targetParaIndex = Math.min(paragraphs.length - 1, currentParaIndex + 6);

    // Calculate word index for start of target paragraph using utility
    const { start } = calculateParagraphWordIndices(paragraphs, targetParaIndex, wordsBeforeChapterMemo);

    const chapterEnd = wordsBeforeChapterMemo + currentChapter.words.length;

    if (start < chapterEnd) {
      wordProcessing.setCurrentWordIndex(start);
    }
  }, [currentChapter, currentWordIndex, wordsBeforeChapterMemo]);

  // Color picker handlers
  const handleColorPickerSelect = () => {
    if (!colorPicker.colorPickerType) return;
    
    const hexColor = rgbToHex(colorPicker.colorPickerRgb.r, colorPicker.colorPickerRgb.g, colorPicker.colorPickerRgb.b);
    
    if (colorPicker.colorPickerType === 'accent') {
      setSettings({ ...settings, accentColor: hexColor });
      setCustomAccentColorInput(hexColor);
    } else if (colorPicker.colorPickerType === 'word') {
      setSettings({ ...settings, wordColor: hexColor });
      setCustomWordColorInput(hexColor);
    } else if (colorPicker.colorPickerType === 'background') {
      setSettings({ ...settings, backgroundColor: hexColor });
      setCustomBackgroundColorInput(hexColor);
    } else if (colorPicker.colorPickerType === 'text') {
      setSettings({ ...settings, textColor: hexColor });
      setCustomTextColorInput(hexColor);
    } else if (colorPicker.colorPickerType === 'contextWords') {
      setSettings({ ...settings, contextWordsColor: hexColor });
      setCustomContextWordsColorInput(hexColor);
    }
    
    addToRecentColors(colorPicker.colorPickerType, hexColor);
    colorPicker.setShowColorPicker(false);
  };

  const handleCustomColorInputChange = (type: ColorType, value: string) => {
    if (type === 'accent') setCustomAccentColorInput(value);
    else if (type === 'word') setCustomWordColorInput(value);
    else if (type === 'background') setCustomBackgroundColorInput(value);
    else if (type === 'text') setCustomTextColorInput(value);
    else if (type === 'contextWords') setCustomContextWordsColorInput(value);
  };

  // Calculate current word index within chapter
  const currentWordInChapter = currentWordIndex - wordsBeforeChapterMemo + 1;
  const totalWordsInChapter = currentChapter?.words.length || 0;
  const bookRemainingPercent = allWords.length > 0 
    ? Math.round(((allWords.length - currentWordIndex - 1) / allWords.length) * 100)
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Chapter name at top */}
      <ChapterHeader chapter={currentChapter} />

      {/* Progress bar */}
      <ProgressBar
        currentWordIndex={currentWordIndex}
        totalWords={allWords.length}
        currentWordInChapter={currentWordInChapter}
        totalWordsInChapter={totalWordsInChapter}
        bookRemainingPercent={bookRemainingPercent}
        settings={settings}
        onValueChange={(value) => {
          wordProcessing.setCurrentWordIndex(Math.round(value));
          wordProcessing.stopPlayback();
        }}
      />

      {/* Reader area - different views */}
      <ReaderViewport
        viewMode={viewMode}
        allWords={allWords}
        currentWordIndex={currentWordIndex}
        settings={settings}
        currentChapter={currentChapter}
        paragraphText={paragraphText}
        paragraphHTML={paragraphHTML}
        pageText={pageText}
        effectiveFontSize={effectiveFontSize}
        selectedWordIndex={selectedWordIndex}
        wordsBeforeChapterMemo={wordsBeforeChapterMemo}
        onWordSelect={setSelectedWordIndex}
        onViewModeChange={handleViewModeChange}
      />

      {/* Tooltip */}
      {tooltip && (
        <View style={[styles.tooltip, { left: tooltip.position }]}>
          <Text style={styles.tooltipText}>{tooltip.text}</Text>
        </View>
      )}

      {/* Main controls */}
      <NavigationControls
        viewMode={viewMode}
        settings={settings}
        isPlaying={wordProcessing.isPlaying}
        onChapterMenuOpen={() => setShowChapterMenu(true)}
        onPreviousChapter={handlePreviousChapter}
        onPrevious={() => {
          if (viewMode === 'speed') {
            wordProcessing.handlePrevious();
          } else if (viewMode === 'paragraph') {
            handlePreviousParagraph();
          } else if (viewMode === 'page') {
            handlePreviousPage();
          }
        }}
        onPlayPause={wordProcessing.handlePlayPause}
        onNext={() => {
          if (viewMode === 'speed') {
            wordProcessing.handleNext();
          } else if (viewMode === 'paragraph') {
            handleNextParagraph();
          } else if (viewMode === 'page') {
            handleNextPage();
          }
        }}
        onNextChapter={handleNextChapter}
        onReset={wordProcessing.handleReset}
        onSettingsOpen={() => setShowSettings(true)}
        onViewModeChange={handleViewModeChange}
        onTooltip={setTooltip}
      />

      {/* Speed controls */}
      {viewMode === 'speed' && (
        <SpeedControls
          settings={settings}
          effectiveWPM={effectiveWPM}
          estimatedTime={estimatedTime}
          onSpeedChange={handleSpeedChange}
          onSpeedSliderChange={handleSpeedSliderChange}
          onTooltip={setTooltip}
        />
      )}

      {/* Word Selection Modal */}
      <WordSelectionModal
        visible={showWordSelection}
        onClose={() => setShowWordSelection(false)}
        currentWordIndex={currentWordIndex}
        totalWords={allWords.length}
        wordsBeforeChapter={wordsBeforeChapterMemo}
        allWords={allWords}
        onConfirm={handleWordSelectionConfirm}
      />

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={setSettings}
        customAccentColorInput={customAccentColorInput}
        customWordColorInput={customWordColorInput}
        customBackgroundColorInput={customBackgroundColorInput}
        customTextColorInput={customTextColorInput}
        customContextWordsColorInput={customContextWordsColorInput}
        onCustomColorInputChange={handleCustomColorInputChange}
        onColorPickerOpen={(type) => colorPicker.handleOpenColorPicker(type)}
        onFontPickerOpen={() => setShowFontPicker(true)}
        getDisplayColors={getDisplayColors}
        addToRecentColors={addToRecentColors}
      />

      {/* Color Picker Modal */}
      <ColorPickerModal
        visible={colorPicker.showColorPicker}
        onClose={() => colorPicker.setShowColorPicker(false)}
        onSelect={handleColorPickerSelect}
        currentColor={colorPicker.colorPickerCurrentColor}
        rgb={colorPicker.colorPickerRgb}
        onRgbChange={colorPicker.setColorPickerRgb}
      />

      {/* Font Picker Modal */}
      <FontPickerModal
        visible={showFontPicker}
        onClose={() => setShowFontPicker(false)}
        settings={settings}
        onFontSelect={(fontFamily) => setSettings({ ...settings, fontFamily })}
      />

      {/* Chapter Menu Modal */}
      <ChapterMenuModal
        visible={showChapterMenu}
        onClose={() => setShowChapterMenu(false)}
        chapters={chapters}
        currentChapterIndex={wordProcessing.currentChapterIndex}
        onChapterSelect={handleChapterSelect}
      />
    </View>
  );
}
