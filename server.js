require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL en el archivo .env");
  process.exit(1);
}

// Render exige conexión cifrada (SSL); en una base local no hace falta
const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }
});

const GENEROS = ["Novela","Cuento","Poesía","Ensayo","Historia","Infantil","Técnico"];

// Crea la tabla y datos de ejemplo si todavía no existen
async function iniciarBD() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS libros (
      id      SERIAL PRIMARY KEY,
      titulo  VARCHAR(200) NOT NULL,
      autor   VARCHAR(150) NOT NULL,
      isbn    VARCHAR(20) UNIQUE,
      genero  VARCHAR(30) NOT NULL,
      precio  INTEGER NOT NULL DEFAULT 0 CHECK (precio >= 0),
      stock   INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
    )
  `);
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM libros");
  if (rows[0].n === 0) {
    await pool.query(`
      INSERT INTO libros (titulo, autor, isbn, genero, precio, stock) VALUES
      ('Cien años de soledad', 'Gabriel García Márquez', '9780307474728', 'Novela', 58000, 7),
      ('El amor en los tiempos del cólera', 'Gabriel García Márquez', '9780307389732', 'Novela', 52000, 2),
      ('La vorágine', 'José Eustasio Rivera', '9789580000000', 'Novela', 34000, 4),
      ('Clean Code', 'Robert C. Martin', '9780132350884', 'Técnico', 120000, 1)
    `);
  }
}

// Valida los datos que llegan del formulario
function validar(b) {
  const d = {
    titulo: String(b.titulo || "").trim(),
    autor:  String(b.autor  || "").trim(),
    isbn:   String(b.isbn   || "").trim() || null,
    genero: String(b.genero || ""),
    precio: Number(b.precio),
    stock:  Number(b.stock)
  };
  if (!d.titulo || !d.autor) return { error: "Escribe el título y el autor." };
  if (!GENEROS.includes(d.genero)) return { error: "Elige un género válido." };
  if (!Number.isInteger(d.precio) || d.precio < 0) return { error: "Escribe un precio válido (entero, 0 o más)." };
  if (!Number.isInteger(d.stock) || d.stock < 0) return { error: "El stock debe ser un número entero (0 o más)." };
  return { d };
}

// READ: listar todos
app.get("/api/libros", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM libros ORDER BY id DESC");
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al consultar la base de datos." });
  }
});

// CREATE
app.post("/api/libros", async (req, res) => {
  const { d, error } = validar(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `INSERT INTO libros (titulo, autor, isbn, genero, precio, stock)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.titulo, d.autor, d.isbn, d.genero, d.precio, d.stock]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Ya existe un libro con ese ISBN." });
    console.error(e);
    res.status(500).json({ error: "Error al guardar el libro." });
  }
});

// UPDATE
app.put("/api/libros/:id", async (req, res) => {
  const { d, error } = validar(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      `UPDATE libros SET titulo=$1, autor=$2, isbn=$3, genero=$4, precio=$5, stock=$6
       WHERE id=$7 RETURNING *`,
      [d.titulo, d.autor, d.isbn, d.genero, d.precio, d.stock, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "El libro no existe." });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Ya existe un libro con ese ISBN." });
    console.error(e);
    res.status(500).json({ error: "Error al actualizar el libro." });
  }
});

// DELETE
app.delete("/api/libros/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM libros WHERE id=$1", [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: "El libro no existe." });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al eliminar el libro." });
  }
});

const PORT = process.env.PORT || 3000;
iniciarBD()
  .then(() => app.listen(PORT, () => console.log(`Servidor listo en http://localhost:${PORT}`)))
  .catch(e => { console.error("No se pudo conectar a la base de datos:", e.message); process.exit(1); });