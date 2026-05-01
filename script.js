// ==========================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ==========================================
let limitesGlobales = {};
let centroides = [];
let viviendas = [];
let map, map2A, map2B; 
let capaPuntos, capaPuntos2A, capaPuntos2B, capaResaltado;
let ultimoResultadoClusters = []; 
let scoresPorClusterId = {}; 

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
    map = L.map('map').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    capaPuntos = L.layerGroup().addTo(map);
    capaResaltado = L.layerGroup().addTo(map);

    map2A = L.map('map2A', { zoomControl: false }).setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2A);
    capaPuntos2A = L.layerGroup().addTo(map2A);

    map2B = L.map('map2B').setView([4.65, -74.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2B);
    capaPuntos2B = L.layerGroup().addTo(map2B);

    const container = document.getElementById("variables");
    variables.forEach((v, index) => {
        const div = document.createElement("div");
        div.className = "variable-item";
        div.draggable = true;
        div.id = v;
        // Estructura limpia para asegurar que el input acompañe siempre a la variable
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; pointer-events: none;">
                <span style="pointer-events: none;"><span style="margin-right: 10px; color: #888;">☰</span> <b>${v.replace(/_/g, ' ')}</b></span>
                <input type="number" class="puntos-input" value="${pesosPredefinidos[index]}" 
                       style="width: 55px; pointer-events: auto;" 
                       onclick="event.stopPropagation();">
            </div>
        `;
        
        div.ondragstart = (e) => {
            e.dataTransfer.setData("text/plain", e.target.id);
            e.target.classList.add("dragging");
        };
        div.ondragend = (e) => e.target.classList.remove("dragging");
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData("text");
            const draggedElement = document.getElementById(data);
            const targetElement = e.target.closest(".variable-item");
            if (targetElement && draggedElement !== targetElement) {
                const rect = targetElement.getBoundingClientRect();
                const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
                container.insertBefore(draggedElement, next ? targetElement.nextSibling : targetElement);
            }
        };
        container.appendChild(div);
    });

    Promise.all([
        fetch("centroides.json").then(r => r.json()),
        fetch("data32GH.json").then(r => r.json())
    ]).then(([dataC, dataV]) => {
        centroides = dataC;
        viviendas = dataV;
        calcularLimites(); 
        document.getElementById("resultado").innerText = "Datos cargados.";
    });
});

// ==========================================
// 3. FUNCIONES DE APOYO Y MODO PERSONALIZADO
// ==========================================
function togglePersonalizacion() {
    const container = document.getElementById("variables");
    container.classList.toggle("modo-personalizado");
    
    // Forzamos la visibilidad mediante JS por si el CSS falla
    const inputs = document.querySelectorAll(".puntos-input");
    const esActivo = container.classList.contains("modo-personalizado");
    
    inputs.forEach(input => {
        input.style.display = esActivo ? "block" : "none";
    });

    const btn = document.querySelector(".btn-personalizar");
    if (btn) {
        btn.innerText = esActivo ? "BLOQUEAR PUNTOS" : "PERSONALIZAR PUNTOS";
        btn.style.backgroundColor = esActivo ? "#28a745" : "#6c757d";
    }
}

function calcularLimites() {
    variables.forEach(v => {
        const valores = viviendas.map(reg => reg[v] || 0);
        limitesGlobales[v] = { min: Math.min(...valores), max: Math.max(...valores) };
    });
    const precios = viviendas.map(reg => reg.Precio || 0);
    limitesGlobales["Precio"] = { min: Math.min(...precios), max: Math.max(...precios) };
}

function colorScore(score, minScore, maxScore) {
    let x = (maxScore !== minScore) ? (score - minScore) / (maxScore - minScore) : 0;
    if (x <= 0.1) return "#000080";
    if (x <= 0.3) return "#1E90FF";
    if (x <= 0.5) return "#87CEEB";
    if (x <= 0.7) return "#FF9999";
    if (x <= 0.9) return "#FF0000";
    return "#8B0000";
}

function colorScoreEconomico(sE, maxSE) {
    let x = maxSE !== 0 ? sE / maxSE : 0;
    if (x <= 0.2) return "#0047FF"; 
    if (x <= 0.4) return "#00CCFF"; 
    if (x <= 0.6) return "#FFD700"; 
    if (x <= 0.8) return "#FF8C00"; 
    return "#FF0000";               
}

// ==========================================
// 4. CÁLCULO PRINCIPAL (CORREGIDO)
// ==========================================
function calcular() {
    if (viviendas.length === 0 || centroides.length === 0) return;

    // 1. Obtener el orden actual de los elementos en el DOM
    const elementosActuales = Array.from(document.querySelectorAll(".variable-item"));
    
    // 2. Crear un objeto donde asociaremos cada variable con el valor de SU input actual
    let mapaDePesos = {};
    elementosActuales.forEach((el) => {
        const idVariable = el.id;
        const valorInput = el.querySelector(".puntos-input").value;
        mapaDePesos[idVariable] = parseFloat(valorInput) || 0;
    });

    // 3. Generar el array de pesos siguiendo estrictamente el orden del array 'variables'
    const current_weights = variables.map(v => (mapaDePesos[v] || 0) / 1000);

    const ingresos = parseFloat(document.getElementById("ingresos").value) || 0;
    const ahorros = parseFloat(document.getElementById("ahorros").value) || 0;
    const gastos = parseFloat(document.getElementById("gastos").value) || 0;
    const Ca = (ingresos - ahorros - gastos) * 0.733;

    scoresPorClusterId = {};

    ultimoResultadoClusters = centroides.map((cluster, index) => {
        // El cálculo usa current_weights que ya está alineado con 'variables'
        let suma = variables.reduce((acc, v, i) => acc + (current_weights[i] * Math.pow(cluster[v] || 0, 2)), 0);
        let sCluster = Math.sqrt(suma);
        let vEnCluster = viviendas.filter(v => v.Clusters === index);
        let totalScoreE = vEnCluster.reduce((acc, v) => acc + (Ca !== 0 ? Math.abs((v.Precio - Ca) / Ca) : 0), 0);

        scoresPorClusterId[index] = sCluster;
        return {
            id: index,
            scoreCluster: sCluster,
            puntos: vEnCluster.length,
            scoreEProm: vEnCluster.length > 0 ? (totalScoreE / vEnCluster.length) : 0
        };
    }).sort((a, b) => a.scoreCluster - b.scoreCluster);

    renderizarVistasFiltradas();
    if (ultimoResultadoClusters.length > 0) filtrarMapa2(ultimoResultadoClusters[0].id);
    document.getElementById("resultado").innerText = "Cálculo actualizado.";
}

// ... (Resto de funciones: renderizarVistasFiltradas, filtrarMapa2, etc. se mantienen igual)