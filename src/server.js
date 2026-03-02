const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const prisma = new PrismaClient();
const SECRET_KEY = "segredo-super-secreto-mude-isso";

app.use(express.json());
app.use(cors());

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
// Isso garante que apenas usuários logados acessem certas rotas 
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: "Acesso negado." });

    try {
        // O token vem como "Bearer xyz...", pegamos só o "xyz..."
        const cleanToken = token.split(" ")[1];
        const decoded = jwt.verify(cleanToken, SECRET_KEY);
        req.userId = decoded.id; // Salvamos o ID do usuário para usar depois
        next();
    } catch (error) {
        res.status(401).json({ error: "Token inválido." });
    }
};

// --- ROTAS DE USUÁRIO ---

// 1. Cadastro 
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    // Criptografar a senha antes de salvar
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.create({
            data: { username, password: hashedPassword }
        });
        res.json({ id: user.id, username: user.username });
    } catch (error) {
        console.log(error); 
        res.status(400).json({ error: "Usuário já existe ou erro nos dados." });
    }
});

// 2. Login (Gera o Token JWT)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, userId: user.id });
});

// - ROTAS DE CHAT (A Lógica Principal) -

// 3. Iniciar solicitação de chat (A "Discagem") 
app.post('/chat/request', authenticate, async (req, res) => {
    const { targetUsername } = req.body;
    const initiatorId = req.userId;

    // Achar o usuário alvo
    const targetUser = await prisma.user.findUnique({ where: { username: targetUsername } });
    if (!targetUser) return res.status(404).json({ error: "Usuário não encontrado." });
    if (targetUser.id === initiatorId) return res.status(400).json({ error: "Você não pode falar sozinho." });

    // REGRA DE OURO: Usuário só pode estar em UM chat ativo 
    // Verifica se algum dos dois já está ocupado (Status ACTIVE ou PENDING)
    const activeChat = await prisma.chat.findFirst({
        where: {
            OR: [
                { initiatorId: initiatorId, status: { not: "CLOSED" } },
                { receiverId: initiatorId, status: { not: "CLOSED" } },
                { initiatorId: targetUser.id, status: { not: "CLOSED" } },
                { receiverId: targetUser.id, status: { not: "CLOSED" } }
            ]
        }
    });

    if (activeChat) {
        return res.status(400).json({ error: "Você ou o destinatário já estão em uma conversa ou solicitação pendente." });
    }

    // Cria a solicitação PENDING 
    const chat = await prisma.chat.create({
        data: {
            initiatorId,
            receiverId: targetUser.id,
            status: "PENDING"
        }
    });

    res.json({ message: "Solicitação enviada. Aguardando aceite.", chatId: chat.id });
});

// 4. Aceitar ou Recusar chat
app.post('/chat/:chatId/respond', authenticate, async (req, res) => {
    const { chatId } = req.params;
    const { action } = req.body; // "ACCEPT" ou "REJECT"
    const userId = req.userId;

    const chat = await prisma.chat.findUnique({ where: { id: Number(chatId) } });

    // Segurança: Só o receptor pode aceitar
    if (!chat || chat.receiverId !== userId) {
        return res.status(403).json({ error: "Você não tem permissão para responder a este chat." });
    }

    if (chat.status !== "PENDING") {
        return res.status(400).json({ error: "Este chat não está pendente." });
    }

    if (action === "ACCEPT") {
        // Vira uma "chamada ativa"
        await prisma.chat.update({
            where: { id: Number(chatId) },
            data: { status: "ACTIVE" }
        });
        res.json({ message: "Chat iniciado! Canal privado estabelecido." });
    } else {
        // Recusa e fecha
        await prisma.chat.update({
            where: { id: Number(chatId) },
            data: { status: "CLOSED" }
        });
        res.json({ message: "Solicitação recusada." });
    }
});

// 5. Enviar Mensagem 
app.post('/chat/:chatId/message', authenticate, async (req, res) => {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    const chat = await prisma.chat.findUnique({ where: { id: Number(chatId) } });

    // Verifica se o chat existe e se o usuário faz parte dele
    if (!chat || (chat.initiatorId !== userId && chat.receiverId !== userId)) {
        return res.status(403).json({ error: "Acesso negado." });
    }

    // REGRA: Só pode falar se estiver ACTIVE 
    if (chat.status !== "ACTIVE") {
        return res.status(400).json({ error: "O chat não está ativo." });
    }

    const message = await prisma.message.create({
        data: {
            content,
            chatId: Number(chatId),
            senderId: userId
        }
    });

    res.json(message);
});

// 6. Listar Mensagens e Histórico 
app.get('/chat/:chatId', authenticate, async (req, res) => {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await prisma.chat.findUnique({
        where: { id: Number(chatId) },
        include: { messages: true } // Traz as mensagens junto
    });

    if (!chat || (chat.initiatorId !== userId && chat.receiverId !== userId)) {
        return res.status(403).json({ error: "Acesso negado." });
    }

    res.json(chat);
});

// 7. Listar todos os chats do usuário (Histórico geral) 
app.get('/my-chats', authenticate, async (req, res) => {
    const userId = req.userId;
    const chats = await prisma.chat.findMany({
        where: {
            OR: [{ initiatorId: userId }, { receiverId: userId }]
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(chats);
});

// 8. Encerrar Chat
app.post('/chat/:chatId/end', authenticate, async (req, res) => {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await prisma.chat.findUnique({ where: { id: Number(chatId) } });

    if (!chat || (chat.initiatorId !== userId && chat.receiverId !== userId)) {
        return res.status(403).json({ error: "Acesso negado." });
    }

    // Qualquer parte pode encerrar
    await prisma.chat.update({
        where: { id: Number(chatId) },
        data: { status: "CLOSED" }
    });

    res.json({ message: "Chat encerrado com sucesso." });
});

// Iniciar servidor
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});