# Use on iPhone

This app is a **web app** — you don't need the App Store. Deploy it once, then add it to your Home Screen like a native app.

## Step 1: Deploy to the internet

The app must be on **HTTPS** (required for iPhone install + microphone on some browsers).

### Option A — Vercel (recommended, free)

```bash
cd ~/Projects/portfolio-hedge-simulator
git init   # if not already
git add .
git commit -m "Portfolio hedge simulator"
```

Push to GitHub, then:

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub  
2. **Add New Project** → import `portfolio-hedge-simulator`  
3. Click **Deploy** (defaults work for Next.js)  
4. You get a URL like `https://portfolio-hedge-simulator.vercel.app`

### Option B — Test on your home Wi‑Fi only

On your Mac (same network as iPhone):

```bash
cd ~/Projects/portfolio-hedge-simulator
npm run dev -- -H 0.0.0.0 -p 3000
```

On iPhone Safari, open `http://YOUR-MAC-IP:3000` (e.g. `http://192.168.1.82:3000`).

Note: no HTTPS on local dev — Home Screen install and mic may be limited.

---

## Step 2: Add to iPhone Home Screen

1. Open the deployed URL in **Safari** (not Chrome — Safari gives the best “Add to Home Screen” flow)  
2. Tap the **Share** button (square with arrow)  
3. Scroll down → **Add to Home Screen**  
4. Name it **Hedge Sim** → **Add**

The app opens full-screen without the Safari address bar, like a native app.

---

## Step 3: Use on iPhone

| Feature | iPhone notes |
|---------|----------------|
| Portfolio simulation | Works |
| Scenario forecasts | Works |
| Voice input (mic) | **Limited on iPhone Safari** — speech recognition is unreliable or unavailable. **Type** your holdings in the transcript box, then tap **Find tickers & shares** |
| Add to Home Screen | Works after deploy (PWA icons included) |

**Voice workaround on iPhone:** Use Siri dictation in the transcript text field (tap the mic on the iOS keyboard), then tap **Find tickers & shares**.

---

## Optional: App Store (advanced)

To publish a true App Store app you would need:

- Apple Developer account ($99/year)  
- Wrap the site in **Capacitor** or rebuild in **React Native**  
- App Review submission  

For personal use, **Home Screen + Vercel** is faster and free.

---

## Optional: Custom domain

In Vercel → Project → **Settings → Domains**, add e.g. `hedge.yourdomain.com` and point DNS as instructed.
