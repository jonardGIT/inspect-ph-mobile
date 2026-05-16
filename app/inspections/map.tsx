import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppButton,
  AppHero,
  AppStateCard,
  SectionHeading,
  StatusBadge,
  SurfaceCard,
} from "@/components/mobile-ui";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { ApiRequestError, listInspectionMapPoints } from "@/lib/api";
import SyncStatusBar from "@/components/sync-status-bar";

import type { InspectionMapPoint } from "../../../shared/types/api";

type NativeMapModule = typeof import("react-native-maps");

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

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

function createGoogleMapsLink(point: InspectionMapPoint) {
  const { latitude, longitude } = point.location;
  const label = encodeURIComponent(point.business.businessName);

  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${label}`;
}

export default function InspectionMapScreen() {
  const { officeId, officeLabel } = useLocalSearchParams<{
    officeId?: string;
    officeLabel?: string;
  }>();
  const router = useRouter();
  const { session, signOut } = useAuthSession();
  const accessToken = session?.tokens.accessToken;
  const isInspector = session?.user.role === "inspector";
  const selectedOfficeId =
    typeof officeId === "string" && officeId.trim().length > 0
      ? officeId
      : undefined;
  const selectedOfficeLabel =
    typeof officeLabel === "string" && officeLabel.trim().length > 0
      ? officeLabel
      : null;
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
          ...(selectedOfficeId ? { officeId: selectedOfficeId } : {}),
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
    [accessToken, isInspector, router, selectedOfficeId, signOut],
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
      <SyncStatusBar />
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
        <AppHero
          eyebrow="Inspection map"
          title={selectedOfficeLabel ? "Office map pins" : "Scoped field pins"}
          description={
            selectedOfficeLabel
              ? `Showing coordinates only for ${selectedOfficeLabel}.`
              : "The map only renders coordinates returned inside your current API scope."
          }
          trailing={<StatusBadge label={`${points.length} pins`} tone="info" />}
        />

        {selectedOfficeLabel ? (
          <SurfaceCard tone="muted">
            <SectionHeading
              title="Office scope"
              description={selectedOfficeLabel}
            />
          </SurfaceCard>
        ) : null}

        {isLoading ? (
          <AppStateCard
            description="Pulling scoped inspection coordinates."
            loading
            title="Loading map"
          />
        ) : null}

        {!isLoading && error ? (
          <AppStateCard
            description={error}
            title="Map unavailable"
            tone="accent"
          />
        ) : null}

        {!isLoading && !error && points.length === 0 ? (
          <AppStateCard
            description="Coordinates will appear here after scoped inspections capture field location."
            title="No map points yet"
          />
        ) : null}

        {!isLoading && !error && mapRegion ? (
          <SurfaceCard>
            <SectionHeading
              title="Field map"
              description="Tap any pin to preview the business and jump into navigation or the inspection workspace."
            />
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
          </SurfaceCard>
        ) : null}

        {!isLoading && !error && selectedPoint ? (
          <SurfaceCard>
            <SectionHeading
              title={selectedPoint.business.businessName}
              description={`${selectedPoint.office.name} · ${selectedPoint.office.code}`}
            />
            <StatusBadge
              label={selectedPoint.status.replace("_", " ")}
              tone={
                selectedPoint.status === "overdue"
                  ? "danger"
                  : selectedPoint.status === "completed"
                    ? "success"
                    : selectedPoint.status === "in_progress"
                      ? "warning"
                      : "info"
              }
            />
            <View style={styles.actionRow}>
              <AppButton
                fullWidth
                label="Open inspection"
                onPress={() => {
                  router.push({
                    pathname: "/inspections/[inspectionId]",
                    params: { inspectionId: selectedPoint.id },
                  });
                }}
              />
              <AppButton
                fullWidth
                label="Open in maps"
                tone="secondary"
                onPress={() => {
                  void Linking.openURL(createGoogleMapsLink(selectedPoint));
                }}
              />
            </View>
          </SurfaceCard>
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
    paddingBottom: SPACING.xxl,
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  map: {
    width: "100%",
    height: 320,
    borderRadius: RADIUS.md,
  },
  fallbackMap: {
    gap: SPACING.md,
  },
  fallbackMapGrid: {
    position: "relative",
    width: "100%",
    height: 320,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryMuted,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
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
    color: COLORS.textSubtle,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "column",
    gap: SPACING.md,
  },
  stateTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  stateBody: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.label,
    lineHeight: 20,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
