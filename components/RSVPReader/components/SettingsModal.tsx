import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import { Settings, ColorType } from '../types';
import { styles } from '../styles';
import { ColorSettingSection } from './ColorSettingSection';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  customAccentColorInput: string;
  customWordColorInput: string;
  customBackgroundColorInput: string;
  customTextColorInput: string;
  customContextWordsColorInput: string;
  onCustomColorInputChange: (type: ColorType, value: string) => void;
  onColorPickerOpen: (type: ColorType) => void;
  onFontPickerOpen: () => void;
  getDisplayColors: (type: ColorType) => Array<{ value: string; label: string }>;
  addToRecentColors: (type: ColorType, color: string) => void;
}

export function SettingsModal({
  visible,
  onClose,
  settings,
  onSettingsChange,
  customAccentColorInput,
  customWordColorInput,
  customBackgroundColorInput,
  customTextColorInput,
  customContextWordsColorInput,
  onCustomColorInputChange,
  onColorPickerOpen,
  onFontPickerOpen,
  getDisplayColors,
  addToRecentColors,
}: SettingsModalProps) {
  const handleColorSelect = (type: ColorType, color: string) => {
    const newSettings = { ...settings };
    if (type === 'accent') newSettings.accentColor = color;
    else if (type === 'word') newSettings.wordColor = color;
    else if (type === 'background') newSettings.backgroundColor = color;
    else if (type === 'text') newSettings.textColor = color;
    else if (type === 'contextWords') newSettings.contextWordsColor = color;
    
    onSettingsChange(newSettings);
    onCustomColorInputChange(type, '');
    addToRecentColors(type, color);
  };

  const handleCustomColorChange = (type: ColorType, text: string) => {
    onCustomColorInputChange(type, text);
    if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
      const newSettings = { ...settings };
      if (type === 'accent') newSettings.accentColor = text;
      else if (type === 'word') newSettings.wordColor = text;
      else if (type === 'background') newSettings.backgroundColor = text;
      else if (type === 'text') newSettings.textColor = text;
      else if (type === 'contextWords') newSettings.contextWordsColor = text;
      
      onSettingsChange(newSettings);
      addToRecentColors(type, text);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Settings</Text>
          
          <ScrollView style={styles.scrollView}>
            {/* Word Color */}
            <ColorSettingSection
              label="Current Word Color"
              colorType="word"
              settings={settings}
              customColorInput={customWordColorInput}
              onColorSelect={(color) => handleColorSelect('word', color)}
              onCustomColorChange={(text) => handleCustomColorChange('word', text)}
              onColorPickerOpen={() => onColorPickerOpen('word')}
              getDisplayColors={getDisplayColors}
            />

            {/* Accent Color */}
            <ColorSettingSection
              label="Highlighted Letter Color"
              colorType="accent"
              settings={settings}
              customColorInput={customAccentColorInput}
              onColorSelect={(color) => handleColorSelect('accent', color)}
              onCustomColorChange={(text) => handleCustomColorChange('accent', text)}
              onColorPickerOpen={() => onColorPickerOpen('accent')}
              getDisplayColors={getDisplayColors}
            />

            {/* Background Color */}
            <ColorSettingSection
              label="Background Color"
              colorType="background"
              settings={settings}
              customColorInput={customBackgroundColorInput}
              onColorSelect={(color) => handleColorSelect('background', color)}
              onCustomColorChange={(text) => handleCustomColorChange('background', text)}
              onColorPickerOpen={() => onColorPickerOpen('background')}
              getDisplayColors={getDisplayColors}
            />

            {/* Text Color */}
            <ColorSettingSection
              label="Text Color (Paragraph/Page View)"
              colorType="text"
              settings={settings}
              customColorInput={customTextColorInput}
              onColorSelect={(color) => handleColorSelect('text', color)}
              onCustomColorChange={(text) => handleCustomColorChange('text', text)}
              onColorPickerOpen={() => onColorPickerOpen('text')}
              getDisplayColors={getDisplayColors}
            />

            {/* Context Words Color */}
            <ColorSettingSection
              label="Previous/Next Words Color"
              colorType="contextWords"
              settings={settings}
              customColorInput={customContextWordsColorInput}
              onColorSelect={(color) => handleColorSelect('contextWords', color)}
              onCustomColorChange={(text) => handleCustomColorChange('contextWords', text)}
              onColorPickerOpen={() => onColorPickerOpen('contextWords')}
              getDisplayColors={getDisplayColors}
            />

            {/* Show Context Words Toggle */}
            <View style={styles.settingSection}>
              <View style={styles.toggleContainer}>
                <Text style={styles.settingLabel}>Show Previous/Next Words</Text>
                <Switch
                  value={settings.showContextWords}
                  onValueChange={(value) => onSettingsChange({ ...settings, showContextWords: value })}
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
                  onValueChange={(value) => onSettingsChange({ ...settings, contextWordsSpacing: Math.round(value) })}
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
                onValueChange={(value) => onSettingsChange({ ...settings, fontSize: Math.round(value) })}
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
                onPress={onFontPickerOpen}
              >
                <Text style={styles.fontPickerButtonText}>{settings.fontFamily}</Text>
                <Text style={styles.fontPickerButtonArrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: '#333' }]}
            onPress={onClose}
          >
            <Text style={styles.modalButtonTextWhite}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
