# Backend services startup (for app + Android emulator)

For the React Native app (including Android emulator) to talk to the backend, these need to be running. Start them in this order.

## 1. Redis

```bash
# Start Redis (required for Django cache and Celery)
redis-server
# Or as a background service:
brew services start redis
```

Check: `redis-cli ping` → should print `PONG`.

---

## 2. Django + Celery (one script)

From **HealthyGatorSportsFanDjango**:

```bash
cd HealthyGatorSportsFanDjango
./run.sh
```

This starts:
- Django on http://127.0.0.1:8000
- Celery worker
- Celery beat

Leave this terminal open (Ctrl+C stops all).

---

## 3. ngrok (so the emulator can reach your machine)

In a **second terminal**, from **HealthyGatorSportsFanDjango**:

```bash
cd HealthyGatorSportsFanDjango
./run_ngrok.sh nonparabolical-unwaddling-blaise.ngrok-free.dev
```

Use your own static domain if different. The app’s `AppUrls.url` in the RN project must match this URL.

---

## Quick checklist

| Order | Service      | Command / check |
|-------|--------------|-----------------|
| 1     | Redis        | `redis-server` or `brew services start redis` |
| 2     | Django+Celery| `./run.sh` (in HealthyGatorSportsFanDjango) |
| 3     | ngrok        | `./run_ngrok.sh <your-static-domain>` |

Then run the React Native app; the emulator will call the backend via the ngrok URL.
