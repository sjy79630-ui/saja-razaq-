import {useState} from 'react';
import {Compass, MapPin, Navigation} from 'lucide-react';
import type {DiscoveredPoi, ShrineId} from '../types/karbala';

interface ShrineGuideSectionProps {
  poisById: Record<string, DiscoveredPoi>;
  onRouteToShrine: (shrineId: ShrineId) => void;
  onFocusShrineOnMap: (shrineId: ShrineId) => void;
}

function ShrineImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-full aspect-[4/3] bg-gradient-to-br from-emerald-950 via-stone-900 to-amber-950 flex flex-col items-center justify-center p-6 text-amber-100">
        <Compass className="w-8 h-8 mb-2 text-amber-300" />
        <p className="font-serif text-lg font-bold">{alt}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden bg-stone-200">
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
    </div>
  );
}

export function ShrineGuideSection({
  poisById,
  onRouteToShrine,
  onFocusShrineOnMap,
}: ShrineGuideSectionProps) {
  const imamHussainPoi = poisById['imam-hussain'];
  const alAbbasPoi = poisById['al-abbas'];

  const cards = [
    {
      id: 'imam-hussain' as ShrineId,
      title: imamHussainPoi?.name || 'العتبة الحسينية المقدسة',
      subtitle: 'المرقد الشريف للإمام الحسين بن علي (عليه السلام)',
      address:
        imamHussainPoi?.formattedAddress || 'المدينة القديمة، محافظة كربلاء المقدسة',
      image: '/src/assets/images/imam_hussain_shrine_1795718473554.jpg',
      axes: 'محاور الوصول الرئيسية: شارع القبلة جنوباً · شارع الشهداء وباب بغداد شمالاً · منطقة ما بين الحرمين شرقاً.',
    },
    {
      id: 'al-abbas' as ShrineId,
      title: alAbbasPoi?.name || 'العتبة العباسية المقدسة',
      subtitle: 'المرقد الشريف لأبي الفضل العباس (عليه السلام)',
      address:
        alAbbasPoi?.formattedAddress || 'المدينة القديمة، محافظة كربلاء المقدسة',
      image: '/src/assets/images/al_abbas_shrine_1795718475610.jpg',
      axes: 'محاور الوصول الرئيسية: شارع باب قبلة العباس جنوباً · شارع العلقمي شرقاً · شارع السدرة شمالاً · ما بين الحرمين غرباً.',
    },
  ];

  return (
    <section
      id="shrines"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-stone-200"
    >
      <div className="mb-8">
        <p className="text-xs text-stone-500 mb-1.5">
          الوجهة المباركة · قلب كربلاء المقدسة
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
          العتبتان المقدستان ومحاور الدخول المباشرة
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {cards.map((card) => (
          <article
            key={card.id}
            className="flex flex-col justify-between bg-white border border-stone-200 rounded-xl overflow-hidden"
          >
            <div>
              <ShrineImage src={card.image} alt={card.title} />
              <div className="p-6 space-y-3">
                <p className="text-xs text-stone-500">{card.subtitle}</p>
                <h3 className="font-serif text-2xl font-bold text-stone-900">
                  {card.title}
                </h3>
                <p className="text-xs text-stone-700 leading-relaxed">
                  {card.axes}
                </p>
                <p className="text-xs text-stone-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                  <span>{card.address}</span>
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onRouteToShrine(card.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-900 text-white text-xs font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>تعيين كوجهة للوصول</span>
              </button>

              <button
                type="button"
                onClick={() => onFocusShrineOnMap(card.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 text-xs font-medium hover:bg-stone-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-amber-700" />
                <span>عرض الموقع على الخريطة</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
