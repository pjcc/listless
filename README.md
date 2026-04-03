# Listless

A single-page link collection app. Paste URLs, preview metadata, organise into lists.

![Screenshot](screenshot.png)

## Features

- URL metadata fetching (title, description, image, publisher, price)
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

## Third-party services

| Service | Purpose | Plan | Free tier | Typical cost | Emergency stop |
|---------|---------|------|-----------|-------------|----------------|
| **Firebase Auth** | Google sign-in | Blaze (pay-as-you-go) | 50k MAU | Free at low volume | Firebase Console > Authentication > Settings > disable sign-in method |
| **Firestore** | Data storage, real-time sync | Blaze (pay-as-you-go) | 50k reads, 20k writes/day | Free at low volume | Firebase Console > Firestore > Rules > deny all, or delete the database |
| **Firebase Trigger Email** | Sends invite emails | Free (extension) | N/A - uses SMTP provider | Free | Firebase Console > Extensions > uninstall the extension |
| **Brevo** | SMTP email delivery | Free | 300 emails/day, no expiry | Free | Brevo dashboard > Settings > SMTP & API > delete SMTP key |
| **Cloudflare Workers** | Metadata proxy for sites that block scrapers | Free | 100k requests/day | Free | Cloudflare dashboard > Workers > delete or disable the worker |
| **Microlink** | Primary URL metadata API | Free | 50 requests/day | Free | No account needed - just stop calling the API |
| **Noembed** | Fallback metadata for embeddable content | Free | Unlimited | Free | No account needed |
| **GitHub Pages** | Hosting | Free | Unlimited for public repos | Free | Repo Settings > Pages > disable |

### Budget protection

- A Google Cloud budget alert is configured at $1/month with email notifications at 50%, 90%, and 100%
- To fully stop all paid Firebase services: Firebase Console > Project Settings > Blaze plan > downgrade to Spark (free). This disables extensions and any paid-tier usage immediately
