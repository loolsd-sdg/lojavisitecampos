const axios = require('axios');
const db = require('./database');

const YAMPI_BASE_URL = 'https://api.dooki.com.br/v2';

// Cache das colunas disponíveis
let _colunasCache = null;
let _colunasItensCache = null;

// ============= CONFIGURAÇÃO =============

function getConfig(chave) {
  const config = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave);
  return config ? config.valor : null;
}

function getYampiClient() {
  const alias = getConfig('yampi_alias');
  const token = getConfig('yampi_token');
  const secret = getConfig('yampi_secret');

  if (!alias || !token || !secret) {
    throw new Error('Configurações da Yampi incompletas. Configure em Configurações > Yampi');
  }

  return axios.create({
    baseURL: `${YAMPI_BASE_URL}/${alias}`,
    headers: {
      'Content-Type': 'application/json',
      'User-Token': token,
      'User-Secret-Key': secret
    },
    timeout: 30000
  });
}

// ============= CLASSIFICAÇÃO AUTOMÁTICA =============

function classificarItemAutomaticamente(produtoNome) {
  if (!produtoNome) return null;
  
  const nomeNormalizado = produtoNome.toLowerCase();
  
  // Buscar produtos do sistema
  const produtos = db.prepare('SELECT id, nome, atracao_id FROM produtos WHERE ativo = 1').all();
  
  // Tentar encontrar produto correspondente
  const produtoEncontrado = produtos.find(p => {
    const nomeProduto = p.nome.toLowerCase();
    
    // Verificar Dreamhouse
    if (nomeNormalizado.includes('dream') && nomeProduto.includes('dream')) {
      return true;
    }
    
    // Verificar Animais Incríveis
    if (nomeNormalizado.includes('animais') && nomeProduto.includes('animais')) {
      // Se tem "infantil" no nome, deve ser o produto infantil
      if (nomeNormalizado.includes('infantil') || nomeNormalizado.includes('criança')) {
        return nomeProduto.includes('infantil');
      }
      // Se não tem "infantil", deve ser o adulto
      return !nomeProduto.includes('infantil');
    }
    
    return false;
  });
  
  if (produtoEncontrado) {
    return {
      produto_id: produtoEncontrado.id,
      atracao_id: produtoEncontrado.atracao_id
    };
  }
  
  return null;
}

// ============= DETECÇÃO AUTOMÁTICA DE COLUNAS =============

function getColunasDisponiveis() {
  if (_colunasCache) {
    return _colunasCache;
  }

  try {
    const colunas = db.prepare('PRAGMA table_info(pedidos_yampi)').all();
    _colunasCache = new Set(colunas.map(c => c.name));
    console.log(`✅ Detectadas ${_colunasCache.size} colunas na tabela pedidos_yampi`);
    return _colunasCache;
  } catch (error) {
    console.error('Erro ao detectar colunas:', error.message);
    return new Set(['id', 'yampi_order_id', 'numero_pedido', 'cliente_nome', 'cliente_email', 
                    'status_financeiro', 'status_entrega', 'valor_total', 'data_pedido', 
                    'json_completo', 'processado', 'data_sincronizacao']);
  }
}

function getColunasItensDisponiveis() {
  if (_colunasItensCache) {
    return _colunasItensCache;
  }

  try {
    const colunas = db.prepare('PRAGMA table_info(itens_pedido_yampi)').all();
    _colunasItensCache = new Set(colunas.map(c => c.name));
    return _colunasItensCache;
  } catch (error) {
    console.error('Erro ao detectar colunas de itens:', error.message);
    return new Set(['id', 'pedido_yampi_id', 'yampi_item_id', 'produto_yampi_nome', 'sku',
                    'quantidade', 'preco_unitario', 'valor_total']);
  }
}

// ============= VALIDAÇÃO DE TIPOS =============

function validarValor(valor) {
  // Valores válidos para better-sqlite3: number, string, bigint, Buffer, null
  if (valor === undefined || valor === null) return null;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'bigint') return valor;
  if (Buffer.isBuffer(valor)) return valor;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  
  // Se for objeto ou array, converter para JSON string
  if (typeof valor === 'object') {
    try {
      return JSON.stringify(valor);
    } catch (e) {
      console.warn('Erro ao converter objeto para JSON:', e.message);
      return null;
    }
  }
  
  // Qualquer outro tipo, converter para string
  return String(valor);
}

function montarInsertPedido(dados) {
  const colunasDisponiveis = getColunasDisponiveis();
  
  const mapeamento = {
    yampi_order_id: dados.yampi_order_id,
    numero_pedido: dados.numero_pedido,
    cliente_nome: dados.cliente_nome,
    cliente_email: dados.cliente_email,
    cliente_cpf: dados.cliente_cpf,
    cliente_telefone: dados.cliente_telefone,
    status_financeiro: dados.status_financeiro,
    status_entrega: dados.status_entrega,
    status_pedido: dados.status_pedido,
    status_pedido_id: dados.status_pedido_id,
    metodo_pagamento: dados.metodo_pagamento,
    valor_total: dados.valor_total,
    valor_produtos: dados.valor_produtos,
    valor_desconto: dados.valor_desconto,
    valor_frete: dados.valor_frete,
    data_pedido: dados.data_pedido,
    data_atualizacao: dados.data_atualizacao,
    endereco_rua: dados.endereco_rua,
    endereco_numero: dados.endereco_numero,
    endereco_complemento: dados.endereco_complemento,
    endereco_bairro: dados.endereco_bairro,
    endereco_cidade: dados.endereco_cidade,
    endereco_estado: dados.endereco_estado,
    endereco_cep: dados.endereco_cep,
    json_completo: dados.json_completo,
    processado: dados.processado
  };

  const colunas = [];
  const valores = [];
  const placeholders = [];

  Object.keys(mapeamento).forEach(coluna => {
    if (colunasDisponiveis.has(coluna)) {
      colunas.push(coluna);
      valores.push(validarValor(mapeamento[coluna]));
      placeholders.push('?');
    }
  });

  const sql = `INSERT INTO pedidos_yampi (${colunas.join(', ')}) VALUES (${placeholders.join(', ')})`;
  
  return { sql, valores };
}

function montarUpdatePedido(dados) {
  const colunasDisponiveis = getColunasDisponiveis();
  
  const mapeamento = {
    numero_pedido: dados.numero_pedido,
    cliente_nome: dados.cliente_nome,
    cliente_email: dados.cliente_email,
    cliente_cpf: dados.cliente_cpf,
    cliente_telefone: dados.cliente_telefone,
    status_financeiro: dados.status_financeiro,
    status_entrega: dados.status_entrega,
    status_pedido: dados.status_pedido,
    status_pedido_id: dados.status_pedido_id,
    metodo_pagamento: dados.metodo_pagamento,
    valor_total: dados.valor_total,
    valor_produtos: dados.valor_produtos,
    valor_desconto: dados.valor_desconto,
    valor_frete: dados.valor_frete,
    data_pedido: dados.data_pedido,
    data_atualizacao: dados.data_atualizacao,
    endereco_rua: dados.endereco_rua,
    endereco_numero: dados.endereco_numero,
    endereco_complemento: dados.endereco_complemento,
    endereco_bairro: dados.endereco_bairro,
    endereco_cidade: dados.endereco_cidade,
    endereco_estado: dados.endereco_estado,
    endereco_cep: dados.endereco_cep,
    json_completo: dados.json_completo
  };

  const sets = [];
  const valores = [];

  Object.keys(mapeamento).forEach(coluna => {
    if (colunasDisponiveis.has(coluna)) {
      sets.push(`${coluna} = ?`);
      valores.push(validarValor(mapeamento[coluna]));
    }
  });

  if (colunasDisponiveis.has('data_sincronizacao')) {
    sets.push('data_sincronizacao = CURRENT_TIMESTAMP');
  }

  const sql = `UPDATE pedidos_yampi SET ${sets.join(', ')} WHERE yampi_order_id = ?`;
  valores.push(validarValor(dados.yampi_order_id));

  return { sql, valores };
}

// ============= PEDIDOS =============

async function buscarPedidos(params = {}) {
  try {
    const client = getYampiClient();

    const queryParams = {
      page: params.page || 1,
      limit: params.limit || 50,
      include: 'customer,status,items,transactions,shipping_address',
      ...params
    };

    const response = await client.get('/orders', { params: queryParams });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar pedidos Yampi:', error.message);
    if (error.response) {
      console.error('Resposta da API:', error.response.data);
    }
    throw error;
  }
}

async function buscarPedido(orderId) {
  try {
    const client = getYampiClient();
    const response = await client.get(`/orders/${orderId}`, {
      params: { 
        include: 'customer,status,items,transactions,shipping_address' 
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Erro ao buscar pedido ${orderId}:`, error.message);
    throw error;
  }
}

async function buscarStatusDisponiveis() {
  try {
    const client = getYampiClient();
    const response = await client.get('/checkout/statuses');
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar status:', error.message);
    throw error;
  }
}

async function sincronizarPedidos(options = {}) {
  try {
    console.log('🔄 Iniciando sincronização de pedidos Yampi...');

    let novos = 0;
    let atualizados = 0;
    let erros = 0;
    let paginaAtual = 1;
    let totalPaginas = 1;

    // Loop para buscar TODAS as páginas
    do {
      const params = {
        page: paginaAtual,
        limit: 100, // Máximo por página
        ...options.filters
      };

      if (options.statusIds && Array.isArray(options.statusIds)) {
        options.statusIds.forEach((id, index) => {
          params[`status_id[${index}]`] = id;
        });
      }

      if (options.dateFrom && options.dateTo) {
        params.date = `created_at:${options.dateFrom}|${options.dateTo}`;
      } else if (options.dateFrom) {
        params.date = `created_at:${options.dateFrom}`;
      }

      console.log(`📖 Buscando página ${paginaAtual}...`);
      const resultado = await buscarPedidos(params);
      const pedidos = resultado.data || [];

      totalPaginas = resultado.meta?.pagination?.total_pages || 1;

      for (const pedido of pedidos) {
        try {
          const existe = db.prepare('SELECT id FROM pedidos_yampi WHERE yampi_order_id = ?')
            .get(pedido.id);

          await salvarPedido(pedido);

          if (existe) {
            atualizados++;
          } else {
            novos++;
          }
        } catch (error) {
          console.error(`Erro ao salvar pedido ${pedido.number}:`, error.message);
          erros++;
        }
      }

      paginaAtual++;
    } while (paginaAtual <= totalPaginas);

    const total = novos + atualizados;
    console.log(`✅ Sincronização concluída: ${total} pedidos (${novos} novos, ${atualizados} atualizados, ${erros} erros) de ${totalPaginas} páginas`);

    return {
      sucesso: true,
      total,
      novos,
      atualizados,
      erros,
      totalPaginas,
      paginaAtual: totalPaginas
    };

  } catch (error) {
    console.error('❌ Erro na sincronização:', error.message);
    return {
      sucesso: false,
      erro: error.message
    };
  }
}

async function salvarPedido(pedido) {
  const existe = db.prepare('SELECT id FROM pedidos_yampi WHERE yampi_order_id = ?')
    .get(pedido.id);

  const dadosPedido = {
    yampi_order_id: pedido.id,
    numero_pedido: String(pedido.number),
    cliente_nome: pedido.customer?.data?.name || '',
    cliente_email: pedido.customer?.data?.email || '',
    cliente_cpf: pedido.customer?.data?.cpf || '',
    cliente_telefone: pedido.customer?.data?.phone || '',
    status_pedido: pedido.status?.data?.name || 'pending',
    status_pedido_id: pedido.status?.data?.id || null,
    status_financeiro: pedido.transactions?.data?.[0]?.status_name || pedido.status?.data?.name || 'pending',
    status_entrega: 'pending',
    metodo_pagamento: pedido.payment_method || 'unknown',
    valor_total: parseFloat(pedido.value_total || 0),
    valor_produtos: parseFloat(pedido.value_products || 0),
    valor_desconto: parseFloat(pedido.value_discount || 0),
    valor_frete: parseFloat(pedido.value_shipment || 0),
    data_pedido: (typeof pedido.created_at === 'object' && pedido.created_at?.date) ? pedido.created_at.date : (pedido.created_at || new Date().toISOString()),
    data_atualizacao: (typeof pedido.updated_at === 'object' && pedido.updated_at?.date) ? pedido.updated_at.date : (pedido.updated_at || new Date().toISOString()),
    endereco_rua: pedido.shipping_address?.data?.street || '',
    endereco_numero: pedido.shipping_address?.data?.number || '',
    endereco_complemento: pedido.shipping_address?.data?.complement || '',
    endereco_bairro: pedido.shipping_address?.data?.neighborhood || '',
    endereco_cidade: pedido.shipping_address?.data?.city || '',
    endereco_estado: pedido.shipping_address?.data?.state || '',
    endereco_cep: pedido.shipping_address?.data?.zipcode || '',
    json_completo: JSON.stringify(pedido),
    processado: 0
  };

  if (existe) {
    const { sql, valores } = montarUpdatePedido(dadosPedido);
    db.prepare(sql).run(valores);
    dadosPedido.id = existe.id;
  } else {
    const { sql, valores } = montarInsertPedido(dadosPedido);
    const result = db.prepare(sql).run(valores);
    dadosPedido.id = result.lastInsertRowid;
  }

  if (pedido.items?.data && Array.isArray(pedido.items.data)) {
    if (existe) {
      db.prepare('DELETE FROM itens_pedido_yampi WHERE pedido_yampi_id = ?')
        .run(dadosPedido.id);
    }
    
    for (const item of pedido.items.data) {
      await salvarItemPedido(dadosPedido.id, item);
    }
  }
}

async function salvarItemPedido(pedidoId, item) {
  const colunasDisponiveis = getColunasItensDisponiveis();
  
  const produtoNome = item.sku?.data?.title || item.name || '';
  
  // Tentar classificar automaticamente
  const produtoClassificado = classificarItemAutomaticamente(produtoNome);
  
  const dadosItem = {
    pedido_yampi_id: pedidoId,
    yampi_item_id: item.id,
    produto_yampi_nome: produtoNome,
    sku: item.sku?.data?.sku || item.item_sku || item.sku_code || '',
    quantidade: parseInt(item.quantity || 1),
    preco_unitario: parseFloat(item.price || 0),
    valor_total: parseFloat(item.price_total || (item.price * item.quantity) || 0),
    produto_id: produtoClassificado?.produto_id || null,
    atracao_id: produtoClassificado?.atracao_id || null,
    classificado: produtoClassificado ? 1 : 0,
    data_classificacao: produtoClassificado ? new Date().toISOString() : null,
    presenca_confirmada: 0,
    data_confirmacao_presenca: null,
    confirmado_por: null
  };

  const colunas = [];
  const valores = [];
  const placeholders = [];

  Object.keys(dadosItem).forEach(coluna => {
    if (colunasDisponiveis.has(coluna)) {
      colunas.push(coluna);
      valores.push(validarValor(dadosItem[coluna]));
      placeholders.push('?');
    }
  });

  const sql = `INSERT INTO itens_pedido_yampi (${colunas.join(', ')}) VALUES (${placeholders.join(', ')})`;
  db.prepare(sql).run(valores);
}

async function buscarProdutos(params = {}) {
  try {
    const client = getYampiClient();
    const response = await client.get('/catalog/products', { params });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar produtos Yampi:', error.message);
    throw error;
  }
}

async function buscarColecoes(params = {}) {
  try {
    const client = getYampiClient();
    const response = await client.get('/catalog/collections', { params });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar coleções Yampi:', error.message);
    throw error;
  }
}

async function testarConexao() {
  try {
    const client = getYampiClient();
    const response = await client.get('/catalog/products', {
      params: { limit: 1 }
    });

    return {
      sucesso: true,
      mensagem: 'Conexão com Yampi estabelecida com sucesso!',
      dados: {
        alias: getConfig('yampi_alias'),
        produtosEncontrados: response.data.meta?.pagination?.total || 0
      }
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message,
      detalhes: error.response?.data || null
    };
  }
}

async function debugPedido(orderId) {
  try {
    const pedido = await buscarPedido(orderId);
    console.log('\n========== ESTRUTURA DO PEDIDO ==========\n');
    console.log(JSON.stringify(pedido, null, 2));
    console.log('\n========== ACESSOS IMPORTANTES ==========\n');
    console.log('Nome do cliente:', pedido.data?.customer?.data?.name);
    console.log('Email do cliente:', pedido.data?.customer?.data?.email);
    console.log('Status:', pedido.data?.status?.data?.name);
    console.log('Quantidade de itens:', pedido.data?.items?.data?.length);
    console.log('Valor total:', pedido.data?.value_total);
    console.log('Método pagamento:', pedido.data?.payment_method);
  } catch (error) {
    console.error('Erro no debug:', error.message);
  }
}

module.exports = {
  buscarPedidos,
  buscarPedido,
  buscarStatusDisponiveis,
  sincronizarPedidos,
  buscarProdutos,
  buscarColecoes,
  testarConexao,
  debugPedido,
  getConfig
};