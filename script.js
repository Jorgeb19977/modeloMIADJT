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
const pesosPredefinidos = [183, 179, 176, 88, 86, 84, 42, 41, 40, 20, 19, 18, 9, 8, 7];

document.addEventListener("DOMContentLoaded", function () {
    // Inicializar Mapas (esto se queda igual)
    map = L.map('map').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    capaPuntos = L.layerGroup().addTo(map);

    map2 = L.map('map2').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2);
    capaPuntos2 = L.layerGroup().addTo(map2);

    // Generar Lista Arrastrable
    const container = document.getElementById("variables");
    variables.forEach((v, index) => {
        const div = document.createElement("div");
        div.className = "variable-item";
        div.draggable = true;
        div.id = v;
        div.style = "padding: 10px; margin: 5px; background: white; border: 1px solid #bbb; cursor: grab; display: flex; align-items: center; border-radius: 4px;";
        div.innerHTML = `<span style="margin-right: 15px; color: #888;">☰</span> <b>${v}</b>`;
        
        // Eventos para arrastrar
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

    // Cargar Archivos JSON (igual)
    Promise.all([
        fetch("centroides.json").then(r => r.json()),
        fetch("data32GH.json").then(r => r.json())
    ]).then(([dataC, dataV]) => {
        centroides = dataC;
        viviendas = dataV;
        document.getElementById("resultado").innerText = "Datos listos. Ordena las variables y calcula.";
    });
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

// =============================
// 4. LÓGICA PRINCIPAL
// =============================
function calcular() {
    if (viviendas.length === 0 || centroides.length === 0) {
        alert("Los datos aún no están listos.");
        return;
    }

    // A. CAPTURAR PESOS SEGÚN EL ORDEN DE LA LISTA
    const pesosPredefinidos = [183, 179, 176, 88, 86, 84, 42, 41, 40, 20, 19, 18, 9, 8, 7];
    
    // 1. Obtenemos el orden actual de las IDs desde el contenedor de la lista
    const listaOrdenada = Array.from(document.querySelectorAll(".variable-item")).map(el => el.id);
    
    // 2. Creamos un mapa temporal para saber qué peso le toca a cada nombre de variable
    let mapaDePesos = {};
    listaOrdenada.forEach((nombreVar, index) => {
        // Asignamos el peso según la posición (index) en la lista
        mapaDePesos[nombreVar] = pesosPredefinidos[index]; 
    });

    // 3. Generamos el array 'current_weights' respetando el orden original de la constante 'variables'
    // Esto es CRÍTICO para que el cálculo matemático coincida con las columnas de tus JSON
    const current_weights = variables.map(v => (mapaDePesos[v] || 0) / 1000);

    // B. CAPTURAR DATOS ECONÓMICOS
    const ingresos = parseFloat(document.getElementById("ingresos").value) || 0;
    const ahorros = parseFloat(document.getElementById("ahorros").value) || 0;
    const gastos = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ingresos - ahorros - gastos) * 0.733;

    // C. CALCULAR SCORES POR CLUSTER
    let infoClusters = centroides.map((cluster, index) => {
        let suma = variables.reduce((acc, v, i) => {
            let valCentroide = cluster[v] || 0;
            // Usamos los nuevos pesos calculados por posición
            return acc + (current_weights[i] * Math.pow(valCentroide, 2));
        }, 0);
        
        let sCluster = Math.sqrt(suma);
        let vEnCluster = viviendas.filter(v => v.Clusters === index);
        
        let totalScoreE = vEnCluster.reduce((acc, v) => {
            let sE = Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0;
            return acc + sE;
        }, 0);

        return {
            id: index,
            scoreCluster: sCluster,
            puntos: vEnCluster.length,
            scoreEProm: vEnCluster.length > 0 ? (totalScoreE / vEnCluster.length) : 0
        };
    });

    // --- (De aquí en adelante, el resto de tu código D, E, F y G se mantiene igual) ---
    // D. ORDENAR TOP 10
    let top10 = [...infoClusters].sort((a, b) => a.scoreCluster - b.scoreCluster).slice(0, 10);

    const todosLosScores = infoClusters.map(c => c.scoreCluster);
    const minGlobal = Math.min(...todosLosScores);
    const maxGlobal = Math.max(...todosLosScores);

    // E. LIMPIAR Y PINTAR MAPAS
    capaPuntos.clearLayers();
    capaPuntos2.clearLayers();
    const idsTop10 = top10.map(c => c.id);

    viviendas.forEach(p => {
        let sc = infoClusters[p.Clusters].scoreCluster;
        let col = colorScore(sc, minGlobal, maxGlobal);
        L.circleMarker([p.lat, p.lon], { radius: 2, color: col, stroke: false, fillOpacity: 0.6 }).addTo(capaPuntos);
        if (idsTop10.includes(p.Clusters)) {
            L.circleMarker([p.lat, p.lon], { radius: 3, color: col, fillOpacity: 0.8, weight: 1, stroke: true }).addTo(capaPuntos2);
        }
    });

    // F. TABLA 1
    let h1 = `<table border="1" style="width:100%; border-collapse:collapse;"><tr style="background:#eee;"><th>Cluster (Clic para filtrar)</th><th>Puntos</th><th>Score Cluster</th><th>Econ. Prom</th></tr>`;
    top10.forEach(c => {
        h1 += `<tr style="cursor:pointer;" onclick="filtrarMapa2(${c.id})" onmouseover="this.style.backgroundColor='#f0f8ff'" onmouseout="this.style.backgroundColor='transparent'"><td style="color: blue; text-decoration: underline;"><b>Cluster ${c.id}</b></td><td>${c.puntos}</td><td>${c.scoreCluster.toFixed(4)}</td><td>${c.scoreEProm.toFixed(4)}</td></tr>`;
    });
    document.getElementById("tabla-clusters").innerHTML = h1 + `</table>`;

    // G. TABLA 2
    let mejorClusterId = top10[0].id;
    let vMejor = viviendas.filter(v => v.Clusters === mejorClusterId)
        .map(v => ({ ...v, sE: Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0 }))
        .sort((a, b) => a.sE - b.sE).slice(0, 5);

    let h2 = `<table border="1" style="width:100%; border-collapse:collapse;"><tr style="background:#ffd700;"><th>Precio</th><th>Score Económico Abs</th></tr>`;
    vMejor.forEach(v => { h2 += `<tr><td>$${v.Precio.toLocaleString()}</td><td>${v.sE.toFixed(4)}</td></tr>`; });

    document.querySelector("h3:last-of-type").innerText = "Top 5 Viviendas recomendadas (Mejor Cluster)";
    document.getElementById("tabla-viviendas").innerHTML = h2 + `</table>`;
    document.getElementById("resultado").innerText = "Cálculo completado con pesos jerárquicos. Ca: $" + Ca.toLocaleString();
}



// =============================
// 5. FUNCIÓN: FILTRAR MAPA 2
// =============================
function filtrarMapa2(clusterId) {
    capaPuntos2.clearLayers();
    const vFiltradas = viviendas.filter(v => v.Clusters === clusterId);

    const ingresos = parseFloat(document.getElementById("ingresos").value) || 0;
    const ahorros = parseFloat(document.getElementById("ahorros").value) || 0;
    const gastos = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ingresos - ahorros - gastos) * 0.733;

    // CAPTURAR PESOS ACTUALES
    const pesosPredefinidos = [183, 179, 176, 88, 86, 84, 42, 41, 40, 20, 19, 18, 9, 8, 7];
    const listaOrdenada = Array.from(document.querySelectorAll(".variable-item")).map(el => el.id);
    let mapaDePesos = {};
    listaOrdenada.forEach((nombreVar, index) => {
        mapaDePesos[nombreVar] = pesosPredefinidos[index] / 1000;
    });
    const current_weights = variables.map(v => mapaDePesos[v] || 0);

    // COLOR DEL CLUSTER
    const clusterData = centroides[clusterId];
    let sumaC = variables.reduce((acc, v, i) => acc + (current_weights[i] * Math.pow(clusterData[v] || 0, 2)), 0);
    let sc = Math.sqrt(sumaC);
    const todosLosScores = centroides.map(c => {
        let s = variables.reduce((acc, v, i) => acc + (current_weights[i] * Math.pow(c[v] || 0, 2)), 0);
        return Math.sqrt(s);
    });
    const col = colorScore(sc, Math.min(...todosLosScores), Math.max(...todosLosScores));

    // ORDENAR TODAS LAS VIVIENDAS (Sin .slice)
    let vOrdenadas = vFiltradas
        .map(v => ({ ...v, sE: Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0 }))
        .sort((a, b) => a.sE - b.sE);

    // GENERAR TABLA (Añadimos un div con scroll en el paso siguiente)
    let h2 = `<table border="1" style="width:100%; border-collapse:collapse;">
                <tr style="background:#ffd700; position: sticky; top: 0;">
                    <th>#</th>
                    <th>Precio</th>
                    <th>Score Económico Abs</th>
                    <th>Acción</th>
                </tr>`;
    
    vOrdenadas.forEach((v, i) => {
        const num = i + 1;
        h2 += `<tr>
                <td><b>${num}</b></td>
                <td>$${v.Precio.toLocaleString()}</td>
                <td>${v.sE.toFixed(4)}</td>
                <td><button onclick="hacerZoomVivienda(${v.lat}, ${v.lon}, ${v.Precio})">📍 Ver</button></td>
               </tr>`;
    });

    document.querySelector("h3:last-of-type").innerText = `Todas las Viviendas del Cluster ${clusterId} (${vOrdenadas.length} encontradas)`;
    
    // Envolvemos la tabla en un div con scroll para que no sea infinita la página
    document.getElementById("tabla-viviendas").innerHTML = `<div style="max-height: 400px; overflow-y: auto; border: 1px solid #ccc;">${h2}</table></div>`;

    // DIBUJAR TODOS LOS PUNTOS EN MAPA 2
    vOrdenadas.forEach((p, i) => {
        const num = i + 1;
        let marcador = L.circleMarker([p.lat, p.lon], {
            radius: 9, 
            color: col,
            fillOpacity: 0.9,
            weight: 2,
            stroke: true
        }).addTo(capaPuntos2);

        marcador.bindTooltip(`${num}`, {
            permanent: true, 
            direction: 'center',
            className: 'etiqueta-numero'
        }).bindPopup(`<b>Vivienda #${num}</b><br>Precio: $${p.Precio.toLocaleString()}`);
    });

    if (vOrdenadas.length > 0) {
        const grupo = new L.featureGroup(capaPuntos2.getLayers());
        map2.fitBounds(grupo.getBounds(), { padding: [30, 30] });
    }
}

function hacerZoomVivienda(lat, lon, precio) {
    map2.setView([lat, lon], 16); // Zoom cercano
    L.popup()
        .setLatLng([lat, lon])
        .setContent(`<b>Vivienda Seleccionada</b><br>Precio: $${precio.toLocaleString()}`)
        .openOn(map2);
}