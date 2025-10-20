/* =========================================================
   CONT1 | Controle de Gastos – app.js completo
   ========================================================= */

/* ---------- CONFIGURAÇÕES GLOBAIS ---------- */
const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const chartCategories = [
  {type:"revenue", name:"Receita", color:"#28a745"},
  {type:"expense", name:"Alimentação", color:"#e74c3c"},
  {type:"expense", name:"Lazer", color:"#f1c40f"},
  {type:"expense", name:"Transporte", color:"#3498db"},
  {type:"expense", name:"Moradia", color:"#9b59b6"},
  {type:"expense", name:"Saúde", color:"#1abc9c"},
  {type:"expense", name:"Educação", color:"#e67e22"},
  {type:"expense", name:"Outros", color:"#95a5a6"}
];

/* ---------- ELEMENTOS DO DOM ---------- */
const els = {
  list: document.getElementById('transaction-list'),
  totalRev: document.getElementById('total-revenue'),
  totalDes: document.getElementById('total-expenses'),
  balance: document.getElementById('balance'),
  legenda: document.getElementById('categoria-legenda-container'),
  canvas: document.getElementById('pieChart'),
  /* ... demais elementos ... */
};

/* ---------- VARIÁVEIS DE ESTADO ---------- */
let editIndex = null, chart = null, deleteIndex = null;
let transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
let deferredPrompt = null;
let saldoNegativoAlertado = false;

/* ---------- UTILITÁRIOS ---------- */
function formatarMoeda(valor) {
  return 'R$ ' + valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* ---------- SALVAR / CARREGAR ---------- */
function salvarDados() {
  localStorage.setItem('transactions', JSON.stringify(transactions));
}

/* ---------- RESUMO ---------- */
function atualizarResumo() {
  const receitas = transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
  const despesas = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const saldo = receitas - despesas;

  els.totalRev.textContent = formatarMoeda(receitas);
  els.totalDes.textContent = formatarMoeda(despesas);
  els.balance.textContent = formatarMoeda(saldo);
  els.balance.classList.toggle('negative', saldo < 0);

  if (saldo < 0 && !saldoNegativoAlertado) {
    saldoNegativoAlertado = true;
    els.negativeAlert.style.display = 'block';
    setTimeout(() => els.negativeAlert.style.display = 'none', 4000);
  } else if (saldo >= 0) {
    saldoNegativoAlertado = false;
  }
}

/* ---------- GRÁFICO PIZZA + LEGENDA ---------- */
let chartInstance = null;

function atualizarGrafico() {
  /* agrupa despesas por categoria */
  const despesas = transactions.filter(t => t.type === 'expense');
  const mapDesp = {};
  despesas.forEach(t => {
    mapDesp[t.category] = (mapDesp[t.category] || 0) + t.amount;
  });

  /* monta arrays para o gráfico */
  const labels = [];
  const data = [];
  const colors = [];

  /* 1ª fatia = RECEITA TOTAL */
  const totalReceita = transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
  if (totalReceita > 0) {
    labels.push('Receita');
    data.push(totalReceita);
    colors.push(chartCategories.find(c => c.type === 'revenue').color);
  }

  /* demais fatias = CATEGORIAS DE DESPESA */
  Object.entries(mapDesp).forEach(([cat, valor]) => {
    labels.push(cat);
    data.push(valor);
    colors.push(chartCategories.find(c => c.name === cat)?.color || '#999');
  });

  /* desenha */
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(els.canvas, {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: colors }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }, // usamos legenda manual abaixo
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return `${ctx.label}: ${formatarMoeda(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  montarLegendaCompleta(labels, data);
}

/* ---------- LEGENDA COLORIDA (RECEITA + DESPESAS) ---------- */
function montarLegendaCompleta(labels, data) {
  const total = data.reduce((a, b) => a + b, 0);
  if (!total) { els.legenda.innerHTML = ''; return; }

  els.legenda.innerHTML = labels.map((label, i) => {
    const valor = data[i];
    const pct = (valor / total * 100).toFixed(1);
    const cor = chartInstance.data.datasets[0].backgroundColor[i];
    return `
      <div class="categoria-legenda">
        <span class="cor-blob" style="background:${cor}"></span>
        <span style="font-size:11px">${label} ${pct}%</span>
      </div>`;
  }).join('');
}

/* ---------- LISTAGEM ---------- */
function renderizarLista() {
  els.list.innerHTML = '';
  if (!transactions.length) {
    els.list.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888">Nenhuma transação</td></tr>';
    return;
  }
  transactions.forEach((tr, i) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${tr.description || '-'}</td>
      <td class="${tr.type}">${formatarMoeda(tr.amount)}</td>
      <td class="data-cell">${tr.day}/${meses[tr.month]}</td>
      <td>${tr.category || tr.origin}</td>
      <td class="actions-cell">
        <button class="edit-btn" title="Editar">✏️</button>
        <button class="delete-btn" title="Excluir">🗑️</button>
      </td>`;
    row.querySelector('.edit-btn').onclick = () => editarTransacao(i);
    row.querySelector('.delete-btn').onclick = () => confirmarExclusao(i);
    els.list.appendChild(row);
  });
}

/* ---------- CRUD ---------- */
function adicionarTransacao(tr) {
  if (editIndex !== null) {
    transactions[editIndex] = tr;
    editIndex = null;
  } else {
    transactions.push(tr);
  }
  salvarDados();
  renderizarLista();
  atualizarResumo();
  atualizarGrafico();
}

function editarTransacao(index) {
  const tr = transactions[index];
  if (tr.type === 'revenue') {
    els.originRevenue.value = tr.origin;
    els.amountRevenue.value = tr.amount;
    els.formOverlayRevenue.style.display = 'flex';
    els.amountRevenue.focus();
  } else {
    els.descExpense.value = tr.description;
    els.amountExpense.value = tr.amount;
    els.categoryExpense.value = tr.category;
    els.parceladoExpense.checked = false;
    els.parcelasDivExpense.classList.remove('visible');
    els.formOverlayExpense.style.display = 'flex';
    els.descExpense.focus();
  }
  editIndex = index;
}

function confirmarExclusao(index) {
  deleteIndex = index;
  els.deleteModal.style.display = 'flex';
}

function excluirTransacao() {
  transactions.splice(deleteIndex, 1);
  salvarDados();
  renderizarLista();
  atualizarResumo();
  atualizarGrafico();
  els.deleteModal.style.display = 'none';
}

/* ---------- FORMULÁRIOS ---------- */
function fecharFormularios() {
  els.formOverlayRevenue.style.display = 'none';
  els.formOverlayExpense.style.display = 'none';
  els.formRevenue.reset();
  els.formExpense.reset();
  editIndex = null;
}

function enviarReceita(e) {
  e.preventDefault();
  const amount = parseFloat(els.amountRevenue.value);
  const origin = els.originRevenue.value;
  if (!amount || amount <= 0) return;
  const now = new Date();
  const tr = {
    type: 'revenue',
    amount,
    origin,
    description: origin,
    category: origin,
    day: now.getDate(),
    month: now.getMonth(),
    year: now.getFullYear()
  };
  adicionarTransacao(tr);
  fecharFormularios();
}

function enviarDespesa(e) {
  e.preventDefault();
  const amount = parseFloat(els.amountExpense.value);
  const description = els.descExpense.value.trim();
  const category = els.categoryExpense.value;
  const parcelado = els.parceladoExpense.checked;
  const parcelas = parcelado ? parseInt(els.parcelasExpense.value) : 1;

  if (!amount || amount <= 0 || !description) return;

  const now = new Date();
  const valorParcela = amount / parcelas;

  for (let i = 0; i < parcelas; i++) {
    const dataParcela = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
    const tr = {
      type: 'expense',
      amount: valorParcela,
      description: parcelas > 1 ? `${description} (${i + 1}/${parcelas})` : description,
      category,
      day: dataParcela.getDate(),
      month: dataParcela.getMonth(),
      year: dataParcela.getFullYear()
    };
    adicionarTransacao(tr);
  }
  fecharFormularios();
}

/* ---------- INICIALIZAÇÃO ---------- */
function inicializarEventos() {
  /* abertura */
  els.addRevenueBtn.addEventListener('click', () => {
    els.formOverlayRevenue.style.display = 'flex';
    els.amountRevenue.focus();
  });
  els.addExpenseBtn.addEventListener('click', () => {
    els.formOverlayExpense.style.display = 'flex';
    els.descExpense.focus();
  });

  /* fechamento */
  els.closeFormBtnRevenue.addEventListener('click', fecharFormularios);
  els.closeFormBtnExpense.addEventListener('click', fecharFormularios);
  els.formOverlayRevenue.addEventListener('click', e => {
    if (e.target === els.formOverlayRevenue) fecharFormularios();
  });
  els.formOverlayExpense.addEventListener('click', e => {
    if (e.target === els.formOverlayExpense) fecharFormularios();
  });

  /* envio */
  els.formRevenue.addEventListener('submit', enviarReceita);
  els.formExpense.addEventListener('submit', enviarDespesa);

  /* parcelado */
  els.parceladoExpense.addEventListener('change', () => {
    els.parcelasDivExpense.classList.toggle('visible', els.parceladoExpense.checked);
  });

  /* contador de caracteres */
  els.descExpense.addEventListener('input', () => {
    const len = els.descExpense.value.length;
    els.charCountExpense.textContent = len;
    els.charCountExpense.parentElement.classList.toggle('warning', len > 10);
  });

  /* modais */
  els.reset.addEventListener('click', () => els.resetModal.style.display = 'flex');
  els.resetCancel.addEventListener('click', () => els.resetModal.style.display = 'none');
  els.resetConfirm.addEventListener('click', () => {
    transactions = [];
    salvarDados();
    renderizarLista();
    atualizarResumo();
    atualizarGrafico();
    els.resetModal.style.display = 'none';
  });

  els.deleteCancel.addEventListener('click', () => els.deleteModal.style.display = 'none');
  els.deleteConfirm.addEventListener('click', excluirTransacao);

  /* PWA install prompt */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    els.installPrompt.style.display = 'block';
  });
  els.installCancel.addEventListener('click', () => {
    els.installPrompt.style.display = 'none';
    deferredPrompt = null;
  });
  els.installConfirm.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') deferredPrompt = null;
      els.installPrompt.style.display = 'none';
    }
  });
}

function inicializarApp() {
  bloquearZoom();
  carregarDados();
  renderizarLista();
  atualizarResumo();
  atualizarGrafico();
  inicializarEventos();
}

document.addEventListener('DOMContentLoaded', inicializarApp);
