/* ---------- CONFIG ---------- */
const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const chartCategories = [
  { type: "revenue", name: "Receita", color: "#28a745" },
  { type: "expense", name: "Alimentação", color: "#e74c3c" },
  { type: "expense", name: "Lazer", color: "#f1c40f" },
  { type: "expense", name: "Transporte", color: "#3498db" },
  { type: "expense", name: "Moradia", color: "#9b59b6" },
  { type: "expense", name: "Saúde", color: "#1abc9c" },
  { type: "expense", name: "Educação", color: "#e67e22" },
  { type: "expense", name: "Outros", color: "#95a5a6" }
];
const categories = {
  revenue: ["Adiantamento", "Pagamento", "Empréstimo", "Investimento", "Monetização", "Lucro", "Venda", "Outros"],
  expense: ["Alimentação", "Lazer", "Transporte", "Moradia", "Saúde", "Educação", "Outros"]
};

/* ---------- ELEMENTS ---------- */
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

  // revenue
  formOverlayRevenue: document.getElementById('form-overlay-revenue'),
  closeFormBtnRevenue: document.getElementById('close-form-btn-revenue'),
  formRevenue: document.getElementById('transaction-form-revenue'),
  amountRevenue: document.getElementById('amount-revenue'),
  originRevenue: document.getElementById('origin-revenue'),
  btnSaveRevenue: document.getElementById('save-btn-revenue'),

  // expense
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

let editIndex = null, chart = null, deleteIndex = null, transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
let deferredPrompt = null;
let saldoNegativoAlertado = false;
let alertTimeout = null;

/* ---------- UTILS ---------- */
const hoje = new Date();
const mesAtualStr = hoje.getFullYear() + '-' + (hoje.getMonth() + 1).toString().padStart(2, '0');

const getMesAnoStr = d => typeof d === 'string' ? d.slice(0, 7) : d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0');

const getMesAnoParcela = (baseDate, parcelaNum) => {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + parcelaNum - 1);
  return getMesAnoStr(d);
};

const parseParcelaInfo = desc => {
  const match = desc.match(/(.*)\s(\d+)\/(\d+)$/);
  if (match) {
    return {
      baseDesc: match[1],
      parcelaAtual: parseInt(match[2]),
      totalParcelas: parseInt(match[3])
    };
  }
  return null;
};

const formataReal = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/* ---------- BLOQUEIO DE ZOOM ---------- */
function bloquearZoom() {
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('gestureend', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && ['+', '-', '0', '='].includes(e.key)) e.preventDefault();
  });
  document.addEventListener('wheel', e => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
}

/* ---------- SALDO NEGATIVO ---------- */
const verificarSaldoNegativo = saldo => {
  if (alertTimeout) {
    clearTimeout(alertTimeout);
    alertTimeout = null;
  }
  if (saldo < 0 && !saldoNegativoAlertado) {
    els.negativeAlert.style.display = 'block';
    saldoNegativoAlertado = true;
    alertTimeout = setTimeout(() => {
      els.negativeAlert.style.display = 'none';
      saldoNegativoAlertado = false;
    }, 5000);
  } else if (saldo >= 0) {
    els.negativeAlert.style.display = 'none';
    saldoNegativoAlertado = false;
  }
};

/* ---------- FORMULÁRIOS ---------- */
function abrirFormOverlay(tipo) {
  if (tipo === 'revenue') {
    els.formRevenue.reset();
    els.originRevenue.focus();
    els.formOverlayRevenue.style.display = 'flex';
  } else {
    els.formExpense.reset();
    els.parcelasDivExpense.classList.remove('visible');
    els.charCountExpense.textContent = '0';
    els.charCountExpense.parentElement.classList.remove('warning');
    els.descExpense.focus();
    els.formOverlayExpense.style.display = 'flex';
  }
  // 🔧 sobe a caixa para o campo visível
  setTimeout(() => {
    document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

function fecharFormOverlay(tipo) {
  if (tipo === 'revenue') {
    els.formOverlayRevenue.style.display = 'none';
    els.formRevenue.reset();
  } else {
    els.formOverlayExpense.style.display = 'none';
    els.formExpense.reset();
    els.parcelasDivExpense.classList.remove('visible');
    els.charCountExpense.textContent = '0';
    els.charCountExpense.parentElement.classList.remove('warning');
  }
  editIndex = null;
}

function initCharCounter(el, counterEl) {
  el.addEventListener('input', () => {
    let count = el.value.length;
    if (count > 12) {
      el.value = el.value.slice(0, 12);
      count = 12;
    }
    counterEl.textContent = count;
    counterEl.parentElement.classList.toggle('warning', count >= 12);
  });
}

/* ---------- PWA ---------- */
function initPWA() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
      if (deferredPrompt) els.installPrompt.style.display = 'block';
    }, 3000);
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    els.installPrompt.style.display = 'none';
  });
  els.installConfirm.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') deferredPrompt = null;
      els.installPrompt.style.display = 'none';
    }
  });
  els.installCancel.addEventListener('click', () => {
    els.installPrompt.style.display = 'none';
  });
}

/* ---------- RENDER ---------- */
function renderLegenda() {
  const thisMonth = mesAtualStr;
  let receita = 0, desp = {};
  chartCategories.filter(c => c.type === 'expense').forEach(c => desp[c.name] = 0);

  transactions.forEach(tr => {
    const parcelaInfo = parseParcelaInfo(tr.description);
    const mesItem = parcelaInfo ? getMesAnoParcela(tr.dataLancamento, parcelaInfo.parcelaAtual) : getMesAnoStr(tr.dataLancamento);
    if (mesItem !== thisMonth) return;
    if (tr.type === 'revenue') receita += tr.amount;
    else if (desp.hasOwnProperty(tr.category)) desp[tr.category] += tr.amount;
  });

  const totalReceitas = receita;
  const totalDespesas = Object.values(desp).reduce((a, b) => a + b, 0);
  const saldo = totalReceitas - totalDespesas;
  const porcentagemDisponivel = totalReceitas > 0 ? (saldo / totalReceitas * 100).toFixed(0) : 0;

  els.legenda.innerHTML = chartCategories.map(c => {
    const v = c.type === 'revenue' ? receita : desp[c.name] || 0;
    if (c.type === 'revenue') {
      return `<div class="categoria-legenda"><span class="cor-blob" style="background:${c.color}"></span>${c.name} ${porcentagemDisponivel}%</div>`;
    } else {
      const p = totalReceitas > 0 ? (v / totalReceitas * 100).toFixed(0) : 0;
      return `<div class="categoria-legenda"><span class="cor-blob" style="background:${c.color}"></span>${c.name} ${p}%</div>`;
    }
  }).join('');
}

function renderTransactions() {
  els.list.innerHTML = '';
  let rev = 0, des = 0;
  const thisMonth = mesAtualStr;

  transactions.forEach((tr, i) => {
    const parcelaInfo = parseParcelaInfo(tr.description);
    let mostra = false;
    let descricaoDisplay = tr.description;
    let dataDisplay = '';

    if (parcelaInfo) {
      const mesParcela = getMesAnoParcela(tr.dataLancamento, parcelaInfo.parcelaAtual);
      mostra = mesParcela === thisMonth;
      if (mostra) {
        const dataParcela = new Date(tr.dataLancamento);
        dataParcela.setMonth(dataParcela.getMonth() + parcelaInfo.parcelaAtual - 1);
        dataDisplay = meses[dataParcela.getMonth()];
        descricaoDisplay = `${parcelaInfo.baseDesc} (${parcelaInfo.parcelaAtual}/${parcelaInfo.totalParcelas})`;
      }
    } else {
      const mesTransacao = getMesAnoStr(tr.dataLancamento);
      mostra = mesTransacao === thisMonth;
      if (mostra) {
        const dataTransacao = new Date(tr.dataLancamento);
        dataDisplay = meses[dataTransacao.getMonth()];
      }
    }

    if (!mostra) return;

    const dia = new Date(tr.dataLancamento).getDate().toString().padStart(2, '0');
    const row = document.createElement('tr');
    const isParcelada = parcelaInfo !== null;

    row.innerHTML = `
      <td style="white-space: nowrap">${descricaoDisplay}</td>
      <td class="${tr.type === 'revenue' ? 'positive' : 'negative'}" style="white-space: nowrap">${formataReal(tr.amount)}</td>
      <td class="data-cell" style="white-space: nowrap">${dia}/${dataDisplay}</td>
      <td style="white-space: nowrap">${tr.category || '-'}</td>
      <td class="actions-cell">
        <div class="actions-container">
          ${!isParcelada ? `<button class="edit-btn" data-i="${i}" title="Editar">✏️</button>` : '<div style="width:20px"></div>'}
          <button class="delete-btn" data-i="${i}" title="Excluir">🗑️</button>
        </div>
      </td>`;
    els.list.appendChild(row);

    if (tr.type === 'revenue') rev += tr.amount;
    else des += tr.amount;
  });

  updateSummary(rev, des);
  renderPieChart();
  els.titulo.textContent = `Transações (${meses[hoje.getMonth()]})`;
}

function updateSummary(rev, des) {
  const bal = rev - des;

  els.negativeAlert.style.display = 'none';
  saldoNegativoAlertado = false;

  if (bal < 0) {
    els.negativeAlert.style.display = 'block';
    saldoNegativoAlertado = true;
    setTimeout(() => {
      els.negativeAlert.style.display = 'none';
      saldoNegativoAlertado = false;
    }, 5000);
  }

  els.totalRev.textContent = formataReal(rev);
  els.totalDes.textContent = formataReal(des);
  els.balance.textContent = formataReal(bal);
  els.balance.className = bal < 0 ? 'negative' : 'info';
}

function renderPieChart() {
function renderPieChart() {
  const thisMonth = mesAtualStr;
  let receita = 0;
  const desp = {};

  // zera só despesas
  chartCategories.filter(c => c.type === 'expense').forEach(c => desp[c.name] = 0);

  transactions.forEach(tr => {
    const parcelaInfo = parseParcelaInfo(tr.description);
    const mesItem = parcelaInfo
      ? getMesAnoParcela(tr.dataLancamento, parcelaInfo.parcelaAtual)
      : getMesAnoStr(tr.dataLancamento);
    if (mesItem !== thisMonth) return;

    if (tr.type === 'revenue') {
      receita += tr.amount; // ✅ só receita
    } else if (desp.hasOwnProperty(tr.category)) {
      desp[tr.category] += tr.amount; // ✅ só despesa
    }
  });

  const labels = [];
  const data = [];
  const cores = [];

  // adiciona receita apenas se houver
  if (receita > 0) {
    labels.push('Receita');
    data.push(receita);
    cores.push(chartCategories[0].color);
  }

  // adiciona só despesas com valor
  chartCategories.filter(c => c.type === 'expense').forEach(c => {
    if (desp[c.name] > 0) {
      labels.push(c.name);
      data.push(desp[c.name]);
      cores.push(c.color);
    }
  });

  if (chart) chart.destroy();
  chart = new Chart(els.canvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: cores }]
    },
    options: {
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: true
    }
  });
}


  if (chart) chart.destroy();
  chart = new Chart(els.canvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: cores }]
    },
    options: {
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: true
    }
  });
}

/* ---------- FORMULÁRIO ---------- */
function processarFormulario(desc, amt, type, category, ehParc, numParc, formType) {
  let descricao = desc.trim();
  if (descricao.length > 12) descricao = descricao.slice(0, 12);
  const valor = parseFloat(amt);
  const numParcelas = parseInt(numParc) || 1;
  const dataLanc = new Date().toISOString();
  let novas = [];

  if (editIndex !== null) {
    const original = transactions[editIndex];
    const parcelaInfo = parseParcelaInfo(original.description);
    if (parcelaInfo && !ehParc) {
      transactions = transactions.filter(t => {
        const info = parseParcelaInfo(t.description);
        return !info || info.baseDesc !== parcelaInfo.baseDesc;
      });
      novas.push({ description: descricao, amount: valor, type, category, dataLancamento: dataLanc });
    } else if (!parcelaInfo && ehParc) {
      const valorParcela = valor / numParcelas;
      for (let i = 1; i <= numParcelas; i++) {
        novas.push({
          description: `${descricao} ${i}/${numParcelas}`,
          amount: parseFloat(valorParcela.toFixed(2)),
          type, category, dataLancamento: dataLanc
        });
      }
      transactions.splice(editIndex, 1);
    } else if (parcelaInfo && ehParc) {
      transactions = transactions.filter(t => {
        const info = parseParcelaInfo(t.description);
        return !info || info.baseDesc !== parcelaInfo.baseDesc;
      });
      const valorParcela = valor / numParcelas;
      for (let i = 1; i <= numParcelas; i++) {
        novas.push({
          description: `${descricao} ${i}/${numParcelas}`,
          amount: parseFloat(valorParcela.toFixed(2)),
          type, category, dataLancamento: dataLanc
        });
      }
    } else {
      transactions[editIndex] = { description: descricao, amount: valor, type, category, dataLancamento: dataLanc };
    }
    if (novas.length > 0) transactions.push(...novas);
    editIndex = null;
  } else {
    if (ehParc && numParcelas >= 2) {
      const valorParcela = valor / numParcelas;
      for (let i = 1; i <= numParcelas; i++) {
        novas.push({
          description: `${descricao} ${i}/${numParcelas}`,
          amount: parseFloat(valorParcela.toFixed(2)),
          type, category, dataLancamento: dataLanc
        });
      }
    } else {
      novas.push({ description: descricao, amount: valor, type, category, dataLancamento: dataLanc });
    }
    transactions.push(...novas);
  }

  save();
  renderTransactions();
  renderLegenda();
  fecharFormOverlay(formType);
  if (editIndex === null) {
    setTimeout(() => els.transactionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

/* ---------- AÇÕES ---------- */
function handleActions(e) {
  const i = parseInt(e.target.dataset.i);
  if (e.target.classList.contains('delete-btn')) {
    deleteIndex = i;
    const desc = transactions[i].description;
    const parcelaInfo = parseParcelaInfo(desc);
    els.deleteBody.textContent = parcelaInfo
      ? `Tem certeza que deseja excluir TODAS as parcelas de "${parcelaInfo.baseDesc}"?`
      : `Tem certeza que deseja excluir "${desc}"?`;
    els.deleteModal.style.display = 'flex';
  }
  if (e.target.classList.contains('edit-btn')) {
    const t = transactions[i];
    const parcelaInfo = parseParcelaInfo(t.description);
    if (t.type === 'revenue') {
      abrirFormOverlay('revenue');
      els.amountRevenue.value = t.amount * (parcelaInfo ? parcelaInfo.totalParcelas : 1);
      els.originRevenue.value = t.category;
      els.btnSaveRevenue.textContent = 'Salvar';
    } else {
      abrirFormOverlay('expense');
      els.descExpense.value = parcelaInfo ? parcelaInfo.baseDesc : t.description;
      els.amountExpense.value = t.amount * (parcelaInfo ? parcelaInfo.totalParcelas : 1);
      els.categoryExpense.value = t.category;
      if (parcelaInfo) {
        els.parceladoExpense.checked = true;
        els.parcelasDivExpense.classList.add('visible');
        els.parcelasExpense.value = parcelaInfo.totalParcelas;
      } else {
        els.parceladoExpense.checked = false;
        els.parcelasDivExpense.classList.remove('visible');
      }
      const baseDesc = parcelaInfo ? parcelaInfo.baseDesc : t.description;
      const count = baseDesc.length;
      els.charCountExpense.textContent = count;
      els.charCountExpense.parentElement.classList.toggle('warning', count >= 12);
      els.btnSaveExpense.textContent = 'Salvar';
    }
    editIndex = i;
  }
}

function save() {
  localStorage.setItem('transactions', JSON.stringify(transactions));
}

/* ---------- INIT ---------- */
function init() {
  bloquearZoom();
  initPWA();
  initCharCounter(els.descExpense, els.charCountExpense);

  // popula selects
  categories.revenue.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    els.originRevenue.appendChild(opt);
  });
  categories.expense.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    els.categoryExpense.appendChild(opt);
  });

  // eventos
  els.addRevenueBtn.addEventListener('click', () => abrirFormOverlay('revenue'));
  els.addExpenseBtn.addEventListener('click', () => abrirFormOverlay('expense'));
  els.closeFormBtnRevenue.addEventListener('click', () => fecharFormOverlay('revenue'));
  els.closeFormBtnExpense.addEventListener('click', () => fecharFormOverlay('expense'));
  els.formRevenue.addEventListener('submit', e => {
    e.preventDefault();
    processarFormulario(els.originRevenue.value, els.amountRevenue.value, 'revenue', els.originRevenue.value, false, 1, 'revenue');
  });
  els.formExpense.addEventListener('submit', e => {
    e.preventDefault();
    processarFormulario(els.descExpense.value, els.amountExpense.value, 'expense', els.categoryExpense.value, els.parceladoExpense.checked, els.parcelasExpense.value, 'expense');
  });
  els.parceladoExpense.addEventListener('change', () => {
    els.parcelasDivExpense.classList.toggle('visible', els.parceladoExpense.checked);
  });
  els.reset.addEventListener('click', () => els.resetModal.style.display = 'flex');
  els.resetCancel.addEventListener('click', () => els.resetModal.style.display = 'none');
  els.resetConfirm.addEventListener('click', () => {
    transactions = [];
    save();
    renderTransactions();
    renderLegenda();
    els.resetModal.style.display = 'none';
  });
  els.deleteCancel.addEventListener('click', () => {
    els.deleteModal.style.display = 'none';
    deleteIndex = null;
  });
  els.deleteConfirm.addEventListener('click', () => {
    if (deleteIndex !== null) {
      const transacao = transactions[deleteIndex];
      const parcelaInfo = parseParcelaInfo(transacao.description);
      if (parcelaInfo) {
        transactions = transactions.filter(t => {
          const info = parseParcelaInfo(t.description);
          return !info || info.baseDesc !== parcelaInfo.baseDesc;
        });
      } else {
        transactions.splice(deleteIndex, 1);
      }
      save();
      renderTransactions();
      renderLegenda();
      els.deleteModal.style.display = 'none';
      deleteIndex = null;
    }
  });
  window.addEventListener('click', e => {
    if (e.target === els.resetModal) els.resetModal.style.display = 'none';
    if (e.target === els.deleteModal) els.deleteModal.style.display = 'none';
    if (e.target === els.formOverlayRevenue) fecharFormOverlay('revenue');
    if (e.target === els.formOverlayExpense) fecharFormOverlay('expense');
  });
  els.list.addEventListener('click', handleActions);

  // primeira render
  renderTransactions();
  renderLegenda();
}

init();
