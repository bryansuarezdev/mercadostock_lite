"use strict";
/* Lógica de la app: carga de archivos, reglas de stock, vista previa y descarga.
   Requiere: fflate.js y xlsx-io.js cargados antes. */

/* ---------- estado ---------- */
const S = { meli:null, stock:null };

/* ---------- reglas ---------- */
const DEFAULT_RULES = [
  {op:">",  th:20, val:10},
  {op:">",  th:10, val:5},
  {op:">=", th:5,  val:1},
];
let rules = load();
function load(){
  try{ const r = JSON.parse(localStorage.getItem("ml_rules")); if(Array.isArray(r)&&r.length) return r; }catch(e){}
  return structuredClone(DEFAULT_RULES);
}
function save(){ try{ localStorage.setItem("ml_rules", JSON.stringify(rules)); }catch(e){} }

const OPS = {">":"mayor que", ">=":"mayor o igual que", "<":"menor que", "<=":"menor o igual que", "==":"igual a"};
function test(op, s, th){
  switch(op){ case ">":return s>th; case ">=":return s>=th;
    case "<":return s<th; case "<=":return s<=th; case "==":return s===th; }
  return false;
}
function apply(stock){
  for(const r of rules) if(test(r.op, stock, +r.th)) return +r.val;
  return +document.getElementById("fallback").value || 0;
}

function drawRules(){
  const tb = document.getElementById("rules"); tb.innerHTML = "";
  rules.forEach((r,i)=>{
    const tr = document.createElement("tr");
    const sel = `<select data-i="${i}" data-k="op">` +
      Object.entries(OPS).map(([k,v])=>`<option value="${k}"${r.op===k?" selected":""}>${v}</option>`).join("") + `</select>`;
    tr.innerHTML =
      `<td class="lead">Si el stock es</td>
       <td>${sel}</td>
       <td><input type="number" data-i="${i}" data-k="th" value="${r.th}"></td>
       <td class="lead">→ publicar</td>
       <td><input type="number" data-i="${i}" data-k="val" value="${r.val}" min="0"></td>
       <td><button class="x" data-del="${i}" title="Eliminar">×</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll("select,input").forEach(el=>{
    el.addEventListener("input", ()=>{
      const r = rules[+el.dataset.i], k = el.dataset.k;
      r[k] = (k==="op") ? el.value : (el.value===""?0:+el.value);
      save(); refresh();
    });
  });
  tb.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{
    rules.splice(+b.dataset.del,1); save(); drawRules(); refresh();
  }));
}
document.getElementById("addRule").onclick = ()=>{ rules.push({op:">",th:0,val:0}); save(); drawRules(); refresh(); };
document.getElementById("resetRules").onclick = ()=>{ rules = structuredClone(DEFAULT_RULES); save(); drawRules(); refresh(); };
document.getElementById("fallback").addEventListener("input", e=>{
  document.getElementById("fallbackShow").textContent = e.target.value||"0"; refresh();
});

/* ---------- carga de archivos ---------- */
function hook(dropId, inputId, handler){
  const d = document.getElementById(dropId), inp = document.getElementById(inputId);
  d.onclick = ()=>inp.click();
  d.ondragover = e=>{ e.preventDefault(); d.classList.add("over"); };
  d.ondragleave = ()=>d.classList.remove("over");
  d.ondrop = e=>{ e.preventDefault(); d.classList.remove("over");
    if(e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); };
  inp.onchange = ()=>{ if(inp.files[0]) take(inp.files[0]); };
  async function take(file){
    const hint = d.querySelector(".hint");
    d.classList.remove("done","err"); hint.textContent = "Leyendo…";
    try{
      const buf = await file.arrayBuffer();
      const msg = handler(unzip(buf), file.name);
      d.classList.add("done"); hint.textContent = msg;
    }catch(err){
      d.classList.add("err"); hint.textContent = "Error: " + err.message;
      console.error(err);
    }
    refresh();
  }
}

hook("dMeli","fMeli",(files,name)=>{
  const sst = sharedStrings(files);
  const paths = sheetPaths(files);
  const path = paths["Publicaciones"];
  if(!path) throw new Error("no encontré la hoja 'Publicaciones'");
  const sh = readSheet(files, path, sst);

  // fila de encabezados técnicos (ITEM_ID / SKU / STORE_STOCK_QUANTITY…)
  let hRow = null;
  for(const rn of Object.keys(sh.grid).map(Number).sort((a,b)=>a-b)){
    const vals = Object.values(sh.grid[rn]);
    if(vals.includes("ITEM_ID") && vals.includes("SKU")){ hRow = rn; break; }
  }
  if(hRow===null) throw new Error("no encontré los encabezados ITEM_ID/SKU");
  const H = sh.grid[hRow], col = {};
  for(const [c,v] of Object.entries(H)){
    if(v==="SKU") col.sku = +c;
    else if(v==="ITEM_ID") col.item = +c;
    else if(v==="TITLE") col.title = +c;
    else if(String(v).startsWith("STORE_STOCK_QUANTITY")) col.stock = +c;
  }
  if(!col.stock) throw new Error("no encontré la columna de stock (STORE_STOCK_QUANTITY…)");

  const rows = [];
  for(const rn of Object.keys(sh.grid).map(Number).sort((a,b)=>a-b)){
    if(rn <= hRow) continue;
    const g = sh.grid[rn];
    const item = norm(g[col.item]);
    if(!/^ML[A-Z]\d+/.test(item)) continue;      // ignora filas decorativas de la plantilla
    rows.push({ rn, item, sku: norm(g[col.sku]), title: norm(g[col.title]),
                cur: norm(g[col.stock]) });
  }
  if(!rows.length) throw new Error("no hay publicaciones en la hoja");
  S.meli = { files, path, sh, col, rows, name };
  return `${name} — ${rows.length} publicaciones`;
});

hook("dStock","fStock",(files,name)=>{
  const sst = sharedStrings(files);
  const paths = sheetPaths(files);
  let hRow=null, sh=null, path=null;
  for(const p of Object.values(paths)){
    if(!files[p]) continue;
    const s = readSheet(files, p, sst);
    for(const rn of Object.keys(s.grid).map(Number).sort((a,b)=>a-b)){
      const vals = Object.values(s.grid[rn]);
      if(vals.includes("SKU") && vals.some(v=>/^stock$/i.test(String(v)))){ hRow=rn; sh=s; path=p; break; }
    }
    if(hRow!==null) break;
  }
  if(hRow===null) throw new Error("no encontré una fila con columnas 'SKU' y 'Stock'");

  const H = sh.grid[hRow];
  let skuCol=null; const numCols=[];
  for(const [c,v] of Object.entries(H)){
    if(v==="SKU") skuCol=+c;
    else if(v) numCols.push({c:+c, name:String(v)});
  }
  // candidatas de cantidad
  const cands = numCols.filter(x=>/stock|cantidad|disponible|recibir/i.test(x.name));
  const sel = document.getElementById("srcCol");
  sel.innerHTML = cands.map(x=>`<option value="${x.c}">${x.name}</option>`).join("");
  const dflt = cands.find(x=>/^stock$/i.test(x.name)) || cands[0];
  sel.value = dflt.c;
  document.getElementById("srcWrap").style.display = "";
  sel.onchange = ()=>{ buildStockMap(); refresh(); };

  S.stock = { sh, hRow, skuCol, name, rowsRaw: Object.keys(sh.grid).map(Number).filter(n=>n>hRow) };
  buildStockMap();
  return `${name} — ${Object.keys(S.stock.map).length} SKUs`;
});

function buildStockMap(){
  const st = S.stock; if(!st) return;
  const qCol = +document.getElementById("srcCol").value;
  const map = {};
  for(const rn of st.rowsRaw){
    const g = st.sh.grid[rn];
    const sku = norm(g[st.skuCol]);
    if(!sku) continue;
    map[sku] = toInt(g[qCol] ?? 0);
  }
  st.map = map; st.qCol = qCol;
}

/* ---------- cálculo + vista previa ---------- */
function compute(){
  if(!S.meli || !S.stock) return null;
  const map = S.stock.map, out = [], missing = [];
  let changed=0, zeros=0;
  for(const r of S.meli.rows){
    const has = Object.prototype.hasOwnProperty.call(map, r.sku);
    if(!has){ missing.push(r); continue; }
    const bodega = map[r.sku];
    const nuevo = apply(bodega);
    const cur = r.cur===""? null : toInt(r.cur);
    if(cur !== nuevo) changed++;
    if(nuevo === 0) zeros++;
    out.push({...r, bodega, nuevo, cur});
  }
  return {out, missing, changed, zeros};
}

function refresh(){
  drawLogic();
  const res = compute();
  const go = document.getElementById("go");
  const card = document.getElementById("prevCard");
  if(!res){ card.style.display="none"; go.disabled = true; return; }
  card.style.display = "";
  go.disabled = false;

  document.getElementById("stats").innerHTML = [
    ["Publicaciones", res.out.length, ""],
    ["Cambian", res.changed, "is-chg"],
    ["Quedan en 0", res.zeros, "is-zero"],
    ["Sin cruce", res.missing.length, res.missing.length ? "is-miss" : ""],
  ].map(([k,n,c])=>`<div class="stat ${c}"><div class="n">${n}</div><div class="k">${k}</div></div>`).join("");

  const sample = res.out.slice(0,300);
  document.getElementById("prevTable").innerHTML =
    `<thead><tr><th>Publicación</th><th>Título</th><th>SKU</th>
      <th class="num">Bodega</th><th class="num">Meli ahora</th>
      <th class="num">Meli nuevo</th></tr></thead><tbody>` +
    sample.map(r=>{
      const cls = r.nuevo===0 ? "zero" : (r.cur!==r.nuevo ? "chg" : "same");
      return `<tr><td>${r.item}</td><td class="t">${esc(r.title).slice(0,52)}</td><td>${r.sku}</td>
        <td class="num">${r.bodega}</td>
        <td class="num same">${r.cur===null?"—":r.cur}</td>
        <td class="num ${cls}">${r.nuevo}</td></tr>`;
    }).join("") + `</tbody>`;

  const u = document.getElementById("unmatched");
  u.innerHTML = res.out.length > sample.length
    ? `Mostrando ${sample.length} de ${res.out.length} filas. ` : "";
  if(res.missing.length){
    u.innerHTML += `<b>${res.missing.length} publicaciones sin SKU en bodega</b> — se dejan intactas: ` +
      res.missing.slice(0,12).map(m=>`<code>${esc(m.sku||"(vacío)")}</code>`).join(" ") +
      (res.missing.length>12 ? " …" : "");
  }
}
const esc = s => String(s).replace(/[<>&]/g, c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));

/* ---------- generación del archivo ---------- */
document.getElementById("go").onclick = ()=>{
  const res = compute(); if(!res) return;
  const st = document.getElementById("status");
  st.textContent = "Generando…";
  try{
    const {sh, col, path, files, name} = S.meli;
    for(const r of res.out) setNumeric(sh.doc, sh.rowsByNum[r.rn], col.stock, r.nuevo);

    // el XML editado reemplaza al original; el resto del zip queda igual
    const outFiles = {};
    for(const [k,v] of Object.entries(files)) outFiles[k] = v;
    const xml = new XMLSerializer().serializeToString(sh.doc);
    const head = xml.startsWith("<?xml") ? "" : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
    outFiles[path] = enc.encode(head + xml);

    const zipped = fflate.zipSync(outFiles, {level:6});
    const blob = new Blob([zipped], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/\.xlsx$/i,"") + "_SYNC.xlsx";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
    st.textContent = `Listo — ${res.changed} publicaciones modificadas.`;
  }catch(err){
    st.textContent = "Error: " + err.message;
    console.error(err);
  }
};

/* ---------- cabecera: fecha y resumen de reglas ---------- */
function drawLogic(){
  const fb = +document.getElementById("fallback").value || 0;
  const txt = rules.map(r=>`stock ${esc(r.op)} ${+r.th} <b>&rarr; ${+r.val}</b>`).join("  &middot;  ");
  document.getElementById("logic").innerHTML =
    (txt ? txt + "  &middot;  " : "") + `resto <b>&rarr; ${fb}</b>`;
  document.getElementById("chipRules").textContent =
    `${rules.length} regla${rules.length===1?"":"s"} · resto ${fb}`;
}

document.getElementById("today").textContent =
  new Date().toLocaleDateString("es-CL", {weekday:"long", day:"numeric", month:"long", year:"numeric"});

drawRules();
drawLogic();
