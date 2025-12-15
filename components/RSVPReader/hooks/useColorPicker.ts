import { useState, useEffect } from 'react';
import { ColorType, Settings } from '../types';
import { hexToRgb, rgbToHex } from '../utils/colorUtils';

export const useColorPicker = (settings: Settings) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerType, setColorPickerType] = useState<ColorType | null>(null);
  const [colorPickerCurrentColor, setColorPickerCurrentColor] = useState('#000000');
  const [colorPickerRgb, setColorPickerRgb] = useState({ r: 0, g: 0, b: 0 });

  // Handler to open color picker
  const handleOpenColorPicker = (type: ColorType) => {
    const currentColor = 
      type === 'accent' ? settings.accentColor :
      type === 'word' ? settings.wordColor :
      type === 'background' ? settings.backgroundColor :
      type === 'text' ? settings.textColor :
      settings.contextWordsColor;
    
    setColorPickerCurrentColor(currentColor);
    setColorPickerRgb(hexToRgb(currentColor));
    setColorPickerType(type);
    setShowColorPicker(true);
  };

  // Update hex color when RGB changes
  useEffect(() => {
    if (showColorPicker) {
      const hex = rgbToHex(colorPickerRgb.r, colorPickerRgb.g, colorPickerRgb.b);
      setColorPickerCurrentColor(hex);
    }
  }, [colorPickerRgb, showColorPicker]);

  return {
    showColorPicker,
    setShowColorPicker,
    colorPickerType,
    setColorPickerType,
    colorPickerCurrentColor,
    colorPickerRgb,
    setColorPickerRgb,
    handleOpenColorPicker,
  };
};
