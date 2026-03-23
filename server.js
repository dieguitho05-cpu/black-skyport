const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ══════════════════════════════════════════
   BASE DE DATOS — PostgreSQL (Render / Supabase)
   La variable DATABASE_URL se configura en Render
══════════════════════════════════════════ */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ══════════════════════════════════════════
   CREAR TABLA SI NO EXISTE
══════════════════════════════════════════ */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS servicios (
      id             SERIAL PRIMARY KEY,
      conductor      VARCHAR(60)    NOT NULL DEFAULT '',
      tipo           VARCHAR(20)    NOT NULL DEFAULT 'Auto',
      cliente        VARCHAR(120)   NOT NULL DEFAULT '',
      nro_vuelo      VARCHAR(30)    DEFAULT '',
      pasajeros      INTEGER        DEFAULT 1,
      origen         VARCHAR(120)   DEFAULT '',
      destino        VARCHAR(120)   DEFAULT '',
      fecha          DATE,
      hora           TIME,
      precio         NUMERIC(10,2)  DEFAULT 0,
      descuento      NUMERIC(5,2)   DEFAULT 0,
      precio_final   NUMERIC(10,2)  DEFAULT 0,
      conductor_pago NUMERIC(10,2)  DEFAULT 0,
      empresa        NUMERIC(10,2)  DEFAULT 0,
      notas          TEXT           DEFAULT '',
      creado_en      TIMESTAMP      DEFAULT NOW()
    );
  `);
  console.log('✅ Tabla "servicios" lista');
}

/* ══════════════════════════════════════════
   MIDDLEWARES
══════════════════════════════════════════ */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ══════════════════════════════════════════
   RUTAS API
══════════════════════════════════════════ */

/* GET /api/servicios — obtener todos */
app.get('/api/servicios', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM servicios ORDER BY fecha DESC, id DESC'
    );
    res.json(result.rows.map(toFront));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/servicios — crear nuevo */
app.post('/api/servicios', async (req, res) => {
  try {
    const s = req.body;
    const result = await pool.query(
      `INSERT INTO servicios
        (conductor,tipo,cliente,nro_vuelo,pasajeros,origen,destino,
         fecha,hora,precio,descuento,precio_final,conductor_pago,empresa,notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [s.conductor, s.tipo, s.cliente, s.nroVuelo||'', s.pasajeros||1,
       s.origen, s.destino, s.fecha||null, s.hora||null,
       s.precio||0, s.descuento||0, s.precioFinal||0,
       s.conductorPago||0, s.empresa||0, s.notas||'']
    );
    res.status(201).json(toFront(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* PUT /api/servicios/:id — editar */
app.put('/api/servicios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const s = req.body;
    const result = await pool.query(
      `UPDATE servicios SET
        conductor=$1, tipo=$2, cliente=$3, nro_vuelo=$4, pasajeros=$5,
        origen=$6, destino=$7, fecha=$8, hora=$9, precio=$10,
        descuento=$11, precio_final=$12, conductor_pago=$13, empresa=$14, notas=$15
       WHERE id=$16 RETURNING *`,
      [s.conductor, s.tipo, s.cliente, s.nroVuelo||'', s.pasajeros||1,
       s.origen, s.destino, s.fecha||null, s.hora||null,
       s.precio||0, s.descuento||0, s.precioFinal||0,
       s.conductorPago||0, s.empresa||0, s.notas||'', id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(toFront(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/servicios/:id — eliminar */
app.delete('/api/servicios/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM servicios WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/health — verificar que el servidor funciona */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'BLACK SKYPORT', timestamp: new Date() });
});

/* Sirve el HTML para cualquier otra ruta */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ══════════════════════════════════════════
   HELPER: convierte nombres de DB a camelCase
══════════════════════════════════════════ */
function toFront(row) {
  return {
    id:            row.id,
    conductor:     row.conductor,
    tipo:          row.tipo,
    cliente:       row.cliente,
    nroVuelo:      row.nro_vuelo,
    pasajeros:     row.pasajeros,
    origen:        row.origen,
    destino:       row.destino,
    fecha:         row.fecha ? String(row.fecha).slice(0,10) : '',
    hora:          row.hora ? String(row.hora).slice(0,5) : '',
    precio:        parseFloat(row.precio)||0,
    descuento:     parseFloat(row.descuento)||0,
    precioFinal:   parseFloat(row.precio_final)||0,
    conductorPago: parseFloat(row.conductor_pago)||0,
    empresa:       parseFloat(row.empresa)||0,
    notas:         row.notas||''
  };
}

/* ══════════════════════════════════════════
   ARRANCAR
══════════════════════════════════════════ */
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 BLACK SKYPORT corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  });
