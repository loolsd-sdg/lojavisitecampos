import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// ==================== PAINEL PRINCIPAL DA ATRAÇÃO ====================
function PainelAtracao({ usuario, logout, mostrarMensagem }) {
  const [tela, setTela] = useState('dashboard');

  return (
    <div className="App">
      <nav className="navbar">
        <div className="nav-brand">
          <h1>🎫 Painel da Atração</h1>
          <span className="user-info">👤 {usuario?.nome}</span>
        </div>
        
        <div className="nav-menu">
          <button onClick={() => setTela('dashboard')} className={tela === 'dashboard' ? 'active' : ''}>
            📊 Dashboard
          </button>
          <button onClick={() => setTela('pedidos')} className={tela === 'pedidos' ? 'active' : ''}>
            📦 Pedidos
          </button>
          <button onClick={() => setTela('relatorio')} className={tela === 'relatorio' ? 'active' : ''}>
            💰 Relatório Financeiro
          </button>
          <button onClick={logout} className="btn-logout">🚪 Sair</button>
        </div>
      </nav>

      <div className="container">
        {tela === 'dashboard' && <Dashboard mostrarMensagem={mostrarMensagem} />}
        {tela === 'pedidos' && <PedidosAtracao mostrarMensagem={mostrarMensagem} />}
        {tela === 'relatorio' && <RelatorioFinanceiro mostrarMensagem={mostrarMensagem} />}
      </div>
    </div>
  );
}

// ==================== DASHBOARD ====================
function Dashboard({ mostrarMensagem }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDashboard();
  }, []);

  const carregarDashboard = async () => {
    try {
      const res = await axios.get(`${API_URL}/atracao/dashboard`);
      setStats(res.data);
    } catch (error) {
      mostrarMensagem('Erro ao carregar dashboard', 'erro');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">⏳ Carregando...</div>;

  return (
    <div className="tela-dashboard-atracao">
      <h2>📊 Dashboard - Visão Geral</h2>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <h3>Total de Pedidos</h3>
            <p className="stat-valor">{stats.total_pedidos}</p>
          </div>
        </div>

        <div className="stat-card destaque">
          <div className="stat-icon">🎫</div>
          <div className="stat-info">
            <h3>Pedidos Hoje</h3>
            <p className="stat-valor">{stats.pedidos_hoje}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>Presenças Hoje</h3>
            <p className="stat-valor">{stats.presencas_hoje}</p>
          </div>
        </div>

        <div className="stat-card alerta">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>Pendentes Confirmação</h3>
            <p className="stat-valor">{stats.pendentes_confirmacao}</p>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>Total de Pessoas</h3>
            <p className="stat-valor">{stats.total_pessoas}</p>
          </div>
        </div>

        <div className="stat-card sucesso">
          <div className="stat-icon">✔️</div>
          <div className="stat-info">
            <h3>Pessoas Confirmadas</h3>
            <p className="stat-valor">{stats.pessoas_confirmadas}</p>
          </div>
        </div>
      </div>

      {stats.total_pessoas > 0 && (
        <div className="progress-card">
          <h3>Taxa de Confirmação</h3>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(stats.pessoas_confirmadas / stats.total_pessoas * 100).toFixed(1)}%` }}
            >
              {(stats.pessoas_confirmadas / stats.total_pessoas * 100).toFixed(1)}%
            </div>
          </div>
          <p>{stats.pessoas_confirmadas} de {stats.total_pessoas} pessoas confirmadas</p>
        </div>
      )}
    </div>
  );
}

// ==================== PEDIDOS ====================
function PedidosAtracao({ mostrarMensagem }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

  useEffect(() => {
    carregarPedidos();
  }, [filtroStatus]);

  const carregarPedidos = async () => {
    setLoading(true);
    try {
      const params = filtroStatus !== 'todos' ? `?status=${filtroStatus}` : '';
      const res = await axios.get(`${API_URL}/atracao/pedidos${params}`);
      setPedidos(res.data.pedidos);
    } catch (error) {
      mostrarMensagem('Erro ao carregar pedidos', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const verDetalhes = async (pedidoId) => {
    try {
      const res = await axios.get(`${API_URL}/atracao/pedidos/${pedidoId}`);
      setPedidoSelecionado(res.data);
    } catch (error) {
      mostrarMensagem('Erro ao carregar detalhes do pedido', 'erro');
    }
  };

  const confirmarPresenca = async (itemId) => {
    if (!window.confirm('Confirmar presença deste item?')) return;

    try {
      await axios.post(`${API_URL}/atracao/confirmar-presenca/${itemId}`);
      mostrarMensagem('✅ Presença confirmada com sucesso!');
      verDetalhes(pedidoSelecionado.pedido.id);
    } catch (error) {
      mostrarMensagem(error.response?.data?.error || 'Erro ao confirmar presença', 'erro');
    }
  };

  const cancelarPresenca = async (itemId) => {
    if (!window.confirm('Cancelar confirmação de presença?')) return;

    try {
      await axios.post(`${API_URL}/atracao/cancelar-presenca/${itemId}`);
      mostrarMensagem('Confirmação cancelada');
      verDetalhes(pedidoSelecionado.pedido.id);
    } catch (error) {
      mostrarMensagem('Erro ao cancelar confirmação', 'erro');
    }
  };

  if (pedidoSelecionado) {
    return (
      <div className="tela-pedido-detalhes">
        <div className="tela-header">
          <h2>📦 Pedido #{pedidoSelecionado.pedido.numero_pedido}</h2>
          <button onClick={() => setPedidoSelecionado(null)} className="btn-secondary">
            ← Voltar
          </button>
        </div>

        <div className="pedido-info-grid">
          <div className="info-card">
            <h3>👤 Informações do Cliente</h3>
            <p><strong>Nome:</strong> {pedidoSelecionado.pedido.cliente_nome}</p>
            <p><strong>Email:</strong> {pedidoSelecionado.pedido.cliente_email}</p>
            {pedidoSelecionado.pedido.cliente_telefone && (
              <p><strong>Telefone:</strong> {pedidoSelecionado.pedido.cliente_telefone}</p>
            )}
            <p><strong>Data:</strong> {new Date(pedidoSelecionado.pedido.data_pedido).toLocaleString('pt-BR')}</p>
          </div>

          <div className="info-card">
            <h3>💰 Informações do Pedido</h3>
            <p><strong>Número:</strong> #{pedidoSelecionado.pedido.numero_pedido}</p>
            <p><strong>Status:</strong> <span className="badge">{pedidoSelecionado.pedido.status_pedido}</span></p>
            <p><strong>Status Financeiro:</strong> <span className="badge">{pedidoSelecionado.pedido.status_financeiro}</span></p>
            <p><strong>Valor Total:</strong> R$ {pedidoSelecionado.pedido.valor_total.toFixed(2)}</p>
          </div>
        </div>

        <div className="itens-pedido-detalhes">
          <h3>🎫 Itens do Pedido</h3>
          {pedidoSelecionado.itens.map(item => (
            <div key={item.id} className={`item-confirmacao-card ${item.presenca_confirmada ? 'confirmado' : 'pendente'}`}>
              <div className="item-info-principal">
                <h4>{item.produto_interno_nome || item.produto_yampi_nome}</h4>
                <p className="item-quantidade">👥 {item.quantidade} {item.quantidade > 1 ? 'pessoas' : 'pessoa'}</p>
                <p className="item-valor">💰 R$ {item.valor_total.toFixed(2)}</p>
              </div>

              <div className="item-status">
                {item.presenca_confirmada ? (
                  <>
                    <div className="status-badge confirmado">
                      ✅ CONFIRMADO
                    </div>
                    <p className="texto-pequeno">
                      {new Date(item.data_confirmacao_presenca).toLocaleString('pt-BR')}
                    </p>
                    {item.confirmado_por_nome && (
                      <p className="texto-pequeno">por {item.confirmado_por_nome}</p>
                    )}
                    <button 
                      onClick={() => cancelarPresenca(item.id)}
                      className="btn-danger btn-small mt-10"
                    >
                      ❌ Cancelar Confirmação
                    </button>
                  </>
                ) : (
                  <>
                    <div className="status-badge pendente">
                      ⏳ PENDENTE
                    </div>
                    <button 
                      onClick={() => confirmarPresenca(item.id)}
                      className="btn-primary mt-10"
                    >
                      ✅ Confirmar Presença
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading">⏳ Carregando...</div>;

  return (
    <div className="tela-pedidos-atracao">
      <div className="tela-header">
        <h2>📦 Pedidos</h2>
        <div className="filtros">
          <button 
            onClick={() => setFiltroStatus('todos')}
            className={filtroStatus === 'todos' ? 'btn-primary' : 'btn-secondary'}
          >
            Todos ({pedidos.length})
          </button>
          <button 
            onClick={() => setFiltroStatus('pendente')}
            className={filtroStatus === 'pendente' ? 'btn-primary' : 'btn-secondary'}
          >
            Pendentes
          </button>
          <button 
            onClick={() => setFiltroStatus('confirmado')}
            className={filtroStatus === 'confirmado' ? 'btn-primary' : 'btn-secondary'}
          >
            Confirmados
          </button>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="empty-state">
          <p>📭 Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="pedidos-lista">
          {pedidos.map(pedido => {
            const percentualConfirmado = pedido.total_itens > 0 
              ? (pedido.itens_confirmados / pedido.total_itens * 100).toFixed(0)
              : 0;

            return (
              <div key={pedido.pedido_id} className="pedido-card">
                <div className="pedido-header-info">
                  <h3>Pedido #{pedido.numero_pedido}</h3>
                  <span className={`status-badge ${pedido.status_financeiro}`}>
                    {pedido.status_financeiro}
                  </span>
                </div>

                <div className="pedido-dados">
                  <p><strong>👤 Cliente:</strong> {pedido.cliente_nome}</p>
                  <p><strong>📅 Data:</strong> {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}</p>
                  <p><strong>💰 Valor:</strong> R$ {pedido.valor_total.toFixed(2)}</p>
                </div>

                <div className="pedido-confirmacao-info">
                  <div className="confirmacao-stats">
                    <span className="stat">
                      📊 {pedido.itens_confirmados} de {pedido.total_itens} itens confirmados
                    </span>
                    <span className="percentual">{percentualConfirmado}%</span>
                  </div>
                  <div className="progress-bar-mini">
                    <div 
                      className="progress-fill-mini" 
                      style={{ width: `${percentualConfirmado}%` }}
                    />
                  </div>
                </div>

                <button 
                  onClick={() => verDetalhes(pedido.pedido_id)}
                  className="btn-primary"
                >
                  👁️ Ver Detalhes e Confirmar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== RELATÓRIO FINANCEIRO ====================
function RelatorioFinanceiro({ mostrarMensagem }) {
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    carregarRelatorio();
  }, [dataInicio, dataFim]);

  const carregarRelatorio = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.append('dataInicio', dataInicio);
      if (dataFim) params.append('dataFim', dataFim);

      const res = await axios.get(`${API_URL}/atracao/relatorio-financeiro?${params}`);
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
    <div className="tela-relatorio-financeiro">
      <h2>💰 Relatório Financeiro - {relatorio.atracao.nome}</h2>

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
          <small>{relatorio.resumo.totalItens} itens vendidos</small>
        </div>

        <div className="resumo-card comissao">
          <h3>💼 Comissão (Plataforma)</h3>
          <p className="valor-grande">R$ {relatorio.resumo.comissaoTotal.toFixed(2)}</p>
        </div>

        <div className="resumo-card liquido">
          <h3>💵 Valor Líquido</h3>
          <p className="valor-grande destaque">R$ {relatorio.resumo.valorLiquido.toFixed(2)}</p>
          <small>Valor a receber</small>
        </div>
      </div>

      <div className="resumo-presencas">
        <div className="resumo-card info">
          <h3>👥 Total de Pessoas</h3>
          <p className="valor-grande">{relatorio.resumo.totalPessoas}</p>
        </div>

        <div className="resumo-card sucesso">
          <h3>✅ Presenças Confirmadas</h3>
          <p className="valor-grande">{relatorio.resumo.presencasConfirmadas}</p>
        </div>

        <div className="resumo-card taxa">
          <h3>📊 Taxa de Confirmação</h3>
          <p className="valor-grande">{relatorio.resumo.taxaConfirmacao}%</p>
        </div>
      </div>

      <div className="detalhes-vendas">
        <h3>📋 Detalhamento das Vendas</h3>
        
        {relatorio.itens.length === 0 ? (
          <p>Nenhuma venda no período selecionado</p>
        ) : (
          <div className="table-container">
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
                  <th>Presença</th>
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
                      <td>
                        {item.presenca_confirmada ? (
                          <span className="badge badge-success">✅ Sim</span>
                        ) : (
                          <span className="badge badge-pending">⏳ Não</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PainelAtracao;
