/**
 * Script para sincronizar TODOS os pedidos da Yampi
 * Sem filtros de data ou status
 * 
 * Execute: node sincronizar_todos_pedidos.js
 */

const axios = require('axios');
const Database = require('better-sqlite3');

// Configurações (AJUSTE CONFORME SEU .env)
const YAMPI_API_KEY = process.env.YAMPI_API_KEY || 'RILTRMAclTrsIwjlm5AdZzKf2NxMq2xah0yowZdz';
const YAMPI_SECRET_KEY = process.env.YAMPI_SECRET_KEY || 'sk_8DSuOjqdsKlXp39eVXACZ4947YpY7X22qxCxl';
const YAMPI_ALIAS = process.env.YAMPI_ALIAS || 'visite-campos';

const db = new Database('./pdv_visite_campos.db');

// Cliente Yampi
const yampiClient = axios.create({
  baseURL: `https://api.dooki.com.br/v2/${YAMPI_ALIAS}`,
  headers: {
    'User-Token': YAMPI_API_KEY,
    'User-Secret-Key': YAMPI_SECRET_KEY,
    'Content-Type': 'application/json'
  }
});

// Função para extrair data do objeto ou string
function extrairData(dataObj) {
  if (!dataObj) return null;
  if (typeof dataObj === 'string') return dataObj;
  if (typeof dataObj === 'object' && dataObj.date) return dataObj.date;
  return null;
}

// Função para salvar pedido
async function salvarPedido(pedido) {
  try {
    // Extrair dados do pedido
    const numero_pedido = String(pedido.number);
    const data_pedido = extrairData(pedido.created_at);
    const data_atualizacao = extrairData(pedido.updated_at);
    const cliente_nome = pedido.customer?.data?.first_name + ' ' + pedido.customer?.data?.last_name;
    const cliente_email = pedido.customer?.data?.email;
    const valor_total = parseFloat(pedido.value?.price || 0);
    const status_financeiro = pedido.status?.data?.name || 'desconhecido';
    const status_entrega = pedido.status?.data?.type || 'pendente';

    // Verificar se já existe
    const existe = db.prepare('SELECT id FROM pedidos_yampi WHERE yampi_order_id = ?').get(pedido.id);

    if (existe) {
      // Atualizar
      db.prepare(`
        UPDATE pedidos_yampi SET
          numero_pedido = ?,
          data_pedido = ?,
          data_atualizacao = ?,
          cliente_nome = ?,
          cliente_email = ?,
          valor_total = ?,
          status_financeiro = ?,
          status_entrega = ?,
          json_completo = ?
        WHERE yampi_order_id = ?
      `).run(
        numero_pedido,
        data_pedido,
        data_atualizacao,
        cliente_nome,
        cliente_email,
        valor_total,
        status_financeiro,
        status_entrega,
        JSON.stringify(pedido),
        pedido.id
      );
      return 'atualizado';
    } else {
      // Inserir
      db.prepare(`
        INSERT INTO pedidos_yampi (
          yampi_order_id,
          numero_pedido,
          data_pedido,
          data_atualizacao,
          cliente_nome,
          cliente_email,
          valor_total,
          status_financeiro,
          status_entrega,
          json_completo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        pedido.id,
        numero_pedido,
        data_pedido,
        data_atualizacao,
        cliente_nome,
        cliente_email,
        valor_total,
        status_financeiro,
        status_entrega,
        JSON.stringify(pedido)
      );

      // Salvar itens
      const pedidoId = db.prepare('SELECT id FROM pedidos_yampi WHERE yampi_order_id = ?').get(pedido.id).id;
      
      if (pedido.items && pedido.items.data) {
        for (const item of pedido.items.data) {
          const produto_nome = item.sku?.data?.title || item.name || '';
          const produto_sku = item.sku?.data?.sku || '';
          
          db.prepare(`
            INSERT INTO itens_pedido_yampi (
              pedido_yampi_id,
              produto_yampi_id,
              produto_yampi_nome,
              produto_yampi_sku,
              quantidade,
              preco_unitario,
              preco_total,
              json_completo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            pedidoId,
            item.sku_id,
            produto_nome,
            produto_sku,
            item.quantity,
            parseFloat(item.price?.price || 0),
            parseFloat(item.subtotal?.price || 0),
            JSON.stringify(item)
          );

          // Classificar automaticamente
          if (produto_nome) {
            const produtos = db.prepare('SELECT id, nome, atracao_id FROM produtos').all();
            for (const produto of produtos) {
              if (produto_nome.toLowerCase().includes(produto.nome.toLowerCase())) {
                db.prepare(`
                  UPDATE itens_pedido_yampi 
                  SET classificado = 1, 
                      produto_id = ?,
                      atracao_id = ?
                  WHERE pedido_yampi_id = ? AND produto_yampi_nome = ?
                `).run(produto.id, produto.atracao_id, pedidoId, produto_nome);
                break;
              }
            }
          }
        }
      }

      return 'novo';
    }
  } catch (error) {
    console.error('Erro ao salvar pedido:', error.message);
    throw error;
  }
}

// Função principal
async function sincronizarTodos() {
  console.log('🚀 Iniciando sincronização COMPLETA da Yampi...\n');

  let novos = 0;
  let atualizados = 0;
  let erros = 0;
  let paginaAtual = 1;
  let totalPaginas = 1;
  let totalPedidos = 0;

  try {
    do {
      console.log(`📖 Buscando página ${paginaAtual}/${totalPaginas}...`);

      const response = await yampiClient.get('/orders', {
        params: {
          page: paginaAtual,
          limit: 100,
          include: 'customer,status,items,transactions,shipping_address'
        }
      });

      const pedidos = response.data.data || [];
      totalPaginas = response.data.meta?.pagination?.total_pages || 1;
      totalPedidos = response.data.meta?.pagination?.total || 0;

      console.log(`   → ${pedidos.length} pedidos encontrados`);

      for (const pedido of pedidos) {
        try {
          const resultado = await salvarPedido(pedido);
          if (resultado === 'novo') {
            novos++;
          } else {
            atualizados++;
          }
        } catch (error) {
          console.error(`   ❌ Erro no pedido #${pedido.number}:`, error.message);
          erros++;
        }
      }

      console.log(`   ✅ Página ${paginaAtual} processada\n`);
      paginaAtual++;

    } while (paginaAtual <= totalPaginas);

    console.log('═══════════════════════════════════════');
    console.log('✅ SINCRONIZAÇÃO COMPLETA!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total de pedidos na Yampi: ${totalPedidos}`);
    console.log(`📥 Novos pedidos: ${novos}`);
    console.log(`🔄 Pedidos atualizados: ${atualizados}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`📄 Páginas processadas: ${totalPaginas}`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ ERRO NA SINCRONIZAÇÃO:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    }
  } finally {
    db.close();
  }
}

// Executar
sincronizarTodos();
