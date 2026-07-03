const API_URL = "https://script.google.com/macros/s/AKfycbwhY4JQUbf5x8tu6_dcd1NPs8onH1hIHLKcOVuoz_cYWcxrVr8IomsN84FF9R39gOM/exec"; 

let state = {
    diccionario: [], recetario: [], plan: [], mercado: [], semanas: [],
    semanaActual: null, tempIngredientes: [], editandoPlatoID: null
};

// ================= AUTENTICACIÓN =================
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

// ================= INICIALIZACIÓN =================
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
    }
}

async function api(payload, silent = false) {
    payload.token = auth.getToken(); 
    if(!silent) document.getElementById('sync-spinner')?.classList.remove('hidden');
    try {
        const req = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const res = await req.json();
        if (res.error) { alert(res.error); return null; }
        return res;
    } catch(e) { return null; } finally { if(!silent) document.getElementById('sync-spinner')?.classList.add('hidden'); }
}

async function syncData() {
    const data = await api({ action: 'sync' }, true);
    if(!data) return;
    state = {...state, ...data};
    let activa = state.semanas.find(s => s.Estado === 'Activa');
    state.semanaActual = activa ? activa.Semana_ID : null;
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
    },
    toggleModal: (id) => document.getElementById(id).classList.toggle('hidden')
};

function renderAll() {
    if(document.getElementById('view-recetario')) renderRecetario();
    if(document.getElementById('view-plan')) renderPlan();
    if(document.getElementById('view-mercado')) renderMercado();
}

// ================= LÓGICA DE NEGOCIO Y CÁLCULOS =================
const app = {
    // --- Plan Semanal ---
    guardarPlan: async () => {
        const fecha = document.getElementById('plan-fecha').value;
        const id_plato = document.getElementById('plan-plato').value;
        const plato = state.recetario.find(p => p.ID_Plato === id_plato);
        if(!fecha || !plato) return alert("Completa los datos");

        const planID = "PLN-" + Date.now();
        state.plan.push({ Plan_ID: planID, Semana_ID: state.semanaActual, Fecha: fecha, ID_Plato: plato.ID_Plato, Nombre_Plato: plato.Nombre });
        
        renderPlan();
        alert("✅ Plato programado");
        api({ action: 'save_plan', plan_id: planID, semana_id: state.semanaActual, fecha, id_plato: plato.ID_Plato, nombre_plato: plato.Nombre, ingredientes: plato.Ingredientes_JSON }, true);
    },

    // --- Mercado Optimizado ---
    updateItem: (id) => {
        const row = document.getElementById(`row-${id}`);
        const item = state.mercado.find(m => m.ID_Item === id);
        if(item) {
            item.Para = row.querySelector('.sel-para').value;
            item.Precio = row.querySelector('.inp-precio').value;
            item.Estado = row.querySelector('.chk-estado').checked ? "Comprado" : "Pendiente";
        }
        api({ action: 'update_item', data: { id, para: item.Para, precio: item.Precio, estado: item.Estado } }, true);
    },

    // --- Pagos (Cálculo corregido con desgloses) ---
    calcularPagos: () => {
        const items = state.mercado.filter(m => m.Semana_ID === state.semanaActual);
        let pagoCarlos = 0, pagoDaniel = 0, gastoAmbos = 0, gastoCarlos = 0, gastoDaniel = 0;
        let listaValidos = [];

        items.forEach(i => {
            let p = parseFloat(i.Precio) || 0;
            // Suma todo lo comprado, bloqueado o agrupado
            if (p > 0 && i.Quien_Pago !== 'Pendiente' && (i.Estado === 'Comprado' || i.Estado === 'Comprado_Bloqueado' || i.Origen === 'Agrupación')) {
                listaValidos.push(i);
                if(i.Quien_Pago === 'Carlos') pagoCarlos += p;
                if(i.Quien_Pago === 'Daniel') pagoDaniel += p;
                if(i.Para === 'Ambos') gastoAmbos += p;
                else if(i.Para === 'Carlos') gastoCarlos += p;
                else if(i.Para === 'Daniel') gastoDaniel += p;
            }
        });

        const debeCarlos = (gastoAmbos / 2) + gastoCarlos;
        const debeDaniel = (gastoAmbos / 2) + gastoDaniel;
        const totalPagado = pagoCarlos + pagoDaniel;

        // Renderizado del desglose...
        document.getElementById('pagos-detalle').innerHTML = `
            <div class="space-y-2 text-sm">
                <p>Total pagado: S/ ${totalPagado.toFixed(2)}</p>
                <p>Carlos debía pagar: S/ ${debeCarlos.toFixed(2)}</p>
                <p>Daniel debía pagar: S/ ${debeDaniel.toFixed(2)}</p>
            </div>`;
        
        let saldoCarlos = pagoCarlos - debeCarlos;
        document.getElementById('pagos-resultado-final').innerText = saldoCarlos > 0.1 ? `Daniel debe pagar a Carlos: S/ ${Math.abs(saldoCarlos).toFixed(2)}` : (saldoCarlos < -0.1 ? `Carlos debe pagar a Daniel: S/ ${Math.abs(saldoCarlos).toFixed(2)}` : "Cuentas saldadas");
        document.getElementById('resultados-pagos').classList.remove('hidden');
    }
};
