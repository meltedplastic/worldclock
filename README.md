# WorldClock

Freelancer timezone tool. See all your client timezones at a glance, scrub time to find meeting windows, copy summaries, create Google Calendar events.

## Setup

1. Open `index.html` in a browser (or serve with any static server)
2. Add cities with the "+ CITY" button
3. Drag any time scrubber to explore "what time would it be everywhere"
4. Copy a formatted summary or create a calendar event

## Google Calendar Setup (Optional)

To enable calendar event creation:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Google Calendar API**
4. Create an **OAuth 2.0 Client ID** (Web application type)
5. Add your domain to **Authorized JavaScript origins** (e.g., `http://localhost:3000`)
6. Copy the Client ID and paste it in `calendar.js` replacing `YOUR_CLIENT_ID`

## Deploy

Static files — deploy to any static host:

- **Vercel:** `npx vercel --prod`
- **Netlify:** drag the `worldclock/` folder to Netlify
- **Any server:** just serve the directory

## Tech

- Vanilla HTML/CSS/JS — no framework, no build step
- `Intl.DateTimeFormat` for timezone conversion
- Google Identity Services for OAuth
- Google Calendar API v3 for event creation
- localStorage for city list and theme preference
