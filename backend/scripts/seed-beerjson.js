import mysql from 'mysql2/promise';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';

// Carrega as variáveis do .env da raiz ou do backend
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

// Devido ao BeerJSON não hospedar um único arquivo JSON contendo todos os ingredientes
// em sua raiz (eles são apenas um padrão de esquema), incluímos aqui uma carga inicial
// de ingredientes comuns (Seed Data) seguindo a estrutura BeerJSON.
// Futuramente você pode apontar para uma API própria ou carregar de arquivos locais .json.

const localSeedData = {
  fermentables: [
    { name: "Pilsner Malt", type: "grain", color: { value: 3.5 }, yield: { value: 80.5 }, origin: "Germany", notes: "Malte base claro." },
    { name: "Pale Ale Malt", type: "grain", color: { value: 5.5 }, yield: { value: 80.0 }, origin: "UK", notes: "Malte base para Ales." },
    { name: "Munich Malt", type: "grain", color: { value: 15.0 }, yield: { value: 78.0 }, origin: "Germany", notes: "Adiciona cor e sabor maltado." },
    { name: "Wheat Malt", type: "grain", color: { value: 4.0 }, yield: { value: 82.0 }, origin: "Germany", notes: "Malte de trigo." },
    { name: "Crystal 60L", type: "grain", color: { value: 60.0 }, yield: { value: 74.0 }, origin: "US", notes: "Malte caramelo." }
  ],
  hops: [
    { name: "Cascade", alpha_acid: { value: 5.5 }, form: "pellet", use: "aroma", origin: "US", notes: "Cítrico, grapefruit." },
    { name: "Centennial", alpha_acid: { value: 10.0 }, form: "pellet", use: "both", origin: "US", notes: "Floral, cítrico." },
    { name: "Magnum", alpha_acid: { value: 14.0 }, form: "pellet", use: "bittering", origin: "Germany", notes: "Amargor limpo." },
    { name: "Saaz", alpha_acid: { value: 3.5 }, form: "pellet", use: "aroma", origin: "Czech", notes: "Terroso, especiarias." },
    { name: "Citra", alpha_acid: { value: 12.0 }, form: "pellet", use: "aroma", origin: "US", notes: "Frutas tropicais fortes." }
  ],
  yeasts: [
    { name: "US-05 (Safale)", type: "ale", attenuation: { value: 81 }, fermentation_temperature: { minimum: { value: 18 }, maximum: { value: 28 } }, laboratory: "Fermentis", notes: "Levedura Ale americana neutra." },
    { name: "S-04 (Safale)", type: "ale", attenuation: { value: 75 }, fermentation_temperature: { minimum: { value: 15 }, maximum: { value: 20 } }, laboratory: "Fermentis", notes: "Levedura Ale inglesa." },
    { name: "W-34/70 (Saflager)", type: "lager", attenuation: { value: 83 }, fermentation_temperature: { minimum: { value: 9 }, maximum: { value: 22 } }, laboratory: "Fermentis", notes: "Levedura Lager clássica de Weihenstephan." }
  ],
  miscs: [
    { name: "Whirlfloc", type: "fining", use: "boil", notes: "Pastilha clarificante." },
    { name: "Irish Moss", type: "fining", use: "boil", notes: "Alga clarificante." },
    { name: "Lactose", type: "flavor", use: "boil", notes: "Açúcar não fermentescível." }
  ]
};

const fetchJson = async (type) => {
  // Simulando um fetch para manter a estrutura original do seu código
  return Promise.resolve({ [type]: localSeedData[type] });
};

const seed = async () => {
  console.log('🌱 Iniciando Seed do BeerJSON...');

  // 1. Conectar ao MySQL padrão para criar o DB se não existir
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
    console.error(`Erro ao criar o banco ${dbName}:`, err.message);
    process.exit(1);
  } finally {
    await poolMaster.end();
  }

  // 2. Conectar ao novo DB
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: dbName
  });

  // 3. Criar tabelas
  console.log('Criando tabelas...');
  
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

  console.log('✅ Tabelas criadas com sucesso!');

  // 4. Fetch e Insert
  try {
    console.log(`Baixando fermentables...`);
    const fermData = await fetchJson('fermentables');
    if (fermData && fermData.fermentables) {
      for (const item of fermData.fermentables) {
        const color = item.color ? item.color.value : null;
        const yieldVal = item.yield ? item.yield.value : null;
        await pool.execute(`
          INSERT IGNORE INTO fermentables (name, type, color, yield, origin, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [item.name, item.type, color, yieldVal, item.origin || null, item.notes || null]);
      }
      console.log(`✅ Fermentables inseridos: ${fermData.fermentables.length}`);
    }

    console.log(`Baixando hops...`);
    const hopData = await fetchJson('hops');
    if (hopData && hopData.hops) {
      for (const item of hopData.hops) {
        const alpha = item.alpha_acid ? item.alpha_acid.value : null;
        await pool.execute(`
          INSERT IGNORE INTO hops (name, alpha_acid, form, use_purpose, origin, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [item.name, alpha, item.form || null, item.use || null, item.origin || null, item.notes || null]);
      }
      console.log(`✅ Hops inseridos: ${hopData.hops.length}`);
    }

    console.log(`Baixando yeasts...`);
    const yeastData = await fetchJson('yeasts');
    if (yeastData && yeastData.yeasts) {
      for (const item of yeastData.yeasts) {
        const atten = item.attenuation ? item.attenuation.value : null;
        const tempMin = item.fermentation_temperature && item.fermentation_temperature.minimum ? item.fermentation_temperature.minimum.value : null;
        const tempMax = item.fermentation_temperature && item.fermentation_temperature.maximum ? item.fermentation_temperature.maximum.value : null;
        await pool.execute(`
          INSERT IGNORE INTO yeasts (name, type, attenuation, temp_min, temp_max, laboratory, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [item.name, item.type, atten, tempMin, tempMax, item.laboratory || null, item.notes || null]);
      }
      console.log(`✅ Yeasts inseridos: ${yeastData.yeasts.length}`);
    }

    console.log(`Baixando miscs...`);
    const miscData = await fetchJson('miscs');
    if (miscData && miscData.miscs) {
      for (const item of miscData.miscs) {
        await pool.execute(`
          INSERT IGNORE INTO miscs (name, type, use_purpose, notes)
          VALUES (?, ?, ?, ?)
        `, [item.name, item.type, item.use || null, item.notes || null]);
      }
      console.log(`✅ Miscs inseridos: ${miscData.miscs.length}`);
    }

  } catch (err) {
    console.error('❌ Erro durante o download ou inserção:', err);
  } finally {
    await pool.end();
    console.log('🎉 Seed completo!');
  }
};

seed();
