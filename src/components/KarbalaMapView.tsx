import {useCallback, useEffect, useRef, useState} from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  Layers,
  MapPin,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import type {
  ComputedRouteSummary,
  CorridorCategory,
  CorridorTrafficStatus,
  DiscoveredPoi,
  LatLngPoint,
  ShrineId,
  UserGeoState,
} from '../types/karbala';
import {getTrafficMeta} from '../utils/quotaHelper';

const KARBALA_DEFAULT_CENTER: LatLngPoint = {lat: 32.616, lng: 44.032};

interface KarbalaMapViewProps {
  pois: DiscoveredPoi[];
  poisById: Record<string, DiscoveredPoi>;
  selectedShrineId: ShrineId;
  activeCategory: CorridorCategory;
  onCategoryChange: (cat: CorridorCategory) => void;
  originPoint: {label: string; location: LatLngPoint} | null;
  userGeo: UserGeoState | null;
  onSelectOrigin: (label: string, location: LatLngPoint) => void;
  routes: ComputedRouteSummary[];
  activeRouteIndex: number;
  corridorTraffic: Record<string, CorridorTrafficStatus>;
  showTrafficLayer: boolean;
  onToggleTrafficLayer: () => void;
  trafficRefreshKey: number;
  onRefreshTrafficLayer: () => void;
  focusedPoiId: string | null;
  onFocusPoiHandled: () => void;
}

function TrafficLayerController({
  visible,
  refreshKey,
}: {
  visible: boolean;
  refreshKey: number;
}) {
  const map = useMap();
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.TrafficLayer) {
      return;
    }

    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new google.maps.TrafficLayer({
        autoRefresh: true,
      });
    }

    if (visible) {
      trafficLayerRef.current.setMap(null);
      trafficLayerRef.current.setMap(map);
    } else {
      trafficLayerRef.current.setMap(null);
    }

    return () => {
      trafficLayerRef.current?.setMap(null);
    };
  }, [map, visible, refreshKey]);

  return null;
}

function RoutePolylineController({
  routes,
  activeRouteIndex,
}: {
  routes: ComputedRouteSummary[];
  activeRouteIndex: number;
}) {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || routes.length === 0) return;

    const created: google.maps.Polyline[] = [];

    // Draw inactive alternatives first in subtle slate
    routes.forEach((summary, idx) => {
      if (idx === activeRouteIndex) return;
      const altLines = summary.rawRoute.createPolylines({
        polylineOptions: {
          strokeColor: '#78716C',
          strokeOpacity: 0.5,
          strokeWeight: 4,
          zIndex: 1,
        },
      });
      altLines.forEach((line) => {
        line.setMap(map);
        created.push(line);
      });
    });

    // Draw active route with traffic speed colors when available
    const activeSummary = routes[activeRouteIndex] ?? routes[0];
    if (activeSummary) {
      const activeLines = activeSummary.rawRoute.createPolylines({
        polylineOptions: (defaults, details) => {
          let strokeColor = '#0F5132';
          if (details.speed === 'NORMAL') strokeColor = '#059669';
          else if (details.speed === 'SLOW') strokeColor = '#D97706';
          else if (details.speed === 'TRAFFIC_JAM') strokeColor = '#DC2626';

          return {
            ...defaults,
            strokeColor,
            strokeOpacity: 0.92,
            strokeWeight: 6,
            zIndex: 10,
          };
        },
      });

      activeLines.forEach((line) => {
        line.setMap(map);
        created.push(line);
      });

      if (activeSummary.rawRoute.viewport) {
        map.fitBounds(activeSummary.rawRoute.viewport, {
          top: 56,
          right: 48,
          bottom: 56,
          left: 48,
        });
      }
    }

    polylinesRef.current = created;

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routes, activeRouteIndex]);

  return null;
}

function MapViewportController({
  focusedPoi,
  onHandled,
  recenterSignal,
  shrineLocation,
}: {
  focusedPoi: DiscoveredPoi | null;
  onHandled: () => void;
  recenterSignal: number;
  shrineLocation: LatLngPoint | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !focusedPoi) return;
    map.panTo(focusedPoi.location);
    map.setZoom(focusedPoi.seed.category === 'shrine' ? 16 : 14);
    onHandled();
  }, [map, focusedPoi, onHandled]);

  useEffect(() => {
    if (!map || recenterSignal === 0) return;
    map.panTo(shrineLocation ?? KARBALA_DEFAULT_CENTER);
    map.setZoom(15);
  }, [map, recenterSignal, shrineLocation]);

  return null;
}

function PoiAdvancedMarker({
  poi,
  isSelectedShrine,
  isSelectedPoi,
  trafficStatus,
  onSelectPoi,
}: {
  poi: DiscoveredPoi;
  isSelectedShrine: boolean;
  isSelectedPoi: boolean;
  trafficStatus?: CorridorTrafficStatus;
  onSelectPoi: (poi: DiscoveredPoi, markerEl: google.maps.marker.AdvancedMarkerElement | null) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  const isShrine = poi.seed.category === 'shrine';
  const isAlAbbas = poi.id === 'al-abbas';
  const isBayn = poi.id === 'bayn-al-haramayn';

  const trafficMeta = trafficStatus
    ? getTrafficMeta(trafficStatus.trafficLevel)
    : null;

  return (
    <AdvancedMarker
      ref={markerRef}
      position={poi.location}
      zIndex={isShrine ? 50 : isSelectedPoi ? 40 : 20}
      onClick={() => onSelectPoi(poi, marker)}
    >
      {isShrine ? (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shadow-md transition-transform duration-150 cursor-pointer ${
            isSelectedShrine
              ? 'bg-emerald-950 text-white border-amber-400 scale-105'
              : isAlAbbas
                ? 'bg-amber-900 text-amber-50 border-amber-300 hover:scale-105'
                : isBayn
                  ? 'bg-stone-900 text-stone-50 border-stone-400 hover:scale-105'
                  : 'bg-emerald-900 text-emerald-50 border-emerald-300 hover:scale-105'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-xs font-semibold whitespace-nowrap">
            {poi.seed.fallbackLabel}
          </span>
        </div>
      ) : (
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border shadow-sm transition-transform duration-150 cursor-pointer ${
            isSelectedPoi
              ? 'bg-stone-900 text-white border-stone-900 scale-105'
              : 'bg-white text-stone-900 border-stone-300 hover:border-emerald-700 hover:scale-105'
          }`}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: trafficMeta ? trafficMeta.dotColor : '#0F5132',
            }}
          />
          <span className="text-[11px] font-medium whitespace-nowrap max-w-[140px] truncate">
            {poi.seed.fallbackLabel}
          </span>
        </div>
      )}
    </AdvancedMarker>
  );
}

export function KarbalaMapView({
  pois,
  poisById,
  selectedShrineId,
  activeCategory,
  onCategoryChange,
  originPoint,
  userGeo,
  onSelectOrigin,
  routes,
  activeRouteIndex,
  corridorTraffic,
  showTrafficLayer,
  onToggleTrafficLayer,
  trafficRefreshKey,
  onRefreshTrafficLayer,
  focusedPoiId,
  onFocusPoiHandled,
}: KarbalaMapViewProps) {
  const [selectedPoi, setSelectedPoi] = useState<DiscoveredPoi | null>(null);
  const [anchorMarker, setAnchorMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const filteredPois = pois.filter(
    (p) => activeCategory === 'all' || p.seed.category === activeCategory
  );

  const selectedShrinePoi = poisById[selectedShrineId] ?? null;
  const focusedPoi = focusedPoiId ? (poisById[focusedPoiId] ?? null) : null;

  const handleSelectMarker = useCallback(
    (
      poi: DiscoveredPoi,
      markerEl: google.maps.marker.AdvancedMarkerElement | null
    ) => {
      setSelectedPoi(poi);
      setAnchorMarker(markerEl);
    },
    []
  );

  const handleMapClick = useCallback(
    (ev: {detail: {latLng: LatLngPoint | null}}) => {
      setSelectedPoi(null);
      if (ev.detail?.latLng) {
        const {lat, lng} = ev.detail.latLng;
        onSelectOrigin(
          `نقطة محددة (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          {lat, lng}
        );
      }
    },
    [onSelectOrigin]
  );

  const categoryButtons: Array<{id: CorridorCategory; label: string}> = [
    {id: 'all', label: 'الكل'},
    {id: 'shrine', label: 'العتبتان'},
    {id: 'highway', label: 'المداخل والطرق'},
    {id: 'internal', label: 'شوارع الحرمين'},
    {id: 'hub', label: 'مراكز النقل'},
  ];

  const selectedPoiTraffic = selectedPoi
    ? corridorTraffic[selectedPoi.id]
    : undefined;

  return (
    <div className="relative w-full h-full min-h-[540px] lg:min-h-[680px] rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
      <GoogleMap
        defaultCenter={KARBALA_DEFAULT_CENTER}
        defaultZoom={13}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        onClick={handleMapClick}
        className="w-full h-full min-h-[540px] lg:min-h-[680px]"
      >
        <TrafficLayerController
          visible={showTrafficLayer}
          refreshKey={trafficRefreshKey}
        />

        <RoutePolylineController
          routes={routes}
          activeRouteIndex={activeRouteIndex}
        />

        <MapViewportController
          focusedPoi={focusedPoi}
          onHandled={onFocusPoiHandled}
          recenterSignal={recenterSignal}
          shrineLocation={selectedShrinePoi?.location ?? null}
        />

        {filteredPois.map((poi) => (
          <PoiAdvancedMarker
            key={poi.id}
            poi={poi}
            isSelectedShrine={poi.id === selectedShrineId}
            isSelectedPoi={selectedPoi?.id === poi.id}
            trafficStatus={corridorTraffic[poi.id]}
            onSelectPoi={handleSelectMarker}
          />
        ))}

        {userGeo && (
          <AdvancedMarker position={userGeo.location} zIndex={70}>
            <div className="flex flex-col items-center">
              <div className="px-2 py-0.5 mb-1 rounded-md bg-blue-700 text-white text-[11px] font-semibold shadow-sm whitespace-nowrap">
                موقعي الحالي
              </div>
              <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md ring-4 ring-blue-500/25" />
            </div>
          </AdvancedMarker>
        )}

        {originPoint &&
          (!userGeo ||
            Math.abs(originPoint.location.lat - userGeo.location.lat) > 0.0002 ||
            Math.abs(originPoint.location.lng - userGeo.location.lng) >
              0.0002) && (
            <AdvancedMarker position={originPoint.location} zIndex={60}>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-900 text-white border border-white shadow-md">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap max-w-[160px] truncate">
                  نقطة الانطلاق
                </span>
              </div>
            </AdvancedMarker>
          )}

        {selectedPoi && anchorMarker && (
          <InfoWindow
            anchor={anchorMarker}
            onCloseClick={() => setSelectedPoi(null)}
          >
            <div className="min-w-[230px] max-w-[290px] p-1 text-right font-sans" dir="rtl">
              <p className="text-xs text-stone-500 mb-1">
                {selectedPoi.seed.directionLabel}
              </p>
              <h4 className="text-sm font-bold text-stone-900 mb-1">
                {selectedPoi.name}
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed mb-2.5">
                {selectedPoi.formattedAddress}
              </p>

              {selectedPoiTraffic && (
                <div className="flex items-center gap-2 text-xs text-stone-800 border-t border-stone-200 pt-2 mb-2.5 tabular-nums">
                  <span
                    className="font-semibold"
                    style={{
                      color: getTrafficMeta(selectedPoiTraffic.trafficLevel)
                        .dotColor,
                    }}
                  >
                    {getTrafficMeta(selectedPoiTraffic.trafficLevel).label}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedPoiTraffic.durationText}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedPoiTraffic.distanceText}</span>
                </div>
              )}

              {selectedPoi.seed.category !== 'shrine' && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectOrigin(selectedPoi.name, selectedPoi.location);
                    setSelectedPoi(null);
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-emerald-900 text-white text-xs font-medium hover:bg-emerald-800 transition-colors cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>رسم مسار الوصول للحرم</span>
                </button>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Top Overlay Toolbar inside Map */}
      <div className="absolute top-3 right-3 left-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div
          className="flex items-center gap-1 p-1 bg-white/95 backdrop-blur-sm border border-stone-200 rounded-lg shadow-sm pointer-events-auto overflow-x-auto max-w-full"
          role="tablist"
          aria-label="تصفية نقاط الاهتمام"
        >
          {categoryButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => onCategoryChange(btn.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory === btn.id
                  ? 'bg-emerald-900 text-white'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleTrafficLayer}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showTrafficLayer
                ? 'bg-emerald-900 text-white border-emerald-900'
                : 'bg-white/95 text-stone-800 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showTrafficLayer ? 'المرور الحي: مفعّل' : 'إظهار المرور الحي'}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshTrafficLayer}
            title="تحديث طبقة المرور"
            aria-label="تحديث طبقة المرور"
            className="inline-flex items-center justify-center p-2 rounded-lg bg-white/95 border border-stone-200 text-stone-700 hover:bg-stone-50 shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setRecenterSignal((s) => s + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/95 border border-stone-200 text-stone-800 hover:bg-stone-50 text-xs font-medium shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-800" />
            <span>العتبتان</span>
          </button>
        </div>
      </div>

      {/* Bottom Traffic Legend & Tip */}
      <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm border border-stone-200 rounded-lg px-3 py-2 shadow-sm flex flex-wrap items-center gap-3 text-[11px] text-stone-700 pointer-events-auto">
        <span className="font-medium text-stone-900">دليل حالة المرور:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-emerald-600" />
          <span>سالك</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-amber-500" />
          <span>بطيء</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-1 rounded-full bg-red-600" />
          <span>مزدحم</span>
        </span>
        <span className="hidden sm:inline text-stone-400" aria-hidden="true">
          ·
        </span>
        <span className="hidden sm:inline text-stone-600">
          اضغط على أي مكان بالخريطة لتعيين نقطة الانطلاق
        </span>
      </div>
    </div>
  );
}
