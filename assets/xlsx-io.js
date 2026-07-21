"use strict";
/* Lectura y escritura de archivos .xlsx a nivel de ZIP + XML.
   No sabe nada de Mercado Libre ni de reglas de stock: solo abre, lee celdas
   y reescribe valores conservando intacto el resto del archivo.
   Requiere: fflate.js cargado antes. */

const SS_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/* ---------- utilidades xlsx ---------- */
const dec = new TextDecoder(), enc = new TextEncoder();
const colOf = ref => { let n=0; for(const ch of ref){ const c=ch.charCodeAt(0);
  if(c<65||c>90) break; n=n*26+(c-64);} return n; };
const rowOf = ref => parseInt(ref.replace(/^[A-Z]+/,""),10);
function numToCol(n){ let s=""; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=(n-r-1)/26; } return s; }
const parseXml = u8 => new DOMParser().parseFromString(dec.decode(u8),"application/xml");

function unzip(buf){ return fflate.unzipSync(new Uint8Array(buf)); }

function sharedStrings(files){
  const f = files["xl/sharedStrings.xml"]; if(!f) return [];
  const doc = parseXml(f);
  return [...doc.getElementsByTagNameNS(SS_NS,"si")].map(si=>{
    // concatena todos los <t>, ignorando marcas de formato (rPh, etc.)
    return [...si.getElementsByTagNameNS(SS_NS,"t")]
      .filter(t=>t.parentNode.localName!=="rPh")
      .map(t=>t.textContent).join("");
  });
}

function sheetPaths(files){
  const wb = parseXml(files["xl/workbook.xml"]);
  const rels = parseXml(files["xl/_rels/workbook.xml.rels"]);
  const relMap = {};
  for(const r of rels.getElementsByTagName("Relationship"))
    relMap[r.getAttribute("Id")] = r.getAttribute("Target");
  const out = {};
  for(const s of wb.getElementsByTagNameNS(SS_NS,"sheet")){
    const id = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    let t = relMap[id] || "";
    if(t.startsWith("/")) t = t.slice(1); else if(!t.startsWith("xl/")) t = "xl/"+t;
    out[s.getAttribute("name")] = t;
  }
  return out;
}

function cellValue(c, sst){
  const t = c.getAttribute("t");
  if(t==="inlineStr"){
    const is = c.getElementsByTagNameNS(SS_NS,"t");
    return is.length ? is[0].textContent : "";
  }
  const v = c.getElementsByTagNameNS(SS_NS,"v")[0];
  if(!v) return "";
  if(t==="s") return sst[+v.textContent] ?? "";
  return v.textContent;
}

/** Devuelve {doc, rowsByNum, grid} — grid[rowNum][colNum] = valor string */
function readSheet(files, path, sst){
  const doc = parseXml(files[path]);
  const grid = {}, rowsByNum = {};
  for(const r of doc.getElementsByTagNameNS(SS_NS,"row")){
    const rn = +r.getAttribute("r");
    rowsByNum[rn] = r;
    const g = grid[rn] = {};
    for(const c of r.getElementsByTagNameNS(SS_NS,"c")){
      const ref = c.getAttribute("r"); if(!ref) continue;
      g[colOf(ref)] = cellValue(c, sst);
    }
  }
  return {doc, rowsByNum, grid};
}

function setNumeric(doc, rowEl, colNum, val){
  const ref = numToCol(colNum) + rowEl.getAttribute("r");
  let cell = null;
  for(const c of rowEl.children) if(c.localName==="c" && c.getAttribute("r")===ref){ cell=c; break; }
  if(!cell){
    cell = doc.createElementNS(SS_NS,"c");
    cell.setAttribute("r", ref);
    let before = null;
    for(const c of rowEl.children){
      if(c.localName!=="c") continue;
      if(colOf(c.getAttribute("r")) > colNum){ before = c; break; }
    }
    rowEl.insertBefore(cell, before);
  }
  cell.removeAttribute("t");   // pasa a numérico
  while(cell.firstChild) cell.removeChild(cell.firstChild);
  const v = doc.createElementNS(SS_NS,"v");
  v.textContent = String(val);
  cell.appendChild(v);
}

const norm = v => {
  if(v===null||v===undefined) return "";
  let s = String(v).trim();
  if(/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/,"");
  return s;
};
const toInt = v => { const n = parseFloat(String(v).replace(",",".")); return isFinite(n) ? Math.trunc(n) : 0; };
