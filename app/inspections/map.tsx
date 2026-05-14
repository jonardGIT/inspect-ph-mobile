import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS, SPACING } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { ApiRequestError, listInspectionMapPoints } from "@/lib/api";

import type { InspectionMapPoint } from "../../../shared/types/api";

type Region = {
  latitude: number;
  latitudeDelta: number;
  longitude: number;
  longitudeDelta: number;
};

type NativeMapModule = typeof import("react-native-maps");

function createGoogleMapsLink(point: InspectionMapPoint) {
  return `https://www.google.com/maps?q=${point.location.latitude},${point.location.longitude}`;
}

function createRegion(points: InspectionMapPoint[]): Region {
  const latitudes = points.map((point) => point.location.latitude);
  const longitudes = points.map((point) => point.location.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(0.04, (maxLatitude - minLatitude) * 1.6),
    longitudeDelta: Math.max(0.04, (maxLongitude - minLongitude) * 1.6),
  };
}

function getFallbackPointPosition(
  point: InspectionMapPoint,
  points: InspectionMapPoint[],
): Pick<ViewStyle, "left" | "top"> {
  const longitudes = points.map((item) => item.location.longitude);
  const latitudes = points.map((item) => item.location.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const left =
    minLongitude === maxLongitude
      ? 50
      : ((point.location.longitude - minLongitude) /
          (maxLongitude - minLongitude)) *
        100;
  const top =
    minLatitude === maxLatitude
      ? 50
      : 100 -
        ((point.location.latitude - minLatitude) /
          (maxLatitude - minLatitude)) *
          100;

  return {
    left: `${Math.min(92, Math.max(8, left))}%`,
    top: `${Math.min(92, Math.max(8, top))}%`,
  };
}

function getFallbackPinStyle(
  point: InspectionMapPoint,
  points: InspectionMapPoint[],
  isSelected: boolean,
): ViewStyle {
  const position = getFallbackPointPosition(point, points);

  return {
    left: position.left,
    top: position.top,
    backgroundColor: isSelected ? COLORS.accent : COLORS.secondary,
  };
}

export default function InspectionMapScreen() {
  const router = useRouter();
  const { session, signOut } = useAuthSession();
  const accessToken = session?.tokens.accessToken;
  const isInspector = session?.user.role === "inspector";
  const [nativeMapModule, setNativeMapModule] =
    useState<NativeMapModule | null>(null);
  const [isNativeMapUnavailable, setIsNativeMapUnavailable] = useState(false);
  const [points, setPoints] = useState<InspectionMapPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPoint =
    points.find((point) => point.id === selectedPointId) ?? points[0] ?? null;
  const NativeMapView = nativeMapModule?.default ?? null;
  const NativeMarker = nativeMapModule?.Marker ?? null;
  const hasNativeMap = Boolean(NativeMapView && NativeMarker);
  const mapRegion = useMemo(
    () => (points.length > 0 ? createRegion(points) : null),
    [points],
  );

  const loadMapPoints = useCallback(
    async (options?: { refreshing?: boolean }) => {
      if (!accessToken || !isInspector) {
        setPoints([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (options?.refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        const nextPoints = await listInspectionMapPoints({
          accessToken,
        });

        setPoints(nextPoints);
        setSelectedPointId(
          (currentId) => currentId ?? nextPoints[0]?.id ?? null,
        );
      } catch (loadError) {
        if (loadError instanceof ApiRequestError && loadError.status === 401) {
          await signOut();
          router.replace("/");
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load inspection map points.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken, isInspector, router, signOut],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadNativeMapModule() {
      try {
        const nextModule =
          (await import("react-native-maps")) as NativeMapModule;

        if (isCancelled) {
          return;
        }

        setNativeMapModule(nextModule);
      } catch {
        if (isCancelled) {
          return;
        }

        setIsNativeMapUnavailable(true);
      }
    }

    void loadNativeMapModule();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      router.replace("/");
      return;
    }

    if (!isInspector) {
      setError("Only inspector accounts can open the mobile inspection map.");
      setIsLoading(false);
      return;
    }

    void loadMapPoints();
  }, [accessToken, isInspector, loadMapPoints, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[COLORS.primary]}
            refreshing={isRefreshing}
            tintColor={COLORS.primary}
            onRefresh={() => {
              void loadMapPoints({ refreshing: true });
            }}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.kicker}>Inspection map</Text>
          <Text style={styles.title}>Scoped field pins</Text>
          <Text style={styles.subtitle}>
            The map only renders coordinates returned inside your current API
            scope.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stateTitle}>Loading map</Text>
            <Text style={styles.stateBody}>
              Pulling scoped inspection coordinates.
            </Text>
          </View>
        ) : null}

        {!isLoading && error ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!isLoading && !error && points.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.stateTitle}>No map points yet</Text>
            <Text style={styles.stateBody}>
              Coordinates will appear here after scoped inspections capture
              field location.
            </Text>
          </View>
        ) : null}

        {!isLoading && !error && mapRegion ? (
          <View style={styles.card}>
            {hasNativeMap && NativeMapView && NativeMarker ? (
              <NativeMapView initialRegion={mapRegion} style={styles.map}>
                {points.map((point) => (
                  <NativeMarker
                    key={point.id}
                    coordinate={{
                      latitude: point.location.latitude,
                      longitude: point.location.longitude,
                    }}
                    pinColor={
                      point.id === selectedPoint?.id
                        ? COLORS.accent
                        : COLORS.secondary
                    }
                    title={point.business.businessName}
                    description={`${point.office.name} · ${point.status.replace("_", " ")}`}
                    onPress={() => {
                      setSelectedPointId(point.id);
                    }}
                  />
                ))}
              </NativeMapView>
            ) : (
              <View style={styles.fallbackMap}>
                <View style={styles.fallbackMapGrid}>
                  {points.map((point) => {
                    return (
                      <Pressable
                        key={point.id}
                        accessibilityRole="button"
                        style={[
                          styles.fallbackPin,
                          getFallbackPinStyle(
                            point,
                            points,
                            point.id === selectedPoint?.id,
                          ),
                        ]}
                        onPress={() => {
                          setSelectedPointId(point.id);
                        }}
                      />
                    );
                  })}
                </View>
                <Text style={styles.mapHint}>
                  {isNativeMapUnavailable
                    ? "Native map rendering is unavailable in Expo Go, so this screen falls back to a scoped pin board. Open the selected point in Maps for turn-by-turn navigation."
                    : "Loading the native map module. If it stays unavailable, the screen will keep using the scoped pin board fallback."}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {!isLoading && !error && selectedPoint ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {selectedPoint.business.businessName}
            </Text>
            <Text style={styles.sectionBody}>
              {selectedPoint.office.name} · {selectedPoint.office.code}
            </Text>
            <Text style={styles.sectionBody}>
              Status {selectedPoint.status.replace("_", " ")}
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => {
                  router.push({
                    pathname: "/inspections/[inspectionId]",
                    params: { inspectionId: selectedPoint.id },
                  });
                }}
              >
                <Text style={styles.primaryButtonLabel}>Open inspection</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => {
                  void Linking.openURL(createGoogleMapsLink(selectedPoint));
                }}
              >
                <Text style={styles.secondaryButtonLabel}>Open in maps</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  heroCard: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: COLORS.secondary,
    gap: SPACING.sm,
  },
  kicker: {
    color: COLORS.primaryMuted,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: COLORS.surface,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: COLORS.surface,
    fontSize: 15,
    lineHeight: 22,
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  card: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    gap: SPACING.md,
  },
  map: {
    width: "100%",
    height: 320,
    borderRadius: 18,
  },
  fallbackMap: {
    gap: SPACING.md,
  },
  fallbackMapGrid: {
    position: "relative",
    width: "100%",
    height: 320,
    borderRadius: 18,
    backgroundColor: COLORS.primaryMuted,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fallbackPin: {
    position: "absolute",
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  mapHint: {
    color: COLORS.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  sectionBody: {
    color: COLORS.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  primaryButtonLabel: {
    color: COLORS.surface,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    alignItems: "center",
    backgroundColor: COLORS.surface,
  },
  secondaryButtonLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  stateTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  stateBody: {
    color: COLORS.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
