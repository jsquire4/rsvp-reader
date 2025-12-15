import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import Slider from '@react-native-community/slider';
import { styles } from '../styles';
import { hexToRgb } from '../utils/colorUtils';

interface ColorPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: () => void;
  currentColor: string;
  rgb: { r: number; g: number; b: number };
  onRgbChange: (rgb: { r: number; g: number; b: number }) => void;
}

const QUICK_COLORS = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A'];

export function ColorPickerModal({
  visible,
  onClose,
  onSelect,
  currentColor,
  rgb,
  onRgbChange,
}: ColorPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.colorPickerModalContent}
        >
          <Text style={styles.modalTitle}>Select Color</Text>
          
          <View style={[styles.colorPreview, { backgroundColor: currentColor }]}>
            <Text style={styles.colorPreviewText}>{currentColor}</Text>
          </View>
          
          <View style={styles.colorPickerSliders}>
            <View style={styles.colorSliderRow}>
              <Text style={styles.colorSliderLabel}>R: {Math.round(rgb.r)}</Text>
              <Slider
                style={styles.colorSlider}
                minimumValue={0}
                maximumValue={255}
                value={rgb.r}
                onValueChange={(value) => onRgbChange({ ...rgb, r: value })}
                minimumTrackTintColor="#f44336"
                maximumTrackTintColor="#333"
                thumbTintColor="#f44336"
                step={1}
              />
            </View>
            <View style={styles.colorSliderRow}>
              <Text style={styles.colorSliderLabel}>G: {Math.round(rgb.g)}</Text>
              <Slider
                style={styles.colorSlider}
                minimumValue={0}
                maximumValue={255}
                value={rgb.g}
                onValueChange={(value) => onRgbChange({ ...rgb, g: value })}
                minimumTrackTintColor="#4caf50"
                maximumTrackTintColor="#333"
                thumbTintColor="#4caf50"
                step={1}
              />
            </View>
            <View style={styles.colorSliderRow}>
              <Text style={styles.colorSliderLabel}>B: {Math.round(rgb.b)}</Text>
              <Slider
                style={styles.colorSlider}
                minimumValue={0}
                maximumValue={255}
                value={rgb.b}
                onValueChange={(value) => onRgbChange({ ...rgb, b: value })}
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
              {QUICK_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.quickColorOption, { backgroundColor: color }]}
                  onPress={() => {
                    onRgbChange(hexToRgb(color));
                  }}
                />
              ))}
            </View>
          </View>
          
          <View style={styles.colorPickerActions}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#333', flex: 1, marginRight: 10 }]}
              onPress={onClose}
            >
              <Text style={styles.modalButtonTextWhite}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#00ff88', flex: 1 }]}
              onPress={onSelect}
            >
              <Text style={styles.modalButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
