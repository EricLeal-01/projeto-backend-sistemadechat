#  API - Sistema de Chat (Processo Seletivo LOADING JR)

Este é um projeto de Back-end desenvolvido para o processo seletivo da Empresa Júnior Loading. O objetivo é uma API de mensageria instantânea cuja regra de negócio é inspirada na dinâmica de uma chamada telefônica tradicional: exige consentimento mútuo para abrir o canal e o status dita as regras da conversa.

## Seguintes Tecnologias Utilizadas

* **Node.js & Express:** Para a construção do servidor e roteamento da API.
* **Prisma ORM:** Para a modelagem e interação com o banco de dados.
* **SQLite:** Banco de dados leve e embutido, facilitando a execução local sem softwares pesados.
* **JWT (JSON Web Token):** Para autenticação e proteção das rotas.
* **Bcrypt.js:** Para a criptografia de senhas.

##  Instruções para Execução Local

Siga os passos abaixo para testar a API na sua máquina.

### Pré-requisitos
* Node.js instalado.
* Software para testes de API (Insomnia, Postman ou Thunder Client).

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone <COLE_AQUI_O_LINK_DO_SEU_GITHUB_DEPOIS>
   cd projeto-backend-ps
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Gere o banco de dados e as tabelas (Prisma Migration):**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Inicie o servidor:**
   ```bash
   npm run dev
   ```
   *O servidor estará rodando em http://localhost:3000.*

---

##  Lógica de Negócio e Estados do Chat

O sistema foca na transição de estados das conversas. Um usuário só pode ter UM canal ativo ou pendente por vez.

* **PENDING:** A "discagem". O usuário A solicita um chat para o usuário B.
* **ACTIVE:** O consentimento. O usuário B aceita a solicitação. O canal é estabelecido para troca de mensagens.
* **CLOSED:** O encerramento. Qualquer uma das partes decide "desligar". Nenhuma nova mensagem pode ser enviada, mas o histórico é mantido.

##  Documentação das Rotas

*As rotas de Chat exigem o envio do token JWT (Bearer Token) no cabeçalho (Header) da requisição.*

### Autenticação
* `POST /register` - Cadastra um usuário. (Body: `username`, `password`)
* `POST /login` - Faz login e retorna o Token JWT. (Body: `username`, `password`)

### Chat e Mensagens
* `POST /chat/request` - Solicita um novo chat ("discagem"). (Body: `targetUsername`)
* `POST /chat/:chatId/respond` - Aceita ou recusa o chat. (Body: `"action": "ACCEPT" ou "REJECT"`)
* `POST /chat/:chatId/message` - Envia uma mensagem. (Body: `content`)
* `GET /chat/:chatId` - Retorna o histórico de mensagens de um chat.
* `GET /my-chats` - Lista todos os chats do usuário logado.
* `POST /chat/:chatId/end` - Encerra a conexão.






