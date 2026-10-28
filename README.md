# Reelhouse Cinema

Responsive, framework-free movie ticket booking frontend. The pages in `public/` use native HTML, CSS, and JavaScript and call the JSON API with `fetch`.

## Pages

- `/` — cinema landing page
- `/login.html` and `/register.html` — account access
- `/movies.html` — movie cards and showtimes
- `/seats.html?showId=<id>` — seat map and hold
- `/payment.html?bookingId=<id>` — mock payment and hold countdown
- `/bookings.html` — the signed-in user's bookings
- `/dashboard.html` — organiser dashboard and movie/show forms

The shared request helper is `public/js/api.js`; shared navigation, response helpers, and role guards are in `public/js/common.js`. The browser stores the JWT in local storage and sends it as `Authorization: Bearer <token>`. Pending hold details are kept in session storage only until payment completes.

## API integration

The frontend expects the API to be available under `/api` on the same origin. It accepts either direct JSON responses or responses wrapped in a `data` object. List endpoints may return an array directly or a named collection such as `movies`, `shows`, `seats`, or `bookings`.

The hold endpoint should return a booking identifier, selected seats, amount, and an ISO `holdExpiresAt` (or `expiresAt`) timestamp. Payment receives `{ "simulateFailure": boolean }` and, for a successful mock attempt, the last four card digits only; card details are never stored or sent. The backend remains responsible for authorization, seat availability, hold expiry, price calculation, payment outcome, and cancellation eligibility.

Serve `public/` as the Express static root so these pages and their `/css` and `/js` assets load from the same origin as the API. Organiser forms post movie data to `/api/organiser/movies` and show data to `/api/organiser/shows`.
