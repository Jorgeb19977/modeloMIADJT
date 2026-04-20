// =============================
// 1. CONFIGURACIÓN Y VARIABLES
// =============================
const variables = [
    "Dist_Metro_m", "Dist_Gastro_m", "Dist_Educa_m", "Dist_TM_m",
    "Dist_Parque_m", "Dist_Salud_m", "Dist_CC_m", "Ozono",
    "Indice_Ruido", "Peligrosidad_Delitos", "Cluster_Gastro_bin",
    "Cluster_Salud_bin", "Cluster_Parques_bin", "Vulnerabilidad_Agua_num",
    "Estrato_Manzana_score"
];

let centroides = [];
let viviendas = [];
let map, map2, capaPuntos, capaPuntos2;

// =============================
// 2. INICIALIZACIÓN
// =============================
document.addEventListener("DOMContentLoaded", function () {
    // Mapa 1
    map = L.map('map').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    capaPuntos = L.layerGroup().addTo(map);

    // Mapa 2
    map2 = L.map('map2').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map2);
    capaPuntos2 = L.layerGroup().addTo(map2);

    // Crear Sliders
    const container = document.getElementById("variables");
    variables.forEach(v => {
        container.innerHTML += `
            <label><b>${v}</b></label><br>
            Slider: <input type="range" id="${v}_slider" min="0" max="1000" value="0">
            Manual: <input type="number" id="${v}_manual" value="0"><br><br>
        `;
    });

    // Cargar Datos
    Promise.all([
        fetch("centroides.json").then(r => r.json()),
        fetch("data32GH.json").then(r => r.json())
    ]).then(([dataC, dataV]) => {
        centroides = dataC;
        viviendas = dataV;
        console.log("Datos cargados: ", viviendas.length, "viviendas.");
    }).catch(err => console.error("Error cargando JSON:", err));

    crearLeyenda();
});

// =============================
// 3. FUNCIONES DE APOYO
// =============================
function colorScore(score, minScore, maxScore) {
    let x = (score - minScore) / (maxScore - minScore);
    if (isNaN(x)) x = 0;
    if (x <= 0.1) return "#000080";
    if (x <= 0.2) return "#0000FF";
    if (x <= 0.3) return "#4169E1";
    if (x <= 0.4) return "#1E90FF";
    if (x <= 0.5) return "#87CEEB";
    if (x <= 0.6) return "#FFCCCC";
    if (x <= 0.7) return "#FF9999";
    if (x <= 0.8) return "#FF6666";
    if (x <= 0.9) return "#FF0000";
    return "#8B0000";
}

function crearLeyenda() {
    let legend = L.control({position: "bottomright"});
    legend.onAdd = function () {
        let div = L.DomUtil.create("div", "info legend");
        div.style.cssText = "background:white; padding:10px; border:1px solid #ccc; line-height:1.5em;";
        div.innerHTML = `
            <b>Escala Score</b><br>
            <i style="background:#000080; width:12px; height:12px; display:inline-block"></i> 0.0 - 0.1 (Mejor)<br>
            <i style="background:#8B0000; width:12px; height:12px; display:inline-block"></i> 0.9 - 1.0 (Peor)
        `;
        return div;
    };
    legend.addTo(map);
}

// =============================
// 4. LÓGICA PRINCIPAL
// =============================
function calcular() {
    if (viviendas.length === 0 || centroides.length === 0) {
        alert("Los datos aún no han cargado.");
        return;
    }

    // A. Capturar Pesos del Usuario
    let user_weights = variables.map(v => {
        let s = document.getElementById(v + "_slider").value;
        let m = document.getElementById(v + "_manual").value;
        return (parseFloat(m) > 0 ? parseFloat(m) : parseFloat(s)) / 1000;
    });

    // B. Capturar Datos Económicos
    const ingresos = parseFloat(document.getElementById("ingresos").value) || 0;
    const ahorros = parseFloat(document.getElementById("ahorros").value) || 0;
    const gastos = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ingresos - ahorros - gastos) * 0.733;

    // C. Analizar Clusters
    let infoClusters = centroides.map((cluster, index) => {
        let suma = variables.reduce((acc, v, i) => acc + (user_weights[i] * Math.pow(cluster[v], 2)), 0);
        let sCluster = Math.sqrt(suma);
        
        let vEnCluster = viviendas.filter(v => v.Clusters === index);
        let totalScoreE = vEnCluster.reduce((acc, v) => acc + (Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0), 0);

        return {
            id: index,
            scoreCluster: sCluster,
            cantidadPuntos: vEnCluster.length,
            scoreE_Promedio: vEnCluster.length > 0 ? (totalScoreE / vEnCluster.length) : 999
        };
    });

    // D. Obtener Top 10
    let top10Clusters = [...infoClusters]
        .sort((a, b) => a.scoreCluster - b.scoreCluster)
        .slice(0, 10);

    // E. Renderizar Tabla 1
    let htmlTabla1 = `<table border="1" style="width:100%; text-align:left; border-collapse:collapse;">
        <tr style="background:#eee;"><th>Cluster</th><th>Puntos</th><th>Score Cluster</th><th>Score Econ. Prom</th></tr>`;
    top10Clusters.forEach(c => {
        htmlTabla1 += `<tr><td>${c.id}</td><td>${c.cantidadPuntos}</td><td>${c.scoreCluster.toFixed(4)}</td><td>${c.scoreE_Promedio.toFixed(4)}</td></tr>`;
    });
    document.getElementById("tabla-clusters").innerHTML = htmlTabla1 + `</table>`;

    // F. Actualizar Mapas
    capaPuntos.clearLayers();
    capaPuntos2.clearLayers();

    let idsTop10 = top10Clusters.map(c => c.id);
    let minS = top10Clusters[0].scoreCluster;
    let maxS = top10Clusters[top10Clusters.length - 1].scoreCluster;

    viviendas.forEach(p => {
        let sc = infoClusters[p.Clusters].scoreCluster;
        let col = colorScore(sc, minS, maxS);

        // Mapa 1: Todas las viviendas
        L.circleMarker([p.lat, p.lon], { radius: 2, color: col, fillOpacity: 0.6 }).addTo(capaPuntos);

        // Mapa 2: Solo Top 10 clusters
        if (idsTop10.includes(p.Clusters)) {
            L.circleMarker([p.lat, p.lon], {
                radius: 3,
                color: p.Clusters === top10Clusters[0].id ? "gold" : "blue",
                fillOpacity: 0.7,
                weight: 1
            }).addTo(capaPuntos2);
        }
    });

    // G. Tabla 2: Top 5 viviendas del mejor cluster
    let mejorClusterId = top10Clusters[0].id;
    let vMejorCluster = viviendas
        .filter(v => v.Clusters === mejorClusterId)
        .map(v => ({ ...v, sEAbs: Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 999 }))
        .sort((a, b) => a.sEAbs - b.sEAbs)
        .slice(0, 5);

    let htmlTabla2 = `<table border="1" style="width:100%; text-align:left; border-collapse:collapse;">
        <tr style="background:#ffd700;"><th>Latitud</th><th>Longitud</th><th>Precio</th><th>Score Económico Abs.</th></tr>`;
    vMejorCluster.forEach(v => {
        htmlTabla2 += `<tr><td>${v.lat}</td><td>${v.lon}</td><td>$${v.Precio.toLocaleString()}</td><td>${v.sEAbs.toFixed(4)}</td></tr>`;
    });
    document.getElementById("tabla-viviendas").innerHTML = htmlTabla2 + `</table>`;

    document.getElementById("resultado").innerHTML = "Cálculo finalizado. Capacidad adquisitiva (Ca): $" + Ca.toLocaleString();
}