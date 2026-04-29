// ==========================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ==========================================
let limitesGlobales = {};
let centroides = [];
let viviendas = [];
let map, map2A, map2B; 
let capaPuntos, capaPuntos2A, capaPuntos2B, capaResaltado;

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
    // Mapa 1: General (Bogotá)
    map = L.map('map').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    capaPuntos = L.layerGroup().addTo(map);
    capaResaltado = L.layerGroup().addTo(map);

    // Mapa 2A: Contexto del Cluster
    map2A = L.map('map2A', { zoomControl: false }).setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2A);
    capaPuntos2A = L.layerGroup().addTo(map2A);

    // Mapa 2B: Zoom y Selección (Económico)
    map2B = L.map('map2B').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2B);
    capaPuntos2B = L.layerGroup().addTo(map2B);

    // Lista Arrastrable de Variables
    const container = document.getElementById("variables");
    variables.forEach((v) => {
        const div = document.createElement("div");
        div.className = "variable-item";
        div.draggable = true;
        div.id = v;
        div.innerHTML = `<span style="margin-right: 15px; color: #888;">☰</span> <b>${v.replace(/_/g, ' ')}</b>`;
        
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

    // Carga de Datos
    Promise.all([
        fetch("centroides.json").then(r => r.json()),
        fetch("data32GH.json").then(r => r.json())
    ]).then(([dataC, dataV]) => {
        centroides = dataC;
        viviendas = dataV;
        calcularLimites(); 
        document.getElementById("resultado").innerText = "Datos cargados. Configure y calcule.";
    }).catch(err => {
        console.error("Error:", err);
        document.getElementById("resultado").innerText = "Error al cargar archivos JSON.";
    });
});

// ==========================================
// 3. FUNCIONES DE APOYO
// ==========================================
function calcularLimites() {
    variables.forEach(v => {
        const valores = viviendas.map(reg => reg[v] || 0);
        limitesGlobales[v] = { min: Math.min(...valores), max: Math.max(...valores) };
    });
    const precios = viviendas.map(reg => reg.Precio || 0);
    limitesGlobales["Precio"] = { min: Math.min(...precios), max: Math.max(...precios) };
}

function colorScore(score, minScore, maxScore) {
    let x = (score - minScore) / (maxScore - minScore);
    if (isNaN(x)) x = 0;
    if (x <= 0.1) return "#000080";
    if (x <= 0.3) return "#1E90FF";
    if (x <= 0.5) return "#87CEEB";
    if (x <= 0.7) return "#FF9999";
    if (x <= 0.9) return "#FF0000";
    return "#8B0000";
}

// Escala de color para el Score Económico (Verde -> Rojo)
function colorScoreEconomico(sE, maxSE) {
    let x = maxSE !== 0 ? sE / maxSE : 0;
    if (x <= 0.2) return "#2ecc71"; // Verde
    if (x <= 0.4) return "#a2d149"; // Verde lima
    if (x <= 0.6) return "#f1c40f"; // Amarillo
    if (x <= 0.8) return "#e67e22"; // Naranja
    return "#e74c3c";               // Rojo
}

function resaltarClusterEnMapa1(clusterId) {
    capaResaltado.clearLayers();
    const puntosCluster = viviendas.filter(v => v.Clusters === clusterId);
    if (puntosCluster.length > 0) {
        const lats = puntosCluster.map(p => p.lat);
        const lons = puntosCluster.map(p => p.lon);
        const bounds = [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
        L.rectangle(bounds, {color: "#ff0000", weight: 3, fillOpacity: 0, dashArray: "5, 5"}).addTo(capaResaltado);
    }
}

function quitarResaltado() {
    capaResaltado.clearLayers();
}

// ==========================================
// 4. CÁLCULO PRINCIPAL
// ==========================================
function calcular() {
    if (viviendas.length === 0 || centroides.length === 0) return;

    const listaOrdenada = Array.from(document.querySelectorAll(".variable-item")).map(el => el.id);
    let mapaDePesos = {};
    listaOrdenada.forEach((nombreVar, index) => {
        mapaDePesos[nombreVar] = pesosPredefinidos[index]; 
    });

    const current_weights = variables.map(v => (mapaDePesos[v] || 0) / 1000);

    const ingresos = parseFloat(document.getElementById("ingresos").value) || 0;
    const ahorros = parseFloat(document.getElementById("ahorros").value) || 0;
    const gastos = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ingresos - ahorros - gastos) * 0.733;

    let infoClusters = centroides.map((cluster, index) => {
        let suma = variables.reduce((acc, v, i) => acc + (current_weights[i] * Math.pow(cluster[v] || 0, 2)), 0);
        let sCluster = Math.sqrt(suma);
        let vEnCluster = viviendas.filter(v => v.Clusters === index);
        let totalScoreE = vEnCluster.reduce((acc, v) => acc + (Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0), 0);

        return {
            id: index,
            scoreCluster: sCluster,
            puntos: vEnCluster.length,
            scoreEProm: vEnCluster.length > 0 ? (totalScoreE / vEnCluster.length) : 0
        };
    });

    let clustersOrdenados = [...infoClusters].sort((a, b) => a.scoreCluster - b.scoreCluster);
    const minGlobal = Math.min(...infoClusters.map(c => c.scoreCluster));
    const maxGlobal = Math.max(...infoClusters.map(c => c.scoreCluster));

    // Mapa General
    capaPuntos.clearLayers();
    viviendas.forEach(p => {
        let sc = infoClusters[p.Clusters].scoreCluster;
        let col = colorScore(sc, minGlobal, maxGlobal);
        L.circleMarker([p.lat, p.lon], { radius: 2, color: col, stroke: false, fillOpacity: 0.6 }).addTo(capaPuntos);
    });

    // Tabla Clusters
    let h1 = `<table border="1" style="width:100%; border-collapse:collapse;"><tr style="background:#eee; position:sticky; top:0;"><th>Cluster</th><th>Puntos</th><th>Score</th><th>Econ. Prom</th></tr>`;
    clustersOrdenados.forEach(c => {
        h1 += `<tr style="cursor:pointer;" onclick="filtrarMapa2(${c.id})" onmouseover="resaltarClusterEnMapa1(${c.id})" onmouseout="quitarResaltado()">
                <td style="color: blue; text-decoration: underline;"><b>Cluster ${c.id}</b></td>
                <td>${c.puntos}</td><td>${c.scoreCluster.toFixed(4)}</td><td>${c.scoreEProm.toFixed(4)}</td></tr>`;
    });
    document.getElementById("tabla-clusters").innerHTML = h1 + `</table>`;

    filtrarMapa2(clustersOrdenados[0].id);
    document.getElementById("resultado").innerText = "Cálculo completado.";
}

// ==========================================
// 5. FILTRADO Y MAPAS DE DETALLE (2A y 2B)
// ==========================================
function filtrarMapa2(clusterId) {
    capaPuntos2A.clearLayers();
    capaPuntos2B.clearLayers();

    // MAPA 2A: Contexto Global
    viviendas.forEach(p => {
        let esDelCluster = (p.Clusters === clusterId);
        L.circleMarker([p.lat, p.lon], {
            radius: 2,
            color: esDelCluster ? "#00008B" : "#D3D3D3",
            stroke: false,
            fillOpacity: esDelCluster ? 0.9 : 0.4
        }).addTo(capaPuntos2A);
    });
    map2A.setView([4.65, -74.1], 11);

    // Lógica Económica
    const vFiltradas = viviendas.filter(v => v.Clusters === clusterId);
    const Ca = (parseFloat(document.getElementById("ingresos").value) - parseFloat(document.getElementById("ahorros").value) - parseFloat(document.getElementById("gastos").value)) * 0.733;

    let vOrdenadas = vFiltradas
        .map(v => ({ ...v, sE: Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0 }))
        .sort((a, b) => a.sE - b.sE);

    const maxSEActual = vOrdenadas.length > 0 ? Math.max(...vOrdenadas.map(v => v.sE)) : 0;

    // Tabla Viviendas
    let h2 = `<table border="1" style="width:100%; border-collapse:collapse;"><tr style="background:#ffd700; position:sticky; top:0;"><th>#</th><th>Precio</th><th>Score Econ.</th><th>Acción</th></tr>`;
    vOrdenadas.forEach((v, i) => {
        const filaId = `fila-${v.lat}-${v.lon}`.replace(/\./g, '_');
        h2 += `<tr id="${filaId}"><td>${i+1}</td><td>$${v.Precio.toLocaleString()}</td><td>${v.sE.toFixed(4)}</td>
               <td><button onclick="hacerZoomVivienda(${v.lat}, ${v.lon}, ${v.Precio})">📍 Ver</button></td></tr>`;
    });
    document.getElementById("tabla-viviendas").innerHTML = h2 + `</table>`;

    // MAPA 2B: Marcadores con escala económica y click
    vOrdenadas.forEach((p, i) => {
        let colEco = colorScoreEconomico(p.sE, maxSEActual);

        let marcador = L.circleMarker([p.lat, p.lon], { 
            radius: 9, 
            color: colEco, 
            fillColor: colEco,
            fillOpacity: 0.9, 
            weight: 2 
        }).addTo(capaPuntos2B);
        
        marcador.bindTooltip(`${i+1}`, {permanent: true, direction: 'center', className: 'etiqueta-numero'});
        marcador.viviendaID = `${p.lat}-${p.lon}`; 
        marcador.colorOriginal = colEco; // Guardar para resetear resaltado
        
        marcador.on('click', () => hacerZoomVivienda(p.lat, p.lon, p.Precio));
    });

    if (vOrdenadas.length > 0) map2B.fitBounds(new L.featureGroup(capaPuntos2B.getLayers()).getBounds());
}

// ==========================================
// 6. ZOOM, RESALTADO CRUZADO Y FICHA
// ==========================================
function hacerZoomVivienda(lat, lon, precio) {
    map2B.setView([lat, lon], 17);

    // Resaltar Marcador en Mapa 2B
    capaPuntos2B.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) {
            if (layer.viviendaID === `${lat}-${lon}`) {
                layer.setStyle({ color: 'orange', fillColor: 'orange', weight: 6, radius: 12 });
                layer.bringToFront();
            } else {
                layer.setStyle({ color: layer.colorOriginal, fillColor: layer.colorOriginal, weight: 2, radius: 9 });
            }
        }
    });

    // Resaltar Fila en Tabla y Scroll
    document.querySelectorAll("#tabla-viviendas tr").forEach(tr => {
        tr.style.backgroundColor = ""; 
        tr.style.fontWeight = "normal";
    });
    const filaId = `fila-${lat}-${lon}`.replace(/\./g, '_');
    const fila = document.getElementById(filaId);
    if (fila) {
        fila.style.backgroundColor = "#fff9c4";
        fila.style.fontWeight = "bold";
        fila.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Ficha Técnica
    const registro = viviendas.find(v => v.lat === lat && v.lon === lon);
    if (!registro) return;

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
        
        if (nom.startsWith("Dist ")) nom = "Dist. " + nom.replace("Dist ", "").replace(" m", "");
        if (v === "Vulnerabilidad_Agua_num") nom = "Vuln. Agua";

        let cuadro = crearCuadro(nom, val, v);
        if (extra) cuadro = cuadro.replace("</strong>", "</strong>" + extra);
        html += cuadro;
    });

    document.getElementById("detalle-vivienda").innerHTML = html + `</div>`;
}