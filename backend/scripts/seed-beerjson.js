import mysql from 'mysql2/promise';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const URLS = {
  fermentables: 'https://raw.githubusercontent.com/mike-gimelfarb/meadery/master/meadery/data/fermentables.json',
  yeasts: 'https://raw.githubusercontent.com/mike-gimelfarb/meadery/master/meadery/data/yeasts.json',
  hopsWiki: 'https://en.wikipedia.org/wiki/List_of_hop_varieties'
};

const sanitizeStr = (str) => {
  if (!str) return null;
  const clean = str.replace(/\n/g, ' ').replace(/\[\d+\]/g, '').trim(); // Remove refs like [1]
  return clean || null;
};

const scrapeHops = async () => {
  console.log(`Baixando Lúpulos (Wikipedia)...`);
  const hops = [];
  try {
    const { data } = await axios.get(URLS.hopsWiki, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 BrewwBot/1.0'
      }
    });
    const $ = cheerio.load(data);
    
    // As tabelas de lúpulos na Wikipedia tem a classe wikitable
    $('.wikitable tbody tr').each((i, row) => {
      if (i === 0) return; // Pula o cabeçalho
      
      const cols = $(row).find('td, th');
      const name = sanitizeStr($(cols[0]).text());
      if (!name) return;

      const origin = sanitizeStr($(cols[1]).text());
      const alphaRaw = sanitizeStr($(cols[2]).text());
      const purpose = sanitizeStr($(cols[4]).text());
      const notes = sanitizeStr($(cols[5]).text()) || sanitizeStr($(cols[6]).text());

      // Tenta extrair a média de alfa ácido (ex: "5.5-7.0" ou "5.5%")
      let alphaAcid = null;
      if (alphaRaw) {
        const matches = alphaRaw.match(/[\d.]+/g);
        if (matches && matches.length > 0) {
          // Pega o primeiro número, se for range (ex: 5-7), pega a média
          if (matches.length >= 2) {
            alphaAcid = (parseFloat(matches[0]) + parseFloat(matches[1])) / 2;
          } else {
            alphaAcid = parseFloat(matches[0]);
          }
        }
      }

      hops.push({
        name,
        alpha_acid: isNaN(alphaAcid) ? null : alphaAcid,
        form: 'pellet', // default
        use_purpose: purpose,
        origin,
        notes
      });
    });
    return hops;
  } catch (err) {
    console.error('Erro no Scraper de Lúpulos:', err.message);
    return [];
  }
};

const scrapeMeadery = async (url) => {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    console.error(`Erro ao baixar ${url}:`, err.message);
    return null;
  }
};

const seed = async () => {
  console.log('🤖 Iniciando Web Scraper (Robô) de Ingredientes...');

  const poolMaster = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
  });

  const dbName = process.env.DB_INGREDIENTS_NAME || 'breww_ingredients';

  try {
    console.log(`Verificando banco de dados: ${dbName}`);
    await poolMaster.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  } catch (err) {
    console.error(`Erro ao criar banco ${dbName}:`, err.message);
    process.exit(1);
  } finally {
    await poolMaster.end();
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: dbName
  });

  console.log('Criando tabelas limpas...');
  
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS fermentables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      name_pt VARCHAR(255),
      type VARCHAR(50),
      color FLOAT,
      yield FLOAT,
      origin VARCHAR(100),
      notes TEXT
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS hops (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      name_pt VARCHAR(255),
      alpha_acid FLOAT,
      form VARCHAR(50),
      use_purpose VARCHAR(50),
      origin VARCHAR(100),
      notes TEXT
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS yeasts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      name_pt VARCHAR(255),
      type VARCHAR(50),
      attenuation FLOAT,
      temp_min FLOAT,
      temp_max FLOAT,
      laboratory VARCHAR(100),
      notes TEXT
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS miscs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      name_pt VARCHAR(255),
      type VARCHAR(50),
      use_purpose VARCHAR(50),
      notes TEXT
    )
  `);

  // ==========================================
  // FERMENTABLES
  // ==========================================
  console.log(`Baixando Maltes/Fermentáveis...`);
  const fermData = await scrapeMeadery(URLS.fermentables);
  if (fermData) {
    let count = 0;
    for (const [key, item] of Object.entries(fermData)) {
      const name = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // water -> Water
      if (item.density && item.ppg !== undefined) {
        // yield é aproximadamente (ppg / 46.21) * 100
        const yieldVal = item.ppg ? parseFloat((item.ppg / 46.21 * 100).toFixed(1)) : null;
        await pool.execute(`
          INSERT IGNORE INTO fermentables (name, type, color, yield, origin, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [name, item.type || 'grain', item.color || null, yieldVal, null, item.notes || null]);
        count++;
      }
    }
    console.log(`✅ Maltes inseridos: ${count}`);
  }

  // ==========================================
  // YEASTS
  // ==========================================
  console.log(`Baixando Leveduras...`);
  const yeastData = await scrapeMeadery(URLS.yeasts);
  if (yeastData) {
    let count = 0;
    for (const [key, item] of Object.entries(yeastData)) {
      const name = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const atten = item.abv_limit ? parseFloat(item.abv_limit) * 4 : null; // Estimativa (só pra não ficar zerado)
      await pool.execute(`
        INSERT IGNORE INTO yeasts (name, type, attenuation, temp_min, temp_max, laboratory, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [name, 'ale', atten, null, null, null, `ABV Limit: ${item.abv_limit}% | N Req: ${item.nitrogen_requirement}`]);
      count++;
    }
    console.log(`✅ Leveduras inseridas: ${count}`);
  }

  // ==========================================
  // HOPS (Wikipedia)
  // ==========================================
  const scrapedHops = await scrapeHops();
  let hopCount = 0;
  for (const hop of scrapedHops) {
    await pool.execute(`
      INSERT IGNORE INTO hops (name, alpha_acid, form, use_purpose, origin, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [hop.name, hop.alpha_acid, hop.form, hop.use_purpose, hop.origin, hop.notes]);
    hopCount++;
  }
  console.log(`✅ Lúpulos inseridos: ${hopCount}`);

  await pool.end();
  console.log('🤖 Scraper Concluído com Sucesso!');
};

seed();
