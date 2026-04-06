import * as Notifications from "expo-notifications";

let configured = false;

export function ensureNotificationsConfigured() {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      // this is iOS app icon badge count; we render our own in-app badge.
      shouldSetBadge: false,
    }),
  });
}

