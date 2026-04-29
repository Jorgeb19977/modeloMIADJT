// ==========================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ==========================================
let limitesGlobales = {};
let centroides = [];
let viviendas = [];
let map, map2, capaPuntos, capaPuntos2, capaResaltado;

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
    // Inicializar Mapa 1
    map = L.map('map').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    capaPuntos = L.layerGroup().addTo(map);
    capaResaltado = L.layerGroup().addTo(map);

    // Inicializar Mapa 2
    map2 = L.map('map2').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2);
    capaPuntos2 = L.layerGroup().addTo(map2);

    // Lista Arrastrable
    const container = document.getElementById("variables");
    variables.forEach((v) => {
        const div = document.createElement("div");
        div.className = "variable-item";
        div.id = v;
        div.draggable = true;
        div.innerHTML = `<span style="margin-right: 15px; color: #888;">☰</span> <b>${v.replace(/_/g, ' ')}</b>`;
        
        div.ondragstart = (e) => e.dataTransfer.setData("text", e.target.id);
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData("text");
            const dragged = document.getElementById(data);
            const target = e.target.closest(".variable-item");
            if (target && dragged !== target) container.insertBefore(dragged, target);
        };
        container.appendChild(div);
    });

    // Carga de JSONs
    Promise.all([
        fetch("centroides.json").then(r => r.json()),
        fetch("data32GH.json").then(r => r.json())
    ]).then(([dataC, dataV]) => {
        centroides = dataC;
        viviendas = dataV;
        calcularLimites();
        document.getElementById("resultado").innerText = "Datos cargados. Configure pesos y calcule.";
    }).catch(err => console.error("Error al cargar datos:", err));
});

// ==========================================
// 3. FUNCIONES DE APOYO
// ==========================================
function calcularLimites() {
    variables.forEach(v => {
        const vals = viviendas.map(r => r[v] || 0);
        limitesGlobales[v] = { min: Math.min(...vals), max: Math.max(...vals) };
    });
    const precios = viviendas.map(r => r.Precio || 0);
    limitesGlobales["Precio"] = { min: Math.min(...precios), max: Math.max(...precios) };
}

function colorScore(score, minS, maxS) {
    let x = (score - minS) / (maxS - minS);
    if (isNaN(x)) x = 0;
    if (x <= 0.1) return "#000080";
    if (x <= 0.3) return "#1E90FF";
    if (x <= 0.5) return "#87CEEB";
    if (x <= 0.7) return "#FF9999";
    if (x <= 0.9) return "#FF0000";
    return "#8B0000";
}

function resaltarClusterEnMapa1(clusterId) {
    capaResaltado.clearLayers();
    const pts = viviendas.filter(v => v.Clusters === clusterId);
    if (pts.length > 0) {
        const lats = pts.map(p => p.lat);
        const lons = pts.map(p => p.lon);
        const bounds = [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
        L.rectangle(bounds, {color: "red", weight: 2, fillOpacity: 0, dashArray: "5,5"}).addTo(capaResaltado);
    }
}

function quitarResaltado() { capaResaltado.clearLayers(); }

// ==========================================
// 4. CALCULAR
// ==========================================
function calcular() {
    if (viviendas.length === 0) return;

    const lista = Array.from(document.querySelectorAll(".variable-item")).map(el => el.id);
    let mapaPesos = {};
    lista.forEach((v, i) => mapaPesos[v] = pesosPredefinidos[i] / 1000);
    const currentWeights = variables.map(v => mapaPesos[v] || 0);

    const ing = parseFloat(document.getElementById("ingresos").value) || 0;
    const aho = parseFloat(document.getElementById("ahorros").value) || 0;
    const gas = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ing - aho - gas) * 0.733;

    let infoClusters = centroides.map((c, idx) => {
        let suma = variables.reduce((acc, v, i) => acc + (currentWeights[i] * Math.pow(c[v] || 0, 2)), 0);
        let sc = Math.sqrt(suma);
        let vEnC = viviendas.filter(v => v.Clusters === idx);
        let totalE = vEnC.reduce((acc, v) => acc + (Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0), 0);
        return { id: idx, scoreCluster: sc, puntos: vEnC.length, scoreEProm: vEnC.length > 0 ? (totalE/vEnC.length) : 0 };
    });

    let ordenados = [...infoClusters].sort((a, b) => a.scoreCluster - b.scoreCluster);
    const minG = Math.min(...infoClusters.map(c => c.scoreCluster));
    const maxG = Math.max(...infoClusters.map(c => c.scoreCluster));

    // MAPA 1
    capaPuntos.clearLayers();
    viviendas.forEach(p => {
        let col = colorScore(infoClusters[p.Clusters].scoreCluster, minG, maxG);
        let m = L.circleMarker([p.lat, p.lon], { radius: 2, color: col, stroke: false, fillOpacity: 0.6 });
        
        m.on('click', () => {
            filtrarMapa2(p.Clusters);
            document.getElementById("tabla-viviendas").scrollIntoView({behavior: 'smooth'});
        });
        m.on('mouseover', () => resaltarClusterEnMapa1(p.Clusters));
        m.on('mouseout', () => quitarResaltado());
        
        m.addTo(capaPuntos);
    });

    // TABLA 1
    let h1 = `<table border="1" style="width:100%; border-collapse:collapse;"><tr style="background:#eee; position:sticky; top:0;"><th>Cluster</th><th>Puntos</th><th>Score</th><th>Econ</th></tr>`;
    ordenados.forEach(c => {
        h1 += `<tr onclick="filtrarMapa2(${c.id})" onmouseover="resaltarClusterEnMapa1(${c.id})" onmouseout="quitarResaltado()" style="cursor:pointer;">
                <td style="color:blue;"><b>C-${c.id}</b></td><td>${c.puntos}</td><td>${c.scoreCluster.toFixed(3)}</td><td>${c.scoreEProm.toFixed(3)}</td></tr>`;
    });
    document.getElementById("tabla-clusters").innerHTML = h1 + `</table>`;

    filtrarMapa2(ordenados[0].id);
}

// ==========================================
// 5. FILTRAR MAPA 2
// ==========================================
function filtrarMapa2(cid) {
    capaPuntos2.clearLayers();
    const ing = parseFloat(document.getElementById("ingresos").value) || 0;
    const aho = parseFloat(document.getElementById("ahorros").value) || 0;
    const gas = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ing - aho - gas) * 0.733;

    let vF = viviendas.filter(v => v.Clusters === cid)
        .map(v => ({ ...v, sE: Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0 }))
        .sort((a, b) => a.sE - b.sE);

    let h2 = `<table border="1" style="width:100%; border-collapse:collapse;"><tr style="background:#ffd700; position:sticky; top:0;"><th>#</th><th>Precio</th><th>Score E.</th><th>Acción</th></tr>`;
    vF.forEach((v, i) => {
        h2 += `<tr><td>${i+1}</td><td>$${v.Precio.toLocaleString()}</td><td>${v.sE.toFixed(4)}</td>
               <td><button onclick="hacerZoomVivienda(${v.lat}, ${v.lon}, ${v.Precio})">📍 Ver</button></td></tr>`;
    });
    document.getElementById("tabla-viviendas").innerHTML = h2 + `</table>`;

    vF.forEach((p, i) => {
        let m = L.circleMarker([p.lat, p.lon], { radius: 8, color: "blue", fillOpacity: 0.8, weight: 2 }).addTo(capaPuntos2);
        m.bindTooltip(`${i+1}`, {permanent: true, direction: 'center', className: 'etiqueta-numero'});
        m.viviendaID = `${p.lat}-${p.lon}`;
    });

    if (vF.length > 0) map2.fitBounds(new L.featureGroup(capaPuntos2.getLayers()).getBounds());
}

// ==========================================
// 6. ZOOM Y FICHA
// ==========================================
function hacerZoomVivienda(lat, lon, precio) {
    map2.setView([lat, lon], 17);
    capaPuntos2.eachLayer(l => {
        if (l.viviendaID === `${lat}-${lon}`) {
            l.setStyle({ color: 'orange', weight: 6, radius: 12 });
            l.bringToFront();
        } else {
            l.setStyle({ color: 'blue', weight: 2, radius: 8 });
        }
    });

    const reg = viviendas.find(v => v.lat === lat && v.lon === lon);
    if (!reg) return;

    const nombres = { "Dist_CC_m": "CC_Cercano", "Dist_Metro_m": "Metro_Ref", "Dist_Gastro_m": "Gastro_Cercano", "Dist_Educa_m": "Educa", "Dist_TM_m": "Estacion_TM_Cercana", "Vulnerabilidad_Agua_num": "Vulnerabilidad_Agua" };

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; padding: 10px;">`;
    
    const cuadro = (lab, val, k) => {
        const lim = limitesGlobales[k] || { min: 0, max: 1 };
        let p = Math.max(0, Math.min(100, ((val - lim.min) / (lim.max - lim.min)) * 100));
        return `<div style="background:#fff; padding:8px; border:1px solid #eee; border-radius:4px; min-height:80px; display:flex; flex-direction:column; justify-content:space-between;">
            <div><small style="color:#777; font-size:0.6rem; text-transform:uppercase;">${lab}:</small><br>
            <strong style="font-size:0.85rem;">${typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(1) : val.toLocaleString()}</strong></div>
            <div style="width:100%; height:4px; background:#eee; margin-top:5px;"><div style="width:${p}%; height:100%; background:#4caf50;"></div></div></div>`;
    };

    html += cuadro("PRECIO TOTAL", reg.Precio, "Precio");
    variables.forEach(v => {
        let n = v.replace(/_/g, ' '), val = reg[v], ext = "";
        if (v === "Estrato_Manzana_score") { n = "Estrato"; val = reg["Estrato_Manzana"]; }
        else if (nombres[v] && reg[nombres[v]]) ext = `<br><span style="color:#2e7d32; font-size:0.65rem; font-weight:bold;">${reg[nombres[v]]}</span>`;
        if (n.startsWith("Dist ")) n = "Dist. " + n.replace("Dist ", "").replace(" m", "");
        let c = cuadro(n, val, v);
        if (ext) c = c.replace("</strong>", "</strong>" + ext);
        html += c;
    });
    document.getElementById("detalle-vivienda").innerHTML = html + `</div>`;
}