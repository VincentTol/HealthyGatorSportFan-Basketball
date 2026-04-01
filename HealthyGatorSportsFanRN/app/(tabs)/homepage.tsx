import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  StatusBar,
  Platform,
  Linking
} from 'react-native';
import { useNavigation, usePreventRemove, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TeamLogo } from '@/components/getTeamImages';
import User from '@/components/user';
import { AppUrls } from '@/constants/AppUrls';
import { Abbreviations } from '@/constants/Abbreviations';
import {
  MARCH_MADNESS_KNOCKOUT_MESSAGE,
  ScheduleGameRow,
  shouldShowMarchMadnessKnockout,
} from '@/constants/marchMadness';
import GlobalStyles from '../styles/GlobalStyles';
import { getSchedule } from '@/app/(tabs)/gameschedule';
import { registerForPushNotificationsAsync } from './notifications';
import { clearTokens } from "@/components/tokenStorage";


const TAB_VISUAL_H = 64;

export default function HomePage() {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser } = route.params as { currentUser: any };


  const insets = useSafeAreaInsets();
  const [bottomH, setBottomH] = useState<number>(TAB_VISUAL_H + insets.bottom);
  const padBottom = bottomH + 24; 

  const [loading, setLoading] = useState(false);
  const [scheduleGames, setScheduleGames] = useState<ScheduleGameRow[]>([]);
  const [scheduleLoadError, setScheduleLoadError] = useState(false);

  // next game data
  const [gameData, setGameData] = useState({
    home_team: '',
    away_team: '',
    date: '', // backend format: "MM-DD-YYYY HH:MM AM/PM" or "MM-DD-YYYY HH:MM:SS AM/PM"
  });

  // countdown
  const [countdownText, setCountdownText] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameData = async () => {
      setLoading(true);
      setScheduleLoadError(false);
      try {
        const [nextData, schedResp] = await Promise.all([getNextGame(), getSchedule()]);
        if (nextData) {
          setGameData({
            home_team: nextData.home_team,
            away_team: nextData.away_team,
            date: nextData.date,
          });
        }
        if (schedResp && 'data' in schedResp && schedResp.data) {
          setScheduleGames(schedResp.data as ScheduleGameRow[]);
        } else {
          setScheduleGames([]);
          setScheduleLoadError(true);
        }
      } catch (e) {
        console.error('Error fetching game data:', e);
        setScheduleLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchGameData();
    confirmNotifications(currentUser)
  }, []);

  useEffect(() => {
    if (!gameData.date) {
      setCountdownText(null);
      return;
    }
    setCountdownText(getCountdown(gameData.date));
    const timer = setInterval(() => {
      setCountdownText(getCountdown(gameData.date));
    }, 1000);
    return () => clearInterval(timer);
  }, [gameData.date]);

  // convert team name -> abbr -> logo
  const getAbbreviation = (teamName: string): string | null => Abbreviations[teamName] || null;
  const HomeLogo = TeamLogo.GetImage(getAbbreviation(gameData.home_team)?.toLowerCase() || '');
  const AwayLogo = TeamLogo.GetImage(getAbbreviation(gameData.away_team)?.toLowerCase() || '');

  // block back gesture
  usePreventRemove(true, () => {});

  const showMarchMadnessKnockout = shouldShowMarchMadnessKnockout(scheduleGames, {
    loading,
    error: scheduleLoadError,
  });

  // goal helpers
  function GetGoals(): string {
    if (currentUser.feelBetter && currentUser.loseWeight) return 'Lose weight and feel better';
    if (currentUser.feelBetter && !currentUser.loseWeight) return 'Feel better';
    return 'Lose weight';
  }


  return (

    <SafeAreaView style={GlobalStyles.container} edges={['top']}>
      <View
        style={[
          GlobalStyles.topMenu,
          {
            paddingHorizontal: 20,
            paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 22,
            paddingBottom: 10,
          },
        ]}
      >
        <Image
          source={require('./../../assets/images/clipboardgator.png')}
          style={{ width: 55, height: 55 }}
          resizeMode="cover"
        />
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#003DA5' }}>
          Hey, {currentUser.firstName}!
        </Text>
        <TouchableOpacity
          style={GlobalStyles.topIcons}
          activeOpacity={0.5}
          onPress={() => NavigateToNotifications(currentUser, navigation)}
        >
          <Image
            source={require('./../../assets/images/bell.png')}
            style={{ width: 40, height: 40, alignSelf: 'center' }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: padBottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.centerStack}>
          <View
            style={[
              styles.card,
              styles.gameCard,
              showMarchMadnessKnockout && styles.gameCardMmAccent,
            ]}
          >
            <Text style={styles.sectionTitle}>Next Game</Text>
            <View style={styles.underline} />

            {showMarchMadnessKnockout ? (
              <View style={styles.mmInCard} accessibilityRole="text">
                <Text style={styles.mmNoticeLabel}>🏀 March Madness</Text>
                <Text style={styles.mmNoticeText}>{MARCH_MADNESS_KNOCKOUT_MESSAGE}</Text>
                <Text style={styles.mmSubtext}>No upcoming tournament games on the schedule</Text>
              </View>
            ) : (
              <>
                {!!gameData.date && (
                  <View style={styles.chipsRow}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{countdownText ?? '—'}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.teamsRow}>
                  <View style={styles.teamSide}>
                    {loading ? (
                      <Text>Loading…</Text>
                    ) : HomeLogo ? (
                      <Image source={HomeLogo} style={styles.teamLogo} resizeMode="contain" />
                    ) : (
                      <Text>No Logo</Text>
                    )}
                  </View>

                  <View style={styles.vsBlock}>
                    <Text style={styles.matchupText}>
                      {gameData.home_team || '—'} <Text style={{ color: '#FA4616', fontWeight: '800' }}>vs</Text>{' '}
                      {gameData.away_team || '—'}
                    </Text>
                    <Text style={styles.dateText}>{gameData.date || ''}</Text>
                  </View>

                  <View style={styles.teamSide}>
                    {loading ? (
                      <Text>Loading…</Text>
                    ) : AwayLogo ? (
                      <Image source={AwayLogo} style={styles.teamLogo} resizeMode="contain" />
                    ) : (
                      <Text>No Logo</Text>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: '#003DA5' }]}
              onPress={() => NavigateToProcessLogging(currentUser, navigation)}
            >
              <Text style={styles.quickText}>Log Progress</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: '#FA4616' }]}
              onPress={() => NavigateToGameSchedule(currentUser, navigation)}
            >
              <Text style={styles.quickText}>Game Schedule</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.quickBtn, styles.newsBtn]}
            onPress={() => NavigateToGatorsNews(currentUser, navigation)}
          >
            <Text style={styles.quickText}>Gators News</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your Goal</Text>
            <View style={styles.underline} />

            <Text style={styles.line}>
              <Text style={styles.strong}>Current Goal: </Text>
              {GetGoals()}
            </Text>

            {currentUser.loseWeight && (
              <>
                <Text style={styles.line}>
                  <Text style={styles.strong}>Current Weight: </Text>
                  {Math.floor(currentUser.currentWeight)} lbs
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.strong}>Weight left to lose: </Text>
                  {Math.max(0, Math.floor(currentUser.currentWeight - currentUser.goalWeight))} lbs
                </Text>

                <View style={styles.progressWrap}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${computeProgress(
                          currentUser.currentWeight,
                          currentUser.goalWeight
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </>
            )}

            {currentUser.feelBetter && currentUser.lastRating !== 0 && (
              <Text style={styles.line}>
                <Text style={styles.strong}>Latest Feeling: </Text>
                {currentUser.lastRating} / 5 ⭐
              </Text>
            )}
            {currentUser.feelBetter && currentUser.lastRating === 0 && (
              <Text style={styles.line}>
                <Text style={styles.strong}>Latest Feeling: </Text>
                Once you check in, your latest rating will show up here!
              </Text>
            )}

            <TouchableOpacity
              style={[styles.cta, { marginTop: 18 }]}
              activeOpacity={0.8}
              onPress={() => NavigateToProgressDashboard(currentUser, navigation)}
            >
              <Text style={styles.ctaText}>View Progress Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cta} onPress={demoGameNotifications}>
              <Text onPress={() => {Linking.openURL('https://ufl.qualtrics.com/jfe/form/SV_3V4CndUea1oyhXE')}} style={styles.ctaText}>Take Post-Game Survey</Text>
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>

      <View
        onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}
        style={[GlobalStyles.bottomMenu, { paddingBottom: insets.bottom }]}
      >
        <TouchableOpacity style={GlobalStyles.bottomIcons} activeOpacity={0.5}>
          <Image
            source={require('../../assets/images/bottomHomeMenu/homeIcon.png')}
            style={{ width: 30, height: 30, alignSelf: 'center' }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={GlobalStyles.bottomIcons}
          activeOpacity={0.5}
          onPress={() => NavigateToGameSchedule(currentUser, navigation)}
        >
          <Image
            source={require('../../assets/images/bottomHomeMenu/calendarIcon.png')}
            style={{ width: 30, height: 30, alignSelf: 'center' }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={GlobalStyles.bottomIcons}
          activeOpacity={0.5}
          onPress={() => NavigateToProcessLogging(currentUser, navigation)}
        >
          <Image
            source={require('../../assets/images/bottomHomeMenu/plus.png')}
            style={{ width: 45, height: 45, alignSelf: 'center' }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={GlobalStyles.bottomIcons}
          activeOpacity={0.5}
          onPress={() => NavigateToProfileManagement(currentUser, navigation)}
        >
          <Image
            source={require('../../assets/images/bottomHomeMenu/defaultprofile.png')}
            style={{ width: 30, height: 30, alignSelf: 'center' }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={GlobalStyles.bottomIcons}
          activeOpacity={0.5}
          onPress={() => LogoutPopup(navigation)}
        >
          <Image
            source={require('../../assets/images/bottomHomeMenu/logoutIcon.png')}
            style={{ width: 30, height: 30, alignSelf: 'center' }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
function NavigateToGameSchedule(currentUser: any, navigation: any) {
  navigation.navigate('GameSchedule', { currentUser } as never);
}
function NavigateToGatorsNews(currentUser: any, navigation: any) {
  navigation.navigate('GatorsNews', { currentUser } as never);
}
function NavigateToNotifications(currentUser: any, navigation: any) {
  navigation.navigate('NotificationsPage', { currentUser } as never);
}
function NavigateToProfileManagement(currentUser: any, navigation: any) {
  navigation.navigate('ProfileManagement', { currentUser } as never);
}
function NavigateToProcessLogging(currentUser: any, navigation: any) {
  navigation.navigate('ProcessLogging', { currentUser } as never);
}
function NavigateToProgressDashboard(currentUser: any, navigation: any) {
  navigation.navigate('ProgressDashboard', { currentUser } as never);
}
function LogoutPopup(navigation: any) {
  Alert.alert('Confirmation', 'Are you sure you want logout?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Logout',
      style: 'destructive',
      onPress: () => {
        navigation.navigate('CreateOrSignIn' as never);
      },
    },
  ]);
  clearTokens();
}

export const getNextGame = async () => {
  try {
    const response = await fetch(`${AppUrls.url}/home-tile/`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (response.ok) return data; // {home_team, away_team, date}
  } catch (error) {
    console.error('Error getting next game:', error);
  }
};

const demoGameNotifications = async () => {
  // TODO: mock scoreboard & dummy polling if needed
};

const toDate = (s: string) => {
  if (!s) return null;
  const parts = s.trim().split(' ');
  if (parts.length < 3) return null;

  const [mdy, time, ampmRaw] = parts;
  const ampm = ampmRaw.toUpperCase();
  const [m, d, y] = mdy.split('-').map((n) => parseInt(n, 10));

  const timeBits = time.split(':').map((n) => parseInt(n, 10));
  let hh = timeBits[0] ?? 0;
  const mm = timeBits[1] ?? 0;
  const ss = timeBits[2] ?? 0;

  const isPM = ampm.includes('PM');
  const isAM = ampm.includes('AM');
  if (isPM && hh !== 12) hh += 12;
  if (isAM && hh === 12) hh = 0;

  return new Date(y, m - 1, d, hh, mm, ss || 0);
};

const getCountdown = (dateStr: string) => {
  const dt = toDate(dateStr);
  if (!dt) return null;

  const diff = dt.getTime() - Date.now();
  if (diff <= 0) return 'LIVE';

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days === 0) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

/* rough progress: how far from start weight to goal */
const computeProgress = (current: number, goal: number) => {
  const remaining = Math.max(0, current - goal);
  const start = current + remaining;
  if (start <= 0) return 0;
  const done = start - current;
  return Math.max(0, Math.min(100, Math.round((done / start) * 100)));
};

async function confirmNotifications(currentUser: any) {
    //method used to check if notifications are ready to be sent to user
    //ask for permission to send notifications | make sure ExpoPushToken is the same as User.push_token

    const pushTokenString = await registerForPushNotificationsAsync();
    if(pushTokenString && pushTokenString !== currentUser.push_token) {
        try {
            const updatedUser = {
                push_token: pushTokenString
            };
            await fetch(`${AppUrls.url}/user/${currentUser.userId}/`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedUser),
            });
        } catch {
            Alert.alert("Failure", "Failed to set notification settings");
        }
    }
}


const styles = StyleSheet.create({
  centerStack: {
    flex: 1,
    width: '92%',
    alignSelf: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
  },

  mmInCard: {
    marginTop: 4,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  mmNoticeLabel: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  mmNoticeText: {
    color: '#7C2D12',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
  mmSubtext: {
    color: '#C2410C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },

  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 10,
  },

  gameCard: { paddingBottom: 18 },
  gameCardMmAccent: {
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderLeftWidth: 5,
    borderLeftColor: '#FA4616',
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#003DA5',
    textAlign: 'center',
  },
  underline: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 8,
    width: 58,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#FA4616',
  },

  chipsRow: { alignItems: 'center', marginBottom: 4 },
  chip: {
    backgroundColor: '#E6EEF9',
    borderColor: '#B8D0FF',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { color: '#003DA5', fontWeight: '800' },

  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  teamSide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  teamLogo: { width: 96, height: 96 },

  vsBlock: { flex: 1.6, alignItems: 'center' },
  matchupText: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  dateText: { fontSize: 14, color: '#667085', marginTop: 6 },

  quickRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    alignSelf: 'center',
    marginTop: 8,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    alignItems: 'center',
  },
  newsBtn: {
    flex: 0,
    width: '100%',
    marginTop: 8,
    backgroundColor: '#0B3D91',
  },
  quickText: { color: '#fff', fontWeight: '900', letterSpacing: 0.2 },

  line: {
    fontSize: 16,
    color: '#111827',
    marginTop: 8,
  },
  strong: { fontWeight: '700' },

  progressWrap: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginTop: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FA4616',
  },

  cta: {
    backgroundColor: '#FA4616',
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 16,
  },
});
