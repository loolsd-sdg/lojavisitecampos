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

// Middleware para verificar se é usuário de atração
const requireAtracao = (req, res, next) => {
  if (req.user.permissao !== 'atracao') {
    return res.status(403).json({ error: 'Acesso negado. Apenas usuários de atração.' });
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
        permissao: operador.permissao || 'usuario',
        atracao_id: operador.atracao_id || null
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
        permissao: operador.permissao || 'usuario',
        atracao_id: operador.atracao_id || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTAS PARA USUÁRIOS DE ATRAÇÃO =============

// GET /api/minha-atracao - Ver dados da própria atração
app.get('/api/minha-atracao', authenticateToken, requireAtracao, (req, res) => {
  try {
    const atracaoId = req.user.atracao_id;
    
    if (!atracaoId) {
      return res.status(400).json({ error: 'Usuário não vinculado a nenhuma atração' });
    }

    const atracao = db.prepare('SELECT * FROM atracoes WHERE id = ?').get(atracaoId);
    
    if (!atracao) {
      return res.status(404).json({ error: 'Atração não encontrada' });
    }

    res.json(atracao);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/minha-atracao/pedidos - Listar TODOS os pedidos (Yampi + PDV)
app.get('/api/minha-atracao/pedidos', authenticateToken, requireAtracao, (req, res) => {
  try {
    const atracaoId = req.user.atracao_id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (!atracaoId) {
      return res.status(400).json({ error: 'Usuário não vinculado a nenhuma atração' });
    }

    // ========== PEDIDOS YAMPI ==========
    const pedidosYampi = db.prepare(`
      SELECT DISTINCT
        p.id,
        p.numero_pedido,
        p.data_pedido,
        p.cliente_nome,
        p.valor_total,
        p.status_financeiro,
        COUNT(DISTINCT i.id) as total_itens,
        SUM(CASE WHEN i.presenca_confirmada = 1 THEN 1 ELSE 0 END) as itens_confirmados,
        SUM(i.quantidade) as total_produtos,
        SUM(i.valor_total) as valor_total_itens,
        'yampi' as origem
      FROM pedidos_yampi p
      INNER JOIN itens_pedido_yampi i ON i.pedido_yampi_id = p.id
      WHERE i.atracao_id = ? AND i.classificado = 1
      GROUP BY p.id
    `).all(atracaoId);

    // ========== VENDAS PDV ==========
    const vendasPDV = db.prepare(`
      SELECT 
        v.id,
        v.codigo_venda as numero_pedido,
        v.created_at as data_pedido,
        v.nome_cliente as cliente_nome,
        v.valor_total,
        'pago' as status_financeiro,
        1 as total_itens,
        v.presenca_confirmada as itens_confirmados,
        v.quantidade_pessoas as total_produtos,
        v.valor_total as valor_total_itens,
        'pdv' as origem
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE p.atracao_id = ?
    `).all(atracaoId);

    // ========== UNIFICAR E ORDENAR ==========
    const todosPedidos = [...pedidosYampi, ...vendasPDV];
    todosPedidos.sort((a, b) => new Date(b.data_pedido) - new Date(a.data_pedido));

    // ========== PAGINAÇÃO ==========
    const totalPedidos = todosPedidos.length;
    const pedidosPaginados = todosPedidos.slice(offset, offset + limit);

    res.json({
      pedidos: pedidosPaginados,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPedidos,
        totalPages: Math.ceil(totalPedidos / limit)
      },
      resumo: {
        totalYampi: pedidosYampi.length,
        totalPDV: vendasPDV.length
      }
    });
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/minha-atracao/relatorio - Relatório UNIFICADO (Yampi + PDV)
app.get('/api/minha-atracao/relatorio', authenticateToken, requireAtracao, (req, res) => {
  try {
    const atracaoId = req.user.atracao_id;
    const { dataInicio, dataFim } = req.query;

    if (!atracaoId) {
      return res.status(400).json({ error: 'Usuário não vinculado a nenhuma atração' });
    }

    const atracao = db.prepare('SELECT * FROM atracoes WHERE id = ?').get(atracaoId);
    
    if (!atracao) {
      return res.status(404).json({ error: 'Atração não encontrada' });
    }

    // ========== BUSCAR PEDIDOS YAMPI ==========
    let queryYampi = `
      SELECT 
        i.id,
        i.quantidade,
        i.valor_total,
        p.data_pedido as data,
        p.numero_pedido as numero,
        p.cliente_nome,
        prod.nome as produto_nome,
        prod.tipo_comissao,
        prod.valor_comissao,
        'yampi' as origem
      FROM itens_pedido_yampi i
      LEFT JOIN pedidos_yampi p ON i.pedido_yampi_id = p.id
      LEFT JOIN produtos prod ON i.produto_id = prod.id
      WHERE i.atracao_id = ? AND i.classificado = 1
    `;

    const paramsYampi = [atracaoId];

    if (dataInicio && dataFim) {
      queryYampi += ` AND DATE(p.data_pedido) BETWEEN ? AND ?`;
      paramsYampi.push(dataInicio, dataFim);
    } else if (dataInicio) {
      queryYampi += ` AND DATE(p.data_pedido) >= ?`;
      paramsYampi.push(dataInicio);
    }

    const itensYampi = db.prepare(queryYampi).all(...paramsYampi);

    // ========== BUSCAR VENDAS PDV ==========
    let queryPDV = `
      SELECT 
        v.id,
        v.quantidade_pessoas as quantidade,
        v.valor_total,
        v.created_at as data,
        v.codigo_venda as numero,
        v.nome_cliente as cliente_nome,
        v.produto_nome,
        p.tipo_comissao,
        p.valor_comissao,
        'pdv' as origem
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE p.atracao_id = ?
    `;

    const paramsPDV = [atracaoId];

    if (dataInicio && dataFim) {
      queryPDV += ` AND DATE(v.created_at) BETWEEN ? AND ?`;
      paramsPDV.push(dataInicio, dataFim);
    } else if (dataInicio) {
      queryPDV += ` AND DATE(v.created_at) >= ?`;
      paramsPDV.push(dataInicio);
    }

    const itensPDV = db.prepare(queryPDV).all(...paramsPDV);

    // ========== UNIFICAR DADOS ==========
    const todosItens = [...itensYampi, ...itensPDV];

    // ========== CALCULAR TOTAIS ==========
    let faturamentoTotal = 0;
    let comissaoTotal = 0;

    const itensComCalculo = todosItens.map(item => {
      const faturamento = parseFloat(item.valor_total || 0);
      let comissao = 0;

      if (item.tipo_comissao === 'percentual') {
        comissao = (faturamento * parseFloat(item.valor_comissao || 0)) / 100;
      } else if (item.tipo_comissao === 'fixo') {
        comissao = parseFloat(item.valor_comissao || 0) * parseInt(item.quantidade || 1);
      }

      const liquido = faturamento - comissao;

      faturamentoTotal += faturamento;
      comissaoTotal += comissao;

      return {
        id: item.id,
        data_pedido: item.data,
        numero_pedido: item.numero,
        cliente_nome: item.cliente_nome,
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        origem: item.origem,
        faturamento,
        comissao,
        liquido,
        tipo_comissao: item.tipo_comissao,
        valor_comissao: item.valor_comissao
      };
    });

    // Ordenar por data
    itensComCalculo.sort((a, b) => new Date(b.data_pedido) - new Date(a.data_pedido));

    const liquidoTotal = faturamentoTotal - comissaoTotal;

    res.json({
      atracao,
      resumo: {
        faturamentoTotal,
        comissaoTotal,
        liquidoTotal,
        totalItens: itensComCalculo.length,
        itensYampi: itensYampi.length,
        itensPDV: itensPDV.length
      },
      itens: itensComCalculo,
      periodo: {
        dataInicio: dataInicio || null,
        dataFim: dataFim || null
      }
    });
  } catch (error) {
    console.error('Erro no relatório:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar pedidos da atração (Yampi + PDV)
app.get('/api/atracao/pedidos', authenticateToken, requireAtracao, (req, res) => {
  try {
    const atracaoId = req.user.atracao_id;
    const { status } = req.query;

    if (!atracaoId) {
      return res.status(400).json({ error: 'Usuário não vinculado a nenhuma atração' });
    }

    // ========== PEDIDOS YAMPI ==========
    let queryYampi = `
      SELECT DISTINCT
        p.id as pedido_id,
        p.numero_pedido,
        p.data_pedido,
        p.cliente_nome,
        p.cliente_email,
        p.cliente_telefone,
        p.valor_total,
        p.status_financeiro,
        p.status_pedido,
        COUNT(DISTINCT i.id) as total_itens,
        SUM(CASE WHEN i.presenca_confirmada = 1 THEN 1 ELSE 0 END) as itens_confirmados,
        SUM(i.quantidade) as total_produtos,
        SUM(i.valor_total) as valor_total_itens,
        'yampi' as origem
      FROM pedidos_yampi p
      INNER JOIN itens_pedido_yampi i ON i.pedido_yampi_id = p.id
      WHERE i.atracao_id = ? AND i.classificado = 1
    `;

    const paramsYampi = [atracaoId];

    if (status && status !== 'todos') {
      queryYampi += ` AND p.status_financeiro = ?`;
      paramsYampi.push(status);
    }

    queryYampi += ` GROUP BY p.id`;

    const pedidosYampi = db.prepare(queryYampi).all(...paramsYampi);

    // ========== VENDAS PDV ==========
    const vendasPDV = db.prepare(`
      SELECT 
        v.id as pedido_id,
        v.codigo_venda as numero_pedido,
        v.created_at as data_pedido,
        v.nome_cliente as cliente_nome,
        '' as cliente_email,
        v.telefone_cliente as cliente_telefone,
        v.valor_total,
        'pago' as status_financeiro,
        'pago' as status_pedido,
        1 as total_itens,
        0 as itens_confirmados,
        v.quantidade_pessoas as total_produtos,
        v.valor_total as valor_total_itens,
        'pdv' as origem
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE p.atracao_id = ?
    `).all(atracaoId);

    // ========== UNIFICAR E ORDENAR ==========
    const todosPedidos = [...pedidosYampi, ...vendasPDV];
    todosPedidos.sort((a, b) => new Date(b.data_pedido) - new Date(a.data_pedido));

    res.json({
      pedidos: todosPedidos,
      resumo: {
        totalYampi: pedidosYampi.length,
        totalPDV: vendasPDV.length,
        total: todosPedidos.length
      }
    });
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detalhes de um pedido específico da atração
app.get('/api/atracao/pedidos/:id', authenticateToken, requireAtracao, (req, res) => {
  try {
    const { id } = req.params;
    const { atracao_id } = req.user;

    const pedido = db.prepare('SELECT * FROM pedidos_yampi WHERE id = ?').get(id);
    
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    // Buscar apenas os itens da atração do usuário
    const itens = db.prepare(`
      SELECT i.*, 
             p.nome as produto_interno_nome,
             o.nome as confirmado_por_nome
      FROM itens_pedido_yampi i
      LEFT JOIN produtos p ON i.produto_id = p.id
      LEFT JOIN operadores o ON i.confirmado_por = o.id
      WHERE i.pedido_yampi_id = ? AND i.atracao_id = ?
    `).all(id, atracao_id);

    if (itens.length === 0) {
      return res.status(403).json({ error: 'Pedido não pertence a esta atração' });
    }

    res.json({ pedido, itens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirmar presença de um item
app.post('/api/atracao/confirmar-presenca/:itemId', authenticateToken, requireAtracao, (req, res) => {
  try {
    const { itemId } = req.params;
    const { atracao_id, id: operador_id } = req.user;

    // Verificar se o item pertence à atração do usuário
    const item = db.prepare(`
      SELECT * FROM itens_pedido_yampi 
      WHERE id = ? AND atracao_id = ? AND classificado = 1
    `).get(itemId, atracao_id);

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado ou não pertence a esta atração' });
    }

    if (item.presenca_confirmada === 1) {
      return res.status(400).json({ error: 'Presença já foi confirmada para este item' });
    }

    // Confirmar presença
    db.prepare(`
      UPDATE itens_pedido_yampi SET
        presenca_confirmada = 1,
        data_confirmacao_presenca = CURRENT_TIMESTAMP,
        confirmado_por = ?
      WHERE id = ?
    `).run(operador_id, itemId);

    res.json({ message: 'Presença confirmada com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirmar TODOS os itens de um pedido
app.post('/api/minha-atracao/confirmar-todos/:pedidoId', authenticateToken, requireAtracao, (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { origem } = req.body;
    const { atracao_id, id: operador_id } = req.user;

    if (origem === 'yampi') {
      // Buscar todos os itens do pedido
      const itens = db.prepare(`
        SELECT id FROM itens_pedido_yampi 
        WHERE pedido_yampi_id = ? AND atracao_id = ? AND classificado = 1
      `).all(pedidoId, atracao_id);

      if (itens.length === 0) {
        return res.status(404).json({ error: 'Nenhum item encontrado para este pedido' });
      }

      // Confirmar todos os itens
      const stmt = db.prepare(`
        UPDATE itens_pedido_yampi SET
          presenca_confirmada = 1,
          data_confirmacao_presenca = CURRENT_TIMESTAMP,
          confirmado_por = ?
        WHERE id = ?
      `);

      for (const item of itens) {
        stmt.run(operador_id, item.id);
      }

      res.json({ message: `${itens.length} itens confirmados com sucesso!` });
    } else if (origem === 'pdv') {
      // PDV - confirmar a venda inteira
      const venda = db.prepare(`
        SELECT v.id FROM vendas v
        LEFT JOIN produtos p ON v.produto_id = p.id
        WHERE v.id = ? AND p.atracao_id = ?
      `).get(pedidoId, atracao_id);

      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      // Confirmar venda
      db.prepare(`
        UPDATE vendas SET
          presenca_confirmada = 1,
          data_confirmacao_presenca = CURRENT_TIMESTAMP,
          confirmado_por = ?
        WHERE id = ?
      `).run(operador_id, pedidoId);

      res.json({ message: 'Presença confirmada com sucesso!' });
    } else {
      res.status(400).json({ error: 'Origem inválida' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Desconfirmar TODOS os itens de um pedido
app.post('/api/minha-atracao/desconfirmar-todos/:pedidoId', authenticateToken, requireAtracao, (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { origem } = req.body;
    const { atracao_id } = req.user;

    if (origem === 'yampi') {
      // Buscar todos os itens do pedido
      const itens = db.prepare(`
        SELECT id FROM itens_pedido_yampi 
        WHERE pedido_yampi_id = ? AND atracao_id = ?
      `).all(pedidoId, atracao_id);

      if (itens.length === 0) {
        return res.status(404).json({ error: 'Nenhum item encontrado para este pedido' });
      }

      // Desconfirmar todos os itens
      const stmt = db.prepare(`
        UPDATE itens_pedido_yampi SET
          presenca_confirmada = 0,
          data_confirmacao_presenca = NULL,
          confirmado_por = NULL
        WHERE id = ?
      `);

      for (const item of itens) {
        stmt.run(item.id);
      }

      res.json({ message: `Confirmações canceladas para ${itens.length} itens` });
    } else if (origem === 'pdv') {
      // PDV - desconfirmar a venda inteira
      const venda = db.prepare(`
        SELECT v.id FROM vendas v
        LEFT JOIN produtos p ON v.produto_id = p.id
        WHERE v.id = ? AND p.atracao_id = ?
      `).get(pedidoId, atracao_id);

      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      // Desconfirmar venda
      db.prepare(`
        UPDATE vendas SET
          presenca_confirmada = 0,
          data_confirmacao_presenca = NULL,
          confirmado_por = NULL
        WHERE id = ?
      `).run(pedidoId);

      res.json({ message: 'Confirmação cancelada' });
    } else {
      res.status(400).json({ error: 'Origem inválida' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelar confirmação de presença
app.post('/api/atracao/cancelar-presenca/:itemId', authenticateToken, requireAtracao, (req, res) => {
  try {
    const { itemId } = req.params;
    const { atracao_id } = req.user;

    // Verificar se o item pertence à atração do usuário
    const item = db.prepare(`
      SELECT * FROM itens_pedido_yampi 
      WHERE id = ? AND atracao_id = ?
    `).get(itemId, atracao_id);

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado ou não pertence a esta atração' });
    }

    // Cancelar confirmação
    db.prepare(`
      UPDATE itens_pedido_yampi SET
        presenca_confirmada = 0,
        data_confirmacao_presenca = NULL,
        confirmado_por = NULL
      WHERE id = ?
    `).run(itemId);

    res.json({ message: 'Confirmação de presença cancelada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Relatório financeiro da atração (antigo - mantido para compatibilidade)
app.get('/api/atracao/relatorio-financeiro', authenticateToken, requireAtracao, (req, res) => {
  try {
    const { atracao_id } = req.user;
    const { dataInicio, dataFim } = req.query;

    // Buscar informações da atração
    const atracao = db.prepare('SELECT * FROM atracoes WHERE id = ?').get(atracao_id);

    let query = `
      SELECT 
        i.id,
        i.produto_yampi_nome,
        i.quantidade,
        i.valor_total,
        i.presenca_confirmada,
        i.data_confirmacao_presenca,
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

    const params = [atracao_id];

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
    let presencasConfirmadas = 0;
    let totalPessoas = 0;

    itens.forEach(item => {
      faturamentoTotal += item.valor_total;
      totalPessoas += item.quantidade;

      if (item.presenca_confirmada) {
        presencasConfirmadas += item.quantidade;
      }

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
        totalItens: itens.length,
        totalPessoas,
        presencasConfirmadas,
        taxaConfirmacao: totalPessoas > 0 ? (presencasConfirmadas / totalPessoas * 100).toFixed(1) : 0
      },
      itens
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard da atração (estatísticas rápidas)
app.get('/api/atracao/dashboard', authenticateToken, requireAtracao, (req, res) => {
  try {
    const { atracao_id } = req.user;

    const hoje = new Date().toISOString().split('T')[0];

    // ========== PEDIDOS YAMPI ==========
    const pedidosYampi = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM pedidos_yampi p
      INNER JOIN itens_pedido_yampi i ON p.id = i.pedido_yampi_id
      WHERE i.atracao_id = ? AND i.classificado = 1
    `).get(atracao_id).count;

    const pedidosYampiHoje = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM pedidos_yampi p
      INNER JOIN itens_pedido_yampi i ON p.id = i.pedido_yampi_id
      WHERE i.atracao_id = ? AND i.classificado = 1
      AND DATE(p.data_pedido) = DATE(?)
    `).get(atracao_id, hoje).count;

    const pessoasYampi = db.prepare(`
      SELECT SUM(i.quantidade) as total
      FROM itens_pedido_yampi i
      WHERE i.atracao_id = ? AND i.classificado = 1
    `).get(atracao_id).total || 0;

    const pessoasYampiConfirmadas = db.prepare(`
      SELECT SUM(i.quantidade) as total
      FROM itens_pedido_yampi i
      WHERE i.atracao_id = ? 
      AND i.presenca_confirmada = 1
    `).get(atracao_id).total || 0;

    const presencasYampiHoje = db.prepare(`
      SELECT SUM(i.quantidade) as total
      FROM itens_pedido_yampi i
      INNER JOIN pedidos_yampi p ON i.pedido_yampi_id = p.id
      WHERE i.atracao_id = ? 
      AND i.presenca_confirmada = 1
      AND DATE(i.data_confirmacao_presenca) = DATE(?)
    `).get(atracao_id, hoje).total || 0;

    const pendenteYampi = db.prepare(`
      SELECT COUNT(*) as count
      FROM itens_pedido_yampi i
      WHERE i.atracao_id = ? 
      AND i.classificado = 1
      AND i.presenca_confirmada = 0
    `).get(atracao_id).count;

    // ========== VENDAS PDV ==========
    const vendasPDV = db.prepare(`
      SELECT COUNT(*) as count
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE p.atracao_id = ?
    `).get(atracao_id).count;

    const vendasPDVHoje = db.prepare(`
      SELECT COUNT(*) as count
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE p.atracao_id = ?
      AND DATE(v.created_at) = DATE(?)
    `).get(atracao_id, hoje).count;

    const pessoasPDV = db.prepare(`
      SELECT SUM(v.quantidade_pessoas) as total
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE p.atracao_id = ?
    `).get(atracao_id).total || 0;

    // ========== UNIFICAR ESTATÍSTICAS ==========
    const stats = {
      total_pedidos: pedidosYampi + vendasPDV,
      pedidos_hoje: pedidosYampiHoje + vendasPDVHoje,
      presencas_hoje: presencasYampiHoje,
      pendentes_confirmacao: pendenteYampi,
      total_pessoas: pessoasYampi + pessoasPDV,
      pessoas_confirmadas: pessoasYampiConfirmadas
    };

    res.json(stats);
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
    const { nome, descricao, responsavel, telefone, email, criar_usuario, username, password } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const result = db.prepare(`
      INSERT INTO atracoes (nome, descricao, responsavel, telefone, email)
      VALUES (?, ?, ?, ?, ?)
    `).run(nome, descricao || '', responsavel || '', telefone || '', email || '');

    const atracaoId = result.lastInsertRowid;

    // Se solicitado, criar usuário para a atração
    if (criar_usuario && username && password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      
      try {
        db.prepare(`
          INSERT INTO operadores (nome, username, password, permissao, atracao_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          `Usuário ${nome}`,
          username,
          hashedPassword,
          'atracao',
          atracaoId
        );
      } catch (error) {
        // Se falhar ao criar usuário, deletar a atração criada
        db.prepare('DELETE FROM atracoes WHERE id = ?').run(atracaoId);
        throw new Error('Erro ao criar usuário: ' + error.message);
      }
    }

    res.status(201).json({ 
      id: atracaoId, 
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

// Relatório financeiro de uma atração (ADMIN)
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
        i.presenca_confirmada,
        i.data_confirmacao_presenca,
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
    let presencasConfirmadas = 0;
    let totalPessoas = 0;

    itens.forEach(item => {
      faturamentoTotal += item.valor_total;
      totalPessoas += item.quantidade;

      if (item.presenca_confirmada) {
        presencasConfirmadas += item.quantidade;
      }

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
        totalItens: itens.length,
        totalPessoas,
        presencasConfirmadas,
        taxaConfirmacao: totalPessoas > 0 ? (presencasConfirmadas / totalPessoas * 100).toFixed(1) : 0
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
    
    console.log('📋 Classificando item:', { id, produto_id, atracao_id });

    if (!produto_id || !atracao_id) {
      return res.status(400).json({ error: 'produto_id e atracao_id são obrigatórios' });
    }

    // Buscar o nome do produto deste item
    const item = db.prepare(`
      SELECT produto_yampi_nome
      FROM itens_pedido_yampi 
      WHERE id = ?
    `).get(id);

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    // Classificar o item selecionado
    db.prepare(`
      UPDATE itens_pedido_yampi SET
        produto_id = ?,
        atracao_id = ?,
        classificado = 1,
        data_classificacao = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(produto_id, atracao_id, id);

    // CLASSIFICAÇÃO EM CASCATA: Classificar automaticamente todos os outros itens
    // com o mesmo nome de produto que ainda não foram classificados
    let classificadosAutomaticamente = 0;
    
    if (item.produto_yampi_nome) {
      const result = db.prepare(`
        UPDATE itens_pedido_yampi SET
          produto_id = ?,
          atracao_id = ?,
          classificado = 1,
          data_classificacao = CURRENT_TIMESTAMP
        WHERE produto_yampi_nome = ? 
          AND classificado = 0
          AND id != ?
      `).run(produto_id, atracao_id, item.produto_yampi_nome, id);
      
      classificadosAutomaticamente = result.changes;
    }

    console.log(`✅ Item classificado! ${classificadosAutomaticamente} itens adicionais classificados automaticamente`);
    
    res.json({ 
      message: 'Item classificado com sucesso',
      classificadosAutomaticamente,
      mensagemCompleta: classificadosAutomaticamente > 0 
        ? `Item classificado! ${classificadosAutomaticamente} outros itens com o mesmo produto foram classificados automaticamente.`
        : 'Item classificado com sucesso!'
    });
  } catch (error) {
    console.error('❌ Erro ao classificar item:', error);
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
    const operadores = db.prepare(`
      SELECT o.id, o.nome, o.username, o.permissao, o.atracao_id, o.ativo, o.created_at,
             a.nome as atracao_nome
      FROM operadores o
      LEFT JOIN atracoes a ON o.atracao_id = a.id
      ORDER BY o.nome
    `).all();
    res.json(operadores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar operador (APENAS ADMIN)
app.post('/api/operadores', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { nome, username, password, permissao, atracao_id } = req.body;

    if (!nome || !username || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Se for usuário de atração, atracao_id é obrigatório
    if (permissao === 'atracao' && !atracao_id) {
      return res.status(400).json({ error: 'Atração é obrigatória para usuários de atração' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO operadores (nome, username, password, permissao, atracao_id) 
      VALUES (?, ?, ?, ?, ?)
    `).run(
      nome,
      username,
      hashedPassword,
      permissao || 'usuario',
      atracao_id || null
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
  res.json({ status: 'online', message: 'PDV Visite Campos API com Yampi + Painel de Atrações' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   🎫 PDV VISITE CAMPOS - Backend      ║
  ║   + Integração Yampi 🛒               ║
  ║   + Painel de Atrações 🏛️             ║
  ║   Servidor rodando na porta ${PORT}      ║
  ╚════════════════════════════════════════╝
  `);
});