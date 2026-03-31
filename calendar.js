// calendar.js — Google Calendar OAuth + event creation

const CLIENT_ID = '519035913816-nbl3e2mehvrh9anputugdtr5vclejaic.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

let tokenClient = null;
let accessToken = null;

export function initCalendar() {
  if (!window.google?.accounts?.oauth2) {
    console.warn('Google Identity Services not loaded');
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.access_token) {
        accessToken = response.access_token;
      }
    },
  });
}

export async function ensureAuth() {
  if (accessToken) {
    const res = await fetch(`${CALENDAR_API}/users/me/calendarList?maxResults=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) return true;
    accessToken = null;
  }

  return new Promise((resolve) => {
    tokenClient.callback = (response) => {
      if (response.access_token) {
        accessToken = response.access_token;
        resolve(true);
      } else {
        resolve(false);
      }
    };
    tokenClient.requestAccessToken();
  });
}

export async function listCalendars() {
  const res = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to list calendars');
  const data = await res.json();
  return data.items.filter(c => c.accessRole === 'owner' || c.accessRole === 'writer');
}

export async function createEvent({ calendarId, title, startTime, durationMinutes, description }) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const event = {
    summary: title,
    description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };

  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) throw new Error('Failed to create event');
  return res.json();
}
