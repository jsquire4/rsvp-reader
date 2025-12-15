import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
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
  const [webBooks, setWebBooks] = useState<Array<{ uri: string; name: string; metadata: BookMetadata; blobUrl: string }>>([]);

  useEffect(() => {
    loadBooks();
  }, []);

  const getBooksDirectory = () => {
    return FileSystem.documentDirectory + 'books/';
  };

  const ensureBooksDirectory = async () => {
    // File system APIs are not available on web
    if (Platform.OS === 'web') {
      return;
    }
    const booksDir = getBooksDirectory();
    const dirInfo = await FileSystem.getInfoAsync(booksDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(booksDir, { intermediates: true });
    }
  };

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
            
            // Use metadata title/author if available, otherwise use filename
            let displayName = metadata.title || fileName.replace('.epub', '');
            if (metadata.author && metadata.title) {
              displayName = `${displayName}\nby ${metadata.author}`;
            }
            
            // Format filename if no metadata title
            if (!metadata.title) {
              displayName = fileName
                .replace('.epub', '')
                .replace(/-/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }
            
            console.log(`Successfully loaded book: ${displayName}`);
            return {
              uri: bookUri,
              name: displayName,
              metadata: metadata || {},
            };
          } catch (error) {
            console.error(`Error loading asset book ${index}:`, error);
            // Return a basic entry even if loading fails
            try {
              const asset = Asset.fromModule(assetModule);
              const fallbackUri = asset.uri || '';
              const fileName = fallbackUri.split('/').pop() || 'Unknown Book';
              const displayName = fileName
                .replace('.epub', '')
                .replace(/-/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              
              console.log(`Created fallback entry: ${displayName}`);
              return {
                uri: fallbackUri,
                name: displayName,
                metadata: {},
              };
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
          await ensureBooksDirectory();
          const booksDir = getBooksDirectory();
          const dirInfo = await FileSystem.getInfoAsync(booksDir);
          
          if (dirInfo.exists) {
          try {
            const files = await FileSystem.readDirectoryAsync(booksDir);
            const epubFiles = files.filter((file: string) => file.toLowerCase().endsWith('.epub'));
            
            if (epubFiles.length > 0) {
              const uploadedBooks = await Promise.all(
                epubFiles.map(async (fileName: string) => {
                  const fileUri = `${booksDir}${fileName}`;
                  try {
                    let metadata: BookMetadata = {};
                    try {
                      metadata = await extractBookMetadata(fileUri);
                    } catch (metaError) {
                      console.warn(`Metadata extraction failed for ${fileName}:`, metaError);
                    }
                    
                    let displayName = metadata.title || fileName.replace('.epub', '');
                    if (metadata.author && metadata.title) {
                      displayName = `${displayName}\nby ${metadata.author}`;
                    }
                    
                    if (!metadata.title) {
                      displayName = fileName
                        .replace('.epub', '')
                        .replace(/-/g, ' ')
                        .split(' ')
                        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    }
                    
                    return {
                      uri: fileUri,
                      name: displayName,
                      metadata: metadata || {},
                    };
                  } catch (error) {
                    console.error(`Error loading uploaded book ${fileName}:`, error);
                    return {
                      uri: fileUri,
                      name: fileName.replace('.epub', '').replace(/-/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                      metadata: {},
                    };
                  }
                })
              );
              
              allBooks.push(...uploadedBooks);
              console.log(`Loaded ${uploadedBooks.length} uploaded books`);
            }
          } catch (error) {
            console.error('Error reading uploaded books directory:', error);
            // Continue with just asset books
          }
          }
        } catch (error) {
          console.error('Error setting up books directory:', error);
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

      if (Platform.OS === 'web') {
        // On web, create a blob URL and store in memory
        console.log('Processing file for web...');
        
        // Read file as array buffer
        const response = await fetch(file.uri);
        const arrayBuffer = await response.arrayBuffer();
        
        // Create blob URL
        const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
        const blobUrl = URL.createObjectURL(blob);
        
        console.log('Blob URL created:', blobUrl);
        
        // Extract metadata
        let metadata: BookMetadata = {};
        try {
          metadata = await extractBookMetadata(blobUrl);
          console.log('Metadata extracted:', metadata);
        } catch (metaError) {
          console.warn('Metadata extraction failed:', metaError);
        }
        
        // Create display name
        const fileName = file.name || `book_${Date.now()}.epub`;
        let displayName = metadata.title || fileName.replace('.epub', '');
        if (metadata.author && metadata.title) {
          displayName = `${displayName}\nby ${metadata.author}`;
        }
        
        if (!metadata.title) {
          displayName = fileName
            .replace('.epub', '')
            .replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
        
        // Add to web books
        const newBook = {
          uri: blobUrl,
          name: displayName,
          metadata: metadata || {},
          blobUrl: blobUrl,
        };
        
        // Update web books state
        const updatedWebBooks = [...webBooks, newBook];
        setWebBooks(updatedWebBooks);
        
        // Immediately update the books list with the new book
        const bookToAdd = {
          uri: newBook.uri,
          name: newBook.name,
          metadata: newBook.metadata,
        };
        
        // Update books list directly to show the new book immediately
        setBooks(prev => [...prev, bookToAdd]);
        
        Alert.alert('Success', 'Book uploaded successfully!');
      } else {
        // Native platform - save to file system
        // Ensure books directory exists
        console.log('Ensuring books directory exists...');
        await ensureBooksDirectory();
        
        // Get filename from URI
        const fileName = file.name || `book_${Date.now()}.epub`;
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        const booksDir = getBooksDirectory();
        const destinationUri = `${booksDir}${sanitizedFileName}`;
        
        console.log('Destination file URI:', destinationUri);

        // Check if file already exists
        const fileInfo = await FileSystem.getInfoAsync(destinationUri);
        if (fileInfo.exists) {
          Alert.alert('Error', 'A book with this name already exists');
          return;
        }

        // Copy file to books directory
        console.log('Reading source file...');
        const fileData = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
        console.log(`File data read, length: ${fileData.length} characters`);
        
        console.log('Writing file to destination...');
        await FileSystem.writeAsStringAsync(destinationUri, fileData, { encoding: 'base64' });
        console.log('File written successfully!');
        
        // Verify file was written
        const verifyInfo = await FileSystem.getInfoAsync(destinationUri);
        if (!verifyInfo.exists) {
          throw new Error('File was not written successfully');
        }
        console.log('File verified, exists:', verifyInfo.exists);

        Alert.alert('Success', 'Book uploaded successfully!');
        
        // Reload books
        console.log('Reloading books...');
        await loadBooks();
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

