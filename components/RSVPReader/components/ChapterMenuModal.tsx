import React from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Chapter } from '../../../utils/epubParser';
import { styles } from '../styles';
import { formatChapterTitle } from '../utils/wordUtils';

interface ChapterMenuModalProps {
  visible: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterIndex: number;
  onChapterSelect: (chapterIndex: number) => void;
}

export function ChapterMenuModal({
  visible,
  onClose,
  chapters,
  currentChapterIndex,
  onChapterSelect,
}: ChapterMenuModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Chapter</Text>
          <FlatList
            data={chapters}
            keyExtractor={(item, index) => index.toString()}
            style={styles.chapterList}
            contentContainerStyle={styles.chapterListContent}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.chapterMenuItem,
                  index === currentChapterIndex && styles.chapterMenuItemSelected,
                ]}
                onPress={() => {
                  onChapterSelect(index);
                  onClose();
                }}
              >
                <Text style={styles.chapterMenuItemText}>
                  {formatChapterTitle(item.title)}
                </Text>
                {index === currentChapterIndex && (
                  <Text style={styles.chapterMenuCheck}>✓</Text>
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
