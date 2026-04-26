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

1. Make sure the deploy workflow is located at `.github/workflows/deploy.yml`
2. Push to the `main` branch
3. Go to **Settings → Pages**
4. Set **Source** to **GitHub Actions**
5. Push any commit — the workflow will build and deploy automatically

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

**Demo / Single-device:** All data is stored in `localStorage` with `BroadcastChannel` for cross-tab sync within the same browser.

**Production (multi-device / workshop):** Add Supabase environment variables. The app will keep localStorage as a fast local cache and sync shared state through Supabase Realtime.

---

## Security

- **OTP system:** Passwords are never hardcoded. A random 6-digit code is generated using `crypto.getRandomValues`, hashed with SHA-256 via Web Crypto API, and stored as a hash. Only the hash is persisted — the plaintext code is shown once and discarded.
- **Sessions:** Admin sessions expire after 8 hours.
- **No secrets in code:** All sensitive operations are hash-based client-side in demo mode. Production should use Supabase Auth.

---

## Upgrade Path: Supabase (Workshop Sync)

Supabase currently lists Free plan quotas including **500 MB database**, **5 GB egress**, **2 million Realtime messages**, and **200 Realtime peak connections**. If you truly need 250 people connected at the same instant, plan either to test your exact workshop flow carefully, reduce live Realtime subscribers, or upgrade to Pro where the included Realtime peak connection quota is higher.

### 1. Create a Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Note your **Project URL** and **anon key**

### 2. Create the Database Table

Open **Supabase Dashboard → SQL Editor → New query**, paste this SQL, and run it:

```sql
create table if not exists public.kc_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.kc_store enable row level security;
alter table public.kc_store replica identity full;

drop policy if exists "kc_store_public_read" on public.kc_store;
drop policy if exists "kc_store_public_insert" on public.kc_store;
drop policy if exists "kc_store_public_update" on public.kc_store;
drop policy if exists "kc_store_public_delete" on public.kc_store;

create policy "kc_store_public_read"
on public.kc_store
for select
to anon
using (true);

create policy "kc_store_public_insert"
on public.kc_store
for insert
to anon
with check (
  key in (
    'timers',
    'queue',
    'qa_activities',
    'co_activities',
    'otp_store',
    'sessions'
  )
  or key like 'co_notes_%'
  or key like 'co_charts_%'
  or key like 'co_dashboard_%'
);

create policy "kc_store_public_update"
on public.kc_store
for update
to anon
using (
  key in (
    'timers',
    'queue',
    'qa_activities',
    'co_activities',
    'otp_store',
    'sessions'
  )
  or key like 'co_notes_%'
  or key like 'co_charts_%'
  or key like 'co_dashboard_%'
)
with check (
  key in (
    'timers',
    'queue',
    'qa_activities',
    'co_activities',
    'otp_store',
    'sessions'
  )
  or key like 'co_notes_%'
  or key like 'co_charts_%'
  or key like 'co_dashboard_%'
);

create policy "kc_store_public_delete"
on public.kc_store
for delete
to anon
using (
  key in (
    'timers',
    'queue',
    'qa_activities',
    'co_activities',
    'otp_store',
    'sessions'
  )
  or key like 'co_notes_%'
  or key like 'co_charts_%'
  or key like 'co_dashboard_%'
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'kc_store'
  ) then
    alter publication supabase_realtime add table public.kc_store;
  end if;
end $$;
```

This schema is designed for a low-cost static-site workshop prototype: participants can read/write workshop state through the public anon key, while RLS limits writes to known app keys. For higher-security production use, move admin-only operations such as OTP generation, activity deletion, and AI calls into Supabase Edge Functions or another server-side API.

### 3. Environment Variables

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

For GitHub Actions, add the same names as **Repository Secrets**:

1. GitHub repository → **Settings**
2. **Secrets and variables → Actions**
3. **New repository secret**
4. Add `VITE_SUPABASE_URL`
5. Add `VITE_SUPABASE_ANON_KEY`
6. Add `VITE_ADMIN_EMAILS` with comma-separated administrator emails

The deploy workflow injects these secrets during `npm run build`.

### 4. Create Admin Users

The admin pages no longer generate a public one-time password. Create administrator accounts directly in Supabase:

1. Supabase Dashboard → **Authentication → Users**
2. Click **Add user**
3. Enter the same email listed in `VITE_ADMIN_EMAILS`
4. Set a password
5. The administrator signs in from `/qa-admin` or `/cocreate-admin`

### 5. Install Supabase Client

```bash
npm install @supabase/supabase-js
```

This dependency is already included in `package.json`.

### 6. Realtime Check

After deployment:

1. Open the site in two different browsers or devices.
2. Create a Q&A or Co-creation activity in the admin page.
3. Join the room from the second device.
4. Add a post or vote.
5. The other device should update after a short delay.

If it does not update, check **Supabase → Database → Replication** and confirm `kc_store` is enabled under `supabase_realtime`.

---

## Deployment Troubleshooting

### Blank Page on GitHub Pages

Check these first:

1. The workflow file must be at `.github/workflows/deploy.yml`. A workflow named `deploy.yml` in the repository root will not run.
2. GitHub repository → **Settings → Pages → Build and deployment → Source** must be **GitHub Actions**.
3. GitHub repository → **Actions → Deploy to GitHub Pages** should show a green run.
4. If the page was previously blank, open the deployed site and hard refresh:
   - macOS Chrome/Edge: `Cmd + Shift + R`
   - Windows Chrome/Edge: `Ctrl + F5`
5. If it is still blank, open DevTools → **Application → Service Workers** and click **Unregister**, then refresh. The service worker is now network-first to avoid stale JS/CSS after future deployments.

### Local Verification Before Pushing

```bash
npm ci
npm run build
npm run preview
```

Then open the preview URL and make sure the homepage renders before pushing to GitHub.

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
