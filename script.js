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
function calcular() {
    if (!map || viviendas.length === 0) return alert("Cargando datos...");

    capaPuntos.clearLayers();

    // Capturar pesos
    let user_weights = variables.map(v => {
        let s = document.getElementById(v + "_slider").value;
        let m = document.getElementById(v + "_manual").value;
        return (m > 0 ? m : s) / 1000;
    });

    // Calcular Scores
    let scores = centroides.map(cluster => {
        let suma = variables.reduce((acc, v, i) => acc + (user_weights[i] * Math.pow(cluster[v], 2)), 0);
        return Math.sqrt(suma);
    });

    let minScore = Math.min(...scores);
    let maxScore = Math.max(...scores);

    // Resultados en texto
    let ordenados = scores.map((s, i) => ({cluster: i, score: s})).sort((a, b) => a.score - b.score);
    document.getElementById("resultado").innerHTML = "<b>Mejores Clusters:</b><br>" + 
        ordenados.slice(0, 5).map(o => `Cluster ${o.cluster} | Score: ${o.score.toFixed(4)}`).join("<br>");

    // Pintar Mapa
    viviendas.forEach(p => {
        L.circleMarker([p.lat, p.lon], {
            radius: 2, // Subí un poco el radio para que se vea
            color: colorScore(scores[p.Clusters], minScore, maxScore),
            fillOpacity: 0.7,
            stroke: false
        }).addTo(capaPuntos);
    });
}