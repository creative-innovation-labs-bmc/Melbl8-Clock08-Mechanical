'use strict';

/*
  Live Docklands weather for the production V8 clock.

  Primary source: Bureau of Meteorology public Melbourne (Olympic Park)
  observation JSON, refreshed every five minutes. Olympic Park is the nearest
  central Melbourne BOM observation used here for Docklands conditions.

  If a browser/player blocks the BOM cross-origin request, fall back to
  Open-Meteo at Docklands coordinates so Enplug still receives live weather.

  Optional query-string overrides remain available for testing:
    ?temp=18.2°&weather=Cloudy
*/
(() => {
  const BOM_URL = 'https://www.bom.gov.au/fwo/IDV60801/IDV60801.95936.json';
  const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast?latitude=-37.814&longitude=144.945&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&timezone=Australia%2FMelbourne';
  const REFRESH_MS = 5 * 60 * 1000;
  const RETRY_MS = 60 * 1000;
  const REQUEST_TIMEOUT_MS = 8000;

  const localParams = new URLSearchParams(location.search);
  const manualTemp = localParams.get('temp');
  const manualWeather = localParams.get('weather');

  let liveTemp = manualTemp || '--°';
  let liveWeather = manualWeather || 'Live weather loading';
  let weatherTimer = 0;

  const originalUpdateEdgeText = updateEdgeText;

  updateEdgeText = function updateEdgeTextWithLiveWeather(now) {
    originalUpdateEdgeText(now);
    edgeRight.textContent = `${WEATHER_LOCATION} · ${liveTemp} · ${liveWeather}`;
  };

  function withTimeout(url) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = window.setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);
    return fetch(url, {
      cache: 'no-store',
      signal: controller?.signal
    }).finally(() => window.clearTimeout(timer));
  }

  function cleanText(value) {
    const text = String(value ?? '').trim();
    return text && text !== '-' ? text : '';
  }

  function compassDirection(degrees) {
    if (!Number.isFinite(degrees)) return '';
    const points = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return points[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
  }

  function weatherCodeLabel(code) {
    const labels = {
      0: 'Clear',
      1: 'Mostly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Fog',
      51: 'Light drizzle',
      53: 'Drizzle',
      55: 'Heavy drizzle',
      56: 'Freezing drizzle',
      57: 'Freezing drizzle',
      61: 'Light rain',
      63: 'Rain',
      65: 'Heavy rain',
      66: 'Freezing rain',
      67: 'Freezing rain',
      71: 'Light snow',
      73: 'Snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Light showers',
      81: 'Showers',
      82: 'Heavy showers',
      85: 'Snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm',
      99: 'Thunderstorm'
    };
    return labels[code] || 'Live weather';
  }

  function setWeather(temp, text) {
    liveTemp = temp;
    liveWeather = text;
    updateEdgeText(getTimeParts());
  }

  async function fetchBomWeather() {
    const response = await withTimeout(`${BOM_URL}?t=${Date.now()}`);
    if (!response.ok) throw new Error(`BOM HTTP ${response.status}`);
    const json = await response.json();
    const obs = json?.observations?.data?.[0];
    if (!obs || !Number.isFinite(Number(obs.air_temp))) throw new Error('BOM observation unavailable');

    const temp = `${Number(obs.air_temp).toFixed(1)}°`;
    const details = [];
    const weather = cleanText(obs.weather);
    const cloud = cleanText(obs.cloud);
    const windDir = cleanText(obs.wind_dir);
    const windSpeed = Number(obs.wind_spd_kmh);
    const apparent = Number(obs.apparent_t);

    if (weather) details.push(weather);
    else if (cloud) details.push(cloud);

    if (Number.isFinite(apparent)) details.push(`Feels ${apparent.toFixed(1)}°`);
    if (windDir && Number.isFinite(windSpeed)) details.push(`${windDir} ${Math.round(windSpeed)} km/h`);
    else if (Number.isFinite(windSpeed)) details.push(`${Math.round(windSpeed)} km/h wind`);

    return {
      temp,
      text: details.slice(0, 2).join(' · ') || 'BOM live'
    };
  }

  async function fetchFallbackWeather() {
    const response = await withTimeout(`${OPEN_METEO_URL}&t=${Date.now()}`);
    if (!response.ok) throw new Error(`weather fallback HTTP ${response.status}`);
    const json = await response.json();
    const current = json?.current;
    if (!current || !Number.isFinite(Number(current.temperature_2m))) throw new Error('weather fallback unavailable');

    const temp = `${Number(current.temperature_2m).toFixed(1)}°`;
    const details = [weatherCodeLabel(Number(current.weather_code))];
    const apparent = Number(current.apparent_temperature);
    const wind = Number(current.wind_speed_10m);
    const direction = compassDirection(Number(current.wind_direction_10m));

    if (Number.isFinite(apparent)) details.push(`Feels ${apparent.toFixed(1)}°`);
    else if (Number.isFinite(wind)) details.push(`${direction ? `${direction} ` : ''}${Math.round(wind)} km/h`);

    return { temp, text: details.slice(0, 2).join(' · ') };
  }

  async function refreshWeather() {
    window.clearTimeout(weatherTimer);

    if (manualTemp || manualWeather) {
      setWeather(manualTemp || liveTemp, manualWeather || liveWeather);
      return;
    }

    try {
      const bom = await fetchBomWeather();
      setWeather(bom.temp, bom.text);
      weatherTimer = window.setTimeout(refreshWeather, REFRESH_MS);
      return;
    } catch (bomError) {
      if (debugMode) console.warn('BOM weather fetch failed, using fallback.', bomError);
    }

    try {
      const fallback = await fetchFallbackWeather();
      setWeather(fallback.temp, fallback.text);
      weatherTimer = window.setTimeout(refreshWeather, REFRESH_MS);
    } catch (fallbackError) {
      if (debugMode) console.warn('Live weather fetch failed.', fallbackError);
      if (liveTemp === '--°') setWeather('--°', 'Weather unavailable');
      weatherTimer = window.setTimeout(refreshWeather, RETRY_MS);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !(manualTemp || manualWeather)) refreshWeather();
  });

  updateEdgeText(getTimeParts());
  refreshWeather();
})();
