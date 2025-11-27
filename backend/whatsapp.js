const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const db = require('./database');

function getConfig(chave) {
  const config = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave);
  return config ? config.valor : null;
}

async function gerarImagemIngresso(venda) {
  const width = 1080;
  const height = 1350;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillRect(60, 80, width - 120, height - 160);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = '#667eea';
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🎫 VISITE CAMPOS', width / 2, 200);

  ctx.fillStyle = '#764ba2';
  ctx.font = '42px Arial';
  ctx.fillText('INGRESSO', width / 2, 270);

  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(150, 320);
  ctx.lineTo(width - 150, 320);
  ctx.stroke();

  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 64px Arial';
  ctx.fillText(`#${venda.codigo_venda}`, width / 2, 420);

  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('CLIENTE:', 150, 520);
  
  ctx.fillStyle = '#34495e';
  ctx.font = '36px Arial';
  ctx.fillText(venda.nome_cliente, 150, 580);

  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 40px Arial';
  ctx.fillText('PRODUTO:', 150, 680);
  
  ctx.fillStyle = '#34495e';
  ctx.font = '36px Arial';
  ctx.fillText(venda.produto_nome, 150, 740);

  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 40px Arial';
  ctx.fillText('PESSOAS:', 150, 840);
  
  ctx.fillStyle = '#34495e';
  ctx.font = '48px Arial';
  ctx.fillText(venda.quantidade_pessoas.toString(), 150, 910);

  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(100, 970, width - 200, 180);
  
  ctx.fillStyle = '#7f8c8d';
  ctx.font = '32px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Valor Unitário: R$ ${venda.preco_unitario.toFixed(2)}`, 130, 1025);
  ctx.fillText(`Subtotal: R$ ${venda.subtotal.toFixed(2)}`, 130, 1075);
  
  if (venda.desconto > 0) {
    ctx.fillStyle = '#e74c3c';
    ctx.fillText(`Desconto: R$ ${venda.desconto.toFixed(2)}`, 130, 1125);
  }

  ctx.fillStyle = '#27ae60';
  ctx.font = 'bold 56px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`TOTAL: R$ ${venda.valor_total.toFixed(2)}`, width / 2, 1230);

  ctx.fillStyle = '#95a5a6';
  ctx.font = '28px Arial';
  ctx.textAlign = 'center';
  const dataHora = new Date(venda.created_at).toLocaleString('pt-BR');
  ctx.fillText(dataHora, width / 2, 1310);
  ctx.fillText(`Vendedor: ${venda.operador_nome}`, width / 2, 1355);

  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(70, 120);
  ctx.lineTo(70, 90);
  ctx.lineTo(100, 90);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width - 70, 120);
  ctx.lineTo(width - 70, 90);
  ctx.lineTo(width - 100, 90);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(70, height - 120);
  ctx.lineTo(70, height - 90);
  ctx.lineTo(100, height - 90);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width - 70, height - 120);
  ctx.lineTo(width - 70, height - 90);
  ctx.lineTo(width - 100, height - 90);
  ctx.stroke();

  return canvas.toBuffer('image/jpeg', { quality: 0.95 });
}

async function enviarWhatsApp(telefone, imagemBuffer, venda) {
  try {
    const url = getConfig('evoapi_url');
    const apiKey = getConfig('evoapi_key');
    const instance = getConfig('evoapi_instance');
    const mensagemTemplate = getConfig('whatsapp_mensagem');
    const ativo = getConfig('whatsapp_ativo');

    if (ativo !== '1') {
      console.log('⚠️ Envio automático de WhatsApp está desativado');
      return { sucesso: false, erro: 'Envio desativado' };
    }

    if (!url || !apiKey || !instance) {
      console.log('⚠️ Configurações da EvoAPI incompletas');
      return { sucesso: false, erro: 'Configurações incompletas' };
    }

    let telefoneFormatado = telefone.replace(/\D/g, '');
    if (!telefoneFormatado.startsWith('55')) {
      telefoneFormatado = '55' + telefoneFormatado;
    }

    const mensagem = mensagemTemplate
      .replace('{nome}', venda.nome_cliente)
      .replace('{codigo}', venda.codigo_venda);

    const base64Image = imagemBuffer.toString('base64');

    const payload = {
      number: telefoneFormatado,
      mediatype: 'image',
      mimetype: 'image/jpeg',
      media: base64Image,
      fileName: `ingresso_${venda.codigo_venda}.jpg`,
      caption: mensagem
    };

    const endpoint = `${url}/message/sendMedia/${instance}`;
    console.log(`📤 Enviando para: ${endpoint}`);
    
    const response = await axios.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      timeout: 30000
    });

    console.log('✅ WhatsApp enviado com sucesso!', response.data);
    return { sucesso: true, resposta: response.data };

  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error.message);
    if (error.response) {
      console.error('Resposta da API:', error.response.data);
      return { 
        sucesso: false, 
        erro: `Erro da API: ${error.response.status} - ${JSON.stringify(error.response.data)}` 
      };
    }
    return { sucesso: false, erro: error.message };
  }
}

async function gerarEEnviarIngresso(venda) {
  try {
    console.log(`🎫 Gerando ingresso para venda #${venda.codigo_venda}...`);
    
    const imagemBuffer = await gerarImagemIngresso(venda);
    console.log('✅ Imagem gerada com sucesso');

    if (venda.telefone_cliente) {
      console.log(`📱 Enviando para WhatsApp: ${venda.telefone_cliente}...`);
      const resultado = await enviarWhatsApp(venda.telefone_cliente, imagemBuffer, venda);
      
      if (resultado.sucesso) {
        db.prepare('UPDATE vendas SET whatsapp_enviado = 1 WHERE id = ?').run(venda.id);
        console.log('✅ Status atualizado: WhatsApp enviado');
      } else {
        db.prepare('UPDATE vendas SET whatsapp_enviado = 0, whatsapp_erro = ? WHERE id = ?')
          .run(resultado.erro, venda.id);
        console.log('❌ Status atualizado: Erro no envio');
      }
      
      return { imagemBuffer, whatsapp: resultado };
    }

    return { imagemBuffer, whatsapp: { sucesso: false, erro: 'Sem telefone' } };

  } catch (error) {
    console.error('❌ Erro ao gerar/enviar ingresso:', error);
    throw error;
  }
}

module.exports = {
  gerarImagemIngresso,
  enviarWhatsApp,
  gerarEEnviarIngresso,
  getConfig
};