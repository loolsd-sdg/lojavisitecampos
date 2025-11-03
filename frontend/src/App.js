import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://148.230.76.31:3001/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [tela, setTela] = useState('venda');

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.permissao === 'admin';

  if (!token) {
    return <TelaLogin setToken={setToken} setUser={setUser} />;
  }

  return (
    <div className="App">
      <header className="header">
        <h1>🎫 PDV Visite Campos</h1>
        <div className="user-info">
          <span>👤 {user?.nome}</span>
          <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-user'}`}>
            {isAdmin ? '👑 Admin' : '👨‍💼 Usuário'}
          </span>
          <button onClick={handleLogout} className="btn-logout">Sair</button>
        </div>
      </header>

      <nav className="nav-menu">
        <button 
          className={tela === 'venda' ? 'active' : ''} 
          onClick={() => setTela('venda')}
        >
          🛒 Nova Venda
        </button>
        
        {isAdmin && (
          <>
            <button 
              className={tela === 'produtos' ? 'active' : ''} 
              onClick={() => setTela('produtos')}
            >
              📦 Produtos
            </button>
            <button 
              className={tela === 'operadores' ? 'active' : ''} 
              onClick={() => setTela('operadores')}
            >
              👥 Operadores
            </button>
          </>
        )}
        
        <button 
          className={tela === 'historico' ? 'active' : ''} 
          onClick={() => setTela('historico')}
        >
          📊 Histórico
        </button>

        <button 
          className={tela === 'ranking' ? 'active' : ''} 
          onClick={() => setTela('ranking')}
        >
          🏆 Ranking
        </button>
      </nav>

      <main className="main-content">
        {tela === 'venda' && <TelaVenda />}
        {tela === 'produtos' && isAdmin && <TelaProdutos />}
        {tela === 'historico' && <TelaHistorico isAdmin={isAdmin} />}
        {tela === 'operadores' && isAdmin && <TelaOperadores />}
        {tela === 'ranking' && <TelaRanking />}
      </main>
    </div>
  );
}

// ============= TELA DE LOGIN =============
function TelaLogin({ setToken, setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/login`, { username, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.operador));
      setToken(response.data.token);
      setUser(response.data.operador);
    } catch (error) {
      setErro(error.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🎫 Visite Campos</h1>
        <h2>Sistema PDV</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Usuário"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {erro && <div className="erro">{erro}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============= TELA DE VENDA =============
function TelaVenda() {
  const [nomeCliente, setNomeCliente] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [quantidadePessoas, setQuantidadePessoas] = useState(1);
  const [desconto, setDesconto] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState('real');
  const [vendaOnline, setVendaOnline] = useState(false);
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const userLogado = JSON.parse(localStorage.getItem('user'));
  const isAdmin = userLogado?.permissao === 'admin';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      carregarProdutos();
    }
  }, []);

  const carregarProdutos = async () => {
    try {
      const response = await axios.get(`${API_URL}/produtos`);
      setProdutos(response.data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      if (error.response && error.response.status !== 401) {
        alert('Erro ao carregar produtos');
      }
    }
  };

  const produtoSelecionado = produtos.find(p => p.id === parseInt(produtoId));
  const subtotal = produtoSelecionado ? produtoSelecionado.preco * quantidadePessoas : 0;
  
  let valorDesconto = 0;
  if (desconto && parseFloat(desconto) > 0) {
    if (tipoDesconto === 'percentual') {
      valorDesconto = (subtotal * parseFloat(desconto)) / 100;
    } else {
      valorDesconto = parseFloat(desconto);
    }
  }
  
  const total = subtotal - valorDesconto;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensagem('');

    // Validar telefone obrigatório
    if (!telefoneCliente) {
      alert('Por favor, informe o telefone do cliente');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/vendas`, {
        nome_cliente: nomeCliente,
        produto_id: parseInt(produtoId),
        quantidade_pessoas: parseInt(quantidadePessoas),
        desconto: valorDesconto,
        tipo_desconto: desconto ? tipoDesconto : null,
        venda_online: vendaOnline,
        telefone_cliente: telefoneCliente
      });

      // Baixar PDF
      const pdfResponse = await axios.get(`${API_URL}/vendas/${response.data.id}/pdf`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([pdfResponse.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ingresso_${response.data.codigo_venda}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setMensagem(`✅ Venda #${response.data.codigo_venda} realizada com sucesso!`);
      
      // Limpar formulário
      setNomeCliente('');
      setProdutoId('');
      setQuantidadePessoas(1);
      setDesconto('');
      setVendaOnline(false);
      setTelefoneCliente('');
      
      setTimeout(() => setMensagem(''), 5000);
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao registrar venda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tela-venda">
      <h2>🛒 Nova Venda</h2>
      
      {mensagem && <div className="mensagem-sucesso">{mensagem}</div>}

      <form onSubmit={handleSubmit} className="form-venda">
        {isAdmin && (
          <div className="form-group-checkbox">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={vendaOnline}
                onChange={(e) => setVendaOnline(e.target.checked)}
              />
              <span className="checkbox-text">🌐 Venda Online</span>
            </label>
          </div>
        )}

        <div className="form-group">
          <label>Nome do Cliente *</label>
          <input
            type="text"
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            required
            placeholder="Digite o nome do cliente"
          />
        </div>

        <div className="form-group">
          <label>Telefone do Cliente (com DDD) *</label>
          <input
            type="tel"
            value={telefoneCliente}
            onChange={(e) => setTelefoneCliente(e.target.value)}
            required
            placeholder="Ex: 22999887766"
            pattern="[0-9]{10,11}"
          />
          <small style={{ color: '#666', fontSize: '0.85rem' }}>
            Digite apenas números (ex: 22999887766)
          </small>
        </div>

        <div className="form-group">
          <label>Produto *</label>
          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            required
          >
            <option value="">Selecione um produto</option>
            {produtos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nome} - R$ {p.preco.toFixed(2)} por pessoa
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Quantidade de Pessoas *</label>
          <input
            type="number"
            min="1"
            value={quantidadePessoas}
            onChange={(e) => setQuantidadePessoas(e.target.value)}
            required
          />
        </div>

        {produtoSelecionado && (
          <div className="resumo-valores">
            <div className="linha-valor">
              <span>Subtotal:</span>
              <span className="valor">R$ {subtotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="desconto-section">
          <h3>Desconto (opcional)</h3>
          <div className="desconto-inputs">
            <div className="form-group">
              <label>Tipo de Desconto</label>
              <select
                value={tipoDesconto}
                onChange={(e) => setTipoDesconto(e.target.value)}
              >
                <option value="real">R$ (Reais)</option>
                <option value="percentual">% (Porcentagem)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Valor do Desconto</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                placeholder={tipoDesconto === 'real' ? '0.00' : '0'}
              />
            </div>
          </div>
          
          {desconto && parseFloat(desconto) > 0 && (
            <div className="resumo-valores">
              <div className="linha-valor desconto">
                <span>Desconto:</span>
                <span className="valor">- R$ {valorDesconto.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {produtoSelecionado && (
          <div className="total-final">
            <span>TOTAL:</span>
            <span className="valor-total">R$ {total.toFixed(2)}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-finalizar">
          {loading ? 'Processando...' : vendaOnline ? '🌐 Finalizar Venda Online' : '✅ Finalizar Venda'}
        </button>
      </form>
    </div>
  );
}

// ============= TELA DE PRODUTOS =============
function TelaProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    carregarProdutos();
  }, []);

  const carregarProdutos = async () => {
    try {
      const response = await axios.get(`${API_URL}/produtos`);
      setProdutos(response.data);
    } catch (error) {
      alert('Erro ao carregar produtos');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editando) {
        await axios.put(`${API_URL}/produtos/${editando}`, { nome, preco, descricao });
        alert('Produto atualizado com sucesso!');
      } else {
        await axios.post(`${API_URL}/produtos`, { nome, preco, descricao });
        alert('Produto cadastrado com sucesso!');
      }
      setNome('');
      setPreco('');
      setDescricao('');
      setEditando(null);
      setShowForm(false);
      carregarProdutos();
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao salvar produto');
    }
  };

  const handleEditar = (produto) => {
    setEditando(produto.id);
    setNome(produto.nome);
    setPreco(produto.preco);
    setDescricao(produto.descricao);
    setShowForm(true);
  };

  const handleDesativar = async (id) => {
    if (window.confirm('Deseja realmente desativar este produto?')) {
      try {
        await axios.delete(`${API_URL}/produtos/${id}`);
        alert('Produto desativado!');
        carregarProdutos();
      } catch (error) {
        alert('Erro ao desativar produto');
      }
    }
  };

  const cancelarEdicao = () => {
    setNome('');
    setPreco('');
    setDescricao('');
    setEditando(null);
    setShowForm(false);
  };

  return (
    <div className="tela-produtos">
      <div className="header-section">
        <h2>📦 Produtos</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-novo">
          {showForm ? '❌ Cancelar' : '➕ Novo Produto'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-produto">
          <h3>{editando ? '✏️ Editar Produto' : '➕ Novo Produto'}</h3>
          <div className="form-group">
            <label>Nome do Produto *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Preço por Pessoa *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows="3"
            />
          </div>
          <div className="form-buttons">
            <button type="submit" className="btn-salvar">
              💾 {editando ? 'Atualizar' : 'Salvar'} Produto
            </button>
            {editando && (
              <button type="button" onClick={cancelarEdicao} className="btn-cancelar">
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      <div className="lista-produtos">
        {produtos.map(produto => (
          <div key={produto.id} className="card-produto">
            <h3>{produto.nome}</h3>
            <p className="preco">R$ {produto.preco.toFixed(2)} <span>por pessoa</span></p>
            {produto.descricao && <p className="descricao">{produto.descricao}</p>}
            <div className="card-actions">
              <button onClick={() => handleEditar(produto)} className="btn-editar">
                ✏️ Editar
              </button>
              <button onClick={() => handleDesativar(produto.id)} className="btn-desativar">
                🗑️ Desativar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============= TELA DE HISTÓRICO =============
function TelaHistorico({ isAdmin }) {
  const [vendas, setVendas] = useState([]);

  useEffect(() => {
    carregarVendas();
  }, []);

  const carregarVendas = async () => {
    try {
      const response = await axios.get(`${API_URL}/vendas`);
      setVendas(response.data);
    } catch (error) {
      alert('Erro ao carregar histórico');
    }
  };

  const baixarPDF = async (id, codigo) => {
    try {
      const response = await axios.get(`${API_URL}/vendas/${id}/pdf`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ingresso_${codigo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Erro ao baixar PDF');
    }
  };

  const enviarWhatsApp = (telefone, nomeCliente, codigo) => {
    const mensagem = `Olá ${nomeCliente}! Segue seu ingresso #${codigo}. Obrigado pela compra!`;
    const url = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  const deletarVenda = async (id) => {
    if (window.confirm('Deseja realmente excluir esta venda? Esta ação não pode ser desfeita!')) {
      try {
        await axios.delete(`${API_URL}/vendas/${id}`);
        alert('Venda excluída com sucesso!');
        carregarVendas();
      } catch (error) {
        alert(error.response?.data?.error || 'Erro ao excluir venda');
      }
    }
  };

  return (
    <div className="tela-historico">
      <h2>📊 Histórico de Vendas</h2>
      
      <div className="tabela-container">
        <table className="tabela-vendas">
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Produto</th>
              <th>Pessoas</th>
              <th>Total</th>
              <th>Vendedor</th>
              <th>Tipo</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map(venda => (
              <tr key={venda.id} className={venda.venda_online ? 'venda-online' : ''}>
                <td>#{venda.codigo_venda}</td>
                <td>{venda.nome_cliente}</td>
                <td>{venda.produto_nome}</td>
                <td>{venda.quantidade_pessoas}</td>
                <td>R$ {venda.valor_total.toFixed(2)}</td>
                <td>{venda.operador_nome}</td>
                <td>
                  {venda.venda_online ? (
                    <span className="badge-online">🌐 Online</span>
                  ) : (
                    <span className="badge-presencial">🏪 Presencial</span>
                  )}
                </td>
                <td>{new Date(venda.created_at).toLocaleString('pt-BR')}</td>
                <td>
                  <div className="acoes-vendas">
                    <button
                      onClick={() => baixarPDF(venda.id, venda.codigo_venda)}
                      className="btn-pdf"
                      title="Baixar PDF"
                    >
                      📄
                    </button>
                    {venda.telefone_cliente && (
                      <button
                        onClick={() => enviarWhatsApp(venda.telefone_cliente, venda.nome_cliente, venda.codigo_venda)}
                        className="btn-whatsapp"
                        title="Enviar no WhatsApp"
                      >
                        💬
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => deletarVenda(venda.id)}
                        className="btn-deletar"
                        title="Excluir Venda"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= TELA DE OPERADORES =============
function TelaOperadores() {
  const [operadores, setOperadores] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [permissao, setPermissao] = useState('usuario');
  const userLogado = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    carregarOperadores();
  }, []);

  const carregarOperadores = async () => {
    try {
      const response = await axios.get(`${API_URL}/operadores`);
      setOperadores(response.data);
    } catch (error) {
      alert('Erro ao carregar operadores');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/operadores`, { nome, username, password, permissao });
      alert('Operador cadastrado com sucesso!');
      setNome('');
      setUsername('');
      setPassword('');
      setPermissao('usuario');
      setShowForm(false);
      carregarOperadores();
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao cadastrar operador');
    }
  };

  const handleDesativar = async (id, nomeOperador) => {
    if (window.confirm(`Deseja realmente desativar o operador "${nomeOperador}"?`)) {
      try {
        await axios.delete(`${API_URL}/operadores/${id}`);
        alert('Operador desativado com sucesso!');
        carregarOperadores();
      } catch (error) {
        alert(error.response?.data?.error || 'Erro ao desativar operador');
      }
    }
  };

  return (
    <div className="tela-operadores">
      <div className="header-section">
        <h2>👥 Operadores</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-novo">
          {showForm ? '❌ Cancelar' : '➕ Novo Operador'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-operador">
          <div className="form-group">
            <label>Nome Completo *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Senha *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
            />
          </div>
          <div className="form-group">
            <label>Permissão *</label>
            <select
              value={permissao}
              onChange={(e) => setPermissao(e.target.value)}
              required
            >
              <option value="usuario">👨‍💼 Usuário (apenas vendas)</option>
              <option value="admin">👑 Admin (acesso total)</option>
            </select>
          </div>
          <button type="submit" className="btn-salvar">💾 Salvar Operador</button>
        </form>
      )}

      <div className="lista-operadores">
        {operadores.map(op => (
          <div key={op.id} className="card-operador">
            <h3>{op.nome}</h3>
            <p>👤 {op.username}</p>
            <span className={`badge ${op.permissao === 'admin' ? 'badge-admin' : 'badge-user'}`}>
              {op.permissao === 'admin' ? '👑 Admin' : '👨‍💼 Usuário'}
            </span>
            <p className="data">Cadastrado em: {new Date(op.created_at).toLocaleDateString('pt-BR')}</p>
            
            {op.id !== userLogado.id && op.ativo === 1 && (
              <div className="card-actions" style={{ marginTop: '1rem' }}>
                <button 
                  onClick={() => handleDesativar(op.id, op.nome)} 
                  className="btn-desativar"
                  style={{ width: '100%' }}
                >
                  🗑️ Desativar Operador
                </button>
              </div>
            )}
            
            {op.id === userLogado.id && (
              <p style={{ color: '#27ae60', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>
                👤 Você está logado com este usuário
              </p>
            )}

            {op.ativo === 0 && (
              <p style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>
                ⚠️ Operador desativado
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============= TELA DE RANKING =============
function TelaRanking() {
  const [periodo, setPeriodo] = useState('hoje');
  const [estatisticas, setEstatisticas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarEstatisticas();
  }, [periodo]);

  const carregarEstatisticas = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/vendas/estatisticas?periodo=${periodo}`);
      setEstatisticas(response.data);
    } catch (error) {
      alert('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const getMedalha = (posicao) => {
    switch(posicao) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `${posicao}º`;
    }
  };

  const getTotalGeral = () => {
    return estatisticas.reduce((acc, item) => acc + item.valor_total, 0);
  };

  const getTotalVendas = () => {
    return estatisticas.reduce((acc, item) => acc + item.total_vendas, 0);
  };

  const periodos = [
    { value: 'hoje', label: '📅 Hoje' },
    { value: 'ontem', label: '📆 Ontem' },
    { value: 'ultimos7dias', label: '📊 Últimos 7 Dias' },
    { value: 'estemes', label: '📈 Este Mês' },
    { value: 'total', label: '🏆 Total Geral' }
  ];

  return (
    <div className="tela-ranking">
      <div className="header-section">
        <h2>🏆 Ranking de Vendedores</h2>
      </div>

      <div className="filtro-periodo">
        {periodos.map(p => (
          <button
            key={p.value}
            className={`btn-periodo ${periodo === p.value ? 'active' : ''}`}
            onClick={() => setPeriodo(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Carregando estatísticas...</div>
      ) : estatisticas.length === 0 ? (
        <div className="sem-dados">
          <p>📭 Nenhuma venda registrada neste período</p>
        </div>
      ) : (
        <>
          <div className="resumo-geral">
            <div className="card-resumo">
              <div className="card-resumo-icon">💰</div>
              <div className="card-resumo-info">
                <span className="card-resumo-label">Valor Total</span>
                <span className="card-resumo-valor">R$ {getTotalGeral().toFixed(2)}</span>
              </div>
            </div>
            <div className="card-resumo">
              <div className="card-resumo-icon">🎫</div>
              <div className="card-resumo-info">
                <span className="card-resumo-label">Total de Vendas</span>
                <span className="card-resumo-valor">{getTotalVendas()}</span>
              </div>
            </div>
            <div className="card-resumo">
              <div className="card-resumo-icon">👥</div>
              <div className="card-resumo-info">
                <span className="card-resumo-label">Vendedores</span>
                <span className="card-resumo-valor">{estatisticas.length}</span>
              </div>
            </div>
          </div>

          <div className="tabela-ranking">
            <table>
              <thead>
                <tr>
                  <th>Posição</th>
                  <th>Vendedor</th>
                  <th>Vendas</th>
                  <th>Valor Total</th>
                  <th>Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {estatisticas.map((item) => (
                  <tr key={item.operador_id} className={`rank-${item.ranking}`}>
                    <td>
                      <span className="medalha">{getMedalha(item.ranking)}</span>
                    </td>
                    <td className="vendedor-nome">{item.operador_nome}</td>
                    <td className="texto-centro">{item.total_vendas}</td>
                    <td className="valor-destaque">R$ {item.valor_total.toFixed(2)}</td>
                    <td className="texto-centro">R$ {item.ticket_medio.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default App;