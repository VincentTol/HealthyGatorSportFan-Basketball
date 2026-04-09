import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppUrls } from '@/constants/AppUrls';
import GlobalStyles from '../styles/GlobalStyles';

type UserDataPoint = {
  data_id: number;
  user: number;
  timestamp: string;
  goal_type: string;
  /** API may send DecimalField as a string (DRF default). */
  weight_value: number | string | null;
  feel_better_value: number | null;
};

/** DRF serializes DecimalField as string in JSON; mood is IntegerField so it stays a number. */
function numericWeight(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export default function ProgressDashboard() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { currentUser } = route.params as { currentUser: any };

  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<UserDataPoint[]>([]);

  useEffect(() => {
    const fetchAllUserData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${AppUrls.url}/userdata/all/${currentUser.userId}/`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setEntries([]);
            setLoading(false);
            return;
          }
          throw new Error(`Status ${response.status}`);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
          setEntries(data);
        } else {
          setEntries([]);
        }
      } catch (e) {
        console.error('Error fetching user data history', e);
        setError('Unable to load your progress history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllUserData();
  }, [currentUser.userId]);

  const { weightEntries, moodEntries } = useMemo(() => {
    const weightEntries = entries
      .filter((e) => numericWeight(e.weight_value) != null)
      .slice()
      .reverse();

    const moodEntries = entries
      .filter((e) => typeof e.feel_better_value === 'number' && (e.feel_better_value ?? 0) > 0)
      .slice()
      .reverse();

    return { weightEntries, moodEntries };
  }, [entries]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleBackToHome = () => {
    navigation.navigate('HomePage', { currentUser } as never);
  };

  return (
    <SafeAreaView style={[GlobalStyles.container, { backgroundColor: '#F7F9FF' }]} edges={['top']}>
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
        <TouchableOpacity onPress={handleBackToHome} activeOpacity={0.7} style={{ paddingRight: 8 }}>
          <Text style={{ fontSize: 18, color: '#0021A5', fontWeight: '700' }}>{'‹ Back'}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontFamily: 'System', color: '#0021A5', fontWeight: '700' }}>
          Your Progress
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color="#0021A5" />
          <Text style={styles.subtleText}>Loading your history…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[GlobalStyles.confirmButton, { marginTop: 12 }]}
            onPress={() => {
              Alert.alert('Please try again from the home screen.');
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>OK</Text>
          </TouchableOpacity>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyTitle}>No progress logged yet</Text>
          <Text style={styles.emptySubtitle}>
            Once you start logging check-ins, your history will show up here.
          </Text>
          <TouchableOpacity
            style={[GlobalStyles.confirmButton, { marginTop: 16 }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ProcessLogging', { currentUser } as never)}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Log your first check-in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: 18,
            paddingTop: 10,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Weight Over Time</Text>
            <View style={styles.underline} />
            {weightEntries.length === 0 ? (
              <Text style={styles.subtleText}>You have no weight entries yet.</Text>
            ) : (
              weightEntries.map((entry) => {
                const w = numericWeight(entry.weight_value);
                return (
                  <View key={entry.data_id} style={styles.weightRow}>
                    <Text style={styles.rowTitle}>{formatDate(entry.timestamp)}</Text>
                    <Text style={styles.rowSubtitle}>{w} lbs</Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>How You’ve Been Feeling</Text>
            <View style={styles.underline} />
            {moodEntries.length === 0 ? (
              <Text style={styles.subtleText}>You have no feel-better ratings yet.</Text>
            ) : (
              moodEntries.map((entry) => (
                <View key={entry.data_id} style={styles.rowItem}>
                  <View style={styles.rowLabel}>
                    <Text style={styles.rowTitle}>{formatDate(entry.timestamp)}</Text>
                    <Text style={styles.rowSubtitle}>{entry.feel_better_value} / 5 ⭐</Text>
                  </View>
                  <View style={styles.rowBarTrack}>
                    <View
                      style={[
                        styles.rowBarFillMood,
                        {
                          width: `${Math.max(
                            10,
                            Math.min(100, Math.round(((entry.feel_better_value ?? 0) / 5) * 100))
                          )}%` as any,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  subtleText: {
    marginTop: 8,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
    fontSize: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0021A5',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#003DA5',
    textAlign: 'center',
  },
  underline: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 8,
    width: 50,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#FA4616',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  rowLabel: {
    flex: 1.2,
    paddingRight: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  weightRow: {
    marginTop: 12,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  rowBarFillMood: {
    height: '100%',
    backgroundColor: '#16A34A',
  },
});

