const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ⚠️ SUBSTITUA A LINHA ABAIXO PELA SUA STRING DO MONGODB ⚠️
// Cole aqui a string que você anotou na ETAPA 1
const MONGODB_URI = 'mongodb+srv://cont1user:<db_password>@cluster0.bmr0enk.mongodb.net/cont1?appName=Cluster0';

// Conectar ao MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas'))
  .catch(err => console.log('❌ Erro ao conectar MongoDB:', err));

// Schemas do banco de dados
const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: String,
  amount: Number,
  type: String,
  category: String,
  dataLancamento: Date,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

const JWT_SECRET = 'cont1_secret_key_2024_finance_app';

// Middleware de autenticação
const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Acesso negado. Faça login.' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido. Faça login novamente.' });
  }
};

// ================== ROTAS DA API ==================

// Rota de saúde da API
app.get('/api/health', (req, res) => {
  res.json({ 
    status: '✅ Online', 
    message: 'CONT1 Backend está funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Cadastro de usuário
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verificar se email e senha foram fornecidos
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    
    // Verificar se usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Este email já está cadastrado' });
    }
    
    // Criar novo usuário
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    
    // Gerar token
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    
    res.json({ 
      success: true,
      token, 
      user: { 
        id: user._id, 
        email: user.email 
      },
      message: 'Cadastro realizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Login de usuário
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    
    // Buscar usuário
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Email ou senha incorretos' });
    }
    
    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Email ou senha incorretos' });
    }
    
    // Gerar token
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    
    res.json({ 
      success: true,
      token, 
      user: { 
        id: user._id, 
        email: user.email 
      },
      message: 'Login realizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ================== ROTAS DE TRANSAÇÕES ==================

// Buscar todas as transações do usuário
app.get('/api/transactions', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ dataLancamento: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar transações' });
  }
});

// Adicionar nova transação
app.post('/api/transactions', auth, async (req, res) => {
  try {
    const transaction = new Transaction({ 
      ...req.body, 
      userId: req.user._id 
    });
    await transaction.save();
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar transação' });
  }
});

// Atualizar transação
app.put('/api/transactions/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }
    
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar transação' });
  }
});

// Deletar transação específica
app.delete('/api/transactions/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }
    
    res.json({ 
      success: true,
      message: 'Transação deletada com sucesso' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar transação' });
  }
});

// Deletar TODAS as transações do usuário
app.delete('/api/transactions', auth, async (req, res) => {
  try {
    await Transaction.deleteMany({ userId: req.user._id });
    res.json({ 
      success: true,
      message: 'Todas as transações foram deletadas' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar transações' });
  }
});

// ================== INICIAR SERVIDOR ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor CONT1 rodando na porta ${PORT}`);
  console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado'}`);
});
