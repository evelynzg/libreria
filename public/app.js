const WHATSAPP = "573000000000"; // Cambia por tu número: código de país + número, sin + ni espacios
const GENEROS = ["Novela","Cuento","Poesía","Ensayo","Historia","Infantil","Técnico"];
const FORMATOS = ["Tapa blanda","Tapa dura","Digital"];
const COLORES = {Novela:"#1f5c4d",Cuento:"#b5651d",Poesía:"#7b3f7a",Ensayo:"#2d5a8a",Historia:"#8a2d3b",Infantil:"#c28a14",Técnico:"#4a5568"};
const TITULOS = {todo:"Catálogo", reco:"Recomendados del mes", nuevo:"Novedades"};
const API = "/api/libros";
let libros = [], editId = null, vista = "todo", admin = false;

const $ = id => document.getElementById(id);
const cop = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const mismoId = (a, b) => String(a) === String(b);

async function api(url = "", opciones = {}){
  const res = await fetch(API + url, {headers:{"Content-Type":"application/json"}, ...opciones});
  const data = res.status === 204 ? null : await res.json();
  if(!res.ok) throw new Error((data && data.error) || "Error del servidor.");
  return data;
}

async function cargar(){
  try{ libros = await api(); render(); }
  catch(e){ $("grid").innerHTML = `<p class="vacio">No se pudo cargar el catálogo. ${esc(e.message)}</p>`; }
}

// Portada: la del enlace, o la de Open Library según el ISBN. Si falla, queda el fondo con el título.
function portada(l){
  if(l.portada) return l.portada;
  return l.isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(l.isbn)}-M.jpg?default=false` : "";
}
function cover(l){
  const src = portada(l);
  return `<div class="cover" style="background:${COLORES[l.genero] || "#555"}"><span>${esc(l.titulo)}</span>` +
    (src ? `<img src="${esc(src)}" alt="Portada de ${esc(l.titulo)}" loading="lazy" decoding="async" width="200" height="300">` : "") + `</div>`;
}

function filtrar(){
  const q = $("q").value.trim().toLowerCase(), g = $("fg").value, f = $("ff").value;
  const p = Number($("fp").value), s = $("fs").checked;
  let r = libros.filter(l =>
    (!g || l.genero === g) && (!f || l.formato === f) && (!p || l.precio <= p) && (!s || l.stock > 0) &&
    (!q || [l.titulo, l.autor, l.isbn, l.editorial].join(" ").toLowerCase().includes(q)));
  if(vista === "reco") r = r.filter(l => l.recomendado);
  if(vista === "nuevo") r = r.slice(0, 8); // la API entrega primero los más recientes
  return r;
}

function render(){
  const vis = filtrar();
  $("vt").textContent = TITULOS[vista];
  $("stats").textContent = `${vis.length} ${vis.length === 1 ? "libro" : "libros"}`;
  document.querySelectorAll("[data-vista]").forEach(b => b.classList.toggle("activo", b.dataset.vista === vista));
  $("grid").innerHTML = vis.length ? vis.map(l => `
    <article class="card">
      ${cover(l)}
      <div class="body">
        <div class="t">${esc(l.titulo)}</div>
        <div class="m" style="margin:0">${esc(l.autor)}</div>
        <div class="precio">${cop(l.precio)}</div>
        ${l.stock === 0 ? `<div class="agotado">Agotado</div>` : ""}
        <div class="acc">
          <button class="primary" data-v="${l.id}">Ver detalles</button>
          ${admin ? `<button data-e="${l.id}">Editar</button><button class="danger" data-d="${l.id}">Eliminar</button>` : ""}
        </div>
      </div>
    </article>`).join("")
  : `<p class="vacio">No encontramos libros con esos filtros. Prueba quitando alguno.</p>`;
}

// Si una portada no carga, se quita y queda el fondo con el título
$("grid").addEventListener("error", e => { if(e.target.tagName === "IMG") e.target.remove(); }, true);
$("det").addEventListener("error", e => { if(e.target.tagName === "IMG") e.target.remove(); }, true);

// ---------- Ficha del libro ----------
function verDetalle(id){
  const l = libros.find(x => mismoId(x.id, id)); if(!l) return;
  const msg = encodeURIComponent(`Hola, quiero pedir el libro "${l.titulo}" de ${l.autor}.`);
  $("det").innerHTML = `
    <h2>${esc(l.titulo)}</h2>
    <div class="det-top">
      ${cover(l)}
      <dl>
        <dt>Autor</dt><dd>${esc(l.autor)}</dd>
        <dt>Precio</dt><dd><b>${cop(l.precio)}</b></dd>
        <dt>Disponibilidad</dt><dd>${l.stock > 0 ? `${l.stock} en stock` : "Agotado"}</dd>
        <dt>Formato</dt><dd>${esc(l.formato)}</dd>
        ${l.editorial ? `<dt>Editorial</dt><dd>${esc(l.editorial)}</dd>` : ""}
        ${l.anio ? `<dt>Año</dt><dd>${l.anio}</dd>` : ""}
        ${l.isbn ? `<dt>ISBN</dt><dd>${esc(l.isbn)}</dd>` : ""}
      </dl>
    </div>
    <p>${l.sinopsis ? esc(l.sinopsis) : "Este libro aún no tiene sinopsis."}</p>
    <a class="wa" href="https://wa.me/${WHATSAPP}?text=${msg}" target="_blank" rel="noopener">${l.stock > 0 ? "Pedir por WhatsApp" : "Consultar por WhatsApp"}</a>
    <div class="foot" style="margin-top:12px"><button id="cerrar">Cerrar</button></div>`;
  $("det").showModal();
  $("cerrar").onclick = () => $("det").close();
}

// ---------- Formulario (crear / editar) ----------
const CAMPOS = ["titulo","autor","isbn","genero","formato","precio","stock","editorial","anio","portada","sinopsis"];
function abrir(id){
  editId = id || null;
  const l = libros.find(x => mismoId(x.id, id)) || {genero:GENEROS[0], formato:FORMATOS[0]};
  $("dt").textContent = id ? "Editar libro" : "Agregar libro";
  CAMPOS.forEach(k => $(k).value = l[k] ?? "");
  $("recomendado").checked = !!l.recomendado;
  $("err").textContent = "";
  $("dlg").showModal(); $("titulo").focus();
}

$("f").addEventListener("submit", async e => {
  e.preventDefault();
  const d = {};
  CAMPOS.forEach(k => d[k] = $(k).value.trim());
  d.recomendado = $("recomendado").checked;
  if(!d.titulo || !d.autor){ $("err").textContent = "Escribe el título y el autor."; return; }
  if(d.precio === "" || Number(d.precio) < 0){ $("err").textContent = "Escribe un precio válido (0 o más)."; return; }
  if(d.stock === "" || !Number.isInteger(Number(d.stock)) || Number(d.stock) < 0){ $("err").textContent = "El stock debe ser un número entero (0 o más)."; return; }
  try{
    if(editId) await api("/" + editId, {method:"PUT", body:JSON.stringify(d)});
    else await api("", {method:"POST", body:JSON.stringify(d)});
    $("dlg").close(); await cargar();
  }catch(err){ $("err").textContent = err.message; }
});

// ---------- Clics en las tarjetas ----------
$("grid").addEventListener("click", async e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.v) verDetalle(b.dataset.v);
  if(b.dataset.e) abrir(b.dataset.e);
  if(b.dataset.d){
    const l = libros.find(x => mismoId(x.id, b.dataset.d));
    if(confirm(`¿Eliminar “${l.titulo}”? Esta acción no se puede deshacer.`)){
      try{ await api("/" + l.id, {method:"DELETE"}); await cargar(); }catch(err){ alert(err.message); }
    }
  }
});

// ---------- Eventos generales ----------
document.querySelectorAll("[data-vista]").forEach(b => b.onclick = () => {
  vista = b.dataset.vista; render();
  $("catalogo").scrollIntoView({behavior:"smooth"});
});
$("adminBtn").onclick = () => {
  admin = !admin;
  $("adminBtn").textContent = admin ? "Salir del modo administrador" : "Modo administrador";
  document.querySelectorAll(".solo-admin").forEach(el => el.hidden = !admin);
  render();
};
$("new").onclick = () => abrir();
$("cancel").onclick = () => $("dlg").close();
["q","fg","ff","fp","fs"].forEach(id => $(id).addEventListener(id === "q" ? "input" : "change", render));

const opciones = arr => arr.map(x => `<option>${x}</option>`).join("");
$("genero").innerHTML = opciones(GENEROS);
$("formato").innerHTML = opciones(FORMATOS);
$("fg").innerHTML = `<option value="">Todos los géneros</option>` + opciones(GENEROS);
$("ff").innerHTML = `<option value="">Todos los formatos</option>` + opciones(FORMATOS);

cargar();