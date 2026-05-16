import { Pressable, StyleSheet, Text } from "react-native";

import { SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useFieldMode } from "@/hooks/use-field-mode";

export default function FieldModeToggle() {
  const { fieldMode, toggleFieldMode, colors, minTouchSize } = useFieldMode();

  return (
    <Pressable
      onPress={toggleFieldMode}
      accessibilityRole="button"
      accessibilityLabel={
        fieldMode ? "Disable field mode" : "Enable field mode (high contrast)"
      }
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: fieldMode ? colors.primary : colors.backgroundMuted,
          borderColor: fieldMode ? colors.primary : colors.border,
          minHeight: minTouchSize,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: fieldMode ? colors.background : colors.textSubtle },
        ]}
      >
        {fieldMode ? "☀ Field mode ON" : "☀ Field mode"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.label,
    fontWeight: "600",
  },
});
