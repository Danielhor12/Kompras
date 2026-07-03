const API_URL = "https://script.google.com/macros/s/AKfycbwOKZj7yJWBzNrZEb2m0QYRQ0DRHJlW3Y1z9xILGnL-n_Lnd-TPd4izQiFbsAxpFBA/exec"; // <-- PON TU NUEVA URL AQUÍ

// ================= ESTADO LOCAL =================
let state = {
    diccionario: [], recetario: [], plan: [], mercado: [], semanas: [],
    semanaActual: null,
    tempIngredientes: [],
    editandoPlatoID: null // Controla si creamos o editamos
};

// ================= AUTENTICACIÓN =================
const auth = {
    guardarToken: () => {
        const token = document.getElementById('token-input').value;
        if(!token) return;
        localStorage.setItem('kompra_token', token);
        location.reload(); 
    },
    cerrarSesion: () => {
        localStorage.removeItem('kompra_token');
        location.reload();
    },
    getToken: () => localStorage.getItem('kompra_token')
};

window.onload = init;
window.addEventListener('focus', () => { if(auth.getToken()) syncData(); });

async function init() {
    if (auth.getToken()) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('flex');
        await syncData();
        ui.nav('recetario');
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('flex');
    }
}

async function api(payload) {
    payload.token = auth.getToken(); 
    document.getElementById('sync-spinner').classList.remove('hidden');
    try {
        const req = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const res = await req.json();
        if (res.error) {
            alert(res.error);
            if (res.error.toLowerCase().includes('denegado')) auth.cerrarSesion();
            return null;
        }
        return res;
    } catch(e) { 
        return null;
    } finally { 
        document.getElementById('sync-spinner').classList.add('hidden'); 
    }
}

async function syncData() {
    const data = await api({ action: 'sync' });
    if(!data) return;
    state = {...state, ...data, tempIngredientes: []};
    
    // El backend ahora garantiza que siempre haya una activa
    let activa = state.semanas.find(s => s.Estado === 'Activa');
    state.semanaActual = activa ? activa.Semana_ID : null;

    actualizarDiccionario();
    renderAll();
}

const ui = {
    nav: (vista) => {
        ['recetario', 'plan', 'mercado', 'reportes'].forEach(v => {
            document.getElementById(`view-${v}`).classList.add('hidden');
            document.getElementById(`btn-nav-${v}`).classList.replace('text-blue-600', 'text-gray-500');
        });
        document.getElementById(`view-${vista}`).classList.remove('hidden');
        document.getElementById(`btn-nav-${vista}`).classList.replace('text-gray-500', 'text-blue-600');
    },
    toggleModal: (id) => document.getElementById(id).classList.toggle('hidden')
};

function renderAll() {
    renderRecetario();
    renderPlan();
    renderMercado();
    renderReportes();
}

function actualizarDiccionario() {
    document.getElementById('datalist-dicc').innerHTML = state.diccionario.map(d => `<option value="${d.Articulo}">`).join('');
}

// ================= RENDERIZADO =================
function renderRecetario() {
    const list = document.getElementById('lista-recetario');
    list.innerHTML = state.recetario.map(r => {
        const ings = JSON.parse(r.Ingredientes_JSON || '[]');
        return `
        <div onclick="app.abrirEditarReceta('${r.ID_Plato}')" class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500 cursor-pointer hover:bg-gray-50 transition">
            <h4 class="font-bold text-gray-800">${r.Nombre}</h4>
            <p class="text-xs text-gray-500 mb-2">${ings.length} ingredientes</p>
            <div class="text-xs bg-gray-100 p-2 rounded text-gray-600">${ings.map(i => `<span class="font-semibold">${i.cantidad||1} ${i.unidad}</span> ${i.articulo}`).join(', ')}</div>
        </div>`;
    }).join('');

    document.getElementById('plan-plato').innerHTML = state.recetario.map(r => `<option value="${r.ID_Plato}">${r.Nombre}</option>`).join('');
}

function renderPlan() {
    const planActivo = state.plan.filter(p => p.Semana_ID === state.semanaActual).sort((a,b) => new Date(a.Fecha) - new Date(b.Fecha));
    
    // Agrupar por fecha para formar el calendario
    const porDia = planActivo.reduce((acc, p) => {
        acc[p.Fecha] = acc[p.Fecha] || [];
        acc[p.Fecha].push(p);
        return acc;
    }, {});

    let html = '';
    if(Object.keys(porDia).length === 0) {
        html = '<p class="text-center text-gray-400 mt-6 font-bold">No hay platos programados esta semana.</p>';
    } else {
        for(const [fecha, platos] of Object.entries(porDia)) {
            // Formatear fecha para el encabezado del calendario
            const dateObj = new Date(fecha + 'T00:00:00'); 
            const nombreDia = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' });

            html += `
            <div class="mb-4 border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                <div class="bg-blue-600 text-white font-bold p-2 text-center capitalize text-sm tracking-wide">${nombreDia}</div>
                <div class="bg-white p-2 space-y-2">
                    ${platos.map(p => `<div class="p-3 bg-blue-50 text-blue-900 rounded-lg text-sm font-bold border border-blue-100 flex items-center gap-2"><span>🍽️</span> ${p.Nombre_Plato}</div>`).join('')}
                </div>
            </div>`;
        }
    }
    document.getElementById('lista-plan').innerHTML = html;
}

function renderMercado() {
    const items = state.mercado.filter(m => m.Semana_ID === state.semanaActual);
    const agrupado = items.reduce((acc, obj) => {
        acc[obj.Categoria] = acc[obj.Categoria] || [];
        acc[obj.Categoria].push(obj);
        return acc;
    }, {});

    let html = items.length === 0 ? '<p class="text-center text-gray-400 mt-6">La lista está vacía.</p>' : '';
    
    for (const [cat, arts] of Object.entries(agrupado)) {
        html += `
        <div class="bg-white rounded-xl shadow-sm mb-4 overflow-hidden border border-gray-200">
            <div id="cat-head-${cat}" class="bg-gray-800 text-white p-3 flex flex-wrap gap-2 items-center justify-between">
                <h4 class="font-bold uppercase text-xs w-full mb-1">${cat}</h4>
                <select class="cat-para text-black text-xs p-1 rounded font-bold"><option>Ambos</option><option>Carlos</option><option>Daniel</option></select>
                <select class="cat-quien text-black text-xs p-1 rounded font-bold"><option>Carlos</option><option>Daniel</option></select>
                <button onclick="app.bloquearCategoria('${cat}')" class="bg-red-500 px-3 py-1 rounded text-xs font-bold hover:bg-red-600">Bloquear Total</button>
            </div>
            <div class="p-2 space-y-2">
        `;
        arts.forEach(a => {
            const isBlocked = a.Estado === 'Comprado_Bloqueado';
            const isComprado = a.Estado === 'Comprado';
            html += `
            <div id="row-${a.ID_Item}" class="flex flex-wrap gap-2 items-center p-2 border-b last:border-0 bg-gray-50 rounded">
                <input type="checkbox" class="chk-estado w-5 h-5 accent-blue-600" ${isComprado||isBlocked ? 'checked' : ''} ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
                <span class="font-bold text-sm flex-1 ${isBlocked ? 'line-through text-gray-400' : ''}">${a.Articulo} <span class="font-normal text-xs text-blue-600">(${a.Unidad})</span></span>
                
                <select class="sel-para border p-1 text-xs rounded font-bold" ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
                    <option ${a.Para==='Ambos'?'selected':''}>Ambos</option><option ${a.Para==='Carlos'?'selected':''}>Carlos</option><option ${a.Para==='Daniel'?'selected':''}>Daniel</option>
                </select>
                
                <select class="sel-quien border p-1 text-xs rounded font-bold" ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
                    <option ${a.Quien_Pago==='Pendiente'?'selected':''}>Pendiente</option><option ${a.Quien_Pago==='Carlos'?'selected':''}>Carlos</option><option ${a.Quien_Pago==='Daniel'?'selected':''}>Daniel</option>
                </select>
                
                <input type="number" class="inp-precio border border-gray-300 p-1 text-xs w-16 rounded text-center font-bold" placeholder="S/" value="${a.Precio||''}" ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
            </div>`;
        });
        html += `</div></div>`;
    }
    document.getElementById('lista-mercado').innerHTML = html;
}

function renderReportes() {
    const items = state.mercado.filter(m => m.Semana_ID === state.semanaActual && (m.Estado === 'Comprado' || m.Estado === 'Comprado_Bloqueado'));
    
    let pagoCarlos = 0, pagoDaniel = 0, debeCarlos = 0, debeDaniel = 0;

    items.forEach(i => {
        let p = parseFloat(i.Precio) || 0;
        if(i.Quien_Pago === 'Carlos') pagoCarlos += p;
        if(i.Quien_Pago === 'Daniel') pagoDaniel += p;

        if(i.Para === 'Ambos') { debeCarlos += p/2; debeDaniel += p/2; }
        else if(i.Para === 'Carlos') { debeCarlos += p; }
        else if(i.Para === 'Daniel') { debeDaniel += p; }
    });

    document.getElementById('reporte-gastos').innerHTML = `
        <div class="bg-white border p-3 rounded-xl shadow-sm"><p class="text-xs text-gray-500 font-bold">Pagó Carlos</p><p class="font-black text-xl text-blue-600">S/ ${pagoCarlos.toFixed(2)}</p></div>
        <div class="bg-white border p-3 rounded-xl shadow-sm"><p class="text-xs text-gray-500 font-bold">Pagó Daniel</p><p class="font-black text-xl text-blue-600">S/ ${pagoDaniel.toFixed(2)}</p></div>
    `;

    let saldoCarlos = pagoCarlos - debeCarlos; 
    let msg = "Cuentas saldadas.";
    if(saldoCarlos > 0) msg = `Daniel le debe a Carlos: S/ ${saldoCarlos.toFixed(2)}`;
    if(saldoCarlos < 0) msg = `Carlos le debe a Daniel: S/ ${Math.abs(saldoCarlos).toFixed(2)}`;
    
    document.getElementById('reporte-deudas').innerText = msg;
}

// ================= CONTROLADOR PRINCIPAL =================
const app = {
    // ---- Recetario ----
    abrirNuevaReceta: () => {
        state.editandoPlatoID = null;
        document.getElementById('titulo-modal-receta').innerText = "Nueva Receta";
        document.getElementById('rec-nombre').value = '';
        state.tempIngredientes = [];
        app.renderTempIngredientes();
        ui.toggleModal('modal-receta');
    },

    abrirEditarReceta: (id) => {
        state.editandoPlatoID = id;
        const receta = state.recetario.find(r => r.ID_Plato === id);
        document.getElementById('titulo-modal-receta').innerText = "Editar Receta";
        document.getElementById('rec-nombre').value = receta.Nombre;
        state.tempIngredientes = JSON.parse(receta.Ingredientes_JSON || '[]');
        app.renderTempIngredientes();
        ui.toggleModal('modal-receta');
    },

    addIngredienteTemp: () => {
        const art = document.getElementById('rec-ing-art').value;
        const cant = document.getElementById('rec-ing-cant').value;
        if(!art) return alert("El nombre del artículo es obligatorio");
        
        state.tempIngredientes.push({
            articulo: art,
            cantidad: cant || 1, // Guarda la cantidad ingresada
            categoria: document.getElementById('rec-ing-cat').value,
            unidad: document.getElementById('rec-ing-uni').value
        });
        document.getElementById('rec-ing-art').value = '';
        document.getElementById('rec-ing-cant').value = '';
        app.renderTempIngredientes();
    },

    renderTempIngredientes: () => {
        document.getElementById('lista-ingredientes-temp').innerHTML = state.tempIngredientes.map(i => `
            <li class="flex justify-between border-b border-gray-100 pb-1 last:border-0 text-gray-700">
                <span>${i.articulo}</span> 
                <span class="font-bold text-blue-600">${i.cantidad} ${i.unidad}</span>
            </li>`).join('');
    },
    
    guardarReceta: async () => {
        const nombre = document.getElementById('rec-nombre').value;
        if(!nombre) return alert("Falta el nombre de la receta");

        const payload = {
            action: state.editandoPlatoID ? 'update_receta' : 'save_receta',
            data: {
                id: state.editandoPlatoID || "PLT-" + Date.now(),
                nombre: nombre,
                ingredientes: JSON.stringify(state.tempIngredientes)
            }
        };
        await api(payload);
        ui.toggleModal('modal-receta');
        syncData();
    },

    // ---- Plan ----
    guardarPlan: async () => {
        const fecha = document.getElementById('plan-fecha').value;
        const id_plato = document.getElementById('plan-plato').value;
        const plato = state.recetario.find(p => p.ID_Plato === id_plato);
        
        if(!fecha) return alert("Selecciona una fecha en el calendario.");
        if(!plato) return alert("Selecciona un plato del recetario.");

        await api({
            action: 'save_plan',
            semana_id: state.semanaActual,
            fecha: fecha,
            id_plato: plato.ID_Plato,
            nombre_plato: plato.Nombre,
            ingredientes: plato.Ingredientes_JSON
        });
        syncData();
    },

    // ---- Mercado ----
    guardarManual: async () => {
        await api({
            action: 'add_mercado',
            data: {
                id: "ITM-" + Date.now(),
                semana_id: state.semanaActual,
                articulo: document.getElementById('man-art').value,
                categoria: document.getElementById('man-cat').value,
                unidad: document.getElementById('man-uni').value,
                para: document.getElementById('man-para').value,
                quien_pago: document.getElementById('man-quien').value,
                precio: document.getElementById('man-precio').value || 0,
                estado: "Pendiente"
            }
        });
        ui.toggleModal('modal-item-manual');
        syncData();
    },

    updateItem: async (id) => {
        const row = document.getElementById(`row-${id}`);
        await api({
            action: 'update_item',
            data: {
                id: id,
                para: row.querySelector('.sel-para').value,
                quien_pago: row.querySelector('.sel-quien').value,
                precio: row.querySelector('.inp-precio').value,
                estado: row.querySelector('.chk-estado').checked ? "Comprado" : "Pendiente"
            }
        });
        syncData();
    },

    bloquearCategoria: async (cat) => {
        const cont = document.getElementById(`cat-head-${cat}`);
        const total = prompt(`Ingrese el TOTAL pagado por ${cat} en soles:`);
        if(!total) return;
        const para = cont.querySelector('.cat-para').value;
        const quien = cont.querySelector('.cat-quien').value;

        await api({ action: 'block_categoria', semana_id: state.semanaActual, categoria: cat, total: total, para: para, quien_pago: quien });
        syncData();
    },

    cerrarSemana: async () => {
        if(!confirm("¿Seguro que deseas cerrar la semana? Esto congelará los gastos actuales y limpiará el mercado para iniciar una nueva planificación.")) return;
        await api({
            action: 'cerrar_semana',
            semana_id: state.semanaActual,
            nueva_semana_id: "SEM-" + Date.now()
        });
        syncData();
    }
};

// Sobreescribir el botón estático de HTML
document.querySelector('[onclick="ui.toggleModal(\'modal-receta\')"]').setAttribute('onclick', 'app.abrirNuevaReceta()');
