import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { styles } from '../styles';

interface WordSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  currentWordIndex: number;
  totalWords: number;
  wordsBeforeChapter: number;
  allWords: string[];
  onConfirm: (wordIndex: number) => void;
}

export function WordSelectionModal({
  visible,
  onClose,
  currentWordIndex,
  totalWords,
  wordsBeforeChapter,
  allWords,
  onConfirm,
}: WordSelectionModalProps) {
  const handleParagraphStart = () => {
    let paraStart = wordsBeforeChapter;
    for (let i = currentWordIndex; i >= wordsBeforeChapter; i--) {
      const word = allWords[i];
      if (word.match(/[.!?]$/)) {
        paraStart = i + 1;
        break;
      }
      if (i === wordsBeforeChapter) paraStart = i;
    }
    onConfirm(paraStart);
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
          <Text style={styles.modalTitle}>Select Starting Word</Text>
          <Text style={styles.modalSubtitle}>
            Choose where to start speed reading from
          </Text>
          <View style={styles.wordSelectionContainer}>
            <Text style={styles.wordSelectionText}>
              Current position: Word {currentWordIndex + 1} of {totalWords}
            </Text>
            <TouchableOpacity
              style={styles.wordSelectionButton}
              onPress={() => onConfirm(currentWordIndex)}
            >
              <Text style={styles.wordSelectionButtonText}>Start from current position</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.wordSelectionButton}
              onPress={handleParagraphStart}
            >
              <Text style={styles.wordSelectionButtonText}>Start from paragraph beginning</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.wordSelectionButton}
              onPress={() => onConfirm(wordsBeforeChapter)}
            >
              <Text style={styles.wordSelectionButtonText}>Start from chapter beginning</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: '#333' }]}
            onPress={onClose}
          >
            <Text style={styles.modalButtonTextWhite}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
