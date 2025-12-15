import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { Settings } from '../types';
import { styles } from '../styles';

interface SpeedControlsProps {
  settings: Settings;
  estimatedTime: string;
  onSpeedChange: (delta: number) => void;
  onSpeedSliderChange: (value: number) => void;
  onTooltip: (text: string | null) => void;
}

export const SpeedControls: React.FC<SpeedControlsProps> = ({
  settings,
  estimatedTime,
  onSpeedChange,
  onSpeedSliderChange,
  onTooltip,
}) => {
  return (
    <View style={styles.speedControls}>
      <TouchableOpacity 
        style={styles.speedButton} 
        onPress={() => onSpeedChange(-25)}
        onPressIn={() => onTooltip('Decrease speed')}
        onPressOut={() => onTooltip(null)}
      >
        <Text style={styles.speedButtonText}>−</Text>
      </TouchableOpacity>
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={50}
          maximumValue={1000}
          value={settings.wordsPerMinute}
          onValueChange={onSpeedSliderChange}
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
        onPress={() => onSpeedChange(25)}
        onPressIn={() => onTooltip('Increase speed')}
        onPressOut={() => onTooltip(null)}
      >
        <Text style={styles.speedButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};
