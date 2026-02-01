import React from 'react';
import { View, Text } from 'react-native';
import { Chapter } from '../../../utils/epubParser';
import { formatChapterTitle } from '../utils/wordUtils';
import { styles } from '../styles';

interface ChapterHeaderProps {
  chapter: Chapter | undefined;
}

export function ChapterHeader({ chapter }: ChapterHeaderProps) {
  if (!chapter?.title) return null;

  return (
    <View style={styles.chapterNameContainer}>
      <Text style={styles.chapterName}>{formatChapterTitle(chapter.title)}</Text>
    </View>
  );
}
