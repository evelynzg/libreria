const GENEROS = ["Novela","Cuento","Poesía","Ensayo","Historia","Infantil","Técnico"];
const COLORES = {
  Novela:"#1f5c4d", Cuento:"#b5651d", Poesía:"#7b3f7a", Ensayo:"#2d5a8a",
  Historia:"#8a2d3b", Infantil:"#d49a1c", Técnico:"#4a5568"
};
const API = "/api/libros";
let libros = [], editId = null;

const $ = id => document.getElementById(id);
const cop = n => new Intl.NumberFormat("es-CO", {style:"currency", currency:"COP", maximumFractionDigits:0}).format(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const mismoId = (a, b) => String(a) === String(b);

// ---------- Comunicación con el servidor ----------
async function api(url = "", opciones = {}){
  const res = await fetch(API + url, {
    headers: {"Content-Type": "application/json"},
    ...opciones
  });
  const data = res.status === 204 ? null : await res.json();
  if(!res.ok) throw new Error((data && data.error) || "Error del servidor.");
  return data;
}

async function cargar(){
  try{
    libros = await api();
    render();
  }catch(e){
    $("stats").innerHTML = "";
    $("list").innerHTML = `<li class="empty" style="display:block">No se pudo conectar con el servidor. ${esc(e.message)}</li>`;
  }
}

// ---------- READ: mostrar la lista ----------
function render(){
  const q = $("q").value.trim().toLowerCase();
  const g = $("fg").value;
  const vis = libros.filter(l =>
    (!g || l.genero === g) &&
    (!q || [l.titulo, l.autor, l.isbn || ""].join(" ").toLowerCase().includes(q))
  );

  const unidades = libros.reduce((a, l) => a + l.stock, 0);
  const valor = libros.reduce((a, l) => a + l.stock * l.precio, 0);
  $("stats").innerHTML =
    `<span><b>${libros.length}</b> títulos</span>` +
    `<span><b>${unidades}</b> unidades</span>` +
    `<span>Valor del inventario: <b>${cop(valor)}</b></span>`;

  $("list").innerHTML = vis.length ? vis.map(l => `
    <li>
      <span class="spine" style="background:${COLORES[l.genero] || "#777"}"></span>
      <div>
        <div class="t">${esc(l.titulo)}</div>
        <div class="m">${esc(l.autor)} · ${esc(l.genero)}${l.isbn ? " · ISBN " + esc(l.isbn) : ""}</div>
        <div class="m">${cop(l.precio)} ·
          <span class="${l.stock <= 2 ? "low" : ""}">${l.stock} en stock${l.stock <= 2 ? " (quedan pocos)" : ""}</span>
        </div>
      </div>
      <div class="act">
        <button data-e="${l.id}">Editar</button>
        <button class="danger" data-d="${l.id}">Eliminar</button>
      </div>
    </li>`).join("")
  : `<li class="empty" style="display:block">No hay libros que coincidan. Agrega uno con el botón “Agregar libro”.</li>`;
}

// ---------- Abrir el formulario (crear o editar) ----------
function abrir(id){
  editId = id || null;
  const l = libros.find(x => mismoId(x.id, id)) ||
    {titulo:"", autor:"", isbn:"", genero:GENEROS[0], precio:"", stock:""};
  $("dt").textContent = id ? "Editar libro" : "Agregar libro";
  for(const k of ["titulo","autor","isbn","genero","precio","stock"]) $(k).value = l[k] ?? "";
  $("err").textContent = "";
  $("dlg").showModal();
  $("titulo").focus();
}

// ---------- CREATE / UPDATE ----------
$("f").addEventListener("submit", async e => {
  e.preventDefault();
  const d = {
    titulo: $("titulo").value.trim(),
    autor:  $("autor").value.trim(),
    isbn:   $("isbn").value.trim(),
    genero: $("genero").value,
    precio: $("precio").value,
    stock:  $("stock").value
  };

  if(!d.titulo || !d.autor){ $("err").textContent = "Escribe el título y el autor."; return; }
  if(d.precio === "" || Number(d.precio) < 0){ $("err").textContent = "Escribe un precio válido (0 o más)."; return; }
  if(d.stock === "" || !Number.isInteger(Number(d.stock)) || Number(d.stock) < 0){
    $("err").textContent = "El stock debe ser un número entero (0 o más)."; return;
  }

  try{
    if(editId) await api("/" + editId, {method:"PUT",  body: JSON.stringify(d)});   // UPDATE
    else       await api("",           {method:"POST", body: JSON.stringify(d)});   // CREATE
    $("dlg").close();
    await cargar();
  }catch(err){
    $("err").textContent = err.message;
  }
});

// ---------- Botones Editar / DELETE ----------
$("list").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if(!b) return;
  if(b.dataset.e) abrir(b.dataset.e);
  if(b.dataset.d){
    const l = libros.find(x => mismoId(x.id, b.dataset.d));
    if(confirm(`¿Eliminar “${l.titulo}”? Esta acción no se puede deshacer.`)){
      try{
        await api("/" + l.id, {method:"DELETE"});                                    // DELETE
        await cargar();
      }catch(err){ alert(err.message); }
    }
  }
});

// ---------- Eventos y arranque ----------
$("new").onclick = () => abrir();
$("cancel").onclick = () => $("dlg").close();
$("q").oninput = render;
$("fg").onchange = render;

$("genero").innerHTML = GENEROS.map(g => `<option>${g}</option>`).join("");
$("fg").innerHTML = `<option value="">Todos los géneros</option>` + GENEROS.map(g => `<option>${g}</option>`).join("");

cargar();