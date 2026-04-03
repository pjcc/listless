# Listless

A single-page link collection app. Paste URLs, preview metadata, organise into lists.

## Features

- URL metadata fetching (title, description, image, publisher)
- Editable price, note and title fields per card
- Custom image upload for cards
- Drag-and-drop reorder
- Multiple named lists
- Dark/light mode
- Undo support
- Google sign-in with cross-device sync (Firebase)
- localStorage fallback when not signed in

## Usage

Serve over HTTP for full functionality (Firebase Auth requires it):

```
npx serve .
```

Then open `http://localhost:3000`.

Sign in with Google to sync your lists across devices. Without sign-in, data is saved to localStorage only.
