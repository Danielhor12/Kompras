const SECRET_TOKEN = "https://script.google.com/macros/s/AKfycbxB5nzfylvc_Vp7OV21qUv8yLCFuTOKyOHkKsNKvtSmgSZW80KHJ0AxL4FFrBOxzYY/exec"; 

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if(body.token !== SECRET_TOKEN) return response({"error": "Acceso denegado"});

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = body.action;

    if(action === 'sync') {
      const sheetSemanas = ss.getSheetByName('Semanas');
      let semanasData = getData(ss, 'Semanas');
      let activa = semanasData.find(s => s.Estado === 'Activa');

      if (!activa) {
        const newSemanaId = "SEM-" + Date.now();
        // Se crea con fechas vacías para que todos los equipos pidan filtro nuevo
        sheetSemanas.appendRow([newSemanaId, "", "Activa", "", ""]);
        semanasData = getData(ss, 'Semanas'); 
      }
      return response({ diccionario: getData(ss, 'Diccionario'), recetario: getData(ss, 'Recetario'), plan: getData(ss, 'Plan_Semanal'), mercado: getData(ss, 'Mercado'), semanas: semanasData });
    }

    if(action === 'save_receta') { ss.getSheetByName('Recetario').appendRow([ body.data.id, body.data.nombre, body.data.ingredientes ]); return response({"status": "success"}); }
    if(action === 'update_receta') { updateRowById(ss, 'Recetario', body.data.id, { 1: body.data.nombre, 2: body.data.ingredientes }); return response({"status": "success"}); }
    if(action === 'delete_receta') { deleteRowById(ss, 'Recetario', body.id); return response({"status": "success"}); }

    if(action === 'save_plan') {
      const planSheet = ss.getSheetByName('Plan_Semanal');
      const mercadoSheet = ss.getSheetByName('Mercado');
      planSheet.appendRow([body.semana_id, body.fecha, body.id_plato, body.nombre_plato, body.plan_id]);
      
      const ingredientes = JSON.parse(body.ingredientes);
      ingredientes.forEach(ing => {
        mercadoSheet.appendRow([
          "ITM-" + Math.floor(Math.random() * 100000), body.semana_id, 
          ing.articulo, ing.categoria, ing.unidad, ing.para || "Ambos", ing.quien_pago || "Pendiente", 
          0, "Pendiente", "Receta", body.fecha, ing.cantidad || 1, body.plan_id, ing.comentario || "" 
        ]);
      });
      return response({"status": "success"});
    }

    if(action === 'update_plan_date') {
      updateRowsByColumn(ss, 'Plan_Semanal', 4, body.plan_id, { 1: body.nueva_fecha });
      updateRowsByColumn(ss, 'Mercado', 12, body.plan_id, { 10: body.nueva_fecha });
      return response({"status": "success"});
    }

    if(action === 'delete_plan') {
      deleteRowsByColumn(ss, 'Plan_Semanal', 4, body.plan_id);
      deleteRowsByColumn(ss, 'Mercado', 12, body.plan_id);
      return response({"status": "success"});
    }

    if(action === 'delete_semana') {
      deleteRowsByColumn(ss, 'Plan_Semanal', 0, body.semana_id);
      deleteRowsByColumn(ss, 'Mercado', 1, body.semana_id);
      deleteRowsByColumn(ss, 'Semanas', 0, body.semana_id);
      // Al eliminar, la nueva semana nace con filtro vacío en la BD global
      ss.getSheetByName('Semanas').appendRow(["SEM-" + Date.now(), "", "Activa", "", ""]);
      return response({"status": "success"});
    }

    if(action === 'add_mercado') {
      ss.getSheetByName('Mercado').appendRow([
        body.data.id, body.data.semana_id, body.data.articulo, body.data.categoria, 
        body.data.unidad, body.data.para, body.data.quien_pago, body.data.precio, body.data.estado, 
        "Manual", body.data.fecha, body.data.cantidad, "", body.data.comentario || ""
      ]);
      aprenderDiccionario(ss, body.data.articulo, body.data.categoria, body.data.unidad);
      return response({"status": "success"});
    }

    if(action === 'update_item') {
      const sheet = ss.getSheetByName('Mercado');
      const data = sheet.getDataRange().getValues();
      for(let i=1; i<data.length; i++) {
        if(data[i][0] === body.data.id) {
          sheet.getRange(i+1, 6, 1, 4).setValues([[ body.data.para, body.data.quien_pago, body.data.precio, body.data.estado ]]);
          break;
        }
      }
      return response({"status": "success"});
    }

    if(action === 'cerrar_categoria') {
      const sheet = ss.getSheetByName('Mercado');
      const data = sheet.getDataRange().getValues();
      for(let i=1; i<data.length; i++) {
        if(data[i][1] === body.semana_id && data[i][3] === body.categoria && data[i][9] !== "Agrupación" && data[i][8] !== "Comprado_Bloqueado") {
          if (body.tipo_cierre === "total") {
             sheet.getRange(i+1, 6).setValue(body.para); 
             sheet.getRange(i+1, 7).setValue(body.quien_pago); 
             sheet.getRange(i+1, 8).setValue(0); 
          }
          sheet.getRange(i+1, 9).setValue("Comprado_Bloqueado"); 
        }
      }
      if (body.tipo_cierre === "total") {
          sheet.appendRow([
            "ITM-" + Math.floor(Math.random() * 100000), body.semana_id, "TOTAL " + body.categoria, body.categoria, 
            "soles", body.para, body.quien_pago, parseFloat(body.total), "Comprado", "Agrupación", 
            body.fecha || Utilities.formatDate(new Date(), "GMT-5", "yyyy-MM-dd"), 1, "", "Cierre de categoría"
          ]);
      }
      return response({"status": "success"});
    }

    if(action === 'cerrar_semana') {
      updateRowById(ss, 'Semanas', body.semana_id, { 2: "Cerrada" });
      // Al cerrar, la nueva semana nace con filtro vacío en la BD global
      ss.getSheetByName('Semanas').appendRow([body.nueva_semana_id, "", "Activa", "", ""]);
      return response({"status": "success"});
    }

    if(action === 'update_semana_dates') {
      const sheet = ss.getSheetByName('Semanas');
      const data = sheet.getDataRange().getValues();
      for(let i=1; i<data.length; i++) {
        if(data[i][0] === body.semana_id) {
          sheet.getRange(i+1, 2).setValue(body.fInicio);
          sheet.getRange(i+1, 4).setValue(body.fFin);
          break;
        }
      }
      return response({"status": "success"});
    }

    if(action === 'update_encargados') {
      const sheet = ss.getSheetByName('Semanas');
      const data = sheet.getDataRange().getValues();
      for(let i=1; i<data.length; i++) {
        if(data[i][0] === body.semana_id) {
          sheet.getRange(i+1, 5).setValue(body.encargados_json);
          break;
        }
      }
      return response({"status": "success"});
    }

    if(action === 'agrupar_mercado') {
      const sheet = ss.getSheetByName('Mercado');
      const data = sheet.getDataRange().getValues();
      let pendientes = [];
      let rowsToDelete = [];
      let updates = {};

      for(let i=1; i<data.length; i++) {
        if(data[i][1] === body.semana_id && data[i][8] === 'Pendiente' && data[i][9] !== 'Agrupación') {
           pendientes.push({ rowIdx: i+1, art: data[i][2].toString().toLowerCase().trim(), cat: data[i][3], uni: data[i][4], para: data[i][5], quien: data[i][6], cant: parseFloat(data[i][11]) || 1 });
        }
      }

      let grupos = {};
      pendientes.forEach(p => {
         let key = p.art + "|" + p.cat + "|" + p.uni + "|" + p.para + "|" + p.quien;
         if(!grupos[key]) grupos[key] = [];
         grupos[key].push(p);
      });

      for(let key in grupos) {
         let g = grupos[key];
         if(g.length > 1) {
            let total = 0;
            g.forEach((item, index) => {
               total += item.cant;
               if(index > 0) rowsToDelete.push(item.rowIdx); 
            });
            updates[g[0].rowIdx] = total; 
         }
      }

      for(let r in updates) { sheet.getRange(parseInt(r), 12).setValue(updates[r]); }
      rowsToDelete.sort((a,b) => b-a).forEach(r => { sheet.deleteRow(r); });

      return response({"status": "success"});
    }

  } catch (error) { return response({"error": error.toString()}); }
}

function response(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function getData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if(!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if(data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => { let obj = {}; headers.forEach((h, i) => obj[h] = row[i]); return obj; });
}
function updateRowById(ss, sheetName, id, colMap) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === id) { 
      for(const [colIdx, val] of Object.entries(colMap)) { sheet.getRange(i+1, parseInt(colIdx)+1).setValue(val); }
      break;
    }
  }
}
function deleteRowById(ss, sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) { if(data[i][0] === id) { sheet.deleteRow(i+1); break; } }
}
function updateRowsByColumn(ss, sheetName, colIndex, value, colMap) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][colIndex] === value) {
      for(const [cIdx, val] of Object.entries(colMap)) { sheet.getRange(i+1, parseInt(cIdx)+1).setValue(val); }
    }
  }
}
function deleteRowsByColumn(ss, sheetName, colIndex, value) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  for(let i=data.length-1; i>=1; i--) {
    if(data[i][colIndex] === value) { sheet.deleteRow(i+1); }
  }
}
function aprenderDiccionario(ss, articulo, categoria, unidad) {
  const sheet = ss.getSheetByName('Diccionario');
  const data = sheet.getDataRange().getValues();
  const existe = data.some(r => r[0].toString().toLowerCase() === articulo.toLowerCase());
  if(!existe) sheet.appendRow([articulo, categoria, unidad]);
}
