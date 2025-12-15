import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Settings } from '../types';
import { styles } from '../styles';

interface RSVPPromptProps {
  settings: Settings;
  onStartRSVP: () => void;
}

export function RSVPPrompt({ settings, onStartRSVP }: RSVPPromptProps) {
  return (
    <View style={[styles.rsvpPrompt, { borderColor: settings.accentColor }]}>
      <TouchableOpacity
        style={[styles.rsvpPromptButton, { backgroundColor: settings.accentColor }]}
        onPress={onStartRSVP}
      >
        <Text style={styles.rsvpPromptButtonText}>Start RSVP here</Text>
      </TouchableOpacity>
    </View>
  );
}
