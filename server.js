require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const url = process.env.DATABASE_URL;
if (!url) { console.error("Falta DATABASE_URL en el archivo .env"); process.exit(1); }

const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }
});

const GENEROS = ["Novela","Cuento","Poesía","Ensayo","Historia","Infantil","Técnico"];
const FORMATOS = ["Tapa blanda","Tapa dura","Digital"];

async function iniciarBD() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS libros (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(200) NOT NULL,
      autor VARCHAR(150) NOT NULL,
      isbn VARCHAR(20) UNIQUE,
      genero VARCHAR(30) NOT NULL,
      precio INTEGER NOT NULL DEFAULT 0 CHECK (precio >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
    )`);
  // Columnas nuevas (si ya existen, no pasa nada)
  await pool.query(`
    ALTER TABLE libros
      ADD COLUMN IF NOT EXISTS portada TEXT,
      ADD COLUMN IF NOT EXISTS sinopsis TEXT,
      ADD COLUMN IF NOT EXISTS editorial VARCHAR(120),
      ADD COLUMN IF NOT EXISTS anio INTEGER,
      ADD COLUMN IF NOT EXISTS formato VARCHAR(20) NOT NULL DEFAULT 'Tapa blanda',
      ADD COLUMN IF NOT EXISTS recomendado BOOLEAN NOT NULL DEFAULT FALSE`);
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM libros");
  if (rows[0].n === 0) {
    await pool.query(`
      INSERT INTO libros (titulo, autor, isbn, genero, precio, stock, recomendado) VALUES
      ('Cien años de soledad','Gabriel García Márquez','9780307474728','Novela',58000,7,true),
      ('El amor en los tiempos del cólera','Gabriel García Márquez','9780307389732','Novela',52000,2,false),
      ('La vorágine','José Eustasio Rivera','9789580000000','Novela',34000,4,false),
      ('Clean Code','Robert C. Martin','9780132350884','Técnico',120000,1,false)`);
  }
}

function validar(b) {
  const texto = v => String(v || "").trim() || null;
  const d = {
    titulo: String(b.titulo || "").trim(),
    autor: String(b.autor || "").trim(),
    isbn: texto(b.isbn),
    genero: String(b.genero || ""),
    precio: Number(b.precio),
    stock: Number(b.stock),
    portada: texto(b.portada),
    sinopsis: texto(b.sinopsis),
    editorial: texto(b.editorial),
    anio: b.anio === "" || b.anio == null ? null : Number(b.anio),
    formato: String(b.formato || "Tapa blanda"),
    recomendado: b.recomendado === true || b.recomendado === "true"
  };
  if (!d.titulo || !d.autor) return { error: "Escribe el título y el autor." };
  if (!GENEROS.includes(d.genero)) return { error: "Elige un género válido." };
  if (!FORMATOS.includes(d.formato)) return { error: "Elige un formato válido." };
  if (!Number.isInteger(d.precio) || d.precio < 0) return { error: "Escribe un precio válido (entero, 0 o más)." };
  if (!Number.isInteger(d.stock) || d.stock < 0) return { error: "El stock debe ser un número entero (0 o más)." };
  if (d.anio !== null && (!Number.isInteger(d.anio) || d.anio < 1000 || d.anio > 2100)) return { error: "El año no es válido." };
  if (d.portada && !/^https?:\/\//i.test(d.portada)) return { error: "La portada debe ser un enlace que empiece por http:// o https://" };
  return { d };
}
const valores = d => [d.titulo, d.autor, d.isbn, d.genero, d.precio, d.stock, d.portada, d.sinopsis, d.editorial, d.anio, d.formato, d.recomendado];

app.get("/api/libros", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM libros ORDER BY id DESC");
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: "Error al consultar la base de datos." }); }
});

app.post("/api/libros", async (req, res) => {
  const { d, error } = validar(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `INSERT INTO libros (titulo,autor,isbn,genero,precio,stock,portada,sinopsis,editorial,anio,formato,recomendado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, valores(d));
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Ya existe un libro con ese ISBN." });
    console.error(e); res.status(500).json({ error: "Error al guardar el libro." });
  }
});

app.put("/api/libros/:id", async (req, res) => {
  const { d, error } = validar(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `UPDATE libros SET titulo=$1,autor=$2,isbn=$3,genero=$4,precio=$5,stock=$6,portada=$7,sinopsis=$8,editorial=$9,anio=$10,formato=$11,recomendado=$12
       WHERE id=$13 RETURNING *`, [...valores(d), req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "El libro no existe." });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Ya existe un libro con ese ISBN." });
    console.error(e); res.status(500).json({ error: "Error al actualizar el libro." });
  }
});

app.delete("/api/libros/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM libros WHERE id=$1", [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: "El libro no existe." });
    res.status(204).end();
  } catch (e) { console.error(e); res.status(500).json({ error: "Error al eliminar el libro." }); }
});

const PORT = process.env.PORT || 3000;
iniciarBD()
  .then(() => app.listen(PORT, () => console.log(`Servidor listo en http://localhost:${PORT}`)))
  .catch(e => { console.error("No se pudo conectar a la base de datos:", e.message); process.exit(1); });