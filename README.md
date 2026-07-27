# Leaflet.TimeSeriesWMS

A Leaflet plugin that adds a time‑animation control for WMS layers (e.g., satellite imagery) that support the `TIME` parameter. It automatically fetches available timestamps from the WMS `GetCapabilities` response, combines multiple layers (intersection), and provides a slider, play/pause, and opacity control.

This plugin is based on the original [Leaflet.Rainviewer](https://github.com/mwasil/Leaflet.Rainviewer) by mwasil, adapted for time‑series WMS services.

## Features

- Supports **multiple WMS layers** simultaneously (e.g., fire temperature RGB and FRP).
- Automatically queries `GetCapabilities` to obtain the list of available timestamps.
- Computes the **intersection** of timestamps when multiple layers are used, ensuring all layers have data.
- **Limit history** interactively – choose how many days (or all) of data to display via a numeric input.
- Fallback to locally generated timestamps if the capabilities request fails (e.g., CORS).
- Interactive control with **play/pause**, **previous/next**, **timeline slider**, and **opacity slider**.
- Adjustable animation speed, history length, and fully localisable labels.
- Lightweight, works with any Leaflet map.

## Dependencies

- [Leaflet](https://leafletjs.com/) (tested with 1.9.4)

## Installation

### Direct download

Download `leaflet.timeserieswms.js` and `leaflet.timeserieswms.css` and include them in your HTML after Leaflet:

```html
<link rel="stylesheet" href="path/to/leaflet.timeserieswms.css" />
<script src="path/to/leaflet.timeserieswms.js"></script>
```

### Via CDN

Example using jsDelivr:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/PedroVenancio/Leaflet.TimeSeriesWMS/leaflet.timeserieswms.css" />
<script src="https://cdn.jsdelivr.net/gh/PedroVenancio/Leaflet.TimeSeriesWMS/leaflet.timeserieswms.js"></script>
```

## Usage

Create a Leaflet map, then add the control with your WMS configuration:

```javascript
var map = L.map('map').setView([40, -10], 5);

// Add a basemap (e.g., OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Add the time‑series WMS control
L.control.timeserieswms({
    position: 'bottomleft',
    wmsUrls: [
        'https://view.eumetsat.int/geoserver/mtg_fd/rgb_firetemperature/ows',
        'https://adaguc.lsasvcs.ipma.pt/adagucserver?dataset=MTG-FRP'
    ],
    wmsLayers: ['rgb_firetemperature','FRP'],
    wmsParams: [
        {
            version: '1.3.0',
            format: 'image/png',
            transparent: true,
            crs: L.CRS.EPSG4326
        },
        {
            version: '1.3.0',
            format: 'image/jpeg',
            transparent: true,
            crs: L.CRS.EPSG4326
        }
    ],
    maxHistoryHours: 12,          // fallback only
    limitHistoryHours: 24,        // initial limit in hours (optional)
    timeStepMinutes: 10,
    timestampStrategy: 'union',
    opacity: 0.8,
    buttonTitle: 'Show satellite time series'
}).addTo(map);
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `position` | string | `'bottomleft'` | Leaflet control position (`'topleft'`, `'topright'`, `'bottomleft'`, `'bottomright'`). |
| `nextButtonText` | string | `'>'` | Text for the "next" button. |
| `playStopButtonText` | string | `'Play/Stop'` | Text for the play/stop button. |
| `prevButtonText` | string | `'<'` | Text for the "previous" button. |
| `positionSliderLabelText` | string | `'Time (UTC):'` | Label for the timeline slider. |
| `opacitySliderLabelText` | string | `'Opacity:'` | Label for the opacity slider. |
| `limitLabelText` | string | `'Limit (days):'` | Label for the history limit input. |
| `animationInterval` | number | `500` | Time between frames in milliseconds. |
| `opacity` | number | `0.8` | Initial opacity of the layers (0-1). |
| `wmsUrls` | string[] | `[]` | Array of base WMS URLs. |
| `wmsLayers` | string[] | `[]` | Array of layer names (one per URL). |
| `wmsParams` | object[] | `[]` | Array of extra WMS parameters (version, format, crs, etc.). |
| `timeStepMinutes` | number | `10` | Time step in minutes (used only for fallback). |
| `maxHistoryHours` | number | `12` | **Fallback only**: number of hours to generate when `GetCapabilities` fails. |
| `dataDelayMinutes` | number | `60` | Delay applied when generating fallback timestamps (minutes). |
| `limitHistoryHours` | number | `undefined` | **Optional initial limit in hours**. If set to a positive number, the control will start with that limit applied. If `undefined` or `0`, no initial limit (shows all available data). |
| `timestampStrategy` | string | `'union'` | Strategy to combine timestamps from multiple WMS: `'union'` (default) includes all timestamps from all services; `'intersection'` keeps only timestamps common to all services. Use `'union'` for maximum data availability, especially when some services may have gaps. |
| `attribution` | string | `'&copy; EUMETSAT / LSASAF'` | Attribution text for the layers. |
| `buttonTitle` | string | `'Show time-series WMS'` | Tooltip for the control button. |

## Limit history (interactive)

When the WMS provides a long archive (e.g., one year of 10‑minute data), navigating all frames with the slider can be slow. The plugin includes a numeric input labelled **"Limit (days)"** (customisable via `limitLabelText`).

- Enter a number of **days** to show only the most recent frames within that period.  
- Enter `0` to display **all** available frames.  
- The limit is applied immediately and the timeline slider updates accordingly.  
- Internally, the value is converted to hours (`days × 24`), and the filtering is done on the full list of timestamps obtained from `GetCapabilities`.

If you want to start the control with a limit already applied, use the `limitHistoryHours` option (value in **hours**). If you omit it or set it to `0`, the control starts with no limit.

> **Note**: The `maxHistoryHours` option is **only used as a fallback** when the `GetCapabilities` request fails. In that case, the limit input is disabled and the plugin generates a local set of timestamps covering `maxHistoryHours`.

## How it works

1. When the button is clicked, the plugin sends a `GetCapabilities` request to each configured WMS.
2. It parses the `<Dimension name="time">` element to extract the list of available timestamps for each service.
3. It computes the **union** / **intersection** of timestamps across all layers (so that every layer has data for that time).
4. The full list of timestamps is stored.
5. The **limit** (if any) is applied: only timestamps within the last `limit` days are kept.
6. A timeline slider is created with the resulting frames.
7. For each frame, the plugin updates the `TIME` parameter of all WMS layers and redraws them.
8. The user can navigate manually, use the play button, or adjust the history limit at any time.

If the `GetCapabilities` requests fail (e.g., due to CORS or network errors), the plugin falls back to generating timestamps locally using `maxHistoryHours`, `timeStepMinutes`, and `dataDelayMinutes`. This ensures that the control remains functional even without server‑side time information.

The plugin fetches the list of available timestamps from each WMS. By default, it uses a **union** of all timestamps, so that frames are available as long as at least one service has data. For each frame, only the services that actually have data for that timestamp are updated; others retain their last valid frame. If you prefer to show only frames where **all** services have data, set `timestampStrategy: 'intersection'`.

## Customization

- **Button icon**: Replace the background image in `leaflet.timeserieswms.css` (or override it in your own CSS).
- **WMS parameters**: Pass any standard WMS parameter in the `wmsParams` array (e.g., `crs`, `styles`, `format`).
- **Labels**: All labels are customisable via the options (see table above). This allows full internationalisation.
- **Fallback behavior**: Adjust `maxHistoryHours`, `timeStepMinutes`, and `dataDelayMinutes` to match the actual data availability in case of fallback.

## Credits

- Based on the [Leaflet.Rainviewer](https://github.com/mwasil/Leaflet.Rainviewer) plugin by mwasil.
- Satellite data provided by [EUMETSAT](https://www.eumetsat.int/) and [LSASAF](https://lsa-saf.eumetsat.int/).

## License

MIT License. See [LICENSE](LICENSE) file for details.