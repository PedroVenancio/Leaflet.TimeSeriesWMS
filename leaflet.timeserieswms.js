/**
 * Leaflet.TimeSeriesWMS
 * A Leaflet control to animate time-series WMS layers (e.g., satellite imagery)
 * by querying GetCapabilities to obtain available timestamps.
 * Based on Leaflet.Rainviewer by mwasil.
 *
 * @author Pedro Venâncio
 * @license MIT
 */

L.Control.TimeSeriesWMS = L.Control.extend({
    options: {
        position: 'bottomleft',
        nextButtonText: '>',
        playStopButtonText: 'Play/Stop',
        prevButtonText: '<',
        positionSliderLabelText: "Time (UTC):",
        opacitySliderLabelText: "Opacity:",
        limitLabelText: "Limit (days):",            // NEW: label for the limit input
        animationInterval: 500,
        opacity: 0.8,
        // WMS configuration (multiple layers supported)
        wmsUrls: [],          // Array of base WMS URLs
        wmsLayers: [],        // Array of layer names
        wmsParams: [],        // Array of extra WMS parameters (version, format, crs, etc.)
        // Temporal configuration
        timeStepMinutes: 10,
        maxHistoryHours: 12,       // USED ONLY AS FALLBACK (when GetCapabilities fails)
        dataDelayMinutes: 60,
        limitHistoryHours: undefined, // If defined (e.g., 24), use as initial limit (in HOURS); if undefined, start with 0 (no limit)
        attribution: '&copy; <a href="https://eumetsat.int" target="_blank">EUMETSAT</a> / <a href="https://lsa-saf.eumetsat.int" target="_blank">LSASAF</a>',
        buttonTitle: 'Show time-series WMS'
    },

    onAdd: function (map) {
        this.timestamps = [];
        this.fullTimestamps = null;   // store unfiltered list from GetCapabilities
        // If limitHistoryHours is explicitly defined (even 0), use it; otherwise default to 0 (no limit)
        // Internally we keep hours, but the UI displays days
        this.limitHours = (this.options.limitHistoryHours !== undefined) ? this.options.limitHistoryHours : 0;
        this.layers = [];
        this.currentIndex = 0;
        this.animationTimer = false;
        this.active = false;
        this._map = map;

        this.container = L.DomUtil.create('div', 'leaflet-control-timeserieswms leaflet-bar leaflet-control');
        this.link = L.DomUtil.create('a', 'leaflet-control-timeserieswms-button leaflet-bar-part', this.container);
        this.link.href = '#';
        this.link.title = this.options.buttonTitle;
        L.DomEvent.on(this.link, 'click', this.load, this);
        return this.container;
    },

    load: function (e) {
        L.DomEvent.preventDefault(e);
        if (this.active) return;

        L.DomUtil.addClass(this.container, 'leaflet-control-timeserieswms-active');
        this.active = true;

        // Add attribution to map
        this._map.attributionControl.addAttribution(this.options.attribution);

        this._buildUI();
        this._initLayers();

        // Try to fetch real timestamps from GetCapabilities
        this._fetchTimestampsFromCapabilities()
            .then(commonTimestamps => {
                if (commonTimestamps.length > 0) {
                    this.fullTimestamps = commonTimestamps.slice(); // keep a copy
                    this.timestamps = commonTimestamps;
                } else {
                    console.warn('No common timestamps found. Using fallback.');
                    this._generateFallbackTimestamps();
                }
                this._finalizeLoad();
            })
            .catch(error => {
                console.error('Error fetching timestamps from capabilities:', error);
                console.warn('Using fallback local timestamps (fixed delay).');
                this._generateFallbackTimestamps();
                this._finalizeLoad();
            });
    },

    _buildUI: function () {
        this.controlContainer = L.DomUtil.create('div', 'leaflet-control-timeserieswms-container', this.container);

        this.prevButton = L.DomUtil.create('input', 'leaflet-control-timeserieswms-prev leaflet-bar-part btn', this.controlContainer);
        this.prevButton.type = "button";
        this.prevButton.value = this.options.prevButtonText;
        L.DomEvent.on(this.prevButton, 'click', this._prev, this);
        L.DomEvent.disableClickPropagation(this.prevButton);

        this.startstopButton = L.DomUtil.create('input', 'leaflet-control-timeserieswms-startstop leaflet-bar-part btn', this.controlContainer);
        this.startstopButton.type = "button";
        this.startstopButton.value = this.options.playStopButtonText;
        L.DomEvent.on(this.startstopButton, 'click', this._playStop, this);
        L.DomEvent.disableClickPropagation(this.startstopButton);

        this.nextButton = L.DomUtil.create('input', 'leaflet-control-timeserieswms-next leaflet-bar-part btn', this.controlContainer);
        this.nextButton.type = "button";
        this.nextButton.value = this.options.nextButtonText;
        L.DomEvent.on(this.nextButton, 'click', this._next, this);
        L.DomEvent.disableClickPropagation(this.nextButton);

        this.positionSliderLabel = L.DomUtil.create('label', 'leaflet-control-timeserieswms-label leaflet-bar-part', this.controlContainer);
        this.positionSliderLabel.htmlFor = "timeserieswms-positionslider";
        this.positionSliderLabel.textContent = this.options.positionSliderLabelText;

        this.positionSlider = L.DomUtil.create('input', 'leaflet-control-timeserieswms-positionslider leaflet-bar-part', this.controlContainer);
        this.positionSlider.type = "range";
        this.positionSlider.id = "timeserieswms-positionslider";
        this.positionSlider.min = 0;
        this.positionSlider.max = 0;
        this.positionSlider.value = 0;
        L.DomEvent.on(this.positionSlider, 'input', this._setPosition, this);
        L.DomEvent.disableClickPropagation(this.positionSlider);

        this.opacitySliderLabel = L.DomUtil.create('label', 'leaflet-control-timeserieswms-label leaflet-bar-part', this.controlContainer);
        this.opacitySliderLabel.htmlFor = "timeserieswms-opacityslider";
        this.opacitySliderLabel.textContent = this.options.opacitySliderLabelText;

        this.opacitySlider = L.DomUtil.create('input', 'leaflet-control-timeserieswms-opacityslider leaflet-bar-part', this.controlContainer);
        this.opacitySlider.type = "range";
        this.opacitySlider.id = "timeserieswms-opacityslider";
        this.opacitySlider.min = 0;
        this.opacitySlider.max = 100;
        this.opacitySlider.value = this.options.opacity * 100;
        L.DomEvent.on(this.opacitySlider, 'input', this._setOpacity, this);
        L.DomEvent.disableClickPropagation(this.opacitySlider);

        // ----- Limit control (in days, converted to hours internally) -----
        this.limitSliderLabel = L.DomUtil.create('label', 'leaflet-control-timeserieswms-label leaflet-bar-part', this.controlContainer);
        this.limitSliderLabel.htmlFor = "timeserieswms-limitslider";
        this.limitSliderLabel.textContent = this.options.limitLabelText;   // customisable label

        this.limitInput = L.DomUtil.create('input', 'leaflet-control-timeserieswms-limit leaflet-bar-part', this.controlContainer);
        this.limitInput.type = "number";
        this.limitInput.id = "timeserieswms-limitslider";
        this.limitInput.min = 0;
        this.limitInput.step = 1;
        // Display initial value in days (divide hours by 24)
        this.limitInput.value = (this.limitHours / 24) || 0;
        this.limitInput.title = "0 = no limit (show all available frames)";
        L.DomEvent.on(this.limitInput, 'change', this._onLimitChange, this);
        L.DomEvent.disableClickPropagation(this.limitInput);
        // ----- end limit -----

        this.closeButton = L.DomUtil.create('div', 'leaflet-control-timeserieswms-close', this.container);
        L.DomEvent.on(this.closeButton, 'click', this.unload, this);

        var html = '<div id="timeserieswms-timestamp" class="leaflet-control-timeserieswms-timestamp"></div>';
        this.controlContainer.insertAdjacentHTML('beforeend', html);
    },

    _initLayers: function () {
        const urls = this.options.wmsUrls;
        const layerNames = this.options.wmsLayers;
        const paramsList = this.options.wmsParams;

        for (let i = 0; i < urls.length; i++) {
            const baseParams = {
                layers: layerNames[i],
                opacity: this.options.opacity,
                zIndex: 1000,
                ...paramsList[i]
            };
            const layer = L.tileLayer.wms(urls[i], baseParams);
            this.layers.push(layer);
        }
    },

    /**
     * Fetch time dimension from a single WMS GetCapabilities response.
     * @param {string} baseUrl - WMS base URL
     * @returns {Promise<Date[]>} array of timestamps
     */
    _fetchTimeDimensionFromWMS: function (baseUrl) {
        const url = baseUrl.includes('?')
            ? baseUrl + '&SERVICE=WMS&REQUEST=GetCapabilities'
            : baseUrl + '?SERVICE=WMS&REQUEST=GetCapabilities';

        return fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(xmlText => {
                const parser = new DOMParser();
                const xml = parser.parseFromString(xmlText, 'application/xml');

                const dimension = xml.querySelector('Dimension[name="time"]');
                if (!dimension) throw new Error('Dimension time element not found');

                const timeText = dimension.textContent.trim();
                // Expected format: "2025-08-05T00:00:00.000Z/2026-03-19T10:10:00.000Z/PT10M"
                const parts = timeText.split('/');
                if (parts.length !== 3) throw new Error('Unexpected time format');

                const start = new Date(parts[0]);
                const end = new Date(parts[1]);
                const interval = parts[2];

                const intervalMatch = interval.match(/PT(\d+)M/);
                if (!intervalMatch) throw new Error('Interval format not recognized');
                const stepMinutes = parseInt(intervalMatch[1], 10);

                const timestamps = [];
                let current = new Date(start);
                while (current <= end) {
                    timestamps.push(new Date(current));
                    current.setUTCMinutes(current.getUTCMinutes() + stepMinutes);
                }
                return timestamps;
            });
    },

    /**
     * Fetch time dimensions from all configured WMS and return the intersection.
     * @returns {Promise<Date[]>} common timestamps
     */
    _fetchTimestampsFromCapabilities: function () {
        const urls = this.options.wmsUrls;
        if (!urls || urls.length === 0) {
            return Promise.reject('No WMS URLs configured');
        }

        const promises = urls.map(url => this._fetchTimeDimensionFromWMS(url));

        return Promise.all(promises)
            .then(results => {
                if (results.length === 0) return [];
                const sets = results.map(list => new Set(list.map(d => d.getTime())));
                const firstSet = sets[0];
                const common = [];
                for (let timeMs of firstSet) {
                    if (sets.every(set => set.has(timeMs))) {
                        common.push(new Date(timeMs));
                    }
                }
                common.sort((a, b) => a - b);
                return common;
            });
    },

    /**
     * Fallback: generate timestamps locally using delay and step.
     */
    _generateFallbackTimestamps: function () {
        const now = new Date();
        const delay = this.options.dataDelayMinutes || 0;
        const ref = new Date(now.getTime() - delay * 60000);

        const step = this.options.timeStepMinutes;
        const minutes = ref.getUTCMinutes();
        const remainder = minutes % step;
        ref.setUTCMinutes(minutes - remainder);
        ref.setUTCSeconds(0);
        ref.setUTCMilliseconds(0);

        // Use maxHistoryHours for the fallback period
        const numFrames = Math.ceil((this.options.maxHistoryHours * 60) / step);
        const timestamps = [];
        for (let i = numFrames - 1; i >= 0; i--) {
            timestamps.push(new Date(ref.getTime() - i * step * 60000));
        }
        this.timestamps = timestamps;
        // fallback: no fullTimestamps, mark as null
        this.fullTimestamps = null;
    },

    _finalizeLoad: function () {
        if (this.fullTimestamps && this.fullTimestamps.length > 0) {
            // Apply the initial limit (this.limitHours is in hours)
            this._applyTimeLimit(this.limitHours);
            // Update input display (in days)
            this.limitInput.value = (this.limitHours / 24) || 0;
        } else {
            // Fallback: already have timestamps generated locally (respecting maxHistoryHours)
            this.positionSlider.max = this.timestamps.length - 1;
            this.positionSlider.value = this.timestamps.length - 1;
            this._showFrame(this.timestamps.length - 1);
            // Disable limit input because we don't have full data
            if (this.limitInput) {
                this.limitInput.disabled = true;
                this.limitInput.style.opacity = 0.5;
                this.limitInput.title = "Disabled because using fallback timestamps";
            }
        }
    },

    /**
     * Apply a time limit to the full timestamps list.
     * @param {number} limitHours - max hours to keep (0 = no limit)
     */
    _applyTimeLimit: function (limitHours) {
        if (!this.fullTimestamps || this.fullTimestamps.length === 0) {
            return;
        }
        limitHours = parseFloat(limitHours) || 0;
        this.limitHours = limitHours;

        // Update the input field to show the value in days
        this.limitInput.value = (this.limitHours / 24) || 0;

        if (limitHours > 0) {
            const now = this.fullTimestamps[this.fullTimestamps.length - 1];
            const cutoff = new Date(now.getTime() - limitHours * 3600000);
            this.timestamps = this.fullTimestamps.filter(d => d >= cutoff);
        } else {
            this.timestamps = this.fullTimestamps.slice();
        }

        // Update slider and show last frame
        if (this.timestamps.length > 0) {
            this.positionSlider.max = this.timestamps.length - 1;
            this.positionSlider.value = this.timestamps.length - 1;
            this._showFrame(this.timestamps.length - 1);
        } else {
            // If filtering removed everything, revert to full list
            console.warn('Limit removed all timestamps; reverting to full list.');
            this.timestamps = this.fullTimestamps.slice();
            this.positionSlider.max = this.timestamps.length - 1;
            this.positionSlider.value = this.timestamps.length - 1;
            this._showFrame(this.timestamps.length - 1);
            // also reset input to 0 (no limit)
            this.limitInput.value = 0;
            this.limitHours = 0;
        }
    },

    _onLimitChange: function (e) {
        var val = parseFloat(this.limitInput.value) || 0;
        // Convert days to hours
        var limitHours = val * 24;
        this._stop(); // stop animation
        this._applyTimeLimit(limitHours);
    },

    _showFrame: function (index) {
        index = Math.max(0, Math.min(index, this.timestamps.length - 1));
        const time = this.timestamps[index];
        const timeStr = time.toISOString();

        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (layer) {
                layer.setParams({ time: timeStr });
                layer.setOpacity(this.options.opacity);
                if (!this._map.hasLayer(layer)) {
                    this._map.addLayer(layer);
                }
                layer.bringToFront();
            }
        }

        this.currentIndex = index;
        this.positionSlider.value = index;

        const year = time.getUTCFullYear();
        const month = (time.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = time.getUTCDate().toString().padStart(2, '0');
        const hours = time.getUTCHours().toString().padStart(2, '0');
        const minutes = time.getUTCMinutes().toString().padStart(2, '0');
        document.getElementById('timeserieswms-timestamp').innerHTML = `${year}-${month}-${day} ${hours}:${minutes} UTC`;
    },

    _setOpacity: function (e) {
        const opacity = e.target.value / 100;
        this.options.opacity = opacity;
        this.layers.forEach(layer => layer.setOpacity(opacity));
    },

    _setPosition: function (e) {
        this._stop();
        this._showFrame(parseInt(e.target.value));
    },

    _stop: function () {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = false;
            return true;
        }
        return false;
    },

    _play: function () {
        let nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.timestamps.length) {
            nextIndex = 0;
        }
        this._showFrame(nextIndex);
        this.animationTimer = setTimeout(() => this._play(), this.options.animationInterval);
    },

    _playStop: function () {
        if (!this._stop()) {
            this._play();
        }
    },

    _prev: function (e) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        this._stop();
        let prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) prevIndex = this.timestamps.length - 1;
        this._showFrame(prevIndex);
    },

    _next: function (e) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        this._stop();
        let nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.timestamps.length) nextIndex = 0;
        this._showFrame(nextIndex);
    },

    unload: function () {
        this._stop();
        // Remove attribution from map
        this._map.attributionControl.removeAttribution(this.options.attribution);
        L.DomUtil.remove(this.controlContainer);
        L.DomUtil.remove(this.closeButton);
        L.DomUtil.removeClass(this.container, 'leaflet-control-timeserieswms-active');
        this.active = false;

        this.layers.forEach(layer => {
            if (this._map.hasLayer(layer)) {
                this._map.removeLayer(layer);
            }
        });
        this.layers = [];
    }
});

L.control.timeserieswms = function (opts) {
    return new L.Control.TimeSeriesWMS(opts);
};