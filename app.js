const API_URL = "https://script.google.com/macros/s/AKfycbyrsU47ZJKRny9YHR4Dv-BXmOhdr-h0WQ3lToMy-Nepda-wAljk39DV6zg9Z_TNkBw/exec
"; // REEMPLAZAR AQUÍ
const TOKEN = "Kompra2026";

// Estado Local
let state = {
    diccionario: [], recetario: [], plan: [], mercado: [], semanas: [],
    semanaActual: null,
    tempIngredientes: []
};

// Sincronización Automática (Al cargar y al volver a la app)
window.onload = init;
window.addEventListener('focus', syncData);

async function init() {
    await syncData();
    ui.nav('recetario');
}

async function api(payload) {
    payload.token = TOKEN;
    document.getElementById('sync-spinner').classList.remove('hidden');
    try {
        const req = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const res = await req.json();
        return res;
    } catch(e) { console.error(e); } 
    finally { document.getElementById('sync-spinner').classList.add('hidden'); }
}

async function syncData() {
    const data = await api({ action: 'sync' });
    if(!data) return;
    state = {...state, ...data, tempIngredientes: []};
    
    // Determinar o crear semana actual
    let activa = state.semanas.find(s => s.Estado === 'Activa');
    if(!activa) {
        state.semanaActual = "SEM-" + Date.now();
        // El backend lo creará al guardar algo, o podemos forzarlo. Asumimos fallback local.
    } else {
        state.semanaActual = activa.Semana_ID;
    }

    actualizarDiccionario();
    renderAll();
}

// ================= UI CONTROLLERS =================
// ================= UI CONTROLLERS =================
const ui = {
    nav: (vista) => {
        // Ocultar todas las vistas y resetear colores
        ['recetario', 'plan', 'mercado', 'reportes'].forEach(v => {
            document.getElementById(`view-${v}`).classList.add('hidden');
            document.getElementById(`btn-nav-${v}`).classList.replace('text-blue-600', 'text-gray-500');
        });
        // Mostrar la vista seleccionada y pintar su botón
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
    const dl = document.getElementById('datalist-dicc');
    dl.innerHTML = state.diccionario.map(d => `<option value="${d.Articulo}">`).join('');
}

// ================= 1. RECETARIO =================
function renderRecetario() {
    const list = document.getElementById('lista-recetario');
    list.innerHTML = state.recetario.map(r => {
        const ings = JSON.parse(r.Ingredientes_JSON || '[]');
        return `
        <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
            <h4 class="font-bold text-gray-800">${r.Nombre}</h4>
            <p class="text-xs text-gray-500 mb-2">${ings.length} ingredientes</p>
            <div class="text-xs bg-gray-50 p-2 rounded">${ings.map(i => `${i.articulo} (${i.unidad})`).join(', ')}</div>
        </div>`;
    }).join('');

    // Llenar combo de Plan Semanal
    document.getElementById('plan-plato').innerHTML = state.recetario.map(r => `<option value="${r.ID_Plato}">${r.Nombre}</option>`).join('');
}

const app = {
    addIngredienteTemp: () => {
        const art = document.getElementById('rec-ing-art').value;
        if(!art) return;
        state.tempIngredientes.push({
            articulo: art,
            categoria: document.getElementById('rec-ing-cat').value,
            unidad: document.getElementById('rec-ing-uni').value
        });
        document.getElementById('rec-ing-art').value = '';
        document.getElementById('lista-ingredientes-temp').innerHTML = state.tempIngredientes.map(i => `<li>- ${i.articulo} (${i.unidad})</li>`).join('');
    },
    guardarReceta: async () => {
        const payload = {
            action: 'save_receta',
            data: {
                id: "PLT-" + Date.now(),
                nombre: document.getElementById('rec-nombre').value,
                ingredientes: JSON.stringify(state.tempIngredientes)
            }
        };
        await api(payload);
        ui.toggleModal('modal-receta');
        syncData();
    },

// ================= 2. PLAN SEMANAL =================
    guardarPlan: async () => {
        const fecha = document.getElementById('plan-fecha').value;
        const id_plato = document.getElementById('plan-plato').value;
        const plato = state.recetario.find(p => p.ID_Plato === id_plato);
        if(!fecha || !plato) return;

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

// ================= 3. MERCADO =================
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
        const total = prompt("Ingrese el TOTAL pagado por esta categoría en soles:");
        if(!total) return;
        const para = cont.querySelector('.cat-para').value;
        const quien = cont.querySelector('.cat-quien').value;

        await api({ action: 'block_categoria', semana_id: state.semanaActual, categoria: cat, total: total, para: para, quien_pago: quien });
        syncData();
    },

// ================= 4. REPORTES =================
    cerrarSemana: async () => {
        if(!confirm("¿Seguro que deseas cerrar la semana? No podrás editar el mercado actual.")) return;
        await api({
            action: 'cerrar_semana',
            semana_id: state.semanaActual,
            nueva_semana_id: "SEM-" + Date.now()
        });
        syncData();
    }
};

function renderPlan() {
    const planActivo = state.plan.filter(p => p.Semana_ID === state.semanaActual).sort((a,b) => new Date(a.Fecha) - new Date(b.Fecha));
    document.getElementById('lista-plan').innerHTML = planActivo.map(p => `
        <div class="bg-blue-50 p-3 rounded flex justify-between items-center border border-blue-100">
            <span class="font-bold text-blue-800">${p.Fecha}</span>
            <span class="text-gray-700">${p.Nombre_Plato}</span>
        </div>
    `).join('');
}

function renderMercado() {
    const items = state.mercado.filter(m => m.Semana_ID === state.semanaActual);
    const agrupado = items.reduce((acc, obj) => {
        acc[obj.Categoria] = acc[obj.Categoria] || [];
        acc[obj.Categoria].push(obj);
        return acc;
    }, {});

    let html = '';
    for (const [cat, arts] of Object.entries(agrupado)) {
        html += `
        <div class="bg-white rounded-xl shadow-sm mb-4 overflow-hidden border border-gray-200">
            <div id="cat-head-${cat}" class="bg-gray-800 text-white p-3 flex flex-wrap gap-2 items-center justify-between">
                <h4 class="font-bold uppercase text-xs w-full mb-1">${cat}</h4>
                <select class="cat-para text-black text-xs p-1 rounded"><option>Ambos</option><option>Carlos</option><option>Daniel</option></select>
                <select class="cat-quien text-black text-xs p-1 rounded"><option>Carlos</option><option>Daniel</option></select>
                <button onclick="app.bloquearCategoria('${cat}')" class="bg-red-500 px-2 py-1 rounded text-xs font-bold">Pago Total Único</button>
            </div>
            <div class="p-2 space-y-2">
        `;
        arts.forEach(a => {
            const isBlocked = a.Estado === 'Comprado_Bloqueado';
            const isComprado = a.Estado === 'Comprado';
            html += `
            <div id="row-${a.ID_Item}" class="flex flex-wrap gap-2 items-center p-2 border-b last:border-0 bg-gray-50 rounded">
                <input type="checkbox" class="chk-estado w-5 h-5" ${isComprado||isBlocked ? 'checked' : ''} ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
                <span class="font-bold text-sm flex-1 ${isBlocked ? 'line-through text-gray-400' : ''}">${a.Articulo} <span class="font-normal text-xs text-gray-500">(${a.Unidad})</span></span>
                
                <select class="sel-para border p-1 text-xs rounded" ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
                    <option ${a.Para==='Ambos'?'selected':''}>Ambos</option><option ${a.Para==='Carlos'?'selected':''}>Carlos</option><option ${a.Para==='Daniel'?'selected':''}>Daniel</option>
                </select>
                
                <select class="sel-quien border p-1 text-xs rounded" ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
                    <option ${a.Quien_Pago==='Pendiente'?'selected':''}>Pendiente</option><option ${a.Quien_Pago==='Carlos'?'selected':''}>Carlos</option><option ${a.Quien_Pago==='Daniel'?'selected':''}>Daniel</option>
                </select>
                
                <input type="number" class="inp-precio border p-1 text-xs w-16 rounded text-center" placeholder="S/" value="${a.Precio||''}" ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
            </div>`;
        });
        html += `</div></div>`;
    }
    document.getElementById('lista-mercado').innerHTML = html;
}

function renderReportes() {
    const items = state.mercado.filter(m => m.Semana_ID === state.semanaActual && (m.Estado === 'Comprado' || m.Estado === 'Comprado_Bloqueado'));
    
    let pagoCarlos = 0, pagoDaniel = 0;
    let debeCarlos = 0, debeDaniel = 0;

    items.forEach(i => {
        let p = parseFloat(i.Precio) || 0;
        if(i.Quien_Pago === 'Carlos') pagoCarlos += p;
        if(i.Quien_Pago === 'Daniel') pagoDaniel += p;

        if(i.Para === 'Ambos') { debeCarlos += p/2; debeDaniel += p/2; }
        else if(i.Para === 'Carlos') { debeCarlos += p; }
        else if(i.Para === 'Daniel') { debeDaniel += p; }
    });

    document.getElementById('reporte-gastos').innerHTML = `
        <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Pagó Carlos</p><p class="font-bold text-lg">S/ ${pagoCarlos.toFixed(2)}</p></div>
        <div class="bg-gray-50 p-3 rounded"><p class="text-xs text-gray-500">Pagó Daniel</p><p class="font-bold text-lg">S/ ${pagoDaniel.toFixed(2)}</p></div>
    `;

    let saldoCarlos = pagoCarlos - debeCarlos; 
    let msg = "Cuentas saldadas.";
    if(saldoCarlos > 0) msg = `Daniel le debe a Carlos: S/ ${saldoCarlos.toFixed(2)}`;
    if(saldoCarlos < 0) msg = `Carlos le debe a Daniel: S/ ${Math.abs(saldoCarlos).toFixed(2)}`;
    
    document.getElementById('reporte-deudas').innerText = msg;
}
