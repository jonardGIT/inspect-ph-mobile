import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "@/constants/theme";

export function AppHero(input: {
  eyebrow: string;
  title: string;
  description: string;
  trailing?: ReactNode;
}) {
  return (
    <LinearGradient
      colors={[COLORS.primaryDeep, COLORS.primary, COLORS.accent]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.heroCard}
    >
      <View style={styles.heroTextBlock}>
        <Text style={styles.eyebrow}>{input.eyebrow}</Text>
        <Text style={styles.heroTitle}>{input.title}</Text>
        <Text style={styles.heroDescription}>{input.description}</Text>
      </View>
      {input.trailing ? (
        <View style={styles.heroTrailing}>{input.trailing}</View>
      ) : null}
    </LinearGradient>
  );
}

export function SurfaceCard(input: {
  children: ReactNode;
  style?: ViewStyle;
  tone?: "default" | "muted" | "accent";
}) {
  return (
    <View
      style={[
        styles.surfaceCard,
        input.tone === "muted" ? styles.surfaceMuted : null,
        input.tone === "accent" ? styles.surfaceAccent : null,
        input.style,
      ]}
    >
      {input.children}
    </View>
  );
}

export function SectionHeading(input: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTextBlock}>
        <Text style={styles.sectionTitle}>{input.title}</Text>
        {input.description ? (
          <Text style={styles.sectionDescription}>{input.description}</Text>
        ) : null}
      </View>
      {input.action}
    </View>
  );
}

export function MetricTile(input: {
  label: string;
  value: number | string;
  tone?: "primary" | "secondary" | "accent" | "default";
}) {
  return (
    <View
      style={[
        styles.metricTile,
        input.tone === "primary" ? styles.metricPrimary : null,
        input.tone === "secondary" ? styles.metricSecondary : null,
        input.tone === "accent" ? styles.metricAccent : null,
      ]}
    >
      <Text style={styles.metricValue}>{input.value}</Text>
      <Text style={styles.metricLabel}>{input.label}</Text>
    </View>
  );
}

export function StatusBadge(input: {
  label: string;
  tone?: "info" | "success" | "warning" | "danger" | "default";
}) {
  return (
    <View
      style={[
        styles.badge,
        input.tone === "info" ? styles.badgeInfo : null,
        input.tone === "success" ? styles.badgeSuccess : null,
        input.tone === "warning" ? styles.badgeWarning : null,
        input.tone === "danger" ? styles.badgeDanger : null,
      ]}
    >
      <Text style={styles.badgeLabel}>{input.label}</Text>
    </View>
  );
}

export function AppButton(
  input: PressableProps & {
    label: string;
    tone?: "primary" | "secondary" | "ghost";
    fullWidth?: boolean;
  },
) {
  const {
    label,
    tone = "primary",
    fullWidth,
    disabled,
    style,
    ...pressableProps
  } = input;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state: PressableStateCallbackType) => [
        styles.button,
        tone === "primary" ? styles.buttonPrimary : null,
        tone === "secondary" ? styles.buttonSecondary : null,
        tone === "ghost" ? styles.buttonGhost : null,
        fullWidth ? styles.buttonFullWidth : null,
        state.pressed ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        typeof style === "function" ? style(state) : style,
      ]}
      {...pressableProps}
    >
      <Text
        style={[
          styles.buttonLabel,
          tone === "secondary" ? styles.buttonLabelSecondary : null,
          tone === "ghost" ? styles.buttonLabelGhost : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function InfoRow(input: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{input.label}</Text>
      <Text style={styles.infoValue}>{input.value}</Text>
    </View>
  );
}

export function AppRecordCard(input: {
  children?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  title?: string;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {input.title || input.trailing ? (
        <View style={styles.recordCardHeader}>
          {input.title ? (
            <Text style={styles.recordCardTitle}>{input.title}</Text>
          ) : (
            <View />
          )}
          {input.trailing}
        </View>
      ) : null}
      {input.children}
    </>
  );

  if (input.onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.recordCard,
          pressed ? styles.recordCardPressed : null,
          input.style,
        ]}
        onPress={input.onPress}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.recordCard, input.style]}>{content}</View>;
}

export function AppTextField(
  input: TextInputProps & {
    label?: string;
    helperText?: string;
    errorText?: string;
    containerStyle?: ViewStyle;
  },
) {
  const {
    label,
    helperText,
    errorText,
    containerStyle,
    multiline,
    style,
    ...textInputProps
  } = input;

  return (
    <View style={[styles.fieldBlock, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        multiline={multiline}
        placeholderTextColor={COLORS.mutedText}
        style={[
          styles.textField,
          multiline ? styles.textFieldMultiline : null,
          style,
        ]}
        {...textInputProps}
      />
      {errorText ? <Text style={styles.fieldError}>{errorText}</Text> : null}
      {!errorText && helperText ? (
        <Text style={styles.fieldHelper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

export function AppChoicePill(input: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.choicePill,
        input.selected ? styles.choicePillSelected : null,
        pressed ? styles.choicePillPressed : null,
      ]}
      onPress={input.onPress}
    >
      <Text
        style={[
          styles.choicePillLabel,
          input.selected ? styles.choicePillLabelSelected : null,
        ]}
      >
        {input.label}
      </Text>
    </Pressable>
  );
}

export function AppStateCard(input: {
  title: string;
  description: string;
  tone?: "default" | "muted" | "accent";
  loading?: boolean;
  action?: ReactNode;
}) {
  return (
    <SurfaceCard {...(input.tone ? { tone: input.tone } : {})}>
      <View style={styles.stateCardBody}>
        {input.loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : null}
        <Text style={styles.stateCardTitle}>{input.title}</Text>
        <Text style={styles.stateCardDescription}>{input.description}</Text>
        {input.action ? (
          <View style={styles.stateCardAction}>{input.action}</View>
        ) : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    padding: SPACING.xl,
    gap: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroTextBlock: {
    gap: SPACING.sm,
  },
  heroTrailing: {
    alignSelf: "flex-start",
  },
  eyebrow: {
    color: "rgba(255, 250, 242, 0.76)",
    fontSize: TYPOGRAPHY.caption,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: COLORS.surfaceRaised,
    fontSize: TYPOGRAPHY.hero,
    fontWeight: "800",
    lineHeight: 38,
  },
  heroDescription: {
    color: "rgba(255, 250, 242, 0.88)",
    fontSize: TYPOGRAPHY.body,
    lineHeight: 22,
  },
  surfaceCard: {
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  surfaceMuted: {
    backgroundColor: COLORS.surface,
  },
  surfaceAccent: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.borderStrong,
  },
  sectionHeader: {
    gap: SPACING.xs,
  },
  sectionTextBlock: {
    gap: SPACING.xs,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.title,
    fontWeight: "800",
  },
  sectionDescription: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.label,
    lineHeight: 20,
  },
  metricTile: {
    minWidth: 144,
    flex: 1,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricPrimary: {
    backgroundColor: COLORS.primaryMuted,
  },
  metricSecondary: {
    backgroundColor: COLORS.secondaryMuted,
  },
  metricAccent: {
    backgroundColor: COLORS.accentMuted,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "800",
  },
  metricLabel: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.label,
    fontWeight: "700",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.backgroundMuted,
  },
  badgeInfo: {
    backgroundColor: COLORS.secondaryMuted,
  },
  badgeSuccess: {
    backgroundColor: COLORS.successMuted,
  },
  badgeWarning: {
    backgroundColor: COLORS.accentMuted,
  },
  badgeDanger: {
    backgroundColor: COLORS.dangerMuted,
  },
  badgeLabel: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.caption,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  button: {
    minHeight: 54,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonSecondary: {
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.overlay,
  },
  buttonFullWidth: {
    width: "100%",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.48,
  },
  buttonLabel: {
    color: COLORS.surfaceRaised,
    fontSize: TYPOGRAPHY.body,
    fontWeight: "800",
  },
  buttonLabelSecondary: {
    color: COLORS.secondary,
  },
  buttonLabelGhost: {
    color: COLORS.text,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  infoLabel: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.label,
    flex: 1,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.label,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  recordCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  recordCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  recordCardTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.body,
    fontWeight: "800",
    color: COLORS.text,
  },
  recordCardPressed: {
    opacity: 0.88,
  },
  fieldBlock: {
    gap: SPACING.xs,
  },
  fieldLabel: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.label,
    fontWeight: "700",
  },
  textField: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    backgroundColor: COLORS.surfaceRaised,
    color: COLORS.text,
    fontSize: TYPOGRAPHY.body,
  },
  textFieldMultiline: {
    minHeight: 112,
    textAlignVertical: "top",
  },
  fieldHelper: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.caption,
    lineHeight: 18,
  },
  fieldError: {
    color: COLORS.danger,
    fontSize: TYPOGRAPHY.caption,
    lineHeight: 18,
  },
  choicePill: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  choicePillSelected: {
    borderColor: COLORS.primaryDeep,
    backgroundColor: COLORS.primaryMuted,
  },
  choicePillPressed: {
    opacity: 0.88,
  },
  choicePillLabel: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.caption,
    fontWeight: "700",
  },
  choicePillLabelSelected: {
    color: COLORS.primaryDeep,
  },
  stateCardBody: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  stateCardTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.title,
    fontWeight: "800",
    textAlign: "center",
  },
  stateCardDescription: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.label,
    lineHeight: 20,
    textAlign: "center",
  },
  stateCardAction: {
    width: "100%",
    marginTop: SPACING.sm,
  },
});
