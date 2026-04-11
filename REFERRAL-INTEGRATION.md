# Asteroid Referral System – Integration Guide

## Overview

The referral system uses **Firebase Firestore** (separate from your existing Realtime Database). You need to integrate it into your signup and song upload flows.

---

## 1. Firebase Console Setup

### Enable Firestore
- Firebase Console → Project (asteroid-cdc13) → Firestore Database → Create database

### Create Composite Index (for Charts)
When you first load the Charts page, Firestore may show an error with a link to create an index. Or create manually:

- **Collection**: `users`
- **Fields**: `vipStatus` (Ascending), `referralCount` (Descending)

---

## 2. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;  // Charts + dashboard
      allow create: if request.auth != null;
      allow update: if request.auth != null && (request.auth.uid == userId || 
        // Allow incrementing referralCount by server/cloud function
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['referralCount']));
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    match /songs/{songId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }
    match /featureQueue/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 3. Integration Points

### A. Signup (e.g. `studio.html`)

When a user signs in with Apple (or your chosen provider), call the referral system:

```html
<script type="module">
  import { handleNewUserSignup, processReferralURL } from "./js/referral-system.js";
  import { getAuth, signInWithPopup, OAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

  const auth = getAuth();
  const appleProvider = new OAuthProvider("apple.com");
  appleProvider.addScope("email");
  appleProvider.addScope("name");

  // On page load (before sign-in)
  processReferralURL();

  // After successful Apple sign-in (web):
  signInWithPopup(auth, appleProvider).then(async (res) => {
    const user = res.user;
    await handleNewUserSignup(user);  // Creates Firestore user, processes referral
    // ... rest of your sign-in logic
  });
</script>
```

### B. Song Upload (e.g. `studio.html`)

After a song is uploaded, increment the artist’s `songCount`:

```javascript
import { onSongUploaded } from "./js/referral-system.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// After successful upload:
const user = getAuth().currentUser;
if (user) {
  await onSongUploaded(user.uid, document.getElementById("title").value.trim());
}
```

---

## 4. Pages

- **VIP Dashboard**: `vip-dashboard.html` – referral link, counts, timer, eligibility
- **Charts**: `charts.html` – public top VIP artists by referrals

---

## 5. Firestore Structure

| Collection     | Fields |
|----------------|--------|
| `users`       | email, username, vipStatus, vipStartDate, referralCode, referredBy, referralCount, songCount, eligibleForFeature |
| `songs`       | ownerUid, title, uploadDate, plays, likes |
| `featureQueue`| userUid, username, referralCount, songCount, timestamp, processed |

---

## 6. Referral Flow

1. Artist A shares: `https://yoursite.com/studio.html?ref=AST123ABC`
2. Artist B opens that URL → `processReferralURL()` saves the code
3. Artist B signs in → `handleNewUserSignup()` creates their user with `referredBy: "AST123ABC"`
4. Artist A’s `referralCount` is incremented
5. If A has `songCount ≥ 1`, `referralCount ≥ 1`, and `vipStatus` within trial → A is added to `featureQueue` and `eligibleForFeature = true`
