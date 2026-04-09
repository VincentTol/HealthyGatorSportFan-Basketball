import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";

import { AppUrls } from "@/constants/AppUrls";

type Props = {
  currentUserId?: number | null;
  onPress: () => void;
  size?: number;
};

async function fetchUnreadCount(userId: number): Promise<number> {
  const res = await fetch(`${AppUrls.url}/notificationdata/${userId}/`);
  if (!res.ok) return 0;
  const data = await res.json();
  if (!Array.isArray(data)) return 0;
  return data.filter((n) => n && n.read_status === false).length;
}

export default function NotificationBell({ currentUserId, onPress, size = 40 }: Props) {
  const [unreadCount, setUnreadCount] = useState(0);
  const inFlight = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = currentUserId ?? undefined;
  const showBadge = unreadCount > 0;
  const badgeText = useMemo(() => (unreadCount > 99 ? "99+" : String(unreadCount)), [unreadCount]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const count = await fetchUnreadCount(userId);
      setUnreadCount(count);
    } finally {
      inFlight.current = false;
    }
  }, [userId]);

  const scheduleRefresh = useCallback(
    (delayMs: number) => {
      if (!userId) return;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refresh();
      }, delayMs);
    },
    [refresh, userId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // Fast feedback, then reconcile with backend.
      setUnreadCount((c) => Math.max(0, c + 1));
      scheduleRefresh(500);
    });

    // If the user taps a notification (app backgrounded), refresh when we regain control.
    const responseSub = Notifications.addNotificationResponseReceivedListener(() => {
      scheduleRefresh(0);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        scheduleRefresh(0);
      }
    });
    return () => sub.remove();
  }, [scheduleRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  return (
    <TouchableOpacity style={styles.touch} activeOpacity={0.5} onPress={onPress}>
      <View style={styles.wrap}>
        <Image
          source={require("./../assets/images/bell.png")}
          style={{ width: size, height: size, alignSelf: "center" }}
          resizeMode="contain"
        />
        {showBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: {
    // keeps parity with existing usage (often wrapped in GlobalStyles.topIcons)
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});

