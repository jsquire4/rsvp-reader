import React from 'react';
import { View, Text } from 'react-native';
import { Settings } from '../types';
import { getCleanWordLength, getAccentIndex } from '../utils/wordUtils';
import { styles } from '../styles';

interface WordRendererProps {
  wordOrWords: string;
  settings: Settings;
}

export const WordRenderer: React.FC<WordRendererProps> = ({ wordOrWords, settings }) => {
  if (!wordOrWords || wordOrWords.length === 0) {
    return <Text style={[styles.word, { fontSize: settings.fontSize, color: settings.wordColor }]}>{wordOrWords}</Text>;
  }
  
  const fontFamily = settings.fontFamily === 'System' ? undefined : settings.fontFamily;
  
  // If multiple words (contains space), highlight only first character of second word
  if (wordOrWords.includes(' ')) {
    const words = wordOrWords.split(' ');
    const firstWord = words[0] || '';
    const secondWord = words[1] || '';
    
    // Get clean lengths to determine which is smaller
    const firstWordLength = getCleanWordLength(firstWord);
    const secondWordLength = getCleanWordLength(secondWord);
    
    // Estimate if words would wrap based on total character count and font size
    const totalCharCount = firstWord.length + secondWord.length + 1; // +1 for space
    const estimatedCharWidth = settings.fontSize * 0.6;
    const usableWidth = 960;
    const estimatedCharsPerLine = Math.floor(usableWidth / estimatedCharWidth);
    const wouldWrap = totalCharCount > (estimatedCharsPerLine * 0.9);
    
    // Find first letter character in second word
    let accentCharIndex = -1;
    let accentChar = '';
    let beforeAccent = '';
    let afterAccent = '';
    
    if (secondWord) {
      for (let i = 0; i < secondWord.length; i++) {
        if (/[a-zA-Z]/.test(secondWord[i])) {
          accentCharIndex = i;
          accentChar = secondWord[i];
          beforeAccent = secondWord.substring(0, i);
          afterAccent = secondWord.substring(i + 1);
          break;
        }
      }
    }
    
    // Only apply vertical layout if words would actually wrap
    if (wouldWrap && firstWordLength < secondWordLength) {
      // First word is smaller: render it above, second word on primary line
      return (
        <View style={styles.wordPairContainer}>
          <Text style={[styles.wordPairSmall, { fontSize: settings.fontSize, fontFamily, color: settings.wordColor }]}>
            {firstWord}
          </Text>
          <Text style={[styles.word, { fontSize: settings.fontSize, fontFamily }]}>
            {accentCharIndex >= 0 ? (
              <>
                <Text style={{ color: settings.wordColor }}>{beforeAccent}</Text>
                <Text style={[styles.accentLetter, { color: settings.accentColor }]}>{accentChar}</Text>
                <Text style={{ color: settings.wordColor }}>{afterAccent}</Text>
              </>
            ) : (
              <Text style={{ color: settings.wordColor }}>{secondWord}</Text>
            )}
            {words.length > 2 && words.slice(2).map((word, idx) => (
              <Text key={idx + 2} style={{ color: settings.wordColor }}> {word}</Text>
            ))}
          </Text>
        </View>
      );
    } else if (wouldWrap && secondWordLength < firstWordLength) {
      // Second word is smaller: render it above, first word on primary line
      return (
        <View style={styles.wordPairContainer}>
          <Text style={[styles.wordPairSmall, { fontSize: settings.fontSize, fontFamily }]}>
            {accentCharIndex >= 0 ? (
              <>
                <Text style={{ color: settings.wordColor }}>{beforeAccent}</Text>
                <Text style={[styles.accentLetter, { color: settings.accentColor }]}>{accentChar}</Text>
                <Text style={{ color: settings.wordColor }}>{afterAccent}</Text>
              </>
            ) : (
              <Text style={{ color: settings.wordColor }}>{secondWord}</Text>
            )}
          </Text>
          <Text style={[styles.word, { fontSize: settings.fontSize, fontFamily, color: settings.wordColor }]}>
            {firstWord}
            {words.length > 2 && words.slice(2).map((word, idx) => (
              <Text key={idx + 2}> {word}</Text>
            ))}
          </Text>
        </View>
      );
    }
    
    // Words are equal length: render normally (first word on primary line)
    return (
      <Text style={[styles.word, { fontSize: settings.fontSize, fontFamily }]}>
        <Text style={{ color: settings.wordColor }}>{firstWord}</Text>
        {' '}
        {accentCharIndex >= 0 ? (
          <>
            <Text style={{ color: settings.wordColor }}>{beforeAccent}</Text>
            <Text style={[styles.accentLetter, { color: settings.accentColor }]}>{accentChar}</Text>
            <Text style={{ color: settings.wordColor }}>{afterAccent}</Text>
          </>
        ) : (
          <Text style={{ color: settings.wordColor }}>{secondWord}</Text>
        )}
        {words.length > 2 && words.slice(2).map((word, idx) => (
          <Text key={idx + 2} style={{ color: settings.wordColor }}> {word}</Text>
        ))}
      </Text>
    );
  }
  
  // Single word rendering
  const accentIndex = getAccentIndex(wordOrWords);
  const before = wordOrWords.substring(0, accentIndex);
  const accent = wordOrWords[accentIndex];
  const after = wordOrWords.substring(accentIndex + 1);

  return (
    <Text style={[styles.word, { fontSize: settings.fontSize, fontFamily }]}>
      <Text style={{ color: settings.wordColor }}>{before}</Text>
      <Text style={[styles.accentLetter, { color: settings.accentColor }]}>{accent}</Text>
      <Text style={{ color: settings.wordColor }}>{after}</Text>
    </Text>
  );
};
