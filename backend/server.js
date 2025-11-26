require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const db = require('./database');
const { gerarEEnviarIngresso } = require('./whatsapp');
const yampi = require('./yampi');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
  if (req.user.permissao !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

// ============= ROTAS DE AUTENTICAÇÃO =============

// Login
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;

    const operador = db.prepare('SELECT * FROM operadores WHERE username = ? AND ativo = 1').get(username);

    if (!operador) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const validPassword = bcrypt.compareSync(password, operador.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = jwt.sign(
      { 
        id: operador.id, 
        username: operador.username, 
        nome: operador.nome,
        permissao: operador.permissao || 'usuario'
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      operador: {
        id: operador.id,
        nome: operador.nome,
        username: operador.username,
        permissao: operador.permissao || 'usuario'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTAS DE ATRAÇÕES (APENAS ADMIN) =============

// Listar atrações
app.get('/api/atracoes', authenticateToken, requireAdmin, (req, res) => {
  try {
    const atracoes = db.prepare('SELECT * FROM atracoes WHERE ativo = 1 ORDER BY nome').all();
    res.json(atracoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar atração
app.post('/api/atracoes', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { nome, descricao, responsavel, telefone, email } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const result = db.prepare(`
      INSERT INTO atracoes (nome, descricao, responsavel, telefone, email)
      VALUES (?, ?, ?, ?, ?)
    `).run(nome, descricao || '', responsavel || '', telefone || '', email || '');

    res.status(201).json({ 
      id: result.lastInsertRowid, 
      message: 'Atração criada com sucesso' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar atração
app.put('/api/atracoes/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, responsavel, telefone, email } = req.body;

    db.prepare(`
      UPDATE atracoes SET
        nome = ?, descricao = ?, responsavel = ?, telefone = ?, email = ?
      WHERE id = ?
    `).run(nome, descricao || '', responsavel || '', telefone || '', email || '', id);

    res.json({ message: 'Atração atualizada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Desativar atração
app.delete('/api/atracoes/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE atracoes SET ativo = 0 WHERE id = ?').run(id);
    res.json({ message: 'Atração desativada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Relatório financeiro de uma atração
app.get('/api/atracoes/:id/relatorio', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { dataInicio, dataFim } = req.query;

    // Buscar atração
    const atracao = db.prepare('SELECT * FROM atracoes WHERE id = ?').get(id);
    if (!atracao) {
      return res.status(404).json({ error: 'Atração não encontrada' });
    }

    // Query base
    let query = `
      SELECT 
        i.id,
        i.produto_yampi_nome,
        i.quantidade,
        i.valor_total,
        i.data_classificacao,
        p.numero_pedido,
        p.cliente_nome,
        p.data_pedido,
        prod.nome as produto_interno_nome,
        prod.tipo_comissao,
        prod.valor_comissao
      FROM itens_pedido_yampi i
      INNER JOIN pedidos_yampi p ON i.pedido_yampi_id = p.id
      LEFT JOIN produtos prod ON i.produto_id = prod.id
      WHERE i.atracao_id = ? AND i.classificado = 1
    `;

    const params = [id];

    if (dataInicio) {
      query += ` AND DATE(p.data_pedido) >= DATE(?)`;
      params.push(dataInicio);
    }

    if (dataFim) {
      query += ` AND DATE(p.data_pedido) <= DATE(?)`;
      params.push(dataFim);
    }

    query += ` ORDER BY p.data_pedido DESC`;

    const itens = db.prepare(query).all(...params);

    // Calcular totais
    let faturamentoTotal = 0;
    let comissaoTotal = 0;

    itens.forEach(item => {
      faturamentoTotal += item.valor_total;

      if (item.tipo_comissao && item.valor_comissao) {
        if (item.tipo_comissao === 'percentual') {
          comissaoTotal += (item.valor_total * item.valor_comissao) / 100;
        } else {
          comissaoTotal += item.valor_comissao * item.quantidade;
        }
      }
    });

    const valorLiquido = faturamentoTotal - comissaoTotal;

    res.json({
      atracao,
      resumo: {
        faturamentoTotal,
        comissaoTotal,
        valorLiquido,
        totalItens: itens.length
      },
      itens
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTAS YAMPI (APENAS ADMIN) =============

// Testar conexão Yampi
app.post('/api/yampi/testar-conexao', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const resultado = await yampi.testarConexao();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sincronizar pedidos
app.post('/api/yampi/sincronizar', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page, limit, filters } = req.body;
    const resultado = await yampi.sincronizarPedidos({ page, limit, filters });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar pedidos importados
app.get('/api/yampi/pedidos', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const pedidos = db.prepare(`
      SELECT * FROM pedidos_yampi 
      ORDER BY data_pedido DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM pedidos_yampi').get();

    res.json({
      pedidos,
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detalhes de um pedido
app.get('/api/yampi/pedidos/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    const pedido = db.prepare('SELECT * FROM pedidos_yampi WHERE id = ?').get(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const itens = db.prepare(`
      SELECT i.*, 
             p.nome as produto_interno_nome,
             a.nome as atracao_nome
      FROM itens_pedido_yampi i
      LEFT JOIN produtos p ON i.produto_id = p.id
      LEFT JOIN atracoes a ON i.atracao_id = a.id
      WHERE i.pedido_yampi_id = ?
    `).all(id);

    res.json({ pedido, itens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar itens não classificados
app.get('/api/yampi/itens-nao-classificados', authenticateToken, requireAdmin, (req, res) => {
  try {
    const itens = db.prepare(`
      SELECT i.*, 
             p.numero_pedido,
             p.cliente_nome,
             p.data_pedido
      FROM itens_pedido_yampi i
      INNER JOIN pedidos_yampi p ON i.pedido_yampi_id = p.id
      WHERE i.classificado = 0
      ORDER BY p.data_pedido DESC
      LIMIT 100
    `).all();

    res.json(itens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Classificar item de pedido
app.put('/api/yampi/itens/:id/classificar', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { produto_id, atracao_id } = req.body;

    if (!produto_id || !atracao_id) {
      return res.status(400).json({ error: 'produto_id e atracao_id são obrigatórios' });
    }

    db.prepare(`
      UPDATE itens_pedido_yampi SET
        produto_id = ?,
        atracao_id = ?,
        classificado = 1,
        data_classificacao = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(produto_id, atracao_id, id);

    res.json({ message: 'Item classificado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Classificar múltiplos itens
app.post('/api/yampi/itens/classificar-lote', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { itens } = req.body; // Array de { id, produto_id, atracao_id }

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Array de itens é obrigatório' });
    }

    const stmt = db.prepare(`
      UPDATE itens_pedido_yampi SET
        produto_id = ?,
        atracao_id = ?,
        classificado = 1,
        data_classificacao = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    let sucesso = 0;
    let erros = 0;

    itens.forEach(item => {
      try {
        stmt.run(item.produto_id, item.atracao_id, item.id);
        sucesso++;
      } catch (error) {
        console.error(`Erro ao classificar item ${item.id}:`, error);
        erros++;
      }
    });

    res.json({ 
      message: `Classificação concluída: ${sucesso} sucesso, ${erros} erros`,
      sucesso,
      erros
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTAS DE CONFIGURAÇÕES (APENAS ADMIN) =============

// Listar configurações
app.get('/api/configuracoes', authenticateToken, requireAdmin, (req, res) => {
  try {
    const configs = db.prepare('SELECT * FROM configuracoes ORDER BY chave').all();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar configuração
app.put('/api/configuracoes/:chave', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { chave } = req.params;
    const { valor } = req.body;

    db.prepare('UPDATE configuracoes SET valor = ?, updated_at = CURRENT_TIMESTAMP WHERE chave = ?').run(valor, chave);
    res.json({ message: 'Configuração atualizada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Testar envio de WhatsApp
app.post('/api/configuracoes/testar-whatsapp', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { telefone } = req.body;

    if (!telefone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    const vendaTeste = {
      id: 0,
      codigo_venda: '0000',
      nome_cliente: 'Teste',
      produto_nome: 'Produto Teste',
      quantidade_pessoas: 1,
      preco_unitario: 50.00,
      subtotal: 50.00,
      desconto: 0,
      valor_total: 50.00,
      operador_nome: req.user.nome,
      telefone_cliente: telefone,
      created_at: new Date().toISOString()
    };

    const resultado = await gerarEEnviarIngresso(vendaTeste);
    
    if (resultado.whatsapp.sucesso) {
      res.json({ message: 'Mensagem de teste enviada com sucesso!', detalhes: resultado.whatsapp });
    } else {
      res.status(400).json({ error: 'Falha no envio', detalhes: resultado.whatsapp.erro });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTAS DE OPERADORES =============

// Listar operadores (APENAS ADMIN)
app.get('/api/operadores', authenticateToken, requireAdmin, (req, res) => {
  try {
    const operadores = db.prepare('SELECT id, nome, username, permissao, ativo, created_at FROM operadores ORDER BY nome').all();
    res.json(operadores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar operador (APENAS ADMIN)
app.post('/api/operadores', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { nome, username, password, permissao } = req.body;

    if (!nome || !username || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare('INSERT INTO operadores (nome, username, password, permissao) VALUES (?, ?, ?, ?)').run(
      nome,
      username,
      hashedPassword,
      permissao || 'usuario'
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Operador criado com sucesso' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Username já existe' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Desativar operador (APENAS ADMIN)
app.delete('/api/operadores/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Você não pode deletar seu próprio usuário' });
    }

    const operador = db.prepare('SELECT * FROM operadores WHERE id = ?').get(id);
    if (!operador) {
      return res.status(404).json({ error: 'Operador não encontrado' });
    }

    db.prepare('UPDATE operadores SET ativo = 0 WHERE id = ?').run(id);
    res.json({ message: 'Operador desativado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTAS DE PRODUTOS =============

// Listar produtos ativos (TODOS podem ver)
app.get('/api/produtos', authenticateToken, (req, res) => {
  try {
    const produtos = db.prepare(`
      SELECT p.*, a.nome as atracao_nome
      FROM produtos p
      LEFT JOIN atracoes a ON p.atracao_id = a.id
      WHERE p.ativo = 1 
      ORDER BY p.nome
    `).all();
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar produto (APENAS ADMIN)
app.post('/api/produtos', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { nome, preco, descricao, atracao_id, tipo_comissao, valor_comissao } = req.body;

    if (!nome || !preco) {
      return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
    }

    const result = db.prepare(`
      INSERT INTO produtos (nome, preco, descricao, atracao_id, tipo_comissao, valor_comissao) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      nome,
      parseFloat(preco),
      descricao || '',
      atracao_id || null,
      tipo_comissao || 'percentual',
      parseFloat(valor_comissao || 0)
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Produto criado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar produto (APENAS ADMIN)
app.put('/api/produtos/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { nome, preco, descricao, atracao_id, tipo_comissao, valor_comissao } = req.body;

    db.prepare(`
      UPDATE produtos SET 
        nome = ?, 
        preco = ?, 
        descricao = ?,
        atracao_id = ?,
        tipo_comissao = ?,
        valor_comissao = ?
      WHERE id = ?
    `).run(
      nome,
      parseFloat(preco),
      descricao || '',
      atracao_id || null,
      tipo_comissao || 'percentual',
      parseFloat(valor_comissao || 0),
      id
    );

    res.json({ message: 'Produto atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Desativar produto (APENAS ADMIN)
app.delete('/api/produtos/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE produtos SET ativo = 0 WHERE id = ?').run(id);
    res.json({ message: 'Produto desativado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTAS DE VENDAS =============

// Obter próximo código de venda (TODOS)
app.get('/api/vendas/proximo-codigo', authenticateToken, (req, res) => {
  try {
    const ultimaVenda = db.prepare('SELECT codigo_venda FROM vendas ORDER BY id DESC LIMIT 1').get();
    
    let proximoNumero = 1;
    if (ultimaVenda) {
      const numeroAtual = parseInt(ultimaVenda.codigo_venda);
      proximoNumero = numeroAtual + 1;
    }
    
    const proximoCodigo = proximoNumero.toString().padStart(4, '0');
    res.json({ codigo: proximoCodigo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar venda (TODOS)
app.post('/api/vendas', authenticateToken, async (req, res) => {
  try {
    const {
      nome_cliente,
      produto_id,
      quantidade_pessoas,
      desconto,
      tipo_desconto,
      venda_online,
      telefone_cliente
    } = req.body;

    if (!nome_cliente || !produto_id || !quantidade_pessoas) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(produto_id);
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const preco_unitario = produto.preco;
    const subtotal = preco_unitario * quantidade_pessoas;
    let valor_desconto = 0;

    if (desconto && parseFloat(desconto) > 0) {
      if (tipo_desconto === 'percentual') {
        valor_desconto = (subtotal * parseFloat(desconto)) / 100;
      } else {
        valor_desconto = parseFloat(desconto);
      }
    }

    const valor_total = subtotal - valor_desconto;

    const ultimaVenda = db.prepare('SELECT codigo_venda FROM vendas ORDER BY id DESC LIMIT 1').get();
    let proximoNumero = 1;
    if (ultimaVenda) {
      proximoNumero = parseInt(ultimaVenda.codigo_venda) + 1;
    }
    const codigo_venda = proximoNumero.toString().padStart(4, '0');

    const result = db.prepare(`
      INSERT INTO vendas (
        nome_cliente, produto_id, produto_nome, quantidade_pessoas,
        preco_unitario, subtotal, desconto, tipo_desconto, valor_total,
        operador_id, operador_nome, codigo_venda, venda_online, telefone_cliente
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nome_cliente,
      produto_id,
      produto.nome,
      quantidade_pessoas,
      preco_unitario,
      subtotal,
      valor_desconto,
      tipo_desconto || null,
      valor_total,
      req.user.id,
      req.user.nome,
      codigo_venda,
      venda_online ? 1 : 0,
      telefone_cliente || null
    );

    const vendaId = result.lastInsertRowid;
    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(vendaId);

    let whatsappStatus = { enviado: false, erro: null };
    if (telefone_cliente) {
      try {
        console.log('📱 Iniciando envio de WhatsApp...');
        const resultado = await gerarEEnviarIngresso(venda);
        whatsappStatus = {
          enviado: resultado.whatsapp.sucesso,
          erro: resultado.whatsapp.erro || null
        };
        console.log('WhatsApp status:', whatsappStatus);
      } catch (error) {
        console.error('Erro ao enviar WhatsApp:', error);
        whatsappStatus = { enviado: false, erro: error.message };
      }
    }

    res.status(201).json({
      id: vendaId,
      codigo_venda,
      message: 'Venda registrada com sucesso',
      whatsapp: whatsappStatus
    });
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar vendas (TODOS)
app.get('/api/vendas', authenticateToken, (req, res) => {
  try {
    const vendas = db.prepare(`
      SELECT * FROM vendas 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all();
    res.json(vendas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas de vendas por operador (TODOS)
app.get('/api/vendas/estatisticas', authenticateToken, (req, res) => {
  try {
    const { periodo } = req.query;
    
    let whereClause = '';
    
    switch(periodo) {
      case 'hoje':
        whereClause = `WHERE DATE(created_at) = DATE('now', 'localtime')`;
        break;
      case 'ontem':
        whereClause = `WHERE DATE(created_at) = DATE('now', '-1 day', 'localtime')`;
        break;
      case 'ultimos7dias':
        whereClause = `WHERE DATE(created_at) >= DATE('now', '-7 days', 'localtime')`;
        break;
      case 'estemes':
        whereClause = `WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')`;
        break;
      case 'total':
      default:
        whereClause = '';
    }
    
    const query = `
      SELECT 
        operador_id,
        operador_nome,
        COUNT(*) as total_vendas,
        SUM(valor_total) as valor_total,
        AVG(valor_total) as ticket_medio
      FROM vendas
      ${whereClause}
      GROUP BY operador_id, operador_nome
      ORDER BY valor_total DESC
    `;
    
    const estatisticas = db.prepare(query).all();
    
    const estatisticasComRanking = estatisticas.map((item, index) => ({
      ...item,
      ranking: index + 1
    }));
    
    res.json(estatisticasComRanking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar venda (APENAS ADMIN)
app.delete('/api/vendas/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM vendas WHERE id = ?').run(id);
    res.json({ message: 'Venda excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Baixar imagem do ingresso (TODOS)
app.get('/api/vendas/:id/imagem', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(id);

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    const { gerarImagemIngresso } = require('./whatsapp');
    const imagemBuffer = await gerarImagemIngresso(venda);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename=ingresso_${venda.codigo_venda}.jpg`);
    res.send(imagemBuffer);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reenviar WhatsApp (TODOS)
app.post('/api/vendas/:id/reenviar-whatsapp', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(id);

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    if (!venda.telefone_cliente) {
      return res.status(400).json({ error: 'Venda não possui telefone cadastrado' });
    }

    const resultado = await gerarEEnviarIngresso(venda);

    if (resultado.whatsapp.sucesso) {
      res.json({ message: 'Ingresso reenviado com sucesso!' });
    } else {
      res.status(400).json({ error: 'Falha no reenvio', detalhes: resultado.whatsapp.erro });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTA DE STATUS =============

app.get('/api/status', (req, res) => {
  res.json({ status: 'online', message: 'PDV Visite Campos API com Yampi' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   🎫 PDV VISITE CAMPOS - Backend      ║
  ║   + Integração Yampi 🛒               ║
  ║   Servidor rodando na porta ${PORT}      ║
  ╚════════════════════════════════════════╝
  `);
});