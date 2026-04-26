# 🛠️ KC Workshop Toolbox

A comprehensive workshop facilitation toolkit built with React + Vite, deployable for free on GitHub Pages. Supports Traditional Chinese / English, Light / Dark mode, and responsive design.

## Tools Included

| Tool | Description |
|------|-------------|
| ⏱️ Countdown Timer | Up to 3 simultaneous timers with audio alerts, background operation via Service Worker |
| 📋 Queue Manager | Fast-food-style queue system with calling zones, CSV import, broadcast sync |
| 💬 Interactive Q&A | Slido-style Q&A with polls, word clouds, idea boards, score challenges |
| 🌐 Co-creation Station | Shared notes, strategy board with AI analysis, collaborative dashboard |

## Quick Start (GitHub Pages)

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/kc-toolbox.git
cd kc-toolbox
npm install
npm run dev
```

### 2. Enable GitHub Pages

1. Push to the `main` branch
2. Go to **Settings → Pages**
3. Set **Source** to **GitHub Actions**
4. Push any commit — the workflow will build and deploy automatically

Your site will be live at: `https://YOUR_USERNAME.github.io/kc-toolbox/`

### 3. Local Build & Preview

```bash
npm run build    # builds to /dist
npm run preview  # preview the production build locally
```

---

## Architecture

```
src/
├── main.jsx          # React entry point + Service Worker registration
├── App.jsx           # Router, theme/language context, navigation
├── index.css         # Design system: CSS variables, animations, dot-grid bg
├── i18n.js           # Traditional Chinese + English translations
├── store.js          # localStorage adapter + BroadcastChannel + OTP system
├── utils.js          # Helpers: time, audio, markdown, export
├── components/
│   ├── UI.jsx        # Shared UI components (Btn, Card, Modal, Tabs, etc.)
│   └── OTPLogin.jsx  # OTP login widget
└── tools/
    ├── Countdown.jsx  # Countdown timer tool
    ├── Queue.jsx      # Queue manager tool
    ├── QAFront.jsx    # Q&A frontend (participant view)
    ├── QAAdmin.jsx    # Q&A backend (admin view, OTP-protected)
    ├── CoFront.jsx    # Co-creation frontend
    └── CoAdmin.jsx    # Co-creation backend (OTP-protected)
```

### Data Flow

**Demo / Single-device:** All data stored in `localStorage` with `BroadcastChannel` for cross-tab sync within the same browser.

**Production (250+ concurrent users):** Replace `store.js` with Supabase (see below).

---

## Security

- **OTP system:** Passwords are never hardcoded. A random 6-digit code is generated using `crypto.getRandomValues`, hashed with SHA-256 via Web Crypto API, and stored as a hash. Only the hash is persisted — the plaintext code is shown once and discarded.
- **Sessions:** Admin sessions expire after 8 hours.
- **No secrets in code:** All sensitive operations are hash-based client-side in demo mode. Production should use Supabase Auth.

---

## Upgrade Path: Supabase (Free Tier, 250+ Users)

Supabase free tier supports **500 MB database, 2 GB bandwidth, and real-time subscriptions** — sufficient for 250 concurrent users in a workshop setting.

### 1. Create a Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Note your **Project URL** and **anon key**

### 2. Environment Variables

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

For GitHub Actions, add these as **Repository Secrets** (`Settings → Secrets and variables → Actions`).

### 3. Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 4. Replace store.js

Create `src/supabaseClient.js`:

```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

Replace `db.get/set` calls in `store.js` with Supabase queries, and replace `BroadcastChannel` with `supabase.channel(...).on('broadcast', ...)`.

### 5. Database Schema (SQL)

```sql
-- Q&A Activities
create table qa_activities (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table qa_activities enable row level security;
create policy "Public read" on qa_activities for select using (true);
create policy "Authenticated write" on qa_activities for all using (auth.role() = 'authenticated');

-- Co-creation Activities
create table co_activities (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
```

Enable **Realtime** for both tables in the Supabase dashboard.

---

## AI Features

The Q&A word cloud grouping and strategy board analysis use the **Anthropic Claude API**. In the admin panel, these features prompt the user for an API key at runtime (never stored permanently).

To reduce API costs:
- Word cloud grouping only triggers on admin action (not automatic)
- Strategy analysis is user-initiated
- API calls use `claude-sonnet-4-20250514` with `max_tokens: 1000`

Estimated cost: ~$0.01–0.05 per workshop session.

---

## Browser Support

Chrome 90+, Firefox 88+, Safari 15+, Edge 90+

Service Worker background timer requires a modern browser. Falls back gracefully on unsupported browsers.

---

## License

MIT License — free to use, modify, and deploy.
