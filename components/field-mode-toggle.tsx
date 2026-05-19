import { Button } from "@rneui/themed";

import { RADIUS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useFieldMode } from "@/hooks/use-field-mode";

export default function FieldModeToggle() {
  const { fieldMode, toggleFieldMode, colors, minTouchSize } = useFieldMode();

  return (
    <Button
      title={fieldMode ? "\u2600 Field mode ON" : "\u2600 Field mode"}
      type={fieldMode ? "solid" : "outline"}
      onPress={toggleFieldMode}
      accessibilityRole="button"
      accessibilityLabel={
        fieldMode ? "Disable field mode" : "Enable field mode (high contrast)"
      }
      buttonStyle={{
        backgroundColor: fieldMode ? colors.primary : "transparent",
        borderColor: fieldMode ? colors.primary : colors.border,
        borderRadius: RADIUS.md,
        minHeight: minTouchSize,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
      }}
      titleStyle={{
        color: fieldMode ? colors.background : colors.textSubtle,
        fontSize: TYPOGRAPHY.label,
        fontWeight: "600",
      }}
    />
  );
}
