# Leaflet.TimeSeriesWMS

A Leaflet plugin that adds a time‑animation control for WMS layers (e.g., satellite imagery) that support the `TIME` parameter. It automatically fetches available timestamps from the WMS `GetCapabilities` response, combines multiple layers (intersection), and provides a slider, play/pause, and opacity control.

This plugin is based on the original [Leaflet.Rainviewer](https://github.com/mwasil/Leaflet.Rainviewer) by mwasil, adapted for time‑series WMS services.

## Features

- Supports **multiple WMS layers** simultaneously (e.g., fire temperature RGB and FRP).
- Automatically queries `GetCapabilities` to obtain the list of available timestamps.
- Computes the **intersection** of timestamps when multiple layers are used, ensuring all layers have data.
- Fallback to locally generated timestamps if the capabilities request fails (e.g., CORS).
- Interactive control with **play/pause**, **previous/next**, **timeline slider**, and **opacity slider**.
- Adjustable animation speed and history length.
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
    maxHistoryHours: 12,
    timeStepMinutes: 10,
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
| `animationInterval` | number | `500` | Time between frames in milliseconds. |
| `opacity` | number | `0.8` | Initial opacity of the layers (0-1). |
| `wmsUrls` | string[] | `[]` | Array of base WMS URLs. |
| `wmsLayers` | string[] | `[]` | Array of layer names (one per URL). |
| `wmsParams` | object[] | `[]` | Array of extra WMS parameters (version, format, crs, etc.). |
| `timeStepMinutes` | number | `10` | Time step in minutes (used only for fallback). |
| `maxHistoryHours` | number | `12` | Number of hours to go back (used only for fallback). |
| `dataDelayMinutes` | number | `60` | Delay applied when generating fallback timestamps (minutes). |
| `attribution` | string | `'&copy; EUMETSAT / LSASAF'` | Attribution text for the layers. |
| `buttonTitle` | string | `'Show time-series WMS'` | Tooltip for the control button. |

## How it works

1. When the button is clicked, the plugin sends a `GetCapabilities` request to each configured WMS.
2. It parses the `<Dimension name="time">` element to extract the list of available timestamps for each service.
3. It computes the **intersection** of timestamps across all layers (so that every layer has data for that time).
4. A timeline slider is created with the available frames.
5. For each frame, the plugin updates the `TIME` parameter of all WMS layers and redraws them.
6. The user can navigate manually or use the play button to animate through the frames.

If the `GetCapabilities` requests fail (e.g., due to CORS or network errors), the plugin falls back to generating timestamps locally using `maxHistoryHours`, `timeStepMinutes`, and `dataDelayMinutes`. This ensures that the control remains functional.

## Customization

- **Button icon**: Replace the background image in `leaflet.timeserieswms.css` (or override it in your own CSS).
- **WMS parameters**: Pass any standard WMS parameter in the `wmsParams` array (e.g., `crs`, `styles`, `format`).
- **Fallback behavior**: Adjust `maxHistoryHours`, `timeStepMinutes`, and `dataDelayMinutes` to match the actual data availability.

## Credits

- Based on the [Leaflet.Rainviewer](https://github.com/mwasil/Leaflet.Rainviewer) plugin by mwasil.
- Satellite data provided by [EUMETSAT](https://www.eumetsat.int/) and [LSASAF](https://lsa-saf.eumetsat.int/).

## License

MIT License. See [LICENSE](LICENSE) file for details.
