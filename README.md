# EarUp

A personal, browser-based music library with an Apple Music-inspired dark interface.

## Features in v1
- Import audio files from your device (MP3, M4A, WAV, FLAC, OGG, AAC where supported by the browser)
- Local library persistence using IndexedDB
- Create playlists and add/remove songs
- Favorites and recently played
- Save your own lyrics or song notes
- Six-band equalizer (Flat, Bass Boost, Vocal, Treble presets)
- Animated audio visualizer
- Playback controls, seek, volume, shuffle and repeat

## Run locally
For best results, serve this folder through a local web server because browser storage and audio APIs behave more consistently on `localhost`.

### Python
```bash
python -m http.server 8000
```
Then open http://localhost:8000

## Publish with GitHub Pages
1. Create a public GitHub repository, for example `earup`.
2. Upload `index.html`, `styles.css`, `app.js`, and this README to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select `main` and `/ (root)`, then Save.
6. Open the Pages URL GitHub provides.

## Important storage and privacy notes
- Imported audio files are stored in IndexedDB in the browser profile on the device where they were imported.
- They are not uploaded to GitHub or sent to a server by this app.
- Clearing browser site data can delete the local music library. Keep backups of your original audio files.
- Your library does not automatically sync across devices or browsers.
- Lyrics are user-entered and stored locally. The app does not fetch or redistribute copyrighted lyrics.
- GitHub Pages hosts the application code, not your private MP3 collection.

## Current limitations / next improvements
- Album artwork and artist metadata are not automatically extracted in this first version.
- Lyrics are manually entered per track; synchronized timed lyrics can be added in a later version.
- Equalizer and visualizer depend on browser Web Audio API support.
- A future release could add drag-and-drop importing, metadata editing, artwork upload, smart playlists, keyboard shortcuts, and a mobile installable PWA.


## EarUp 2.0: free metadata and lyrics services
- MP3 ID3 tags are read locally in the browser for title, artist, and album.
- MusicBrainz is queried for matching recording metadata (no API key; max one request per second).
- Cover Art Archive is used for album artwork when a matching MusicBrainz release group has a cover.
- LRCLIB is queried for plain or timestamped lyrics (no API key). Lyrics lookup starts when a track with a known artist is played; the Lyrics page also has a manual lookup button.
- External APIs receive search metadata (track title, artist, and sometimes album/duration), not the MP3 file itself. Audio remains in local IndexedDB.
- Matching is best-effort. Incorrect or missing tags, ambiguous song titles, API rate limits, CORS/network failures, and missing catalog entries can prevent a match.
- MusicBrainz requests are deliberately spaced at least 1.1 seconds apart. LRCLIB rate limits should be respected; avoid repeatedly scanning the entire library.
