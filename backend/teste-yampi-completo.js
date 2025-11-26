const axios = require('axios');
const Database = require('better-sqlite3');

console.log('\n╔════════════════════════════════════════╗');
console.log('║   🧪 TESTE COMPLETO YAMPI             ║');
console.log('╚════════════════════════════════════════╝\n');

// 1. VERIFICAR BANCO
console.log('📋 PASSO 1: Verificando banco...');
const db = new Database('./pdv_visite_campos.db');

const getConfig = (chave) => {
  const row = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave);
  return row ? row.valor : null;
};

const alias = getConfig('yampi_alias');
const token = getConfig('yampi_token');
const secret = getConfig('yampi_secret');

console.log(`Alias: ${alias} (${alias?.length || 0} chars)`);
console.log(`Token: ${token?.substring(0, 20)}... (${token?.length || 0} chars)`);
console.log(`Secret: ${secret?.substring(0, 20)}... (${secret?.length || 0} chars)\n`);

if (!alias || !token || !secret) {
  console.log('❌ ERRO: Configurações incompletas!\n');
  process.exit(1);
}

// 2. TESTE 1: Produtos (endpoint mais simples)
console.log('📋 PASSO 2: Testando endpoint /catalog/products...');

const YAMPI_BASE_URL = 'https://api.dooki.com.br/v2';

axios.get(
  `${YAMPI_BASE_URL}/${alias}/catalog/products`,
  {
    headers: {
      'Content-Type': 'application/json',
      'User-Token': token,
      'User-Secret-Key': secret
    },
    params: { limit: 1 }
  }
)
.then(response => {
  console.log('✅ PRODUTOS - FUNCIONOU!');
  console.log(`   Status: ${response.status}`);
  console.log(`   Total produtos: ${response.data.meta?.pagination?.total || 0}\n`);
  
  // 3. TESTE 2: Pedidos
  console.log('📋 PASSO 3: Testando endpoint /orders...');
  return axios.get(
    `${YAMPI_BASE_URL}/${alias}/orders`,
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Token': token,
        'User-Secret-Key': secret
      },
      params: { 
        page: 1,
        limit: 5,
        include: 'items,customer'
      }
    }
  );
})
.then(response => {
  console.log('✅ PEDIDOS - FUNCIONOU!');
  console.log(`   Status: ${response.status}`);
  console.log(`   Total pedidos: ${response.data.data?.length || 0}`);
  console.log(`   Paginação: ${JSON.stringify(response.data.meta?.pagination || {})}\n`);
  
  if (response.data.data?.length > 0) {
    const pedido = response.data.data[0];
    console.log('📦 Primeiro pedido:');
    console.log(`   ID: ${pedido.id}`);
    console.log(`   Número: ${pedido.number}`);
    console.log(`   Cliente: ${pedido.customer?.name || 'N/A'}`);
    console.log(`   Valor: R$ ${pedido.value_total}`);
    console.log(`   Status Pgto: ${pedido.payment?.status || 'N/A'}`);
    console.log(`   Itens: ${pedido.items?.length || 0}\n`);
  }
  
  // 4. TESTE 3: Pedidos PAGOS
  console.log('📋 PASSO 4: Testando filtro de pedidos pagos...');
  return axios.get(
    `${YAMPI_BASE_URL}/${alias}/orders`,
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Token': token,
        'User-Secret-Key': secret
      },
      params: { 
        page: 1,
        limit: 5,
        'q[payment.status][in]': 'paid,partially_refunded',
        include: 'items.sku_variant.sku.product,customer'
      }
    }
  );
})
.then(response => {
  console.log('✅ PEDIDOS PAGOS - FUNCIONOU!');
  console.log(`   Status: ${response.status}`);
  console.log(`   Pedidos pagos: ${response.data.data?.length || 0}\n`);
  
  if (response.data.data?.length === 0) {
    console.log('⚠️  ATENÇÃO: Não há pedidos PAGOS na sua loja Yampi!');
    console.log('   A sincronização só importa pedidos com status: paid ou partially_refunded\n');
  }
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ✅ TODOS OS TESTES PASSARAM!        ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log('🎯 CONCLUSÃO:');
  console.log('   Suas credenciais estão CORRETAS!');
  console.log('   O problema pode ser:');
  console.log('   1. Não há pedidos pagos na loja');
  console.log('   2. Erro em outra parte do código');
  console.log('   3. Filtros muito restritivos\n');
})
.catch(error => {
  console.log('❌ ERRO NO TESTE!');
  console.log(`   Mensagem: ${error.message}`);
  
  if (error.response) {
    console.log(`   Status HTTP: ${error.response.status}`);
    console.log(`   Resposta API:`, JSON.stringify(error.response.data, null, 2));
    
    if (error.response.status === 401) {
      console.log('\n💡 Erro 401 = Credenciais INVÁLIDAS');
      console.log('   Soluções:');
      console.log('   1. Verifique se copiou token e secret COMPLETOS');
      console.log('   2. Vá no painel Yampi e RECRIE as credenciais');
      console.log('   3. Verifique se a conta não está suspensa');
    } else if (error.response.status === 404) {
      console.log('\n💡 Erro 404 = Alias INCORRETO');
      console.log(`   Seu alias: "${alias}"`);
      console.log('   Verifique se está exatamente como no painel Yampi');
    } else if (error.response.status === 500) {
      console.log('\n💡 Erro 500 = Problema na API Yampi ou credenciais malformadas');
      console.log('   Soluções:');
      console.log('   1. Recrie as credenciais no painel Yampi');
      console.log('   2. Verifique se não há espaços extras nas credenciais');
      console.log('   3. Tente novamente em alguns minutos');
    }
  } else if (error.code === 'ENOTFOUND') {
    console.log('\n💡 Erro de DNS/Rede');
    console.log('   Verifique sua conexão com a internet');
  }
  
  console.log('\n');
  process.exit(1);
});
