import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ViewMode, Settings } from '../types';
import { styles } from '../styles';

interface NavigationControlsProps {
  viewMode: ViewMode;
  settings: Settings;
  isPlaying: boolean;
  onChapterMenuOpen: () => void;
  onPreviousChapter: () => void;
  onPrevious: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onNextChapter: () => void;
  onReset: () => void;
  onSettingsOpen: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onTooltip: (tooltip: { text: string; position: number } | null) => void;
}

export function NavigationControls({
  viewMode,
  settings,
  isPlaying,
  onChapterMenuOpen,
  onPreviousChapter,
  onPrevious,
  onPlayPause,
  onNext,
  onNextChapter,
  onReset,
  onSettingsOpen,
  onViewModeChange,
  onTooltip,
}: NavigationControlsProps) {
  // Button positions (approximate, based on button width + gap)
  // Adjusted to better align with actual button positions
  const buttonSpacing = 60;
  const startOffset = 50; // Offset from left edge
  const getButtonPosition = (index: number) => startOffset + (index * buttonSpacing);

  return (
    <View style={styles.controls}>
      <TouchableOpacity
        style={styles.button}
        onPress={onChapterMenuOpen}
        onPressIn={() => onTooltip({ text: 'Select chapter', position: getButtonPosition(0) })}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => onTooltip({ text: 'Select chapter', position: getButtonPosition(0) })}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={styles.buttonText}>📖</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={onPreviousChapter}
        onPressIn={() => onTooltip({ text: 'Previous chapter', position: getButtonPosition(1) })}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => onTooltip({ text: 'Previous chapter', position: getButtonPosition(1) })}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={styles.buttonText}>⏮</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={onPrevious}
        onPressIn={() => {
          const text = viewMode === 'speed' ? 'Previous word' : viewMode === 'paragraph' ? 'Previous paragraph' : 'Previous page';
          onTooltip({ text, position: getButtonPosition(2) });
        }}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => {
          const text = viewMode === 'speed' ? 'Previous word' : viewMode === 'paragraph' ? 'Previous paragraph' : 'Previous page';
          onTooltip({ text, position: getButtonPosition(2) });
        }}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={styles.buttonText}>{'<'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, viewMode !== 'speed' && styles.buttonDisabled]}
        onPress={() => {
          if (viewMode === 'speed') {
            onPlayPause();
          } else {
            onTooltip({ text: 'Speed reading controls available in Speed view', position: getButtonPosition(3) });
            setTimeout(() => onTooltip(null), 2000);
          }
        }}
        onPressIn={() => {
          if (viewMode === 'speed') {
            onTooltip({ text: isPlaying ? 'Pause' : 'Play', position: getButtonPosition(3) });
          }
        }}
        onPressOut={() => {
          if (viewMode === 'speed') {
            onTooltip(null);
          }
        }}
        onMouseEnter={() => {
          if (viewMode === 'speed') {
            onTooltip({ text: isPlaying ? 'Pause' : 'Play', position: getButtonPosition(3) });
          }
        }}
        onMouseLeave={() => {
          if (viewMode === 'speed') {
            onTooltip(null);
          }
        }}
      >
        <Text style={[styles.buttonText, viewMode !== 'speed' && styles.buttonTextDisabled]}>
          {isPlaying ? '⏸' : '▶'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={onNext}
        onPressIn={() => {
          const text = viewMode === 'speed' ? 'Next word' : viewMode === 'paragraph' ? 'Next paragraph' : 'Next page';
          onTooltip({ text, position: getButtonPosition(4) });
        }}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => {
          const text = viewMode === 'speed' ? 'Next word' : viewMode === 'paragraph' ? 'Next paragraph' : 'Next page';
          onTooltip({ text, position: getButtonPosition(4) });
        }}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={styles.buttonText}>{'>'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={onNextChapter}
        onPressIn={() => onTooltip({ text: 'Next chapter', position: getButtonPosition(5) })}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => onTooltip({ text: 'Next chapter', position: getButtonPosition(5) })}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={styles.buttonText}>⏭</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={onReset}
        onPressIn={() => onTooltip({ text: 'Reset to beginning', position: getButtonPosition(6) })}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => onTooltip({ text: 'Reset to beginning', position: getButtonPosition(6) })}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={styles.buttonText}>↻</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={onSettingsOpen}
        onPressIn={() => onTooltip({ text: 'Settings', position: getButtonPosition(7) })}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => onTooltip({ text: 'Settings', position: getButtonPosition(7) })}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={styles.buttonText}>⚙</Text>
      </TouchableOpacity>

      {/* View Mode Buttons */}
      <TouchableOpacity
        style={[styles.button, styles.viewModeButton, viewMode === 'speed' && styles.viewModeButtonActive]}
        onPress={() => onViewModeChange('speed')}
        onPressIn={() => onTooltip({ text: 'Speed reading', position: getButtonPosition(8) })}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => onTooltip({ text: 'Speed reading', position: getButtonPosition(8) })}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={[styles.buttonText, viewMode === 'speed' && { color: settings.accentColor }]}>S</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.viewModeButton, viewMode === 'paragraph' && styles.viewModeButtonActive]}
        onPress={() => onViewModeChange('paragraph')}
        onPressIn={() => onTooltip({ text: 'Paragraph view', position: getButtonPosition(9) })}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => onTooltip({ text: 'Paragraph view', position: getButtonPosition(9) })}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={[styles.buttonText, viewMode === 'paragraph' && { color: settings.accentColor }]}>P</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.viewModeButton, viewMode === 'page' && styles.viewModeButtonActive]}
        onPress={() => onViewModeChange('page')}
        onPressIn={() => onTooltip({ text: 'Page view', position: getButtonPosition(10) })}
        onPressOut={() => onTooltip(null)}
        onMouseEnter={() => onTooltip({ text: 'Page view', position: getButtonPosition(10) })}
        onMouseLeave={() => onTooltip(null)}
      >
        <Text style={[styles.buttonText, viewMode === 'page' && { color: settings.accentColor }]}>Pg</Text>
      </TouchableOpacity>
    </View>
  );
}
