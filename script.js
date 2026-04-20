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
    // Inicializar Mapas
    map = L.map('map').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    capaPuntos = L.layerGroup().addTo(map);

    map2 = L.map('map2').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2);
    capaPuntos2 = L.layerGroup().addTo(map2);

    // Crear Sliders en el HTML
    const container = document.getElementById("variables");
    if (container) {
        variables.forEach(v => {
            container.innerHTML += `
                <div style="margin-bottom:10px;">
                    <label><b>${v}</b></label><br>
                    Slider: <input type="range" id="${v}_slider" min="0" max="1000" value="0" style="width:150px">
                    Manual: <input type="number" id="${v}_manual" value="0" style="width:60px">
                </div>`;
        });
    }

    // Cargar Datos JSON
    Promise.all([
        fetch("centroides.json").then(r => r.json()),
        fetch("data32GH.json").then(r => r.json())
    ]).then(([dataC, dataV]) => {
        centroides = dataC;
        viviendas = dataV;
        console.log("Datos cargados correctamente");
        const res = document.getElementById("resultado");
        if(res) res.innerText = "Datos listos. Ingresa tus valores y haz clic en Calcular.";
    }).catch(err => {
        console.error("Error cargando archivos:", err);
        alert("Error al cargar los archivos JSON. Revisa la consola.");
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

    // A. CAPTURAR PESOS (Aquí es donde estaba el error anterior)
    const current_weights = variables.map(v => {
        const sVal = document.getElementById(v + "_slider").value;
        const mVal = document.getElementById(v + "_manual").value;
        return (parseFloat(mVal) > 0 ? parseFloat(mVal) : parseFloat(sVal)) / 1000;
    });

    // B. CAPTURAR DATOS ECONÓMICOS
    const ingresos = parseFloat(document.getElementById("ingresos").value) || 0;
    const ahorros = parseFloat(document.getElementById("ahorros").value) || 0;
    const gastos = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ingresos - ahorros - gastos) * 0.733;

    // C. CALCULAR SCORES POR CLUSTER
    let infoClusters = centroides.map((cluster, index) => {
        // Usamos current_weights aquí adentro
        let suma = variables.reduce((acc, v, i) => {
            let valCentroide = cluster[v] || 0;
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

    // D. ORDENAR TOP 10
    let top10 = [...infoClusters].sort((a, b) => a.scoreCluster - b.scoreCluster).slice(0, 10);

    // --- NUEVO: Necesitamos el min y max GLOBAL para que los colores funcionen en todo el mapa ---
    const todosLosScores = infoClusters.map(c => c.scoreCluster);
    const minGlobal = Math.min(...todosLosScores);
    const maxGlobal = Math.max(...todosLosScores);

    // E. LIMPIAR Y PINTAR MAPAS
    capaPuntos.clearLayers();
    capaPuntos2.clearLayers();

    const idsTop10 = top10.map(c => c.id);

    viviendas.forEach(p => {
        // Obtenemos el score del cluster al que pertenece este punto
        let sc = infoClusters[p.Clusters].scoreCluster;
        
        // Mapa 1: Usamos la escala de azul a rojo con el rango GLOBAL
        let col = colorScore(sc, minGlobal, maxGlobal);

        L.circleMarker([p.lat, p.lon], { 
            radius: 2, 
            color: col, 
            stroke: false, 
            fillOpacity: 0.6 
        }).addTo(capaPuntos);

        // Mapa 2: Solo los 10 mejores clusters
        if (idsTop10.includes(p.Clusters)) {
            L.circleMarker([p.lat, p.lon], {
                radius: 3,
                // El mejor de todos en Dorado, el resto del top 10 en Azul para resaltar
                color: p.Clusters === top10[0].id ? "gold" : "#0000FF", 
                fillOpacity: 0.8,
                weight: 1,
                stroke: true
            }).addTo(capaPuntos2);
        }
    });

    // F. RENDERIZAR TABLAS (Actualizado para permitir clics)
    let h1 = `<table border="1" style="width:100%; border-collapse:collapse;">
                <tr style="background:#eee;">
                    <th>Cluster (Clic para filtrar Mapa 2)</th>
                    <th>Puntos</th>
                    <th>Score Cluster</th>
                    <th>Econ. Prom</th>
                </tr>`;
    
    top10.forEach(c => {
        // Añadimos 'onclick' y un estilo de cursor para que parezca un botón
        h1 += `
            <tr style="cursor:pointer;" onclick="filtrarMapa2(${c.id})" onmouseover="this.style.backgroundColor='#f0f8ff'" onmouseout="this.style.backgroundColor='transparent'">
                <td style="color: blue; text-decoration: underline;"><b>Cluster ${c.id}</b></td>
                <td>${c.puntos}</td>
                <td>${c.scoreCluster.toFixed(4)}</td>
                <td>${c.scoreEProm.toFixed(4)}</td>
            </tr>`;
    });
    document.getElementById("tabla-clusters").innerHTML = h1 + `</table><p><small><i>* Haz clic en una fila de la tabla para ver solo ese cluster en el Mapa 2.</i></small></p>`;

    let mejorClusterId = top10[0].id;
    let vMejor = viviendas.filter(v => v.Clusters === mejorClusterId)
        .map(v => ({ ...v, sE: Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0 }))
        .sort((a, b) => a.sE - b.sE).slice(0, 5);

    let h2 = `<table border="1" style="width:100%; border-collapse:collapse;">
                <tr style="background:#ffd700;"><th>Precio</th><th>Score Económico Abs</th></tr>`;
    vMejor.forEach(v => {
        h2 += `<tr><td>$${v.Precio.toLocaleString()}</td><td>${v.sE.toFixed(4)}</td></tr>`;
    });
    document.getElementById("tabla-viviendas").innerHTML = h2 + `</table>`;

    document.getElementById("resultado").innerText = "Cálculo completado. Ca: $" + Ca.toLocaleString();
}

// =============================
// 5. NUEVA FUNCIÓN: FILTRAR MAPA 2
// =============================
function filtrarMapa2(clusterId) {
    // 1. Limpiar el Mapa 2
    capaPuntos2.clearLayers();

    // 2. Filtrar solo las viviendas de ese cluster
    const vFiltradas = viviendas.filter(v => v.Clusters === clusterId);

    // 3. Dibujar los puntos en el Mapa 2
    vFiltradas.forEach(p => {
        L.circleMarker([p.lat, p.lon], {
            radius: 5,         // Un poco más grande para resaltar
            color: "gold",     // Color llamativo
            fillOpacity: 0.9,
            weight: 2,
            stroke: true
        }).bindPopup(`
            <b>Cluster Seleccionado: ${clusterId}</b><br>
            Precio: $${p.Precio.toLocaleString()}<br>
            Ubicación: ${p.lat}, ${p.lon}
        `).addTo(capaPuntos2);
    });

    // 4. Auto-zoom: Ajustar la cámara para ver todos los puntos del cluster
    if (vFiltradas.length > 0) {
        const grupo = new L.featureGroup(capaPuntos2.getLayers());
        map2.fitBounds(grupo.getBounds(), { padding: [20, 20] });
    } else {
        alert("No hay viviendas registradas en este cluster.");
    }
}