import { Chapter } from '../../utils/epubParser';

export interface RSVPReaderProps {
  chapters: Chapter[];
  initialWordsPerMinute?: number;
  onComplete?: () => void;
  bookUri?: string; // Book URI for saving progress
}

export interface Settings {
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  backgroundColor: string;
  textColor: string;
  contextWordsColor: string;
  showContextWords: boolean;
  contextWordsSpacing: number;
  wordColor: string;
  wordsPerMinute: number;
}

export type ViewMode = 'speed' | 'paragraph' | 'page';

export type ColorType = 'accent' | 'word' | 'background' | 'text' | 'contextWords';

export interface RecentColors {
  accent: string[];
  word: string[];
  background: string[];
  text: string[];
  contextWords: string[];
}
