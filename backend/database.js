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

  CREATE TABLE IF NOT EXISTS atracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    responsavel TEXT,
    telefone TEXT,
    email TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    descricao TEXT,
    ativo INTEGER DEFAULT 1,
    atracao_id INTEGER,
    tipo_comissao TEXT DEFAULT 'percentual',
    valor_comissao REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (atracao_id) REFERENCES atracoes(id)
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
    whatsapp_enviado INTEGER DEFAULT 0,
    whatsapp_erro TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (operador_id) REFERENCES operadores(id)
  );

  CREATE TABLE IF NOT EXISTS pedidos_yampi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    yampi_order_id INTEGER UNIQUE NOT NULL,
    numero_pedido TEXT,
    status_financeiro TEXT,
    status_entrega TEXT,
    cliente_nome TEXT,
    cliente_email TEXT,
    valor_total REAL,
    data_pedido DATETIME,
    data_sincronizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    json_completo TEXT,
    processado INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS itens_pedido_yampi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_yampi_id INTEGER NOT NULL,
    yampi_item_id INTEGER,
    produto_yampi_nome TEXT,
    sku TEXT,
    quantidade INTEGER,
    preco_unitario REAL,
    valor_total REAL,
    produto_id INTEGER,
    atracao_id INTEGER,
    classificado INTEGER DEFAULT 0,
    data_classificacao DATETIME,
    FOREIGN KEY (pedido_yampi_id) REFERENCES pedidos_yampi(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (atracao_id) REFERENCES atracoes(id)
  );

  CREATE TABLE IF NOT EXISTS configuracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT UNIQUE NOT NULL,
    valor TEXT,
    descricao TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ============================================
// MIGRAÇÕES AUTOMÁTICAS
// ============================================

console.log('🔄 Verificando migrações...');

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

// Verificar e adicionar colunas de WhatsApp
try {
  db.prepare('SELECT whatsapp_enviado FROM vendas LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando colunas de WhatsApp...');
  db.exec(`ALTER TABLE vendas ADD COLUMN whatsapp_enviado INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE vendas ADD COLUMN whatsapp_erro TEXT`);
  console.log('✅ Colunas de WhatsApp adicionadas');
}

// Verificar e adicionar colunas Yampi aos produtos
try {
  db.prepare('SELECT atracao_id FROM produtos LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando colunas Yampi aos produtos...');
  db.exec(`ALTER TABLE produtos ADD COLUMN atracao_id INTEGER`);
  db.exec(`ALTER TABLE produtos ADD COLUMN tipo_comissao TEXT DEFAULT 'percentual'`);
  db.exec(`ALTER TABLE produtos ADD COLUMN valor_comissao REAL DEFAULT 0`);
  console.log('✅ Colunas Yampi adicionadas aos produtos');
}

// ============================================
// 🆕 NOVAS MIGRAÇÕES PARA PEDIDOS YAMPI
// ============================================

// Adicionar colunas extras de cliente
try {
  db.prepare('SELECT cliente_cpf FROM pedidos_yampi LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando colunas extras de cliente...');
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN cliente_cpf TEXT`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN cliente_telefone TEXT`);
  console.log('✅ Colunas de cliente adicionadas (CPF, telefone)');
}

// Adicionar colunas extras de status
try {
  db.prepare('SELECT status_pedido FROM pedidos_yampi LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando colunas extras de status...');
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN status_pedido TEXT`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN status_pedido_id INTEGER`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN metodo_pagamento TEXT`);
  console.log('✅ Colunas de status adicionadas (status_pedido, status_pedido_id, metodo_pagamento)');
}

// Adicionar colunas extras de valores
try {
  db.prepare('SELECT valor_produtos FROM pedidos_yampi LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando colunas extras de valores...');
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN valor_produtos REAL DEFAULT 0`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN valor_desconto REAL DEFAULT 0`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN valor_frete REAL DEFAULT 0`);
  console.log('✅ Colunas de valores adicionadas (produtos, desconto, frete)');
}

// Adicionar coluna de data de atualização
try {
  db.prepare('SELECT data_atualizacao FROM pedidos_yampi LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando coluna de data de atualização...');
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN data_atualizacao DATETIME`);
  console.log('✅ Coluna data_atualizacao adicionada');
}

// Adicionar colunas de endereço
try {
  db.prepare('SELECT endereco_rua FROM pedidos_yampi LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando colunas de endereço...');
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN endereco_rua TEXT`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN endereco_numero TEXT`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN endereco_complemento TEXT`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN endereco_bairro TEXT`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN endereco_cidade TEXT`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN endereco_estado TEXT`);
  db.exec(`ALTER TABLE pedidos_yampi ADD COLUMN endereco_cep TEXT`);
  console.log('✅ Colunas de endereço adicionadas (rua, número, complemento, bairro, cidade, estado, CEP)');
}

// Adicionar coluna de produto_id nos itens (se não existir)
try {
  db.prepare('SELECT produto_id FROM itens_pedido_yampi LIMIT 1').get();
} catch (error) {
  console.log('⚙️ Adicionando coluna produto_id aos itens...');
  db.exec(`ALTER TABLE itens_pedido_yampi ADD COLUMN produto_id INTEGER`);
  console.log('✅ Coluna produto_id adicionada aos itens');
}

// Criar índices para melhor performance (se não existirem)
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pedidos_numero ON pedidos_yampi(numero_pedido)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_email ON pedidos_yampi(cliente_email)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos_yampi(status_pedido_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pedidos_data ON pedidos_yampi(data_pedido)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pedidos_cpf ON pedidos_yampi(cliente_cpf)`);
  console.log('✅ Índices criados/verificados');
} catch (error) {
  // Índices já existem, ignorar
}

console.log('✅ Todas as migrações verificadas e aplicadas!');

// ============================================
// DADOS INICIAIS
// ============================================

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

// Inserir configurações padrão da EvoAPI
const configPadrao = [
  { chave: 'evoapi_url', valor: 'http://148.230.76.31:8080', descricao: 'URL base da EvoAPI' },
  { chave: 'evoapi_key', valor: 'B6BDD71917CB-48D0-9C12-E4A4FFF24039', descricao: 'API Key da EvoAPI' },
  { chave: 'evoapi_instance', valor: 'visite', descricao: 'Nome da instância do WhatsApp' },
  { chave: 'whatsapp_mensagem', valor: 'Olá {nome}! 🎫\n\nSegue seu ingresso #{codigo}.\n\nObrigado pela preferência!\n\n*Visite Campos do Jordão* 🏔️', descricao: 'Mensagem enviada com o ingresso' },
  { chave: 'whatsapp_ativo', valor: '1', descricao: 'Ativar envio automático no WhatsApp (1=sim, 0=não)' },
  // Configurações Yampi
  { chave: 'yampi_alias', valor: '', descricao: 'Alias da loja Yampi (merchant alias)' },
  { chave: 'yampi_token', valor: '', descricao: 'User-Token da API Yampi' },
  { chave: 'yampi_secret', valor: '', descricao: 'User-Secret-Key da API Yampi' },
  { chave: 'yampi_sync_ativo', valor: '0', descricao: 'Ativar sincronização automática (1=sim, 0=não)' },
  { chave: 'yampi_sync_intervalo', valor: '60', descricao: 'Intervalo de sincronização em minutos' }
];

configPadrao.forEach(config => {
  const existe = db.prepare('SELECT id FROM configuracoes WHERE chave = ?').get(config.chave);
  if (!existe) {
    db.prepare('INSERT INTO configuracoes (chave, valor, descricao) VALUES (?, ?, ?)').run(
      config.chave,
      config.valor,
      config.descricao
    );
  }
});

console.log('✅ Configurações inicializadas (EvoAPI + Yampi)');

// ============================================
// RESUMO FINAL
// ============================================

console.log('\n========================================');
console.log('📊 RESUMO DO BANCO DE DADOS');
console.log('========================================');

const stats = {
  operadores: db.prepare('SELECT COUNT(*) as count FROM operadores').get().count,
  atracoes: db.prepare('SELECT COUNT(*) as count FROM atracoes').get().count,
  produtos: db.prepare('SELECT COUNT(*) as count FROM produtos').get().count,
  vendas: db.prepare('SELECT COUNT(*) as count FROM vendas').get().count,
  pedidos_yampi: db.prepare('SELECT COUNT(*) as count FROM pedidos_yampi').get().count,
  itens_yampi: db.prepare('SELECT COUNT(*) as count FROM itens_pedido_yampi').get().count,
};

console.log(`👥 Operadores: ${stats.operadores}`);
console.log(`🎪 Atrações: ${stats.atracoes}`);
console.log(`📦 Produtos: ${stats.produtos}`);
console.log(`💰 Vendas: ${stats.vendas}`);
console.log(`🛒 Pedidos Yampi: ${stats.pedidos_yampi}`);
console.log(`📋 Itens Yampi: ${stats.itens_yampi}`);
console.log('========================================\n');

module.exports = db;