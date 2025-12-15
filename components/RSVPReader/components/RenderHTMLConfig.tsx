import React from 'react';
import RenderHTML from 'react-native-render-html';
import { Settings } from '../types';

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
        p: { marginBottom: effectiveFontSize * 0.8, marginTop: effectiveFontSize * 0.4 },
        div: { marginBottom: effectiveFontSize * 0.8 },
        br: { height: effectiveFontSize * 0.5 },
        strong: { fontWeight: 'bold' },
        b: { fontWeight: 'bold' },
        em: { fontStyle: 'italic' },
        i: { fontStyle: 'italic' },
        u: { textDecorationLine: 'underline' },
        h1: { fontSize: effectiveFontSize * 1.5, fontWeight: 'bold', marginBottom: effectiveFontSize },
        h2: { fontSize: effectiveFontSize * 1.3, fontWeight: 'bold', marginBottom: effectiveFontSize * 0.8 },
        h3: { fontSize: effectiveFontSize * 1.1, fontWeight: 'bold', marginBottom: effectiveFontSize * 0.6 },
      }}
    />
  );
}
