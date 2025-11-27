import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [usuario, setUsuario] = useState(JSON.parse(localStorage.getItem('usuario') || 'null'));
  const [tela, setTela] = useState('login');
  
  // Estados globais
  const [produtos, setProdutos] = useState([]);
  const [atracoes, setAtracoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // Configurar axios
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  // Carregar dados iniciais
  useEffect(() => {
    if (token) {
      carregarProdutos();
      if (usuario?.permissao === 'admin') {
        carregarAtracoes();
      }
    }
  }, [token]);

  const carregarProdutos = async () => {
    try {
      const res = await axios.get(`${API_URL}/produtos`);
      setProdutos(res.data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const carregarAtracoes = async () => {
    try {
      const res = await axios.get(`${API_URL}/atracoes`);
      setAtracoes(res.data);
    } catch (error) {
      console.error('Erro ao carregar atrações:', error);
    }
  };

  const mostrarMensagem = (texto, tipo = 'sucesso') => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 5000);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setToken(null);
    setUsuario(null);
    setTela('login');
    delete axios.defaults.headers.common['Authorization'];
  };

  // Se não estiver logado, mostrar tela de login
  if (!token) {
    return <TelaLogin setToken={setToken} setUsuario={setUsuario} setTela={setTela} mostrarMensagem={mostrarMensagem} />;
  }

  // ========== NOVO: Se for usuário de atração, renderizar painel específico ==========
  if (usuario?.permissao === 'atracao') {
    return (
      <div>
        {mensagem && (
          <div className={`mensagem ${mensagem.tipo}`}>
            {mensagem.tipo === 'sucesso' ? '✅' : '❌'} {mensagem.texto}
          </div>
        )}
        <TelaUsuarioAtracao 
  usuario={usuario} 
  logout={logout} 
  mostrarMensagem={mostrarMensagem} 
/>
      </div>
    );
  }
  // ========== FIM DO BLOCO NOVO ==========

  return (
    <div className="App">
      <nav className="navbar">
        <div className="nav-brand">
          <h1>🎫 PDV Visite Campos</h1>
          <span className="user-info">👤 {usuario?.nome} {usuario?.permissao === 'admin' && '(Admin)'}</span>
        </div>
        
        <div className="nav-menu">
          <button onClick={() => setTela('nova-venda')} className={tela === 'nova-venda' ? 'active' : ''}>
            🎟️ Nova Venda
          </button>
          <button onClick={() => setTela('historico')} className={tela === 'historico' ? 'active' : ''}>
            📊 Histórico
          </button>
          <button onClick={() => setTela('ranking')} className={tela === 'ranking' ? 'active' : ''}>
            🏆 Ranking
          </button>
          
          {usuario?.permissao === 'admin' && (
            <>
              <button onClick={() => setTela('produtos')} className={tela === 'produtos' ? 'active' : ''}>
                📦 Produtos
              </button>
              <button onClick={() => setTela('atracoes')} className={tela === 'atracoes' ? 'active' : ''}>
                🏛️ Atrações
              </button>
              <button onClick={() => setTela('pedidos-yampi')} className={tela === 'pedidos-yampi' ? 'active' : ''}>
                🛒 Pedidos Yampi
              </button>
              <button onClick={() => setTela('classificacao')} className={tela === 'classificacao' ? 'active' : ''}>
                📋 Classificação
              </button>
              <button onClick={() => setTela('operadores')} className={tela === 'operadores' ? 'active' : ''}>
                👥 Operadores
              </button>
              <button onClick={() => setTela('configuracoes')} className={tela === 'configuracoes' ? 'active' : ''}>
                ⚙️ Configurações
              </button>
            </>
          )}
          
          <button onClick={logout} className="btn-logout">🚪 Sair</button>
        </div>
      </nav>

      {mensagem && (
        <div className={`mensagem ${mensagem.tipo}`}>
          {mensagem.tipo === 'sucesso' ? '✅' : '❌'} {mensagem.texto}
        </div>
      )}

      <div className="container">
        {tela === 'nova-venda' && (
          <TelaNovaVenda 
            produtos={produtos} 
            usuario={usuario} 
            mostrarMensagem={mostrarMensagem}
          />
        )}
        {tela === 'historico' && <TelaHistorico />}
        {tela === 'ranking' && <TelaRanking />}
        {tela === 'produtos' && (
          <TelaProdutos 
            produtos={produtos} 
            atracoes={atracoes}
            carregarProdutos={carregarProdutos} 
            mostrarMensagem={mostrarMensagem}
          />
        )}
        {tela === 'atracoes' && (
          <TelaAtracoes 
            atracoes={atracoes}
            carregarAtracoes={carregarAtracoes}
            mostrarMensagem={mostrarMensagem}
            setTela={setTela}
          />
        )}
        {tela === 'pedidos-yampi' && (
          <TelaPedidosYampi mostrarMensagem={mostrarMensagem} />
        )}
        {tela === 'classificacao' && (
          <TelaClassificacao 
            produtos={produtos}
            atracoes={atracoes}
            mostrarMensagem={mostrarMensagem}
          />
        )}
        {tela === 'operadores' && (
          <TelaOperadores 
            atracoes={atracoes}  // ← ADICIONADO
            mostrarMensagem={mostrarMensagem} 
          />
        )}
        {tela === 'configuracoes' && (
          <TelaConfiguracoes mostrarMensagem={mostrarMensagem} />
        )}
        {tela.startsWith('atracao-') && (
          <TelaRelatorioAtracao 
            atracaoId={tela.split('-')[1]}
            setTela={setTela}
            mostrarMensagem={mostrarMensagem}
          />
        )}
      </div>
    </div>
  );
}

// ==================== TELA DE LOGIN ====================
function TelaLogin({ setToken, setUsuario, setTela, mostrarMensagem }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/login`, { username, password });
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('usuario', JSON.stringify(res.data.operador));
      
      setToken(res.data.token);
      setUsuario(res.data.operador);
      
      // ========== MODIFICADO: Definir tela inicial baseada na permissão ==========
      if (res.data.operador.permissao === 'atracao') {
        setTela('dashboard-atracao'); // Será renderizado o PainelAtracao
      } else {
        setTela('nova-venda');
      }
      // ========== FIM DA MODIFICAÇÃO ==========
      
      mostrarMensagem(`Bem-vindo, ${res.data.operador.nome}!`);
    } catch (error) {
      mostrarMensagem(error.response?.data?.error || 'Erro ao fazer login', 'erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🎫 PDV Visite Campos</h1>
        <h2>Sistema de Vendas</h2>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>👤 Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>🔒 Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '⏳ Entrando...' : '🚀 Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==================== TELA NOVA VENDA ====================
function TelaNovaVenda({ produtos, usuario, mostrarMensagem }) {
  const [formData, setFormData] = useState({
    nome_cliente: '',
    telefone_cliente: '',
    produto_id: '',
    quantidade_pessoas: 1,
    desconto: 0,
    tipo_desconto: 'valor',
    venda_online: false
  });

  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [codigoVenda, setCodigoVenda] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    buscarProximoCodigo();
  }, []);

  useEffect(() => {
    if (formData.produto_id) {
      const produto = produtos.find(p => p.id === parseInt(formData.produto_id));
      setProdutoSelecionado(produto);
    } else {
      setProdutoSelecionado(null);
    }
  }, [formData.produto_id, produtos]);

  const buscarProximoCodigo = async () => {
    try {
      const res = await axios.get(`${API_URL}/vendas/proximo-codigo`);
      setCodigoVenda(res.data.codigo);
    } catch (error) {
      console.error('Erro ao buscar código:', error);
    }
  };

  const calcularValores = () => {
    if (!produtoSelecionado) return { subtotal: 0, desconto_valor: 0, total: 0 };

    const subtotal = produtoSelecionado.preco * formData.quantidade_pessoas;
    let desconto_valor = 0;

    if (formData.desconto > 0) {
      if (formData.tipo_desconto === 'percentual') {
        desconto_valor = (subtotal * parseFloat(formData.desconto)) / 100;
      } else {
        desconto_valor = parseFloat(formData.desconto);
      }
    }

    const total = subtotal - desconto_valor;
    return { subtotal, desconto_valor, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/vendas`, formData);
      
      let mensagemSucesso = `✅ Venda #${res.data.codigo_venda} registrada com sucesso!`;
      
      if (formData.telefone_cliente && res.data.whatsapp) {
        if (res.data.whatsapp.enviado) {
          mensagemSucesso += ' 📱 Ingresso enviado no WhatsApp!';
        } else {
          mensagemSucesso += ' ⚠️ Erro ao enviar WhatsApp.';
        }
      }
      
      mostrarMensagem(mensagemSucesso);
      
      // Limpar formulário
      setFormData({
        nome_cliente: '',
        telefone_cliente: '',
        produto_id: '',
        quantidade_pessoas: 1,
        desconto: 0,
        tipo_desconto: 'valor',
        venda_online: false
      });
      setProdutoSelecionado(null);
      buscarProximoCodigo();
      
    } catch (error) {
      mostrarMensagem(error.response?.data?.error || 'Erro ao registrar venda', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const valores = calcularValores();

  return (
    <div className="tela-nova-venda">
      <div className="tela-header">
        <h2>🎟️ Nova Venda</h2>
        <div className="codigo-venda">Código: #{codigoVenda}</div>
      </div>

      <form onSubmit={handleSubmit} className="form-venda">
        <div className="form-row">
          <div className="form-group">
            <label>👤 Nome do Cliente *</label>
            <input
              type="text"
              value={formData.nome_cliente}
              onChange={(e) => setFormData({...formData, nome_cliente: e.target.value})}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div className="form-group">
            <label>📱 Telefone (WhatsApp)</label>
            <input
              type="tel"
              value={formData.telefone_cliente}
              onChange={(e) => setFormData({...formData, telefone_cliente: e.target.value})}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>🎫 Produto *</label>
            <select
              value={formData.produto_id}
              onChange={(e) => setFormData({...formData, produto_id: e.target.value})}
              required
            >
              <option value="">Selecione um produto</option>
              {produtos.map(produto => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome} - R$ {produto.preco.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>👥 Quantidade de Pessoas *</label>
            <input
              type="number"
              min="1"
              value={formData.quantidade_pessoas}
              onChange={(e) => setFormData({...formData, quantidade_pessoas: parseInt(e.target.value)})}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>💰 Desconto</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.desconto}
              onChange={(e) => setFormData({...formData, desconto: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>Tipo de Desconto</label>
            <select
              value={formData.tipo_desconto}
              onChange={(e) => setFormData({...formData, tipo_desconto: e.target.value})}
            >
              <option value="valor">Valor (R$)</option>
              <option value="percentual">Percentual (%)</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.venda_online}
              onChange={(e) => setFormData({...formData, venda_online: e.target.checked})}
            />
            🌐 Venda Online
          </label>
        </div>

        {produtoSelecionado && (
          <div className="resumo-venda">
            <h3>💵 Resumo da Venda</h3>
            <div className="resumo-item">
              <span>Subtotal:</span>
              <span>R$ {valores.subtotal.toFixed(2)}</span>
            </div>
            {valores.desconto_valor > 0 && (
              <div className="resumo-item desconto">
                <span>Desconto:</span>
                <span>- R$ {valores.desconto_valor.toFixed(2)}</span>
              </div>
            )}
            <div className="resumo-item total">
              <span>TOTAL:</span>
              <span>R$ {valores.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary btn-large">
          {loading ? '⏳ Processando...' : '✅ Registrar Venda'}
        </button>
      </form>
    </div>
  );
}

// ==================== TELA HISTÓRICO ====================
function TelaHistorico() {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarVendas();
  }, []);

  const carregarVendas = async () => {
    try {
      const res = await axios.get(`${API_URL}/vendas`);
      setVendas(res.data);
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">⏳ Carregando...</div>;

  return (
    <div className="tela-historico">
      <div className="tela-header">
        <h2>📊 Histórico de Vendas</h2>
        <button onClick={carregarVendas} className="btn-secondary">🔄 Atualizar</button>
      </div>

      {vendas.length === 0 ? (
        <div className="empty-state">
          <p>📭 Nenhuma venda registrada ainda</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Valor</th>
                <th>Vendedor</th>
                <th>Data/Hora</th>
                <th>WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {vendas.map(venda => (
                <tr key={venda.id}>
                  <td>#{venda.codigo_venda}</td>
                  <td>{venda.nome_cliente}</td>
                  <td>{venda.produto_nome}</td>
                  <td>{venda.quantidade_pessoas}</td>
                  <td>R$ {venda.valor_total.toFixed(2)}</td>
                  <td>{venda.operador_nome}</td>
                  <td>{new Date(venda.created_at).toLocaleString('pt-BR')}</td>
                  <td>
                    {venda.telefone_cliente ? (
                      venda.whatsapp_enviado ? '✅' : '❌'
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== TELA RANKING ====================
function TelaRanking() {
  const [ranking, setRanking] = useState([]);
  const [periodo, setPeriodo] = useState('total');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarRanking();
  }, [periodo]);

  const carregarRanking = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/vendas/estatisticas?periodo=${periodo}`);
      setRanking(res.data);
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">⏳ Carregando...</div>;

  return (
    <div className="tela-ranking">
      <div className="tela-header">
        <h2>🏆 Ranking de Vendedores</h2>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="select-periodo">
          <option value="hoje">Hoje</option>
          <option value="ontem">Ontem</option>
          <option value="ultimos7dias">Últimos 7 dias</option>
          <option value="estemes">Este mês</option>
          <option value="total">Total</option>
        </select>
      </div>

      {ranking.length === 0 ? (
        <div className="empty-state">
          <p>📭 Nenhuma venda no período selecionado</p>
        </div>
      ) : (
        <div className="ranking-list">
          {ranking.map((operador, index) => (
            <div key={operador.operador_id} className={`ranking-card posicao-${index + 1}`}>
              <div className="ranking-posicao">
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                {index > 2 && `${index + 1}º`}
              </div>
              <div className="ranking-info">
                <h3>{operador.operador_nome}</h3>
                <div className="ranking-stats">
                  <span>📊 {operador.total_vendas} vendas</span>
                  <span>💰 R$ {operador.valor_total.toFixed(2)}</span>
                  <span>🎯 Ticket: R$ {operador.ticket_medio.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== TELA PRODUTOS ====================
function TelaProdutos({ produtos, atracoes, carregarProdutos, mostrarMensagem }) {
  const [modoEdicao, setModoEdicao] = useState(false);
  const [produtoEdicao, setProdutoEdicao] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    preco: '',
    descricao: '',
    atracao_id: '',
    tipo_comissao: 'percentual',
    valor_comissao: 0
  });

  const abrirFormulario = (produto = null) => {
    if (produto) {
      setFormData({
        nome: produto.nome,
        preco: produto.preco,
        descricao: produto.descricao || '',
        atracao_id: produto.atracao_id || '',
        tipo_comissao: produto.tipo_comissao || 'percentual',
        valor_comissao: produto.valor_comissao || 0
      });
      setProdutoEdicao(produto);
    } else {
      setFormData({
        nome: '',
        preco: '',
        descricao: '',
        atracao_id: '',
        tipo_comissao: 'percentual',
        valor_comissao: 0
      });
      setProdutoEdicao(null);
    }
    setModoEdicao(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (produtoEdicao) {
        await axios.put(`${API_URL}/produtos/${produtoEdicao.id}`, formData);
        mostrarMensagem('Produto atualizado com sucesso!');
      } else {
        await axios.post(`${API_URL}/produtos`, formData);
        mostrarMensagem('Produto criado com sucesso!');
      }
      
      carregarProdutos();
      setModoEdicao(false);
    } catch (error) {
      mostrarMensagem(error.response?.data?.error || 'Erro ao salvar produto', 'erro');
    }
  };

  const desativarProduto = async (id) => {
    if (!window.confirm('Deseja realmente desativar este produto?')) return;

    try {
      await axios.delete(`${API_URL}/produtos/${id}`);
      mostrarMensagem('Produto desativado com sucesso!');
      carregarProdutos();
    } catch (error) {
      mostrarMensagem('Erro ao desativar produto', 'erro');
    }
  };

  if (modoEdicao) {
    return (
      <div className="tela-produtos">
        <div className="tela-header">
          <h2>{produtoEdicao ? '✏️ Editar Produto' : '➕ Novo Produto'}</h2>
          <button onClick={() => setModoEdicao(false)} className="btn-secondary">❌ Cancelar</button>
        </div>

        <form onSubmit={handleSubmit} className="form-produto">
          <div className="form-group">
            <label>Nome do Produto *</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Preço *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.preco}
                onChange={(e) => setFormData({...formData, preco: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Atração Vinculada</label>
              <select
                value={formData.atracao_id}
                onChange={(e) => setFormData({...formData, atracao_id: e.target.value})}
              >
                <option value="">Nenhuma</option>
                {atracoes.map(atracao => (
                  <option key={atracao.id} value={atracao.id}>
                    {atracao.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.atracao_id && (
            <div className="form-row">
              <div className="form-group">
                <label>Tipo de Comissão</label>
                <select
                  value={formData.tipo_comissao}
                  onChange={(e) => setFormData({...formData, tipo_comissao: e.target.value})}
                >
                  <option value="percentual">Percentual (%)</option>
                  <option value="fixo">Valor Fixo (R$)</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Valor da Comissão {formData.tipo_comissao === 'percentual' ? '(%)' : '(R$)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_comissao}
                  onChange={(e) => setFormData({...formData, valor_comissao: e.target.value})}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              rows="3"
            />
          </div>

          <button type="submit" className="btn-primary">
            {produtoEdicao ? '💾 Salvar Alterações' : '➕ Criar Produto'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="tela-produtos">
      <div className="tela-header">
        <h2>📦 Produtos</h2>
        <button onClick={() => abrirFormulario()} className="btn-primary">➕ Novo Produto</button>
      </div>

      {produtos.length === 0 ? (
        <div className="empty-state">
          <p>📭 Nenhum produto cadastrado</p>
        </div>
      ) : (
        <div className="produtos-grid">
          {produtos.map(produto => (
            <div key={produto.id} className="produto-card">
              <h3>{produto.nome}</h3>
              <p className="produto-preco">R$ {produto.preco.toFixed(2)}</p>
              {produto.descricao && <p className="produto-descricao">{produto.descricao}</p>}
              {produto.atracao_nome && (
                <div className="produto-atracao">
                  🏛️ {produto.atracao_nome}
                  {produto.valor_comissao > 0 && (
                    <span className="comissao-badge">
                      💼 {produto.tipo_comissao === 'percentual' 
                        ? `${produto.valor_comissao}%` 
                        : `R$ ${produto.valor_comissao}`}
                    </span>
                  )}
                </div>
              )}
              <div className="produto-acoes">
                <button onClick={() => abrirFormulario(produto)} className="btn-secondary">
                  ✏️ Editar
                </button>
                <button onClick={() => desativarProduto(produto.id)} className="btn-danger">
                  🗑️ Desativar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== TELA ATRAÇÕES ====================
function TelaAtracoes({ atracoes, carregarAtracoes, mostrarMensagem, setTela }) {
  const [modoEdicao, setModoEdicao] = useState(false);
  const [atracaoEdicao, setAtracaoEdicao] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    responsavel: '',
    telefone: '',
    email: ''
  });

  const abrirFormulario = (atracao = null) => {
    if (atracao) {
      setFormData({
        nome: atracao.nome,
        descricao: atracao.descricao || '',
        responsavel: atracao.responsavel || '',
        telefone: atracao.telefone || '',
        email: atracao.email || ''
      });
      setAtracaoEdicao(atracao);
    } else {
      setFormData({
        nome: '',
        descricao: '',
        responsavel: '',
        telefone: '',
        email: ''
      });
      setAtracaoEdicao(null);
    }
    setModoEdicao(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (atracaoEdicao) {
        await axios.put(`${API_URL}/atracoes/${atracaoEdicao.id}`, formData);
        mostrarMensagem('Atração atualizada com sucesso!');
      } else {
        await axios.post(`${API_URL}/atracoes`, formData);
        mostrarMensagem('Atração criada com sucesso!');
      }
      
      carregarAtracoes();
      setModoEdicao(false);
    } catch (error) {
      mostrarMensagem(error.response?.data?.error || 'Erro ao salvar atração', 'erro');
    }
  };

  const desativarAtracao = async (id) => {
    if (!window.confirm('Deseja realmente desativar esta atração?')) return;

    try {
      await axios.delete(`${API_URL}/atracoes/${id}`);
      mostrarMensagem('Atração desativada com sucesso!');
      carregarAtracoes();
    } catch (error) {
      mostrarMensagem('Erro ao desativar atração', 'erro');
    }
  };

  if (modoEdicao) {
    return (
      <div className="tela-atracoes">
        <div className="tela-header">
          <h2>{atracaoEdicao ? '✏️ Editar Atração' : '➕ Nova Atração'}</h2>
          <button onClick={() => setModoEdicao(false)} className="btn-secondary">❌ Cancelar</button>
        </div>

        <form onSubmit={handleSubmit} className="form-atracao">
          <div className="form-group">
            <label>Nome da Atração *</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Responsável</label>
            <input
              type="text"
              value={formData.responsavel}
              onChange={(e) => setFormData({...formData, responsavel: e.target.value})}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Telefone</label>
              <input
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({...formData, telefone: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary">
            {atracaoEdicao ? '💾 Salvar Alterações' : '➕ Criar Atração'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="tela-atracoes">
      <div className="tela-header">
        <h2>🏛️ Atrações</h2>
        <button onClick={() => abrirFormulario()} className="btn-primary">➕ Nova Atração</button>
      </div>

      {atracoes.length === 0 ? (
        <div className="empty-state">
          <p>📭 Nenhuma atração cadastrada</p>
        </div>
      ) : (
        <div className="atracoes-grid">
          {atracoes.map(atracao => (
            <div key={atracao.id} className="atracao-card">
              <h3>🏛️ {atracao.nome}</h3>
              {atracao.descricao && <p className="atracao-descricao">{atracao.descricao}</p>}
              
              {atracao.responsavel && (
                <p className="atracao-info">👤 {atracao.responsavel}</p>
              )}
              {atracao.telefone && (
                <p className="atracao-info">📱 {atracao.telefone}</p>
              )}
              {atracao.email && (
                <p className="atracao-info">📧 {atracao.email}</p>
              )}

              <div className="atracao-acoes">
                <button 
                  onClick={() => setTela(`atracao-${atracao.id}`)} 
                  className="btn-primary"
                >
                  📊 Ver Relatório
                </button>
                <button onClick={() => abrirFormulario(atracao)} className="btn-secondary">
                  ✏️ Editar
                </button>
                <button onClick={() => desativarAtracao(atracao.id)} className="btn-danger">
                  🗑️ Desativar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== TELA PEDIDOS YAMPI ====================
function TelaPedidosYampi({ mostrarMensagem }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

  useEffect(() => {
    carregarPedidos();
  }, []);

  const carregarPedidos = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/yampi/pedidos`);
      setPedidos(res.data.pedidos || []);
    } catch (error) {
      mostrarMensagem('Erro ao carregar pedidos', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const res = await axios.post(`${API_URL}/yampi/sincronizar`, {
        limit: 50
      });
      
      if (res.data.sucesso) {
        mostrarMensagem(
          `✅ Sincronizado! ${res.data.novos} novos, ${res.data.atualizados} atualizados`
        );
        carregarPedidos();
      } else {
        mostrarMensagem('Erro na sincronização', 'erro');
      }
    } catch (error) {
      mostrarMensagem(error.response?.data?.error || 'Erro ao sincronizar', 'erro');
    } finally {
      setSincronizando(false);
    }
  };

  const verDetalhes = async (pedidoId) => {
    try {
      const res = await axios.get(`${API_URL}/yampi/pedidos/${pedidoId}`);
      setPedidoSelecionado(res.data);
    } catch (error) {
      mostrarMensagem('Erro ao carregar detalhes', 'erro');
    }
  };

  if (pedidoSelecionado) {
    return (
      <div className="tela-pedidos-yampi">
        <div className="tela-header">
          <h2>📦 Detalhes do Pedido #{pedidoSelecionado.pedido.numero_pedido}</h2>
          <button onClick={() => setPedidoSelecionado(null)} className="btn-secondary">
            ← Voltar
          </button>
        </div>

        <div className="pedido-detalhes">
          <div className="info-card">
            <h3>Informações do Pedido</h3>
            <p><strong>Cliente:</strong> {pedidoSelecionado.pedido.cliente_nome}</p>
            <p><strong>Email:</strong> {pedidoSelecionado.pedido.cliente_email}</p>
            <p><strong>Status Financeiro:</strong> {pedidoSelecionado.pedido.status_financeiro}</p>
            <p><strong>Status Entrega:</strong> {pedidoSelecionado.pedido.status_entrega}</p>
            <p><strong>Valor Total:</strong> R$ {pedidoSelecionado.pedido.valor_total.toFixed(2)}</p>
            <p><strong>Data:</strong> {new Date(pedidoSelecionado.pedido.data_pedido).toLocaleString('pt-BR')}</p>
          </div>

          <div className="itens-pedido">
            <h3>Itens do Pedido</h3>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th>Qtd</th>
                  <th>Preço Unit.</th>
                  <th>Total</th>
                  <th>Classificado</th>
                </tr>
              </thead>
              <tbody>
                {pedidoSelecionado.itens.map(item => (
                  <tr key={item.id}>
                    <td>{item.produto_yampi_nome}</td>
                    <td>{item.sku}</td>
                    <td>{item.quantidade}</td>
                    <td>R$ {item.preco_unitario.toFixed(2)}</td>
                    <td>R$ {item.valor_total.toFixed(2)}</td>
                    <td>{item.classificado ? '✅' : '⏳'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading">⏳ Carregando...</div>;

  return (
    <div className="tela-pedidos-yampi">
      <div className="tela-header">
        <h2>🛒 Pedidos Yampi</h2>
        <button 
          onClick={sincronizar} 
          disabled={sincronizando}
          className="btn-primary"
        >
          {sincronizando ? '⏳ Sincronizando...' : '🔄 Sincronizar Pedidos'}
        </button>
      </div>

      {pedidos.length === 0 ? (
        <div className="empty-state">
          <p>📭 Nenhum pedido sincronizado</p>
          <p>Clique em "Sincronizar Pedidos" para importar</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Status Financeiro</th>
                <th>Status Entrega</th>
                <th>Valor</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map(pedido => (
                <tr key={pedido.id}>
                  <td>#{pedido.numero_pedido}</td>
                  <td>{pedido.cliente_nome}</td>
                  <td>
                    <span className={`badge badge-${pedido.status_financeiro}`}>
                      {pedido.status_financeiro}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${pedido.status_entrega}`}>
                      {pedido.status_entrega}
                    </span>
                  </td>
                  <td>R$ {pedido.valor_total.toFixed(2)}</td>
                  <td>{new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <button 
                      onClick={() => verDetalhes(pedido.id)}
                      className="btn-secondary btn-small"
                    >
                      👁️ Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== TELA CLASSIFICAÇÃO ====================
function TelaClassificacao({ produtos, atracoes, mostrarMensagem }) {
  const [itensNaoClassificados, setItensNaoClassificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classificacoes, setClassificacoes] = useState({});

  useEffect(() => {
    carregarItens();
  }, []);

  const carregarItens = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/yampi/itens-nao-classificados`);
      setItensNaoClassificados(res.data);
      
      // Inicializar classificações vazias
      const novasClassificacoes = {};
      res.data.forEach(item => {
        novasClassificacoes[item.id] = { produto_id: '', atracao_id: '' };
      });
      setClassificacoes(novasClassificacoes);
    } catch (error) {
      mostrarMensagem('Erro ao carregar itens', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const atualizarClassificacao = (itemId, campo, valor) => {
    setClassificacoes(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [campo]: valor
      }
    }));
  };

  const salvarClassificacao = async (itemId) => {
    const classificacao = classificacoes[itemId];

    if (!classificacao.produto_id || !classificacao.atracao_id) {
      mostrarMensagem('Selecione produto e atração', 'erro');
      return;
    }

    try {
      await axios.put(`${API_URL}/yampi/itens/${itemId}/classificar`, classificacao);
      mostrarMensagem('Item classificado com sucesso!');
      carregarItens();
    } catch (error) {
      mostrarMensagem('Erro ao classificar item', 'erro');
    }
  };

  if (loading) return <div className="loading">⏳ Carregando...</div>;

  return (
    <div className="tela-classificacao">
      <div className="tela-header">
        <h2>📋 Classificação de Itens</h2>
        <div className="contador-pendentes">
          {itensNaoClassificados.length} itens pendentes
        </div>
      </div>

      {itensNaoClassificados.length === 0 ? (
        <div className="empty-state">
          <p>✅ Todos os itens estão classificados!</p>
        </div>
      ) : (
        <div className="classificacao-list">
          {itensNaoClassificados.map(item => (
            <div key={item.id} className="classificacao-card">
              <div className="item-info">
                <h4>{item.produto_yampi_nome}</h4>
                <p>Pedido: #{item.numero_pedido}</p>
                <p>Cliente: {item.cliente_nome}</p>
                <p>Quantidade: {item.quantidade}</p>
                <p>Valor: R$ {item.valor_total.toFixed(2)}</p>
              </div>

              <div className="classificacao-form">
                <div className="form-group">
                  <label>Produto Interno</label>
                  <select
                    value={classificacoes[item.id]?.produto_id || ''}
                    onChange={(e) => atualizarClassificacao(item.id, 'produto_id', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {produtos.map(produto => (
                      <option key={produto.id} value={produto.id}>
                        {produto.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Atração</label>
                  <select
                    value={classificacoes[item.id]?.atracao_id || ''}
                    onChange={(e) => atualizarClassificacao(item.id, 'atracao_id', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {atracoes.map(atracao => (
                      <option key={atracao.id} value={atracao.id}>
                        {atracao.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={() => salvarClassificacao(item.id)}
                  className="btn-primary btn-small"
                  disabled={!classificacoes[item.id]?.produto_id || !classificacoes[item.id]?.atracao_id}
                >
                  💾 Salvar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== TELA RELATÓRIO ATRAÇÃO ====================
function TelaRelatorioAtracao({ atracaoId, setTela, mostrarMensagem }) {
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    carregarRelatorio();
  }, [atracaoId, dataInicio, dataFim]);

  const carregarRelatorio = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.append('dataInicio', dataInicio);
      if (dataFim) params.append('dataFim', dataFim);

      const res = await axios.get(`${API_URL}/atracoes/${atracaoId}/relatorio?${params}`);
      setRelatorio(res.data);
    } catch (error) {
      mostrarMensagem('Erro ao carregar relatório', 'erro');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">⏳ Carregando...</div>;
  if (!relatorio) return null;

  return (
    <div className="tela-relatorio-atracao">
      <div className="tela-header">
        <h2>📊 Relatório - {relatorio.atracao.nome}</h2>
        <button onClick={() => setTela('atracoes')} className="btn-secondary">
          ← Voltar
        </button>
      </div>

      <div className="filtros-relatorio">
        <div className="form-group">
          <label>Data Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Data Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
        <button onClick={() => { setDataInicio(''); setDataFim(''); }} className="btn-secondary">
          🔄 Limpar
        </button>
      </div>

      <div className="resumo-financeiro">
        <div className="resumo-card faturamento">
          <h3>💰 Faturamento Total</h3>
          <p className="valor-grande">R$ {relatorio.resumo.faturamentoTotal.toFixed(2)}</p>
        </div>
        <div className="resumo-card comissao">
          <h3>💼 Comissão (Plataforma)</h3>
          <p className="valor-grande">R$ {relatorio.resumo.comissaoTotal.toFixed(2)}</p>
        </div>
        <div className="resumo-card liquido">
          <h3>💵 Valor Líquido (Atração)</h3>
          <p className="valor-grande destaque">R$ {relatorio.resumo.valorLiquido.toFixed(2)}</p>
        </div>
      </div>

      <div className="detalhes-vendas">
        <h3>📋 Detalhamento das Vendas ({relatorio.resumo.totalItens} itens)</h3>
        
        {relatorio.itens.length === 0 ? (
          <p>Nenhuma venda no período selecionado</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Faturamento</th>
                <th>Comissão</th>
                <th>Líquido</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.itens.map(item => {
                let comissao = 0;
                if (item.tipo_comissao && item.valor_comissao) {
                  if (item.tipo_comissao === 'percentual') {
                    comissao = (item.valor_total * item.valor_comissao) / 100;
                  } else {
                    comissao = item.valor_comissao * item.quantidade;
                  }
                }
                const liquido = item.valor_total - comissao;

                return (
                  <tr key={item.id}>
                    <td>{new Date(item.data_pedido).toLocaleDateString('pt-BR')}</td>
                    <td>#{item.numero_pedido}</td>
                    <td>{item.cliente_nome}</td>
                    <td>{item.produto_interno_nome || item.produto_yampi_nome}</td>
                    <td>{item.quantidade}</td>
                    <td>R$ {item.valor_total.toFixed(2)}</td>
                    <td>R$ {comissao.toFixed(2)}</td>
                    <td>R$ {liquido.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ==================== TELA OPERADORES (ATUALIZADO) ====================
function TelaOperadores({ atracoes, mostrarMensagem }) {  // ← MODIFICADO: adicionado atracoes
  const [operadores, setOperadores] = useState([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    username: '',
    password: '',
    permissao: 'usuario',
    atracao_id: ''  // ← ADICIONADO
  });

  useEffect(() => {
    carregarOperadores();
  }, []);

  const carregarOperadores = async () => {
    try {
      const res = await axios.get(`${API_URL}/operadores`);
      setOperadores(res.data);
    } catch (error) {
      mostrarMensagem('Erro ao carregar operadores', 'erro');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.post(`${API_URL}/operadores`, formData);
      mostrarMensagem('Operador criado com sucesso!');
      carregarOperadores();
      setModoEdicao(false);
      setFormData({ nome: '', username: '', password: '', permissao: 'usuario', atracao_id: '' });
    } catch (error) {
      mostrarMensagem(error.response?.data?.error || 'Erro ao criar operador', 'erro');
    }
  };

  const desativarOperador = async (id) => {
    if (!window.confirm('Deseja realmente desativar este operador?')) return;

    try {
      await axios.delete(`${API_URL}/operadores/${id}`);
      mostrarMensagem('Operador desativado com sucesso!');
      carregarOperadores();
    } catch (error) {
      mostrarMensagem('Erro ao desativar operador', 'erro');
    }
  };

  if (modoEdicao) {
    return (
      <div className="tela-operadores">
        <div className="tela-header">
          <h2>➕ Novo Operador</h2>
          <button onClick={() => setModoEdicao(false)} className="btn-secondary">❌ Cancelar</button>
        </div>

        <form onSubmit={handleSubmit} className="form-operador">
          <div className="form-group">
            <label>Nome Completo *</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Usuário (Login) *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Senha *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Permissão</label>
            <select
              value={formData.permissao}
              onChange={(e) => setFormData({...formData, permissao: e.target.value})}
            >
              <option value="usuario">Usuário</option>
              <option value="admin">Administrador</option>
              <option value="atracao">Atração</option>  {/* ← ADICIONADO */}
            </select>
          </div>

          {/* ========== NOVO BLOCO: Seleção de atração ========== */}
          {formData.permissao === 'atracao' && (
            <div className="form-group">
              <label>Atração Vinculada *</label>
              <select
                value={formData.atracao_id}
                onChange={(e) => setFormData({...formData, atracao_id: e.target.value})}
                required
              >
                <option value="">Selecione uma atração</option>
                {atracoes.map(atracao => (
                  <option key={atracao.id} value={atracao.id}>
                    {atracao.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* ========== FIM DO BLOCO NOVO ========== */}

          <button type="submit" className="btn-primary">➕ Criar Operador</button>
        </form>
      </div>
    );
  }

  return (
    <div className="tela-operadores">
      <div className="tela-header">
        <h2>👥 Operadores</h2>
        <button onClick={() => setModoEdicao(true)} className="btn-primary">➕ Novo Operador</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Usuário</th>
              <th>Permissão</th>
              <th>Atração</th>  {/* ← ADICIONADO */}
              <th>Status</th>
              <th>Cadastro</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {operadores.map(op => (
              <tr key={op.id}>
                <td>{op.nome}</td>
                <td>{op.username}</td>
                <td>
                  <span className={`badge badge-${op.permissao}`}>
                    {op.permissao === 'admin' && '👑 Admin'}
                    {op.permissao === 'usuario' && '👤 Usuário'}
                    {op.permissao === 'atracao' && '🏛️ Atração'}  {/* ← ADICIONADO */}
                  </span>
                </td>
                <td>{op.atracao_nome || '-'}</td>  {/* ← ADICIONADO */}
                <td>{op.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
                <td>{new Date(op.created_at).toLocaleDateString('pt-BR')}</td>
                <td>
                  {op.ativo && (
                    <button 
                      onClick={() => desativarOperador(op.id)}
                      className="btn-danger btn-small"
                    >
                      🗑️ Desativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
// ============= TELA PARA USUÁRIO DE ATRAÇÃO =============
// Adicione este componente no App.js do frontend

function TelaUsuarioAtracao({ usuario, mostrarMensagem }) {
  const [atracao, setAtracao] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [abaSelecionada, setAbaSelecionada] = useState('relatorio'); // 'relatorio' ou 'pedidos'

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar dados da atração
      const resAtracao = await axios.get(`${API_URL}/minha-atracao`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAtracao(resAtracao.data);

      // Carregar relatório
      await carregarRelatorio();

      // Carregar pedidos
      await carregarPedidos();

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      mostrarMensagem(error.response?.data?.error || 'Erro ao carregar dados', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const carregarRelatorio = async () => {
    try {
      const params = {};
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;

      const res = await axios.get(`${API_URL}/minha-atracao/relatorio`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params
      });
      setRelatorio(res.data);
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
    }
  };

  const carregarPedidos = async () => {
    try {
      const res = await axios.get(`${API_URL}/minha-atracao/pedidos`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { limit: 50 }
      });
      setPedidos(res.data.pedidos || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    }
  };

  const aplicarFiltro = () => {
    carregarRelatorio();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <h2>Carregando...</h2>
      </div>
    );
  }

  if (!atracao) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <h2>❌ Erro</h2>
        <p>Você não está vinculado a nenhuma atração.</p>
        <p>Entre em contato com o administrador.</p>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header com Info da Atração */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white', 
        padding: '30px',
        borderRadius: '12px',
        marginBottom: '30px'
      }}>
        <h1 style={{ margin: 0, fontSize: '32px' }}>🏛️ {atracao.nome}</h1>
        <p style={{ margin: '10px 0 0 0', fontSize: '18px', opacity: 0.9 }}>
          {atracao.descricao || 'Painel da Atração'}
        </p>
        {atracao.responsavel && (
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
            Responsável: {atracao.responsavel}
          </p>
        )}
      </div>

      {/* Abas */}
      <div style={{ marginBottom: '30px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setAbaSelecionada('relatorio')}
          style={{
            padding: '12px 30px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: abaSelecionada === 'relatorio' 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
              : '#ecf0f1',
            color: abaSelecionada === 'relatorio' ? 'white' : '#2c3e50',
            transition: 'all 0.3s'
          }}
        >
          📊 Relatório Financeiro
        </button>
        <button
          onClick={() => setAbaSelecionada('pedidos')}
          style={{
            padding: '12px 30px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: abaSelecionada === 'pedidos' 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
              : '#ecf0f1',
            color: abaSelecionada === 'pedidos' ? 'white' : '#2c3e50',
            transition: 'all 0.3s'
          }}
        >
          🛒 Meus Pedidos
        </button>
      </div>

      {/* ABA RELATÓRIO */}
      {abaSelecionada === 'relatorio' && relatorio && (
        <>
          {/* Filtros de Data */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            gap: '15px',
            alignItems: 'end',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <button
              onClick={aplicarFiltro}
              style={{
                padding: '10px 30px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🔍 Filtrar
            </button>
          </div>

          {/* Cards de Resumo */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            {/* Faturamento Total */}
            <div style={{
              background: 'white',
              padding: '25px',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '16px', color: '#7f8c8d', margin: '0 0 15px 0' }}>
                💰 Faturamento Total
              </h3>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3498db', margin: '10px 0' }}>
                R$ {relatorio.resumo.faturamentoTotal.toFixed(2)}
              </div>
            </div>

            {/* Comissão */}
            <div style={{
              background: 'white',
              padding: '25px',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '16px', color: '#7f8c8d', margin: '0 0 15px 0' }}>
                💼 Comissão (Plataforma)
              </h3>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f39c12', margin: '10px 0' }}>
                R$ {relatorio.resumo.comissaoTotal.toFixed(2)}
              </div>
            </div>

            {/* Valor Líquido */}
            <div style={{
              background: 'white',
              padding: '25px',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '16px', color: '#7f8c8d', margin: '0 0 15px 0' }}>
                💵 Valor Líquido (Você)
              </h3>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#27ae60', margin: '10px 0' }}>
                R$ {relatorio.resumo.liquidoTotal.toFixed(2)}
              </div>
            </div>
          </div>
            {/* Card de Origem dos Pedidos */}
<div style={{
  background: 'white',
  padding: '25px',
  borderRadius: '12px',
  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
  textAlign: 'center'
}}>
  <h3 style={{ fontSize: '16px', color: '#7f8c8d', margin: '0 0 15px 0' }}>
    📊 Origem dos Pedidos
  </h3>
  <div style={{ fontSize: '16px', color: '#2c3e50', margin: '10px 0' }}>
    🛒 Yampi: <strong>{relatorio.resumo.itensYampi || 0}</strong>
  </div>
  <div style={{ fontSize: '16px', color: '#2c3e50', margin: '10px 0' }}>
    🎟️ PDV: <strong>{relatorio.resumo.itensPDV || 0}</strong>
  </div>
</div>

          {/* Tabela de Detalhes */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '25px' }}>
            <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>
              📋 Detalhamento de Vendas ({relatorio.itens.length} itens)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}>
                  <tr>
                    <th style={{ padding: '15px', textAlign: 'left' }}>Data</th>
                    <th style={{ padding: '15px', textAlign: 'left' }}>Pedido</th>
                    <th style={{ padding: '15px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '15px', textAlign: 'left' }}>Produto</th>
                    <th style={{ padding: '15px', textAlign: 'center' }}>Origem</th>
                    <th style={{ padding: '15px', textAlign: 'center' }}>Qtd</th>
                    <th style={{ padding: '15px', textAlign: 'right' }}>Faturamento</th>
                    <th style={{ padding: '15px', textAlign: 'right' }}>Comissão</th>
                    <th style={{ padding: '15px', textAlign: 'right' }}>Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.itens.map((item, index) => (
                    <tr key={index} style={{
                      borderBottom: '1px solid #ecf0f1',
                      background: index % 2 === 0 ? 'white' : '#f8f9fa'
                    }}>
                      <td style={{ padding: '15px' }}>
                        {item.data_pedido ? new Date(item.data_pedido).toLocaleDateString('pt-BR') : 'N/A'}
                      </td>
                      <td style={{ padding: '15px' }}>#{item.numero_pedido}</td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
  {item.origem === 'yampi' ? (
    <span style={{
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 'bold',
      background: '#3498db',
      color: 'white'
    }}>
      🛒 Yampi
    </span>
  ) : (
    <span style={{
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 'bold',
      background: '#27ae60',
      color: 'white'
    }}>
      🎟️ PDV
    </span>
  )}
</td>
                      <td style={{ padding: '15px' }}>{item.cliente_nome}</td>
                      <td style={{ padding: '15px' }}>{item.produto_nome || item.produto_yampi_nome}</td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>{item.quantidade}</td>
                      <td style={{ padding: '15px', textAlign: 'right', color: '#3498db', fontWeight: 'bold' }}>
                        R$ {item.faturamento.toFixed(2)}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right', color: '#f39c12', fontWeight: 'bold' }}>
                        R$ {item.comissao.toFixed(2)}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right', color: '#27ae60', fontWeight: 'bold' }}>
                        R$ {item.liquido.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ABA PEDIDOS */}
      {abaSelecionada === 'pedidos' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '25px' }}>
          <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>
            🛒 Meus Pedidos ({pedidos.length})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
              }}>
                <tr>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Pedido</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Data</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Cliente</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Itens</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Produtos</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>Valor Total</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Origem</th> {/* ADICIONAR */}
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido, index) => (
                  <tr key={pedido.id} style={{
                    borderBottom: '1px solid #ecf0f1',
                    background: index % 2 === 0 ? 'white' : '#f8f9fa'
                  }}>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>#{pedido.numero_pedido}</td>
                    <td style={{ padding: '15px' }}>
                      {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '15px' }}>{pedido.cliente_nome}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>{pedido.total_itens}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>{pedido.total_produtos}</td>
                    <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#27ae60' }}>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
  {pedido.origem === 'yampi' ? '🛒 Yampi' : '🎟️ PDV'}
</td>
                      R$ {parseFloat(pedido.valor_total_itens || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '15px' }}>
                      <span style={{
                        padding: '5px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: '#27ae60',
                        color: 'white'
                      }}>
                        {pedido.status_financeiro}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


// ==================== TELA CONFIGURAÇÕES ====================
function TelaConfiguracoes({ mostrarMensagem }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testando, setTestando] = useState(false);

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      const res = await axios.get(`${API_URL}/configuracoes`);
      setConfigs(res.data);
    } catch (error) {
      mostrarMensagem('Erro ao carregar configurações', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const atualizarConfig = async (chave, valor) => {
    try {
      await axios.put(`${API_URL}/configuracoes/${chave}`, { valor });
      mostrarMensagem('Configuração salva!');
    } catch (error) {
      mostrarMensagem('Erro ao salvar configuração', 'erro');
    }
  };

  const testarConexaoYampi = async () => {
    setTestando(true);
    try {
      const res = await axios.post(`${API_URL}/yampi/testar-conexao`);
      
      if (res.data.sucesso) {
        mostrarMensagem(`✅ ${res.data.mensagem} - ${res.data.dados.produtosEncontrados} produtos encontrados`);
      } else {
        mostrarMensagem('❌ Falha na conexão com Yampi', 'erro');
      }
    } catch (error) {
      mostrarMensagem('Erro ao testar conexão', 'erro');
    } finally {
      setTestando(false);
    }
  };

  if (loading) return <div className="loading">⏳ Carregando...</div>;

  const configsEvoAPI = configs.filter(c => c.chave.startsWith('evoapi_') || c.chave === 'whatsapp_mensagem' || c.chave === 'whatsapp_ativo');
  const configsYampi = configs.filter(c => c.chave.startsWith('yampi_'));

  return (
    <div className="tela-configuracoes">
      <h2>⚙️ Configurações do Sistema</h2>

      <div className="config-section">
        <h3>📱 Configurações EvoAPI (WhatsApp)</h3>
        {configsEvoAPI.map(config => (
          <div key={config.id} className="config-item">
            <label>{config.descricao}</label>
            {config.chave === 'whatsapp_mensagem' ? (
              <textarea
                defaultValue={config.valor}
                onBlur={(e) => atualizarConfig(config.chave, e.target.value)}
                rows="4"
              />
            ) : config.chave === 'whatsapp_ativo' ? (
              <select
                value={config.valor}
                onChange={(e) => atualizarConfig(config.chave, e.target.value)}
              >
                <option value="1">Ativado</option>
                <option value="0">Desativado</option>
              </select>
            ) : (
              <input
                type="text"
                defaultValue={config.valor}
                onBlur={(e) => atualizarConfig(config.chave, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="config-section">
        <h3>🛒 Configurações Yampi</h3>
        {configsYampi.map(config => (
          <div key={config.id} className="config-item">
            <label>{config.descricao}</label>
            {config.chave === 'yampi_sync_ativo' ? (
              <select
                value={config.valor}
                onChange={(e) => atualizarConfig(config.chave, e.target.value)}
              >
                <option value="1">Ativado</option>
                <option value="0">Desativado</option>
              </select>
            ) : (
              <input
                type={config.chave.includes('secret') || config.chave.includes('token') ? 'password' : 'text'}
                defaultValue={config.valor}
                onBlur={(e) => atualizarConfig(config.chave, e.target.value)}
                placeholder={config.descricao}
              />
            )}
          </div>
        ))}
        
        <button 
          onClick={testarConexaoYampi}
          disabled={testando}
          className="btn-primary"
        >
          {testando ? '⏳ Testando...' : '🔌 Testar Conexão Yampi'}
        </button>
      </div>
    </div>
  );
}

export default App;


