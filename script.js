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
let map, capaPuntos;

// =============================
// 2. INICIALIZACIÓN (Solo ocurre una vez)
// =============================
document.addEventListener("DOMContentLoaded", function () {
    // Inicializar Mapa
    map = L.map('map').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    capaPuntos = L.layerGroup().addTo(map);

    // Crear Sliders
    const container = document.getElementById("variables");
    variables.forEach(v => {
        container.innerHTML += `
            <label>${v}</label><br>
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
        console.log("Datos cargados correctamente");
    });

    // Añadir Leyenda (UNA SOLA VEZ)
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
            <b>Escala de Recomendación</b><br>
            <i style="background:#000080; width:12px; height:12px; display:inline-block"></i> 0.0 - 0.1 (Mejor)<br>
            <i style="background:#87CEEB; width:12px; height:12px; display:inline-block"></i> 0.4 - 0.5<br>
            <i style="background:#FFCCCC; width:12px; height:12px; display:inline-block"></i> 0.5 - 0.6<br>
            <i style="background:#8B0000; width:12px; height:12px; display:inline-block"></i> 0.9 - 1.0 (Peor)
        `;
        return div;
    };
    legend.addTo(map);
}

// =============================
// 4. LÓGICA PRINCIPAL
// =============================
let map2, capaPuntos2;

// Dentro de tu DOMContentLoaded inicializa el segundo mapa:
document.addEventListener("DOMContentLoaded", function () {
    // ... (Inicialización del mapa 1) ...
    
    map2 = L.map('map2').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2);
    capaPuntos2 = L.layerGroup().addTo(map2);
});

function calcular() {
    // ... (Captura de pesos y cálculo de Ca que ya teníamos) ...
    const ingresos = parseFloat(document.getElementById("ingresos").value) || 0;
    const ahorros = parseFloat(document.getElementById("ahorros").value) || 0;
    const gastos = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ingresos - ahorros - gastos) * 0.733;

    if (viviendas.length === 0 || centroides.length === 0) return;

    // 1. Calcular scores base para todos los clusters
    let infoClusters = centroides.map((cluster, index) => {
        let suma = variables.reduce((acc, v, i) => acc + (user_weights[i] * Math.pow(cluster[v], 2)), 0);
        let sCluster = Math.sqrt(suma);
        
        // Filtrar viviendas de este cluster para sacar promedios económicos
        let viviendasEnCluster = viviendas.filter(v => v.Clusters === index);
        let totalScoreE = viviendasEnCluster.reduce((acc, v) => {
            let sE = Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0;
            return acc + sE;
        }, 0);

        return {
            id: index,
            scoreCluster: sCluster,
            cantidadPuntos: viviendasEnCluster.length,
            scoreE_Promedio: viviendasEnCluster.length > 0 ? (totalScoreE / viviendasEnCluster.length) : 0
        };
    });

    // 2. Ordenar y obtener los 10 mejores clusters
    let top10Clusters = [...infoClusters]
        .sort((a, b) => a.scoreCluster - b.scoreCluster)
        .slice(0, 10);

    // --- RENDERIZAR TABLA 1 ---
    let htmlTabla1 = `<table border="1"><tr><th>Cluster</th><th>Puntos</th><th>Score Cluster</th><th>Score Económico Prom.</th></tr>`;
    top10Clusters.forEach(c => {
        htmlTabla1 += `<tr><td>${c.id}</td><td>${c.cantidadPuntos}</td><td>${c.scoreCluster.toFixed(4)}</td><td>${c.scoreE_Promedio.toFixed(4)}</td></tr>`;
    });
    document.getElementById("tabla-clusters").innerHTML = htmlTabla1 + `</table>`;

    // 3. SEGUNDO MAPA: Graficar solo puntos de los 10 mejores clusters
    capaPuntos2.clearLayers();
    let idsTop10 = top10Clusters.map(c => c.id);
    
    viviendas.filter(v => idsTop10.includes(v.Clusters)).forEach(p => {
        L.circleMarker([p.lat, p.lon], {
            radius: 2,
            color: idsTop10.indexOf(p.Clusters) === 0 ? "gold" : "blue", // El mejor cluster en dorado
            fillOpacity: 0.5
        }).addTo(capaPuntos2);
    });

    // 4. TABLA 2: 5 puntos más recomendables del MEJOR cluster (el de scoreCluster más bajo)
    let mejorClusterId = top10Clusters[0].id;
    let viviendasMejorCluster = viviendas
        .filter(v => v.Clusters === mejorClusterId)
        .map(v => ({
            ...v,
            scoreEAbs: Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0
        }))
        .sort((a, b) => a.scoreEAbs - b.scoreEAbs) // De nuevo, el más cercano a 0 es mejor
        .slice(0, 5);

    let htmlTabla2 = `<table border="1"><tr><th>Lat</th><th>Lon</th><th>Precio</th><th>Score Económico Abs.</th></tr>`;
    viviendasMejorCluster.forEach(v => {
        htmlTabla2 += `<tr><td>${v.lat}</td><td>${v.lon}</td><td>$${v.Precio.toLocaleString()}</td><td>${v.scoreEAbs.toFixed(4)}</td></tr>`;
    });
    document.getElementById("tabla-viviendas").innerHTML = htmlTabla2 + `</table>`;
}