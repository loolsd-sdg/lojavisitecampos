require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const db = require('./database');
const { gerarEEnviarIngresso } = require('./whatsapp');

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

    // Criar uma venda fake para teste
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
    
    // Verificar se não está tentando deletar a si mesmo
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Você não pode deletar seu próprio usuário' });
    }

    // Verificar se o operador existe
    const operador = db.prepare('SELECT * FROM operadores WHERE id = ?').get(id);
    if (!operador) {
      return res.status(404).json({ error: 'Operador não encontrado' });
    }

    // Desativar o operador
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
    const produtos = db.prepare('SELECT * FROM produtos WHERE ativo = 1 ORDER BY nome').all();
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar produto (APENAS ADMIN)
app.post('/api/produtos', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { nome, preco, descricao } = req.body;

    if (!nome || !preco) {
      return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
    }

    const result = db.prepare('INSERT INTO produtos (nome, preco, descricao) VALUES (?, ?, ?)').run(
      nome,
      parseFloat(preco),
      descricao || ''
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
    const { nome, preco, descricao } = req.body;

    db.prepare('UPDATE produtos SET nome = ?, preco = ?, descricao = ? WHERE id = ?').run(
      nome,
      parseFloat(preco),
      descricao || '',
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

    // Buscar produto
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(produto_id);
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Calcular valores
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

    // Gerar código de venda
    const ultimaVenda = db.prepare('SELECT codigo_venda FROM vendas ORDER BY id DESC LIMIT 1').get();
    let proximoNumero = 1;
    if (ultimaVenda) {
      proximoNumero = parseInt(ultimaVenda.codigo_venda) + 1;
    }
    const codigo_venda = proximoNumero.toString().padStart(4, '0');

    // Inserir venda
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

    // Buscar venda completa
    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(vendaId);

    // Gerar e enviar ingresso via WhatsApp (assíncrono)
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
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
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
    
    // Adicionar ranking (posição)
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

// Gerar PDF do comprovante (TODOS) - mantido para compatibilidade
app.get('/api/vendas/:id/pdf', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(id);

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ingresso_${venda.codigo_venda}.pdf`);

    doc.pipe(res);

    // Cabeçalho
    doc.fontSize(24).fillColor('#2c3e50').text('VISITE CAMPOS', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor('#7f8c8d').text('COMPROVANTE DE VENDA', { align: 'center' });
    doc.moveDown(1);

    // Linha separadora
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#bdc3c7');
    doc.moveDown(1.5);

    // Código da venda (destaque)
    doc.fontSize(16).fillColor('#e74c3c').text(`Código: #${venda.codigo_venda}`, { align: 'center' });
    doc.moveDown(1.5);

    // Dados do cliente e produto
    doc.fontSize(12).fillColor('#2c3e50');
    
    doc.text(`Cliente: `, { continued: true }).fillColor('#34495e').text(venda.nome_cliente);
    doc.moveDown(0.8);
    
    doc.fillColor('#2c3e50').text(`Produto: `, { continued: true }).fillColor('#34495e').text(venda.produto_nome);
    doc.moveDown(0.8);
    
    doc.fillColor('#2c3e50').text(`Quantidade de Pessoas: `, { continued: true }).fillColor('#34495e').text(venda.quantidade_pessoas.toString());
    doc.moveDown(1.5);

    // Valores
    doc.fontSize(11).fillColor('#7f8c8d');
    doc.text(`Valor Unitário: R$ ${venda.preco_unitario.toFixed(2)}`);
    doc.moveDown(0.5);
    doc.text(`Subtotal: R$ ${venda.subtotal.toFixed(2)}`);
    doc.moveDown(0.5);

    if (venda.desconto > 0) {
      const textoDesconto = venda.tipo_desconto === 'percentual' 
        ? `Desconto: R$ ${venda.desconto.toFixed(2)}`
        : `Desconto: R$ ${venda.desconto.toFixed(2)}`;
      doc.fillColor('#e74c3c').text(textoDesconto);
      doc.moveDown(0.5);
    }

    doc.fontSize(14).fillColor('#27ae60').text(`TOTAL: R$ ${venda.valor_total.toFixed(2)}`, { align: 'left' });
    doc.moveDown(2);

    // Linha separadora
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#bdc3c7');
    doc.moveDown(1);

    // Rodapé
    doc.fontSize(10).fillColor('#95a5a6');
    const dataHora = new Date(venda.created_at).toLocaleString('pt-BR');
    doc.text(`Data/Hora: ${dataHora}`);
    doc.moveDown(0.5);
    doc.text(`Vendedor: ${venda.operador_nome}`);
    doc.moveDown(2);

    doc.fontSize(9).fillColor('#bdc3c7').text('Obrigado pela preferência!', { align: 'center' });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ROTA DE STATUS =============

app.get('/api/status', (req, res) => {
  res.json({ status: 'online', message: 'PDV Visite Campos API' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   🎫 PDV VISITE CAMPOS - Backend      ║
  ║   Servidor rodando na porta ${PORT}      ║
  ╚════════════════════════════════════════╝
  `);
});
