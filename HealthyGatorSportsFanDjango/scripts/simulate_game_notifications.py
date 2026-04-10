#!/usr/bin/env python3
"""
Simulate a full NCAA-style basketball game (play-by-play score updates) and drive
send_notification() so you can verify push frequency (throttling, coarse buckets, timer).

Run from the Django project root (folder containing manage.py), with venv activated:

  python scripts/simulate_game_notifications.py

Defaults to a safe dry-run (no Expo, no NotificationData rows).

Real device push (see UpgradeSDK.txt): copy ExponentPushToken and user_id from the Expo log,
then:

  python scripts/simulate_game_notifications.py --send \\
    --push-token "ExponentPushToken[xxxx]" --user-id 1

Options:
  --send             Call Expo and write NotificationData (requires --push-token and --user-id).
  --minutes-per-poll Advance the fake clock by this many minutes between each score state
                     (use with --test-timer to exercise the 15-minute interval).
  --test-timer       Shrink SCORE_NOTIFY_MIN_INTERVAL to 5 minutes for faster timer checks
                     (only affects this process while the script runs).
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

# Django project root = parent of scripts/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "project.settings")

try:
    import django  # type: ignore[import-not-found]
except ModuleNotFoundError as exc:
    raise SystemExit(
        "Django is not on PYTHONPATH (activate the project venv, then run this script again).\n"
        f"  Example: venv\\Scripts\\activate  (Windows) or source venv/bin/activate\n"
        f"  Then: python \"{os.path.join(PROJECT_ROOT, 'scripts', 'simulate_game_notifications.py')}\""
    ) from exc

django.setup()

import app.utils as app_utils
from app.utils import SCORE_NOTIFY_CACHE_KEY, check_game_status_basketball, send_notification
from django.core.cache import cache  # type: ignore[import-not-found]


def _build_scoreboard(home_score: int, away_score: int, game_state: str):
    """Florida at home vs Georgia (matches CURR_TEAM / check_game_status_basketball)."""
    return [
        {
            "home_name": "Florida",
            "away_name": "Georgia",
            "home_score": home_score,
            "away_score": away_score,
            "game_state": game_state,
        }
    ]


def iter_full_game_events():
    """
    Yield (game_state, home_score, away_score) for each poll the backend might see.
    Includes pregame, many live scoring steps, and a final. Designed to stress:
    - decisive/close oscillation (same coarse bucket)
    - lead changes (coarse bucket changes)
    - margin jumps >= 8 within a bucket
    - final transition
    """
    # Pregame
    yield "pre", 0, 0

    # Live: back-and-forth, mostly 2–3 point swings (realistic pace)
    live_sequence = [
        (0, 0),
        (2, 0),
        (2, 3),
        (5, 3),
        (5, 5),
        (8, 5),
        (8, 8),
        (11, 8),
        (11, 11),
        (14, 11),
        (14, 14),
        (17, 14),
        (17, 17),
        (20, 17),
        (20, 20),
        (23, 20),
        (23, 23),
        (26, 23),
        (26, 26),
        (29, 26),
        (29, 29),
        (32, 29),
        (32, 32),
        (35, 32),
        (35, 35),
        (38, 35),
        (38, 38),
        (41, 38),
        (41, 41),
        (44, 41),
        (44, 44),
        (47, 44),
        (47, 47),
        (50, 47),
        # Florida pulls ahead into "close" lead
        (53, 47),
        (53, 50),
        (56, 50),
        (56, 53),
        (59, 53),
        (59, 56),
        (62, 56),
        # Oscillate across 14-pt boundary (decisive <-> close), same coarse live_winning
        (76, 60),  # +16 decisive
        (76, 63),  # +13 close
        (79, 63),  # +16 decisive
        (79, 66),  # +13 close
        (82, 66),  # +16 decisive
        (82, 69),  # +13 close
        # Big margin swing in one step (>= 8 vs last notify snapshot) — may trigger
        (90, 69),  # +21
        # Opponent run: lose lead (coarse change)
        (90, 78),
        (90, 81),
        (90, 84),
        (90, 87),
        (90, 90),
        (90, 93),  # Florida behind
        # Comeback
        (93, 93),
        (96, 93),
        (96, 96),
        (99, 96),
    ]

    for h, a in live_sequence[1:]:
        yield "live", h, a

    # Final: Florida wins close game
    yield "final", 99, 96


def main():
    parser = argparse.ArgumentParser(description="Simulate game notifications / push frequency.")
    parser.add_argument(
        "--send",
        action="store_true",
        help="Send real Expo pushes and create NotificationData rows (needs token + user id).",
    )
    parser.add_argument(
        "--push-token",
        default=os.environ.get("EXPO_PUSH_TOKEN", ""),
        help="ExponentPushToken[...] from Expo dev logs (or set EXPO_PUSH_TOKEN).",
    )
    parser.add_argument(
        "--user-id",
        type=int,
        default=int(os.environ.get("NOTIFY_TEST_USER_ID", "0")) or None,
        help="Django user_id that owns the token (required with --send).",
    )
    parser.add_argument(
        "--minutes-per-poll",
        type=float,
        default=0.0,
        help="Advance fake wall clock by this many minutes between each score (timer testing).",
    )
    parser.add_argument(
        "--test-timer",
        action="store_true",
        help="Set SCORE_NOTIFY_MIN_INTERVAL to 5 minutes for this run (use with --minutes-per-poll).",
    )
    parser.add_argument(
        "--no-clear-cache",
        action="store_true",
        help="Do not delete score notify throttle cache before running.",
    )
    args = parser.parse_args()

    if args.send:
        if not args.push_token or not args.user_id:
            print(
                "With --send, provide --push-token and --user-id "
                "(or EXPO_PUSH_TOKEN / NOTIFY_TEST_USER_ID).",
                file=sys.stderr,
            )
            sys.exit(1)

    if not args.no_clear_cache:
        cache.delete(SCORE_NOTIFY_CACHE_KEY)
        print(f"Cleared cache key: {SCORE_NOTIFY_CACHE_KEY}")

    def mock_get_users():
        return [
            {
                "push_token": args.push_token or "ExponentPushToken[dry-run]",
                "user_id": args.user_id or 1,
            }
        ]

    app_utils.get_users_with_push_token = mock_get_users

    notify_count = 0
    _orig_send = app_utils.send_push_notification_next_game

    def wrapped_send_push(header, users, message):
        nonlocal notify_count
        notify_count += 1
        print(f"  >>> NOTIFY #{notify_count}: {header}")
        print(f"      {message[:220]}{'...' if len(message) > 220 else ''}")
        if args.send:
            return _orig_send(header, users, message)
        return None

    app_utils.send_push_notification_next_game = wrapped_send_push

    if args.test_timer:
        app_utils.SCORE_NOTIFY_MIN_INTERVAL = timedelta(minutes=5)
        print("SCORE_NOTIFY_MIN_INTERVAL overridden to 5 minutes for this run.")

    # Python 3.12+: datetime.datetime is immutable — patch.object(now=...) fails.
    # Swap app.utils.datetime for a subclass whose now() returns an advancing fake wall clock.
    _orig_datetime_class = app_utils.datetime
    clock_holder = [datetime(2025, 1, 15, 18, 0, 0, tzinfo=timezone.utc)]

    class _FixedNowDatetime(_orig_datetime_class):
        @classmethod
        def now(cls, tz=None):
            return clock_holder[0]

    def tick_clock():
        clock_holder[0] += timedelta(minutes=args.minutes_per_poll)

    total_polls = 0

    def run_one_poll(game_state: str, hs: int, as_: int):
        nonlocal total_polls
        total_polls += 1
        sb = _build_scoreboard(hs, as_, game_state)
        status, ht, hsc, at, asc, _ = check_game_status_basketball(scoreboard=sb)
        print(
            f"\n--- Poll {total_polls}: state={game_state} score={hsc}-{asc} "
            f"=> status={status} ---"
        )
        send_notification(status, ht, hsc, at, asc)

    try:
        app_utils.datetime = _FixedNowDatetime
        for game_state, hs, as_ in iter_full_game_events():
            run_one_poll(game_state, hs, as_)
            tick_clock()
    finally:
        app_utils.datetime = _orig_datetime_class

    print("\n" + "=" * 60)
    print(f"Total scoreboard polls: {total_polls}")
    print(f"Push notifications sent: {notify_count}")
    if notify_count < total_polls:
        print(f"(Throttling working: fewer than one notification per poll; {total_polls - notify_count} skipped.)")
    else:
        print("(If notify_count equals polls, review throttling — likely too noisy.)")
    if not args.send:
        print("Dry-run only (no Expo / DB). Use --send with token and user id for a real device test.")
    print("=" * 60)


if __name__ == "__main__":
    main()
