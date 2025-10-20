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
const categories = {
  revenue: ["Adiantamento","Pagamento","Empréstimo","Investimento","Monetização","Lucro","Venda","Outros"],
  expense: ["Alimentação","Lazer","Transporte","Moradia","Saúde","Educação","Outros"]
};

/* ---------- ELEMENTOS DO DOM ---------- */
const els = {
  list: document.getElementById('transaction-list'),
  totalRev: document.getElementById('total-revenue'),
  totalDes: document.getElementById('total-expenses'),
  balance: document.getElementById('balance'),
  legenda: document.getElementById('categoria-legenda-container'),
  reset: document.getElementById('reset-btn'),
  titulo: document.getElementById('transacoes-titulo'),
  canvas: document.getElementById('pieChart'),
  resetModal: document.getElementById('reset-modal'),
  resetCancel: document.getElementById('reset-cancel'),
  resetConfirm: document.getElementById('reset-confirm'),
  deleteModal: document.getElementById('delete-modal'),
  deleteCancel: document.getElementById('delete-cancel'),
  deleteConfirm: document.getElementById('delete-confirm'),
  deleteBody: document.getElementById('delete-modal-body'),
  transactionsSection: document.getElementById('transactions-section'),
  installPrompt: document.getElementById('install-prompt'),
  installCancel: document.getElementById('install-cancel'),
  installConfirm: document.getElementById('install-confirm'),
  negativeAlert: document.getElementById('negative-alert'),
  addRevenueBtn: document.getElementById('add-revenue-btn'),
  addExpenseBtn: document.getElementById('add-expense-btn'),
  formOverlayRevenue: document.getElementById('form-overlay-revenue'),
  closeFormBtnRevenue: document.getElementById('close-form-btn-revenue'),
  formRevenue: document.getElementById('transaction-form-revenue'),
  amountRevenue: document.getElementById('amount-revenue'),
  originRevenue: document.getElementById('origin-revenue'),
  btnSaveRevenue: document.getElementById('save-btn-revenue'),
  formOverlayExpense: document.getElementById('form-overlay-expense'),
  closeFormBtnExpense: document.getElementById('close-form-btn-expense'),
  formExpense: document.getElementById('transaction-form-expense'),
  descExpense: document.getElementById('description-expense'),
  amountExpense: document.getElementById('amount-expense'),
  categoryExpense: document.getElementById('category-expense'),
  parceladoExpense: document.getElementById('parcelado-expense'),
  parcelasExpense: document.getElementById('parcelas-expense'),
  parcelasDivExpense: document.getElementById('parcelas-field-div-expense'),
  btnSaveExpense: document.getElementById('save-btn-expense'),
  charCountExpense: document.getElementById('char-count-expense')
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
function bloquearZoom() {
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('gestureend', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && '+-=0'.includes(e.key)) e.preventDefault();
  });
  document.addEventListener('wheel', e => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
}

/* ---------- SALVAR / CARREGAR ---------- */
function salvarDados() {
  localStorage.setItem('transactions', JSON.stringify(transactions));
}
function carregarDados() {
  transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
}

/* ---------- RESUMO ---------- */
function atualizarResumo() {
  const receitas = transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
  const despesas = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const saldo = receitas - despesas;

  els.totalRev.textContent = formatarMoeda(receitas);
  els.totalDes.textContent = formatarMoeda(despesas);
  els.balance.textContent = formatarMoeda(saldo);

  els.balance.classList.remove('positive', 'negative');
  els.balance.classList.add(saldo >= 0 ? 'info' : 'negative');

  /* alerta saldo negativo */
  if (saldo < 0 && !saldoNegativoAlertado) {
    saldoNegativoAlertado = true;
    els.negativeAlert.style.display = 'block';
    setTimeout(() => els.negativeAlert.style.display = 'none', 4000);
  } else if (saldo >= 0) {
    saldoNegativoAlertado = false;
  }
}

/* ---------- GRÁFICO ---------- */
let chartInstance = null;
function atualizarGrafico() {
  const receitas = transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
  const despesas = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const data = {
    labels: ['Receitas', 'Despesas'],
    datasets: [{
      data: [receitas, despesas],
      backgroundColor: ['#28a745', '#dc3545']
    }]
  };

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(els.canvas, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
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
                                        
