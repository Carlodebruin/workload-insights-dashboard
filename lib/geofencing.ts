
import { Geofence } from '../types';

type Point = { lat: number; lng: number };

/**
 * Calculates the distance between two points using the haversine formula
 * @param point1 First point {lat, lng}
 * @param point2 Second point {lat, lng}
 * @returns Distance in meters
 */
const calculateDistance = (point1: Point, point2: Point): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.lat * Math.PI/180;
    const φ2 = point2.lat * Math.PI/180;
    const Δφ = (point2.lat - point1.lat) * Math.PI/180;
    const Δλ = (point2.lng - point1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
};

/**
 * Checks if a point is inside a polygon using the ray-casting algorithm.
 * @param point The point to check {lat, lng}.
 * @param polygonVertices An array of vertices for the polygon.
 * @returns True if the point is inside the polygon, false otherwise.
 */
const isPointInPolygon = (point: Point, polygonVertices: Point[]): boolean => {
    const x = point.lng;
    const y = point.lat;
    let inside = false;

    for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
        const xi = polygonVertices[i].lng;
        const yi = polygonVertices[i].lat;
        const xj = polygonVertices[j].lng;
        const yj = polygonVertices[j].lat;

        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
};

/**
 * Determines if a given point is inside a geofence (circle or polygon).
 * @param point The user's location as {lat, lng}.
 * @param geofence The geofence object to check against.
 * @returns True if the point is inside the geofence, otherwise false.
 */
export const isPointInGeofence = (point: Point, geofence: Geofence): boolean => {
    if (geofence.shape === 'circle') {
        if (geofence.latitude === undefined || geofence.longitude === undefined || geofence.radius === undefined) {
            return false;
        }
        const center = { lat: geofence.latitude, lng: geofence.longitude };
        const distance = calculateDistance(point, center);
        return distance <= geofence.radius;
    }

    if (geofence.shape === 'polygon') {
        if (!geofence.latlngs || geofence.latlngs.length === 0 || geofence.latlngs[0].length < 3) {
            return false;
        }
        // Leaflet-draw stores polygon latlngs in a nested array. We use the first one.
        const polygonVertices = geofence.latlngs[0];
        return isPointInPolygon(point, polygonVertices);
    }

    return false;
};
