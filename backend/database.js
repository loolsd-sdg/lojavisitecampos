const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('pdv_visite_campos.db');

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS operadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    permissao TEXT DEFAULT 'usuario',
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    descricao TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_cliente TEXT NOT NULL,
    produto_id INTEGER NOT NULL,
    produto_nome TEXT NOT NULL,
    quantidade_pessoas INTEGER NOT NULL,
    preco_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    desconto REAL DEFAULT 0,
    tipo_desconto TEXT,
    valor_total REAL NOT NULL,
    operador_id INTEGER NOT NULL,
    operador_nome TEXT NOT NULL,
    codigo_venda TEXT UNIQUE NOT NULL,
    venda_online INTEGER DEFAULT 0,
    telefone_cliente TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (operador_id) REFERENCES operadores(id)
  );
`);

// Verificar se a coluna permissao existe, se não, adicionar
try {
  db.prepare('SELECT permissao FROM operadores LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando coluna de permissão...');
  db.exec(`ALTER TABLE operadores ADD COLUMN permissao TEXT DEFAULT 'usuario'`);
  console.log('✅ Coluna de permissão adicionada');
}

// Verificar e adicionar colunas de venda online
try {
  db.prepare('SELECT venda_online FROM vendas LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando colunas de venda online...');
  db.exec(`ALTER TABLE vendas ADD COLUMN venda_online INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE vendas ADD COLUMN telefone_cliente TEXT`);
  console.log('✅ Colunas de venda online adicionadas');
}

// Criar operador admin padrão se não existir
const adminExists = db.prepare('SELECT id FROM operadores WHERE username = ?').get('admin');

if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO operadores (nome, username, password, permissao) VALUES (?, ?, ?, ?)').run(
    'Administrador',
    'admin',
    hashedPassword,
    'admin'
  );
  console.log('✅ Operador admin criado: username=admin, password=admin123, permissão=admin');
} else {
  // Garantir que o admin tenha permissão de admin
  db.prepare('UPDATE operadores SET permissao = ? WHERE username = ?').run('admin', 'admin');
}

// Criar produto exemplo se não existir nenhum
const produtosCount = db.prepare('SELECT COUNT(*) as count FROM produtos').get();

if (produtosCount.count === 0) {
  db.prepare('INSERT INTO produtos (nome, preco, descricao) VALUES (?, ?, ?)').run(
    'Dreamshouse',
    50.00,
    'Ingresso para Dreamshouse'
  );
  console.log('✅ Produto exemplo criado: Dreamshouse');
}

module.exports = db;