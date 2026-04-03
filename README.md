# Listless

A single-page link collection app. Paste URLs, preview metadata, organise into lists.

## Features

- URL metadata fetching (title, description, image, publisher)
- Editable price, note and title fields per card
- Custom image upload for cards
- Drag-and-drop reorder with grip handles
- Multiple named lists
- Dark/light mode
- Undo support
- Google sign-in with cross-device sync (Firebase/Firestore)
- Share lists via link (read-only for viewers)
- Export/import lists as JSON
- In-page modals for all confirmations

## Usage

Serve over HTTP (Firebase Auth requires it):

```
npx serve .
```

Then open `http://localhost:3000`.

Also available via GitHub Pages.

## Setup

Requires a Firebase project with:
- **Authentication** - Google sign-in enabled
- **Firestore** - for user data and shared lists

Firebase config is embedded in `index.html`. Firestore security rules should restrict user docs to their owner and allow public reads on shared lists.
