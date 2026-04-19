// VARIABLES DEL MODELO

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


// CREAR SLIDERS AUTOMATICAMENTE

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


// CARGAR CENTROIDES

let centroides = [];

fetch("centroides.json")

.then(response => response.json())

.then(data => {

centroides = data;

});


// FUNCION PRINCIPAL

function calcular() {

let user_weights = [];


variables.forEach(variable => {

let slider_value =
document.getElementById(variable + "_slider").value;

let manual_value =
document.getElementById(variable + "_manual").value;


// prioridad al manual si existe

let valor = manual_value > 0 ? manual_value : slider_value;


// dividir entre 1000

valor = valor / 1000;


user_weights.push(valor);

});


// CALCULO DE SCORES

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


// ORDENAR CLUSTERS (MENOR SCORE = MEJOR)

let ordenados = scores

.map((score, index) => ({cluster: index, score: score}))

.sort((a, b) => a.score - b.score);


// MOSTRAR TOP 5

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

}