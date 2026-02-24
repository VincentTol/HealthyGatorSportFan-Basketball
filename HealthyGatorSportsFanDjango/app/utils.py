from exponent_server_sdk import PushClient, PushMessage
import os
import logging
import requests
from datetime import date, datetime, timezone
from .models import User, NotificationData
from .serializers import UserSerializer
from django.core.cache import cache

logger = logging.getLogger(__name__)

# NCAA API (basketball live scores): https://ncaa-api.henrygd.me
NCAA_SCOREBOARD_URL = "https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1"


def get_cached_uf_games():
    """Fetch Florida basketball games from collegebasketballdata.com (cached 24h)."""
    current_year = datetime.now().year
    CACHE_KEY = f'uf_basketball_games_{current_year}'
    CACHE_TTL = 60 * 60 * 24  # 24 hours
    current_date_iso = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
    end_of_season = "2026-04-15T23:59:59Z"
    games_list = cache.get(CACHE_KEY)
    if games_list is not None:
        logger.info("Cache hit: Returning cached UF games.")
        return games_list
    logger.info("Cache miss: Fetching UF games from API.")
    try:
        url = "https://api.collegebasketballdata.com/games"
        params = {
            'startDateRange': current_date_iso,
            'endDateRange': end_of_season,
            'team': 'Florida',
            'conference': 'SEC'
        }
        headers = {'Authorization': f'Bearer {os.getenv("COLLEGE_BASKETBALL_API_KEY")}'}
        response = requests.get(url, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        # API may return a list or a dict with 'data' / 'games' key
        games_data = data if isinstance(data, list) else data.get('data') or data.get('games') or []
        if not isinstance(games_data, list):
            games_data = []
        cache.set(CACHE_KEY, games_data, timeout=CACHE_TTL)
        return games_data
    except requests.RequestException as e:
        logger.error("Error fetching UF games from CBBD API: %s", e)
        return None
    except Exception as e:
        logger.error("Unexpected error in get_cached_uf_games: %s", e)
        return None


def send_push_notification_next_game(header, users, message):
    sentTokens = set()
    for user in users:
        try:
            if user['push_token'] not in sentTokens:
                PushClient().publish(
                    PushMessage(
                        to=user['push_token'],
                        title=header,
                        body=message,
                    )
                )
                sentTokens.add(user['push_token'])

            user_instance = User.objects.get(user_id=user['user_id'])
            NotificationData.objects.create(
                user=user_instance,
                notification_title=header,
                notification_message=message,
            )

            
        except Exception as e:
            logger.warning("Could not send push notification: %s", e)


def get_users_with_push_token():
    uniqueTokens = set()
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    allUsers = serializer.data
    usersWithPushToken = list(filter(lambda user: user['push_token'], allUsers))

    return usersWithPushToken

def get_ncaa_basketball_scoreboard(date_path=None):
    """
    Fetch D1 men's basketball scoreboard from NCAA API.
    date_path: optional str like "2025/02/20" for YYYY/MM/DD. Omit for today.
    Returns list of game dicts with keys: home_name, away_name, home_score, away_score, game_state.
    """
    url = NCAA_SCOREBOARD_URL if not date_path else f"{NCAA_SCOREBOARD_URL}/{date_path}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
    except requests.RequestException as e:
        logger.warning("NCAA scoreboard request failed: %s", e)
        return []
    games = []
    for item in data.get("games") or []:
        g = item.get("game") or item
        home = g.get("home") or {}
        away = g.get("away") or {}
        home_names = home.get("names") or {}
        away_names = away.get("names") or {}
        home_score_raw = home.get("score") or "0"
        away_score_raw = away.get("score") or "0"
        try:
            home_score = int(home_score_raw) if home_score_raw else 0
        except (TypeError, ValueError):
            home_score = 0
        try:
            away_score = int(away_score_raw) if away_score_raw else 0
        except (TypeError, ValueError):
            away_score = 0
        games.append({
            "home_name": home_names.get("short") or home_names.get("full") or "Home",
            "away_name": away_names.get("short") or away_names.get("full") or "Away",
            "home_score": home_score,
            "away_score": away_score,
            "game_state": (g.get("gameState") or "pre").lower(),
        })
    return games


def check_game_status_basketball(scoreboard=None, curr_team_override=None):
    """
    Determine current team's basketball game status from NCAA API scoreboard.
    Team: curr_team_override if provided, else env CURR_TEAM (default 'Florida').
    Returns (game_status, home_team, home_score, away_team, away_score, game_completion_status).
    """
    if scoreboard is None:
        scoreboard = get_ncaa_basketball_scoreboard()
    curr_team = (curr_team_override or os.environ.get("CURR_TEAM", "Florida")).strip()
    if curr_team_override:
        logger.info("check_game_status_basketball: using team override %s", curr_team)
    curr_game = None
    for game in scoreboard:
        home_name = (game.get("home_name") or "").strip()
        away_name = (game.get("away_name") or "").strip()
        if home_name == curr_team or away_name == curr_team or curr_team in home_name or curr_team in away_name:
            curr_game = game
            break
    if not curr_game:
        logger.info("check_game_status_basketball: No game found for %s", curr_team)
        return "No game found", "", 0, "", 0, ""
    home_name = curr_game.get("home_name") or ""
    away_name = curr_game.get("away_name") or ""
    home_score = curr_game.get("home_score") or 0
    away_score = curr_game.get("away_score") or 0
    game_state = (curr_game.get("game_state") or "pre").lower()
    # Map NCAA API state to our status
    if game_state == "pre":
        logger.info("check_game_status_basketball: Game not started (%s vs %s)", home_name, away_name)
        return "Game not started", home_name, 0, away_name, 0, "scheduled"
    if home_name == curr_team or curr_team in home_name:
        florida_score = home_score
        opponent_score = away_score
    else:
        florida_score = away_score
        opponent_score = home_score
    score_diff = florida_score - opponent_score
    if game_state == "live":
        if score_diff >= 14:
            logger.info("check_game_status_basketball: winning_decisive (score_diff=%s)", score_diff)
            return "winning_decisive", home_name, home_score, away_name, away_score, "in_progress"
        elif 1 <= score_diff < 14:
            logger.info("check_game_status_basketball: winning_close (score_diff=%s)", score_diff)
            return "winning_close", home_name, home_score, away_name, away_score, "in_progress"
        elif score_diff == 0:
            logger.info("check_game_status_basketball: tied")
            return "tied", home_name, home_score, away_name, away_score, "in_progress"
        elif -14 < score_diff <= -1:
            logger.info("check_game_status_basketball: losing_close (score_diff=%s)", score_diff)
            return "losing_close", home_name, home_score, away_name, away_score, "in_progress"
        else:
            logger.info("check_game_status_basketball: losing_decisive (score_diff=%s)", score_diff)
            return "losing_decisive", home_name, home_score, away_name, away_score, "in_progress"
    elif game_state == "final":
        if score_diff >= 14:
            logger.info("check_game_status_basketball: won_decisive (score_diff=%s)", score_diff)
            return "won_decisive", home_name, home_score, away_name, away_score, "completed"
        elif 1 <= score_diff < 14:
            logger.info("check_game_status_basketball: won_close (score_diff=%s)", score_diff)
            return "won_close", home_name, home_score, away_name, away_score, "completed"
        elif -14 < score_diff <= -1:
            logger.info("check_game_status_basketball: lost_close (score_diff=%s)", score_diff)
            return "lost_close", home_name, home_score, away_name, away_score, "completed"
        else:
            logger.info("check_game_status_basketball: lost_decisive (score_diff=%s)", score_diff)
            return "lost_decisive", home_name, home_score, away_name, away_score, "completed"
    else:
        logger.info("check_game_status_basketball: Game not started (game_state=%s)", game_state)
        return "Game not started", home_name, 0, away_name, 0, "scheduled"


def send_notification(game_status: str, home_team: str, home_score: int, away_team: str, away_score: int):
    pushTokens = get_users_with_push_token()
    if pushTokens:
        message = {
            'predicted_win': "The Gators are predicted to win, and so are you! Plan wisely to meet your health goals this game day.",
            'predicted_lose': "Defeat the odds this game day by working hard to meet your health goals!",
            'winning_decisive': f"The Gators are up, and you should be, too! Make sure you are up and moving to meet your health goals today. Current score: {home_team}: {home_score}, {away_team}: {away_score}",
            'winning_close': f"Don't let your guard down just yet! Keep working to meet your health goals for today's game! Current score: {home_team}: {home_score}, {away_team}: {away_score}",
            'tied': f"Florida is tied! Current score: {home_team}: {home_score}, {away_team}: {away_score}",
            'losing_close': f"The Gators won't back down, so why should you? Work hard to meet your health goals today! Current score: {home_team}: {home_score}, {away_team}: {away_score}",
            'losing_decisive': f"The game isn't lost yet, and neither are your goals! Try to make healthy choices the rest of the game! Current score: {home_team}: {home_score}, {away_team}: {away_score}",
            'won_decisive': f"When the Gators win, you win! Make this win count by meeting your health goals, too! Current score: {home_team}: {home_score}, {away_team}: {away_score}",
            'won_close': f"Match the Gator's energy by keeping up with your health goals for today! Current score: {home_team}: {home_score}, {away_team}: {away_score}",
            'lost_close': f"Don't let a loss get you down! Keep an eye on your health journey, instead! Current score: {home_team}: {home_score}, {away_team}: {away_score}",
            'lost_decisive': f"Just because the Gators lost doesn't mean you have to! Make healthy choices after the game! Current score: {home_team}: {home_score}, {away_team}: {away_score}",
            'Game not started': "The game hasn't started yet. Get ready to meet your health goals when it does!",
            'No game found': ''
        }[game_status]
        print(f"Game status: {game_status}")
        current_score = f"{home_score}-{away_score}"
        last_score = cache.get('last_score')
        print(f"Last score: {last_score}")
        if game_status == 'No game found':
            return
        else:
            last_score = last_score.decode('utf-8') if last_score is not None else ""
            if game_status == 'Game not started':
                current_score = "Game not started"
            if last_score != current_score:
                send_push_notification_next_game("Health Notification", pushTokens, message)
                cache.set('last_score', current_score)