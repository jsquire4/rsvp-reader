import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Settings, ColorType } from '../types';
import { styles } from '../styles';

interface ColorSettingSectionProps {
  label: string;
  colorType: ColorType;
  settings: Settings;
  customColorInput: string;
  onColorSelect: (color: string) => void;
  onCustomColorChange: (text: string) => void;
  onColorPickerOpen: () => void;
  getDisplayColors: (type: ColorType) => Array<{ value: string; label: string }>;
}

export function ColorSettingSection({
  label,
  colorType,
  settings,
  customColorInput,
  onColorSelect,
  onCustomColorChange,
  onColorPickerOpen,
  getDisplayColors,
}: ColorSettingSectionProps) {
  const currentColor = settings[colorType === 'accent' ? 'accentColor' : 
                                colorType === 'word' ? 'wordColor' :
                                colorType === 'background' ? 'backgroundColor' :
                                colorType === 'text' ? 'textColor' : 'contextWordsColor'];

  return (
    <View style={styles.settingSection}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.colorGrid}>
        {getDisplayColors(colorType).map((color) => (
          <TouchableOpacity
            key={color.value}
            style={[
              styles.colorOption,
              { backgroundColor: color.value },
              currentColor === color.value && styles.colorOptionSelected,
            ]}
            onPress={() => onColorSelect(color.value)}
          >
            {currentColor === color.value && (
              <Text style={styles.colorCheck}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.customColorContainer}>
        <Text style={styles.settingSubLabel}>Custom Color (Hex):</Text>
        <TextInput
          style={styles.colorInput}
          value={customColorInput}
          onChangeText={onCustomColorChange}
          placeholder="#ffffff"
          placeholderTextColor="#666"
          maxLength={7}
        />
        <TouchableOpacity
          style={styles.colorPickerButton}
          onPress={onColorPickerOpen}
        >
          <Text style={styles.colorPickerButtonText}>🎨</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
