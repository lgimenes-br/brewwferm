// Banco em memoria com as consultas de users + user_identities usadas pelas rotas de login.
export const createFakeUsersDb = () => {
    const users = [];
    const identities = [];
    let identityId = 0;
    const dup = () => Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });

    const execute = async (sql, p = []) => {
        const q = sql.replace(/\s+/g, ' ').trim();
        // user_identities
        if (q.startsWith('SELECT user_id FROM user_identities WHERE provider = ? AND subject = ?'))
            return [identities.filter(i => i.provider === p[0] && i.subject === p[1])];
        if (q.startsWith('SELECT subject FROM user_identities WHERE user_id = ? AND provider = ?'))
            return [identities.filter(i => i.user_id === p[0] && i.provider === p[1])];
        if (q.startsWith('SELECT provider, email, created_at FROM user_identities WHERE user_id = ?'))
            return [identities.filter(i => i.user_id === p[0])];
        if (q.startsWith('INSERT INTO user_identities')) {
            const [user_id, provider, subject, email] = p;
            if (identities.some(i => (i.provider === provider && i.subject === subject) || (i.user_id === user_id && i.provider === provider))) throw dup();
            identities.push({ id: ++identityId, user_id, provider, subject, email, created_at: '2026-11-11T00:00:00Z' });
            return [{ insertId: identityId }];
        }
        if (q.startsWith('UPDATE user_identities SET email = ?')) {
            identities.filter(i => i.provider === p[1] && i.subject === p[2]).forEach(i => { i.email = p[0]; });
            return [{}];
        }
        if (q.startsWith('DELETE FROM user_identities WHERE user_id = ? AND provider = ?')) {
            for (let k = identities.length - 1; k >= 0; k--) if (identities[k].user_id === p[0] && identities[k].provider === p[1]) identities.splice(k, 1);
            return [{}];
        }
        // users
        if (q.startsWith('SELECT id, name, role FROM users WHERE id = ?')) return [users.filter(u => u.id === p[0])];
        if (q.startsWith('SELECT id, name, role FROM users WHERE password_hash = ?')) return [users.filter(u => u.password_hash === p[0])];
        if (q.startsWith('SELECT id, name, role FROM users WHERE LOWER(email) = ?')) return [users.filter(u => u.email.toLowerCase() === p[0])];
        if (q.startsWith('SELECT email, password_hash FROM users WHERE id = ?')) return [users.filter(u => u.id === p[0])];
        if (q.startsWith('SELECT name, email FROM users WHERE id = ?')) return [users.filter(u => u.id === p[0])];
        if (q.startsWith('UPDATE users SET avatar_url = ? WHERE id = ?')) {
            users.filter(u => u.id === p[1]).forEach(u => { u.avatar_url = p[0]; });
            return [{}];
        }
        if (q.startsWith('INSERT INTO users')) {
            const [name, email, password_hash] = p;
            if (users.some(u => u.email === email)) throw dup();
            users.push({ id: users.length + 1, name, email, password_hash, role: 'user' });
            return [{ insertId: users.length }];
        }
        throw new Error('SQL inesperado no teste: ' + q);
    };
    return { pool: { execute }, users, identities };
};
