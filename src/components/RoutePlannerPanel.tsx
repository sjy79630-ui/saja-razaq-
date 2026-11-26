import {useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  Footprints,
  LocateFixed,
  Navigation,
  Search,
} from 'lucide-react';
import {useAutocompleteSuggestions} from '../hooks/useKarbalaPlaces';
import type {
  ComputedRouteSummary,
  DiscoveredPoi,
  LatLngPoint,
  ShrineId,
  TravelModeOption,
} from '../types/karbala';
import {
  checkAndDispatchQuotaError,
  formatEstimatedArrivalClock,
  getTrafficMeta,
} from '../utils/quotaHelper';

interface RoutePlannerPanelProps {
  selectedShrineId: ShrineId;
  onSelectShrine: (id: ShrineId) => void;
  travelMode: TravelModeOption;
  onChangeTravelMode: (mode: TravelModeOption) => void;
  originPoint: {label: string; location: LatLngPoint} | null;
  onSelectOrigin: (label: string, location: LatLngPoint) => void;
  quickOriginPois: DiscoveredPoi[];
  routes: ComputedRouteSummary[];
  activeRouteIndex: number;
  onSelectRouteIndex: (idx: number) => void;
  isComputingRoute: boolean;
  routeError: string | null;
}

const SHRINE_OPTIONS: Array<{id: ShrineId; label: string}> = [
  {id: 'imam-hussain', label: 'العتبة الحسينية'},
  {id: 'al-abbas', label: 'العتبة العباسية'},
  {id: 'bayn-al-haramayn', label: 'ما بين الحرمين'},
];

export function RoutePlannerPanel({
  selectedShrineId,
  onSelectShrine,
  travelMode,
  onChangeTravelMode,
  originPoint,
  onSelectOrigin,
  quickOriginPois,
  routes,
  activeRouteIndex,
  onSelectRouteIndex,
  isComputingRoute,
  routeError,
}: RoutePlannerPanelProps) {
  const placesLib = useMapsLibrary('places');
  const [searchInput, setSearchInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const {suggestions, isLoading: isLoadingSuggestions, resetSession} =
    useAutocompleteSuggestions(searchInput);

  const handleSuggestionClick = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      if (place.location) {
        const label =
          place.displayName ||
          suggestion.placePrediction.text?.text ||
          'موقع محدد';
        onSelectOrigin(label, {
          lat: place.location.lat(),
          lng: place.location.lng(),
        });
        setSearchInput(label);
        setIsDropdownOpen(false);
      }
      resetSession();
    } catch (err) {
      checkAndDispatchQuotaError(err);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('المتصفح لا يدعم تحديد الموقع الجغرافي.');
      return;
    }
    setIsLocating(true);
    setGeoStatus(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        onSelectOrigin('موقعي الحالي (GPS)', loc);
        setSearchInput('موقعي الحالي');
      },
      () => {
        setIsLocating(false);
        setGeoStatus('تعذر الوصول إلى الموقع الحالي. تأكد من تفعيل إذن الموقع.');
      },
      {enableHighAccuracy: true, timeout: 8000}
    );
  };

  const activeRoute = routes[activeRouteIndex] ?? routes[0] ?? null;
  const trafficMeta = activeRoute
    ? getTrafficMeta(activeRoute.trafficLevel)
    : null;

  return (
    <aside className="flex flex-col bg-white border border-stone-200 rounded-xl overflow-hidden h-full">
      {/* Header & Shrine Destination Tabs */}
      <div className="p-5 border-b border-stone-200">
        <p className="text-xs text-stone-500 mb-1">الوجهة المقدسة</p>
        <h2 className="font-serif text-xl font-bold text-stone-900 mb-3">
          تحديد مسار الوصول للأمامين
        </h2>
        <div
          className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-lg"
          role="tablist"
          aria-label="اختيار العتبة المقدسة"
        >
          {SHRINE_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectShrine(item.id)}
              className={`px-2 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
                selectedShrineId === item.id
                  ? 'bg-emerald-900 text-white shadow-sm'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Origin Input & Travel Mode */}
      <div className="p-5 border-b border-stone-200 space-y-4">
        <div>
          <label
            htmlFor="origin-search-input"
            className="block text-xs font-medium text-stone-700 mb-1.5"
          >
            نقطة الانطلاق في كربلاء أو المحافظات
          </label>
          <div className="relative">
            <div className="flex items-center border border-stone-300 rounded-lg bg-white focus-within:border-emerald-800 focus-within:ring-1 focus-within:ring-emerald-800 transition-colors">
              <Search className="w-4 h-4 text-stone-400 mr-3 shrink-0" />
              <input
                id="origin-search-input"
                type="text"
                value={searchInput}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setIsDropdownOpen(true);
                }}
                placeholder="ابحث عن حي، شارع، قضاء أو مدخل..."
                className="w-full py-2.5 px-2.5 text-sm text-stone-900 placeholder:text-stone-400 bg-transparent focus:outline-none"
              />
            </div>

            {isDropdownOpen &&
              (suggestions.length > 0 || isLoadingSuggestions) && (
                <div className="absolute z-30 top-full right-0 left-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {isLoadingSuggestions && (
                    <div className="px-3 py-2.5 text-xs text-stone-500">
                      جارٍ البحث عن الموقع...
                    </div>
                  )}
                  {suggestions.map((sug, idx) => (
                    <button
                      key={sug.placePrediction?.placeId ?? idx}
                      type="button"
                      onClick={() => void handleSuggestionClick(sug)}
                      className="w-full text-right px-3 py-2.5 text-xs text-stone-800 hover:bg-stone-50 border-b border-stone-100 last:border-b-0 transition-colors cursor-pointer"
                    >
                      {sug.placePrediction?.text.text}
                    </button>
                  ))}
                </div>
              )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-2.5">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-medium text-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <LocateFixed className="w-3.5 h-3.5 text-emerald-800" />
              <span>{isLocating ? 'جارٍ التحديد...' : 'موقعي الحالي'}</span>
            </button>

            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                type="button"
                onClick={() => onChangeTravelMode('DRIVING')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  travelMode === 'DRIVING'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>بالسيارة</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeTravelMode('WALKING')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  travelMode === 'WALKING'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>مشياً</span>
              </button>
            </div>
          </div>

          {geoStatus && (
            <p className="text-xs text-amber-800 mt-2">{geoStatus}</p>
          )}
        </div>

        {/* Quick-select from discovered entrances/hubs */}
        {quickOriginPois.length > 0 && (
          <div>
            <p className="text-xs text-stone-500 mb-2">
              انطلاق سريع من مداخل كربلاء:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickOriginPois.slice(0, 5).map((poi) => {
                const isSelected = originPoint?.label === poi.name;
                return (
                  <button
                    key={poi.id}
                    type="button"
                    onClick={() => {
                      onSelectOrigin(poi.name, poi.location);
                      setSearchInput(poi.name);
                      setIsDropdownOpen(false);
                    }}
                    className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-900 text-white border-emerald-900'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-emerald-700'
                    }`}
                  >
                    {poi.seed.fallbackLabel}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Live Route Result & Turn-by-Turn Steps */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {isComputingRoute && (
          <div className="py-8 text-center text-sm text-stone-600">
            جارٍ احتساب المسار وحالة المرور المباشرة...
          </div>
        )}

        {!isComputingRoute && routeError && (
          <div className="p-3.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{routeError}</span>
          </div>
        )}

        {!isComputingRoute && !routeError && !activeRoute && (
          <div className="py-6 text-center space-y-2">
            <Navigation className="w-6 h-6 text-emerald-800 mx-auto" />
            <p className="text-sm font-medium text-stone-900">
              اختر نقطة انطلاق لعرض المسار
            </p>
            <p className="text-xs text-stone-500 leading-relaxed">
              يمكنك البحث عن موقعك، أو اختيار أحد مداخل المحافظة، أو الضغط مباشرة
              على الخريطة.
            </p>
          </div>
        )}

        {!isComputingRoute && activeRoute && trafficMeta && (
          <>
            {/* Route Telemetry Summary */}
            <div className="p-4 rounded-lg border border-stone-200 bg-[#FBF9F5] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-stone-500">
                  {originPoint?.label ?? 'نقطة الانطلاق'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${trafficMeta.colorClass}`}
                >
                  {activeRoute.trafficLevel === 'normal' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  <span>{trafficMeta.label}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-stone-200">
                <div>
                  <p className="text-[11px] text-stone-500">الزمن والوصول التقديري</p>
                  <p className="text-lg font-bold text-stone-900 tabular-nums">
                    {activeRoute.durationText}
                  </p>
                  <p className="text-[11px] text-emerald-900 font-medium tabular-nums">
                    الوصول المتوقع:{' '}
                    {formatEstimatedArrivalClock(activeRoute.durationMillis)}
                  </p>
                  {travelMode === 'DRIVING' && activeRoute.delayMinutes > 0 && (
                    <p className="text-[11px] text-amber-800 tabular-nums">
                      تأخير مروري +{activeRoute.delayMinutes} د
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-stone-500">المسافة الكلية</p>
                  <p className="text-lg font-bold text-stone-900 tabular-nums">
                    {activeRoute.distanceText}
                  </p>
                  {travelMode === 'DRIVING' && (
                    <p className="text-[11px] text-stone-500 tabular-nums">
                      اعتيادياً: {activeRoute.staticDurationText}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Alternative Routes Switcher */}
            {routes.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-stone-700">
                  المسارات المتاحة ({routes.length})
                </p>
                <div className="space-y-1.5">
                  {routes.map((r, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectRouteIndex(idx)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-right text-xs transition-colors cursor-pointer ${
                        idx === activeRouteIndex
                          ? 'border-emerald-800 bg-emerald-50/60 text-stone-900 font-semibold'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <span className="truncate">{r.description}</span>
                      <span className="shrink-0 tabular-nums text-stone-600">
                        {r.durationText} · {r.distanceText}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Turn-by-Turn Instructions */}
            {activeRoute.steps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span className="font-medium text-stone-900">
                    خطوات الطريق التفصيلية
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{activeRoute.steps.length} خطوة</span>
                  </span>
                </div>
                <ol className="divide-y divide-stone-100 border border-stone-200 rounded-lg bg-white">
                  {activeRoute.steps.map((step, idx) => (
                    <li
                      key={idx}
                      className="px-3 py-2.5 text-xs text-stone-800 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[11px] font-mono text-stone-400 tabular-nums mt-0.5">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="leading-relaxed">
                          {step.instructions}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-500 whitespace-nowrap shrink-0 tabular-nums">
                        {step.distanceText}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
