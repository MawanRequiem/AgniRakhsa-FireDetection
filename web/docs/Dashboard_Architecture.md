# Frontend Dashboard Architecture

The Ifrit Dashboard is a modern, real-time single-page application (SPA) built to monitor fire risks, view camera feeds, and manage alerts. 

## Technology Stack

| Category | Technology |
|---|---|
| **Framework** | React 19 + Vite |
| **Styling** | Tailwind CSS v4, shadcn/ui, base-ui |
| **State Management** | Zustand (for global state), React Context |
| **Animations** | GSAP, Framer Motion |
| **Data Visualization** | Recharts (for sensor historical data) |
| **Real-time Data** | WebSockets (connected to FastAPI backend), Supabase Auth |

## Folder Structure

The source code resides in `web/src/`:

- `/components`: Reusable UI components (buttons, cards, modals, shadcn components).
- `/pages`: Main route views (e.g., Dashboard, Room Detail, Settings).
- `/lib`: Utility functions, formatters, and API helper classes.
- `/stores`: Zustand state stores for managing alerts, sensor data, and application settings.
- `/landing`: Components specific to the marketing/landing page (`ifrit.space`).

## Real-Time Integration

The dashboard connects to the backend via a WebSocket connection (`/api/v1/dashboard/ws`). 

The WebSocket listens for specific event types:
1. **`SENSOR_UPDATE`**: Updates the live graphs and current sensor gauges seamlessly without HTTP polling.
2. **`NEW_ALERT`**: Triggers a notification badge on the UI.
3. **`FIRE_ALERT`**: Pops up a high-priority toast notification (using `sonner`) with the camera image and sensor snapshot, prompting immediate action.

## Deployment & Build

To build the frontend for production:

```bash
cd web
npm install
npm run build
```

The output in `web/dist` can be served by Nginx or Caddy. The dashboard requires the `VITE_API_URL` environment variable to connect to the backend correctly.
