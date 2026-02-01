import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import { BookMetadata, extractBookMetadata } from '../utils/epubParser';
import { createBookEntry, formatBookDisplayName } from '../utils/bookMetadata';
import {
  BookEntry,
  loadUploadedBooksNative,
  saveUploadedBookNative,
  loadUploadedBookWeb,
} from '../utils/fileSystemOperations';

interface BookSelectorProps {
  onBookSelect: (bookUri: string) => void;
}

// Define books available in assets/books directory
const BOOK_ASSETS = [
  // Add more books here as you add them to assets/books/
  require('../assets/books/steinbeck-of-mice-and-men.epub'),
];

export default function BookSelector({ onBookSelect }: BookSelectorProps) {
  const [books, setBooks] = useState<BookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [webBooks, setWebBooks] = useState<Array<BookEntry & { blobUrl: string }>>([]);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      console.log('Starting to load books, BOOK_ASSETS count:', BOOK_ASSETS.length);
      
      // Load assets and get their local URIs
      const bookAssets = await Promise.all(
        BOOK_ASSETS.map(async (assetModule, index) => {
          try {
            console.log(`Loading book ${index}...`);
            const asset = Asset.fromModule(assetModule);
            console.log(`Asset created, downloading...`);
            await asset.downloadAsync();
            console.log(`Downloaded. localUri: ${asset.localUri}, uri: ${asset.uri}`);
            
            const bookUri = asset.localUri || asset.uri;
            if (!bookUri) {
              console.error(`No URI found for asset ${index}`);
              throw new Error('No URI found for asset');
            }
            console.log(`Book URI: ${bookUri}`);
            
            // Extract metadata from EPUB - wrap in try-catch so it doesn't break loading
            let metadata: BookMetadata = {};
            try {
              metadata = await extractBookMetadata(bookUri);
            } catch (metaError) {
              console.warn('Metadata extraction failed, using filename:', metaError);
            }
            
            // Get filename for fallback
            let fileName = 'Unknown';
            if (asset.uri) {
              const uriParts = asset.uri.split('/');
              fileName = uriParts[uriParts.length - 1] || 'Unknown';
            }
            
            console.log(`Successfully loaded book: ${formatBookDisplayName(metadata, fileName)}`);
            return createBookEntry(bookUri, metadata, fileName);
          } catch (error) {
            console.error(`Error loading asset book ${index}:`, error);
            // Return a basic entry even if loading fails
            try {
              const asset = Asset.fromModule(assetModule);
              const fallbackUri = asset.uri || '';
              const fileName = fallbackUri.split('/').pop() || 'Unknown Book';
              
              console.log(`Created fallback entry: ${formatBookDisplayName({}, fileName)}`);
              return createBookEntry(fallbackUri, {}, fileName);
            } catch (fallbackError) {
              console.error('Fallback also failed:', fallbackError);
              // Last resort - return a basic entry
              return {
                uri: '',
                name: `Book ${index + 1}`,
                metadata: {},
              };
            }
          }
        })
      );
      
      console.log(`Loaded ${bookAssets.length} asset books`);
      
      // Set asset books immediately so they show up even if uploaded books fail
      setBooks(bookAssets);
      
      // Start with asset books
      const allBooks = [...bookAssets];
      
      // Add web books (stored in memory)
      if (Platform.OS === 'web') {
        allBooks.push(...webBooks);
        console.log(`Added ${webBooks.length} web books`);
      }
      
      // Load uploaded books from document directory (don't let errors break asset books)
      // Skip on web platform as file system APIs are not available
      if (Platform.OS !== 'web') {
        try {
          const uploadedBooks = await loadUploadedBooksNative();
          allBooks.push(...uploadedBooks);
          console.log(`Loaded ${uploadedBooks.length} uploaded books`);
        } catch (error) {
          console.error('Error loading uploaded books:', error);
          // Continue with just asset books - don't let this break everything
        }
      }
      
      console.log(`Total books loaded: ${allBooks.length}`);
      setBooks(allBooks);
    } catch (error) {
      console.error('Error loading books:', error);
      // Even if there's an error, try to set at least empty array
      // The error might be in asset loading, so we can't assume bookAssets exists
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBook = async () => {
    console.log('handleUploadBook called');
    console.log('Platform:', Platform.OS);

    try {
      console.log('Opening document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/epub+zip',
        copyToCacheDirectory: Platform.OS !== 'web', // Only copy to cache on native
      });

      console.log('Document picker result:', result);

      if (result.canceled) {
        console.log('User canceled file picker');
        return;
      }

      const file = result.assets[0];
      console.log('File selected:', file);
      
      if (!file.uri) {
        Alert.alert('Error', 'No file selected');
        return;
      }

      console.log('Source file URI:', file.uri);
      console.log('File name:', file.name);

      const fileName = file.name || `book_${Date.now()}.epub`;

      if (Platform.OS === 'web') {
        // On web, create a blob URL and store in memory
        console.log('Processing file for web...');
        
        const bookEntry = await loadUploadedBookWeb(file.uri, fileName);
        
        // Extract blobUrl from the entry URI (it's the blob URL)
        const blobUrl = bookEntry.uri;
        
        // Add to web books
        const newBook = {
          ...bookEntry,
          blobUrl: blobUrl,
        };
        
        // Update web books state
        const updatedWebBooks = [...webBooks, newBook];
        setWebBooks(updatedWebBooks);
        
        // Immediately update the books list with the new book
        setBooks(prev => [...prev, bookEntry]);
        
        Alert.alert('Success', 'Book uploaded successfully!');
      } else {
        // Native platform - save to file system
        console.log('Saving book to file system...');
        
        try {
          await saveUploadedBookNative(file.uri, fileName);
          console.log('Book saved successfully!');
          
          Alert.alert('Success', 'Book uploaded successfully!');
          
          // Reload books
          console.log('Reloading books...');
          await loadBooks();
        } catch (error) {
          if (error instanceof Error && error.message === 'A book with this name already exists') {
            Alert.alert('Error', 'A book with this name already exists');
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Error uploading book:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to upload book: ${errorMessage}`);
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
      <TouchableOpacity style={styles.uploadButton} onPress={handleUploadBook}>
        <Text style={styles.uploadButtonText}>📤 Upload EPUB File</Text>
      </TouchableOpacity>
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
  uploadButton: {
    backgroundColor: '#00ff88',
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});

