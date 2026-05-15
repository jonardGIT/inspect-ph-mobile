import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { countAllPendingQueueItems } from "@/lib/storage/attachment-upload-queue";

export default function SyncStatusBar() {
  const [pendingCount, setPendingCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function refresh() {
      const count = await countAllPendingQueueItems();

      if (!isCancelled) {
        setPendingCount(count);
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

  return (
    <View style={styles.bar}>
      <Text style={styles.text}>
        {pendingCount} pending {pendingCount === 1 ? "item" : "items"} queued
        for sync
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    alignItems: "center",
  },
  text: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.label,
    fontWeight: "600",
  },
});
