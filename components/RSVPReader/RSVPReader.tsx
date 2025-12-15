import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, ScrollView, TextInput, Switch } from 'react-native';
import RenderHTML from 'react-native-render-html';
import { Chapter } from '../../utils/epubParser';
import { RSVPReaderProps, ViewMode, Settings } from './types';
import { useSettings } from './hooks/useSettings';
import { useProgress } from './hooks/useProgress';
import { useColorPicker } from './hooks/useColorPicker';
import Slider from '@react-native-community/slider';
import { useWordProcessing } from './hooks/useWordProcessing';
import { formatChapterTitle } from './utils/wordUtils';
import { hexToRgb, rgbToHex } from './utils/colorUtils';
import { SpeedView } from './components/SpeedView';
import { ProgressBar } from './components/ProgressBar';
import { SpeedControls } from './components/SpeedControls';
import { FONT_FAMILIES } from './constants';
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

  // Custom hooks
  const { settings, setSettings, getDisplayColors, addToRecentColors } = useSettings(initialWordsPerMinute);
  const { currentChapterIndex, setCurrentChapterIndex, currentWordIndex, setCurrentWordIndex, isLoadingProgress } = useProgress(chapters, bookUri);
  const colorPicker = useColorPicker(settings);
  const wordProcessing = useWordProcessing(chapters, settings, currentChapterIndex, onComplete);

  // Sync word processing state with progress state
  React.useEffect(() => {
    wordProcessing.setCurrentWordIndex(currentWordIndex);
  }, [currentWordIndex]);

  React.useEffect(() => {
    setCurrentWordIndex(wordProcessing.currentWordIndex);
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
      let wordCount = 0;
      for (let i = 0; i < currentChapterIndex - 1; i++) {
        wordCount += chapters[i].words.length;
      }
      setCurrentWordIndex(wordCount);
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      wordProcessing.stopPlayback();
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
    wordProcessing.stopPlayback();
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

  const handlePreviousParagraph = useCallback(() => {
    const { paraStart } = paragraphBoundaries;
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

  const handleNextParagraph = useCallback(() => {
    const { paraEnd } = paragraphBoundaries;
    const chapterEnd = wordsBeforeChapterMemo + currentChapter.words.length;
    if (paraEnd < chapterEnd) {
      setCurrentWordIndex(paraEnd);
    }
  }, [paragraphBoundaries, wordsBeforeChapterMemo, currentChapter]);

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
              wordProcessing.handlePrevious();
            } else if (viewMode === 'paragraph') {
              handlePreviousParagraph();
            } else if (viewMode === 'page') {
              handlePreviousChapter();
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
              handleNextChapter();
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

      {/* Settings Modal - keeping inline for now, can be extracted later */}
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
                    onPress={() => colorPicker.handleOpenColorPicker('word')}
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
                    onPress={() => colorPicker.handleOpenColorPicker('accent')}
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
                    onPress={() => colorPicker.handleOpenColorPicker('background')}
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
                    onPress={() => colorPicker.handleOpenColorPicker('text')}
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
                    onPress={() => colorPicker.handleOpenColorPicker('contextWords')}
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
        visible={colorPicker.showColorPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => colorPicker.setShowColorPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => colorPicker.setShowColorPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.colorPickerModalContent}
          >
            <Text style={styles.modalTitle}>Select Color</Text>
            
            <View style={[styles.colorPreview, { backgroundColor: colorPicker.colorPickerCurrentColor }]}>
              <Text style={styles.colorPreviewText}>{colorPicker.colorPickerCurrentColor}</Text>
            </View>
            
            <View style={styles.colorPickerSliders}>
              <View style={styles.colorSliderRow}>
                <Text style={styles.colorSliderLabel}>R: {Math.round(colorPicker.colorPickerRgb.r)}</Text>
                <Slider
                  style={styles.colorSlider}
                  minimumValue={0}
                  maximumValue={255}
                  value={colorPicker.colorPickerRgb.r}
                  onValueChange={(value) => colorPicker.setColorPickerRgb({ ...colorPicker.colorPickerRgb, r: value })}
                  minimumTrackTintColor="#f44336"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#f44336"
                  step={1}
                />
              </View>
              <View style={styles.colorSliderRow}>
                <Text style={styles.colorSliderLabel}>G: {Math.round(colorPicker.colorPickerRgb.g)}</Text>
                <Slider
                  style={styles.colorSlider}
                  minimumValue={0}
                  maximumValue={255}
                  value={colorPicker.colorPickerRgb.g}
                  onValueChange={(value) => colorPicker.setColorPickerRgb({ ...colorPicker.colorPickerRgb, g: value })}
                  minimumTrackTintColor="#4caf50"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#4caf50"
                  step={1}
                />
              </View>
              <View style={styles.colorSliderRow}>
                <Text style={styles.colorSliderLabel}>B: {Math.round(colorPicker.colorPickerRgb.b)}</Text>
                <Slider
                  style={styles.colorSlider}
                  minimumValue={0}
                  maximumValue={255}
                  value={colorPicker.colorPickerRgb.b}
                  onValueChange={(value) => colorPicker.setColorPickerRgb({ ...colorPicker.colorPickerRgb, b: value })}
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
                      colorPicker.setColorPickerRgb(hexToRgb(color));
                    }}
                  />
                ))}
              </View>
            </View>
            
            <View style={styles.colorPickerActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#333', flex: 1, marginRight: 10 }]}
                onPress={() => colorPicker.setShowColorPicker(false)}
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
