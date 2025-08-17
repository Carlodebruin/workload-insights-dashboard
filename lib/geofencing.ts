
import L from 'leaflet';
import { Geofence } from '../types';

type Point = { lat: number; lng: number };

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
        const center = L.latLng(geofence.latitude, geofence.longitude);
        const userLocation = L.latLng(point.lat, point.lng);
        const distance = userLocation.distanceTo(center);
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
