// =============================
// VARIABLES DEL MODELO
// =============================

const variables = [

"Dist_Metro_m",
"Dist_Gastro_m",
"Dist_Educa_m",
"Dist_TM_m",
"Dist_Parque_m",
"Dist_Salud_m",
"Dist_CC_m",
"Ozono",
"Indice_Ruido",
"Peligrosidad_Delitos",
"Cluster_Gastro_bin",
"Cluster_Salud_bin",
"Cluster_Parques_bin",
"Vulnerabilidad_Agua_num",
"Estrato_Manzana_score"

];


// =============================
// CREAR SLIDERS AUTOMATICAMENTE
// =============================

const container = document.getElementById("variables");

variables.forEach(variable => {

container.innerHTML += `

<label>${variable}</label><br>

Slider:
<input type="range" id="${variable}_slider" min="0" max="1000" value="0">

Manual:
<input type="number" id="${variable}_manual" value="0">

<br><br>

`;

});


// =============================
// CARGAR CENTROIDES
// =============================

let centroides = [];

fetch("centroides.json")

.then(response => response.json())

.then(data => {

centroides = data;

});


// =============================
// CARGAR DATASET VIVIENDAS
// =============================

let viviendas = [];

fetch("data32GH.json")

.then(response => response.json())

.then(data => {

viviendas = data;

console.log("Dataset cargado:", viviendas.length);
console.log("Primer punto:", viviendas[0]);

});


// =============================
// MAPA BASE BOGOTÁ
// =============================

let map;
let capaPuntos;

document.addEventListener("DOMContentLoaded", function () {

map = L.map('map').setView([4.65, -74.1], 11);

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom: 18
}
).addTo(map);

capaPuntos = L.layerGroup().addTo(map);

});

let legend = L.control({position: "bottomright"});

legend.onAdd = function () {

let div = L.DomUtil.create("div", "info legend");

div.innerHTML =
"<b>Cluster score</b><br>" +
"<i style='background:blue'></i> 1<br>" +
"<i style='background:purple'></i> 0.5<br>" +
"<i style='background:red'></i> 0";

return div;

};

legend.addTo(map);

// =============================
// COLORES AUTOMÁTICOS POR CLUSTER
// =============================

function colorCluster(cluster){

// escala azul → rojo según número de cluster

let maxClusters = centroides.length - 1;

let ratio = cluster / maxClusters;

let hue = (1 - ratio) * 240; // azul=240 rojo=0

return `hsl(${hue}, 100%, 50%)`;

}

// =============================
function colorScore(score, minScore, maxScore){

// normalización 0–1
let x = (score - minScore) / (maxScore - minScore);

// centrar en 0
x = (x - 0.5) * 2;

// limitar rango
x = Math.max(-1, Math.min(1, x));

let r, g, b;

if (x < 0) {

// AZUL OSCURO → AZUL CLARO (sin blanco)

let t = (x + 1); // 0 → 1

r = Math.floor(10 + 120 * t);   // 10 → 130
g = Math.floor(40 + 160 * t);   // 40 → 200
b = Math.floor(120 + 135 * t);  // 120 → 255

} else {

// AZUL MUY CLARO → ROJO

let t = x; // 0 → 1

r = Math.floor(130 + 125 * t);  // 130 → 255
g = Math.floor(200 - 200 * t);  // 200 → 0
b = Math.floor(255 - 255 * t);  // 255 → 0

}

return `rgb(${r},${g},${b})`;
}

// =============================
// FUNCION PRINCIPAL MODELO
// =============================

function calcular() {

if (!map) {

alert("Mapa aún cargando. Intenta nuevamente.");

return;

}

if (viviendas.length === 0) {

alert("Dataset aún no cargado");

return;

}

// LIMPIAR MAPA

capaPuntos.clearLayers();


// =============================
// CAPTURAR PESOS USUARIO
// =============================

let user_weights = [];

variables.forEach(variable => {

let slider_value =
document.getElementById(variable + "_slider").value;

let manual_value =
document.getElementById(variable + "_manual").value;


let valor = manual_value > 0 ? manual_value : slider_value;

valor = valor / 1000;

user_weights.push(valor);

});


// =============================
// CALCULAR SCORES POR CLUSTER
// =============================

let scores = [];



centroides.forEach(cluster => {

let suma = 0;

variables.forEach((variable, index) => {

let centroide_valor = cluster[variable];

suma += user_weights[index] * Math.pow(centroide_valor, 2);

});

let score = Math.sqrt(suma);

scores.push(score);

});


let minScore = Math.min(...scores);
let maxScore = Math.max(...scores);

// =============================
// ORDENAR CLUSTERS
// =============================

let ordenados = scores

.map((score, index) => ({cluster: index, score: score}))

.sort((a, b) => a.score - b.score);


// =============================
// MOSTRAR RESULTADOS TEXTO
// =============================

let resultado = "Clusters recomendados:<br>";

for(let i = 0; i < 5; i++){

resultado +=

"Cluster " +

ordenados[i].cluster +

" | Score: " +

ordenados[i].score.toFixed(4) +

"<br>";

}

document.getElementById("resultado").innerHTML = resultado;


// =============================
// CLUSTER MÁS RECOMENDADO
// =============================

let mejorCluster = ordenados[0].cluster;


// =============================
// GRAFICAR VIVIENDAS EN MAPA
// =============================

viviendas.forEach(punto => {

let scoreCluster = scores[punto.Clusters];

let color = colorScore(
scoreCluster,
minScore,
maxScore
);

let tamaño = 0.1;




L.circleMarker([punto.lat, punto.lon], {

radius: tamaño,

color: color,

fillOpacity: 0.7

}).addTo(capaPuntos);

});

// =============================
// leyenda
// =============================
let legend = L.control({position: "bottomright"});

legend.onAdd = function () {

let div = L.DomUtil.create("div", "info legend");

div.innerHTML +=
"<b>Cluster score</b><br>" +
"<i style='background:blue'></i> 1<br>" +
"<i style='background:purple'></i> 0.5<br>" +
"<i style='background:red'></i> 0";

return div;

};

legend.addTo(map);


}