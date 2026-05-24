import { LinearGradient } from "expo-linear-gradient";
import type { ReactElement, ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type KeyboardTypeOptions,
  type RefreshControlProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  Chip,
  Input,
  LinearProgress,
  ListItem,
  Text,
} from "@rneui/themed";

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "@/constants/theme";

type AppTextTone = "default" | "subtle" | "inverse" | "danger" | "accent";
type AppTextWeight = "regular" | "semibold" | "bold" | "heavy";
type AppTextSize = "caption" | "label" | "body" | "bodyLarge" | "title";

const TEXT_TONE_STYLE: Record<AppTextTone, TextStyle> = {
  default: { color: COLORS.text },
  subtle: { color: COLORS.textSubtle },
  inverse: { color: COLORS.surfaceRaised },
  danger: { color: COLORS.danger },
  accent: { color: COLORS.accent },
};

const TEXT_WEIGHT_STYLE: Record<AppTextWeight, TextStyle> = {
  regular: { fontWeight: "500" },
  semibold: { fontWeight: "600" },
  bold: { fontWeight: "700" },
  heavy: { fontWeight: "800" },
};

const TEXT_SIZE_STYLE: Record<AppTextSize, TextStyle> = {
  caption: { fontSize: TYPOGRAPHY.caption },
  label: { fontSize: TYPOGRAPHY.label },
  body: { fontSize: TYPOGRAPHY.body },
  bodyLarge: { fontSize: TYPOGRAPHY.bodyLarge },
  title: { fontSize: TYPOGRAPHY.title },
};

export function AppText(input: {
  children: ReactNode;
  tone?: AppTextTone;
  weight?: AppTextWeight;
  size?: AppTextSize;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        TEXT_TONE_STYLE[input.tone ?? "default"],
        TEXT_WEIGHT_STYLE[input.weight ?? "regular"],
        TEXT_SIZE_STYLE[input.size ?? "body"],
        input.style,
      ]}
    >
      {input.children}
    </Text>
  );
}

export function AppScreen(input: {
  children: ReactNode;
  contentContainerStyle?: ViewStyle;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  return (
    <SafeAreaView style={styles.screenSafeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          input.contentContainerStyle,
        ]}
        {...(input.refreshControl
          ? { refreshControl: input.refreshControl }
          : {})}
      >
        {input.children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AppMessage(input: {
  message: string;
  tone?: "danger" | "info";
}) {
  const isDanger = input.tone === "danger";

  return (
    <ListItem
      containerStyle={[
        styles.messageCard,
        isDanger ? styles.messageDanger : null,
      ]}
    >
      <ListItem.Content>
        <AppText
          size="label"
          style={styles.messageText}
          tone={isDanger ? "danger" : "accent"}
          weight="semibold"
        >
          {input.message}
        </AppText>
      </ListItem.Content>
    </ListItem>
  );
}

// ── AppHero ───────────────────────────────────────────────────────────────────
// Kept custom — uses LinearGradient with no RNEUI equivalent.
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

// ── SurfaceCard ───────────────────────────────────────────────────────────────
// Uses RNEUI Card for the card container pattern.
export function SurfaceCard(input: {
  children: ReactNode;
  style?: ViewStyle;
  tone?: "default" | "muted" | "accent";
}) {
  return (
    <Card
      containerStyle={[
        styles.surfaceCard,
        input.tone === "muted" ? styles.surfaceMuted : null,
        input.tone === "accent" ? styles.surfaceAccent : null,
        input.style,
      ]}
      wrapperStyle={styles.surfaceCardWrapper}
    >
      {input.children}
    </Card>
  );
}

// ── SectionHeading ────────────────────────────────────────────────────────────
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

// ── MetricTile ────────────────────────────────────────────────────────────────
// Kept custom — no RNEUI equivalent for metric display.
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

// ── StatusBadge ───────────────────────────────────────────────────────────────
// Uses RNEUI Chip (solid, no onPress) for status labels.
const BADGE_TONE_STYLE: Record<
  "info" | "success" | "warning" | "danger" | "default",
  ViewStyle
> = {
  default: { backgroundColor: COLORS.backgroundMuted },
  info: { backgroundColor: COLORS.secondaryMuted },
  success: { backgroundColor: COLORS.successMuted },
  warning: { backgroundColor: COLORS.accentMuted },
  danger: { backgroundColor: COLORS.dangerMuted },
};

export function StatusBadge(input: {
  label: string;
  tone?: "info" | "success" | "warning" | "danger" | "default";
}) {
  return (
    <Chip
      title={input.label}
      type="solid"
      buttonStyle={[styles.badge, BADGE_TONE_STYLE[input.tone ?? "default"]]}
      titleStyle={styles.badgeLabel}
      containerStyle={styles.badgeContainer}
    />
  );
}

// ── AppButton ─────────────────────────────────────────────────────────────────
// Uses RNEUI Button. Supports loading, icon, and all ButtonProps in addition to
// the original PressableProps surface.
export function AppButton(input: {
  label: string;
  tone?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const {
    label,
    tone = "primary",
    fullWidth,
    style,
    disabled = false,
    loading = false,
    onPress,
    accessibilityLabel,
  } = input;

  return (
    <Button
      disabled={disabled}
      loading={loading}
      title={label}
      accessibilityRole="button"
      {...(accessibilityLabel !== undefined ? { accessibilityLabel } : {})}
      type={
        tone === "primary"
          ? "solid"
          : tone === "secondary"
            ? "outline"
            : "clear"
      }
      buttonStyle={[
        styles.button,
        tone === "primary" ? styles.buttonPrimary : null,
        tone === "secondary" ? styles.buttonSecondary : null,
      ]}
      titleStyle={[
        styles.buttonLabel,
        tone === "secondary" ? styles.buttonLabelSecondary : null,
        tone === "ghost" ? styles.buttonLabelGhost : null,
      ]}
      containerStyle={[fullWidth ? styles.buttonFullWidth : null, style]}
      disabledStyle={styles.buttonDisabled}
      onPress={onPress}
    />
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────
// Uses RNEUI ListItem for the horizontal label/value row pattern.
export function InfoRow(input: { label: string; value: string }) {
  return (
    <ListItem containerStyle={styles.infoRow} pad={0}>
      <ListItem.Content>
        <ListItem.Title style={styles.infoLabel}>{input.label}</ListItem.Title>
      </ListItem.Content>
      <Text style={styles.infoValue}>{input.value}</Text>
    </ListItem>
  );
}

// ── AppRecordCard ─────────────────────────────────────────────────────────────
// Static → RNEUI Card. Pressable → RNEUI ListItem (built-in onPress + ripple).
export function AppRecordCard(input: {
  children?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  title?: string;
  trailing?: ReactNode;
}) {
  const header =
    input.title || input.trailing ? (
      <View style={styles.recordCardHeader}>
        {input.title ? (
          <Text style={styles.recordCardTitle}>{input.title}</Text>
        ) : (
          <View />
        )}
        {input.trailing}
      </View>
    ) : null;

  if (input.onPress) {
    return (
      <ListItem
        accessibilityRole="button"
        containerStyle={[styles.recordCard, input.style]}
        onPress={input.onPress}
      >
        {header}
        {input.children ? (
          <ListItem.Content style={styles.recordCardContent}>
            {input.children}
          </ListItem.Content>
        ) : null}
      </ListItem>
    );
  }

  return (
    <Card
      containerStyle={[styles.recordCard, input.style]}
      wrapperStyle={styles.recordCardWrapper}
    >
      {header}
      {input.children}
    </Card>
  );
}

// ── AppTextField ──────────────────────────────────────────────────────────────
// Uses RNEUI Input for label + input + error layout. helperText is rendered
// manually below (RNEUI Input has no helper-text concept).
export function AppTextField(input: {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  helperText?: string;
  errorText?: string;
  containerStyle?: ViewStyle;
}) {
  const {
    label,
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
    autoCapitalize,
    autoCorrect,
    keyboardType,
    multiline,
    helperText,
    errorText,
    containerStyle,
  } = input;

  return (
    <View style={[styles.fieldOuter, containerStyle]}>
      <Input
        labelStyle={styles.fieldLabel}
        inputContainerStyle={styles.inputContainer}
        containerStyle={styles.inputComponentContainer}
        errorStyle={styles.fieldError}
        renderErrorMessage={Boolean(errorText)}
        placeholderTextColor={COLORS.mutedText}
        inputStyle={[
          styles.textField,
          multiline ? styles.textFieldMultiline : null,
        ]}
        {...(label !== undefined ? { label } : {})}
        {...(placeholder !== undefined ? { placeholder } : {})}
        {...(value !== undefined ? { value } : {})}
        {...(onChangeText !== undefined ? { onChangeText } : {})}
        {...(errorText !== undefined ? { errorMessage: errorText } : {})}
        {...(secureTextEntry !== undefined ? { secureTextEntry } : {})}
        {...(autoCapitalize !== undefined ? { autoCapitalize } : {})}
        {...(autoCorrect !== undefined ? { autoCorrect } : {})}
        {...(keyboardType !== undefined ? { keyboardType } : {})}
        {...(multiline !== undefined ? { multiline } : {})}
      />
      {!errorText && helperText ? (
        <Text style={styles.fieldHelper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

// ── AppChoicePill ─────────────────────────────────────────────────────────────
// Uses RNEUI Chip — solid when selected, outline when unselected.
export function AppChoicePill(input: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Chip
      accessibilityRole="button"
      accessibilityLabel={input.label}
      title={input.label}
      type={input.selected ? "solid" : "outline"}
      onPress={input.onPress}
      buttonStyle={[
        styles.choicePill,
        input.selected ? styles.choicePillSelected : null,
      ]}
      titleStyle={[
        styles.choicePillLabel,
        input.selected ? styles.choicePillLabelSelected : null,
      ]}
    />
  );
}

// ── AppStateCard ──────────────────────────────────────────────────────────────
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
          <LinearProgress
            color={COLORS.primary}
            style={styles.stateCardLoader}
            variant="indeterminate"
          />
        ) : null}
        <AppText size="title" style={styles.stateCardTitle} weight="heavy">
          {input.title}
        </AppText>
        <AppText size="label" style={styles.stateCardDescription} tone="subtle">
          {input.description}
        </AppText>
        {input.action ? (
          <View style={styles.stateCardAction}>{input.action}</View>
        ) : null}
      </View>
    </SurfaceCard>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screenSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  messageCard: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    margin: 0,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  messageDanger: {
    backgroundColor: COLORS.dangerMuted,
    borderColor: COLORS.danger,
  },
  messageText: { lineHeight: 20 },

  // AppHero
  heroCard: {
    borderRadius: RADIUS.xl,
    elevation: 6,
    gap: SPACING.lg,
    overflow: "hidden",
    padding: SPACING.xl,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
  },
  heroTextBlock: { gap: SPACING.sm },
  heroTrailing: { alignSelf: "flex-start" },
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

  // SurfaceCard — RNEUI Card overrides
  surfaceCard: {
    backgroundColor: COLORS.surfaceRaised,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    elevation: 2,
    margin: 0,
    padding: 0,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  surfaceCardWrapper: { gap: SPACING.md, padding: SPACING.lg },
  surfaceMuted: { backgroundColor: COLORS.surface },
  surfaceAccent: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.borderStrong,
  },

  // SectionHeading
  sectionHeader: { gap: SPACING.xs },
  sectionTextBlock: { gap: SPACING.xs },
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

  // MetricTile
  metricTile: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    gap: SPACING.xs,
    minWidth: 144,
    padding: SPACING.md,
  },
  metricPrimary: { backgroundColor: COLORS.primaryMuted },
  metricSecondary: { backgroundColor: COLORS.secondaryMuted },
  metricAccent: { backgroundColor: COLORS.accentMuted },
  metricValue: { color: COLORS.text, fontSize: 26, fontWeight: "800" },
  metricLabel: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.label,
    fontWeight: "700",
  },

  // StatusBadge — RNEUI Chip overrides
  badgeContainer: { alignSelf: "flex-start" },
  badge: {
    borderRadius: RADIUS.pill,
    borderWidth: 0,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  badgeLabel: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.caption,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // AppButton — RNEUI Button overrides
  button: { minHeight: 54, paddingHorizontal: SPACING.lg },
  buttonPrimary: { backgroundColor: COLORS.primary },
  buttonSecondary: {
    backgroundColor: COLORS.surfaceRaised,
    borderColor: COLORS.borderStrong,
  },
  buttonDisabled: { opacity: 0.48 },
  buttonFullWidth: { width: "100%" },
  buttonLabel: {
    color: COLORS.surfaceRaised,
    fontSize: TYPOGRAPHY.body,
    fontWeight: "800",
  },
  buttonLabelSecondary: { color: COLORS.secondary },
  buttonLabelGhost: { color: COLORS.text },

  // InfoRow — RNEUI ListItem overrides
  infoRow: {
    backgroundColor: "transparent",
    minHeight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  infoLabel: { color: COLORS.textSubtle, fontSize: TYPOGRAPHY.label },
  infoValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.label,
    fontWeight: "700",
    textAlign: "right",
  },

  // AppRecordCard — RNEUI Card / ListItem overrides
  recordCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    margin: 0,
    padding: SPACING.md,
  },
  recordCardWrapper: { gap: SPACING.xs },
  recordCardContent: { gap: SPACING.xs },
  recordCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  recordCardTitle: {
    color: COLORS.text,
    flex: 1,
    fontSize: TYPOGRAPHY.body,
    fontWeight: "800",
  },

  // AppTextField — RNEUI Input overrides
  fieldOuter: { gap: SPACING.xs },
  // Remove RNEUI's default horizontal padding from the outer Input container
  inputComponentContainer: { marginBottom: 0, paddingHorizontal: 0 },
  inputContainer: {
    backgroundColor: COLORS.surfaceRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
  },
  fieldLabel: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.label,
    fontWeight: "700",
  },
  textField: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.body,
    paddingVertical: 14,
  },
  textFieldMultiline: { minHeight: 112, textAlignVertical: "top" },
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

  // AppChoicePill — RNEUI Chip overrides
  choicePill: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  choicePillSelected: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primaryDeep,
  },
  choicePillLabel: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.caption,
    fontWeight: "700",
  },
  choicePillLabelSelected: { color: COLORS.primaryDeep },

  // AppStateCard
  stateCardBody: {
    alignItems: "center",
    gap: SPACING.sm,
    justifyContent: "center",
    paddingVertical: SPACING.xl,
  },
  stateCardLoader: { borderRadius: RADIUS.pill, width: "100%" },
  stateCardTitle: {
    textAlign: "center",
  },
  stateCardDescription: {
    lineHeight: 20,
    textAlign: "center",
  },
  stateCardAction: { marginTop: SPACING.sm, width: "100%" },
});
