import React from 'react';
import RenderHTML from 'react-native-render-html';
import { Settings } from '../types';

// TODO: FONT FAMILY COMPATIBILITY ISSUE
// Some fonts work in paragraph/page view HTML rendering, others don't.
// This may be due to:
// 1. Font availability on the platform (web vs native)
// 2. How react-native-render-html handles font-family names
// 3. System fonts vs custom fonts requiring different handling
// 4. Font names with spaces or special characters
//
// Needs investigation: test various font families and document which work
// Consider adding font validation or fallback chains

interface RenderHTMLConfigProps {
  html: string;
  settings: Settings;
  effectiveFontSize: number;
}

export function RenderHTMLConfig({ html, settings, effectiveFontSize }: RenderHTMLConfigProps) {
  return (
    <RenderHTML
      contentWidth={800}
      source={{ html }}
      baseStyle={{
        color: settings.textColor,
        fontSize: effectiveFontSize,
        fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
        textAlign: 'left',
        lineHeight: effectiveFontSize * 1.5,
      }}
      tagsStyles={{
        // Force user settings on all text elements
        p: {
          marginBottom: effectiveFontSize * 0.8,
          marginTop: effectiveFontSize * 0.4,
          color: settings.textColor,
          fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
        },
        div: {
          marginBottom: effectiveFontSize * 0.8,
          color: settings.textColor,
          fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
        },
        span: {
          color: settings.textColor,
          fontFamily: settings.fontFamily === 'System' ? undefined : settings.fontFamily,
        },
        br: { height: effectiveFontSize * 0.5 },
        strong: { fontWeight: 'bold' },
        b: { fontWeight: 'bold' },
        em: { fontStyle: 'italic' },
        i: { fontStyle: 'italic' },
        u: { textDecorationLine: 'underline' },
        h1: { fontSize: effectiveFontSize * 1.5, fontWeight: 'bold', marginBottom: effectiveFontSize, color: settings.textColor },
        h2: { fontSize: effectiveFontSize * 1.3, fontWeight: 'bold', marginBottom: effectiveFontSize * 0.8, color: settings.textColor },
        h3: { fontSize: effectiveFontSize * 1.1, fontWeight: 'bold', marginBottom: effectiveFontSize * 0.6, color: settings.textColor },
      }}
      // Ignore inline color/size from EPUB but allow font-family through baseStyle
      ignoredStyles={['color', 'font-size']}
      // Force baseStyle to override any inline styles
      enableCSSInlineProcessing={false}
    />
  );
}
