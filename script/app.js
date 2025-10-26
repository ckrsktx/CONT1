/* =========================================================
   CONT1 - CONTROLE FINANCEIRO PESSOAL (PWA)
   ========================================================= */

/* ---------- CONFIGURAÇÕES E CONSTANTES ---------- */
const CONFIG = {
    meses: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
    categories: {
        revenue: ['Adiantamento','Pagamento','Empréstimo','Investimento','Monetização','Lucro','Venda','Outros'],
        expense: ['Alimentação','Lazer','Transporte','Moradia','Saúde','Educação','Outros']
    },
    chartColors: {
        revenue: '#28a745',
        expenses: [
            '#e74c3c', '#f1c40f', '#3498db', '#9b59b6', 
            '#1abc9c', '#e67e22', '#95a5a6'
        ]
    }
};

/* ---------- ELEMENTOS DOM ---------- */
const DOM = {
    // Elementos principais
    list: document.getElementById('transaction-list'),
    totalRev: document.getElementById('total-revenue'),
    totalDes: document.getElementById('total-expenses'),
    balance: document.getElementById('balance'),
    legenda: document.getElementById('categoria-legenda-container'),
    reset: document.getElementById('reset-btn'),
    titulo: document.getElementById('transacoes-titulo'),
    canvas: document.getElementById('pieChart'),
    
    // Modais
    resetModal: document.getElementById('reset-modal'),
    resetCancel: document.getElementById('reset-cancel'),
    resetConfirm: document.getElementById('reset-confirm'),
    
    deleteModal: document.getElementById('delete-modal'),
    deleteCancel: document.getElementById('delete-cancel'),
    deleteConfirm: document.getElementById('delete-confirm'),
    deleteBody: document.getElementById('delete-modal-body'),
    
    // Alertas e PWA
    transactionsSection: document.getElementById('transactions-section'),
    negativeAlert: document.getElementById('negative-alert'),
    installPrompt: document.getElementById('install-prompt'),
    installCancel: document.getElementById('install-cancel'),
    installConfirm: document.getElementById('install-confirm'),
    
    // Botões de ação
    addRevenueBtn: document.getElementById('add-revenue-btn'),
    addExpenseBtn: document.getElementById('add-expense-btn'),
    shareReceita: document.getElementById('share-receita'),
    
    // Formulário Receita
    formOverlayRevenue: document.getElementById('form-overlay-revenue'),
    closeFormBtnRevenue: document.getElementById('close-form-btn-revenue'),
    formRevenue: document.getElementById('transaction-form-revenue'),
    amountRevenue: document.getElementById('amount-revenue'),
    originRevenue: document.getElementById('origin-revenue'),
    dateRevenue: document.getElementById('date-revenue'),
    fixaRevenue: document.getElementById('fixa-revenue'),
    btnSaveRevenue: document.getElementById('save-btn-revenue'),
    
    // Formulário Despesa
    formOverlayExpense: document.getElementById('form-overlay-expense'),
    closeFormBtnExpense: document.getElementById('close-form-btn-expense'),
    formExpense: document.getElementById('transaction-form-expense'),
    descExpense: document.getElementById('description-expense'),
    amountExpense: document.getElementById('amount-expense'),
    categoryExpense: document.getElementById('category-expense'),
    dateExpense: document.getElementById('date-expense'),
    fixaExpense: document.getElementById('fixa-expense'),
    parceladoExpense: document.getElementById('parcelado-expense'),
    parcelasExpense: document.getElementById('parcelas-expense'),
    parcelasDivExpense: document.getElementById('parcelas-field-div-expense'),
    btnSaveExpense: document.getElementById('save-btn-expense'),
    charCountExpense: document.getElementById('char-count-expense')
};

/* ---------- ESTADO GLOBAL ---------- */
const STATE = {
    transactions: JSON.parse(localStorage.getItem('transactions') || '[]'),
    chart: null,
    editIndex: null,
    deleteIndex: null,
    deferredPrompt: null,
    saldoNegAlert: false,
    alertTimeout: null
};

/* ---------- UTILITÁRIOS ---------- */
const UTILS = {
    hoje: new Date(),
    
    get mesAtualStr() {
        return `${this.hoje.getFullYear()}-${String(this.hoje.getMonth() + 1).padStart(2, '0')}`;
    },
    
    getMesAnoStr(data) {
        if (typeof data === 'string') {
            return data.slice(0, 7);
        }
        return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    },
    
    getMesAnoParcela(dataBase, numeroParcela) {
        const data = new Date(dataBase);
        data.setMonth(data.getMonth() + numeroParcela - 1);
        return this.getMesAnoStr(data);
    },
    
    parseParcelaInfo(texto) {
        const textoLimpo = texto.replace('📌 ', '');
        const match = textoLimpo.match(/(.*)\s(\d+)\/(\d+)$/);
        return match ? {
            baseDesc: match[1],
            parcelaAtual: parseInt(match[2]),
            totalParcelas: parseInt(match[3])
        } : null;
    },
    
    formataReal(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    },
    
    validarValor(valor) {
        return !isNaN(valor) && valor > 0;
    }
};

/* ---------- GERENCIAMENTO DE DADOS ---------- */
const DATA_MANAGER = {
    salvar() {
        localStorage.setItem('transactions', JSON.stringify(STATE.transactions));
    },
    
    obterTransacoesDoMes(mes = UTILS.mesAtualStr) {
        return STATE.transactions.filter(transacao => {
            const parcelaInfo = UTILS.parseParcelaInfo(transacao.description);
            const mesTransacao = parcelaInfo 
                ? UTILS.getMesAnoParcela(transacao.dataLancamento, parcelaInfo.parcelaAtual)
                : UTILS.getMesAnoStr(transacao.dataLancamento);
            
            return mesTransacao === mes;
        });
    },
    
    calcularTotais(transacoes = STATE.transactions) {
        const transacoesMes = this.obterTransacoesDoMes();
        let receita = 0;
        let despesa = 0;
        
        transacoesMes.forEach(transacao => {
            if (transacao.type === 'revenue') {
                receita += transacao.amount;
            } else {
                despesa += transacao.amount;
            }
        });
        
        return { receita, despesa, saldo: receita - despesa };
    }
};

/* ---------- GERENCIAMENTO DE ZOOM ---------- */
const ZOOM_MANAGER = {
    init() {
        this.bloquearGestos();
        this.bloquearTeclado();
        this.bloquearWheel();
    },
    
    bloquearGestos() {
        ['gesturestart', 'gesturechange', 'gestureend'].forEach(evento => {
            document.addEventListener(evento, e => e.preventDefault());
        });
    },
    
    bloquearTeclado() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && ['+', '-', '0', '='].includes(e.key)) {
                e.preventDefault();
            }
        });
    },
    
    bloquearWheel() {
        document.addEventListener('wheel', e => {
            if (e.ctrlKey) e.preventDefault();
        }, { passive: false });
    }
};

/* ---------- GERENCIAMENTO DE ALERTAS ---------- */
const ALERT_MANAGER = {
    verificarSaldoNegativo(saldo) {
        if (STATE.alertTimeout) {
            clearTimeout(STATE.alertTimeout);
            STATE.alertTimeout = null;
        }
        
        if (saldo < 0 && !STATE.saldoNegAlert) {
            DOM.negativeAlert.style.display = 'block';
            STATE.saldoNegAlert = true;
            
            STATE.alertTimeout = setTimeout(() => {
                DOM.negativeAlert.style.display = 'none';
                STATE.saldoNegAlert = false;
            }, 5000);
        } else if (saldo >= 0) {
            DOM.negativeAlert.style.display = 'none';
            STATE.saldoNegAlert = false;
        }
    }
};

/* ---------- GERENCIAMENTO DE FORMULÁRIOS ---------- */
const FORM_MANAGER = {
    init() {
        this.inicializarContadorCaracteres();
        this.popularSelects();
        this.configurarEventos();
    },
    
    inicializarContadorCaracteres() {
        DOM.descExpense.addEventListener('input', () => {
            let count = DOM.descExpense.value.length;
            if (count > 12) {
                DOM.descExpense.value = DOM.descExpense.value.slice(0, 12);
                count = 12;
            }
            DOM.charCountExpense.textContent = count;
            DOM.charCountExpense.parentElement.classList.toggle('warning', count >= 12);
        });
    },
    
    popularSelects() {
        // Limpar selects existentes
        DOM.originRevenue.innerHTML = '';
        DOM.categoryExpense.innerHTML = '';
        
        // Popular origem de receitas
        CONFIG.categories.revenue.forEach(origem => {
            const option = document.createElement('option');
            option.value = origem;
            option.textContent = origem;
            DOM.originRevenue.appendChild(option);
        });
        
        // Popular categorias de despesas
        CONFIG.categories.expense.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria;
            option.textContent = categoria;
            DOM.categoryExpense.appendChild(option);
        });
    },
    
    configurarEventos() {
        // Eventos de formulário de receita
        DOM.formRevenue.addEventListener('submit', (e) => {
            e.preventDefault();
            this.processarFormulario('revenue');
        });
        
        // Eventos de formulário de despesa
        DOM.formExpense.addEventListener('submit', (e) => {
            e.preventDefault();
            this.processarFormulario('expense');
        });
        
        DOM.parceladoExpense.addEventListener('change', () => {
            DOM.parcelasDivExpense.classList.toggle('visible', DOM.parceladoExpense.checked);
        });
    },
    
    abrir(tipo) {
        const hoje = new Date().toISOString().split('T')[0];
        
        if (tipo === 'revenue') {
            DOM.formRevenue.reset();
            DOM.dateRevenue.value = hoje;
            DOM.fixaRevenue.checked = false;
            DOM.btnSaveRevenue.textContent = 'Adicionar';
            DOM.originRevenue.focus();
            DOM.formOverlayRevenue.style.display = 'flex';
        } else {
            DOM.formExpense.reset();
            DOM.dateExpense.value = hoje;
            DOM.fixaExpense.checked = false;
            DOM.btnSaveExpense.textContent = 'Adicionar';
            DOM.parcelasDivExpense.classList.remove('visible');
            DOM.charCountExpense.textContent = '0';
            DOM.charCountExpense.parentElement.classList.remove('warning');
            DOM.descExpense.focus();
            DOM.formOverlayExpense.style.display = 'flex';
        }
        
        setTimeout(() => {
            document.activeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 300);
    },
    
    fechar(tipo) {
        if (tipo === 'revenue') {
            DOM.formOverlayRevenue.style.display = 'none';
            DOM.formRevenue.reset();
        } else {
            DOM.formOverlayExpense.style.display = 'none';
            DOM.formExpense.reset();
            DOM.parcelasDivExpense.classList.remove('visible');
            DOM.charCountExpense.textContent = '0';
            DOM.charCountExpense.parentElement.classList.remove('warning');
        }
        STATE.editIndex = null;
    },
    
    processarFormulario(tipo) {
        if (tipo === 'revenue') {
            this.processarReceita();
        } else {
            this.processarDespesa();
        }
    },
    
    processarReceita() {
        const origem = DOM.originRevenue.value.trim();
        const valor = parseFloat(DOM.amountRevenue.value);
        const data = DOM.dateRevenue.value;
        const ehFixa = DOM.fixaRevenue.checked;
        
        if (!UTILS.validarValor(valor)) {
            alert('Por favor, insira um valor válido para a receita.');
            return;
        }
        
        this.salvarTransacao({
            descricao: origem,
            valor: valor,
            tipo: 'revenue',
            categoria: origem,
            data: data,
            ehFixa: ehFixa,
            ehParcelado: false,
            numParcelas: 1
        }, 'revenue');
    },
    
    processarDespesa() {
        const descricao = DOM.descExpense.value.trim();
        const valor = parseFloat(DOM.amountExpense.value);
        const categoria = DOM.categoryExpense.value;
        const data = DOM.dateExpense.value;
        const ehParcelado = DOM.parceladoExpense.checked;
        const numParcelas = parseInt(DOM.parcelasExpense.value) || 1;
        const ehFixa = DOM.fixaExpense.checked;
        
        if (!descricao) {
            alert('Por favor, insira uma descrição para a despesa.');
            return;
        }
        
        if (!UTILS.validarValor(valor)) {
            alert('Por favor, insira um valor válido para a despesa.');
            return;
        }
        
        this.salvarTransacao({
            descricao: descricao,
            valor: valor,
            tipo: 'expense',
            categoria: categoria,
            data: data,
            ehFixa: ehFixa,
            ehParcelado: ehParcelado,
            numParcelas: numParcelas
        }, 'expense');
    },
    
    salvarTransacao(dados, formType) {
        let { descricao, valor, tipo, categoria, data, ehFixa, ehParcelado, numParcelas } = dados;
        
        // Limitar descrição a 12 caracteres
        descricao = descricao.trim();
        if (descricao.length > 12) {
            descricao = descricao.slice(0, 12);
        }
        
        // Se for fixa, adicionar ícone à descrição (pino na frente)
        const descricaoFinal = ehFixa ? `📌 ${descricao}` : descricao;
        const dataLancamento = data ? new Date(data + 'T00:00:00').toISOString() : new Date().toISOString();
        const novasTransacoes = [];
        
        // Modo edição
        if (STATE.editIndex !== null) {
            this.processarEdicao(descricaoFinal, valor, tipo, categoria, dataLancamento, ehFixa, ehParcelado, numParcelas);
        } else {
            // Modo criação
            if (ehParcelado && numParcelas >= 2) {
                const valorParcela = valor / numParcelas;
                for (let i = 1; i <= numParcelas; i++) {
                    const dataParcela = new Date(dataLancamento);
                    dataParcela.setMonth(dataParcela.getMonth() + i - 1);
                    
                    novasTransacoes.push({
                        description: `${descricaoFinal} ${i}/${numParcelas}`,
                        amount: parseFloat(valorParcela.toFixed(2)),
                        type: tipo,
                        category: categoria,
                        dataLancamento: dataParcela.toISOString(),
                        fixa: ehFixa
                    });
                }
            } else {
                novasTransacoes.push({
                    description: descricaoFinal,
                    amount: valor,
                    type: tipo,
                    category: categoria,
                    dataLancamento: dataLancamento,
                    fixa: ehFixa
                });
            }
            STATE.transactions.push(...novasTransacoes);
        }
        
        DATA_MANAGER.salvar();
        RENDER_MANAGER.renderizarTudo();
        this.fechar(formType);
        
        if (STATE.editIndex === null) {
            setTimeout(() => {
                DOM.transactionsSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 100);
        }
    },
    
    processarEdicao(descricao, valor, tipo, categoria, dataLancamento, ehFixa, ehParcelado, numParcelas) {
        const transacaoOriginal = STATE.transactions[STATE.editIndex];
        const infoParcela = UTILS.parseParcelaInfo(transacaoOriginal.description);
        const novasTransacoes = [];
        
        // Caso 1: Era parcelada, agora não é mais
        if (infoParcela && !ehParcelado) {
            STATE.transactions = STATE.transactions.filter(transacao => {
                const info = UTILS.parseParcelaInfo(transacao.description);
                return !info || info.baseDesc !== infoParcela.baseDesc;
            });
            novasTransacoes.push({
                description: descricao,
                amount: valor,
                type: tipo,
                category: categoria,
                dataLancamento: dataLancamento,
                fixa: ehFixa
            });
        }
        // Caso 2: Não era parcelada, agora é
        else if (!infoParcela && ehParcelado) {
            const valorParcela = valor / numParcelas;
            for (let i = 1; i <= numParcelas; i++) {
                const dataParcela = new Date(dataLancamento);
                dataParcela.setMonth(dataParcela.getMonth() + i - 1);
                
                novasTransacoes.push({
                    description: `${descricao} ${i}/${numParcelas}`,
                    amount: parseFloat(valorParcela.toFixed(2)),
                    type: tipo,
                    category: categoria,
                    dataLancamento: dataParcela.toISOString(),
                    fixa: ehFixa
                });
            }
            STATE.transactions.splice(STATE.editIndex, 1);
        }
        // Caso 3: Era parcelada e continua sendo (possivelmente com alterações)
        else if (infoParcela && ehParcelado) {
            STATE.transactions = STATE.transactions.filter(transacao => {
                const info = UTILS.parseParcelaInfo(transacao.description);
                return !info || info.baseDesc !== infoParcela.baseDesc;
            });
            const valorParcela = valor / numParcelas;
            for (let i = 1; i <= numParcelas; i++) {
                const dataParcela = new Date(dataLancamento);
                dataParcela.setMonth(dataParcela.getMonth() + i - 1);
                
                novasTransacoes.push({
                    description: `${descricao} ${i}/${numParcelas}`,
                    amount: parseFloat(valorParcela.toFixed(2)),
                    type: tipo,
                    category: categoria,
                    dataLancamento: dataParcela.toISOString(),
                    fixa: ehFixa
                });
            }
        }
        // Caso 4: Edição simples sem mudança de parcelamento
        else {
            STATE.transactions[STATE.editIndex] = {
                description: descricao,
                amount: valor,
                type: tipo,
                category: categoria,
                dataLancamento: dataLancamento,
                fixa: ehFixa
            };
        }
        
        if (novasTransacoes.length) {
            STATE.transactions.push(...novasTransacoes);
        }
        STATE.editIndex = null;
    }
};

/* ---------- GERENCIAMENTO DE RENDERIZAÇÃO ---------- */
const RENDER_MANAGER = {
    renderizarTudo() {
        this.renderizarTransacoes();
        this.renderizarLegenda();
        this.renderizarGrafico();
    },
    
    renderizarTransacoes() {
        DOM.list.innerHTML = '';
        const { receita, despesa } = DATA_MANAGER.calcularTotais();
        const mesAtual = UTILS.mesAtualStr;
        
        // Mapeamento de cores por categoria
        const categoriaCores = {
            // Receitas
            'Adiantamento': CONFIG.chartColors.revenue,
            'Pagamento': CONFIG.chartColors.revenue,
            'Empréstimo': CONFIG.chartColors.revenue,
            'Investimento': CONFIG.chartColors.revenue,
            'Monetização': CONFIG.chartColors.revenue,
            'Lucro': CONFIG.chartColors.revenue,
            'Venda': CONFIG.chartColors.revenue,
            'Outros': CONFIG.chartColors.revenue,
            // Despesas
            'Alimentação': CONFIG.chartColors.expenses[0],
            'Lazer': CONFIG.chartColors.expenses[1],
            'Transporte': CONFIG.chartColors.expenses[2],
            'Moradia': CONFIG.chartColors.expenses[3],
            'Saúde': CONFIG.chartColors.expenses[4],
            'Educação': CONFIG.chartColors.expenses[5],
            'Outros': CONFIG.chartColors.expenses[6]
        };
        
        STATE.transactions.forEach((transacao, index) => {
            const infoParcela = UTILS.parseParcelaInfo(transacao.description);
            let mostra = false;
            let descricaoDisplay = transacao.description;
            let mesDisplay = '';
            
            // Verificar se a transação pertence ao mês atual
            if (infoParcela) {
                const mesParcela = UTILS.getMesAnoParcela(transacao.dataLancamento, infoParcela.parcelaAtual);
                mostra = mesParcela === mesAtual;
                if (mostra) {
                    const data = new Date(transacao.dataLancamento);
                    data.setMonth(data.getMonth() + infoParcela.parcelaAtual - 1);
                    mesDisplay = CONFIG.meses[data.getMonth()];
                    descricaoDisplay = `${infoParcela.baseDesc} (${infoParcela.parcelaAtual}/${infoParcela.totalParcelas})`;
                }
            } else {
                const mesTransacao = UTILS.getMesAnoStr(transacao.dataLancamento);
                mostra = mesTransacao === mesAtual;
                if (mostra) {
                    mesDisplay = CONFIG.meses[new Date(transacao.dataLancamento).getMonth()];
                }
            }
            
            if (!mostra) return;
            
            const dia = new Date(transacao.dataLancamento).getDate().toString().padStart(2, '0');
            const ehParcelada = infoParcela !== null;
            const corCategoria = categoriaCores[transacao.category] || '#95a5a6';
            
            const linha = document.createElement('tr');
            linha.innerHTML = `
                <td style="white-space:nowrap; overflow: hidden; text-overflow: ellipsis;" title="${descricaoDisplay}">
                    ${descricaoDisplay}
                </td>
                <td class="${transacao.type === 'revenue' ? 'positive' : 'negative'}" style="white-space:nowrap; overflow: hidden; text-overflow: ellipsis;" title="${UTILS.formataReal(transacao.amount)}">
                    ${UTILS.formataReal(transacao.amount)}
                </td>
                <td class="data-cell" style="white-space:nowrap">${dia}/${mesDisplay}</td>
                <td style="text-align: center;">
                    <div class="category-dot" style="background-color: ${corCategoria}" data-category="${transacao.category}">
                        <div class="category-tooltip">${transacao.category}</div>
                    </div>
                </td>
                <td>
                    <div class="actions-cell">
                        ${!ehParcelada ? 
                            `<button class="edit-btn" data-i="${index}" title="Editar">✏️</button>` : 
                            '<span class="edit-placeholder"></span>'
                        }
                        <button class="delete-btn" data-i="${index}" title="Excluir">🗑️</button>
                    </div>
                </td>
            `;
            DOM.list.appendChild(linha);
        });
        
        // Adicionar eventos para tooltips em mobile
        this.configurarTooltipsMobile();
        
        this.atualizarResumo(receita, despesa);
        DOM.titulo.textContent = `Transações (${CONFIG.meses[UTILS.hoje.getMonth()]})`;
    },
    
    configurarTooltipsMobile() {
        const categoryDots = document.querySelectorAll('.category-dot');
        
        categoryDots.forEach(dot => {
            // Para desktop - hover
            dot.addEventListener('mouseenter', function() {
                this.classList.add('tooltip-visible');
            });
            
            dot.addEventListener('mouseleave', function() {
                this.classList.remove('tooltip-visible');
            });
            
            // Para mobile - touch
            dot.addEventListener('touchstart', function(e) {
                e.preventDefault();
                this.classList.add('tooltip-visible');
                
                // Fechar tooltip quando tocar em outro lugar
                setTimeout(() => {
                    const closeTooltip = (e) => {
                        if (!this.contains(e.target)) {
                            this.classList.remove('tooltip-visible');
                            document.removeEventListener('touchstart', closeTooltip);
                        }
                    };
                    document.addEventListener('touchstart', closeTooltip);
                }, 100);
            });
        });
    },
    
    atualizarResumo(receita, despesa) {
        const saldo = receita - despesa;
        ALERT_MANAGER.verificarSaldoNegativo(saldo);
        
        DOM.totalRev.textContent = UTILS.formataReal(receita);
        DOM.totalDes.textContent = UTILS.formataReal(despesa);
        DOM.balance.textContent = UTILS.formataReal(saldo);
        DOM.balance.className = saldo < 0 ? 'negative' : 'info';
    },
    
    renderizarLegenda() {
        const mesAtual = UTILS.mesAtualStr;
        let receitaTotal = 0;
        const despesasPorCategoria = {};
        
        // Inicializar categorias de despesa
        CONFIG.categories.expense.forEach(categoria => {
            despesasPorCategoria[categoria] = 0;
        });
        
        // Calcular totais
        STATE.transactions.forEach(transacao => {
            const infoParcela = UTILS.parseParcelaInfo(transacao.description);
            const mesItem = infoParcela 
                ? UTILS.getMesAnoParcela(transacao.dataLancamento, infoParcela.parcelaAtual)
                : UTILS.getMesAnoStr(transacao.dataLancamento);
            
            if (mesItem !== mesAtual) return;
            
            if (transacao.type === 'revenue') {
                receitaTotal += transacao.amount;
            } else if (despesasPorCategoria.hasOwnProperty(transacao.category)) {
                despesasPorCategoria[transacao.category] += transacao.amount;
            }
        });
        
        const totalDespesas = Object.values(despesasPorCategoria).reduce((a, b) => a + b, 0);
        const saldo = receitaTotal - totalDespesas;
        
        // Gerar HTML da legenda
        const legendas = [];
        
        // Legenda para receita (saldo)
        if (receitaTotal > 0) {
            const percentual = saldo < 0 ? 0 : (saldo / receitaTotal) * 100;
            legendas.push(`
                <div class="categoria-legenda">
                    <span class="cor-blob" style="background:${CONFIG.chartColors.revenue}"></span>
                    Receita ${percentual.toFixed(0)}%
                </div>
            `);
        }
        
        // Legendas para despesas
        CONFIG.categories.expense.forEach((categoria, index) => {
            const valor = despesasPorCategoria[categoria] || 0;
            if (valor > 0) {
                const percentual = receitaTotal > 0 ? (valor / receitaTotal) * 100 : 0;
                legendas.push(`
                    <div class="categoria-legenda">
                        <span class="cor-blob" style="background:${CONFIG.chartColors.expenses[index]}"></span>
                        ${categoria} ${percentual.toFixed(0)}%
                    </div>
                `);
            }
        });
        
        DOM.legenda.innerHTML = legendas.join('');
    },
    
    renderizarGrafico() {
        const mesAtual = UTILS.mesAtualStr;
        let receitaTotal = 0;
        const despesasPorCategoria = {};
        
        // Inicializar categorias
        CONFIG.categories.expense.forEach(categoria => {
            despesasPorCategoria[categoria] = 0;
        });
        
        // Calcular totais para o gráfico
        STATE.transactions.forEach(transacao => {
            const infoParcela = UTILS.parseParcelaInfo(transacao.description);
            const mesItem = infoParcela
                ? UTILS.getMesAnoParcela(transacao.dataLancamento, infoParcela.parcelaAtual)
                : UTILS.getMesAnoStr(transacao.dataLancamento);
            
            if (mesItem !== mesAtual) return;
            
            if (transacao.type === 'revenue') {
                receitaTotal += transacao.amount;
            } else if (despesasPorCategoria.hasOwnProperty(transacao.category)) {
                despesasPorCategoria[transacao.category] += transacao.amount;
            }
        });
        
        const totalDespesas = Object.values(despesasPorCategoria).reduce((a, b) => a + b, 0);
        const receitaDisponivel = receitaTotal - totalDespesas;
        
        // Preparar dados para o gráfico
        const labels = [];
        const dados = [];
        const cores = [];
        
        // Adicionar receita disponível (saldo)
        if (receitaDisponivel > 0) {
            labels.push('Receita');
            dados.push(receitaDisponivel);
            cores.push(CONFIG.chartColors.revenue);
        }
        
        // Adicionar despesas por categoria
        CONFIG.categories.expense.forEach((categoria, index) => {
            const valor = despesasPorCategoria[categoria] || 0;
            if (valor > 0) {
                labels.push(categoria);
                dados.push(valor);
                cores.push(CONFIG.chartColors.expenses[index]);
            }
        });
        
        // Destruir gráfico existente
        if (STATE.chart) {
            STATE.chart.destroy();
        }
        
        // Criar novo gráfico
        if (dados.length > 0) {
            STATE.chart = new Chart(DOM.canvas, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: dados,
                        backgroundColor: cores
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: false }
                    },
                    responsive: true,
                    maintainAspectRatio: true
                }
            });
        }
    }
};

/* ---------- GERENCIAMENTO DE AÇÕES ---------- */
const ACTION_MANAGER = {
    configurarEventos() {
        // Ações de clique na lista
        DOM.list.addEventListener('click', (e) => this.handleAcoes(e));
        
        // Botões de adicionar
        DOM.addRevenueBtn.addEventListener('click', () => FORM_MANAGER.abrir('revenue'));
        DOM.addExpenseBtn.addEventListener('click', () => FORM_MANAGER.abrir('expense'));
        
        // Fechar formulários
        DOM.closeFormBtnRevenue.addEventListener('click', () => FORM_MANAGER.fechar('revenue'));
        DOM.closeFormBtnExpense.addEventListener('click', () => FORM_MANAGER.fechar('expense'));
        
        // Modais de reset
        DOM.reset.addEventListener('click', () => DOM.resetModal.style.display = 'flex');
        DOM.resetCancel.addEventListener('click', () => DOM.resetModal.style.display = 'none');
        DOM.resetConfirm.addEventListener('click', () => this.resetarDados());
        
        // Modais de exclusão
        DOM.deleteCancel.addEventListener('click', () => {
            DOM.deleteModal.style.display = 'none';
            STATE.deleteIndex = null;
        });
        DOM.deleteConfirm.addEventListener('click', () => this.confirmarExclusao());
        
        // Cliques fora dos modais/formulários
        window.addEventListener('click', (e) => this.handleCliqueFora(e));
    },
    
    handleAcoes(e) {
        const indice = parseInt(e.target.dataset.i);
        
        if (e.target.classList.contains('delete-btn')) {
            this.abrirModalExclusao(indice);
        }
        
        if (e.target.classList.contains('edit-btn')) {
            this.editarTransacao(indice);
        }
    },
    
    abrirModalExclusao(indice) {
        STATE.deleteIndex = indice;
        const transacao = STATE.transactions[indice];
        const infoParcela = UTILS.parseParcelaInfo(transacao.description);
        
        DOM.deleteBody.textContent = infoParcela
            ? `Tem certeza que deseja excluir TODAS as parcelas de "${infoParcela.baseDesc}"?`
            : `Tem certeza que deseja excluir "${transacao.description}"?`;
        
        DOM.deleteModal.style.display = 'flex';
    },
    
    editarTransacao(indice) {
        const transacao = STATE.transactions[indice];
        const descricaoSemFixa = transacao.description.replace('📌 ', '');
        const infoParcela = UTILS.parseParcelaInfo(descricaoSemFixa);
        const ehFixa = transacao.description.includes('📌');
        
        // Format date for input (YYYY-MM-DD)
        const dataTransacao = new Date(transacao.dataLancamento);
        const dataFormatada = dataTransacao.toISOString().split('T')[0];
        
        if (transacao.type === 'revenue') {
            FORM_MANAGER.abrir('revenue');
            DOM.amountRevenue.value = transacao.amount * (infoParcela ? infoParcela.totalParcelas : 1);
            DOM.originRevenue.value = transacao.category;
            DOM.dateRevenue.value = dataFormatada;
            DOM.fixaRevenue.checked = ehFixa;
            DOM.btnSaveRevenue.textContent = 'Salvar';
        } else {
            FORM_MANAGER.abrir('expense');
            DOM.descExpense.value = infoParcela ? infoParcela.baseDesc : descricaoSemFixa;
            DOM.amountExpense.value = transacao.amount * (infoParcela ? infoParcela.totalParcelas : 1);
            DOM.categoryExpense.value = transacao.category;
            DOM.dateExpense.value = dataFormatada;
            DOM.fixaExpense.checked = ehFixa;
            
            if (infoParcela) {
                DOM.parceladoExpense.checked = true;
                DOM.parcelasDivExpense.classList.add('visible');
                DOM.parcelasExpense.value = infoParcela.totalParcelas;
            } else {
                DOM.parceladoExpense.checked = false;
                DOM.parcelasDivExpense.classList.remove('visible');
            }
            
            const baseDesc = infoParcela ? infoParcela.baseDesc : descricaoSemFixa;
            const count = baseDesc.length;
            DOM.charCountExpense.textContent = count;
            DOM.charCountExpense.parentElement.classList.toggle('warning', count >= 12);
            DOM.btnSaveExpense.textContent = 'Salvar';
        }
        
        STATE.editIndex = indice;
    },
    
    confirmarExclusao() {
        if (STATE.deleteIndex !== null) {
            const transacao = STATE.transactions[STATE.deleteIndex];
            const infoParcela = UTILS.parseParcelaInfo(transacao.description);
            
            if (infoParcela) {
                STATE.transactions = STATE.transactions.filter(t => {
                    const info = UTILS.parseParcelaInfo(t.description);
                    return !info || info.baseDesc !== infoParcela.baseDesc;
                });
            } else {
                STATE.transactions.splice(STATE.deleteIndex, 1);
            }
            
            DATA_MANAGER.salvar();
            RENDER_MANAGER.renderizarTudo();
            DOM.deleteModal.style.display = 'none';
            STATE.deleteIndex = null;
        }
    },
    
    resetarDados() {
        STATE.transactions = [];
        DATA_MANAGER.salvar();
        RENDER_MANAGER.renderizarTudo();
        DOM.resetModal.style.display = 'none';
    },
    
    handleCliqueFora(e) {
        if (e.target === DOM.resetModal) DOM.resetModal.style.display = 'none';
        if (e.target === DOM.deleteModal) DOM.deleteModal.style.display = 'none';
        if (e.target === DOM.formOverlayRevenue) FORM_MANAGER.fechar('revenue');
        if (e.target === DOM.formOverlayExpense) FORM_MANAGER.fechar('expense');
    }
};

/* ---------- GERENCIAMENTO PWA ---------- */
const PWA_MANAGER = {
    init() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            STATE.deferredPrompt = e;
            
            setTimeout(() => {
                if (STATE.deferredPrompt) {
                    DOM.installPrompt.style.display = 'block';
                }
            }, 3000);
        });
        
        window.addEventListener('appinstalled', () => {
            STATE.deferredPrompt = null;
            DOM.installPrompt.style.display = 'none';
        });
        
        DOM.installConfirm.addEventListener('click', async () => {
            if (STATE.deferredPrompt) {
                STATE.deferredPrompt.prompt();
                const { outcome } = await STATE.deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    STATE.deferredPrompt = null;
                }
                DOM.installPrompt.style.display = 'none';
            }
        });
        
        DOM.installCancel.addEventListener('click', () => {
            DOM.installPrompt.style.display = 'none';
        });
    }
};

/* ---------- COMPARTILHAMENTO ---------- */
const SHARE_MANAGER = {
    init() {
        DOM.shareReceita.addEventListener('click', () => this.compartilharResumo());
    },
    
    async compartilharResumo() {
        const { receita, despesa, saldo } = DATA_MANAGER.calcularTotais();
        const mesAtual = CONFIG.meses[UTILS.hoje.getMonth()];
        
        // Calcular porcentagens por categoria
        const despesasPorCategoria = {};
        CONFIG.categories.expense.forEach(categoria => {
            despesasPorCategoria[categoria] = 0;
        });

        STATE.transactions.forEach(transacao => {
            if (transacao.type === 'expense') {
                const infoParcela = UTILS.parseParcelaInfo(transacao.description);
                const mesItem = infoParcela 
                    ? UTILS.getMesAnoParcela(transacao.dataLancamento, infoParcela.parcelaAtual)
                    : UTILS.getMesAnoStr(transacao.dataLancamento);
                
                if (mesItem === UTILS.mesAtualStr && despesasPorCategoria.hasOwnProperty(transacao.category)) {
                    despesasPorCategoria[transacao.category] += transacao.amount;
                }
            }
        });

        // Gerar texto das categorias com emojis de quadrado colorido
        const categoriasTexto = CONFIG.categories.expense.map((categoria, index) => {
            const valor = despesasPorCategoria[categoria] || 0;
            if (valor > 0 && receita > 0) {
                const percentual = (valor / receita) * 100;
                const quadrado = ['🟥','🟨','🟦','🟪','🟩','🟧','⬜'][index];
                return `${quadrado} ${categoria}: ${percentual.toFixed(1)}%`;
            }
            return '';
        }).filter(texto => texto !== '').join('\n');

        const texto = `💰 RESUMO FINANCEIRO - ${mesAtual}

📈 Receitas: ${UTILS.formataReal(receita)}
📉 Despesas: ${UTILS.formataReal(despesa)}
💎 Saldo: ${UTILS.formataReal(saldo)}

${categoriasTexto ? '📊 Gastos por Categoria:\n' + categoriasTexto : '📊 Nenhuma despesa registrada este mês'}

Gerado pelo CONT1 - Controle Financeiro`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Resumo Financeiro - ${mesAtual}`,
                    text: texto
                });
            } else {
                await navigator.clipboard.writeText(texto);
                alert('Resumo copiado para a área de transferência!');
            }
        } catch (err) {
            console.log('Erro ao compartilhar:', err);
        }
    }
};

/* ---------- GERENCIAMENTO DE LIMPEZA MENSAL ---------- */
const MONTHLY_CLEANER = {
    ultimoMesVerificado: localStorage.getItem('ultimoMesVerificado'),
    mesAtual: UTILS.mesAtualStr,
    
    init() {
        this.verificarMudancaMes();
        this.configurarVerificacaoDiaria();
    },
    
    verificarMudancaMes() {
        // Se é um novo mês e ainda não verificamos
        if (this.ultimoMesVerificado !== this.mesAtual) {
            const transacoesAntigas = this.obterTransacoesMesesAnteriores();
            
            if (transacoesAntigas.length > 0) {
                this.mostrarAlertaMudancaMes(transacoesAntigas.length);
                this.limparTransacoesAntigas();
            }
            
            // Atualizar o último mês verificado
            localStorage.setItem('ultimoMesVerificado', this.mesAtual);
            this.ultimoMesVerificado = this.mesAtual;
        }
    },
    
    obterTransacoesMesesAnteriores() {
        const mesAtual = UTILS.mesAtualStr;
        return STATE.transactions.filter(transacao => {
            // Ignorar transações fixas
            if (transacao.fixa) return false;
            
            const infoParcela = UTILS.parseParcelaInfo(transacao.description);
            const mesTransacao = infoParcela 
                ? UTILS.getMesAnoParcela(transacao.dataLancamento, infoParcela.parcelaAtual)
                : UTILS.getMesAnoStr(transacao.dataLancamento);
            
            return mesTransacao < mesAtual;
        });
    },
    
    limparTransacoesAntigas() {
        const mesAtual = UTILS.mesAtualStr;
        
        STATE.transactions = STATE.transactions.filter(transacao => {
            // MANTER transações fixas independentemente do mês
            if (transacao.fixa) {
                return true;
            }
            
            const infoParcela = UTILS.parseParcelaInfo(transacao.description);
            
            // Se é uma parcela, verifica se alguma parcela futura pertence a este mês ou meses futuros
            if (infoParcela) {
                for (let i = infoParcela.parcelaAtual; i <= infoParcela.totalParcelas; i++) {
                    const mesParcela = UTILS.getMesAnoParcela(transacao.dataLancamento, i);
                    if (mesParcela >= mesAtual) {
                        return true; // Mantém se há parcelas futuras
                    }
                }
                return false; // Remove se todas as parcelas são do passado
            }
            
            // Para transações únicas, mantém apenas as do mês atual ou futuras
            const mesTransacao = UTILS.getMesAnoStr(transacao.dataLancamento);
            return mesTransacao >= mesAtual;
        });
        
        DATA_MANAGER.salvar();
        RENDER_MANAGER.renderizarTudo();
    },
    
    mostrarAlertaMudancaMes(numTransacoesRemovidas) {
        const mesAnterior = this.obterMesAnterior();
        const alertaHTML = `
            <div class="month-change-alert" id="month-change-alert">
                <div class="month-change-content">
                    <div class="month-change-header">
                        <span>📅 Novo Mês - ${CONFIG.meses[UTILS.hoje.getMonth()]}</span>
                        <button class="close-alert" id="close-month-alert">×</button>
                    </div>
                    <div class="month-change-body">
                        <p>As transações de <strong>${mesAnterior}</strong> foram arquivadas automaticamente.</p>
                        <p>Mantemos apenas as parcelas pendentes para o controle atual.</p>
                        <p class="small-info">${numTransacoesRemovidas} transação(s) do mês anterior foram removidas da visualização.</p>
                    </div>
                    <div class="month-change-footer">
                        <button class="month-change-btn" id="understand-month-alert">Entendi</button>
                    </div>
                </div>
            </div>
        `;
        
        // Adicionar o alerta ao body
        document.body.insertAdjacentHTML('beforeend', alertaHTML);
        
        // Configurar eventos do alerta
        const alerta = document.getElementById('month-change-alert');
        const fecharBtn = document.getElementById('close-month-alert');
        const entenderBtn = document.getElementById('understand-month-alert');
        
        const fecharAlerta = () => {
            alerta.style.opacity = '0';
            setTimeout(() => {
                if (alerta.parentNode) {
                    alerta.parentNode.removeChild(alerta);
                }
            }, 300);
        };
        
        fecharBtn.addEventListener('click', fecharAlerta);
        entenderBtn.addEventListener('click', fecharAlerta);
        
        // Fechar automaticamente após 8 segundos
        setTimeout(fecharAlerta, 8000);
    },
    
    obterMesAnterior() {
        const data = new Date();
        data.setMonth(data.getMonth() - 1);
        return CONFIG.meses[data.getMonth()];
    },
    
    configurarVerificacaoDiaria() {
        // Verificar a cada hora se mudou o mês
        setInterval(() => {
            const novoMesAtual = UTILS.mesAtualStr;
            if (novoMesAtual !== this.mesAtual) {
                this.mesAtual = novoMesAtual;
                this.verificarMudancaMes();
            }
        }, 3600000); // 1 hora
    }
};

/* ---------- INICIALIZAÇÃO DA APLICAÇÃO ---------- */
function init() {
    ZOOM_MANAGER.init();
    PWA_MANAGER.init();
    FORM_MANAGER.init();
    ACTION_MANAGER.configurarEventos();
    SHARE_MANAGER.init();
    MONTHLY_CLEANER.init();
    
    // Renderização inicial
    RENDER_MANAGER.renderizarTudo();
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}