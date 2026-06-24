import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const seedAdmin = async () => {
    console.log('🤖 Iniciando criação do usuário Administrador...');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS,
        database: process.env.DB_NAME || 'brewbrother'
    });

    try {
        const email = 'admin@breww.live';
        const password = 'admin'; // A senha inicial é admin (pode ser alterada depois)
        const name = 'Administrador Breww';
        const role = 'admin';

        const [existing] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            console.log(`⚠️ Usuário ${email} já existe. Garantindo que ele tenha a role 'admin'...`);
            await pool.execute('UPDATE users SET role = ? WHERE email = ?', [role, email]);
            console.log('✅ Role atualizada para admin.');
        } else {
            console.log(`⏳ Criando usuário ${email}...`);
            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, role]);
            console.log('✅ Usuário Administrador criado com sucesso! (Senha padrão: admin)');
        }
    } catch (err) {
        console.error('❌ Erro ao criar admin:', err.message);
    } finally {
        await pool.end();
    }
};

seedAdmin();
