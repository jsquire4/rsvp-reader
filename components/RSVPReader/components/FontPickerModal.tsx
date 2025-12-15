import React from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Settings } from '../types';
import { styles } from '../styles';
import { FONT_FAMILIES } from '../constants';

interface FontPickerModalProps {
  visible: boolean;
  onClose: () => void;
  settings: Settings;
  onFontSelect: (fontFamily: string) => void;
}

export function FontPickerModal({
  visible,
  onClose,
  settings,
  onFontSelect,
}: FontPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Font Family</Text>
          <FlatList
            data={FONT_FAMILIES}
            keyExtractor={(item) => item}
            style={styles.fontList}
            contentContainerStyle={styles.fontListContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.fontMenuItem,
                  settings.fontFamily === item && styles.fontMenuItemSelected,
                ]}
                onPress={() => {
                  onFontSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.fontMenuItemText}>{item}</Text>
                {settings.fontFamily === item && (
                  <Text style={styles.fontMenuCheck}>✓</Text>
                )}
              </TouchableOpacity>
            )}
          />
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
