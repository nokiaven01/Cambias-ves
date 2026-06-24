import https from "node:https";

/**
 * Vercel Serverless Function — /api/bcv
 * Scraper de las tasas oficiales del Banco Central de Venezuela (BCV).
 * Devuelve únicamente Dólar (USD) y Euro (EUR).
 *
 * Compatible con proyectos NO-Next.js (Vite / React SPA) desplegados en Vercel:
 * cualquier archivo dentro de la carpeta /api de la raíz se convierte en una
 * función serverless. Usa la firma estándar de Vercel:
 *   export default function handler(req, res)
 *
 * Sin dependencias externas: usa el módulo nativo node:https, por eso NO requiere
 * instalar nada (ni undici ni axios). El BCV publica en HTTPS con un certificado
 * no estándar, por eso usamos un Agent con rejectUnauthorized:false SOLO para esta
 * petición (no afecta al resto de la app).
 *
 * Fuente: https://www.bcv.org.ve/
 */

const BCV_HOST = "www.bcv.org.ve";
const BCV_URL = "https://www.bcv.org.ve/";

// Agent local que ignora el certificado SSL no estándar del BCV (alcance: esta request)
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

function fetchBcvHtml(timeoutMs = 40000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: BCV_HOST,
        path: "/",
        method: "GET",
        agent: insecureAgent,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "text/html",
        },
        timeout: timeoutMs,
      },
      (resp) => {
        if (resp.statusCode && resp.statusCode >= 400) {
          resp.resume();
          return reject(new Error(`BCV respondió ${resp.statusCode}`));
        }
        let data = "";
        resp.setEncoding("utf8");
        resp.on("data", (chunk) => (data += chunk));
        resp.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Timeout al consultar el BCV")));
    req.end();
  });
}

/**
 * Extrae la tasa a partir del id del bloque ("dolar" / "euro").
 * El BCV entrega: <div id="dolar" ...> ... <strong class="strong-tb">621,52...</strong>
 * El <strong> trae atributos, por eso usamos <strong[^>]*> (NO <strong> pelado).
 */
function parseRate(html, id) {
  const re = new RegExp(
    `id="${id}"[\\s\\S]*?<strong[^>]*>\\s*([\\d.,]+)\\s*<\\/strong>`,
    "i"
  );
  const m = html.match(re);
  if (!m) return null;
  // Formato venezolano "1.234,56" -> 1234.56
  const num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function parseFecha(html) {
  const m = html.match(/class="date-display-single"[^>]*>([^<]+)</i);
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

export default async function handler(req, res) {
  try {
    const html = await fetchBcvHtml();
    const usd = parseRate(html, "dolar");
    const eur = parseRate(html, "euro");

    if (usd == null || eur == null) {
      return res
        .status(502)
        .json({ ok: false, error: "No se pudieron leer las tasas (cambió el HTML del BCV)" });
    }

    // cachea en el edge de Vercel 1h y sirve copia vieja mientras revalida
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

    return res.status(200).json({
      ok: true,
      fuente: "Banco Central de Venezuela",
      url: BCV_URL,
      fecha_valor: parseFecha(html),
      actualizado: new Date().toISOString(),
      usd: { valor: Number(usd.toFixed(2)), raw: usd, unidad: "Bs/USD" },
      eur: { valor: Number(eur.toFixed(2)), raw: eur, unidad: "Bs/EUR" },
    });
  } catch (err) {
    const msg = err && err.message ? err.message : "Error al consultar el BCV";
    const code = msg.includes("respondió") ? 502 : 500;
    return res.status(code).json({ ok: false, error: msg });
  }
}
