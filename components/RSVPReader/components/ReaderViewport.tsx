import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Chapter } from '../../../utils/epubParser';
import { ViewMode, Settings } from '../types';
import { SpeedView } from './SpeedView';
import { RSVPPrompt } from './RSVPPrompt';
import { RenderHTMLConfig } from './RenderHTMLConfig';
import { styles } from '../styles';

interface ReaderViewportProps {
  viewMode: ViewMode;
  allWords: string[];
  currentWordIndex: number;
  settings: Settings;
  currentChapter: Chapter | undefined;
  paragraphText: string;
  paragraphHTML: string | null;
  pageText: string;
  effectiveFontSize: number;
  selectedWordIndex: number | null;
  wordsBeforeChapterMemo: number;
  onWordSelect: (wordIndex: number) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ReaderViewport({
  viewMode,
  allWords,
  currentWordIndex,
  settings,
  currentChapter,
  paragraphText,
  paragraphHTML,
  pageText,
  effectiveFontSize,
  selectedWordIndex,
  wordsBeforeChapterMemo,
  onWordSelect,
  onViewModeChange,
}: ReaderViewportProps) {
  return (
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
                  onPress={() => onWordSelect(currentWordIndex)}
                  onLongPress={() => onWordSelect(currentWordIndex)}
                  style={[
                    styles.paragraphText,
                    {
                      fontSize: effectiveFontSize,
                      fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
                      color: settings.textColor,
                    },
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
              onStartRSVP={() => onViewModeChange('speed')}
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
                  onPress={() => onWordSelect(currentWordIndex)}
                  onLongPress={() => onWordSelect(currentWordIndex)}
                  style={[
                    styles.pageText,
                    {
                      fontSize: effectiveFontSize,
                      fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
                      lineHeight: effectiveFontSize * 1.5,
                      color: settings.textColor,
                    },
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
              onStartRSVP={() => onViewModeChange('speed')}
            />
          )}
        </View>
      )}
    </View>
  );
}
