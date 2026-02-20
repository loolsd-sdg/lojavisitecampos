const Database = require('better-sqlite3');
const db = new Database('./pdv_visite_campos.db');

console.log('📊 Estrutura atual da tabela vendas:');
const info = db.prepare("PRAGMA table_info(vendas)").all();
console.log(info);

// Verificar se os campos já existem
const hasPresencaConfirmada = info.some(col => col.name === 'presenca_confirmada');
const hasDataConfirmacao = info.some(col => col.name === 'data_confirmacao_presenca');
const hasConfirmadoPor = info.some(col => col.name === 'confirmado_por');

if (!hasPresencaConfirmada || !hasDataConfirmacao || !hasConfirmadoPor) {
  console.log('\n🔧 Adicionando campos de confirmação...');
  
  try {
    if (!hasPresencaConfirmada) {
      db.exec(`ALTER TABLE vendas ADD COLUMN presenca_confirmada INTEGER DEFAULT 0`);
      console.log('✅ Campo presenca_confirmada adicionado');
    }
    
    if (!hasDataConfirmacao) {
      db.exec(`ALTER TABLE vendas ADD COLUMN data_confirmacao_presenca TEXT`);
      console.log('✅ Campo data_confirmacao_presenca adicionado');
    }
    
    if (!hasConfirmadoPor) {
      db.exec(`ALTER TABLE vendas ADD COLUMN confirmado_por INTEGER`);
      console.log('✅ Campo confirmado_por adicionado');
    }
    
    console.log('\n✅ Campos adicionados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao adicionar campos:', error.message);
  }
} else {
  console.log('\n✅ Todos os campos já existem!');
}

console.log('\n📊 Estrutura atualizada:');
const newInfo = db.prepare("PRAGMA table_info(vendas)").all();
console.log(newInfo);

db.close();
