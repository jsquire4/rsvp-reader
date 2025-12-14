import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { Chapter } from '../utils/epubParser';

interface RSVPReaderProps {
  chapters: Chapter[];
  initialWordsPerMinute?: number;
  onComplete?: () => void;
}

interface Settings {
  accentColor: string;
  fontFamily: string;
  fontSize: number;
}

const ACCENT_COLORS = [
  { name: 'Green', value: '#00ff88' },
  { name: 'Yellow', value: '#ffeb3b' },
  { name: 'Cyan', value: '#00bcd4' },
  { name: 'Orange', value: '#ff9800' },
  { name: 'Pink', value: '#e91e63' },
  { name: 'Blue', value: '#2196f3' },
];

const FONT_FAMILIES = [
  'System',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
];

type ViewMode = 'speed' | 'paragraph' | 'page';

export default function RSVPReader({ 
  chapters, 
  initialWordsPerMinute = 250,
  onComplete 
}: RSVPReaderProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('speed');
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
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
  });
  const [tooltip, setTooltip] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-reduce font size for paragraph and page views
  const getEffectiveFontSize = () => {
    if (viewMode === 'paragraph' || viewMode === 'page') {
      return Math.max(16, settings.fontSize * 0.6); // 60% of speed reading size, minimum 16pt
    }
    return settings.fontSize;
  };

  // Flatten all words from all chapters for continuous reading
  const allWords = chapters.flatMap(ch => ch.words);
  const currentChapter = chapters[currentChapterIndex];
  const currentWord = allWords[currentWordIndex] || '';

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
  }, [currentWordIndex, chapters, currentChapterIndex]);

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

  const handleViewModeChange = (newMode: ViewMode) => {
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
      setViewMode(newMode);
      setIsPlaying(false);
    }
  };

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

  // Get paragraph boundaries
  const getParagraphBoundaries = () => {
    const wordsBeforeChapter = chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0);
    const chapterStart = wordsBeforeChapter;
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
  };

  // Navigate to previous paragraph
  const handlePreviousParagraph = () => {
    const { paraStart } = getParagraphBoundaries();
    const wordsBeforeChapter = chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0);
    
    // Find previous paragraph start
    let prevParaStart = wordsBeforeChapter;
    for (let i = paraStart - 2; i >= wordsBeforeChapter; i--) {
      const word = allWords[i];
      if (word.match(/[.!?]$/)) {
        prevParaStart = i + 1;
        break;
      }
      if (i === wordsBeforeChapter) {
        prevParaStart = wordsBeforeChapter;
        break;
      }
    }
    
    setCurrentWordIndex(prevParaStart);
  };

  // Navigate to next paragraph
  const handleNextParagraph = () => {
    const { paraEnd } = getParagraphBoundaries();
    const wordsBeforeChapter = chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0);
    const chapterEnd = wordsBeforeChapter + currentChapter.words.length;
    
    if (paraEnd < chapterEnd) {
      setCurrentWordIndex(paraEnd);
    }
  };

  // Navigate to previous page (chapter)
  const handlePreviousPage = () => {
    handlePreviousChapter();
  };

  // Navigate to next page (chapter)
  const handleNextPage = () => {
    handleNextChapter();
  };

  // Get paragraph text around current word
  const getParagraphText = () => {
    const { paraStart, paraEnd } = getParagraphBoundaries();
    return allWords.slice(paraStart, paraEnd).join(' ');
  };

  // Get page text (current chapter)
  const getPageText = () => {
    return currentChapter.words.join(' ');
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
    if (!word || word.length === 0) return <Text style={[styles.word, { fontSize: settings.fontSize }]}>{word}</Text>;
    
    const accentIndex = getAccentIndex(word);
    const before = word.substring(0, accentIndex);
    const accent = word[accentIndex];
    const after = word.substring(accentIndex + 1);

    const fontFamily = settings.fontFamily === 'System' ? undefined : settings.fontFamily;

    return (
      <Text style={[styles.word, { fontSize: settings.fontSize, fontFamily }]}>
        <Text>{before}</Text>
        <Text style={[styles.accentLetter, { color: settings.accentColor }]}>{accent}</Text>
        <Text>{after}</Text>
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
  const wordsBeforeChapter = chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0);
  const currentWordInChapter = currentWordIndex - wordsBeforeChapter + 1;
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
    <View style={styles.container}>
      {/* Chapter name at top */}
      {currentChapter?.title && (
        <View style={styles.chapterNameContainer}>
          <Text style={styles.chapterName}>{formatChapterTitle(currentChapter.title)}</Text>
        </View>
      )}

      {/* Reader area - different views */}
      <View style={styles.readerArea}>
        {viewMode === 'speed' && (
          <View style={styles.readerContent}>
            {/* Previous words with fade effect - horizontal layout */}
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
                        }
                      ]}
                    >
                      {word}{idx < prevWords.length - 1 ? ' ' : ''}
                    </Text>
                  );
                })}
              </Text>
            </View>

            {/* Current word */}
            <View style={styles.currentWordContainer}>
              {renderWordWithAccent(currentWord)}
            </View>

            {/* Next words with fade effect - horizontal layout */}
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
                        }
                      ]}
                    >
                      {idx > 0 ? ' ' : ''}{word}
                    </Text>
                  );
                })}
              </Text>
            </View>
          </View>
        )}
        
        {viewMode === 'paragraph' && (
          <ScrollView style={styles.textView} contentContainerStyle={styles.textViewContent}>
            <View style={styles.centeredTextView}>
              <Text style={[styles.paragraphText, { fontSize: getEffectiveFontSize(), fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily }]}>
                {getParagraphText().split(' ').map((word, idx) => {
                  const { paraStart } = getParagraphBoundaries();
                  const wordIndex = paraStart + idx;
                  const isSelected = selectedWordIndex === wordIndex;
                  return (
                    <Text
                      key={idx}
                      onPress={() => handleWordPress(wordIndex)}
                      style={[
                        { fontSize: getEffectiveFontSize(), fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily },
                        isSelected && { backgroundColor: settings.accentColor + '40', color: settings.accentColor }
                      ]}
                    >
                      {word}{idx < getParagraphText().split(' ').length - 1 ? ' ' : ''}
                    </Text>
                  );
                })}
              </Text>
            </View>
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
          </ScrollView>
        )}
        
        {viewMode === 'page' && (
          <ScrollView style={styles.textView} contentContainerStyle={styles.textViewContent}>
            <View style={styles.centeredTextView}>
              <Text style={[styles.pageText, { fontSize: getEffectiveFontSize(), fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily }]}>
                {getPageText().split(' ').map((word, idx) => {
                  const wordsBeforeChapter = chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0);
                  const wordIndex = wordsBeforeChapter + idx;
                  const isSelected = selectedWordIndex === wordIndex;
                  return (
                    <Text
                      key={idx}
                      onPress={() => handleWordPress(wordIndex)}
                      style={[
                        { fontSize: getEffectiveFontSize(), fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily },
                        isSelected && { backgroundColor: settings.accentColor + '40', color: settings.accentColor }
                      ]}
                    >
                      {word}{idx < getPageText().split(' ').length - 1 ? ' ' : ''}
                    </Text>
                  );
                })}
              </Text>
            </View>
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
          </ScrollView>
        )}
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
      
      {/* Disabled speed controls indicator */}
      {viewMode !== 'speed' && (
        <View style={styles.speedControlsDisabled}>
          <Text style={styles.disabledText}>Speed reading controls available in Speed view</Text>
        </View>
      )}

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
          onPress={handlePlayPause}
          disabled={viewMode !== 'speed'}
          onPressIn={() => viewMode === 'speed' && setTooltip(isPlaying ? 'Pause' : 'Play')}
          onPressOut={() => setTooltip(null)}
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

      {/* Progress bars */}
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
                  const wordsBeforeChapter = chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0);
                  let paraStart = wordsBeforeChapter;
                  for (let i = currentWordIndex; i >= wordsBeforeChapter; i--) {
                    const word = allWords[i];
                    if (word.match(/[.!?]$/)) {
                      paraStart = i + 1;
                      break;
                    }
                    if (i === wordsBeforeChapter) paraStart = i;
                  }
                  handleWordSelectionConfirm(paraStart);
                }}
              >
                <Text style={styles.wordSelectionButtonText}>Start from paragraph beginning</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.wordSelectionButton}
                onPress={() => {
                  const wordsBeforeChapter = chapters.slice(0, currentChapterIndex).reduce((sum, ch) => sum + ch.words.length, 0);
                  handleWordSelectionConfirm(wordsBeforeChapter);
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
              {/* Accent Color */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Accent Color</Text>
                <View style={styles.colorGrid}>
                  {ACCENT_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color.value}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color.value },
                        settings.accentColor === color.value && styles.colorOptionSelected,
                      ]}
                      onPress={() => setSettings({ ...settings, accentColor: color.value })}
                    >
                      {settings.accentColor === color.value && (
                        <Text style={styles.colorCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    maxWidth: 800,
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
  readerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 600,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  contextWordsLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 15,
    maxWidth: 200,
    overflow: 'hidden',
  },
  contextWordsRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 15,
    maxWidth: 200,
    overflow: 'hidden',
  },
  contextWordsContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  contextWord: {
    color: '#999',
    fontWeight: '300',
  },
  currentWordContainer: {
    flex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    minWidth: 200,
  },
  word: {
    fontWeight: 'bold',
    color: '#fff',
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
    marginVertical: 20,
    gap: 10,
    flexWrap: 'wrap',
    maxWidth: 600,
    alignSelf: 'center',
  },
  button: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
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
  progressContainer: {
    width: '100%',
    marginTop: 20,
    maxWidth: 600,
    alignSelf: 'center',
  },
  progressSlider: {
    width: '100%',
    height: 40,
    marginBottom: 10,
  },
  progressText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
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
    minWidth: 50,
  },
  viewModeButtonActive: {
    backgroundColor: '#555',
  },
  speedControlsDisabled: {
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledText: {
    color: '#666',
    fontSize: 14,
  },
  buttonDisabled: {
    backgroundColor: '#222',
    opacity: 0.5,
  },
  buttonTextDisabled: {
    color: '#666',
  },
  textView: {
    flex: 1,
    width: '100%',
  },
  textViewContent: {
    padding: 20,
    paddingTop: 60, // Space for chapter name
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
    color: '#fff',
    lineHeight: 32,
    textAlign: 'left',
  },
  pageText: {
    color: '#fff',
    lineHeight: 32,
    textAlign: 'left',
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
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    zIndex: 1000,
    minWidth: 140,
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
