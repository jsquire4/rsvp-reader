import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { BookMetadata } from './epubParser';
import { createBookEntry } from './bookMetadata';
import { extractBookMetadata } from './epubParser';

/**
 * Standard book entry type used throughout the application
 */
export interface BookEntry {
  uri: string;
  name: string;
  metadata: BookMetadata;
}

/**
 * Returns the books directory path for native platforms
 * @returns Books directory path string
 */
export function getBooksDirectory(): string {
  return FileSystem.documentDirectory + 'books/';
}

/**
 * Ensures the books directory exists on native platforms.
 * No-op on web platform as file system APIs are not available.
 * @returns Promise that resolves when directory is ensured
 */
export async function ensureBooksDirectory(): Promise<void> {
  // File system APIs are not available on web
  if (Platform.OS === 'web') {
    return;
  }
  const booksDir = getBooksDirectory();
  const dirInfo = await FileSystem.getInfoAsync(booksDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(booksDir, { intermediates: true });
  }
}

/**
 * Loads uploaded books from the native file system.
 * Reads EPUB files from the books directory and extracts metadata.
 * @returns Promise that resolves to an array of book entries
 */
export async function loadUploadedBooksNative(): Promise<BookEntry[]> {
  await ensureBooksDirectory();
  const booksDir = getBooksDirectory();
  const dirInfo = await FileSystem.getInfoAsync(booksDir);
  
  if (!dirInfo.exists) {
    return [];
  }
  
  try {
    const files = await FileSystem.readDirectoryAsync(booksDir);
    const epubFiles = files.filter((file: string) => file.toLowerCase().endsWith('.epub'));
    
    if (epubFiles.length === 0) {
      return [];
    }
    
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
          
          return createBookEntry(fileUri, metadata, fileName);
        } catch (error) {
          console.error(`Error loading uploaded book ${fileName}:`, error);
          return createBookEntry(fileUri, {}, fileName);
        }
      })
    );
    
    return uploadedBooks;
  } catch (error) {
    console.error('Error reading uploaded books directory:', error);
    return [];
  }
}

/**
 * Saves an uploaded book to the native file system.
 * Copies the file to the books directory with sanitized filename.
 * @param fileUri - Source file URI
 * @param fileName - Original filename
 * @returns Promise that resolves to the destination file URI
 * @throws Error if file already exists or save operation fails
 */
export async function saveUploadedBookNative(fileUri: string, fileName: string): Promise<string> {
  await ensureBooksDirectory();
  
  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const booksDir = getBooksDirectory();
  const destinationUri = `${booksDir}${sanitizedFileName}`;
  
  // Check if file already exists
  const fileInfo = await FileSystem.getInfoAsync(destinationUri);
  if (fileInfo.exists) {
    throw new Error('A book with this name already exists');
  }
  
  // Read source file
  const fileData = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
  
  // Write to destination
  await FileSystem.writeAsStringAsync(destinationUri, fileData, { encoding: 'base64' });
  
  // Verify file was written
  const verifyInfo = await FileSystem.getInfoAsync(destinationUri);
  if (!verifyInfo.exists) {
    throw new Error('File was not written successfully');
  }
  
  return destinationUri;
}

/**
 * Loads an uploaded book for web platform by creating a blob URL.
 * Reads the file, creates a blob, and extracts metadata.
 * @param fileUri - Source file URI (from document picker)
 * @param fileName - Original filename
 * @returns Promise that resolves to a book entry with blob URL
 */
export async function loadUploadedBookWeb(fileUri: string, fileName: string): Promise<BookEntry> {
  // Read file as array buffer
  const response = await fetch(fileUri);
  const arrayBuffer = await response.arrayBuffer();
  
  // Create blob URL
  const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
  const blobUrl = URL.createObjectURL(blob);
  
  // Extract metadata
  let metadata: BookMetadata = {};
  try {
    metadata = await extractBookMetadata(blobUrl);
  } catch (metaError) {
    console.warn('Metadata extraction failed:', metaError);
  }
  
  // Create book entry
  return createBookEntry(blobUrl, metadata, fileName);
}
