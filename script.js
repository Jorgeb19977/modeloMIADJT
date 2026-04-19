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

});


// =============================
// MAPA BASE BOGOTÁ
// =============================

let map = L.map('map').setView([4.65, -74.1], 11);

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom: 18
}
).addTo(map);


// CAPA PARA PUNTOS DINÁMICOS

let capaPuntos = L.layerGroup().addTo(map);


// =============================
// COLORES AUTOMÁTICOS POR CLUSTER
// =============================

function colorCluster(cluster){

const colores = [

"red",
"blue",
"green",
"purple",
"orange",
"brown",
"black",
"pink",
"cyan",
"yellow"

];

return colores[cluster % colores.length];

}


// =============================
// FUNCION PRINCIPAL MODELO
// =============================

function calcular() {


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

let color = colorCluster(punto.Clusters);

let tamaño = 4;


// resaltar cluster recomendado

if(punto.Clusters === mejorCluster){

color = "gold";

tamaño = 7;

}


L.circleMarker([punto.lat, punto.lon], {

radius: tamaño,

color: color,

fillOpacity: 0.7

}).addTo(capaPuntos);

});


}