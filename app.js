const API_URL = "https://script.google.com/macros/s/AKfycbwhY4JQUbf5x8tu6_dcd1NPs8onH1hIHLKcOVuoz_cYWcxrVr8IomsN84FF9R39gOM/exec"; 

let state = {
    mercado: [], plan: [], recetario: [], semanaActual: null
};

// ================= LÓGICA DE VELOCIDAD (OPTIMISTIC UI) =================
const app = {
    updateItem: (id) => {
        const row = document.getElementById(`row-${id}`);
        const item = state.mercado.find(m => m.ID_Item === id);
        if(!item) return;

        // Actualización instantánea en memoria
        item.Para = row.querySelector('.sel-para').value;
        item.Precio = row.querySelector('.inp-precio').value;
        item.Estado = row.querySelector('.chk-estado').checked ? "Comprado" : "Pendiente";
        
        // Envío silencioso
        api({ action: 'update_item', data: { id, para: item.Para, precio: item.Precio, estado: item.Estado } }, true);
    },

    calcularPagos: () => {
        const items = state.mercado.filter(m => m.Semana_ID === state.semanaActual);
        let pagoCarlos = 0, pagoDaniel = 0, gastoAmbos = 0, gastoCarlos = 0, gastoDaniel = 0;

        items.forEach(i => {
            let p = parseFloat(i.Precio) || 0;
            // SUMA TOTAL: Incluye compras manuales, recetas (si están marcadas) y totales de categoría
            if (p > 0 && (i.Estado === 'Comprado' || i.Estado === 'Comprado_Bloqueado' || i.Origen === 'Agrupación')) {
                if(i.Quien_Pago === 'Carlos') pagoCarlos += p;
                if(i.Quien_Pago === 'Daniel') pagoDaniel += p;
                
                if(i.Para === 'Ambos') gastoAmbos += p;
                else if(i.Para === 'Carlos') gastoCarlos += p;
                else if(i.Para === 'Daniel') gastoDaniel += p;
            }
        });

        // Lógica de deuda precisa
        let debeCarlos = (gastoAmbos / 2) + gastoCarlos;
        let debeDaniel = (gastoAmbos / 2) + gastoDaniel;
        
        // Renderizado del desglose...
        // ... (resto de la lógica de UI de pagos)
    }
};

async function api(payload, silent = false) {
    // ... tu lógica de fetch ...
}
