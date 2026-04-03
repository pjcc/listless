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
- Collaborative lists - invite members by email with notifications, owner/member roles, real-time sync
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

Requires a Firebase project (Blaze plan) with:
- **Authentication** - Google sign-in enabled
- **Firestore** - for user data, collaborative lists, and shared links
- **Trigger Email from Firestore** extension - sends invite emails via Brevo SMTP

Firebase config is embedded in `index.html`. Firestore collections:
- `lists/{id}` - per-list documents with member arrays and items
- `invites/{id}` - pending email invites resolved on sign-in
- `shared/{id}` - read-only snapshots for share links
- `users/{uid}` - active list preference
- `mail/{id}` - email documents processed by the Trigger Email extension
