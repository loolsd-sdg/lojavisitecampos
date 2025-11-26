#!/bin/bash

echo "🔍 DIAGNÓSTICO COMPLETO"
echo "======================================"
echo ""

# 1. Encontrar arquivos yampi
echo "📂 1. Arquivos yampi encontrados:"
find . -name "*yampi*.js" -not -path "*/node_modules/*" -not -path "*/backups/*" -type f
echo ""

# 2. Ver primeiras linhas do arquivo
echo "📄 2. Primeiras 50 linhas do yampi.js:"
if [ -f "yampi.js" ]; then
    head -50 yampi.js
else
    echo "❌ yampi.js não encontrado na raiz"
    YAMPI_FILE=$(find . -name "*yampi*.js" -not -path "*/node_modules/*" -not -path "*/backups/*" -type f | head -1)
    if [ -n "$YAMPI_FILE" ]; then
        echo "Encontrado em: $YAMPI_FILE"
        head -50 "$YAMPI_FILE"
    fi
fi
echo ""

# 3. Procurar função salvarPedido
echo "🔎 3. Verificando função salvarPedido:"
if [ -f "yampi.js" ]; then
    grep -A 5 "async function salvarPedido" yampi.js || echo "❌ Função salvarPedido não encontrada"
else
    YAMPI_FILE=$(find . -name "*yampi*.js" -not -path "*/node_modules/*" -not -path "*/backups/*" -type f | head -1)
    if [ -n "$YAMPI_FILE" ]; then
        grep -A 5 "async function salvarPedido" "$YAMPI_FILE" || echo "❌ Função salvarPedido não encontrada"
    fi
fi
echo ""

# 4. Verificar se tem montarInsertPedido (código novo)
echo "🆕 4. Verificando se tem código novo (montarInsertPedido):"
if [ -f "yampi.js" ]; then
    grep "montarInsertPedido" yampi.js && echo "✅ Código novo encontrado!" || echo "❌ Código antigo ainda em uso"
else
    YAMPI_FILE=$(find . -name "*yampi*.js" -not -path "*/node_modules/*" -not -path "*/backups/*" -type f | head -1)
    if [ -n "$YAMPI_FILE" ]; then
        grep "montarInsertPedido" "$YAMPI_FILE" && echo "✅ Código novo encontrado!" || echo "❌ Código antigo ainda em uso"
    fi
fi
echo ""

# 5. Ver onde está sendo importado
echo "📥 5. Onde o yampi está sendo importado:"
grep -r "require.*yampi" . --include="*.js" | grep -v node_modules | grep -v backups | head -10
echo ""

# 6. Status do PM2
echo "🚀 6. Status do PM2:"
pm2 status
echo ""

# 7. Informações do processo
echo "📊 7. Informações do processo pdv-back:"
pm2 info pdv-back | grep -E "script path|exec mode|restart time"
echo ""

# 8. Últimos erros
echo "❌ 8. Últimos erros nos logs:"
pm2 logs pdv-back --err --lines 10 --nostream
echo ""

# 9. Verificar colunas do banco
echo "🗄️  9. Colunas da tabela pedidos_yampi:"
if [ -f "pdv_visite_campos.db" ]; then
    sqlite3 pdv_visite_campos.db "PRAGMA table_info(pedidos_yampi);" | awk -F'|' '{print $2}' | head -20
else
    echo "❌ Banco de dados não encontrado"
fi
echo ""

echo "======================================"
echo "✅ Diagnóstico concluído!"
echo ""
