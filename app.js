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
