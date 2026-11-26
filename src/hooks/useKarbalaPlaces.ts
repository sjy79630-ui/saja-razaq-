import {useCallback, useEffect, useRef, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {KARBALA_CORRIDOR_SEEDS} from '../data/karbalaCorridors';
import type {CorridorSeed, DiscoveredPoi} from '../types/karbala';
import {checkAndDispatchQuotaError} from '../utils/quotaHelper';

const KARBALA_BIAS_CENTER = {lat: 32.616, lng: 44.032};

export function useKarbalaPlaces() {
  const placesLib = useMapsLibrary('places');
  const [poisById, setPoisById] = useState<Record<string, DiscoveredPoi>>({});
  const [isLoadingCore, setIsLoadingCore] = useState(false);
  const [isLoadingExtended, setIsLoadingExtended] = useState(false);
  const [extendedLoaded, setExtendedLoaded] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const coreStartedRef = useRef(false);

  const resolveBatch = useCallback(
    async (seeds: CorridorSeed[]) => {
      if (!placesLib) return;
      const {Place} = placesLib;

      const resolvedEntries: Array<[string, DiscoveredPoi]> = [];

      // Process sequentially in small groups of 3 to stay gentle on rate limits
      for (let i = 0; i < seeds.length; i += 3) {
        const chunk = seeds.slice(i, i + 3);
        const results = await Promise.all(
          chunk.map(async (seed) => {
            try {
              const response = await Place.searchByText({
                textQuery: seed.searchQuery,
                fields: ['id', 'displayName', 'formattedAddress', 'location'],
                locationBias: {
                  center: KARBALA_BIAS_CENTER,
                  radius: 50000,
                },
                language: 'ar',
                region: 'IQ',
                maxResultCount: 1,
              });

              const place = response.places?.[0];
              if (!place || !place.location) {
                return null;
              }

              const poi: DiscoveredPoi = {
                id: seed.id,
                seed,
                placeId: place.id,
                name: place.displayName || seed.fallbackLabel,
                formattedAddress: place.formattedAddress || 'محافظة كربلاء المقدسة',
                location: {
                  lat: place.location.lat(),
                  lng: place.location.lng(),
                },
                placeInstance: place,
              };
              return [seed.id, poi] as [string, DiscoveredPoi];
            } catch (err) {
              checkAndDispatchQuotaError(err);
              return null;
            }
          })
        );

        for (const item of results) {
          if (item) {
            resolvedEntries.push(item);
          }
        }
      }

      if (resolvedEntries.length > 0) {
        setPoisById((prev) => {
          const next = {...prev};
          for (const [id, poi] of resolvedEntries) {
            next[id] = poi;
          }
          return next;
        });
      }
    },
    [placesLib]
  );

  useEffect(() => {
    if (!placesLib || coreStartedRef.current) return;
    coreStartedRef.current = true;
    setIsLoadingCore(true);
    setPlacesError(null);

    const coreSeeds = KARBALA_CORRIDOR_SEEDS.filter(
      (s) => s.priorityBatch === 'core'
    );

    resolveBatch(coreSeeds)
      .catch((err) => {
        checkAndDispatchQuotaError(err);
        setPlacesError('تعذر تحميل بعض نقاط الاهتمام من خرائط جوجل.');
      })
      .finally(() => {
        setIsLoadingCore(false);
      });
  }, [placesLib, resolveBatch]);

  const loadExtendedCorridors = useCallback(async () => {
    if (!placesLib || extendedLoaded || isLoadingExtended) return;
    setIsLoadingExtended(true);
    const extendedSeeds = KARBALA_CORRIDOR_SEEDS.filter(
      (s) => s.priorityBatch === 'extended'
    );
    try {
      await resolveBatch(extendedSeeds);
      setExtendedLoaded(true);
    } catch (err) {
      checkAndDispatchQuotaError(err);
    } finally {
      setIsLoadingExtended(false);
    }
  }, [placesLib, extendedLoaded, isLoadingExtended, resolveBatch]);

  const poisList = Object.values(poisById);

  return {
    poisById,
    poisList,
    isLoadingCore,
    isLoadingExtended,
    extendedLoaded,
    placesError,
    loadExtendedCorridors,
  };
}

export function useAutocompleteSuggestions(inputString: string) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = inputString.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const {AutocompleteSessionToken, AutocompleteSuggestion} = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = window.setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        sessionToken: sessionTokenRef.current ?? undefined,
        locationBias: {
          center: KARBALA_BIAS_CENTER,
          radius: 50000,
        },
        includedRegionCodes: ['iq'],
        language: 'ar',
      })
        .then((res) => {
          if (!cancelled) {
            setSuggestions(res.suggestions ?? []);
          }
        })
        .catch((err) => {
          checkAndDispatchQuotaError(err);
          if (!cancelled) {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, inputString]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    resetSession,
  };
}
