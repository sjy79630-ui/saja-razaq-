import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  Footprints,
  LocateFixed,
  Navigation,
  Radio,
} from 'lucide-react';
import type {
  ComputedRouteSummary,
  LatLngPoint,
  ShrineId,
  SmartNavOption,
  TravelModeOption,
  UserGeoState,
} from '../types/karbala';
import {getTrafficMeta} from '../utils/quotaHelper';

interface SmartNavPanelProps {
  userGeo: UserGeoState | null;
  isLocating: boolean;
  isWatchingLocation: boolean;
  geoError: string | null;
  travelMode: TravelModeOption;
  onChangeTravelMode: (mode: TravelModeOption) => void;
  onRequestLocate: () => void;
  onToggleWatchLocation: () => void;
  smartOptions: SmartNavOption[];
  isComputingSmart: boolean;
  smartError: string | null;
  selectedShrineId: ShrineId;
  activeRouteIndex: number;
  onSelectSmartRoute: (
    shrineId: 'imam-hussain' | 'al-abbas',
    allShrineRoutes: ComputedRouteSummary[],
    routeIndex: number
  ) => void;
  onQuickKarbalaOrigin?: (label: string, location: LatLngPoint) => void;
  fallbackSamplePoint: {label: string; location: LatLngPoint} | null;
}

export function SmartNavPanel({
  userGeo,
  isLocating,
  isWatchingLocation,
  geoError,
  travelMode,
  onChangeTravelMode,
  onRequestLocate,
  onToggleWatchLocation,
  smartOptions,
  isComputingSmart,
  smartError,
  selectedShrineId,
  activeRouteIndex,
  onSelectSmartRoute,
  onQuickKarbalaOrigin,
  fallbackSamplePoint,
}: SmartNavPanelProps) {
  const fastestShrineId = smartOptions[0]?.shrineId ?? null;

  return (
    <section
      id="smart-navigation"
      className="mb-5 bg-white border border-stone-200 rounded-xl p-5 sm:p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-stone-500">
            الملاحة الذكية · تحديد الموقع وحساب الوصول التقديري (ETA)
          </p>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
            وجّهني من موقعي إلى الصحن الحسيني أو العباسي
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-2xl">
            اسمح بتحديد موقعك الحالي داخل كربلاء لاقتراح أسرع المسارات المتاحة
            وفق حالة المرور المباشرة وحساب وقت الوصول التقديري لكل من العتبتين.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
            <button
              type="button"
              onClick={() => onChangeTravelMode('DRIVING')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                travelMode === 'WALKING'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>مشياً</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onRequestLocate}
            disabled={isLocating}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-900 text-white text-xs sm:text-sm font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <LocateFixed className="w-4 h-4" />
            <span>
              {isLocating
                ? 'جارٍ تحديد موقعك...'
                : userGeo
                  ? 'تحديث موقعي واقتراح المسار'
                  : 'تحديد موقعي الحالي وبدء الملاحة'}
            </span>
          </button>

          {userGeo && (
            <button
              type="button"
              onClick={onToggleWatchLocation}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isWatchingLocation
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-stone-50 text-stone-800 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>
                {isWatchingLocation ? 'إيقاف التتبع المباشر' : 'تتبع مباشر'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Location Status & Geofence Notice */}
      {(userGeo || geoError) && (
        <div className="mt-4 pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {userGeo && (
            <div className="flex flex-wrap items-center gap-2 text-stone-700 tabular-nums">
              <Compass className="w-4 h-4 text-emerald-800 shrink-0" />
              <span className="font-semibold text-stone-900">
                {userGeo.isInsideKarbala
                  ? 'تم تحديد موقعك داخل محافظة كربلاء المقدسة'
                  : 'موقعك الحالي خارج حدود محافظة كربلاء'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                الإحداثيات: {userGeo.location.lat.toFixed(4)},{' '}
                {userGeo.location.lng.toFixed(4)}
              </span>
              <span aria-hidden="true">·</span>
              <span>دقة التحديد: ±{Math.round(userGeo.accuracyMeters)} م</span>
              {!userGeo.isInsideKarbala &&
                fallbackSamplePoint &&
                onQuickKarbalaOrigin && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() =>
                        onQuickKarbalaOrigin(
                          fallbackSamplePoint.label,
                          fallbackSamplePoint.location
                        )
                      }
                      className="text-emerald-800 font-medium underline underline-offset-4 hover:text-emerald-950 cursor-pointer"
                    >
                      معاينة الملاحة من {fallbackSamplePoint.label}
                    </button>
                  </>
                )}
            </div>
          )}

          {geoError && (
            <div className="flex flex-wrap items-center gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{geoError}</span>
              {fallbackSamplePoint && onQuickKarbalaOrigin && (
                <button
                  type="button"
                  onClick={() =>
                    onQuickKarbalaOrigin(
                      fallbackSamplePoint.label,
                      fallbackSamplePoint.location
                    )
                  }
                  className="text-emerald-900 font-medium underline underline-offset-4 cursor-pointer"
                >
                  حساب المسار من {fallbackSamplePoint.label} بدلاً من ذلك
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Smart Suggestions Loading / Error */}
      {isComputingSmart && (
        <div className="mt-4 pt-4 border-t border-stone-200 text-xs sm:text-sm text-stone-600">
          جارٍ مقارنة المسارات المباشرة إلى الصحن الحسيني والصحن العباسي وحساب
          الوقت التقديري للوصول...
        </div>
      )}

      {!isComputingSmart && smartError && (
        <div className="mt-4 pt-4 border-t border-stone-200 text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{smartError}</span>
        </div>
      )}

      {/* Side-by-Side Comparison Cards for Both Sanctuaries */}
      {!isComputingSmart && smartOptions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          {smartOptions.map((option) => {
            const isFastest = option.shrineId === fastestShrineId;
            const isCurrentlySelectedShrine =
              selectedShrineId === option.shrineId;
            const allRoutes = [option.bestRoute, ...option.alternatives];
            const trafficMeta = getTrafficMeta(option.bestRoute.trafficLevel);

            return (
              <div
                key={option.shrineId}
                className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                  isCurrentlySelectedShrine
                    ? 'border-emerald-800 bg-[#FBF9F5]'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-stone-500">
                      {isFastest
                        ? 'الأسرع وصولاً حالياً · توصية ذكية'
                        : 'وجهة مقدسة بديلة'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${trafficMeta.colorClass}`}
                    >
                      {option.bestRoute.trafficLevel === 'normal' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      <span>{trafficMeta.label}</span>
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-serif text-lg font-bold text-stone-900">
                      {option.shrineName}
                    </h3>
                    <span className="text-xs text-stone-600 truncate max-w-[180px]">
                      عبر {option.bestRoute.description}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-100 tabular-nums">
                    <div>
                      <p className="text-[11px] text-stone-500">المدة المتوقعة</p>
                      <p className="text-base font-bold text-stone-900">
                        {option.bestRoute.durationText}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500">الوصول التقديري</p>
                      <p className="text-base font-bold text-emerald-900 inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{option.estimatedArrivalTimeText}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500">المسافة</p>
                      <p className="text-base font-bold text-stone-900">
                        {option.bestRoute.distanceText}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectSmartRoute(option.shrineId, allRoutes, 0)
                    }
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      isCurrentlySelectedShrine && activeRouteIndex === 0
                        ? 'bg-emerald-900 text-white'
                        : 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>
                      {isCurrentlySelectedShrine && activeRouteIndex === 0
                        ? 'المسار معروض على الخريطة'
                        : 'اختيار أفضل مسار'}
                    </span>
                  </button>

                  {option.alternatives.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {option.alternatives.map((alt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            onSelectSmartRoute(
                              option.shrineId,
                              allRoutes,
                              idx + 1
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                            isCurrentlySelectedShrine &&
                            activeRouteIndex === idx + 1
                              ? 'border-emerald-800 bg-emerald-50 text-emerald-950'
                              : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          بديل {idx + 1}: {alt.durationText}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
