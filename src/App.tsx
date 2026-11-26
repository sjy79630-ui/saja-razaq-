import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  APILoadingStatus,
  APIProvider,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import {RefreshCw} from 'lucide-react';
import {CorridorsDirectory} from './components/CorridorsDirectory';
import {KarbalaMapView} from './components/KarbalaMapView';
import {RoutePlannerPanel} from './components/RoutePlannerPanel';
import {ShrineGuideSection} from './components/ShrineGuideSection';
import {SmartNavPanel} from './components/SmartNavPanel';
import {useKarbalaPlaces} from './hooks/useKarbalaPlaces';
import {useKarbalaRoutes} from './hooks/useKarbalaRoutes';
import type {
  ComputedRouteSummary,
  CorridorCategory,
  LatLngPoint,
  ShrineId,
  TravelModeOption,
  UserGeoState,
} from './types/karbala';
import {haversineMeters, isPointInsideKarbala} from './utils/quotaHelper';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function KarbalaExplorerWorkspace() {
  const apiStatus = useApiLoadingStatus();
  const {
    poisById,
    poisList,
    isLoadingCore,
    isLoadingExtended,
    extendedLoaded,
    placesError,
    loadExtendedCorridors,
  } = useKarbalaPlaces();

  const {
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
  } = useKarbalaRoutes();

  const [selectedShrineId, setSelectedShrineId] =
    useState<ShrineId>('imam-hussain');
  const [travelMode, setTravelMode] = useState<TravelModeOption>('DRIVING');
  const [activeCategory, setActiveCategory] = useState<CorridorCategory>('all');
  const [originPoint, setOriginPoint] = useState<{
    label: string;
    location: LatLngPoint;
  } | null>(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [trafficRefreshKey, setTrafficRefreshKey] = useState(0);
  const [focusedPoiId, setFocusedPoiId] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const [userGeo, setUserGeo] = useState<UserGeoState | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isWatchingLocation, setIsWatchingLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const initialBootstrapDoneRef = useRef(false);
  const skipNextRouteFetchRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const lastWatchComputedRef = useRef<LatLngPoint | null>(null);

  const destinationPoi = poisById[selectedShrineId] ?? poisById['imam-hussain'];

  const quickOriginPois = useMemo(
    () => poisList.filter((p) => p.seed.category !== 'shrine'),
    [poisList]
  );

  // Bootstrap default origin & top 3 highway traffic statuses once core Places load
  useEffect(() => {
    if (initialBootstrapDoneRef.current) return;
    const shrine = poisById['imam-hussain'];
    const baghdad = poisById['baghdad-road'];
    if (!shrine || !baghdad) return;

    initialBootstrapDoneRef.current = true;
    setOriginPoint({
      label: baghdad.name,
      location: baghdad.location,
    });

    const featuredIds = ['baghdad-road', 'najaf-road', 'hilla-road'];
    featuredIds.forEach((id) => {
      const poi = poisById[id];
      if (poi) {
        void checkCorridorTraffic(id, poi.location, shrine.location);
      }
    });
  }, [poisById, checkCorridorTraffic]);

  // Recompute active route whenever origin, destination shrine, or travel mode changes
  useEffect(() => {
    if (!originPoint || !destinationPoi) return;
    if (skipNextRouteFetchRef.current) {
      skipNextRouteFetchRef.current = false;
      return;
    }
    setActiveRouteIndex(0);
    void computeRouteToShrine(
      originPoint.location,
      destinationPoi.location,
      travelMode
    );
  }, [originPoint, destinationPoi, travelMode, computeRouteToShrine]);

  const runSmartNavigationFrom = useCallback(
    async (origin: LatLngPoint, label: string, mode: TravelModeOption) => {
      const hussain = poisById['imam-hussain'];
      const abbas = poisById['al-abbas'];
      if (!hussain || !abbas) {
        setOriginPoint({label, location: origin});
        return;
      }

      const options = await computeSmartRecommendations(
        origin,
        hussain.location,
        abbas.location,
        mode
      );

      if (options.length > 0) {
        const bestOption = options[0];
        const allForBest = [bestOption.bestRoute, ...bestOption.alternatives];
        skipNextRouteFetchRef.current = true;
        setSelectedShrineId(bestOption.shrineId);
        setOriginPoint({label, location: origin});
        setActiveRouteIndex(0);
        applyComputedRoutes(allForBest);
      } else {
        setOriginPoint({label, location: origin});
      }
    },
    [poisById, computeSmartRecommendations, applyComputedRoutes]
  );

  const handleRequestSmartLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('المتصفح الحالي لا يدعم خدمة تحديد الموقع الجغرافي.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const loc: LatLngPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const inside = isPointInsideKarbala(loc);
        setUserGeo({
          location: loc,
          accuracyMeters: position.coords.accuracy ?? 25,
          isInsideKarbala: inside,
          updatedAt: Date.now(),
        });
        lastWatchComputedRef.current = loc;
        void runSmartNavigationFrom(loc, 'موقعي الحالي (GPS)', travelMode);
      },
      () => {
        setIsLocating(false);
        setGeoError(
          'تعذر الحصول على موقعك الحالي. يرجى السماح بصلاحية الموقع في المتصفح.'
        );
      },
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 10000}
    );
  }, [runSmartNavigationFrom, travelMode]);

  const handleToggleWatchLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    if (isWatchingLocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsWatchingLocation(false);
      return;
    }

    setGeoError(null);
    setIsWatchingLocation(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const loc: LatLngPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserGeo({
          location: loc,
          accuracyMeters: position.coords.accuracy ?? 25,
          isInsideKarbala: isPointInsideKarbala(loc),
          updatedAt: Date.now(),
        });

        const prev = lastWatchComputedRef.current;
        if (!prev || haversineMeters(prev, loc) >= 60) {
          lastWatchComputedRef.current = loc;
          void runSmartNavigationFrom(loc, 'موقعي الحالي (تتبع حي)', travelMode);
        }
      },
      () => {
        setGeoError('انقطع التتبع المباشر للموقع.');
        setIsWatchingLocation(false);
      },
      {enableHighAccuracy: true, maximumAge: 5000}
    );
  }, [isWatchingLocation, runSmartNavigationFrom, travelMode]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleSelectSmartRoute = useCallback(
    (
      shrineId: 'imam-hussain' | 'al-abbas',
      allShrineRoutes: ComputedRouteSummary[],
      routeIndex: number
    ) => {
      skipNextRouteFetchRef.current = true;
      setSelectedShrineId(shrineId);
      setActiveRouteIndex(routeIndex);
      applyComputedRoutes(allShrineRoutes);
    },
    [applyComputedRoutes]
  );

  const handleTravelModeChange = useCallback(
    (mode: TravelModeOption) => {
      setTravelMode(mode);
      if (userGeo) {
        void runSmartNavigationFrom(
          userGeo.location,
          'موقعي الحالي (GPS)',
          mode
        );
      }
    },
    [userGeo, runSmartNavigationFrom]
  );

  const handleSelectOrigin = useCallback(
    (label: string, location: LatLngPoint) => {
      setOriginPoint({label, location});
    },
    []
  );

  const handleRefreshTraffic = useCallback(async () => {
    setTrafficRefreshKey((k) => k + 1);
    if (!destinationPoi) return;

    setIsRefreshingAll(true);
    try {
      const targets = quickOriginPois.slice(0, 5);
      await Promise.all(
        targets.map((poi) =>
          checkCorridorTraffic(poi.id, poi.location, destinationPoi.location)
        )
      );
      if (originPoint) {
        await computeRouteToShrine(
          originPoint.location,
          destinationPoi.location,
          travelMode
        );
      }
    } finally {
      setIsRefreshingAll(false);
    }
  }, [
    destinationPoi,
    quickOriginPois,
    originPoint,
    travelMode,
    checkCorridorTraffic,
    computeRouteToShrine,
  ]);

  const handleCheckSingleCorridor = useCallback(
    async (corridorId: string, origin: LatLngPoint) => {
      if (!destinationPoi) return;
      await checkCorridorTraffic(corridorId, origin, destinationPoi.location);
    },
    [destinationPoi, checkCorridorTraffic]
  );

  const handleRouteFromCorridor = useCallback(
    (corridorId: string, label: string, origin: LatLngPoint) => {
      setOriginPoint({label, location: origin});
      setFocusedPoiId(corridorId);
      document
        .getElementById('map-workspace')
        ?.scrollIntoView({behavior: 'smooth'});
    },
    []
  );

  const handleRouteToShrineFromGuide = useCallback((shrineId: ShrineId) => {
    setSelectedShrineId(shrineId);
    document
      .getElementById('map-workspace')
      ?.scrollIntoView({behavior: 'smooth'});
  }, []);

  const handleFocusShrineOnMap = useCallback((shrineId: ShrineId) => {
    setSelectedShrineId(shrineId);
    setFocusedPoiId(shrineId);
    document
      .getElementById('map-workspace')
      ?.scrollIntoView({behavior: 'smooth'});
  }, []);

  const handleFocusPoiHandled = useCallback(() => {
    setFocusedPoiId(null);
  }, []);

  const isAuthError =
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4] text-stone-900">
      {/* Three-Zone Top Bar Contract */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-serif text-xl font-bold text-stone-900 whitespace-nowrap shrink-0"
          >
            دليل طرق كربلاء المقدسة
          </a>

          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600"
          >
            <a
              href="#smart-navigation"
              className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              الملاحة الذكية
            </a>
            <a
              href="#map-workspace"
              className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              الخريطة المباشرة
            </a>
            <a
              href="#corridors"
              className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              محاور المحافظة
            </a>
            <a
              href="#shrines"
              className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              العتبتان المقدستان
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => void handleRefreshTraffic()}
              disabled={isRefreshingAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-900 text-white text-xs font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshingAll ? 'جارٍ التحديث...' : 'تحديث المرور'}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Compact Editorial Lead Strip */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-stone-200 pb-5">
            <div className="max-w-3xl">
              <p className="text-xs text-stone-500 mb-1.5">
                محافظة كربلاء المقدسة · جمهورية العراق
              </p>
              <h1
                className="font-serif font-bold text-stone-900 leading-tight"
                style={{
                  fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                  textWrap: 'balance',
                }}
              >
                خريطة طرق كربلاء ومسارات الوصول إلى العتبتين المقدستين
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 max-w-md leading-relaxed">
              تتبع حالة المرور الحية على مداخل المحافظة والشوارع الداخلية المؤدية
              للعتبة الحسينية والعتبة العباسية المقدستين.
            </p>
          </div>
        </section>

        {/* Interactive Map & Route Planner Workbench */}
        <section
          id="map-workspace"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10"
        >
          {isAuthError && (
            <div className="mb-4 p-4 rounded-xl border border-red-200 bg-red-50 text-xs sm:text-sm text-red-900">
              تعذر تحميل خرائط جوجل حالياً. يرجى التحقق من صلاحية مفتاح الواجهة أو
              الاتصال بالشبكة.
            </div>
          )}

          {placesError && (
            <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
              {placesError}
            </div>
          )}

          <SmartNavPanel
            userGeo={userGeo}
            isLocating={isLocating}
            isWatchingLocation={isWatchingLocation}
            geoError={geoError}
            travelMode={travelMode}
            onChangeTravelMode={handleTravelModeChange}
            onRequestLocate={handleRequestSmartLocate}
            onToggleWatchLocation={handleToggleWatchLocation}
            smartOptions={smartOptions}
            isComputingSmart={isComputingSmart}
            smartError={smartError}
            selectedShrineId={selectedShrineId}
            activeRouteIndex={activeRouteIndex}
            onSelectSmartRoute={handleSelectSmartRoute}
            onQuickKarbalaOrigin={(label, location) =>
              void runSmartNavigationFrom(location, label, travelMode)
            }
            fallbackSamplePoint={
              poisById['unified-garage']
                ? {
                    label: poisById['unified-garage'].name,
                    location: poisById['unified-garage'].location,
                  }
                : poisById['baghdad-road']
                  ? {
                      label: poisById['baghdad-road'].name,
                      location: poisById['baghdad-road'].location,
                    }
                  : null
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-4 order-2 lg:order-1">
              <RoutePlannerPanel
                selectedShrineId={selectedShrineId}
                onSelectShrine={setSelectedShrineId}
                travelMode={travelMode}
                onChangeTravelMode={handleTravelModeChange}
                originPoint={originPoint}
                onSelectOrigin={handleSelectOrigin}
                quickOriginPois={quickOriginPois}
                routes={routes}
                activeRouteIndex={activeRouteIndex}
                onSelectRouteIndex={setActiveRouteIndex}
                isComputingRoute={isComputingRoute}
                routeError={routeError}
              />
            </div>

            <div className="lg:col-span-8 order-1 lg:order-2 min-h-[540px] lg:min-h-[680px]">
              <KarbalaMapView
                pois={poisList}
                poisById={poisById}
                selectedShrineId={selectedShrineId}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                originPoint={originPoint}
                userGeo={userGeo}
                onSelectOrigin={handleSelectOrigin}
                routes={routes}
                activeRouteIndex={activeRouteIndex}
                corridorTraffic={corridorTraffic}
                showTrafficLayer={showTrafficLayer}
                onToggleTrafficLayer={() => setShowTrafficLayer((v) => !v)}
                trafficRefreshKey={trafficRefreshKey}
                onRefreshTrafficLayer={() => setTrafficRefreshKey((k) => k + 1)}
                focusedPoiId={focusedPoiId}
                onFocusPoiHandled={handleFocusPoiHandled}
              />
            </div>
          </div>

          {isLoadingCore && (
            <p className="mt-3 text-xs text-stone-500">
              جارٍ جلب إحداثيات العتبتين المقدستين ومداخل كربلاء من خرائط جوجل...
            </p>
          )}
        </section>

        {/* Karbala Governorate Roads & Corridors Directory */}
        <CorridorsDirectory
          poisById={poisById}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          selectedShrineId={selectedShrineId}
          corridorTraffic={corridorTraffic}
          checkingCorridorIds={checkingCorridorIds}
          onCheckCorridorTraffic={handleCheckSingleCorridor}
          onRouteFromCorridor={handleRouteFromCorridor}
          extendedLoaded={extendedLoaded}
          isLoadingExtended={isLoadingExtended}
          onLoadExtended={loadExtendedCorridors}
        />

        {/* Two Holy Shrines Architectural Guide */}
        <ShrineGuideSection
          poisById={poisById}
          onRouteToShrine={handleRouteToShrineFromGuide}
          onFocusShrineOnMap={handleFocusShrineOnMap}
        />
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-stone-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-3">
            <span className="font-serif font-bold text-stone-800 text-sm">
              دليل طرق كربلاء المقدسة
            </span>
            <span aria-hidden="true">·</span>
            <span>توجيه الزائرين إلى العتبتين الحسينية والعباسية</span>
          </div>

          <div className="flex items-center gap-4">
            <a href="#map-workspace" className="hover:text-stone-900">
              الخريطة
            </a>
            <a href="#corridors" className="hover:text-stone-900">
              المحاور
            </a>
            <a href="#shrines" className="hover:text-stone-900">
              العتبتان
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  return (
    <div className="min-h-screen">
      {quotaExceeded && (
        <div
          className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm"
          dir="ltr"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {!MAPS_API_KEY ? (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8F7F4]">
          <div className="max-w-md w-full p-6 bg-white border border-stone-200 rounded-xl text-center space-y-3">
            <h1 className="font-serif text-2xl font-bold text-stone-900">
              دليل طرق كربلاء المقدسة
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              يرجى تفعيل مفتاح Google Maps Platform API Key في إعدادات التطبيق
              لتشغيل الخريطة التفاعلية وحالة المرور المباشرة.
            </p>
          </div>
        </div>
      ) : (
        <APIProvider
          apiKey={MAPS_API_KEY}
          language="ar"
          region="IQ"
          libraries={['places', 'routes', 'marker']}
        >
          <KarbalaExplorerWorkspace />
        </APIProvider>
      )}
    </div>
  );
}
