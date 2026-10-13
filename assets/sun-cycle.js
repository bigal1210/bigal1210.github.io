// NOAA approximate solar-position equations, evaluated from an absolute UTC time.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
export const SAN_FRANCISCO = { latitude: 37.7749, longitude: -122.4194 };
export function solarPosition(date, latitude, longitude) {
    const year = date.getUTCFullYear();
    const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    const day = Math.floor((date - Date.UTC(year, 0, 1)) / 86400000) + 1;
    const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const gamma = 2 * Math.PI / daysInYear * (day - 1 + (hour - 12) / 24);
    const equation = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
    const dec = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
    const ha = ((hour * 60 + equation + 4 * longitude) / 4 - 180) * Math.PI / 180;
    const lat = latitude * Math.PI / 180;
    const east = -Math.cos(dec) * Math.sin(ha);
    const north = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(ha);
    const up = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
    return { x: east, y: up, z: -north, altitude: Math.asin(Math.max(-1, Math.min(1, up))) };
}
// Never calls geolocation unless this origin's permission is already granted.
// Safari versions without Permissions API support safely use San Francisco.
export async function permittedLocation(browser = navigator) {
    try {
        if (!browser.permissions?.query || !browser.geolocation) return null;
        const permission = await browser.permissions.query({ name: 'geolocation' });
        if (permission.state !== 'granted') return null;
        return await new Promise(resolve => browser.geolocation.getCurrentPosition(
            ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
            () => resolve(null), { enableHighAccuracy: false, maximumAge: 3600000, timeout: 4000 }));
    } catch { return null; }
}
