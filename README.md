# Product Manager (Next.js + Firebase + Cloudinary)

Add, edit, list and delete products. Each product has a cost price, a margin and an
optional offer. Images go to Cloudinary, data is stored in Firebase Firestore, and
login uses Firebase Authentication.

## Pricing logic

```
selling price = cost price + margin
```

- Margin can be a **fixed amount** (e.g. 50) or a **percent** of cost (e.g. 20%).
- Offer is optional: **percent off** the selling price, or a direct **offer price**.
- Profit per unit = (offer price, or selling price if no offer) - cost price.

Example: cost 500, margin 20% -> selling 600. Offer 10% off -> offer price 540, profit 40.

Prices are calculated on the server (`lib/pricing.js`), so the browser can't send fake prices.

## Setup

1. Install Node 20 or newer, then in this folder run:
   ```
   npm install
   cp .env.example .env
   ```
   (On Windows, just copy the file and rename it to `.env`.)
2. **Firebase**
   - Create a project at https://console.firebase.google.com
   - Build -> Authentication -> Sign-in method -> enable **Email/Password**
   - Build -> Firestore Database -> create a database
   - Project settings -> Service accounts -> **Generate new private key**.
     Save it as `serviceAccountKey.json` next to `package.json`.
   - Project settings -> General -> Your apps -> add a **Web app** and copy
     apiKey, authDomain, projectId, appId into the `FIREBASE_WEB_*` lines in `.env`.
3. **Cloudinary**: put your cloud name, API key and API secret in `.env`.
4. Start it:
   ```
   npm run dev
   ```
   Open http://localhost:3000 . Restart after any change to `.env`.

For a production run: `npm run build` then `npm start`.

## Login behaviour

- Login is required. The session is kept **in memory only**, so every page refresh
  sends you back to the login screen.
- **Bypass button** (beside Login): skips Firebase login using a short-lived signed
  token from the server. It only shows while `BYPASS_ENABLED=true` in `.env`.
  **Set it to `false` before going live**, otherwise anyone can use it.
  If you host on a platform with several server copies, also set `BYPASS_SECRET`
  to any long random text.
- Every API route checks the token itself, so hiding the screen is not the only protection.

## Firestore rules

Only the server touches Firestore (Admin SDK), so you can lock the database down:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

## Deploying

Works on any Node host (Render, Railway, a VPS) and on Vercel. On a host you can't
upload `serviceAccountKey.json` to, paste the whole JSON on one line into the
`FIREBASE_SERVICE_ACCOUNT_JSON` environment variable instead. Images are limited to 4 MB.

## Files

```
app/page.js                      login / dashboard switch
app/api/config/route.js          public Firebase web config + bypass flag
app/api/auth/bypass/route.js     bypass token
app/api/products/route.js        list + add
app/api/products/[id]/route.js   get + edit + delete
app/api/products/preview-price/  live price preview
components/                      LoginScreen, Dashboard, ProductForm, ProductCard
lib/                             pricing, auth, firebase, cloudinary helpers
```
