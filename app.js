const API_URL = "https://script.google.com/macros/s/AKfycbyVkw1YwTY69HbKGabJKrrRBzwjxb8zEScpTStShHBJmVTX9s0M8jR4I5_Oad9MHv4/exec"; // NO OLVIDES PONER TU URL REAL

let state = {
    diccionario: [], recetario: [], plan: [], mercado: [], semanas: [],
    semanaActual: null, tempIngredientes: [], editandoPlatoID: null
};

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

// NUEVO: Soporte para llamadas silenciosas (background)
async function api(payload, silent = false) {
    payload.token = auth.getToken(); 
    if(!silent) document.getElementById('sync-spinner').classList.remove('hidden');
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
        if(!silent) document.getElementById('sync-spinner').classList.add('hidden'); 
    }
}

async function syncData() {
    const data = await api({ action: 'sync' });
    if(!data) return;
    state = {...state, ...data, tempIngredientes: []};
    
    let activa = state.semanas.find(s => s.Estado === 'Activa');
    state.semanaActual = activa ? activa.Semana_ID : null;

    actualizarDiccionario();
    renderAll();
}

const ui = {
    nav: (vista) => {
        ['recetario', 'plan', 'mercado', 'pagos', 'reportes'].forEach(v => {
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
}

function actualizarDiccionario() {
    document.getElementById('datalist-dicc').innerHTML = state.diccionario.map(d => `<option value="${d.Articulo}">`).join('');
}

function formatearFechaAmigable(fechaStr) {
    if(!fechaStr) return 'Fecha Inválida';
    const puraFecha = fechaStr.substring(0, 10);
    const partes = puraFecha.split('-');
    if(partes.length !== 3) return puraFecha; 
    const dateObj = new Date(partes[0], parseInt(partes[1])-1, partes[2]);
    return dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' });
}

// ================= RENDERIZADO =================
function renderRecetario() {
    const list = document.getElementById('lista-recetario');
    list.innerHTML = state.recetario.map(r => {
        const ings = JSON.parse(r.Ingredientes_JSON || '[]');
        return `
        <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-gray-800 text-lg">${r.Nombre}</h4>
                <div class="flex gap-2">
                    <button onclick="app.abrirEditarReceta('${r.ID_Plato}')" class="text-blue-500 text-xs font-bold bg-blue-50 px-2 py-1 rounded shadow-sm hover:bg-blue-100">Editar</button>
                    <button onclick="app.eliminarReceta('${r.ID_Plato}')" class="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded shadow-sm hover:bg-red-100">Eliminar</button>
                </div>
            </div>
            <div class="text-xs bg-gray-50 p-2 rounded text-gray-600 divide-y divide-gray-200">
                ${ings.map(i => `<div class="py-1 flex justify-between items-center">
                    <span><span class="font-bold">${i.cantidad||1} ${i.unidad}</span> ${i.articulo}</span> 
                    <span class="text-gray-400 text-[10px] font-bold uppercase">Para: ${i.para} | Pago: ${i.quien_pago}</span>
                </div>`).join('')}
            </div>
        </div>`;
    }).join('');

    document.getElementById('plan-plato').innerHTML = state.recetario.map(r => `<option value="${r.ID_Plato}">${r.Nombre}</option>`).join('');
}

function renderPlan() {
    let planActivo = state.plan.filter(p => p.Semana_ID === state.semanaActual).sort((a,b) => new Date(a.Fecha) - new Date(b.Fecha));
    
    const fInicio = document.getElementById('filtro-inicio').value;
    const fFin = document.getElementById('filtro-fin').value;
    
    if (fInicio) planActivo = planActivo.filter(p => p.Fecha.substring(0,10) >= fInicio);
    if (fFin) planActivo = planActivo.filter(p => p.Fecha.substring(0,10) <= fFin);

    const porDia = planActivo.reduce((acc, p) => {
        const soloFecha = p.Fecha.substring(0, 10);
        acc[soloFecha] = acc[soloFecha] || [];
        acc[soloFecha].push(p);
        return acc;
    }, {});

    let html = '';
    if(Object.keys(porDia).length === 0) {
        html = '<p class="text-center text-gray-400 mt-6 font-bold">No hay platos programados en estas fechas.</p>';
    } else {
        for(const [fecha, platos] of Object.entries(porDia)) {
            const nombreDia = formatearFechaAmigable(fecha);
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
    const fInicio = document.getElementById('filtro-inicio').value;
    const fFin = document.getElementById('filtro-fin').value;

    let items = state.mercado.filter(m => m.Semana_ID === state.semanaActual);

    if (fInicio || fFin) {
        items = items.filter(m => {
            if (!m.Fecha) return true; 
            const f = m.Fecha.substring(0, 10);
            if (fInicio && f < fInicio) return false;
            if (fFin && f > fFin) return false;
            return true;
        });
    }

    const agrupado = items.reduce((acc, obj) => {
        acc[obj.Categoria] = acc[obj.Categoria] || [];
        acc[obj.Categoria].push(obj);
        return acc;
    }, {});

    let infoFiltro = (fInicio || fFin) ? `🗓️ Mostrando compras para: ${fInicio||'∞'} hasta ${fFin||'∞'}` : `🗓️ Mostrando todo el mercado de la semana`;
    let html = `<div class="bg-blue-50 text-blue-800 font-bold p-3 rounded-lg text-center mb-4 text-xs border border-blue-200 shadow-sm">${infoFiltro}</div>`;
    
    if(items.length === 0) html += '<p class="text-center text-gray-400 mt-6 font-bold">No hay compras para estas fechas.</p>';
    
    for (const [cat, arts] of Object.entries(agrupado)) {
        html += `
        <div class="bg-white rounded-xl shadow-sm mb-4 overflow-hidden border border-gray-200">
            <div id="cat-head-${cat}" class="bg-gray-800 text-white p-2 flex flex-wrap gap-2 items-center justify-between">
                <h4 class="font-bold uppercase text-xs w-full mb-1">${cat}</h4>
                <select class="cat-para text-black text-[10px] p-1 rounded font-bold outline-none"><option value="Ambos">Para: Ambos</option><option value="Carlos">Para: Carlos</option><option value="Daniel">Para: Daniel</option></select>
                <select class="cat-quien text-black text-[10px] p-1 rounded font-bold outline-none"><option value="Pendiente">Pago: Pendte.</option><option value="Carlos">Pago: Carlos</option><option value="Daniel">Pago: Daniel</option></select>
                <input type="number" class="cat-total text-black text-[10px] p-1 rounded font-bold w-16 text-center outline-none" placeholder="Costo S/">
                <button onclick="app.bloquearCategoria('${cat}')" class="bg-red-500 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-600 shadow-sm">Bloquear Total</button>
            </div>
            <div class="p-2 space-y-2">
        `;
        arts.forEach(a => {
            const isBlocked = a.Estado === 'Comprado_Bloqueado';
            const isComprado = a.Estado === 'Comprado';
            html += `
            <div id="row-${a.ID_Item}" class="flex flex-wrap gap-2 items-center p-2 border-b border-gray-100 last:border-0 bg-gray-50 rounded">
                <input type="checkbox" class="chk-estado w-4 h-4 accent-blue-600" ${isComprado||isBlocked ? 'checked' : ''} ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
                <span class="font-bold text-xs flex-1 ${isBlocked ? 'line-through text-gray-400' : 'text-gray-800'}">${a.Articulo} <span class="font-normal text-blue-600">(${a.Unidad})</span></span>
                
                <select class="sel-para border p-1 text-[10px] rounded font-bold text-gray-700 outline-none" ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
                    <option value="Ambos" ${a.Para==='Ambos'?'selected':''}>Para: Ambos</option>
                    <option value="Carlos" ${a.Para==='Carlos'?'selected':''}>Para: Carlos</option>
                    <option value="Daniel" ${a.Para==='Daniel'?'selected':''}>Para: Daniel</option>
                </select>
                
                <select class="sel-quien border p-1 text-[10px] rounded font-bold text-gray-700 outline-none" ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
                    <option value="Pendiente" ${a.Quien_Pago==='Pendiente'?'selected':''}>Pago: Pndte.</option>
                    <option value="Carlos" ${a.Quien_Pago==='Carlos'?'selected':''}>Pago: Carlos</option>
                    <option value="Daniel" ${a.Quien_Pago==='Daniel'?'selected':''}>Pago: Daniel</option>
                </select>
                
                <input type="number" class="inp-precio border border-gray-300 p-1 text-[10px] w-14 rounded text-center font-bold text-gray-800 outline-none" placeholder="S/" value="${a.Precio||''}" ${isBlocked ? 'disabled' : ''} onchange="app.updateItem('${a.ID_Item}')">
            </div>`;
        });
        html += `</div></div>`;
    }
    document.getElementById('lista-mercado').innerHTML = html;
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
    eliminarReceta: async (id) => {
        if(!confirm("¿Seguro que deseas eliminar este plato definitivamente?")) return;
        await api({ action: 'delete_receta', id: id });
        syncData();
    },
    addIngredienteTemp: () => {
        const art = document.getElementById('rec-ing-art').value;
        const cant = document.getElementById('rec-ing-cant').value;
        if(!art) return alert("El nombre del artículo es obligatorio");
        
        state.tempIngredientes.push({
            articulo: art, cantidad: cant || 1,
            categoria: document.getElementById('rec-ing-cat').value,
            unidad: document.getElementById('rec-ing-uni').value,
            para: document.getElementById('rec-ing-para') ? document.getElementById('rec-ing-para').value : 'Ambos',
            quien_pago: document.getElementById('rec-ing-quien') ? document.getElementById('rec-ing-quien').value : 'Pendiente'
        });
        document.getElementById('rec-ing-art').value = '';
        document.getElementById('rec-ing-cant').value = '';
        app.renderTempIngredientes();
    },
    removerIngredienteTemp: (index) => {
        state.tempIngredientes.splice(index, 1);
        app.renderTempIngredientes();
    },
    renderTempIngredientes: () => {
        const lista = document.getElementById('lista-ingredientes-temp');
        if(!lista) return;
        lista.innerHTML = state.tempIngredientes.map((i, index) => `
            <li class="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0 text-gray-700">
                <div class="flex flex-col">
                    <span>${i.articulo} <span class="font-bold text-blue-600 ml-1">${i.cantidad} ${i.unidad}</span></span>
                    <span class="text-[10px] uppercase text-gray-400 font-bold">Para: ${i.para || 'Ambos'} | Pago: ${i.quien_pago || 'Pendiente'}</span>
                </div>
                <button type="button" onclick="app.removerIngredienteTemp(${index})" class="text-red-500 font-bold px-3 py-1 bg-red-50 rounded text-xs hover:bg-red-100">X</button>
            </li>`).join('');
    },
    guardarReceta: async () => {
        const nombre = document.getElementById('rec-nombre').value;
        if(!nombre) return alert("Falta el nombre de la receta");

        const btn = document.getElementById('btn-save-receta');
        if(btn) { btn.innerText = 'Guardando...'; btn.disabled = true; }

        await api({
            action: state.editandoPlatoID ? 'update_receta' : 'save_receta',
            data: { id: state.editandoPlatoID || "PLT-" + Date.now(), nombre: nombre, ingredientes: JSON.stringify(state.tempIngredientes) }
        });
        
        if(btn) { btn.innerText = 'Guardar'; btn.disabled = false; }
        ui.toggleModal('modal-receta');
        syncData();
    },

    // ---- Plan ----
    guardarPlan: async () => {
        const fecha = document.getElementById('plan-fecha').value; 
        const id_plato = document.getElementById('plan-plato').value;
        const plato = state.recetario.find(p => p.ID_Plato === id_plato);
        
        if(!fecha) return alert("Selecciona una fecha.");
        if(!plato) return alert("Selecciona un plato.");

        const btn = document.getElementById('btn-save-plan');
        btn.innerText = 'Procesando...'; btn.disabled = true;

        await api({
            action: 'save_plan', semana_id: state.semanaActual, fecha: fecha,
            id_plato: plato.ID_Plato, nombre_plato: plato.Nombre, ingredientes: plato.Ingredientes_JSON
        });
        
        alert("✅ Plato programado exitosamente");
        btn.innerText = 'Añadir al Calendario'; btn.disabled = false;
        document.getElementById('plan-fecha').value = '';
        syncData();
    },

    // ---- Mercado ----
    guardarManual: async () => {
        const btn = document.getElementById('btn-save-manual');
        btn.innerText = 'Guardando...'; btn.disabled = true;

        await api({
            action: 'add_mercado',
            data: {
                id: "ITM-" + Date.now(), semana_id: state.semanaActual,
                articulo: document.getElementById('man-art').value,
                categoria: document.getElementById('man-cat').value,
                unidad: document.getElementById('man-uni').value,
                para: document.getElementById('man-para').value,
                quien_pago: document.getElementById('man-quien').value,
                precio: document.getElementById('man-precio').value || 0,
                estado: "Pendiente",
                fecha: new Date().toISOString().substring(0, 10) 
            }
        });
        btn.innerText = 'Agregar'; btn.disabled = false;
        ui.toggleModal('modal-item-manual');
        syncData();
    },

    // NUEVA VELOCIDAD: INTERFAZ OPTIMISTA
    updateItem: (id) => {
        const row = document.getElementById(`row-${id}`);
        const para = row.querySelector('.sel-para').value;
        const quien = row.querySelector('.sel-quien').value;
        const precio = row.querySelector('.inp-precio').value;
        const estado = row.querySelector('.chk-estado').checked ? "Comprado" : "Pendiente";

        // 1. Modificar la memoria local de la app inmediatamente
        const item = state.mercado.find(m => m.ID_Item === id);
        if(item) {
            item.Para = para;
            item.Quien_Pago = quien;
            item.Precio = precio;
            item.Estado = estado;
        }

        // 2. Modificar visualmente la fila para dar la sensación de velocidad
        const textoArticulo = row.querySelector('span.flex-1');
        if (estado === 'Comprado' || estado === 'Comprado_Bloqueado') {
            textoArticulo.classList.add('line-through', 'text-gray-400');
            textoArticulo.classList.remove('text-gray-800');
        } else {
            textoArticulo.classList.remove('line-through', 'text-gray-400');
            textoArticulo.classList.add('text-gray-800');
        }

        // 3. Enviar los datos al backend SIN bloquear la pantalla y SIN mostrar el logo de carga.
        // True indica que el API correrá en modo Silencioso. No requiere SyncData posterior.
        api({
            action: 'update_item',
            data: { id, para, quien_pago: quien, precio, estado }
        }, true); 
    },

    bloquearCategoria: async (cat) => {
        const cont = document.getElementById(`cat-head-${cat}`);
        const totalInput = cont.querySelector('.cat-total').value;
        if(!totalInput || parseFloat(totalInput) <= 0) return alert("Por favor, ingresa el Costo S/ en el cuadro negro antes de bloquear.");
        
        const para = cont.querySelector('.cat-para').value;
        const quien = cont.querySelector('.cat-quien').value;

        await api({ action: 'block_categoria', semana_id: state.semanaActual, categoria: cat, total: totalInput, para: para, quien_pago: quien });
        syncData();
    },

    // ---- PAGOS (Cálculos de Cuadre) ----
    calcularPagos: () => {
        const items = state.mercado.filter(m => m.Semana_ID === state.semanaActual && (m.Estado === 'Comprado' || m.Estado === 'Comprado_Bloqueado'));
        
        let pagoCarlos = 0, pagoDaniel = 0;
        let gastoAmbos = 0, gastoCarlos = 0, gastoDaniel = 0;

        items.forEach(i => {
            let p = parseFloat(i.Precio) || 0;
            if (p > 0) {
                if(i.Quien_Pago === 'Carlos') pagoCarlos += p;
                if(i.Quien_Pago === 'Daniel') pagoDaniel += p;

                if(i.Para === 'Ambos') { gastoAmbos += p; }
                else if(i.Para === 'Carlos') { gastoCarlos += p; }
                else if(i.Para === 'Daniel') { gastoDaniel += p; }
            }
        });

        const totalGeneral = pagoCarlos + pagoDaniel;
        let debeCarlos = (gastoAmbos / 2) + gastoCarlos;
        let debeDaniel = (gastoAmbos / 2) + gastoDaniel;

        document.getElementById('pagos-detalle').innerHTML = `
            <div class="text-left space-y-4 text-sm mt-4">
                <div class="flex justify-between border-b border-gray-200 pb-2 font-black text-lg text-gray-800">
                    <span>Costo Total del Mercado:</span> <span>S/ ${totalGeneral.toFixed(2)}</span>
                </div>

                <div>
                    <p class="font-bold text-gray-700 mb-1">1. Desglose de Consumo:</p>
                    <ul class="text-gray-600 pl-2 space-y-1 bg-gray-50 p-2 rounded border border-gray-100">
                        <li class="flex justify-between"><span>Compartido (Ambos):</span> <span class="font-bold">S/ ${gastoAmbos.toFixed(2)}</span></li>
                        <li class="flex justify-between"><span>Solo consumió Carlos:</span> <span class="font-bold">S/ ${gastoCarlos.toFixed(2)}</span></li>
                        <li class="flex justify-between"><span>Solo consumió Daniel:</span> <span class="font-bold">S/ ${gastoDaniel.toFixed(2)}</span></li>
                    </ul>
                </div>

                <div>
                    <p class="font-bold text-gray-700 mb-1">2. Cuota Ideal (Mitad Compartido + Individual):</p>
                    <ul class="text-gray-600 pl-2 space-y-1 bg-blue-50 p-2 rounded border border-blue-100">
                        <li class="flex justify-between font-bold text-blue-700"><span>A Carlos le tocaba aportar:</span> <span>S/ ${debeCarlos.toFixed(2)}</span></li>
                        <li class="flex justify-between font-bold text-blue-700"><span>A Daniel le tocaba aportar:</span> <span>S/ ${debeDaniel.toFixed(2)}</span></li>
                    </ul>
                </div>

                <div>
                    <p class="font-bold text-gray-700 mb-1">3. Pagos Físicos (Quién sacó de su billetera):</p>
                    <ul class="text-gray-600 pl-2 space-y-1 bg-green-50 p-2 rounded border border-green-100">
                        <li class="flex justify-between font-bold text-green-700"><span>Carlos pagó en caja:</span> <span>S/ ${pagoCarlos.toFixed(2)}</span></li>
                        <li class="flex justify-between font-bold text-green-700"><span>Daniel pagó en caja:</span> <span>S/ ${pagoDaniel.toFixed(2)}</span></li>
                    </ul>
                </div>
            </div>
        `;

        let saldoCarlos = pagoCarlos - debeCarlos; 
        let msg = "Cuentas saldadas. Nadie le debe a nadie.";
        let bgClass = "bg-gray-100 text-gray-800 border-gray-300";
        
        if(saldoCarlos > 0.05) { 
            msg = `💵 Daniel debe transferirle a Carlos: S/ ${Math.abs(saldoCarlos).toFixed(2)}`;
            bgClass = "bg-orange-100 text-orange-800 border-orange-200";
        } else if (saldoCarlos < -0.05) {
            msg = `💵 Carlos debe transferirle a Daniel: S/ ${Math.abs(saldoCarlos).toFixed(2)}`;
            bgClass = "bg-orange-100 text-orange-800 border-orange-200";
        }
        
        const deudasDiv = document.getElementById('pagos-resultado-final');
        deudasDiv.innerText = msg;
        deudasDiv.className = `p-4 rounded-lg font-black text-center mt-4 border ${bgClass}`;
        
        document.getElementById('resultados-pagos').classList.remove('hidden');
    },

    cerrarSemana: async () => {
        if(!confirm("¿Seguro que deseas cerrar la semana? Esto congelará los gastos y limpiará el mercado.")) return;
        await api({ action: 'cerrar_semana', semana_id: state.semanaActual, nueva_semana_id: "SEM-" + Date.now() });
        document.getElementById('resultados-pagos').classList.add('hidden');
        syncData();
    },

    // ---- REPORTES (Historial) ----
    generarReporteHistorico: () => {
        const fIn = document.getElementById('rep-inicio').value;
        const fFin = document.getElementById('rep-fin').value;

        if(!fIn || !fFin) return alert("Selecciona fecha de inicio y fin para buscar.");

        let items = state.mercado.filter(m => m.Estado === 'Comprado' || m.Estado === 'Comprado_Bloqueado');

        items = items.filter(m => {
            let f = m.Fecha;
            if(!f) {
                const sem = state.semanas.find(s => s.Semana_ID === m.Semana_ID);
                f = sem ? sem.Fecha_Inicio : "2020-01-01";
            }
            f = f.substring(0, 10);
            return f >= fIn && f <= fFin;
        });

        let total = 0;
        let porCat = {};
        let carlosConsume = 0, danielConsume = 0, ambosConsume = 0;

        items.forEach(i => {
            let p = parseFloat(i.Precio) || 0;
            if (p > 0) {
                total += p;
                porCat[i.Categoria] = (porCat[i.Categoria] || 0) + p;

                if(i.Para === 'Ambos') ambosConsume += p;
                else if(i.Para === 'Carlos') carlosConsume += p;
                else if(i.Para === 'Daniel') danielConsume += p;
            }
        });

        const htmlCategorias = Object.entries(porCat)
            .sort((a,b) => b[1] - a[1]) 
            .map(([cat, val]) => `<li class="flex justify-between border-b border-gray-100 py-1"><span>${cat}</span> <span class="font-bold">S/ ${val.toFixed(2)}</span></li>`)
            .join('');

        document.getElementById('res-hist-total').innerText = `S/ ${total.toFixed(2)}`;
        document.getElementById('res-hist-cat').innerHTML = htmlCategorias || '<p class="text-xs text-gray-400">No hay datos de categoría.</p>';

        document.getElementById('res-hist-cons').innerHTML = `
            <li class="flex justify-between"><span>Compartido (Ambos):</span> <span class="font-bold">S/ ${ambosConsume.toFixed(2)}</span></li>
            <li class="flex justify-between"><span>Solo Carlos:</span> <span class="font-bold">S/ ${carlosConsume.toFixed(2)}</span></li>
            <li class="flex justify-between"><span>Solo Daniel:</span> <span class="font-bold">S/ ${danielConsume.toFixed(2)}</span></li>
        `;

        document.getElementById('contenedor-resultados-historicos').classList.remove('hidden');
    }
};

document.querySelector('[onclick="ui.toggleModal(\'modal-receta\')"]').setAttribute('onclick', 'app.abrirNuevaReceta()');
