# Listless - Setup Guide

Complete walkthrough for setting up your own instance of Listless from scratch.

## Prerequisites

- A Google account
- A GitHub account (for hosting)
- A Cloudflare account (free - for the metadata proxy)

## 1. Firebase project

### Create the project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Name it (e.g. `listless`)
4. Disable Google Analytics (not needed)
5. Click **Create project**

### Enable Authentication

1. In Firebase Console, go to **Authentication** > **Get started**
2. Click **Google** under sign-in providers
3. Enable it, set a support email, click **Save**

### Create Firestore database

1. Go to **Firestore Database** > **Create database**
2. Pick a location close to your users (e.g. `europe-west2` for UK)
3. Start in **test mode** (you'll add proper rules later)

### Register a web app

1. Go to **Project Settings** (gear icon) > **Your apps** > **Add app** > Web
2. Name it (e.g. `listless`)
3. Copy the Firebase config object - you'll paste this into `index.html`

```js
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});
```

### Set Firestore security rules

Go to **Firestore** > **Rules** and replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /lists/{listId} {
      allow read: if request.auth != null && (
        request.auth.uid in resource.data.memberUids ||
        request.auth.token.email in resource.data.memberEmails
      );
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        request.auth.uid in resource.data.memberUids ||
        request.auth.token.email in resource.data.memberEmails
      );
    }
    match /invites/{inviteId} {
      allow read: if request.auth != null && request.auth.token.email == resource.data.email;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && request.auth.token.email == resource.data.email;
    }
    match /shared/{shareId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
    }
    match /mail/{mailId} {
      allow create: if request.auth != null;
    }
  }
}
```

Click **Publish**.

### Restrict your API key

1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Select your project at the top
3. Click on the **Browser key (auto created by Firebase)**
4. Under **Application restrictions**, select **Websites**
5. Add your domains:
   - `your-username.github.io/*`
   - `yourcustomdomain.com/*` (if applicable)
   - `localhost/*`
   - `127.0.0.1/*`
6. Click **Save**

### Enable App Check (reCAPTCHA v3)

App Check verifies that requests to Firebase come from your real app, not scripts or bots.

1. Go to [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin)
2. Create a new site: type **reCAPTCHA v3**, add your domains (`your-username.github.io`, `localhost`, any custom domains)
3. Copy the **Site Key** and **Secret Key**
4. In Firebase Console > **App Check** > click **Register** on your web app
5. Select **reCAPTCHA**, paste the **Secret Key**, leave token TTL at 1 day, click **Save**
6. Go to the **APIs** tab in App Check > find **Cloud Firestore** > click **Enforce**
7. In `index.html`, replace the reCAPTCHA site key in the `appCheck.activate()` line with your Site Key

### Set up monitoring alerts

1. Go to [Google Cloud Monitoring](https://console.cloud.google.com/monitoring)
2. **Alerting** > **Create Policy**
3. Select metric: **Firestore Instance** > **Document** > **Document reads**
4. Rolling window: 5 min, function: sum
5. Threshold: 500 (or adjust for your expected usage)
6. Add your email as notification channel
7. Name the policy and create

## 2. Email notifications (Brevo + Firebase Extension)

### Upgrade to Blaze plan

1. In Firebase Console, click **Upgrade** (bottom-left)
2. Select **Blaze** (pay-as-you-go)
3. This is required for extensions but is effectively free at low volume

### Set a budget cap

1. Go to [Google Cloud Billing > Budgets & Alerts](https://console.cloud.google.com/billing)
2. Select your billing account > **Budgets & Alerts** > **Create Budget**
3. Name it, scope to your project
4. Set amount to **$1** (or any low threshold)
5. Enable alert thresholds at 50%, 90%, 100%
6. Click **Finish**

### Set up Brevo (SMTP provider)

1. Sign up at [brevo.com](https://www.brevo.com) (free - 300 emails/day, no expiry)
2. Complete your profile (required for account activation)
3. Go to **Settings** > **SMTP & API**
4. Note your SMTP server, port, and login
5. Click **Generate a new SMTP key** > **Standard** > copy the key

### Install the Trigger Email extension

1. In Firebase Console, go to **Extensions** > **Explore extensions**
2. Search for **Trigger Email from Firestore** > **Install**
3. Enable the required services when prompted (Artifact Registry, Secret Manager, Compute Engine)
4. Configure:
   - **Cloud Functions location**: any (e.g. us-central1)
   - **Firestore Instance ID**: (default)
   - **Firestore Instance Location**: must match your Firestore region (check Firestore > Data page or the error message will tell you)
   - **Authentication Type**: Username & Password
   - **SMTP connection URI**: `smtp://YOUR_BREVO_LOGIN:YOUR_SMTP_KEY@smtp-relay.brevo.com:587`
   - **SMTP password**: leave empty
   - **OAuth2 SMTP Host**: leave empty
   - **OAuth2 SMTP Port**: leave empty
   - **Use secure OAuth2 connection**: No
   - **Email documents collection**: `mail`
   - **Default FROM address**: your verified email in Brevo
   - **Firestore TTL type**: Never
   - **TLS Options**: `{"rejectUnauthorized":true}`
   - **Enable events**: unchecked
5. Click **Install** (takes ~5 minutes)

### Test email delivery

Add a member to a list in the app, then check Firestore > `mail` collection. The document should have a `delivery` field with `state: SUCCESS`. If it shows an error about account activation, check Brevo for any pending verification steps.

## 3. Cloudflare Worker (metadata proxy)

This fetches page metadata like a real browser for sites that block API scrapers (e.g. Amazon).

### Create the worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) > **Workers & Pages** > **Create** > **Create Worker**
2. Name it (e.g. `listless-meta`)
3. Click **Deploy**, then **Edit code**
4. Replace the default code with the contents of `worker.js` from this repo
5. **Before deploying**: update the `allowed` array in the origin check to include your own domains:
   ```js
   const allowed = ['your-username.github.io', 'yourcustomdomain.com', 'localhost'];
   ```
6. Click **Save and deploy**
7. Note the worker URL (e.g. `https://listless-meta.your-subdomain.workers.dev`)

### Test the worker

Visit `https://your-worker-url/?url=https://www.amazon.co.uk/dp/B0D3P1KBNB/` in your browser. You should see JSON with title and description.

## 4. Update index.html

Search for comments starting with `/* UPDATE:` and replace:

1. **Firebase config** (~line 1089) - paste your Firebase project config
2. **Worker URL** (~line 1511) - replace with your Cloudflare Worker URL
3. **Invite email link** (~line 2023) - replace with your hosted app URL

## 5. Deploy to GitHub Pages

1. Create a GitHub repo (e.g. `listless`)
2. Push the code:
   ```
   git init
   git add index.html worker.js README.md screenshot.png .gitignore
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/listless.git
   git push -u origin master
   ```
3. Go to repo **Settings** > **Pages** > Source: **Deploy from a branch** > select `master` / `/ (root)` > **Save**
4. Your app will be live at `https://your-username.github.io/listless/`

### Add GitHub Pages domain to Firebase Auth

1. Firebase Console > **Authentication** > **Settings** > **Authorised domains**
2. Add `your-username.github.io`
3. Add any custom domains too

## 6. Custom domain (optional)

If you have a domain on Cloudflare:

1. Cloudflare dashboard > your domain > **Rules** > **Transform Rules** > **Rewrite URL**
2. Create a rule to rewrite your chosen path to the GitHub Pages URL
3. Add the custom domain to Firebase Auth authorised domains

## Verification checklist

- [ ] Can sign in with Google
- [ ] Can create lists, add links, reorder
- [ ] Data persists across page refreshes
- [ ] Data syncs across devices when signed into the same account
- [ ] Can add a member by email
- [ ] Invited user receives an email
- [ ] Invited user sees the shared list after signing in
- [ ] Share link (read-only) works for non-authenticated viewers
- [ ] Export/import JSON works
- [ ] Metadata fetches correctly for standard sites
- [ ] Amazon/shopping sites show title and description (via worker)

## Troubleshooting

### "Missing or insufficient permissions" in console
Your Firestore rules are blocking the operation. Check that the rules from step 1 are published correctly.

### Auth error on file:// protocol
Firebase Auth requires HTTP. Run `npx serve .` and open `http://localhost:3000`.

### Email shows "SMTP account not yet activated"
New Brevo accounts require profile completion and sometimes manual approval. Fill in all profile fields and check for verification emails from Brevo.

### Firestore extension install fails with region error
The Firestore Instance Location must exactly match your database region. The error message will tell you the correct region (e.g. `europe-west2`).

### Invited user can't see shared list
They need to sign in with the exact email address they were invited with. On sign-in, pending invites are resolved automatically. If it still doesn't work, check the `invites` collection in Firestore for matching documents.

### Worker returns null for all fields
The target site may block Cloudflare Worker IPs. This is a limitation - the user can manually edit the title and upload a custom image.
