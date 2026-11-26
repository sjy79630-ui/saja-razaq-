export type ShrineId = 'imam-hussain' | 'al-abbas' | 'bayn-al-haramayn';

export type CorridorCategory = 'all' | 'shrine' | 'highway' | 'internal' | 'hub';

export type TravelModeOption = 'DRIVING' | 'WALKING';

export type TrafficLevel = 'normal' | 'slow' | 'jam' | 'unknown';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface CorridorSeed {
  id: string;
  searchQuery: string;
  fallbackLabel: string;
  category: Exclude<CorridorCategory, 'all'>;
  directionLabel: string;
  approachRole: string;
  shrineId?: ShrineId;
  priorityBatch: 'core' | 'extended';
}

export interface DiscoveredPoi {
  id: string;
  seed: CorridorSeed;
  placeId: string;
  name: string;
  formattedAddress: string;
  location: LatLngPoint;
  placeInstance: google.maps.places.Place;
}

export interface RouteStepSummary {
  instructions: string;
  distanceMeters: number;
  distanceText: string;
  maneuver: string;
}

export interface ComputedRouteSummary {
  routeIndex: number;
  description: string;
  distanceMeters: number;
  distanceText: string;
  durationMillis: number;
  durationText: string;
  staticDurationMillis: number;
  staticDurationText: string;
  delayMinutes: number;
  trafficLevel: TrafficLevel;
  steps: RouteStepSummary[];
  routeLabels: string[];
  rawRoute: google.maps.routes.Route;
}

export interface CorridorTrafficStatus {
  corridorId: string;
  distanceMeters: number;
  distanceText: string;
  durationMillis: number;
  durationText: string;
  staticDurationMillis: number;
  delayMinutes: number;
  trafficLevel: TrafficLevel;
  updatedAt: number;
}

export interface UserGeoState {
  location: LatLngPoint;
  accuracyMeters: number;
  isInsideKarbala: boolean;
  updatedAt: number;
}

export interface SmartNavOption {
  shrineId: 'imam-hussain' | 'al-abbas';
  shrineName: string;
  bestRoute: ComputedRouteSummary;
  alternatives: ComputedRouteSummary[];
  estimatedArrivalTimeText: string;
}

