import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { countAllPendingQueueItems } from "@/lib/storage/attachment-upload-queue";

const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function probeConnectivity(): Promise<boolean> {
  try {
    const response = await fetch(`${API_ORIGIN}/health`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default function SyncStatusBar() {
  const [pendingCount, setPendingCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function refresh() {
      const [count, isOnline] = await Promise.all([
        countAllPendingQueueItems(),
        probeConnectivity(),
      ]);

      if (!isCancelled) {
        setPendingCount(count);
        setOnline(isOnline);
        setLoaded(true);
      }
    }

    void refresh();

    const intervalId = setInterval(() => {
      void refresh();
    }, 15_000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  if (!loaded || pendingCount === 0) {
    return null;
  }

  const isOffline = !online;

  return (
    <View style={[styles.bar, isOffline && styles.barOffline]}>
      <Text style={[styles.text, isOffline && styles.textOffline]}>
        {isOffline
          ? `\uD83D\uDCF5 Saved locally \u2014 ${pendingCount} ${pendingCount === 1 ? "item" : "items"} waiting to sync (offline)`
          : `\u2601\uFE0F Saved locally \u2014 syncing ${pendingCount} ${pendingCount === 1 ? "item" : "items"}\u2026`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.accent,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  barOffline: {
    backgroundColor: COLORS.dangerMuted,
    borderColor: COLORS.danger,
  },
  text: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.label,
    fontWeight: "600",
  },
  textOffline: {
    color: COLORS.danger,
  },
});
