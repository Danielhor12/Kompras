// Endpoint de tu API en Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbwFneX0SGr2TmnENVyJUb4GX7-HCjBN0gdSdV9YCzdGTvhj41FJjyOmYxsJGiSLqFY/exec";

// Validación de sesión al cargar
window.onload = () => {
    const token = localStorage.getItem('kompra_token');
    if (token) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        cargarCompras(token);
    }
};

// Autenticación
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

// Petición POST segura para leer datos
async function cargarCompras(token) {
    const contenedor = document.getElementById('lista-compras');
    contenedor.innerHTML = '<p class="text-center text-gray-500">Cargando datos...</p>';

    try {
        const respuesta = await fetch(API_URL, {
            method: 'POST', 
            body: JSON.stringify({
                action: 'read',
                token: token
            })
        });
        
        const datos = await respuesta.json();
        
        if(datos.error) {
            alert("Token incorrecto o credenciales revocadas.");
            cerrarSesion();
            return;
        }
        
        renderizarLista(datos);
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
        contenedor.innerHTML = '<p class="text-center text-red-500">Fallo en la conexión.</p>';
    }
}

// Renderizado en el DOM
function renderizarLista(items) {
    const contenedor = document.getElementById('lista-compras');
    contenedor.innerHTML = ''; 
    
    // Filtramos solo los productos pendientes por comprar
    const activos = items.filter(item => item.Estado_Item === "En_Mercado");
    
    if(activos.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-gray-500 mt-10">Todo comprado. ¡Buen trabajo!</p>';
        return;
    }

    activos.forEach(item => {
        contenedor.innerHTML += `
            <div class="p-4 border border-gray-200 rounded-lg flex justify-between items-center shadow-sm">
                <div>
                    <h3 class="font-bold text-lg">${item.Producto}</h3>
                    <p class="text-sm text-gray-600">${item.Cantidad} ${item.Unidad} • ${item.Categoría}</p>
                </div>
            </div>
        `;
    });
}

// Registro del Service Worker para comportamiento PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log("Service Worker registrado correctamente."))
    .catch(err => console.error("Fallo al registrar el Service Worker:", err));
}