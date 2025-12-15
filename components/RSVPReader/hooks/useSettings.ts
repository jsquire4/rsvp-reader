import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, RecentColors, ColorType } from '../types';
import { DEFAULT_COMMON_COLORS, DEFAULT_BACKGROUND_COLORS, DEFAULT_TEXT_COLORS } from '../constants';

export const useSettings = (initialWordsPerMinute: number) => {
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    accentColor: '#00ff88',
    fontFamily: 'System',
    fontSize: 48,
    backgroundColor: '#000000',
    textColor: '#ffffff',
    contextWordsColor: '#999999',
    showContextWords: true,
    contextWordsSpacing: 10,
    wordColor: '#ffffff',
    wordsPerMinute: Math.round(initialWordsPerMinute),
  });
  const [recentColors, setRecentColors] = useState<RecentColors>({
    accent: [],
    word: [],
    background: [],
    text: [],
    contextWords: [],
  });

  // Helper function to get display colors (recent + defaults, max 5)
  const getDisplayColors = (type: ColorType): Array<{ value: string; label: string }> => {
    const defaults: Array<{ name: string; value: string }> = 
      type === 'accent' ? DEFAULT_COMMON_COLORS :
      type === 'word' ? DEFAULT_TEXT_COLORS :
      type === 'background' ? DEFAULT_BACKGROUND_COLORS :
      type === 'text' ? DEFAULT_TEXT_COLORS :
      DEFAULT_COMMON_COLORS;
    
    const recent = recentColors[type].map((color: string) => ({ value: color, label: '' }));
    const defaultsWithLabel = defaults.map((color) => ({ value: color.value, label: color.name }));
    const combined = [...recent, ...defaultsWithLabel];
    
    // Remove duplicates and limit to 5
    const unique = combined.filter((color, index, self) => 
      index === self.findIndex(c => c.value === color.value)
    ).slice(0, 5);
    
    return unique;
  };

  // Helper function to add color to recent colors (only if it's a new color)
  const addToRecentColors = (type: ColorType, color: string) => {
    setRecentColors(prev => {
      const current = prev[type];
      // If color already exists, don't reorder - just return current state
      if (current.includes(color)) {
        return prev;
      }
      // Add new color to front and drop oldest if over limit
      const updated = [color, ...current].slice(0, 5); // Keep max 5
      return { ...prev, [type]: updated };
    });
  };

  // Load saved settings and recent colors on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem('rsvp_reader_settings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          setSettings((prevSettings) => ({
            ...prevSettings,
            ...parsedSettings,
            // Ensure wordsPerMinute is set, defaulting to initialWordsPerMinute if not in saved settings
            wordsPerMinute: parsedSettings.wordsPerMinute ?? prevSettings.wordsPerMinute,
          }));
        }
        
        const savedRecentColors = await AsyncStorage.getItem('rsvp_recent_colors');
        if (savedRecentColors) {
          const parsedColors = JSON.parse(savedRecentColors);
          setRecentColors(parsedColors);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    
    loadSettings();
  }, []);

  // Save settings whenever they change (but not during initial load)
  useEffect(() => {
    if (isLoadingSettings) return;
    
    const saveSettings = async () => {
      try {
        await AsyncStorage.setItem('rsvp_reader_settings', JSON.stringify(settings));
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    };
    
    saveSettings();
  }, [settings, isLoadingSettings]);

  // Save recent colors whenever they change
  useEffect(() => {
    if (isLoadingSettings) return;
    
    const saveRecentColors = async () => {
      try {
        await AsyncStorage.setItem('rsvp_recent_colors', JSON.stringify(recentColors));
      } catch (error) {
        console.error('Error saving recent colors:', error);
      }
    };
    
    saveRecentColors();
  }, [recentColors, isLoadingSettings]);

  return {
    settings,
    setSettings,
    recentColors,
    isLoadingSettings,
    getDisplayColors,
    addToRecentColors,
  };
};
