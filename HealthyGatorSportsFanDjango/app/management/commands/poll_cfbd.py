from django.core.management.base import BaseCommand
from datetime import datetime, timezone, timedelta
from app.utils import check_game_status_basketball, send_notification, get_cached_uf_games


class Command(BaseCommand):
    help = 'Polls NCAA basketball API for game updates (replaces CFBD football poll)'

    def handle(self, *args, **options):
        self.poll_cbb()

    def poll_cbb(self):
        games = get_cached_uf_games() or []
        now = datetime.now(timezone.utc)
        for game in games:
            raw = game.get('startDate') or game.get('start_date')
            if not raw:
                continue
            if isinstance(raw, str):
                start_date = datetime.fromisoformat(raw.replace('Z', '+00:00'))
            else:
                start_date = raw
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
            if start_date - timedelta(minutes=30) <= now <= start_date + timedelta(hours=4):
                self.stdout.write(f"Game in window: {game}")
                game_status, home_team, home_score, away_team, away_score, _ = check_game_status_basketball()
                send_notification(game_status, home_team, home_score, away_team, away_score)
                return
        self.stdout.write("No games in 30min-before to 4hr-after window.")

