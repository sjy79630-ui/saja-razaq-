import {useCallback, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import type {
  ComputedRouteSummary,
  CorridorTrafficStatus,
  LatLngPoint,
  RouteStepSummary,
  SmartNavOption,
  TravelModeOption,
} from '../types/karbala';
import {
  checkAndDispatchQuotaError,
  classifyTrafficLevel,
  formatArabicDistance,
  formatArabicDuration,
  formatEstimatedArrivalClock,
} from '../utils/quotaHelper';

function mapRouteToSummary(
  route: google.maps.routes.Route,
  index: number
): ComputedRouteSummary {
  const distanceMeters = route.distanceMeters ?? 0;
  const durationMillis = route.durationMillis ?? 0;
  const staticDurationMillis = route.staticDurationMillis ?? durationMillis;
  const delayMinutes = Math.max(
    0,
    Math.round((durationMillis - staticDurationMillis) / 60000)
  );
  const trafficLevel = classifyTrafficLevel(
    durationMillis,
    staticDurationMillis,
    route.speedPaths
  );

  const primaryLeg = route.legs?.[0];
  const steps: RouteStepSummary[] = (primaryLeg?.steps ?? [])
    .filter((step) => Boolean(step.instructions))
    .map((step) => ({
      instructions: step.instructions ?? '',
      distanceMeters: step.distanceMeters ?? 0,
      distanceText:
        step.localizedValues?.distance ||
        formatArabicDistance(step.distanceMeters ?? 0),
      maneuver: step.maneuver ?? '',
    }));

  return {
    routeIndex: index,
    description:
      route.description ||
      (index === 0 ? 'المسار الرئيسي المقترح' : `المسار البديل ${index}`),
    distanceMeters,
    distanceText:
      route.localizedValues?.distance || formatArabicDistance(distanceMeters),
    durationMillis,
    durationText:
      route.localizedValues?.duration || formatArabicDuration(durationMillis),
    staticDurationMillis,
    staticDurationText:
      route.localizedValues?.staticDuration ||
      formatArabicDuration(staticDurationMillis),
    delayMinutes,
    trafficLevel,
    steps,
    routeLabels: route.routeLabels ?? [],
    rawRoute: route,
  };
}

export function useKarbalaRoutes() {
  const routesLib = useMapsLibrary('routes');
  const [routes, setRoutes] = useState<ComputedRouteSummary[]>([]);
  const [isComputingRoute, setIsComputingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [corridorTraffic, setCorridorTraffic] = useState<
    Record<string, CorridorTrafficStatus>
  >({});
  const [checkingCorridorIds, setCheckingCorridorIds] = useState<
    Record<string, boolean>
  >({});
  const [smartOptions, setSmartOptions] = useState<SmartNavOption[]>([]);
  const [isComputingSmart, setIsComputingSmart] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);

  const fetchRoutesForPair = useCallback(
    async (
      origin: LatLngPoint | google.maps.places.Place | string,
      destination: LatLngPoint | google.maps.places.Place,
      travelMode: TravelModeOption
    ): Promise<ComputedRouteSummary[]> => {
      if (!routesLib) return [];
      const isDriving = travelMode === 'DRIVING';
      const request: google.maps.routes.ComputeRoutesRequest = {
        origin,
        destination,
        travelMode: travelMode as google.maps.TravelModeString,
        routingPreference: isDriving ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE',
        extraComputations: isDriving ? ['TRAFFIC_ON_POLYLINE'] : undefined,
        computeAlternativeRoutes: true,
        language: 'ar',
        fields: [
          'path',
          'distanceMeters',
          'durationMillis',
          'staticDurationMillis',
          'viewport',
          'legs',
          'speedPaths',
          'routeLabels',
          'description',
          'localizedValues',
        ],
      };

      const response = await routesLib.Route.computeRoutes(request);
      const rawRoutes = response.routes ?? [];
      return rawRoutes.map((r, idx) => mapRouteToSummary(r, idx));
    },
    [routesLib]
  );

  const computeRouteToShrine = useCallback(
    async (
      origin: LatLngPoint | google.maps.places.Place | string,
      destination: LatLngPoint | google.maps.places.Place,
      travelMode: TravelModeOption
    ): Promise<ComputedRouteSummary[]> => {
      if (!routesLib) return [];

      setIsComputingRoute(true);
      setRouteError(null);

      try {
        const mapped = await fetchRoutesForPair(origin, destination, travelMode);

        if (mapped.length === 0) {
          setRoutes([]);
          setRouteError('لم يتم العثور على مسار بين النقطتين المحددتين.');
          return [];
        }

        setRoutes(mapped);
        return mapped;
      } catch (err) {
        checkAndDispatchQuotaError(err);
        setRoutes([]);
        setRouteError(
          'تعذر حساب المسار المباشر حالياً. يرجى التحقق من الاتصال أو المحاولة لاحقاً.'
        );
        return [];
      } finally {
        setIsComputingRoute(false);
      }
    },
    [routesLib, fetchRoutesForPair]
  );

  const computeSmartRecommendations = useCallback(
    async (
      origin: LatLngPoint,
      hussainDest: LatLngPoint,
      abbasDest: LatLngPoint,
      travelMode: TravelModeOption
    ): Promise<SmartNavOption[]> => {
      if (!routesLib) return [];
      setIsComputingSmart(true);
      setSmartError(null);

      try {
        const [hussainRoutes, abbasRoutes] = await Promise.all([
          fetchRoutesForPair(origin, hussainDest, travelMode),
          fetchRoutesForPair(origin, abbasDest, travelMode),
        ]);

        const buildOption = (
          shrineId: 'imam-hussain' | 'al-abbas',
          shrineName: string,
          list: ComputedRouteSummary[]
        ): SmartNavOption | null => {
          if (list.length === 0) return null;
          const sorted = [...list].sort(
            (a, b) => a.durationMillis - b.durationMillis
          );
          const reindexed = sorted.map((item, idx) => ({
            ...item,
            routeIndex: idx,
          }));
          const best = reindexed[0];
          return {
            shrineId,
            shrineName,
            bestRoute: best,
            alternatives: reindexed.slice(1),
            estimatedArrivalTimeText: formatEstimatedArrivalClock(
              best.durationMillis
            ),
          };
        };

        const options: SmartNavOption[] = [];
        const hOpt = buildOption(
          'imam-hussain',
          'الصحن الحسيني الشريف',
          hussainRoutes
        );
        const aOpt = buildOption(
          'al-abbas',
          'الصحن العباسي الشريف',
          abbasRoutes
        );
        if (hOpt) options.push(hOpt);
        if (aOpt) options.push(aOpt);

        options.sort(
          (a, b) => a.bestRoute.durationMillis - b.bestRoute.durationMillis
        );

        if (options.length === 0) {
          setSmartError(
            'لم نتمكن من إيجاد مسارات برية مباشرة من هذا الموقع إلى العتبتين.'
          );
        }

        setSmartOptions(options);
        return options;
      } catch (err) {
        checkAndDispatchQuotaError(err);
        setSmartError('تعذر حساب توصيات الملاحة الذكية حالياً.');
        return [];
      } finally {
        setIsComputingSmart(false);
      }
    },
    [routesLib, fetchRoutesForPair]
  );

  const applyComputedRoutes = useCallback((newRoutes: ComputedRouteSummary[]) => {
    setRouteError(null);
    setRoutes(newRoutes);
  }, []);

  const checkCorridorTraffic = useCallback(
    async (
      corridorId: string,
      origin: LatLngPoint,
      destination: LatLngPoint
    ): Promise<CorridorTrafficStatus | null> => {
      if (!routesLib) return null;

      setCheckingCorridorIds((prev) => ({...prev, [corridorId]: true}));
      try {
        const response = await routesLib.Route.computeRoutes({
          origin,
          destination,
          travelMode: 'DRIVING',
          routingPreference: 'TRAFFIC_AWARE',
          extraComputations: ['TRAFFIC_ON_POLYLINE'],
          language: 'ar',
          fields: [
            'distanceMeters',
            'durationMillis',
            'staticDurationMillis',
            'speedPaths',
            'localizedValues',
          ],
        });

        const primary = response.routes?.[0];
        if (!primary) return null;

        const distanceMeters = primary.distanceMeters ?? 0;
        const durationMillis = primary.durationMillis ?? 0;
        const staticDurationMillis =
          primary.staticDurationMillis ?? durationMillis;
        const delayMinutes = Math.max(
          0,
          Math.round((durationMillis - staticDurationMillis) / 60000)
        );
        const trafficLevel = classifyTrafficLevel(
          durationMillis,
          staticDurationMillis,
          primary.speedPaths
        );

        const status: CorridorTrafficStatus = {
          corridorId,
          distanceMeters,
          distanceText:
            primary.localizedValues?.distance ||
            formatArabicDistance(distanceMeters),
          durationMillis,
          durationText:
            primary.localizedValues?.duration ||
            formatArabicDuration(durationMillis),
          staticDurationMillis,
          delayMinutes,
          trafficLevel,
          updatedAt: Date.now(),
        };

        setCorridorTraffic((prev) => ({...prev, [corridorId]: status}));
        return status;
      } catch (err) {
        checkAndDispatchQuotaError(err);
        return null;
      } finally {
        setCheckingCorridorIds((prev) => ({...prev, [corridorId]: false}));
      }
    },
    [routesLib]
  );

  return {
    routes,
    isComputingRoute,
    routeError,
    corridorTraffic,
    checkingCorridorIds,
    smartOptions,
    isComputingSmart,
    smartError,
    computeRouteToShrine,
    computeSmartRecommendations,
    applyComputedRoutes,
    checkCorridorTraffic,
  };
}
