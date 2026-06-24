import mysql from 'mysql2/promise';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const translateBatch = async (ai, table, items) => {
    if (items.length === 0) return [];

    const names = items.map(item => item.name);
    
    const prompt = `Você é um mestre cervejeiro especialista em ingredientes. Traduza o seguinte array JSON contendo nomes de ingredientes de cerveja do inglês para o português do Brasil.
    
REGRAS IMPORTANTES:
1. Mantenha os nomes próprios de lúpulos e leveduras no original, pois são marcas/variedades universais (Ex: "Cascade", "Citra", "Saaz", "US-05", "Safale" continuam iguais).
2. Traduza os maltes e açúcares. (Ex: "Pale Ale Malt" -> "Malte Pale Ale", "Wheat Malt" -> "Malte de Trigo", "Crystal 60L" -> "Malte Crystal 60L").
3. Clarificantes e adjuntos também traduzidos (Ex: "Irish Moss" -> "Irish Moss" ou "Musgo Irlandês", "Lactose" -> "Lactose").
4. Retorne EXATAMENTE e APENAS um array JSON de strings, na mesma ordem do array original. Sem markdown, sem explicações extras.

Ingredientes (${table}):
${JSON.stringify(names)}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const translatedText = response.text;
        const translatedArray = JSON.parse(translatedText);

        if (translatedArray.length !== items.length) {
            console.error(`❌ Incompatibilidade de tamanho no retorno do lote para a tabela ${table}. Esperado ${items.length}, recebido ${translatedArray.length}`);
            return [];
        }

        return translatedArray;
    } catch (err) {
        console.error(`❌ Erro na API do Gemini para a tabela ${table}:`, err.message);
        return [];
    }
};

const runTranslation = async () => {
    console.log('🤖 Iniciando Tradutor de Ingredientes via Gemini AI...');

    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ ERRO: GEMINI_API_KEY ou VITE_GEMINI_API_KEY não encontrada no .env');
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });
    const dbName = process.env.DB_INGREDIENTS_NAME || 'breww_ingredients';

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS,
        database: dbName
    });

    const tables = ['fermentables', 'hops', 'yeasts', 'miscs'];
    const BATCH_SIZE = 50; // Quantos ingredientes traduzir por requisição para não estourar contexto e economizar tokens

    for (const table of tables) {
        console.log(`\n🔍 Verificando tabela: ${table}`);
        try {
            const [rows] = await pool.execute(`SELECT id, name FROM ${table} WHERE name_pt IS NULL`);
            if (rows.length === 0) {
                console.log(`✅ Todos os itens de '${table}' já estão traduzidos.`);
                continue;
            }

            console.log(`⏳ Encontrados ${rows.length} itens não traduzidos em '${table}'. Iniciando tradução em lotes de ${BATCH_SIZE}...`);

            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE);
                console.log(`   -> Traduzindo lote ${Math.floor(i/BATCH_SIZE) + 1} de ${Math.ceil(rows.length/BATCH_SIZE)}...`);
                
                const translatedNames = await translateBatch(ai, table, batch);

                if (translatedNames.length > 0) {
                    for (let j = 0; j < batch.length; j++) {
                        const id = batch[j].id;
                        const originalName = batch[j].name;
                        const namePt = translatedNames[j];
                        
                        await pool.execute(`UPDATE ${table} SET name_pt = ? WHERE id = ?`, [namePt, id]);
                        console.log(`      [OK] ${originalName} -> ${namePt}`);
                    }
                }
                
                // Pequena pausa para evitar Rate Limit (429) do Gemini Free Tier
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log(`✅ Tradução concluída para '${table}'!`);
        } catch (err) {
            console.error(`❌ Erro ao processar tabela ${table}:`, err.message);
        }
    }

    await pool.end();
    console.log('\n🎉 Tradutor Concluído com Sucesso!');
};

runTranslation();
