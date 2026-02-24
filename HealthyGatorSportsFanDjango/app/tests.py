"""Unit tests for basketball game status (NCAA API)."""
from django.test import TestCase
from app.utils import check_game_status_basketball


def _scoreboard(home_name, away_name, home_score, away_score, game_state="live"):
    return [{
        "home_name": home_name,
        "away_name": away_name,
        "home_score": home_score,
        "away_score": away_score,
        "game_state": game_state,
    }]


# Team used in tests (avoids depending on CURR_TEAM env).
_TEST_TEAM = "Florida"


def _check(scoreboard, curr_team_override=_TEST_TEAM):
    return check_game_status_basketball(scoreboard=scoreboard, curr_team_override=curr_team_override)


class CheckGameStatusBasketballTestCase(TestCase):
    """Tests for check_game_status_basketball using NCAA scoreboard format."""

    def test_no_game_found(self):
        status, _, _, _, _, comp = _check([])
        self.assertEqual(status, "No game found")
        self.assertEqual(comp, "")

    def test_game_not_started(self):
        scoreboard = _scoreboard("Florida", "Opponent", 0, 0, "pre")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "Game not started")
        self.assertEqual(comp, "scheduled")

    def test_losing_decisive(self):
        scoreboard = _scoreboard("Florida", "Opponent", 0, 20, "live")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "losing_decisive")
        self.assertEqual(comp, "in_progress")

    def test_losing_close(self):
        scoreboard = _scoreboard("Florida", "Opponent", 10, 20, "live")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "losing_close")
        self.assertEqual(comp, "in_progress")

    def test_tied(self):
        scoreboard = _scoreboard("Florida", "Opponent", 50, 50, "live")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "tied")
        self.assertEqual(comp, "in_progress")

    def test_winning_close(self):
        scoreboard = _scoreboard("Florida", "Opponent", 60, 55, "live")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "winning_close")
        self.assertEqual(comp, "in_progress")

    def test_winning_decisive(self):
        scoreboard = _scoreboard("Florida", "Opponent", 80, 60, "live")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "winning_decisive")
        self.assertEqual(comp, "in_progress")

    def test_won_decisive(self):
        scoreboard = _scoreboard("Florida", "Opponent", 85, 70, "final")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "won_decisive")
        self.assertEqual(comp, "completed")

    def test_won_close(self):
        scoreboard = _scoreboard("Florida", "Opponent", 72, 68, "final")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "won_close")
        self.assertEqual(comp, "completed")

    def test_lost_close(self):
        scoreboard = _scoreboard("Florida", "Opponent", 68, 72, "final")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "lost_close")
        self.assertEqual(comp, "completed")

    def test_lost_decisive(self):
        scoreboard = _scoreboard("Florida", "Opponent", 55, 80, "final")
        status, _, _, _, _, comp = _check(scoreboard)
        self.assertEqual(status, "lost_decisive")
        self.assertEqual(comp, "completed")

    def test_florida_away(self):
        scoreboard = _scoreboard("Opponent", "Florida", 50, 70, "live")
        status, h, hs, a, as_, comp = _check(scoreboard)
        self.assertEqual(status, "winning_decisive")
        self.assertEqual(h, "Opponent")
        self.assertEqual(hs, 50)
        self.assertEqual(a, "Florida")
        self.assertEqual(as_, 70)
