from exponent_server_sdk import PushClient, PushMessage
import os
import logging
import re
import requests
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone, timedelta
from .models import User, NotificationData
from .serializers import UserSerializer
from django.core.cache import cache

logger = logging.getLogger(__name__)

# NCAA API (basketball live scores): https://ncaa-api.henrygd.me
NCAA_SCOREBOARD_URL = "https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1"

# In-game health notifications: at most once per interval; always once when game reaches final.
HEALTH_NOTIF_MIN_INTERVAL = timedelta(minutes=15)
HEALTH_NOTIF_GAME_CTX_KEY = "health_notif_game_ctx"
HEALTH_NOTIF_LAST_SENT_KEY = "health_notif_last_sent_at"
HEALTH_NOTIF_FINAL_SIG_KEY = "health_notif_final_signature"
_HEALTH_NOTIF_CACHE_TTL = 60 * 60 * 12
_FINAL_GAME_STATUSES = frozenset({
    "won_decisive", "won_close", "lost_close", "lost_decisive",
})


def _cache_str(value):
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def _should_send_health_notification(game_status, home_team, away_team, home_score, away_score):
    """
    Return True if a push should go out: always for a new final scoreline (end of game),
    otherwise at most once per HEALTH_NOTIF_MIN_INTERVAL for that matchup.
    """
    if game_status == "No game found":
        return False

    game_ctx = f"{home_team}|{away_team}"
    prev_ctx = _cache_str(cache.get(HEALTH_NOTIF_GAME_CTX_KEY))
    if prev_ctx != game_ctx:
        cache.set(HEALTH_NOTIF_GAME_CTX_KEY, game_ctx, timeout=_HEALTH_NOTIF_CACHE_TTL)
        cache.delete(HEALTH_NOTIF_LAST_SENT_KEY)
        cache.delete(HEALTH_NOTIF_FINAL_SIG_KEY)

    if game_status in _FINAL_GAME_STATUSES:
        sig = f"{game_ctx}|{home_score}|{away_score}|final"
        prev_sig = _cache_str(cache.get(HEALTH_NOTIF_FINAL_SIG_KEY))
        return prev_sig != sig

    now = datetime.now(timezone.utc)
    raw_last = cache.get(HEALTH_NOTIF_LAST_SENT_KEY)
    if raw_last is None:
        return True
    try:
        last_sent = datetime.fromisoformat(_cache_str(raw_last))
    except (TypeError, ValueError):
        return True
    if last_sent.tzinfo is None:
        last_sent = last_sent.replace(tzinfo=timezone.utc)
    return (now - last_sent) >= HEALTH_NOTIF_MIN_INTERVAL


def _mark_health_notification_sent(game_status, home_team, away_team, home_score, away_score):
    game_ctx = f"{home_team}|{away_team}"
    now = datetime.now(timezone.utc)
    if game_status in _FINAL_GAME_STATUSES:
        sig = f"{game_ctx}|{home_score}|{away_score}|final"
        cache.set(HEALTH_NOTIF_FINAL_SIG_KEY, sig, timeout=_HEALTH_NOTIF_CACHE_TTL)
    cache.set(HEALTH_NOTIF_LAST_SENT_KEY, now.isoformat(), timeout=_HEALTH_NOTIF_CACHE_TTL)


def get_basketball_season_range(reference_dt=None):
    """
    Return ISO UTC start/end strings for the current basketball season.
    Season spans Nov 1 through Apr 30 across calendar years.
    """
    now_utc = reference_dt or datetime.now(timezone.utc)
    if now_utc.month >= 11:
        season_start_year = now_utc.year
        season_end_year = now_utc.year + 1
    else:
        season_start_year = now_utc.year - 1
        season_end_year = now_utc.year

    start_of_season = f"{season_start_year}-11-01T00:00:00Z"
    end_of_season = f"{season_end_year}-04-30T23:59:59Z"
    season_key = f"{season_start_year}_{season_end_year}"
    return start_of_season, end_of_season, season_key


def get_cached_uf_games():
    """Fetch Florida basketball games from collegebasketballdata.com (cached 24h)."""
    start_of_season, end_of_season, season_key = get_basketball_season_range()
    CACHE_KEY = f'uf_basketball_games_{season_key}'
    CACHE_TTL = 60 * 60 * 24  # 24 hours
    games_list = cache.get(CACHE_KEY)
    if games_list is not None:
        logger.info("Cache hit: Returning cached UF games.")
        return games_list
    logger.info("Cache miss: Fetching UF games from API.")
    try:
        url = "https://api.collegebasketballdata.com/games"
        params = {
            'startDateRange': start_of_season,
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
        if game_status == "No game found":
            return
        if not _should_send_health_notification(
            game_status, home_team, away_team, home_score, away_score
        ):
            return
        send_push_notification_next_game("Health Notification", pushTokens, message)
        _mark_health_notification_sent(game_status, home_team, away_team, home_score, away_score)


# News: Google News RSS (free, no API key, no limit).
GATORS_NEWS_CACHE_KEY = "gators_basketball_news"
GATORS_NEWS_CACHE_TTL = 60 * 60  # 1 hour
GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search?q=Florida+Gators+basketball&hl=en-US&gl=US&ceid=US:en"


def _tag_local(tag):
    """Return local part of tag (no namespace)."""
    if not tag:
        return ""
    return tag.split("}")[-1] if "}" in tag else tag


def _find_child(parent, local_name):
    """Find direct child by local tag name."""
    for c in parent:
        if _tag_local(c.tag) == local_name:
            return c
    return None


def _find_text(parent, local_name):
    """Get text of first child with given local name."""
    el = _find_child(parent, local_name)
    return (el.text or "").strip() if el is not None else ""


def _parse_google_news_rss():
    """Fetch and parse Google News RSS for Florida Gators basketball. No API key. Returns list of article dicts."""
    result = []
    try:
        resp = requests.get(GOOGLE_NEWS_RSS_URL, timeout=10, headers={"User-Agent": "HealthyGatorSportsFan/1.0"})
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        for elem in root.iter():
            if _tag_local(elem.tag) != "item":
                continue
            title = _find_text(elem, "title")
            if not title:
                continue
            link = _find_text(elem, "link")
            src_el = _find_child(elem, "source")
            if src_el is not None and src_el.get("url"):
                link = link or (src_el.get("url") or "")
            source_name = (src_el.text or "").strip() if src_el is not None else "Google News"
            pub_date = _find_text(elem, "pubDate")
            description = _find_text(elem, "description")
            if description:
                description = re.sub(r"<[^>]+>", "", description)[:300].strip() or None
            result.append({
                "title": title,
                "url": link or "",
                "source": source_name or "News",
                "publishedAt": pub_date,
                "description": description,
                "urlToImage": None,
            })
            if len(result) >= 20:
                break
    except Exception as e:
        logger.warning("Google News RSS fetch failed: %s", e)
    return result


def get_gators_basketball_news():
    """
    Fetch Florida Gators basketball news from Google News RSS (cached 1 hour).
    No API key required. Returns list of dicts: title, url, source, publishedAt, description, urlToImage.
    """
    cached = cache.get(GATORS_NEWS_CACHE_KEY)
    if cached is not None:
        logger.info("Cache hit: Returning cached Gators news.")
        return cached
    result = _parse_google_news_rss()
    if result:
        cache.set(GATORS_NEWS_CACHE_KEY, result, timeout=GATORS_NEWS_CACHE_TTL)
    return result