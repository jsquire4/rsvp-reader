# RSVP Reader

An Expo React Native app for reading ebooks using Rapid Serial Visual Presentation (RSVP) - displaying content one word at a time.

## Features

- 📚 EPUB ebook support
- ⚡ Word-by-word RSVP reading
- ⏯️ Play/pause controls
- ⏩ Navigate forward/backward
- 📊 Reading progress tracking
- 🎛️ Adjustable reading speed (coming soon)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the Expo development server:
```bash
npm start
```

## Adding Test Ebooks

For testing, place `.epub` files in the app's document directory. The app will automatically create a `books/` directory on first launch.

### On iOS Simulator:
You can add ebooks using the iOS Simulator's file system or by using Expo's file system APIs.

### On Physical Device:
Use Expo's development tools or copy files directly to the device's file system.

The app looks for ebooks in: `{documentDirectory}books/`

## Usage

1. Launch the app
2. Select an ebook from the list
3. Use the controls to:
   - ▶️ Play/Pause reading
   - ◀️ Previous word
   - ▶️ Next word
   - ↻ Reset to beginning

## Future Enhancements

- Reading speed controls (words per minute)
- Expand focus: word → sentence → paragraph → page
- Book library management
- Reading progress persistence
- Bookmarking

## Technical Stack

- Expo ~54.0
- React Native 0.81.5
- TypeScript
- JSZip for EPUB parsing
- xmldom for XML/HTML parsing

