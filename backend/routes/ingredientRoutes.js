// BeerJSON Ingredients Catalog & Admin Management Routes
export const registerIngredientRoutes = (app, ingredientsPool, authenticateToken, requireAdmin, audit = async () => {}) => {
    const validTables = ['fermentables', 'hops', 'yeasts', 'miscs'];

    for (const tableName of validTables) {
        app.get(`/api/ingredients/${tableName}`, authenticateToken, async (req, res) => {
            try {
                const [rows] = await ingredientsPool.execute(`SELECT * FROM ${tableName} ORDER BY name ASC`);
                res.json(rows);
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Erro interno no servidor' });
            }
        });
    }

    app.post('/api/admin/ingredients/:table', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { table } = req.params;
            if (!validTables.includes(table)) return res.status(400).json({ error: 'Tabela inválida' });
            
            const { name, name_pt } = req.body || {};
            if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
            const [result] = await ingredientsPool.execute(`INSERT INTO ${table} (name, name_pt) VALUES (?, ?)`, [name, name_pt ?? null]);
            await audit(req, 'CREATE_INGREDIENT', `${table}: ${name}`);
            res.json({ id: result.insertId, message: 'Ingrediente criado' });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.put('/api/admin/ingredients/:table/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { table, id } = req.params;
            if (!validTables.includes(table)) return res.status(400).json({ error: 'Tabela inválida' });
            
            const { name, name_pt } = req.body || {};
            if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
            await ingredientsPool.execute(`UPDATE ${table} SET name = ?, name_pt = ? WHERE id = ?`, [name, name_pt ?? null, id]);
            await audit(req, 'UPDATE_INGREDIENT', `${table} ${id}: ${name}`);
            res.json({ message: 'Ingrediente atualizado' });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });

    app.delete('/api/admin/ingredients/:table/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { table, id } = req.params;
            if (!validTables.includes(table)) return res.status(400).json({ error: 'Tabela inválida' });
            
            await ingredientsPool.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
            await audit(req, 'DELETE_INGREDIENT', `${table} ${id}`);
            res.json({ message: 'Ingrediente deletado' });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno no servidor' }); }
    });
};
