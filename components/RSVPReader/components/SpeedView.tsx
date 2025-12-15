import React from 'react';
import { View, Text } from 'react-native';
import { Settings } from '../types';
import { WordRenderer } from './WordRenderer';
import { getDisplayWords } from '../utils/wordUtils';
import { styles } from '../styles';

interface SpeedViewProps {
  allWords: string[];
  currentWordIndex: number;
  settings: Settings;
}

export const SpeedView: React.FC<SpeedViewProps> = ({
  allWords,
  currentWordIndex,
  settings,
}) => {
  const displayWordsInfo = getDisplayWords(currentWordIndex, allWords);
  const displayWords = displayWordsInfo.words;
  const currentWord = displayWords.join(' ');

  const wordsToShow = 3;
  const numDisplayedWords = displayWordsInfo.words.length;
  const lastDisplayedWordIndex = currentWordIndex + numDisplayedWords - 1;
  
  const prevWords: string[] = [];
  const nextWords: string[] = [];
  
  // Previous words: before the current display
  for (let i = 1; i <= wordsToShow; i++) {
    if (currentWordIndex - i >= 0) {
      prevWords.unshift(allWords[currentWordIndex - i]);
    }
  }
  
  // Next words: after the last displayed word
  for (let i = 1; i <= wordsToShow; i++) {
    const nextIndex = lastDisplayedWordIndex + i;
    if (nextIndex < allWords.length) {
      nextWords.push(allWords[nextIndex]);
    }
  }

  const fontFamily = settings.fontFamily === 'System' ? undefined : settings.fontFamily;

  return (
    <View style={styles.readerContentSpeed}>
      {/* Previous words with fade effect - horizontal layout */}
      {settings.showContextWords && (
        <View style={styles.contextWordsLeft}>
          <Text style={styles.contextWordsContainer} numberOfLines={1}>
            {prevWords.map((word, idx) => {
              const opacity = Math.max(0.1, 0.1 + (idx / wordsToShow) * 0.5);
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
          paddingHorizontal: settings.contextWordsSpacing,
        }
      ]}>
        <WordRenderer wordOrWords={currentWord} settings={settings} />
      </View>

      {/* Next words with fade effect - horizontal layout */}
      {settings.showContextWords && (
        <View style={styles.contextWordsRight}>
          <Text style={styles.contextWordsContainer} numberOfLines={1}>
            {nextWords.map((word, idx) => {
              const distanceFromRightEdge = idx + 1;
              const opacity = Math.max(0.1, 0.6 - (distanceFromRightEdge / wordsToShow) * 0.5);
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
  );
};
