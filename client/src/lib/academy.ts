// OSINT Academy — the training zone. It lives on the marketing site and can't
// be framed in-app, so every entry point opens it in a new tab (the app keeps
// running behind it).
export const ACADEMY_URL = 'https://calibrex.org/academy/';
export const openAcademy = () => window.open(ACADEMY_URL, '_blank', 'noopener,noreferrer');
