const LAYER_CONFIG = {
    buffers: {
        defaultOn: false,
        label: 'All Buffers',
        color: '#332288',
        background: '#33228830',
        weight: 2,
        fillOpacity: 0.15
    },
    spaces: {
        defaultOn: false,
        label: 'All Green Spaces',
        color: '#117733',
        background: '#11773330',
        weight: 2,
        fillOpacity: 0.15
    },
    sites: {
        defaultOn: true,
        label: 'Sites',
        color: '#882255',
        background: '#88225530',
        radius: 7,
        bigradius: 10,
        fillOpacity: 0.5
    },
    ccs: {
        defaultOn: false,
        label: 'All Community Centres',
        color: '#999933',
        background: '#99993330',
        radius: 7,
        bigradius: 10,
        fillOpacity: 0.5
    }
};

const MAP_CONFIG = {
    center: [55.94, -3.24],
    zoom: 12,
    tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy OpenStreetMap contributors'
};

// Global state
const state = {
    activeLayers: {},
    layersData: {},
    activeSpaceTypes: new Set(),
    selectedSite: null,
    selectedSiteLayer: null,
    highlightedLayers: {},
    sitesFilter: '',
    scoreMin: 0,
    scoreMax: 1,
    populationMin: 0,
    populationMax: 30000,
    rankColoringEnabled: false,
    plasmaData: null,
    siteBufferPopulation: {},
    useSpaceTypeFilter: false
};

let map;

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadPlasmaColormap();
    loadInitialData();
    setupEventListeners();
});

function initMap() {
    map = L.map('map').setView(MAP_CONFIG.center, MAP_CONFIG.zoom);
    map.zoomControl.setPosition('topright');
    
    L.tileLayer(MAP_CONFIG.tileLayer, {
        attribution: MAP_CONFIG.attribution
    }).addTo(map);
    
    map.createPane('sitesPane');
    map.getPane('sitesPane').style.zIndex = 650;
}

function loadPlasmaColormap() {
    fetch('/plasma')
        .then(r => r.json())
        .then(data => {
            state.plasmaData = data;
            generateRankColorbar();
        });
}

function loadInitialData() {
    fetch('/layer/buffers')
        .then(r => r.json())
        .then(data => {
            state.layersData.buffers = data;
            buildBufferPopulationMap();
        });
}

function setupEventListeners() {
    // Initialize layer labels with config
    document.querySelectorAll('.layer-label').forEach(label => {
        const layerName = label.dataset.layer;
        const config = LAYER_CONFIG[layerName];
        if (config) {
            label.textContent = config.label;
            label.style.color = config.color;
            label.style.fontWeight = 'bold';
        }
    });
    
    // Initialize layers based on defaultOn config
    Object.keys(LAYER_CONFIG).forEach(layerName => {
        const config = LAYER_CONFIG[layerName];
        const checkbox = document.querySelector(`input[data-layer="${layerName}"]`);
        
        if (!checkbox) return;
        
        // Set checkbox to match config, not HTML attribute
        checkbox.checked = config.defaultOn;
        
        // Load and create layer if it should be on
        if (config.defaultOn) {
            if (layerName === 'spaces') {
                toggleSpaces();
            } else if (layerName === 'sites') {
                toggle('sites');
            } else {
                toggle(layerName);
            }
        }
    });
    
    // Handle sites layer special UI
    if (LAYER_CONFIG.sites?.defaultOn) {
        document.getElementById('buffers-toggle').classList.add('visible');
        document.getElementById('rank-coloring-toggle').style.display = 'block';
    }
}

function toggle(name) {
    if (state.activeLayers[name]) {
        map.removeLayer(state.activeLayers[name]);
        delete state.activeLayers[name];
    } else {
        if (!state.layersData[name]) {
            fetch(`/layer/${name}`)
                .then(r => r.json())
                .then(data => {
                    state.layersData[name] = data;
                    if (name === 'buffers') {
                        buildBufferPopulationMap();
                    }
                    createLayer(name);
                });
        } else {
            createLayer(name);
        }
    }
    
    if (name === 'sites') {
        handleSitesToggle();
    }
}

function handleSitesToggle() {
    const buffersToggle = document.getElementById('buffers-toggle');
    const rankToggle = document.getElementById('rank-coloring-toggle');
    const rankColorbar = document.getElementById('rank-colorbar-container');
    
    if (state.activeLayers['sites']) {
        buffersToggle.classList.add('visible');
        rankToggle.style.display = 'block';
        rankColorbar.style.display = state.rankColoringEnabled ? 'block' : 'none';
    } else {
        buffersToggle.classList.remove('visible');
        rankToggle.style.display = 'none';
        rankColorbar.style.display = 'none';
        state.rankColoringEnabled = false;
        document.getElementById('rank-coloring-checkbox').checked = false;
        
        if (state.activeLayers['buffers']) {
            document.querySelector('input[data-layer = "buffers"]').checked = false;
            map.removeLayer(state.activeLayers['buffers']);
            delete state.activeLayers['buffers'];
        }
    }
}

function createLayer(name) {
    let data = state.layersData[name];
    
    if (name === 'sites') {
        data = filterSitesData(data);
    }
    
    if (name === 'spaces' && state.activeSpaceTypes.size > 0) {
        data = {
            type: 'FeatureCollection',
            features: data.features.filter(f => state.activeSpaceTypes.has(f.properties.PAN65))
        };
    }
    
    const style = LAYER_CONFIG[name] || { color: '#3388ff' };
    
    const layer = L.geoJSON(data, {
        style: style,
        pointToLayer: (feature, latlng) => createPointMarker(feature, latlng, name),
        onEachFeature: (feature, layer) => addFeatureInteractivity(feature, layer, name)
    }).addTo(map);
    
    state.activeLayers[name] = layer;
}

function createPointMarker(feature, latlng, name) {
    if (name === 'sites') {
        const siteStyle = state.rankColoringEnabled ? 
            { ...LAYER_CONFIG.sites, fillColor: getRankColor(feature.properties.RANK) } :
            LAYER_CONFIG.sites;
        
        return L.circleMarker(latlng, { ...siteStyle, pane: 'sitesPane' });
    } else if (name === 'ccs') {
        return L.circleMarker(latlng, { ...LAYER_CONFIG.ccs, pane: 'sitesPane' });
    }
    return L.marker(latlng);
}

function toggleSpaceTypeFilter() {
    state.useSpaceTypeFilter = document.getElementById('use-space-filter').checked;
    refreshSitesLayer();
}

function filterSitesData(data) {
    return {
        type: 'FeatureCollection',
        features: data.features.filter(f => {
            const searchTerm = state.sitesFilter.toLowerCase();
            const matchesSearch = !state.sitesFilter || 
                f.properties.ENT_TITLE.toLowerCase().includes(searchTerm) ||
                f.properties.DES_REF.toLowerCase().includes(searchTerm);
            
            const matchesScore = (f.properties.FINAL_SCORE >= state.scoreMin) && 
                (f.properties.FINAL_SCORE <= state.scoreMax);
            
            const bufferPop = state.siteBufferPopulation[f.properties.DES_REF] || 0;
            const matchesPopulation = (bufferPop >= state.populationMin) && (bufferPop <= state.populationMax);
            
            // Filter by green space types if checkbox is enabled
            let matchesSpaceTypes = true;
            if (state.useSpaceTypeFilter && state.activeSpaceTypes.size > 0) {
                const closestOsId = Number(f.properties.CLOSEST_OS_ID);
                
                const matchingSpace = state.layersData['spaces']?.features?.find(space => {
                    const spaceId = Number(space.properties.OBJECTID_1);
                    return spaceId === closestOsId;
                });
                
                matchesSpaceTypes = matchingSpace && 
                    state.activeSpaceTypes.has(matchingSpace.properties.PAN65);
            }
            
            return matchesSearch && matchesScore && matchesPopulation && matchesSpaceTypes;
        })
    };
}

function toggleSpaces() {
    const spacesCheckbox = document.querySelector('input[data-layer="spaces"]');
    const typeToggles = document.querySelectorAll('.space-type');
    const typeCheckboxes = document.querySelectorAll('.space-type input');
    const typesHeading = document.getElementById('types-heading');
    
    if (spacesCheckbox.checked) {
        typesHeading.style.display = 'block';
        typeToggles.forEach(toggle => toggle.classList.add('visible'));
        
        if (!state.layersData['spaces']) {
            fetch('/layer/spaces')
                .then(r => r.json())
                .then(data => {
                    state.layersData['spaces'] = data;
                    typeCheckboxes.forEach(cb => {
                        cb.checked = true;
                        state.activeSpaceTypes.add(cb.dataset.type);
                    });
                    createLayer('spaces');
                });
        } else {
            typeCheckboxes.forEach(cb => {
                cb.checked = true;
                state.activeSpaceTypes.add(cb.dataset.type);
            });
            createLayer('spaces');
        }
    } else {
        typesHeading.style.display = 'none';
        typeToggles.forEach(toggle => toggle.classList.remove('visible'));
        
        if (state.activeLayers['spaces']) {
            map.removeLayer(state.activeLayers['spaces']);
            delete state.activeLayers['spaces'];
        }
        state.activeSpaceTypes.clear();
        typeCheckboxes.forEach(cb => cb.checked = false);
    }
}

function toggleSpaceType(spaceType) {
    const checkbox = document.querySelector(`input[data-type = "${spaceType}"]`);
    
    if (checkbox.checked) {
        state.activeSpaceTypes.add(spaceType);
    } else {
        state.activeSpaceTypes.delete(spaceType);
    }
    
    if (state.activeLayers['spaces']) {
        map.removeLayer(state.activeLayers['spaces']);
        delete state.activeLayers['spaces'];
    }
    
    if (state.activeSpaceTypes.size > 0) {
        createLayer('spaces');
    }
    
    // Refresh sites layer if space type filter is enabled
    if (state.useSpaceTypeFilter) {
        refreshSitesLayer();
    }
}

function buildBufferPopulationMap() {
    if (state.layersData['buffers']) {
        state.layersData['buffers'].features.forEach(feature => {
            const desRef = feature.properties.DES_REF;
            const population = feature.properties.Population || 0;
            state.siteBufferPopulation[desRef] = population;
        });
    }
}

function addFeatureInteractivity(feature, layer, layerName) {
    const style = LAYER_CONFIG[layerName];
    
    if (layerName === 'sites') {
        layer.on('click', () => selectSite(feature.properties.DES_REF, layer));
        layer.on('mouseover', function() {
            if (state.selectedSiteLayer !== this) {
                this.setStyle({ fillOpacity: 1 });
            }
        });
        layer.on('mouseout', function() {
            if (state.selectedSiteLayer !== this) {
                this.setStyle({ fillOpacity: style.fillOpacity });
            }
        });
    } else {
        const hoverOpacity = layerName === 'ccs' ? 1 : 0.4;
        layer.on('mouseover', function() {
            this.setStyle({ fillOpacity: hoverOpacity });
        });
        layer.on('mouseout', function() {
            this.setStyle({ fillOpacity: style.fillOpacity });
        });
        
        const popupContent = infoPopup(feature.properties, layerName);
        layer.bindPopup(popupContent);
        layer.on('popupopen', (e) => {
            const el = e.popup.getElement();
            if (el) {
                el.style.border = `4px solid ${style.color}`;
                el.style.borderRadius = '15px';
            }
        });
    }
}

function infoPopup(properties, layerName) {
    const popupTemplates = {
        buffers: () => `
            <h3>Buffer of: ${properties.ENT_TITLE}</h3>
            <b>Population:</b> ${Math.round(properties.Population).toLocaleString()}<br>
            <b>Bus routes:</b> ${Math.round(properties.No__of_Bus).toLocaleString()}<br>
        `,
        spaces: () => `
            <h3>${properties.NAME}</h3>
            <b>Type:</b> ${properties.PAN65}<br>
            ${properties.CLASSIFICA ? `<b>Classification:</b> ${properties.CLASSIFICA}<br>` : ''}
            <b>Area:</b> ${properties.Area_ha.toLocaleString()} hectares<br>
        `,
        ccs: () => `
            <h3>${properties.CENTRE_NAME}</h3>
            <b>Address:</b> ${properties.ADDRESS}<br>
            ${properties.LINK ? `<a href="${properties.LINK}" target = "_blank">Website</a>` : ''}
        `
    };
    
    return popupTemplates[layerName] ? popupTemplates[layerName]() : '<p>No details</p>';
}

function toggleRankColoring() {
    state.rankColoringEnabled = document.getElementById('rank-coloring-checkbox').checked;
    const rankColorbar = document.getElementById('rank-colorbar-container');
    rankColorbar.style.display = state.rankColoringEnabled ? 'block' : 'none';
    
    if (state.activeLayers['sites']) {
        map.removeLayer(state.activeLayers['sites']);
        delete state.activeLayers['sites'];
        createLayer('sites');
    }
}

function generateRankColorbar() {
    const container = document.getElementById('rank-colorbar');
    container.innerHTML = '';
    
    for (let i = 65; i >= 1; i--) {
        const segment = document.createElement('div');
        segment.className = 'rank-colorbar-segment';
        segment.style.backgroundColor = getRankColor(i);
        container.appendChild(segment);
    }
}

function getRankColor(rank) {
    if (!rank || !state.plasmaData) return 'rgb(13, 8, 135)';
    
    const normalized = (65 - rank) / 64;
    const index = Math.round(normalized * (state.plasmaData.length - 1));
    const [r, g, b] = state.plasmaData[index];
    
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

function selectSite(desRef, layer) {
    if (state.selectedSiteLayer) {
        map.removeLayer(state.selectedSiteLayer);
        state.selectedSiteLayer = null;
    }
    
    const latlng = layer.getLatLng();
    state.selectedSiteLayer = L.circleMarker(latlng, {
        ...LAYER_CONFIG.sites,
        fillOpacity: 1,
        radius: LAYER_CONFIG.sites.bigradius,
        pane: 'sitesPane'
    }).addTo(map);
    
    state.selectedSite = desRef;
    
    const requiredLayers = ['buffers', 'spaces', 'ccs'];
    const loadPromises = requiredLayers.map(layerName => {
        if (!state.layersData[layerName]) {
            return fetch(`/layer/${layerName}`)
                .then(r => r.json())
                .then(data => { state.layersData[layerName] = data; });
        }
        return Promise.resolve();
    });
    
    Promise.all(loadPromises)
        .then(() => fetch(`/site_details/${desRef}`))
        .then(r => r.json())
        .then(data => {
            displaySiteDetails(data);
            highlightRelatedFeatures(data);
        });
}

function displaySiteDetails(details) {
    const panel = document.getElementById('site-details');
    const content = document.getElementById('details-content');
    
    let html = `<h3>${details.site_info.ENT_TITLE}</h3>`;
    
    // Site info section
    html += createDetailSection('Site Info', LAYER_CONFIG.sites, [
        ['Final Score', details.site_info.FINAL_SCORE?.toLocaleString() || 'N/A'],
        ['Site Rank', `${details.site_info.RANK}/65`],
        ['Designated', details.site_info.DESIGNATED || 'N/A'],
        ['Reference', details.site_info.DES_REF || 'N/A'],
        ['Website', `<a href = "${details.site_info.LINK}" target = "_blank">Link</a>`]
    ]);
    
    // Buffer zone section
    html += createDetailSection('Buffer Zone', LAYER_CONFIG.buffers, [
        ['Population', details.site_catchment.POPULATION?.toLocaleString() || 'N/A'],
        ['Bus Routes', details.site_catchment.NUM_BUS_ROUTES || 0]
    ]);
    
    // SIMD scores
    html += createDetailSection('SIMD Ranks', LAYER_CONFIG.buffers, [
        ['Average', Math.round(details.simd_score.COMP_SIMD || 0).toLocaleString()],
        ['Income', Math.round(details.simd_score.AVG_INCOME || 0).toLocaleString()],
        ['Employment', Math.round(details.simd_score.AVG_EMPLOY || 0).toLocaleString()],
        ['Health', Math.round(details.simd_score.AVG_HEALTH || 0).toLocaleString()],
        ['Access', Math.round(details.simd_score.AVG_ACCESS || 0).toLocaleString()]
    ]);
    
    // Green space section
    html += createDetailSection('Nearest Green Space', LAYER_CONFIG.spaces, [
        ['Name', details.open_spaces.NAME || 'N/A'],
        ['Type', details.open_spaces.TYPE || 'N/A'],
        ['Area', `${details.open_spaces.AREA_HA?.toFixed(3) || 'N/A'} hectares`]
    ]);
    
    // Community centre section
    html += createDetailSection('Nearest Community Centre', LAYER_CONFIG.ccs, [
        ['Name', details.community_centres.CENTRE_NAME || 'N/A'],
        ['Address', details.community_centres.ADDRESS || 'N/A']
    ]);
    
    content.innerHTML = html;
    panel.classList.add('active');
}

function createDetailSection(title, config, rows) {
    let html = `<div class = "detail-section" style = "border-color: ${config.color}; color: ${config.color}; background: ${config.background};">`;
    if (title) html += `<h4>${title}</h4>`;
    
    rows.forEach(([label, value]) => {
        html += `
            <div class = 'detail-row'>
                <span class = 'detail-label'>${label}:</span>
                <span class = 'detail-value'>${value}</span>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function highlightRelatedFeatures(details) {
    Object.values(state.highlightedLayers).forEach(layer => {
        if (layer) map.removeLayer(layer);
    });
    state.highlightedLayers = {};
    
    // Highlight buffer
    if (details.site_catchment && state.layersData.buffers) {
        const bufferFeature = state.layersData.buffers.features.find(
            f => f.properties.DES_REF === details.site_catchment.DES_REF
        );
        if (bufferFeature) {
            const style = LAYER_CONFIG.buffers;
            state.highlightedLayers.buffer = L.geoJSON(bufferFeature, {
                style: style,
                onEachFeature: (f, l) => addFeatureInteractivity(f, l, 'buffers')
            }).addTo(map);
        }
    }
    
    // Highlight space
    if (details.open_spaces && state.layersData.spaces) {
        const spaceFeature = state.layersData.spaces.features.find(
            f => f.properties.OBJECTID_1 === details.open_spaces.OS_ID
        );
        if (spaceFeature) {
            state.highlightedLayers.space = L.geoJSON(spaceFeature, {
                style: LAYER_CONFIG.spaces,
                onEachFeature: (f, l) => addFeatureInteractivity(f, l, 'spaces')
            }).addTo(map);
        }
    }
    
    // Highlight community centre
    if (details.community_centres && state.layersData.ccs) {
        const ccFeature = state.layersData.ccs.features.find(
            f => f.properties.CENTRE_ID === details.community_centres.CENTRE_ID
        );
        if (ccFeature) {
            state.highlightedLayers.cc = L.geoJSON(ccFeature, {
                pointToLayer: (f, latlng) => L.circleMarker(latlng, {
                    ...LAYER_CONFIG.ccs,
                    radius: LAYER_CONFIG.ccs.bigradius,
                    fillOpacity: 1
                }),
                onEachFeature: (f, l) => addFeatureInteractivity(f, l, 'ccs', false)
            }).addTo(map);
        }
    }
}

function clearSelection() {
    if (state.selectedSiteLayer) {
        map.removeLayer(state.selectedSiteLayer);
        state.selectedSiteLayer = null;
    }
    
    Object.values(state.highlightedLayers).forEach(layer => {
        if (layer) map.removeLayer(layer);
    });
    state.highlightedLayers = {};
    
    document.getElementById('site-details').classList.remove('active');
    state.selectedSite = null;
}

function updateScoreFilter() {
    state.scoreMin = parseFloat(document.getElementById('score-min').value);
    state.scoreMax = parseFloat(document.getElementById('score-max').value);
    
    if (state.scoreMin > state.scoreMax) {
        [state.scoreMin, state.scoreMax] = [state.scoreMax, state.scoreMin];
        document.getElementById('score-min').value = state.scoreMin;
        document.getElementById('score-max').value = state.scoreMax;
    }
    
    document.getElementById('min-value').textContent = state.scoreMin.toFixed(2);
    document.getElementById('max-value').textContent = state.scoreMax.toFixed(2);
    
    refreshSitesLayer();
}

function updatePopulationFilter() {
    state.populationMin = parseFloat(document.getElementById('pop-min').value);
    state.populationMax = parseFloat(document.getElementById('pop-max').value);
    
    if (state.populationMin > state.populationMax) {
        [state.populationMin, state.populationMax] = [state.populationMax, state.populationMin];
        document.getElementById('pop-min').value = state.populationMin;
        document.getElementById('pop-max').value = state.populationMax;
    }
    
    document.getElementById('pop-min-value').textContent = state.populationMin.toLocaleString();
    document.getElementById('pop-max-value').textContent = state.populationMax.toLocaleString();
    
    refreshSitesLayer();
}

function resetScoreFilter() {
    document.getElementById('score-min').value = 0;
    document.getElementById('score-max').value = 1;
    document.getElementById('pop-min').value = 0;
    document.getElementById('pop-max').value = 30000;
    
    state.scoreMin = 0;
    state.scoreMax = 1;
    state.populationMin = 0;
    state.populationMax = 30000;
    
    document.getElementById('min-value').textContent = '0.00';
    document.getElementById('max-value').textContent = '1.00';
    document.getElementById('pop-min-value').textContent = '0';
    document.getElementById('pop-max-value').textContent = '30,000';
    
    refreshSitesLayer();
}

function searchSites() {
    state.sitesFilter = document.getElementById('site-search').value;
    const sitesCheckbox = document.querySelector('input[data-layer="sites"]');
    
    if (state.activeLayers['sites']) {
        map.removeLayer(state.activeLayers['sites']);
        delete state.activeLayers['sites'];
    }
    
    const loadAndCreate = () => {
        createLayer('sites');
        sitesCheckbox.checked = true;
    };
    
    if (state.layersData['sites']) {
        loadAndCreate();
    } else {
        fetch('/layer/sites')
            .then(r => r.json())
            .then(data => {
                state.layersData['sites'] = data;
                loadAndCreate();
            });
    }
}

function refreshSitesLayer() {
    if (state.activeLayers['sites']) {
        map.removeLayer(state.activeLayers['sites']);
        delete state.activeLayers['sites'];
        createLayer('sites');
    }
}