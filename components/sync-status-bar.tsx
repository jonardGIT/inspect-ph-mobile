import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { ListItem } from "@rneui/themed";

import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { API_BASE_URL } from "@/lib/api-base-url";
import { countAllPendingQueueItems } from "@/lib/storage/attachment-upload-queue";

async function probeConnectivity(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
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
  const itemWord = pendingCount === 1 ? "item" : "items";
  const message = isOffline
    ? `\uD83D\uDCF5 Saved locally \u2014 ${pendingCount} ${itemWord} waiting to sync (offline)`
    : `\u2601\uFE0F Saved locally \u2014 syncing ${pendingCount} ${itemWord}\u2026`;

  return (
    <ListItem
      containerStyle={[
        styles.bar,
        isOffline ? styles.barOffline : null,
      ]}
    >
      <ListItem.Content>
        <ListItem.Title
          style={[styles.text, isOffline ? styles.textOffline : null]}
        >
          {message}
        </ListItem.Title>
      </ListItem.Content>
    </ListItem>
  );
}

const styles = StyleSheet.create({
  bar: {
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
    fontSize: TYPOGRAPHY.caption,
    fontWeight: "500",
    textAlign: "center",
  },
  textOffline: {
    color: COLORS.danger,
  },
});

