import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Requests push notification permission and returns the Expo push token string.
 * Returns null on simulators, web, or when permission is denied.
 */
export async function requestPushToken(): Promise<string | null> {
  // Push tokens are only available on physical devices
  if (!Device.isDevice) {
    return null;
  }

  // Web is not supported
  if (Platform.OS === "web") {
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    // Fails in Expo Go without a project ID configured; treat as non-fatal
    return null;
  }
}
