# Windows Local Setup Instructions

This guide assumes you already set up pgAdmin and ngrok from `README.md`, and you have login credentials for both.

## 1) Backend Setup (Django)

1. Open the Django project folder:
	- `HealthyGatorSportFan-Basketball/HealthyGatorSportsFanDjango`

2. Run the setup script:
	- `./setup.ps1`

3. Activate the virtual environment:
	- `venv\Scripts\activate`

4. Confirm VS Code uses the Django venv interpreter:
	- Set Python interpreter to this project’s `venv`.
	- This should resolve import errors.

5. Configure the Django `.env` file:
	- `SECRET_KEY`
	  - Do not change this; it is generated uniquely during setup.
	- `DATABASE_NAME`
	  - Use `healthygatorsportsfan` (per project instructions).
	- `DATABASE_USER`
	  - PostgreSQL user created in pgAdmin (`Login/Group Roles`) with DB access.
	- `DATABASE_PASSWORD`
	  - Password for the PostgreSQL user.
	- `DATABASE_HOST`
	  - Usually `localhost` (PostgreSQL running on your machine).

6. Update ngrok URL in backend run script:
	- Open `HealthyGatorSportFan-Basketball/HealthyGatorSportsFanDjango/run.ps1`.
	- Find the command with `ngrok http 8000 --url ...`.
	- Replace with your ngrok URL.
	- Use the same URL in:
	  - `HealthyGatorSportFan-Basketball/HealthyGatorSportsFanDjango/project/settings.py`
	  - `HealthyGatorSportFan-Basketball/HealthyGatorSportsFanRN/constants/AppUrls.ts`

7. Start backend services:
	- Run `./run.ps1` in the Django folder (PowerShell).

8. Verify expected running terminals/processes:
	- ngrok
	- Celery beat
	- Celery worker
	- Redis (Administrator PowerShell)
	- Django server (IDE terminal)

9. Verify admin endpoint:
	- Open: `<your-django-url>/admin`
	- Example: `https://nannie-halogenous-tidily.ngrok-free.dev/admin`

10. Backend should now be running.

## 2) Frontend Setup (React Native / Expo)

1. Open the RN project folder:
	- `HealthyGatorSportFan-Basketball/HealthyGatorSportsFanRN`

2. Configure frontend API URL:
	- Open `HealthyGatorSportFan-Basketball/HealthyGatorSportsFanRN/constants/AppUrls.ts`.
	- Set the URL to your Django/ngrok URL.

3. Install frontend dependencies:
	- Run `./setup.ps1`
	- You should see a setup complete message if install succeeds.

4. Start frontend:
	- Run `./run.ps1`

5. If bundling is slow/stuck:
	- Run `npx expo start -c`
	- Then run `npx expo start`
