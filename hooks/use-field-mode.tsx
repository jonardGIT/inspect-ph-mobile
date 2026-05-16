import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { COLORS } from "@/constants/theme";

const FIELD_MODE_KEY = "inspect-ph:field-mode";

/** Colors used in field mode: high-contrast, reduced palette. */
export const FIELD_COLORS = {
  background: "#000000",
  backgroundMuted: "#111111",
  surface: "#1a1a1a",
  surfaceRaised: "#222222",
  text: "#ffffff",
  textSubtle: "#cccccc",
  primary: "#00e5c3",
  primaryMuted: "#003d35",
  primaryDeep: "#00ffd8",
  secondary: "#4db8ff",
  secondaryMuted: "#003a66",
  accent: "#ffaa33",
  accentMuted: "#3d2600",
  border: "#444444",
  borderStrong: "#666666",
  mutedText: "#aaaaaa",
  danger: "#ff4444",
  dangerMuted: "#3d0000",
  success: "#00e5c3",
  successMuted: "#003d35",
  shadow: "rgba(0,0,0,0.5)",
  overlay: "rgba(0,0,0,0.6)",
} as const;

/** Minimum touch target size in field mode (dp) */
export const FIELD_MIN_TOUCH = 56;

/** Standard touch target size (dp) */
export const STANDARD_MIN_TOUCH = 44;

interface FieldModeContextValue {
  colors: typeof COLORS;
  fieldMode: boolean;
  minTouchSize: number;
  toggleFieldMode: () => void;
}

const FieldModeContext = createContext<FieldModeContextValue | null>(null);

export function FieldModeProvider({ children }: { children: React.ReactNode }) {
  const [fieldMode, setFieldMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FIELD_MODE_KEY)
      .then((value) => {
        if (value === "true") setFieldMode(true);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  const toggleFieldMode = useCallback(() => {
    setFieldMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem(FIELD_MODE_KEY, String(next)).catch(() => {
        /* ignore */
      });
      return next;
    });
  }, []);

  return (
    <FieldModeContext.Provider
      value={{
        colors: fieldMode ? FIELD_COLORS : COLORS,
        fieldMode,
        minTouchSize: fieldMode ? FIELD_MIN_TOUCH : STANDARD_MIN_TOUCH,
        toggleFieldMode,
      }}
    >
      {children}
    </FieldModeContext.Provider>
  );
}

export function useFieldMode(): FieldModeContextValue {
  const ctx = useContext(FieldModeContext);
  if (!ctx)
    throw new Error("useFieldMode must be used within FieldModeProvider");
  return ctx;
}
