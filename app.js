const API_URL = "https://script.google.com/macros/s/AKfycbwBwB3KnOLZ_8g_eH94AnrEE10yVQA7bRZOLTtEpTc7EtLuhL-XvTqfKrSCnx-zs1A/exec
"; 

let state = {
    diccionario: [], recetario: [], plan: [], mercado: [], semanas: [],
    semanaActual: null, tempIngredientes: [], editandoPlatoID: null, tempPlanMeta: null,
    filtroComprador: 'Todos', 
    encargadosCategorias: {},
    vistaAgrupada: false // Controla el botón Unir/Desunir
};

const auth = {
    guardarToken: () => {
        const token = document.getElementById('token-input').value;
        if(!token) return;
        localStorage.setItem('kompra_token', token);
        location.reload(); 
    },
    cerrarSesion: () => { localStorage.removeItem('kompra_token'); location.reload(); },
    getToken: () => localStorage.getItem('kompra_token')
};

window.onload = init;
// ELIMINADO EL AUTO-SYNC AL VOLVER A LA APP

async function init() {
    if (auth.getToken()) {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('app-screen')?.classList.remove('hidden');
        document.getElementById('app-screen')?.classList.add('flex');
        await syncData();
        ui.nav('recetario');
    } else {
        document.getElementById('login-screen')?.classList.remove('hidden');
        document.getElementById('app-screen')?.classList.add('hidden');
    }
}

async function api(payload, silent = false) {
    payload.token = auth.getToken(); 
    if(!silent) document.getElementById('sync-spinner')?.classList.remove('hidden');
    try {
        const req = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const res = await req.json();
        return res;
    } catch(e) { return null; } finally { if(!silent) document.getElementById('sync-spinner')?.classList.add('hidden'); }
}

async function syncData() {
    const data = await api({ action: 'sync' }, true);
    if(!data) return;
    
    // Mantiene en memoria los filtros asignados para no perderlos
    const prevFiltroComprador = state.filtroComprador || 'Todos';
    const prevEncargados = state.encargadosCategorias || {};
    
    state = {...state, ...data, filtroComprador: prevFiltroComprador, encargadosCategorias: prevEncargados};
    
    let activa = state.semanas.find(s => s.Estado === 'Activa');
    state.semanaActual = activa ? activa.Semana_ID : null;
    
    if(activa && activa.Fecha_Inicio && activa.Fecha_Fin) {
        const fIn = typeof activa.Fecha_Inicio === 'string' ? activa.Fecha_Inicio.substring(0,10) : new Date(activa.Fecha_Inicio).toISOString().substring(0,10);
        const fFin = typeof activa.Fecha_Fin === 'string' ? activa.Fecha_Fin.substring(0,10) : new Date(activa.Fecha_Fin).toISOString().substring(0,10);
        document.getElementById('filtro-inicio').value = fIn;
        document.getElementById('filtro-fin').value = fFin;
        
        document.getElementById('filtro-editable').classList.add('hidden');
        document.getElementById('filtro-bloqueado').classList.remove('hidden');
        document.getElementById('txt-rango-fijo').innerText = `${formatearFechaAmigable(fIn)} al ${formatearFechaAmigable(fFin)}`;
        
        // Asignar límites al calendario de programación
        document.getElementById('plan-fecha').min = fIn;
        document.getElementById('plan-fecha').max = fFin;
    }

    renderAll();
}

const ui = {
    nav: (vista) => {
        ['recetario', 'plan', 'mercado', 'pagos', 'reportes'].forEach(v => {
            document.getElementById(`view-${v}`)?.classList.add('hidden');
            document.getElementById(`btn-nav-${v}`)?.classList.replace('text-blue-600', 'text-gray-500');
        });
        document.getElementById(`view-${vista}`)?.classList.remove('hidden');
        document.getElementById(`btn-nav-${vista}`)?.classList.replace('text-gray-500', 'text-blue-600');
        
        if (vista === 'reportes') {
            const fIn = document.getElementById('filtro-inicio').value;
            const fFin = document.getElementById('filtro-fin').value;
            if(fIn) document.getElementById('rep-inicio').value = fIn;
            if(fFin) document.getElementById('rep-fin').value = fFin;
        }
    },
    toggleModal: (id) => document.getElementById(id).classList.toggle('hidden')
};

function renderAll() { renderRecetario(); renderPlan(); renderMercado(); }
function actualizarDiccionario() { document.getElementById('datalist-dicc').innerHTML = state.diccionario.map(d => `<option value="${d.Articulo}">`).join(''); }

function formatearFechaAmigable(fechaStr) {
    if(!fechaStr) return 'Fecha Inválida';
    const puraFecha = fechaStr.substring(0, 10);
    const partes = puraFecha.split('-');
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
            <div class="flex justify-between items-center mb-1">
                <h4 class="font-bold text-gray-800 text-lg flex-1">${r.Nombre}</h4>
                <div class="flex gap-1">
                    <button onclick="document.getElementById('det-${r.ID_Plato}').classList.toggle('hidden')" class="text-gray-600 text-xs font-bold bg-gray-100 px-2 py-1 rounded shadow-sm hover:bg-gray-200">Detalle</button>
                    <button onclick="app.abrirEditarReceta('${r.ID_Plato}')" class="text-blue-500 text-xs font-bold bg-blue-50 px-2 py-1 rounded shadow-sm hover:bg-blue-100">✏️</button>
                    <button onclick="app.eliminarReceta('${r.ID_Plato}')" class="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded shadow-sm hover:bg-red-100">X</button>
                </div>
            </div>
            
            <div id="det-${r.ID_Plato}" class="hidden text-xs bg-gray-50 p-2 rounded text-gray-600 divide-y divide-gray-200 mt-2 border border-gray-100">
                ${ings.map(i => `
                <div class="py-1 flex flex-col justify-center">
                    <div class="flex justify-between items-center">
                        <span><span class="font-bold text-blue-600">${i.cantidad||1} ${i.unidad}</span> ${i.articulo}</span> 
                        <span class="text-gray-400 text-[9px] font-bold uppercase">Para: ${i.para} | Pago: ${i.quien_pago}</span>
                    </div>
                    ${i.comentario ? `<p class="text-[9px] italic text-gray-500 mt-0.5">"${i.comentario}"</p>` : ''}
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
                    ${platos.map(p => `
                        <div class="p-3 bg-blue-50 text-blue-900 rounded-lg text-sm border border-blue-100 flex flex-col gap-2">
                            <div class="flex justify-between items-start">
                                <span class="font-bold pr-2 cursor-pointer hover:underline" onclick="app.verIngredientesPlan('${p.Plan_ID}', '${p.Nombre_Plato}')">🍽️ ${p.Nombre_Plato} <span class="text-[10px] font-normal text-blue-500">(Ver 🛒)</span></span>
                                <button onclick="app.eliminarPlan('${p.Plan_ID}')" class="text-red-500 font-bold bg-red-100 px-3 py-1 rounded text-xs hover:bg-red-200 shadow-sm transition">X</button>
                            </div>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-[10px] text-gray-500 font-bold uppercase">Mover a:</span>
                                <input type="date" value="${p.Fecha.substring(0,10)}" onchange="app.cambiarFechaPlan('${p.Plan_ID}', this.value)" class="border border-blue-200 p-1 text-[10px] rounded bg-white font-bold text-blue-700 outline-none focus:ring-1 focus:ring-blue-400">
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }
    }
    document.getElementById('lista-plan').innerHTML = html;
}

function renderMercado() {
    // Render de botones de filtro y unión
    ['Todos', 'Carlos', 'Daniel'].forEach(v => {
        const btn = document.getElementById(`btn-comp-${v}`);
        if(btn) {
            if(state.filtroComprador === v) {
                btn.classList.replace('bg-gray-100', 'bg-gray-800');
                btn.classList.replace('text-gray-600', 'text-white');
                btn.classList.replace('border-transparent', 'border-gray-800');
            } else {
                btn.classList.replace('bg-gray-800', 'bg-gray-100');
                btn.classList.replace('text-white', 'text-gray-600');
                btn.classList.replace('border-gray-800', 'border-transparent');
            }
        }
    });

    const btnAgrupar = document.getElementById('btn-agrupar-mercado');
    if (btnAgrupar) {
        if(state.vistaAgrupada) {
            btnAgrupar.innerHTML = '📦 Desunir';
            btnAgrupar.className = 'w-1/4 bg-orange-100 text-orange-700 border border-orange-200 font-bold py-2 rounded-lg shadow-sm';
        } else {
            btnAgrupar.innerHTML = '📦 Unir';
            btnAgrupar.className = 'w-1/4 bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-2 rounded-lg shadow-sm';
        }
    }

    const fInicio = document.getElementById('filtro-inicio').value;
    const fFin = document.getElementById('filtro-fin').value;
    let items = state.mercado.filter(m => m.Semana_ID === state.semanaActual);

    if (fInicio || fFin) {
        items = items.filter(m => {
            if (!m.Fecha) return true; 
            const f = m.Fecha.substring(0, 10);
            return (!fInicio || f >= fInicio) && (!fFin || f <= fFin);
        });
    }

    // LÓGICA DE AGRUPACIÓN VISUAL SEGURA
    if (state.vistaAgrupada) {
        const agrupadosExactos = {};
        items.forEach(i => {
            if (i.Origen === 'Agrupación' || i.Estado === 'Comprado_Bloqueado') {
                agrupadosExactos[i.ID_Item] = i; // No mezclamos los totales cerrados
                return;
            }
            const key = `${i.Articulo.toLowerCase().trim()}|${i.Categoria}|${i.Unidad}|${i.Para}|${i.Quien_Pago}`;
            if (!agrupadosExactos[key]) {
                agrupadosExactos[key] = { ...i, Cantidad: parseFloat(i.Cantidad) || 1 };
            } else {
                agrupadosExactos[key].Cantidad += (parseFloat(i.Cantidad) || 1);
            }
        });
        items = Object.values(agrupadosExactos);
    }

    const agrupado = items.reduce((acc, obj) => {
        acc[obj.Categoria] = acc[obj.Categoria] || [];
        acc[obj.Categoria].push(obj);
        return acc;
    }, {});

    let infoFiltro = (fInicio || fFin) ? `🗓️ Mostrando del: ${fInicio||'∞'} al ${fFin||'∞'}` : `🗓️ Toda la semana`;
    let html = '';
    
    if (state.vistaAgrupada) {
        html += `<div class="bg-orange-100 text-orange-800 text-xs font-bold p-3 text-center mb-3 rounded-lg border border-orange-200 shadow-sm">⚠️ Vista Agrupada Activada.<br>Desune para poder ingresar los precios individualmente.</div>`;
    }

    html += `<div class="bg-blue-50 text-blue-800 font-bold p-3 rounded-lg text-center mb-4 text-xs border border-blue-200 shadow-sm">${infoFiltro}</div>`;
    
    if(items.length === 0) html += '<p class="text-center text-gray-400 mt-6 font-bold">No hay compras para estas fechas.</p>';
    
    for (const [cat, arts] of Object.entries(agrupado)) {
        let encargado = state.encargadosCategorias[cat] || 'Todos';
        if(state.filtroComprador !== 'Todos' && encargado !== state.filtroComprador) continue; 

        const itemsPendientes = arts.filter(a => a.Estado !== 'Comprado_Bloqueado' && a.Origen !== 'Agrupación');
        const botonCerrar = itemsPendientes.length > 0 
            ? `<button onclick="app.cerrarCategoria('${cat}')" class="bg-red-500 px-3 py-1 rounded text-xs font-bold text-white hover:bg-red-600 shadow-sm">Cerrar</button>`
            : `<span class="bg-gray-300 text-gray-600 px-3 py-1 rounded text-xs font-bold">Cerrado</span>`;

        html += `
        <div class="bg-white rounded-xl shadow-sm mb-4 overflow-hidden border border-gray-200">
            <div id="cat-head-${cat}" class="bg-gray-800 text-white p-2 flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold uppercase text-xs">${cat}</h4>
                    <select onchange="app.setEncargadoCat('${cat}', this.value)" class="text-black text-[10px] p-1 rounded font-bold outline-none border border-gray-300">
                        <option value="Todos" ${encargado === 'Todos' ? 'selected' : ''}>🛒 Va a comprar: Ambos</option>
                        <option value="Carlos" ${encargado === 'Carlos' ? 'selected' : ''}>🛒 Va a comprar: Carlos</option>
                        <option value="Daniel" ${encargado === 'Daniel' ? 'selected' : ''}>🛒 Va a comprar: Daniel</option>
                    </select>
                </div>
                <div class="flex gap-2 items-center justify-between border-t border-gray-600 pt-2">
                    <select class="cat-para text-black text-[10px] p-1 rounded font-bold outline-none"><option value="Ambos">Para: Ambos</option><option value="Carlos">Para: Carlos</option><option value="Daniel">Para: Daniel</option></select>
                    <select class="cat-quien text-black text-[10px] p-1 rounded font-bold outline-none"><option value="Pendiente">Pago: Pndte.</option><option value="Carlos">Pago: Carlos</option><option value="Daniel">Pago: Daniel</option></select>
                    <input type="number" class="cat-total text-black text-[10px] p-1 rounded font-bold w-16 text-center outline-none" placeholder="Costo S/">
                    ${botonCerrar}
                </div>
            </div>
            <div class="p-2 space-y-2">
        `;
        arts.forEach(a => {
            const isBlocked = a.Estado === 'Comprado_Bloqueado';
            const isComprado = a.Estado === 'Comprado';
            const disableInput = (isBlocked || state.vistaAgrupada) ? 'disabled' : '';
            const txtUnidad = a.Origen === 'Agrupación' ? '(Total)' : `(${a.Cantidad || 1} ${a.Unidad})`; 
            const commentHtml = a.Comentario ? `<p class="text-[9px] italic text-blue-500 mt-1 font-bold">"${a.Comentario}"</p>` : '';
            
            html += `
            <div id="row-${a.ID_Item}" class="flex flex-wrap gap-2 items-center p-2 border-b border-gray-100 last:border-0 bg-gray-50 rounded">
                <input type="checkbox" class="chk-estado w-4 h-4 accent-blue-600" ${isComprado||isBlocked ? 'checked' : ''} ${disableInput} onchange="app.updateItem('${a.ID_Item}')">
                <div class="flex-1 flex flex-col min-w-0">
                    <span class="font-bold text-xs truncate ${isBlocked ? 'line-through text-gray-400' : 'text-gray-800'}">${a.Articulo} <span class="font-normal text-blue-600">${txtUnidad}</span></span>
                    ${commentHtml}
                </div>
                <select class="sel-para border p-1 text-[10px] rounded font-bold text-gray-700 outline-none" ${disableInput} onchange="app.updateItem('${a.ID_Item}')">
                    <option value="Ambos" ${a.Para==='Ambos'?'selected':''}>Para: Ambos</option>
                    <option value="Carlos" ${a.Para==='Carlos'?'selected':''}>Para: Carlos</option>
                    <option value="Daniel" ${a.Para==='Daniel'?'selected':''}>Para: Daniel</option>
                </select>
                <select class="sel-quien border p-1 text-[10px] rounded font-bold text-gray-700 outline-none" ${disableInput} onchange="app.updateItem('${a.ID_Item}')">
                    <option value="Pendiente" ${a.Quien_Pago==='Pendiente'?'selected':''}>Pago: Pndte.</option>
                    <option value="Carlos" ${a.Quien_Pago==='Carlos'?'selected':''}>Pago: Carlos</option>
                    <option value="Daniel" ${a.Quien_Pago==='Daniel'?'selected':''}>Pago: Daniel</option>
                </select>
                <input type="number" class="inp-precio border border-gray-300 p-1 text-[10px] w-14 rounded text-center font-bold text-gray-800 outline-none" placeholder="S/" value="${a.Precio||''}" ${disableInput} onchange="app.updateItem('${a.ID_Item}')">
            </div>`;
        });
        html += `</div></div>`;
    }
    document.getElementById('lista-mercado').innerHTML = html;
}

// ================= CONTROLADOR PRINCIPAL =================
const app = {
    setFiltroComprador: (val) => { state.filtroComprador = val; renderMercado(); },
    setEncargadoCat: (cat, val) => { state.encargadosCategorias[cat] = val; renderMercado(); },
    
    // TOGGLE AGRUPAR
    toggleAgruparMercado: () => {
        state.vistaAgrupada = !state.vistaAgrupada;
        renderMercado();
    },

    confirmarSemana: () => {
        const fIn = document.getElementById('filtro-inicio').value;
        const fFin = document.getElementById('filtro-fin').value;
        if(!fIn || !fFin) return alert("Por favor selecciona la Fecha de Inicio y la Fecha de Fin.");

        document.getElementById('filtro-editable').classList.add('hidden');
        document.getElementById('filtro-bloqueado').classList.remove('hidden');
        document.getElementById('txt-rango-fijo').innerText = `${formatearFechaAmigable(fIn)} al ${formatearFechaAmigable(fFin)}`;

        // Limita el calendario de programación al rango
        document.getElementById('plan-fecha').min = fIn;
        document.getElementById('plan-fecha').max = fFin;

        app.aplicarFiltroGlobal();
        ui.toggleModal('modal-exito');
        api({ action: 'update_semana_dates', semana_id: state.semanaActual, fInicio: fIn, fFin: fFin }, true);
    },

    modificarSemana: () => {
        document.getElementById('filtro-bloqueado').classList.add('hidden');
        document.getElementById('filtro-editable').classList.remove('hidden');
        document.getElementById('plan-fecha').removeAttribute('min');
        document.getElementById('plan-fecha').removeAttribute('max');
    },

    aplicarFiltroGlobal: () => {
        renderPlan();
        renderMercado();
        if(!document.getElementById('view-pagos').classList.contains('hidden')) app.calcularPagos();
    },

    addIngredienteTemp: (contexto) => {
        const prefix = contexto === 'rec' ? 'rec' : 'plan';
        const art = document.getElementById(`${prefix}-ing-art`).value;
        const cant = document.getElementById(`${prefix}-ing-cant`).value;
        const com = document.getElementById(`${prefix}-ing-com`) ? document.getElementById(`${prefix}-ing-com`).value : '';
        if(!art) return alert("El nombre del artículo es obligatorio");
        state.tempIngredientes.push({ articulo: art, cantidad: cant || 1, categoria: document.getElementById(`${prefix}-ing-cat`).value, unidad: document.getElementById(`${prefix}-ing-uni`).value, para: document.getElementById(`${prefix}-ing-para`).value, quien_pago: document.getElementById(`${prefix}-ing-quien`).value, comentario: com });
        document.getElementById(`${prefix}-ing-art`).value = ''; document.getElementById(`${prefix}-ing-cant`).value = '';
        if(document.getElementById(`${prefix}-ing-com`)) document.getElementById(`${prefix}-ing-com`).value = '';
        app.renderTempIngredientes(contexto);
    },
    editarIngredienteTemp: (index, contexto) => {
        const prefix = contexto === 'rec' ? 'rec' : 'plan';
        const item = state.tempIngredientes[index];
        document.getElementById(`${prefix}-ing-art`).value = item.articulo;
        document.getElementById(`${prefix}-ing-cant`).value = item.cantidad;
        document.getElementById(`${prefix}-ing-cat`).value = item.categoria;
        document.getElementById(`${prefix}-ing-uni`).value = item.unidad;
        document.getElementById(`${prefix}-ing-para`).value = item.para;
        document.getElementById(`${prefix}-ing-quien`).value = item.quien_pago;
        if(document.getElementById(`${prefix}-ing-com`)) document.getElementById(`${prefix}-ing-com`).value = item.comentario || '';
        state.tempIngredientes.splice(index, 1);
        app.renderTempIngredientes(contexto);
    },
    removerIngredienteTemp: (index, contexto) => { state.tempIngredientes.splice(index, 1); app.renderTempIngredientes(contexto); },
    renderTempIngredientes: (contexto) => {
        const prefix = contexto === 'rec' ? 'rec' : 'plan';
        const listaId = contexto === 'rec' ? 'lista-ingredientes-temp' : 'lista-plan-ingredientes-temp';
        const lista = document.getElementById(listaId);
        if(!lista) return;

        lista.innerHTML = state.tempIngredientes.map((i, index) => `
            <li class="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0 text-gray-700">
                <div class="flex flex-col flex-1 pr-2">
                    <span>${i.articulo} <span class="font-bold text-blue-600 ml-1">${i.cantidad} ${i.unidad}</span></span>
                    <span class="text-[10px] uppercase text-gray-400 font-bold">Para: ${i.para || 'Ambos'} | Pago: ${i.quien_pago || 'Pendiente'}</span>
                    ${i.comentario ? `<span class="text-[9px] text-blue-400 italic">"${i.comentario}"</span>` : ''}
                </div>
                <div class="flex gap-1">
                    <button type="button" onclick="app.editarIngredienteTemp(${index}, '${contexto}')" class="text-blue-500 font-bold px-3 py-1 bg-blue-50 rounded text-xs hover:bg-blue-100 shadow-sm">✏️</button>
                    <button type="button" onclick="app.removerIngredienteTemp(${index}, '${contexto}')" class="text-red-500 font-bold px-3 py-1 bg-red-50 rounded text-xs hover:bg-red-100 shadow-sm">X</button>
                </div>
            </li>`).join('');
    },

    abrirNuevaReceta: () => {
        state.editandoPlatoID = null; document.getElementById('titulo-modal-receta').innerText = "Nueva Receta"; document.getElementById('rec-nombre').value = '';
        state.tempIngredientes = []; app.renderTempIngredientes('rec'); ui.toggleModal('modal-receta');
    },
    abrirEditarReceta: (id) => {
        state.editandoPlatoID = id; const receta = state.recetario.find(r => r.ID_Plato === id);
        document.getElementById('titulo-modal-receta').innerText = "Editar Receta"; document.getElementById('rec-nombre').value = receta.Nombre;
        state.tempIngredientes = JSON.parse(receta.Ingredientes_JSON || '[]'); app.renderTempIngredientes('rec'); ui.toggleModal('modal-receta');
    },
    eliminarReceta: (id) => {
        if(!confirm("¿Seguro que deseas eliminar este plato definitivamente?")) return;
        state.recetario = state.recetario.filter(r => r.ID_Plato !== id); renderRecetario(); api({ action: 'delete_receta', id: id }, true); 
    },
    guardarReceta: () => {
        const nombre = document.getElementById('rec-nombre').value;
        if(!nombre) return alert("Falta el nombre de la receta");
        const recetaID = state.editandoPlatoID || "PLT-" + Date.now();
        const nuevaReceta = { ID_Plato: recetaID, Nombre: nombre, Ingredientes_JSON: JSON.stringify(state.tempIngredientes) };
        if(state.editandoPlatoID) {
            const idx = state.recetario.findIndex(r => r.ID_Plato === state.editandoPlatoID);
            if(idx !== -1) state.recetario[idx] = nuevaReceta;
        } else { state.recetario.push(nuevaReceta); }
        renderRecetario(); ui.toggleModal('modal-receta');
        api({ action: state.editandoPlatoID ? 'update_receta' : 'save_receta', data: { id: recetaID, nombre: nombre, ingredientes: nuevaReceta.Ingredientes_JSON } }, true);
    },

    prepararPlan: () => {
        const fecha = document.getElementById('plan-fecha').value; 
        const id_plato = document.getElementById('plan-plato').value;
        const plato = state.recetario.find(p => p.ID_Plato === id_plato);
        
        if(!fecha) return alert("Selecciona una fecha.");
        
        const fIn = document.getElementById('filtro-inicio').value;
        const fFin = document.getElementById('filtro-fin').value;
        if(fIn && fFin && (fecha < fIn || fecha > fFin)) {
            return alert(`Por favor, programa el plato dentro de la semana seleccionada:\nDel ${formatearFechaAmigable(fIn)} al ${formatearFechaAmigable(fFin)}.`);
        }

        if(!plato) return alert("Selecciona un plato.");
        state.tempPlanMeta = { fecha, id_plato: plato.ID_Plato, nombre_plato: plato.Nombre };
        state.tempIngredientes = JSON.parse(plato.Ingredientes_JSON || '[]');
        document.getElementById('plan-modal-subtitulo').innerText = `${plato.Nombre} - ${formatearFechaAmigable(fecha)}`;
        app.renderTempIngredientes('plan'); ui.toggleModal('modal-plan-ingredientes');
    },
    confirmarPlan: () => {
        const btn = document.getElementById('btn-confirmar-plan'); btn.innerText = '¡Programado!'; setTimeout(() => { btn.innerText = 'Confirmar y Programar'; }, 1000);
        const planID = "PLN-" + Date.now();
        const meta = state.tempPlanMeta;
        state.plan.push({ Plan_ID: planID, Semana_ID: state.semanaActual, Fecha: meta.fecha, ID_Plato: meta.id_plato, Nombre_Plato: meta.nombre_plato });
        state.tempIngredientes.forEach(ing => {
            state.mercado.push({ ID_Item: "ITM-" + Date.now() + Math.floor(Math.random() * 1000), Semana_ID: state.semanaActual, Plan_ID: planID, Articulo: ing.articulo, Categoria: ing.categoria, Unidad: ing.unidad, Cantidad: ing.cantidad || 1, Para: ing.para || "Ambos", Quien_Pago: ing.quien_pago || "Pendiente", Precio: 0, Estado: "Pendiente", Origen: "Receta", Fecha: meta.fecha, Comentario: ing.comentario || "" });
        });
        renderPlan(); renderMercado(); document.getElementById('plan-fecha').value = ''; ui.toggleModal('modal-plan-ingredientes');
        api({ action: 'save_plan', plan_id: planID, semana_id: state.semanaActual, fecha: meta.fecha, id_plato: meta.id_plato, nombre_plato: meta.nombre_plato, ingredientes: JSON.stringify(state.tempIngredientes) }, true);
    },
    verIngredientesPlan: (planID, nombrePlato) => {
        const items = state.mercado.filter(m => m.Plan_ID === planID);
        document.getElementById('subtitulo-ver-ingredientes').innerText = nombrePlato;
        const lista = document.getElementById('lista-ver-ingredientes');
        if (items.length === 0) { lista.innerHTML = '<li class="text-gray-400">Ingredientes ya no disponibles.</li>'; } 
        else {
            lista.innerHTML = items.map(i => `
                <li class="border-b border-gray-200 pb-1 last:border-0">
                    <span class="font-bold text-gray-800">${i.Articulo}</span> <span class="text-blue-600">(${i.Cantidad || 1} ${i.Unidad})</span>
                    ${i.Comentario ? `<p class="text-[9px] text-gray-500 italic mt-0.5">"${i.Comentario}"</p>` : ''}
                </li>`).join('');
        }
        ui.toggleModal('modal-ver-ingredientes');
    },
    cambiarFechaPlan: (planID, nuevaFecha) => {
        if(!nuevaFecha) return;
        const planIdx = state.plan.findIndex(p => p.Plan_ID === planID);
        if(planIdx !== -1) state.plan[planIdx].Fecha = nuevaFecha;
        state.mercado.forEach(m => { if(m.Plan_ID === planID) m.Fecha = nuevaFecha; });
        renderPlan(); renderMercado(); api({ action: 'update_plan_date', plan_id: planID, nueva_fecha: nuevaFecha }, true);
    },
    eliminarPlan: (planID) => {
        if(!confirm("¿Eliminar este plato del calendario y sus ingredientes del mercado?")) return;
        state.plan = state.plan.filter(p => p.Plan_ID !== planID); state.mercado = state.mercado.filter(m => m.Plan_ID !== planID);
        renderPlan(); renderMercado(); api({ action: 'delete_plan', plan_id: planID }, true);
    },
    
    eliminarSemanaActual: async () => {
        if(!confirm("⚠️ PELIGRO: ¿Estás seguro que deseas ELIMINAR TODA LA SEMANA ACTUAL?\n\nEsto borrará todo el plan programado y todo el mercado de la semana activa. Esta acción no se puede deshacer.")) return;
        if(!confirm("¿ÚLTIMA ADVERTENCIA: Confirmas eliminar la semana completa?")) return;
        
        // Limpiamos la vista inmediatamente
        document.getElementById('filtro-inicio').value = '';
        document.getElementById('filtro-fin').value = '';
        document.getElementById('plan-fecha').value = '';
        app.modificarSemana();
        
        document.getElementById('sync-spinner').classList.remove('hidden');
        await api({ action: 'delete_semana', semana_id: state.semanaActual }, true);
        await syncData();
    },

    abrirModalManual: () => {
        const fInicio = document.getElementById('filtro-inicio').value;
        document.getElementById('man-fecha').value = fInicio || new Date().toISOString().substring(0, 10);
        document.getElementById('man-art').value = ''; document.getElementById('man-precio').value = ''; 
        if(document.getElementById('man-com')) document.getElementById('man-com').value = '';
        ui.toggleModal('modal-item-manual');
    },
    guardarManual: () => {
        const btn = document.getElementById('btn-save-manual'); btn.innerText = 'Guardando...'; 
        const fechaAsignada = document.getElementById('man-fecha').value;
        const newItem = {
            id: "ITM-" + Date.now(), semana_id: state.semanaActual, articulo: document.getElementById('man-art').value, cantidad: document.getElementById('man-cant').value || 1, categoria: document.getElementById('man-cat').value, unidad: document.getElementById('man-uni').value, para: document.getElementById('man-para').value, quien_pago: document.getElementById('man-quien').value, precio: document.getElementById('man-precio').value || 0, estado: "Pendiente", fecha: fechaAsignada, comentario: document.getElementById('man-com') ? document.getElementById('man-com').value : ""
        };
        state.mercado.push({ ID_Item: newItem.id, Semana_ID: newItem.semana_id, Plan_ID: "", Articulo: newItem.articulo, Categoria: newItem.categoria, Unidad: newItem.unidad, Cantidad: newItem.cantidad, Para: newItem.para, Quien_Pago: newItem.quien_pago, Precio: newItem.precio, Estado: newItem.estado, Origen: "Manual", Fecha: newItem.fecha, Comentario: newItem.comentario });
        renderMercado(); ui.toggleModal('modal-item-manual'); if(btn) btn.innerText = 'Agregar';
        api({ action: 'add_mercado', data: newItem }, true);
    },
    
    updateItem: (id) => {
        const row = document.getElementById(`row-${id}`);
        const para = row.querySelector('.sel-para').value;
        const quien = row.querySelector('.sel-quien').value;
        const precioVal = parseFloat(row.querySelector('.inp-precio').value) || 0;
        let estado = row.querySelector('.chk-estado').checked ? "Comprado" : "Pendiente";

        if (precioVal > 0 && quien !== 'Pendiente' && estado === 'Pendiente') { estado = "Comprado"; row.querySelector('.chk-estado').checked = true; }

        const item = state.mercado.find(m => m.ID_Item === id);
        if(item) { item.Para = para; item.Quien_Pago = quien; item.Precio = row.querySelector('.inp-precio').value; item.Estado = estado; }

        const textoArticulo = row.querySelector('.flex-1 span');
        if (estado === 'Comprado_Bloqueado') { textoArticulo.classList.add('line-through', 'text-gray-400'); textoArticulo.classList.remove('text-gray-800'); } 
        else { textoArticulo.classList.remove('line-through', 'text-gray-400'); textoArticulo.classList.add('text-gray-800'); }
        api({ action: 'update_item', data: { id, para, quien_pago: quien, precio: item.Precio, estado } }, true); 
    },
    
    cerrarCategoria: (cat) => {
        const cont = document.getElementById(`cat-head-${cat}`);
        const totalInput = parseFloat(cont.querySelector('.cat-total').value) || 0;
        const para = cont.querySelector('.cat-para').value;
        const quien = cont.querySelector('.cat-quien').value;
        
        const itemsCat = state.mercado.filter(m => m.Semana_ID === state.semanaActual && m.Categoria === cat && m.Origen !== "Agrupación" && m.Estado !== "Comprado_Bloqueado");
        if (itemsCat.length === 0) return alert("Esta categoría ya está cerrada.");

        const todosTienenPrecio = itemsCat.length > 0 && itemsCat.every(m => parseFloat(m.Precio) > 0 && m.Quien_Pago !== "Pendiente");

        if(totalInput === 0 && !todosTienenPrecio) {
            return alert(`Para cerrar la categoría "${cat}" debes:\n\n1. Colocar el Costo Total, Para y Pago en la caja de arriba.\nO\n2. Ingresar el precio y pagador a TODOS los artículos individualmente.`);
        }
        if (totalInput > 0 && quien === 'Pendiente') return alert("Si vas a cerrar por Total de Categoría, debes seleccionar quién lo pagó en el desplegable superior.");

        const tipoCierre = totalInput > 0 ? "total" : "individual";
        let msg = `¿Seguro que deseas CERRAR la categoría "${cat}"?\n\n`;
        if (tipoCierre === "total") msg += `Has indicado un Total Global de S/ ${totalInput}. Los precios individuales en esta categoría se volverán 0 para evitar cobrarte doble.`;
        else msg += `Todos los artículos tienen precio individual. Se bloquearán para proteger la suma y se añadirán al cálculo global.`;

        if(!confirm(msg)) return;

        const fInicio = document.getElementById('filtro-inicio').value;
        const fechaBloqueo = fInicio || new Date().toISOString().substring(0, 10);

        itemsCat.forEach(m => {
            if(tipoCierre === "total") { m.Para = para; m.Quien_Pago = quien; m.Precio = 0; }
            m.Estado = "Comprado_Bloqueado";
        });
        
        if (tipoCierre === "total") {
            state.mercado.push({ ID_Item: "ITM-" + Date.now(), Semana_ID: state.semanaActual, Plan_ID: "", Articulo: "TOTAL " + cat, Categoria: cat, Unidad: "soles", Cantidad: 1, Para: para, Quien_Pago: quien, Precio: totalInput, Estado: "Comprado", Origen: "Agrupación", Fecha: fechaBloqueo, Comentario: "Cierre de categoría" });
        }
        renderMercado();
        api({ action: 'cerrar_categoria', semana_id: state.semanaActual, categoria: cat, total: totalInput, para: para, quien_pago: quien, fecha: fechaBloqueo, tipo_cierre: tipoCierre }, true);
    },

    calcularPagos: () => {
        const fIn = document.getElementById('filtro-inicio').value;
        const fFin = document.getElementById('filtro-fin').value;

        let items = state.mercado.filter(m => m.Semana_ID === state.semanaActual);
        if (fIn || fFin) {
            items = items.filter(m => {
                if (!m.Fecha) return true;
                const f = m.Fecha.substring(0, 10);
                return (!fIn || f >= fIn) && (!fFin || f <= fFin);
            });
        }
        
        // ALERTA DE PREVENCIÓN: Bloquea el cálculo si hay cosas pendientes
        const pendientes = items.some(i => i.Estado === 'Pendiente' && i.Origen !== 'Agrupación');
        if (pendientes) {
            return alert("⚠️ Aún tienes artículos pendientes de compra.\n\nPor favor, ingresa sus precios individualmente o cierra la categoría completa en la vista Mercado antes de sacar las cuentas finales.");
        }
        
        let pagoCarlos = 0, pagoDaniel = 0, gastoAmbos = 0, gastoCarlos = 0, gastoDaniel = 0;
        let listaValidos = [];

        items.forEach(i => {
            let p = parseFloat(i.Precio) || 0;
            if (p > 0 && i.Quien_Pago !== 'Pendiente' && (i.Estado === 'Comprado' || i.Estado === 'Comprado_Bloqueado' || i.Origen === 'Agrupación')) {
                listaValidos.push(i); 
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

        const rangoMsg = (fIn || fFin) ? `Filtro aplicado: ${fIn||'Inicio'} al ${fFin||'Fin'}` : "Toda la semana";
        document.getElementById('pagos-rango-fechas').innerText = rangoMsg;

        document.getElementById('pagos-detalle').innerHTML = `
            <div class="text-left space-y-4 text-sm mt-4">
                <div class="flex justify-between border-b border-gray-200 pb-2 font-black text-lg text-gray-800">
                    <span>Costo Total Calculado:</span> <span>S/ ${totalGeneral.toFixed(2)}</span>
                </div>
                <div>
                    <p class="font-bold text-gray-700 mb-1">1. Consumo Realizado:</p>
                    <ul class="text-gray-600 pl-2 space-y-1 bg-gray-50 p-2 rounded border border-gray-100">
                        <li class="flex justify-between"><span>Compartido (Ambos):</span> <span class="font-bold">S/ ${gastoAmbos.toFixed(2)}</span></li>
                        <li class="flex justify-between"><span>Solo consumió Carlos:</span> <span class="font-bold">S/ ${gastoCarlos.toFixed(2)}</span></li>
                        <li class="flex justify-between"><span>Solo consumió Daniel:</span> <span class="font-bold">S/ ${gastoDaniel.toFixed(2)}</span></li>
                    </ul>
                </div>
                <div>
                    <p class="font-bold text-gray-700 mb-1">2. Cuota Ideal (Mitad Compartido + Individual):</p>
                    <ul class="text-gray-600 pl-2 space-y-1 bg-blue-50 p-2 rounded border border-blue-100">
                        <li class="flex justify-between font-bold text-blue-700"><span>Deuda Carlos:</span> <span>S/ ${debeCarlos.toFixed(2)}</span></li>
                        <li class="flex justify-between font-bold text-blue-700"><span>Deuda Daniel:</span> <span>S/ ${debeDaniel.toFixed(2)}</span></li>
                    </ul>
                </div>
                <div>
                    <p class="font-bold text-gray-700 mb-1">3. Pagos Físicos (Sacado de la billetera):</p>
                    <ul class="text-gray-600 pl-2 space-y-1 bg-green-50 p-2 rounded border border-green-100">
                        <li class="flex justify-between font-bold text-green-700"><span>Carlos pagó:</span> <span>S/ ${pagoCarlos.toFixed(2)}</span></li>
                        <li class="flex justify-between font-bold text-green-700"><span>Daniel pagó:</span> <span>S/ ${pagoDaniel.toFixed(2)}</span></li>
                    </ul>
                </div>
            </div>
        `;

        let listaHTML = '<p class="font-bold text-gray-700 mb-2">Artículos Contabilizados en el Cuadre:</p><ul class="text-xs space-y-1 bg-white border border-gray-200 rounded p-2 h-48 overflow-y-auto">';
        if(listaValidos.length === 0) listaHTML += '<li class="text-gray-400">No hay artículos que cumplan los filtros.</li>';
        listaValidos.forEach(i => {
            listaHTML += `<li class="flex justify-between border-b border-gray-100 last:border-0 pb-1 pt-1">
                <span class="truncate pr-2">${i.Articulo} <span class="text-gray-400 block text-[9px] uppercase">Para: ${i.Para} | Por: ${i.Quien_Pago}</span></span> 
                <span class="font-bold whitespace-nowrap">S/ ${parseFloat(i.Precio).toFixed(2)}</span>
            </li>`;
        });
        listaHTML += '</ul>';
        document.getElementById('pagos-lista-articulos').innerHTML = listaHTML;

        let saldoCarlos = pagoCarlos - debeCarlos; 
        let msg = "Cuentas saldadas. Nadie debe nada.";
        let bgClass = "bg-gray-100 text-gray-800 border-gray-300";
        if(saldoCarlos > 0.05) { msg = `💵 Daniel transfiere a Carlos: S/ ${Math.abs(saldoCarlos).toFixed(2)}`; bgClass = "bg-orange-100 text-orange-800 border-orange-200"; } 
        else if (saldoCarlos < -0.05) { msg = `💵 Carlos transfiere a Daniel: S/ ${Math.abs(saldoCarlos).toFixed(2)}`; bgClass = "bg-orange-100 text-orange-800 border-orange-200"; }
        
        const deudasDiv = document.getElementById('pagos-resultado-final'); deudasDiv.innerText = msg; deudasDiv.className = `p-4 rounded-lg font-black text-center mt-4 border ${bgClass}`;
        document.getElementById('resultados-pagos').classList.remove('hidden');
    },

    cerrarSemana: async () => {
        if(!confirm("¿Seguro que deseas cerrar la semana? Esto congelará los gastos y limpiará el mercado.")) return;
        await api({ action: 'cerrar_semana', semana_id: state.semanaActual, nueva_semana_id: "SEM-" + Date.now() });
        document.getElementById('resultados-pagos').classList.add('hidden');
        syncData();
    },

    generarReporteHistorico: () => {
        const fIn = document.getElementById('rep-inicio').value;
        const fFin = document.getElementById('rep-fin').value;
        if(!fIn || !fFin) return alert("Selecciona fecha de inicio y fin para buscar.");

        let items = state.mercado.filter(m => m.Estado === 'Comprado' || m.Estado === 'Comprado_Bloqueado');
        items = items.filter(m => {
            let f = m.Fecha;
            if(!f) { const sem = state.semanas.find(s => s.Semana_ID === m.Semana_ID); f = sem ? sem.Fecha_Inicio : "2020-01-01"; }
            f = f.substring(0, 10);
            return f >= fIn && f <= fFin;
        });

        let total = 0, porCat = {}, carlosConsume = 0, danielConsume = 0, ambosConsume = 0;
        items.forEach(i => {
            let p = parseFloat(i.Precio) || 0;
            if (p > 0) {
                total += p; porCat[i.Categoria] = (porCat[i.Categoria] || 0) + p;
                if(i.Para === 'Ambos') ambosConsume += p; else if(i.Para === 'Carlos') carlosConsume += p; else if(i.Para === 'Daniel') danielConsume += p;
            }
        });

        const htmlCategorias = Object.entries(porCat).sort((a,b) => b[1] - a[1]).map(([cat, val]) => `<li class="flex justify-between border-b border-gray-100 py-1"><span>${cat}</span> <span class="font-bold">S/ ${val.toFixed(2)}</span></li>`).join('');
        document.getElementById('res-hist-total').innerText = `S/ ${total.toFixed(2)}`;
        document.getElementById('res-hist-cat').innerHTML = htmlCategorias || '<p class="text-xs text-gray-400">No hay datos de categoría.</p>';
        document.getElementById('res-hist-cons').innerHTML = `<li class="flex justify-between"><span>Compartido (Ambos):</span> <span class="font-bold">S/ ${ambosConsume.toFixed(2)}</span></li><li class="flex justify-between"><span>Solo Carlos:</span> <span class="font-bold">S/ ${carlosConsume.toFixed(2)}</span></li><li class="flex justify-between"><span>Solo Daniel:</span> <span class="font-bold">S/ ${danielConsume.toFixed(2)}</span></li>`;
        document.getElementById('contenedor-resultados-historicos').classList.remove('hidden');
    }
};
