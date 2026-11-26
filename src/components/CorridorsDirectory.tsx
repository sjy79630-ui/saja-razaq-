import {
  AlertTriangle,
  CheckCircle2,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import {KARBALA_CORRIDOR_SEEDS} from '../data/karbalaCorridors';
import type {
  CorridorCategory,
  CorridorTrafficStatus,
  DiscoveredPoi,
  LatLngPoint,
  ShrineId,
} from '../types/karbala';
import {getTrafficMeta} from '../utils/quotaHelper';

interface CorridorsDirectoryProps {
  poisById: Record<string, DiscoveredPoi>;
  activeCategory: CorridorCategory;
  onCategoryChange: (cat: CorridorCategory) => void;
  selectedShrineId: ShrineId;
  corridorTraffic: Record<string, CorridorTrafficStatus>;
  checkingCorridorIds: Record<string, boolean>;
  onCheckCorridorTraffic: (
    corridorId: string,
    origin: LatLngPoint
  ) => Promise<void>;
  onRouteFromCorridor: (
    corridorId: string,
    label: string,
    origin: LatLngPoint
  ) => void;
  extendedLoaded: boolean;
  isLoadingExtended: boolean;
  onLoadExtended: () => Promise<void>;
}

const CATEGORY_TABS: Array<{id: CorridorCategory; label: string}> = [
  {id: 'all', label: 'جميع الطرق والمحاور'},
  {id: 'highway', label: 'المداخل والطرق الخارجية'},
  {id: 'internal', label: 'الشوارع الداخلية للحرمين'},
  {id: 'hub', label: 'مراكز النقل والزائرين'},
];

export function CorridorsDirectory({
  poisById,
  activeCategory,
  onCategoryChange,
  selectedShrineId,
  corridorTraffic,
  checkingCorridorIds,
  onCheckCorridorTraffic,
  onRouteFromCorridor,
  extendedLoaded,
  isLoadingExtended,
  onLoadExtended,
}: CorridorsDirectoryProps) {
  const nonShrineSeeds = KARBALA_CORRIDOR_SEEDS.filter(
    (s) => s.category !== 'shrine'
  );

  const visibleSeeds = nonShrineSeeds.filter((s) => {
    if (activeCategory === 'all' || activeCategory === 'shrine') return true;
    return s.category === activeCategory;
  });

  const shrineName =
    selectedShrineId === 'al-abbas'
      ? 'العتبة العباسية المقدسة'
      : selectedShrineId === 'bayn-al-haramayn'
        ? 'منطقة ما بين الحرمين'
        : 'العتبة الحسينية المقدسة';

  return (
    <section
      id="corridors"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-stone-200"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <p className="text-xs text-stone-500 mb-1.5">
            شبكة الطرق والمحاور · محافظة كربلاء المقدسة
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
            دليل الطرق المؤدية إلى {shrineName}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg overflow-x-auto max-w-full">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onCategoryChange(tab.id);
                  if (
                    !extendedLoaded &&
                    (tab.id === 'internal' || tab.id === 'hub' || tab.id === 'all')
                  ) {
                    void onLoadExtended();
                  }
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeCategory === tab.id
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {!extendedLoaded && (
            <button
              type="button"
              onClick={() => void onLoadExtended()}
              disabled={isLoadingExtended}
              className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800 hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {isLoadingExtended
                ? 'جارٍ تحميل الشوارع...'
                : 'تحميل الشوارع الداخلية كافة'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleSeeds.map((seed, index) => {
          const poi = poisById[seed.id];
          const traffic = corridorTraffic[seed.id];
          const isChecking = Boolean(checkingCorridorIds[seed.id]);
          const trafficMeta = traffic
            ? getTrafficMeta(traffic.trafficLevel)
            : null;

          const categoryText =
            seed.category === 'highway'
              ? 'محور خارجي'
              : seed.category === 'internal'
                ? 'شارع داخلي'
                : 'مركز نقل';

          return (
            <article
              key={seed.id}
              className="flex flex-col justify-between p-5 bg-white border border-stone-200 rounded-xl hover:border-stone-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-stone-500 mb-2">
                  <span>
                    {String(index + 1).padStart(2, '0')} · {categoryText} ·{' '}
                    {seed.directionLabel}
                  </span>
                </div>

                <h3 className="text-base font-bold text-stone-900 mb-1.5">
                  {poi ? poi.name : seed.fallbackLabel}
                </h3>

                <p className="text-xs text-stone-600 leading-relaxed mb-4">
                  {seed.approachRole}
                </p>

                {poi && (
                  <p className="text-[11px] text-stone-500 mb-4 truncate">
                    {poi.formattedAddress}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-stone-100 space-y-3">
                {traffic && trafficMeta ? (
                  <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${trafficMeta.colorClass}`}
                    >
                      {traffic.trafficLevel === 'normal' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      <span>{trafficMeta.label}</span>
                    </span>
                    <span className="text-stone-700 font-medium">
                      {traffic.durationText} · {traffic.distanceText}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                    <span>
                      {poi
                        ? 'اضغط لفحص حالة المرور للعتبة'
                        : 'بانتظار تحميل الإحداثيات'}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {poi ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          onRouteFromCorridor(seed.id, poi.name, poi.location)
                        }
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-900 text-white text-xs font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>رسم المسار</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void onCheckCorridorTraffic(seed.id, poi.location)
                        }
                        disabled={isChecking}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 text-xs font-medium hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`}
                        />
                        <span>{isChecking ? 'فحص...' : 'حالة المرور'}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onLoadExtended()}
                      disabled={isLoadingExtended}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-stone-700 text-xs font-medium hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isLoadingExtended ? 'جارٍ التحميل...' : 'إظهار على الخريطة'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
