import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { Settings } from '../types';
import { styles } from '../styles';

interface ProgressBarProps {
  currentWordIndex: number;
  totalWords: number;
  currentWordInChapter: number;
  totalWordsInChapter: number;
  bookRemainingPercent: number;
  settings: Settings;
  onValueChange: (value: number) => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentWordIndex,
  totalWords,
  currentWordInChapter,
  totalWordsInChapter,
  bookRemainingPercent,
  settings,
  onValueChange,
}) => {
  return (
    <View style={styles.progressContainer}>
      <Slider
        style={styles.progressSlider}
        minimumValue={0}
        maximumValue={totalWords - 1}
        value={currentWordIndex}
        onValueChange={onValueChange}
        minimumTrackTintColor={settings.accentColor}
        maximumTrackTintColor="#333"
        thumbTintColor={settings.accentColor}
        step={1}
      />
      <Text style={styles.progressText}>
        {currentWordInChapter} / {totalWordsInChapter} • {bookRemainingPercent}% remaining
      </Text>
    </View>
  );
};
