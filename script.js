// ==========================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ==========================================
let limitesGlobales = {};
let centroides = [];
let viviendas = [];
let map, map2A, map2B; 
let capaPuntos, capaPuntos2A, capaPuntos2B, capaResaltado;
let ultimoResultadoClusters = []; 
let scoresPorClusterId = {}; 

const variables = [
    "Dist_Metro_m", "Dist_Gastro_m", "Dist_Educa_m", "Dist_TM_m",
    "Dist_Parque_m", "Dist_Salud_m", "Dist_CC_m", "Ozono",
    "Indice_Ruido", "Peligrosidad_Delitos", "Cluster_Gastro_bin",
    "Cluster_Salud_bin", "Cluster_Parques_bin", "Vulnerabilidad_Agua_num",
    "Estrato_Manzana_score"
];

const pesosPredefinidos = [183, 179, 176, 88, 86, 84, 42, 41, 40, 20, 19, 18, 9, 8, 7];

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
    // Mapa 1: General
    map = L.map('map').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    capaPuntos = L.layerGroup().addTo(map);
    capaResaltado = L.layerGroup().addTo(map);

    // Mapa 2A: Contexto
    map2A = L.map('map2A', { zoomControl: false }).setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2A);
    capaPuntos2A = L.layerGroup().addTo(map2A);

    // Mapa 2B: Score Económico (El que fallaba)
    map2B = L.map('map2B').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2B);
    capaPuntos2B = L.layerGroup().addTo(map2B);

    const container = document.getElementById("variables");
    variables.forEach((v, index) => {
        const div = document.createElement("div");
        div.className = "variable-item";
        div.draggable = true;
        div.id = v;
        div.innerHTML = `
            <span style="margin-right: 15px; color: #888;">☰</span> 
            <b>${v.replace(/_/g, ' ')}</b>
            <input type="number" class="puntos-input" value="${pesosPredefinidos[index]}" data-var="${v}" style="width: 50px; float: right; display: none;">
        `;
        
        div.ondragstart = (e) => e.dataTransfer.setData("text/plain", e.target.id);
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData("text");
            const draggedElement = document.getElementById(data);
            const targetElement = e.target.closest(".variable-item");
            if (targetElement && draggedElement !== targetElement) {
                container.insertBefore(draggedElement, targetElement);
            }
        };
        container.appendChild(div);
    });

    Promise.all([
        fetch("centroides.json").then(r => r.json()),
        fetch("data32GH.json").then(r => r.json())
    ]).then(([dataC, dataV]) => {
        centroides = dataC;
        viviendas = dataV;
        calcularLimites(); 
        document.getElementById("resultado").innerText = "Datos cargados.";
    });
});

// ==========================================
// 3. FUNCIONES DE APOYO
// ==========================================
function togglePersonalizacion() {
    const container = document.getElementById("variables");
    const esPersonalizado = container.classList.toggle("modo-personalizado");
    document.querySelectorAll(".puntos-input").forEach(input => {
        input.style.display = esPersonalizado ? "inline-block" : "none";
    });
    const btn = document.querySelector(".btn-personalizar");
    if (btn) {
        btn.innerText = esPersonalizado ? "BLOQUEAR PUNTOS" : "PERSONALIZAR PUNTOS";
        btn.style.backgroundColor = esPersonalizado ? "#28a745" : "#6c757d";
    }
}

function calcularLimites() {
    variables.forEach(v => {
        const valores = viviendas.map(reg => reg[v] || 0);
        limitesGlobales[v] = { min: Math.min(...valores), max: Math.max(...valores) };
    });
    const precios = viviendas.map(reg => reg.Precio || 0);
    limitesGlobales["Precio"] = { min: Math.min(...precios), max: Math.max(...precios) };
}

// Color para el Mapa 1 (Afinidad)
function colorScore(score, minScore, maxScore) {
    let x = (maxScore !== minScore) ? (score - minScore) / (maxScore - minScore) : 0;
    if (x <= 0.1) return "#000080";
    if (x <= 0.3) return "#1E90FF";
    if (x <= 0.5) return "#87CEEB";
    if (x <= 0.7) return "#FF9999";
    if (x <= 0.9) return "#FF0000";
    return "#8B0000";
}

// COLOR CORREGIDO PARA MAPA 2B (SCORE ECONÓMICO)
function colorScoreEconomico(sE, maxSE) {
    // sE es la diferencia porcentual con el presupuesto. 0 es perfecto.
    if (sE <= 0.1) return "#28a745"; // Verde (Muy accesible)
    if (sE <= 0.3) return "#ffc107"; // Amarillo (Aceptable)
    return "#dc3545";               // Rojo (Caro / Lejos)
}

// ==========================================
// 4. CÁLCULO
// ==========================================
function calcular() {
    if (viviendas.length === 0 || centroides.length === 0) return;

    let mapaDePesos = {};
    const container = document.getElementById("variables");
    const esPersonalizado = container.classList.contains("modo-personalizado");

    document.querySelectorAll(".puntos-input").forEach((input, index) => {
        if (esPersonalizado) {
            mapaDePesos[input.dataset.var] = parseFloat(input.value) || 0;
        } else {
            const varName = input.dataset.var;
            const items = Array.from(document.querySelectorAll(".variable-item"));
            const idxReal = items.findIndex(item => item.id === varName);
            mapaDePesos[varName] = pesosPredefinidos[idxReal];
            input.value = pesosPredefinidos[idxReal];
        }
    });

    const current_weights = variables.map(v => (mapaDePesos[v] || 0) / 1000);
    const ingresos = parseFloat(document.getElementById("ingresos").value) || 0;
    const ahorros = parseFloat(document.getElementById("ahorros").value) || 0;
    const gastos = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ingresos - ahorros - gastos) * 0.733;

    scoresPorClusterId = {};

    ultimoResultadoClusters = centroides.map((cluster, index) => {
        let suma = variables.reduce((acc, v, i) => acc + (current_weights[i] * Math.pow(cluster[v] || 0, 2)), 0);
        let sCluster = Math.sqrt(suma);
        let vEnCluster = viviendas.filter(v => v.Clusters === index);
        let totalScoreE = vEnCluster.reduce((acc, v) => acc + (Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0), 0);

        scoresPorClusterId[index] = sCluster;
        return {
            id: index,
            scoreCluster: sCluster,
            puntos: vEnCluster.length,
            scoreEProm: vEnCluster.length > 0 ? (totalScoreE / vEnCluster.length) : 0
        };
    }).sort((a, b) => a.scoreCluster - b.scoreCluster);

    renderizarVistasFiltradas();
    if (ultimoResultadoClusters.length > 0) filtrarMapa2(ultimoResultadoClusters[0].id);
}

// ==========================================
// 5. RENDERIZADO MAPA 1
// ==========================================
function actualizarFiltroScore(valor) {
    document.getElementById("score-valor").innerText = valor + "%";
    renderizarVistasFiltradas();
}

function renderizarVistasFiltradas() {
    const sliderVal = parseFloat(document.getElementById("score-slider").value);
    const umbralPorcentaje = sliderVal / 100;
    const scoresArray = Object.values(scoresPorClusterId);
    const minGlobal = Math.min(...scoresArray);
    const maxGlobal = Math.max(...scoresArray);
    const scoreMaximoPermitido = minGlobal + (maxGlobal - minGlobal) * umbralPorcentaje;

    capaPuntos.clearLayers();
    viviendas.forEach(p => {
        let sc = scoresPorClusterId[p.Clusters]; 
        if (sc !== undefined && sc <= scoreMaximoPermitido) {
            let col = colorScore(sc, minGlobal, maxGlobal);
            L.circleMarker([p.lat, p.lon], { 
                radius: 4, fillColor: col, color: "#fff", weight: 0.5, fillOpacity: 0.8 
            }).on('click', () => filtrarMapa2(p.Clusters)).addTo(capaPuntos);
        }
    });

    let clustersFiltrados = ultimoResultadoClusters.filter(c => c.scoreCluster <= scoreMaximoPermitido);
    let h1 = `<table style="width:100%; border-collapse:collapse;"><tr style="background:#eee; position:sticky; top:0;"><th>Cluster</th><th>Puntos</th><th>Score</th><th>Econ. Prom</th></tr>`;
    clustersFiltrados.forEach(c => {
        h1 += `<tr id="fila-cluster-${c.id}" style="cursor:pointer;" onclick="filtrarMapa2(${c.id})" onmouseover="resaltarClusterEnMapa1(${c.id})" onmouseout="quitarResaltado()">
                <td><b>Cluster ${c.id}</b></td><td>${c.puntos}</td><td>${c.scoreCluster.toFixed(4)}</td><td>${c.scoreEProm.toFixed(4)}</td></tr>`;
    });
    document.getElementById("tabla-clusters").innerHTML = h1 + `</table>`;
}

// ==========================================
// 6. DETALLE (MAPA 2A Y 2B CORREGIDO)
// ==========================================
function filtrarMapa2(clusterId) {
    document.querySelectorAll("#tabla-clusters tr").forEach(tr => tr.style.background = "");
    const filaC = document.getElementById(`fila-cluster-${clusterId}`);
    if (filaC) filaC.style.background = "#e3f2fd";

    capaPuntos2A.clearLayers();
    capaPuntos2B.clearLayers();

    const ingresos = parseFloat(document.getElementById("ingresos").value) || 0;
    const ahorros = parseFloat(document.getElementById("ahorros").value) || 0;
    const gastos = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ingresos - ahorros - gastos) * 0.733;

    viviendas.forEach(p => {
        let esDelCluster = (p.Clusters === clusterId);
        L.circleMarker([p.lat, p.lon], {
            radius: 2, fillColor: esDelCluster ? "#00008B" : "#D3D3D3", color: "none", fillOpacity: esDelCluster ? 0.9 : 0.3
        }).addTo(capaPuntos2A);
    });

    const vFiltradas = viviendas.filter(v => v.Clusters === clusterId);
    let vOrdenadas = vFiltradas
        .map(v => ({ ...v, sE: Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0 }))
        .sort((a, b) => a.sE - b.sE);

    const maxSEActual = vOrdenadas.length > 0 ? Math.max(...vOrdenadas.map(v => v.sE)) : 0;

    let h2 = `<table style="width:100%; border-collapse:collapse;"><tr style="background:#ffd700; position:sticky; top:0;"><th>#</th><th>Precio</th><th>Score Econ.</th><th>Acción</th></tr>`;
    
    vOrdenadas.forEach((p, i) => {
        const filaId = `fila-${p.lat}-${p.lon}`.replace(/\./g, '_');
        h2 += `<tr id="${filaId}"><td>${i+1}</td><td>$${p.Precio.toLocaleString()}</td><td>${p.sE.toFixed(4)}</td>
               <td><button onclick="hacerZoomVivienda(${p.lat}, ${p.lon})">📍 Ver</button></td></tr>`;

        // CORRECCIÓN DE COLOR AQUÍ
        let colEco = colorScoreEconomico(p.sE, maxSEActual);
        
        let marcador = L.circleMarker([p.lat, p.lon], { 
            radius: 9, 
            fillColor: colEco, 
            color: "#000", 
            weight: 1, 
            fillOpacity: 1 // Forzamos opacidad total para evitar el blanco
        }).addTo(capaPuntos2B);
        
        marcador.bindTooltip(`${i+1}`, {permanent: true, direction: 'center', className: 'etiqueta-numero'});
        marcador.viviendaID = `${p.lat}-${p.lon}`; 
        marcador.colorOriginal = colEco; 
        marcador.on('click', () => hacerZoomVivienda(p.lat, p.lon));
    });

    document.getElementById("tabla-viviendas").innerHTML = h2 + `</table>`;
    if (vOrdenadas.length > 0) map2B.fitBounds(new L.featureGroup(capaPuntos2B.getLayers()).getBounds(), {padding: [20, 20]});
}

function hacerZoomVivienda(lat, lon) {
    map2B.setView([lat, lon], 17);
    
    capaPuntos2B.eachLayer(layer => {
        if (layer.viviendaID) {
            if (layer.viviendaID === `${lat}-${lon}`) {
                layer.setStyle({ 
                    fillColor: '#FF00FF', // MAGENTA PARA EL SELECCIONADO
                    color: '#000', 
                    weight: 5, 
                    radius: 14,
                    fillOpacity: 1
                });
                layer.bringToFront();
            } else {
                layer.setStyle({ 
                    fillColor: layer.colorOriginal, 
                    color: "#000", 
                    weight: 1, 
                    radius: 9,
                    fillOpacity: 1
                });
            }
        }
    });

    document.querySelectorAll("#tabla-viviendas tr").forEach(tr => tr.style.background = "");
    const filaId = `fila-${lat}-${lon}`.replace(/\./g, '_');
    const fila = document.getElementById(filaId);
    if (fila) {
        fila.style.background = "#fff9c4";
        fila.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const registro = viviendas.find(v => v.lat === lat && v.lon === lon);
    if (registro) generarFichaTecnica(registro);
}

function resaltarClusterEnMapa1(clusterId) {
    capaResaltado.clearLayers();
    const puntosCluster = viviendas.filter(v => v.Clusters === clusterId);
    if (puntosCluster.length > 0) {
        const lats = puntosCluster.map(p => p.lat);
        const lons = puntosCluster.map(p => p.lon);
        L.rectangle([[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]], 
        {color: "#ff0000", weight: 2, fillOpacity: 0.1, dashArray: "5, 5"}).addTo(capaResaltado);
    }
}

function quitarResaltado() { capaResaltado.clearLayers(); }

// ==========================================
// 7. FICHA TÉCNICA
// ==========================================
function generarFichaTecnica(registro) {
    const mapaNombres = {
        "Dist_CC_m": "CC_Cercano", "Dist_Metro_m": "Metro_Ref", "Dist_Gastro_m": "Gastro_Cercano",
        "Dist_Educa_m": "Educa", "Dist_TM_m": "Estacion_TM_Cercana", "Vulnerabilidad_Agua_num": "Vulnerabilidad_Agua"
    };

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; padding: 10px;">`;

    const crearCuadro = (etiqueta, valor, clave) => {
        const lim = limitesGlobales[clave] || { min: 0, max: 1 };
        let porc = Math.max(0, Math.min(100, ((valor - lim.min) / (lim.max - lim.min)) * 100));
        return `
            <div style="background: #fff; padding: 8px; border: 1px solid #eee; border-radius: 4px; min-height: 85px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <small style="color: #777; font-size: 0.6rem; text-transform: uppercase;">${etiqueta}:</small><br>
                    <strong style="font-size: 0.85rem;">${typeof valor === 'number' && !Number.isInteger(valor) ? valor.toFixed(1) : valor.toLocaleString()}</strong>
                </div>
                <div style="width: 100%; height: 4px; background: #eee; margin-top: 8px; border-radius: 2px;">
                    <div style="width: ${porc}%; height: 100%; background: #4caf50;"></div>
                </div>
            </div>`;
    };

    html += crearCuadro("PRECIO TOTAL", registro.Precio, "Precio");
    variables.forEach(v => {
        let nom = v.replace(/_/g, ' ');
        let val = registro[v];
        let extra = "";
        if (v === "Estrato_Manzana_score") { nom = "Estrato Manzana"; val = registro["Estrato_Manzana"]; }
        else if (mapaNombres[v] && registro[mapaNombres[v]]) { extra = `<br><span style="color:#2e7d32; font-size:0.65rem; font-weight:bold;">${registro[mapaNombres[v]]}</span>`; }
        let cuadro = crearCuadro(nom, val, v);
        if (extra) cuadro = cuadro.replace("</strong>", "</strong>" + extra);
        html += cuadro;
    });
    document.getElementById("detalle-vivienda").innerHTML = html + `</div>`;
}