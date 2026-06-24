import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const HOST = process.env.WCS_REALTIME_HOST || '127.0.0.1';
const PORT = Number(process.env.WCS_REALTIME_PORT || 8787);
const MYSQL_BIN = process.env.WCS_MYSQL_BIN || 'mysql';
const MYSQL_DB = process.env.WCS_MYSQL_DB || 'overflow_warning_local';
const MYSQL_HOST = process.env.WCS_MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = process.env.WCS_MYSQL_PORT || '3306';
const MYSQL_USER = process.env.WCS_MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.WCS_MYSQL_PASSWORD || 'root';

const REALTIME_COLUMNS = [
  'sample_time',
  'well_depth_m',
  'bit_depth_m',
  'operation_state_std',
  'drilling_state_raw',
  'hook_load_kn',
  'wob_kn',
  'rotary_rpm',
  'torque_knm',
  'casing_pressure_mpa',
  'standpipe_pressure_mpa',
  'pump_spm_total',
  'inlet_flow_raw',
  'outlet_flow_raw',
  'inlet_density_g_cm3',
  'outlet_density_g_cm3',
  'inlet_temperature_c',
  'outlet_temperature_c',
  'gain_loss_raw',
  'total_pit_volume_m3',
  'total_gas_pct',
];

const tableCache = new Map();

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sqlQuote(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function normalizeWellId(input) {
  const raw = String(input || '').trim();
  if (!raw) return 'rt_000075';
  const match = raw.match(/(\d+)/);
  if (!match) return raw;
  return `rt_${match[1].padStart(6, '0')}`;
}

async function mysql(sql) {
  const args = [
    `--host=${MYSQL_HOST}`,
    `--port=${MYSQL_PORT}`,
    `--user=${MYSQL_USER}`,
    `--password=${MYSQL_PASSWORD}`,
    '--batch',
    '--raw',
    `--database=${MYSQL_DB}`,
    `--execute=${sql}`,
  ];
  const { stdout } = await execFileAsync(MYSQL_BIN, args, {
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

function parseTsv(stdout) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const values = line.split('\t');
    const row = {};
    headers.forEach((header, index) => {
      const raw = values[index];
      if (raw === undefined || raw === 'NULL' || raw === '') {
        row[header] = null;
        return;
      }
      const numeric = Number(raw);
      row[header] = Number.isFinite(numeric) && raw.trim() !== '' && !Number.isNaN(numeric) ? numeric : raw;
    });
    return row;
  });
}

async function resolveTable(wellIdInput) {
  const normalized = normalizeWellId(wellIdInput);
  if (tableCache.has(normalized)) return tableCache.get(normalized);
  const numericId = Number((normalized.match(/\d+/) || [''])[0]);
  const rows = parseTsv(await mysql(`
    SELECT well_id, table_name
    FROM well_realtime_table_registry
    WHERE table_name=${sqlQuote(normalized)}
       OR well_id=${Number.isFinite(numericId) ? numericId : -1}
    LIMIT 1;
  `));
  if (!rows.length) throw new Error(`No realtime table registered for ${normalized}`);
  const table = String(rows[0].table_name || '');
  if (!/^rt_\d{6}$/.test(table)) throw new Error(`Unsafe realtime table name: ${table}`);
  tableCache.set(normalized, table);
  return table;
}

async function listWells() {
  const rows = parseTsv(await mysql(`
    SELECT well_id, table_name
    FROM well_realtime_table_registry
    ORDER BY well_id
    LIMIT 300;
  `));
  return rows.map((row) => ({
    wellId: row.table_name,
    numericWellId: row.well_id,
    tableName: row.table_name,
  }));
}

async function fetchRealtimeRows({ wellId, since, limit }) {
  const table = await resolveTable(wellId);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 3, 120));
  const columnSql = REALTIME_COLUMNS.map((column) => `\`${column}\``).join(', ');
  const where = since ? `WHERE sample_time > ${sqlQuote(since)}` : '';
  const order = since ? 'ASC' : 'DESC';
  const rows = parseTsv(await mysql(`
    SELECT ${columnSql}
    FROM \`${table}\`
    ${where}
    ORDER BY sample_time ${order}
    LIMIT ${safeLimit};
  `));
  if (!since) rows.reverse();
  return { table, records: rows };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }
  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    if (url.pathname === '/health') {
      json(res, 200, { ok: true, db: MYSQL_DB, host: MYSQL_HOST, port: MYSQL_PORT });
      return;
    }
    if (url.pathname === '/api/wells') {
      json(res, 200, { ok: true, wells: await listWells() });
      return;
    }
    if (url.pathname === '/api/realtime') {
      const payload = await fetchRealtimeRows({
        wellId: url.searchParams.get('wellId') || 'rt_000075',
        since: url.searchParams.get('since') || '',
        limit: url.searchParams.get('limit') || '3',
      });
      json(res, 200, { ok: true, ...payload });
      return;
    }
    json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Well realtime proxy listening at http://${HOST}:${PORT}`);
});
