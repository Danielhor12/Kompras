const API_URL = "TU_URL_DE_APPS_SCRIPT_AQUI"; // Pega tu URL de la nueva implementación aquí
let chartInstancia = null;

window.onload = () => {
    const token = localStorage.getItem('kompra_token');
    if (token) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        cambiarVista('mercado'); // Carga la primera vista por defecto
    }
};

function guardarToken() {
    const token = document.getElementById('token-input').value;
    if(!token) return;
    localStorage.setItem('kompra_token', token);
    location.reload(); 
}

function cerrarSesion() {
    localStorage.removeItem('kompra_token');
    location.reload();
}

// Router Interno
function cambiarVista(vistaTarget) {
    const vistas = ['mercado', 'platos', 'dashboard'];
    
    vistas.forEach(v => {
        // Ocultar todas las vistas
        document.getElementById(`vista-${v}`).classList.add('hidden');
        // Resetear colores del nav
        const btn = document.getElementById(`nav-${v}`);
        btn.classList.remove('text-blue-600');
        btn.classList.add('text-gray-400');
    });

    // Activar vista seleccionada
    document.getElementById(`vista-${vistaTarget}`).classList.remove('hidden');
    document.getElementById(`nav-${vistaTarget}`).classList.remove('text-gray-400');
    document.getElementById(`nav-${vistaTarget}`).classList.add('text-blue-600');

    const token = localStorage.getItem('kompra_token');

    // Orquestación de peticiones a Sheets
    if (vistaTarget === 'mercado') {
        document.getElementById('titulo-vista').innerText = 'Mercado';
        peticionLectura(token, 'Compras_Maestro', renderizarMercado);
    } 
    else if (vistaTarget === 'platos') {
        document.getElementById('titulo-vista').innerText = 'Recetas';
        peticionLectura(token, 'Plan_Semanal', renderizarPlatos);
    } 
    else if (vistaTarget === 'dashboard') {
        document.getElementById('titulo-vista').innerText = 'Resumen';
        peticionLectura(token, 'Compras_Maestro', renderizarDashboard);
    }
}

// Función maestra de lectura segura
async function peticionLectura(token, tabla, funcionRender) {
    try {
        const respuesta = await fetch(API_URL, {
            method: 'POST', 
            body: JSON.stringify({ action: 'read', token: token, tabla: tabla })
        });
        const datos = await respuesta.json();
        if(datos.error) return cerrarSesion();
        funcionRender(datos);
    } catch (error) {
        console.error("Error al cargar datos:", error);
    }
}

// Renders Específicos por Módulo
function renderizarMercado(items) {
    const contenedor = document.getElementById('lista-compras');
    contenedor.innerHTML = ''; 
    const activos = items.filter(item => item.Estado_Item === "En_Mercado" || item.Estado === "En_Mercado");
    
    if(activos.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-gray-400 mt-10">Todo comprado.</p>';
        return;
    }
    activos.forEach(item => {
        contenedor.innerHTML += `
            <div class="p-4 border rounded-xl shadow-sm bg-white flex justify-between items-center">
                <div>
                    <h3 class="font-bold">${item.Producto}</h3>
                    <p class="text-sm text-gray-500">${item.Cantidad} ${item.Unidad} • ${item.Categoría || item.Categoria}</p>
                </div>
            </div>
        `;
    });
}

function renderizarPlatos(platos) {
    const contenedor = document.getElementById('lista-platos');
    contenedor.innerHTML = '';
    
    if(!platos || platos.length === 0) {
        contenedor.innerHTML = '<p class="col-span-2 text-center text-gray-400 mt-10">No hay platos configurados en Sheets.</p>';
        return;
    }

    platos.forEach(plato => {
        // Asegúrate de que las columnas en tu Sheet 'Plan_Semanal' coincidan
        contenedor.innerHTML += `
            <div class="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm text-center">
                <span class="text-4xl mb-2">🍽️</span>
                <h4 class="font-bold text-gray-800 leading-tight mb-1">${plato.ID_Plato || plato.Nombre || "Receta"}</h4>
                <p class="text-xs text-blue-600 font-semibold">${plato.Dia || "Sin asignar"}</p>
            </div>
        `;
    });
}

function renderizarDashboard(items) {
    const gastosPorCategoria = {};
    
    // Sumarización algorítmica
    items.forEach(item => {
        if(item.Estado_Item === "Comprado" || item.Estado === "Comprado") {
            const cat = item.Categoría || item.Categoria || "Otros";
            const precio = parseFloat(item.Precio_Total || item.Precio) || 0;
            gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + precio;
        }
    });

    const categorias = Object.keys(gastosPorCategoria);
    const montos = Object.values(gastosPorCategoria);

    const ctx = document.getElementById('graficoGastos').getContext('2d');
    
    // Destruir instancia previa para evitar superposición de gráficos
    if(chartInstancia) chartInstancia.destroy(); 

    chartInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categorias.length ? categorias : ['Aún no hay compras'],
            datasets: [{
                data: montos.length ? montos : [1],
                backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// Controles del Modal de Inserción
function toggleModal(id) {
    document.getElementById(id).classList.toggle('hidden');
}

async function enviarProducto(event) {
    event.preventDefault(); 
    const boton = document.getElementById('btn-guardar');
    boton.innerText = '...';
    boton.disabled = true;

    const token = localStorage.getItem('kompra_token');
    
    const nuevoProducto = {
        action: 'insert',
        token: token,
        tabla: 'Compras_Maestro',
        ID_Compra: "CMP-" + Math.floor(Math.random() * 100000),
        Fecha: new Date().toLocaleDateString('es-PE'),
        Rango: "N/A",
        Producto: document.getElementById('input-producto').value,
        Cantidad: document.getElementById('input-cantidad').value,
        Unidad: document.getElementById('input-unidad').value,
        Categoria: document.getElementById('input-categoria').value,
        Para: "Ambos",
        Estado: "En_Mercado",
        Precio: 0,
        Quien_Pago: "Pendiente"
    };

    try {
        const respuesta = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(nuevoProducto)
        });
        const resultado = await respuesta.json();
        if(resultado.status === 'success') {
            document.getElementById('form-nuevo-producto').reset();
            toggleModal('modal-agregar');
            cambiarVista('mercado'); // Recargar vista
        }
    } catch (error) {
        alert("Error al guardar.");
    } finally {
        boton.innerText = 'Guardar';
        boton.disabled = false;
    }
}

// PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// Variable global para almacenar los ingredientes del plato que se está creando
let ingredientesTemporales = [];
// Variable para almacenar el recetario descargado
let recetarioGlobal = []; 

// Modifica tu Router (cambiarVista) para que llame a la función correcta al entrar a 'platos'
// Reemplaza la línea correspondiente en tu función cambiarVista:
// else if (vistaTarget === 'platos') { ... peticionLectura(token, 'Recetario', renderizarRecetario); }

function renderizarRecetario(datos) {
    recetarioGlobal = datos;
    const contenedor = document.getElementById('lista-recetas');
    contenedor.innerHTML = '';
    
    if(datos.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-gray-400 mt-6">Aún no hay platos guardados.</p>';
        return;
    }

    datos.forEach(plato => {
        // Parseamos el JSON de ingredientes que viene de Sheets
        let ingredientes = [];
        try { ingredientes = JSON.parse(plato.Ingredientes); } catch(e) {}
        
        const esCompartido = plato.Pago_Default === 'Ambos';
        const badgeColor = esCompartido ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700';

        contenedor.innerHTML += `
            <div class="bg-white border rounded-xl p-4 shadow-sm flex flex-col">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-lg text-gray-800">${plato.Nombre}</h4>
                    <span class="text-xs font-bold px-2 py-1 rounded-full ${badgeColor}">${plato.Pago_Default}</span>
                </div>
                <p class="text-xs text-gray-500 mb-3">${ingredientes.length} ingredientes registrados</p>
                
                <!-- Botón rápido para enviar solo este plato a la lista -->
                <button onclick="enviarPlatoALista('${plato.ID_Plato}')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded text-sm transition">
                    Agregar a las compras
                </button>
            </div>
        `;
    });
}

// --- Lógica del Creador de Recetas ---

function agregarIngredienteTemporal() {
    const nombre = document.getElementById('ingrediente-nombre').value;
    const cant = document.getElementById('ingrediente-cant').value;
    const unidad = document.getElementById('ingrediente-unidad').value;

    if(!nombre || !cant) { alert("Completa nombre y cantidad"); return; }

    ingredientesTemporales.push({ nombre, cant, unidad, categoria: 'Abarrotes' }); // Categoría por defecto, luego el backend la ajustará con el Diccionario
    
    // Dibujar en el HTML
    const li = document.createElement('li');
    li.className = "flex justify-between border-b pb-1";
    li.innerHTML = `<span>${nombre}</span> <strong>${cant} ${unidad}</strong>`;
    document.getElementById('lista-ingredientes-temp').appendChild(li);

    // Limpiar inputs
    document.getElementById('ingrediente-nombre').value = '';
    document.getElementById('ingrediente-cant').value = '';
}

function cerrarModalReceta() {
    ingredientesTemporales = [];
    document.getElementById('lista-ingredientes-temp').innerHTML = '';
    document.getElementById('form-nueva-receta').reset();
    toggleModal('modal-receta');
}

async function guardarReceta(event) {
    event.preventDefault();
    if(ingredientesTemporales.length === 0) { alert("Agrega al menos un ingrediente"); return; }

    const boton = document.getElementById('btn-guardar-receta');
    boton.innerText = 'Guardando...';
    boton.disabled = true;

    const token = localStorage.getItem('kompra_token');
    
    // Estructura para la pestaña Recetario
    const nuevaReceta = {
        action: 'insert',
        token: token,
        tabla: 'Recetario', // Enviamos a la tabla correcta
        data: [
            "REC-" + Math.floor(Math.random() * 10000), // ID_Plato
            document.getElementById('receta-nombre').value, // Nombre
            JSON.stringify(ingredientesTemporales), // Guardamos el array como string JSON
            document.getElementById('receta-pago').value // Pago_Default
        ]
    };

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(nuevaReceta) });
        const result = await res.json();
        if(result.status === 'success') {
            cerrarModalReceta();
            cambiarVista('platos'); // Recargar la vista
        }
    } catch (e) {
        alert("Error al guardar receta.");
    } finally {
        boton.innerText = 'Guardar Plato';
        boton.disabled = false;
    }
}

// --- Lógica del Batch Insert (De la receta a la lista de espera) ---

async function enviarPlatoALista(idPlato) {
    const plato = recetarioGlobal.find(p => p.ID_Plato === idPlato);
    if(!plato) return;

    const ingredientes = JSON.parse(plato.Ingredientes);
    const filasParaInsertar = [];
    const fecha = new Date().toLocaleDateString('es-PE');

    // Mapeamos los ingredientes al formato de Compras_Maestro
    ingredientes.forEach(ing => {
        filasParaInsertar.push([
            "CMP-" + Math.floor(Math.random() * 100000), // ID_Compra
            fecha, // Fecha
            "N/A", // Rango
            ing.nombre, // Producto
            ing.cant, // Cantidad
            ing.unidad, // Unidad
            "Por_Clasificar", // Categoria (ideal que el diccionario lo arregle en Sheets)
            plato.Pago_Default, // Para (hereda de la receta)
            "En_Espera", // Estado crucial: Aún no se sabe si falta en la refri
            0, // Precio
            "Pendiente" // Quien_Pago
        ]);
    });

    const payload = {
        action: 'batch_insert',
        token: localStorage.getItem('kompra_token'),
        tabla: 'Compras_Maestro',
        data: filasParaInsertar
    };

    try {
        // Podrías poner un loader visual aquí
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if(result.status === 'success') {
            alert(`${ingredientes.length} ingredientes enviados a la refri para auditar.`);
        }
    } catch(e) {
        alert("Error al procesar la lista.");
    }
}

