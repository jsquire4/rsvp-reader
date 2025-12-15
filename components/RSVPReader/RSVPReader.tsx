import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Chapter } from '../../utils/epubParser';
import { RSVPReaderProps, ViewMode, ColorType } from './types';
import { useSettings } from './hooks/useSettings';
import { useProgress } from './hooks/useProgress';
import { useColorPicker } from './hooks/useColorPicker';
import { useWordProcessing } from './hooks/useWordProcessing';
import { formatChapterTitle } from './utils/wordUtils';
import { rgbToHex } from './utils/colorUtils';
import { SpeedView } from './components/SpeedView';
import { ProgressBar } from './components/ProgressBar';
import { SpeedControls } from './components/SpeedControls';
import { SettingsModal } from './components/SettingsModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { FontPickerModal } from './components/FontPickerModal';
import { ChapterMenuModal } from './components/ChapterMenuModal';
import { WordSelectionModal } from './components/WordSelectionModal';
import { RSVPPrompt } from './components/RSVPPrompt';
import { RenderHTMLConfig } from './components/RenderHTMLConfig';
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
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [customAccentColorInput, setCustomAccentColorInput] = useState('');
  const [customWordColorInput, setCustomWordColorInput] = useState('');
  const [customBackgroundColorInput, setCustomBackgroundColorInput] = useState('');
  const [customTextColorInput, setCustomTextColorInput] = useState('');
  const [customContextWordsColorInput, setCustomContextWordsColorInput] = useState('');
  const isManuallyNavigatingRef = React.useRef(false);

  // Custom hooks
  const { settings, setSettings, getDisplayColors, addToRecentColors } = useSettings(initialWordsPerMinute);
  const { currentChapterIndex, setCurrentChapterIndex, currentWordIndex, setCurrentWordIndex, isLoadingProgress } = useProgress(chapters, bookUri);
  const colorPicker = useColorPicker(settings);
  const wordProcessing = useWordProcessing(chapters, settings, currentChapterIndex, onComplete);

  // Sync word processing state with progress state
  // In speed view, wordProcessing is the source of truth
  // In other views, progress hook is the source of truth
  React.useEffect(() => {
    if (!isManuallyNavigatingRef.current && viewMode !== 'speed') {
      // Only sync from progress to wordProcessing in non-speed views
      wordProcessing.setCurrentWordIndex(currentWordIndex);
    }
  }, [currentWordIndex, viewMode, wordProcessing]);

  React.useEffect(() => {
    if (!isManuallyNavigatingRef.current) {
      // Always sync from wordProcessing to progress (wordProcessing is always authoritative)
      setCurrentWordIndex(wordProcessing.currentWordIndex);
    }
  }, [wordProcessing.currentWordIndex]);

  const allWords = wordProcessing.allWords;
  const currentChapter = chapters[currentChapterIndex];
  const wordsBeforeChapterMemo = wordProcessing.wordsBeforeChapterMemo;
  const paragraphBoundaries = wordProcessing.paragraphBoundaries;

  // Calculate estimated time to completion
  const remainingWords = allWords.length - currentWordIndex - 1;
  const estimatedMinutes = remainingWords > 0 ? remainingWords / settings.wordsPerMinute : 0;
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
    if (currentChapterIndex > 0) {
      wordProcessing.stopPlayback();
      
      const newChapterIndex = currentChapterIndex - 1;
      let wordCount = 0;
      for (let i = 0; i < newChapterIndex; i++) {
        wordCount += chapters[i].words.length;
      }
      
      // Set flag to prevent sync effects from interfering
      isManuallyNavigatingRef.current = true;
      
      // Update word processing hook first (source of truth in speed view)
      wordProcessing.setCurrentWordIndex(wordCount);
      // Then update progress hook
      setCurrentWordIndex(wordCount);
      // Finally update chapter index
      setCurrentChapterIndex(newChapterIndex);
      
      // Reset flag after a brief delay to allow state updates to complete
      requestAnimationFrame(() => {
        isManuallyNavigatingRef.current = false;
      });
    }
  };

  const handleNextChapter = useCallback(() => {
    const nextChapterIndex = currentChapterIndex + 1;
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
    
    const targetWordIndex = wordCount;
    
    // Set flag synchronously BEFORE any state updates
    isManuallyNavigatingRef.current = true;
    
    // Update chapter index first
    setCurrentChapterIndex(nextChapterIndex);
    
    // Update word processing hook immediately (source of truth in speed view)
    // This must happen before the sync effect runs
    wordProcessing.setCurrentWordIndex(targetWordIndex);
    
    // Update progress hook
    setCurrentWordIndex(targetWordIndex);
    
    // Reset flag after a longer delay to ensure all effects have completed
    // The sync effects need time to see the flag and skip updating
    setTimeout(() => {
      isManuallyNavigatingRef.current = false;
    }, 300);
  }, [currentChapterIndex, chapters, allWords.length, wordProcessing]);

  const handleChapterSelect = (chapterIndex: number) => {
    wordProcessing.stopPlayback();
    
    let wordCount = 0;
    for (let i = 0; i < chapterIndex; i++) {
      wordCount += chapters[i].words.length;
    }
    
    // Set flag to prevent sync effects from interfering
    isManuallyNavigatingRef.current = true;
    
    // Update word processing hook first
    wordProcessing.setCurrentWordIndex(wordCount);
    // Then update progress hook
    setCurrentWordIndex(wordCount);
    // Finally update chapter index
    setCurrentChapterIndex(chapterIndex);
    setShowChapterMenu(false);
    
    // Reset flag after a brief delay to allow state updates to complete
    requestAnimationFrame(() => {
      isManuallyNavigatingRef.current = false;
    });
  };

  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    if (newMode === 'speed' && viewMode !== 'speed') {
      if (selectedWordIndex !== null) {
        setCurrentWordIndex(selectedWordIndex);
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
    setCurrentWordIndex(wordIndex);
    setViewMode('speed');
    setShowWordSelection(false);
    wordProcessing.stopPlayback();
    setSelectedWordIndex(null);
  };

  // Helper function to find actual paragraph boundaries based on line breaks or HTML tags
  const findParagraphBoundaries = useCallback(() => {
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
        paraEnd: Math.min(chapterEnd, chapterStart + paraEndWordCount),
        currentParaIndex,
        totalParagraphs: paragraphs.length
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
          paraEnd: Math.min(chapterEnd, chapterStart + paraEndWordCount),
          currentParaIndex,
          totalParagraphs: paraMatches.length
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
    
    return {
      paraStart,
      paraEnd,
      currentParaIndex: 0,
      totalParagraphs: 1
    };
  }, [currentChapter, currentWordIndex, wordsBeforeChapterMemo, allWords]);

  const handlePreviousParagraph = useCallback(() => {
    const boundaries = findParagraphBoundaries();
    const { currentParaIndex, totalParagraphs } = boundaries;
    
    if (currentParaIndex === 0) {
      // Already at first paragraph, go to start of chapter
      setCurrentWordIndex(wordsBeforeChapterMemo);
      return;
    }
    
    // Find the start of the previous paragraph
    const prevParaIndex = currentParaIndex - 1;
    const chapterStart = wordsBeforeChapterMemo;
    
    if (currentChapter.rawText) {
      const paragraphs = currentChapter.rawText.split(/\n\n+/).filter(p => p.trim());
      let wordCount = 0;
      for (let i = 0; i < prevParaIndex; i++) {
        const paraWordCount = paragraphs[i].split(/\s+/).filter(w => w.trim()).length;
        wordCount += paraWordCount;
      }
      setCurrentWordIndex(chapterStart + wordCount);
    } else if (currentChapter.htmlContent) {
      const html = currentChapter.htmlContent;
      const paraMatches = html.match(/<(p|div)[^>]*>[\s\S]*?<\/(p|div)>/gi);
      if (paraMatches && paraMatches.length > 0) {
        let wordCount = 0;
        for (let i = 0; i < prevParaIndex; i++) {
          const text = paraMatches[i].replace(/<[^>]*>/g, '');
          const paraWordCount = text.split(/\s+/).filter(w => w.trim()).length;
          wordCount += paraWordCount;
        }
        setCurrentWordIndex(chapterStart + wordCount);
      }
    }
  }, [findParagraphBoundaries, currentChapter, wordsBeforeChapterMemo]);

  const handleNextParagraph = useCallback(() => {
    const boundaries = findParagraphBoundaries();
    const { currentParaIndex, totalParagraphs, paraEnd } = boundaries;
    
    if (currentParaIndex >= totalParagraphs - 1) {
      // Already at last paragraph, stay at end
      return;
    }
    
    // Move to start of next paragraph (which is the end of current paragraph)
    setCurrentWordIndex(paraEnd);
  }, [findParagraphBoundaries]);

  const handlePreviousPage = useCallback(() => {
    if (!currentChapter?.rawText) return;
    
    const paragraphs = currentChapter.rawText.split(/\n\n+/).filter(p => p.trim());
    const currentWordInChapter = currentWordIndex - wordsBeforeChapterMemo;
    
    // Find current paragraph index
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
    
    // Move back 6 paragraphs (or to start of chapter)
    const targetParaIndex = Math.max(0, currentParaIndex - 6);
    
    // Calculate word index for start of target paragraph
    let targetWordCount = 0;
    for (let i = 0; i < targetParaIndex; i++) {
      const paraWordCount = paragraphs[i].split(/\s+/).filter(w => w.trim()).length;
      targetWordCount += paraWordCount;
    }
    
    setCurrentWordIndex(wordsBeforeChapterMemo + targetWordCount);
  }, [currentChapter, currentWordIndex, wordsBeforeChapterMemo]);

  const handleNextPage = useCallback(() => {
    if (!currentChapter?.rawText) return;
    
    const paragraphs = currentChapter.rawText.split(/\n\n+/).filter(p => p.trim());
    const currentWordInChapter = currentWordIndex - wordsBeforeChapterMemo;
    
    // Find current paragraph index
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
    
    // Move forward 6 paragraphs (or to end of chapter)
    const targetParaIndex = Math.min(paragraphs.length - 1, currentParaIndex + 6);
    
    // Calculate word index for start of target paragraph
    let targetWordCount = 0;
    for (let i = 0; i < targetParaIndex; i++) {
      const paraWordCount = paragraphs[i].split(/\s+/).filter(w => w.trim()).length;
      targetWordCount += paraWordCount;
    }
    
    const chapterEnd = wordsBeforeChapterMemo + currentChapter.words.length;
    const targetIndex = wordsBeforeChapterMemo + targetWordCount;
    
    if (targetIndex < chapterEnd) {
      setCurrentWordIndex(targetIndex);
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
      {currentChapter?.title && (
        <View style={styles.chapterNameContainer}>
          <Text style={styles.chapterName}>{formatChapterTitle(currentChapter.title)}</Text>
        </View>
      )}

      {/* Progress bar */}
      <ProgressBar
        currentWordIndex={currentWordIndex}
        totalWords={allWords.length}
        currentWordInChapter={currentWordInChapter}
        totalWordsInChapter={totalWordsInChapter}
        bookRemainingPercent={bookRemainingPercent}
        settings={settings}
        onValueChange={(value) => {
          setCurrentWordIndex(Math.round(value));
          wordProcessing.stopPlayback();
        }}
      />

      {/* Reader area - different views */}
      <View style={viewMode === 'speed' ? styles.readerAreaSpeed : styles.readerArea}>
        {viewMode === 'speed' && (
          <SpeedView
            allWords={allWords}
            currentWordIndex={currentWordIndex}
            settings={settings}
          />
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
                  <RenderHTMLConfig
                    html={paragraphHTML}
                    settings={settings}
                    effectiveFontSize={effectiveFontSize}
                  />
                ) : (
                  <Text 
                    selectable
                    onPress={() => setSelectedWordIndex(currentWordIndex)}
                    onLongPress={() => setSelectedWordIndex(currentWordIndex)}
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
              <RSVPPrompt
                settings={settings}
                onStartRSVP={() => handleViewModeChange('speed')}
              />
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
                  <RenderHTMLConfig
                    html={(() => {
                      const paragraphs = currentChapter.htmlContent.split(/<\/p>|<\/div>/).filter(p => p.trim());
                      const currentWordInChapter = currentWordIndex - wordsBeforeChapterMemo;
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
                    })()}
                    settings={settings}
                    effectiveFontSize={effectiveFontSize}
                  />
                ) : (
                  <Text 
                    selectable
                    onPress={() => setSelectedWordIndex(currentWordIndex)}
                    onLongPress={() => setSelectedWordIndex(currentWordIndex)}
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
              <RSVPPrompt
                settings={settings}
                onStartRSVP={() => handleViewModeChange('speed')}
              />
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
              wordProcessing.handlePrevious();
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
              wordProcessing.handlePlayPause();
            } else {
              setTooltip('Speed reading controls available in Speed view');
              setTimeout(() => setTooltip(null), 2000);
            }
          }}
          onPressIn={() => {
            if (viewMode === 'speed') {
              setTooltip(wordProcessing.isPlaying ? 'Pause' : 'Play');
            }
          }}
          onPressOut={() => {
            if (viewMode === 'speed') {
              setTooltip(null);
            }
          }}
        >
          <Text style={[styles.buttonText, viewMode !== 'speed' && styles.buttonTextDisabled]}>
            {wordProcessing.isPlaying ? '⏸' : '▶'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => {
            if (viewMode === 'speed') {
              wordProcessing.handleNext();
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
          onPress={wordProcessing.handleReset}
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

      {/* Speed controls */}
      {viewMode === 'speed' && (
        <SpeedControls
          settings={settings}
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
        currentChapterIndex={currentChapterIndex}
        onChapterSelect={handleChapterSelect}
      />
    </View>
  );
}
