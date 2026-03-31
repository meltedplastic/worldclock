// cities.js — City search/lookup module

let citiesData = null;

export async function loadCities() {
  if (citiesData) return citiesData;
  const res = await fetch('./cities.json');
  citiesData = await res.json();
  return citiesData;
}

export function searchCities(query, cities) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  return cities
    .filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
    .slice(0, 12);
}

export function getCityByTz(tz, cities) {
  return cities.find(c => c.tz === tz) || null;
}
