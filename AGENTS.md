# GoaCharge — Project Instructions

## Project

GoaCharge is a Goa-focused EV charging discovery and mapping application.

The goal is to provide users with a clean interface for:

* discovering EV charging stations across Goa
* viewing stations on an interactive MapLibre map
* filtering/searching charging stations
* viewing station details
* eventually planning routes to stations
* displaying statistics derived from real charging-station data

This is intended to be a portfolio-quality project, not a static UI demo.

## Current Stack

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS
* MapLibre GL

Mapping:

* MapLibre GL
* OpenFreeMap tiles
* Goa boundary GeoJSON
* Custom WebGL visualization currently exists in `GoaMap.tsx`

Backend:

* Lightweight Node.js/Express API
* Open Charge Map API integration

Database:

* Supabase/PostgreSQL will be used for persistent normalized charging-station data when the data pipeline is implemented.

External Data:

* Open Charge Map API is the initial charging-station data source.

## Architecture

Preferred data flow:

Browser
↓
React components
↓
Client service layer
↓
/api/*
↓
Express server
↓
External APIs / database
↓
Normalized application data
↓
React UI

The Open Charge Map API key must remain server-side.

Never expose:
OPEN_CHARGE_MAP_API_KEY

to the browser.

Never use a VITE_ prefix for this secret.

## Important Principles

### Real Data

Do not invent charging stations, operators, charger counts, availability, or statistics.

If data is unavailable, display an appropriate empty/loading/error state.

Statistics must eventually be derived from the actual station dataset.

### Source Transparency

Charging-station data should retain:

* source
* external ID
* last updated timestamp

The UI should not imply that third-party data is guaranteed to be real-time unless the source actually provides real-time status.

### UI

The existing GoaCharge design is intentionally dark, premium, and EV-focused.

Maintain:

* dark navy background
* teal accent
* clean typography
* restrained glow effects
* subtle animations

Avoid:

* excessive neon
* unnecessary gradients
* generic stock imagery
* excessive animations
* redesigning existing pages without being asked

### Map

`GoaMap.tsx` is a core component.

Do not replace MapLibre with another mapping library.

Preserve the existing:

* Goa map styling
* Goa boundary
* WebGL visualization
* map center unless a task specifically requires changing it

Charging stations should eventually be represented as real data-driven markers.

### Code Quality

Prefer:

* small reusable components
* typed interfaces
* clear service boundaries
* async error handling
* loading/error/empty states
* environment variables for secrets
* minimal dependencies

Avoid:

* giant components
* duplicated API calls
* hard-coded production data
* unnecessary abstractions
* unnecessary dependencies
* modifying unrelated files

### Agent Workflow

Before implementing a task:

1. Inspect the relevant existing files.
2. Understand the current architecture.
3. Identify dependencies and constraints.
4. Explain the proposed changes briefly.
5. Implement only the requested scope.
6. Run the relevant checks/tests.
7. Report:

   * files changed
   * what changed
   * verification performed
   * any remaining issues

Do not modify unrelated functionality.

If an architectural decision is unclear, stop and ask rather than guessing.

### Security

Never:

* commit `.env`
* expose API secrets to client-side JavaScript
* place secrets in source code
* paste secrets into logs
* hard-code API keys

`.env` must remain ignored by Git.

### Current Development Goal

The immediate goal is:

Open Charge Map API
↓
Express `/api/chargers`
↓
Real Goa charging-station JSON
↓
Client service
↓
MapLibre markers

Do not implement later features until the current stage has been verified.
