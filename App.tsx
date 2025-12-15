import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import BookSelector from './components/BookSelector';
import RSVPReader from './components/RSVPReader';
import { parseEpub, Chapter } from './utils/epubParser';

export default function App() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentBookUri, setCurrentBookUri] = useState<string | null>(null);

  const handleBookSelect = async (bookUri: string) => {
    setLoading(true);
    setError(null);
    setChapters([]);
    setCurrentBookUri(bookUri);

    try {
      const parsedChapters = await parseEpub(bookUri);
      setChapters(parsedChapters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load book');
      console.error('Error loading book:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setChapters([]);
    setError(null);
    setCurrentBookUri(null);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading book...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (chapters.length > 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.buttonText}>← Back</Text>
        </TouchableOpacity>
        <RSVPReader chapters={chapters} initialWordsPerMinute={250} bookUri={currentBookUri || undefined} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <BookSelector onBookSelect={handleBookSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});
