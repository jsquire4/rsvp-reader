import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image } from 'react-native';
import { Asset } from 'expo-asset';
import { extractBookMetadata, BookMetadata } from '../utils/epubParser';

interface BookSelectorProps {
  onBookSelect: (bookUri: string) => void;
}

// Define books available in assets/books directory
const BOOK_ASSETS = [
  require('../assets/books/steinbeck-of-mice-and-men.epub'),
  // Add more books here as you add them to assets/books/
];

export default function BookSelector({ onBookSelect }: BookSelectorProps) {
  const [books, setBooks] = useState<Array<{ uri: string; name: string; metadata: BookMetadata }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      // Load assets and get their local URIs
      const bookAssets = await Promise.all(
        BOOK_ASSETS.map(async (assetModule) => {
          const asset = Asset.fromModule(assetModule);
          await asset.downloadAsync();
          
          const bookUri = asset.localUri || asset.uri;
          
          // Extract metadata from EPUB
          const metadata = await extractBookMetadata(bookUri);
          
          // Use metadata title/author if available, otherwise use filename
          let displayName = metadata.title || 'Unknown';
          if (metadata.author) {
            displayName = `${displayName}\nby ${metadata.author}`;
          }
          
          // Fallback to filename if no metadata
          if (!metadata.title) {
            let fileName = 'Unknown';
            if (asset.uri) {
              const uriParts = asset.uri.split('/');
              fileName = uriParts[uriParts.length - 1] || 'Unknown';
            }
            
            displayName = fileName
              .replace('.epub', '')
              .replace(/-/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
          
          return {
            uri: bookUri,
            name: displayName,
            metadata,
          };
        })
      );
      
      setBooks(bookAssets);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading books...</Text>
      </View>
    );
  }

  if (books.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>RSVP Reader</Text>
        <Text style={styles.emptyText}>
          No ebooks found.{'\n'}
          Add .epub files to assets/books/ and update BOOK_ASSETS in BookSelector.tsx
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadBooks}>
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a Book</Text>
      <FlatList
        data={books}
        keyExtractor={(item) => item.uri}
        renderItem={({ item }) => {
          // Cover image URI is relative to EPUB, so we can't directly load it
          // For now, show placeholder or skip cover until we implement EPUB image extraction
          return (
            <TouchableOpacity
              style={styles.bookItem}
              onPress={() => onBookSelect(item.uri)}
            >
              <View style={styles.bookCoverPlaceholder}>
                <Text style={styles.bookCoverText}>📖</Text>
              </View>
              <Text style={styles.bookTitle}>{item.metadata.title || item.name.split('\n')[0]}</Text>
              {item.metadata.author && (
                <Text style={styles.bookAuthor}>by {item.metadata.author}</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity style={styles.refreshButton} onPress={loadBooks}>
        <Text style={styles.buttonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    paddingTop: 60,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
    textAlign: 'center',
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 40,
    lineHeight: 24,
  },
  bookItem: {
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  bookCoverPlaceholder: {
    width: 150,
    height: 200,
    marginBottom: 15,
    borderRadius: 4,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookCoverText: {
    fontSize: 60,
  },
  bookCover: {
    width: 150,
    height: 200,
    marginBottom: 15,
    borderRadius: 4,
  },
  bookTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  bookAuthor: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#555',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
  },
});

