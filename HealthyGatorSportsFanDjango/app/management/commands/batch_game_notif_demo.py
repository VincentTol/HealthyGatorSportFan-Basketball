"""
Send a scripted burst of health notifications for local device testing (Expo Go / dev build).

Mirrors the flow in UpgradeSDK.txt: mock push token + user_id, then call send_notification.
Clears the score cache so the scripted sequence sends every step (send_notification only
pushes when the cached score string changes).

You can find the push token in the Django terminal logs as well as the user id when you login

Usage (from HealthyGatorSportsFanDjango with venv active):
  python manage.py batch_game_notif_demo --push-token "ExponentPushToken[...]" --user-id 1
  python manage.py batch_game_notif_demo ... --delay-minutes 0.5   # 30 seconds between pushes
"""
import time

import app.utils
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError

from app.utils import send_notification


def _clear_demo_cache():
    cache.delete("last_score")


def _patch_cache_get_for_send_notification(real_get):
    """
    send_notification decodes last_score from cache as bytes; Django often returns str.
    Wrap reads so .decode() in utils succeeds without changing utils.py.
    """

    def mock_cache_get(key, *args, **kwargs):
        val = real_get(key, *args, **kwargs)
        if key == "last_score" and isinstance(val, str):
            return val.encode("utf-8")
        return val

    return mock_cache_get


# Florida at home vs Georgia; scores and statuses mimic a game progressing in ~15-minute beats.
DEMO_SEQUENCE = (
    ("pregame", "Game not started", "Florida", 0, "Georgia", 0),
    ("~15 min", "tied", "Florida", 18, "Georgia", 18),
    ("~30 min", "winning_close", "Florida", 34, "Georgia", 31),
    ("~45 min", "winning_decisive", "Florida", 52, "Georgia", 35),
    ("~60 min", "winning_decisive", "Florida", 68, "Georgia", 48),
    ("final", "won_decisive", "Florida", 86, "Georgia", 62),
)


class Command(BaseCommand):
    help = "Send scripted health notifications (15-min-style progression + final) for Expo testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--push-token",
            required=True,
            help='Full token string, e.g. ExponentPushToken[xxxx] from the Expo/Metro log',
        )
        parser.add_argument(
            "--user-id",
            type=int,
            required=True,
            help="Existing app.models.User user_id (NotificationData rows are created per user)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print the sequence only; do not send pushes or touch the token getter",
        )
        parser.add_argument(
            "--delay-minutes",
            type=float,
            default=0.0,
            metavar="M",
            help=(
                "Minutes to wait after each notification before sending the next "
                "(decimals allowed, e.g. 0.1 = 6 seconds, 0.5 = 30 seconds). Default: 0."
            ),
        )

    def handle(self, *args, **options):
        token = options["push_token"].strip()
        user_id = options["user_id"]
        dry_run = options["dry_run"]
        delay_minutes = options["delay_minutes"]

        if delay_minutes < 0:
            raise CommandError("delay-minutes must be >= 0")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — no pushes will be sent."))
            if delay_minutes > 0:
                self.stdout.write(f"  (would use {delay_minutes} min delay between steps)")
            for label, status, h, hs, a, aws in DEMO_SEQUENCE:
                self.stdout.write(f"  [{label}] {status}  {h} {hs} - {a} {aws}")
            return

        try:
            _clear_demo_cache()
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(
                    "Could not clear notification cache keys (Redis may be rejecting writes, e.g. MISCONF). "
                    "Continuing. %s" % e
                )
            )

        def mock_get_tokens():
            return [{"push_token": token, "user_id": user_id}]

        real_get_users = app.utils.get_users_with_push_token
        real_cache_get = cache.get
        app.utils.get_users_with_push_token = mock_get_tokens
        cache.get = _patch_cache_get_for_send_notification(real_cache_get)

        try:
            for i, (label, status, home, hs, away, aws) in enumerate(DEMO_SEQUENCE):
                self.stdout.write(f"Sending [{label}] {status} ({home} {hs}, {away} {aws})")
                send_notification(status, home, hs, away, aws)
                is_final = i == len(DEMO_SEQUENCE) - 1
                if not is_final and delay_minutes > 0:
                    delay_sec = delay_minutes * 60.0
                    self.stdout.write(f"Waiting {delay_minutes} min ({delay_sec:g} s) before next notification...")
                    time.sleep(delay_sec)
        finally:
            cache.get = real_cache_get
            app.utils.get_users_with_push_token = real_get_users

        self.stdout.write(self.style.SUCCESS("Done. Sent %d notifications." % len(DEMO_SEQUENCE)))
