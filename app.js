const GENEROS = ["Novela","Cuento","Poesía","Ensayo","Historia","Infantil","Técnico"];
const COLORES = {
  Novela:"#1f5c4d", Cuento:"#b5651d", Poesía:"#7b3f7a", Ensayo:"#2d5a8a",
  Historia:"#8a2d3b", Infantil:"#d49a1c", Técnico:"#4a5568"
};
const KEY = "libreria:libros";
let libros = [], editId = null;

const $ = id => document.getElementById(id);
const cop = n => new Intl.NumberFormat("es-CO", {style:"currency", currency:"COP", maximumFractionDigits:0}).format(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ---------- Datos (localStorage) ----------
function cargar(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return [
    {id:uid(), titulo:"Cien años de soledad", autor:"Gabriel García Márquez", isbn:"9780307474728", genero:"Novela", precio:58000, stock:7},
    {id:uid(), titulo:"El amor en los tiempos del cólera", autor:"Gabriel García Márquez", isbn:"9780307389732", genero:"Novela", precio:52000, stock:2},
    {id:uid(), titulo:"La vorágine", autor:"José Eustasio Rivera", isbn:"9789580000000", genero:"Novela", precio:34000, stock:4},
    {id:uid(), titulo:"Clean Code", autor:"Robert C. Martin", isbn:"9780132350884", genero:"Técnico", precio:120000, stock:1}
  ];
}
function guardar(){
  try{ localStorage.setItem(KEY, JSON.stringify(libros)); }catch(e){}
}

// ---------- READ: mostrar la lista ----------
function render(){
  const q = $("q").value.trim().toLowerCase();
  const g = $("fg").value;
  const vis = libros.filter(l =>
    (!g || l.genero === g) &&
    (!q || [l.titulo, l.autor, l.isbn].join(" ").toLowerCase().includes(q))
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
  const l = libros.find(x => x.id === id) ||
    {titulo:"", autor:"", isbn:"", genero:GENEROS[0], precio:"", stock:""};
  $("dt").textContent = id ? "Editar libro" : "Agregar libro";
  for(const k of ["titulo","autor","isbn","genero","precio","stock"]) $(k).value = l[k];
  $("err").textContent = "";
  $("dlg").showModal();
  $("titulo").focus();
}

// ---------- CREATE / UPDATE: guardar el formulario ----------
$("f").addEventListener("submit", e => {
  e.preventDefault();
  const d = {
    titulo: $("titulo").value.trim(),
    autor:  $("autor").value.trim(),
    isbn:   $("isbn").value.trim(),
    genero: $("genero").value,
    precio: Number($("precio").value),
    stock:  Number($("stock").value)
  };

  if(!d.titulo || !d.autor){ $("err").textContent = "Escribe el título y el autor."; return; }
  if(!Number.isFinite(d.precio) || d.precio < 0 || $("precio").value === ""){
    $("err").textContent = "Escribe un precio válido (0 o más)."; return;
  }
  if(!Number.isInteger(d.stock) || d.stock < 0 || $("stock").value === ""){
    $("err").textContent = "El stock debe ser un número entero (0 o más)."; return;
  }
  if(d.isbn && libros.some(l => l.isbn === d.isbn && l.id !== editId)){
    $("err").textContent = "Ya existe un libro con ese ISBN."; return;
  }

  if(editId) libros = libros.map(l => l.id === editId ? {...l, ...d} : l);   // UPDATE
  else libros.push({id: uid(), ...d});                                        // CREATE

  guardar();
  render();
  $("dlg").close();
});

// ---------- Botones Editar / DELETE ----------
$("list").addEventListener("click", e => {
  const b = e.target.closest("button");
  if(!b) return;
  if(b.dataset.e) abrir(b.dataset.e);
  if(b.dataset.d){
    const l = libros.find(x => x.id === b.dataset.d);
    if(confirm(`¿Eliminar “${l.titulo}”? Esta acción no se puede deshacer.`)){
      libros = libros.filter(x => x.id !== l.id);                             // DELETE
      guardar();
      render();
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

libros = cargar();
render();