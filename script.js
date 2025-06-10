document.addEventListener('DOMContentLoaded', () => {
    let socket = null;
    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const connectionStatus = document.getElementById('connection-status');
    const iniciarBtn = document.getElementById('iniciarBtn');
    const encerrarBtn = document.getElementById('encerrarBtn');
    let userSessionId = null;

   // Função para adicionar mensagens no chat
function addMessageToChat(sender, text, type = 'normal') {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    if (sender.toLowerCase() === 'user') {
        messageElement.classList.add('user-message');
        sender = 'Você';
    } else if (sender.toLowerCase() === 'estudvest') {
        messageElement.classList.add('bot-message');
        sender = 'EstudVest';
    } else {
        messageElement.classList.add('status-message');
    }

    if (type === 'error') {
        messageElement.classList.add('error-text');
        sender = 'Erro';
    } else if (type === 'status') {
        messageElement.classList.add('status-text');
        sender = 'Status';
    }

    const senderSpan = document.createElement('strong');
    senderSpan.innerHTML = `${sender}: `;
    messageElement.appendChild(senderSpan);

    let processedText = text;

    // --- 1. Processar Listas com '*' ---
    // Dividir o texto em linhas para processamento de lista
    const lines = processedText.split('\n');
    let htmlContent = [];
    let inList = false;

    lines.forEach(line => {
        if (line.trim().startsWith('* ')) {
            if (!inList) {
                htmlContent.push('<ul>'); // Abre <ul> se não estiver em uma lista
                inList = true;
            }
            // Remove o '* ' e envolve o item em <li>
            htmlContent.push(`<li>${line.trim().substring(2)}</li>`);
        } else {
            if (inList) {
                htmlContent.push('</ul>'); // Fecha <ul> se estava em uma lista e a linha atual não é item de lista
                inList = false;
            }
            // Adiciona linhas que não são itens de lista
            htmlContent.push(line);
        }
    });

    if (inList) { // Se a lista termina no final do texto, fecha o <ul>
        htmlContent.push('</ul>');
    }

    // Junta as partes HTML de volta em uma string, preservando as quebras de linha para regex subsequentes
    processedText = htmlContent.join('\n');

    // --- 2. Processar Negrito com '***' ---
    // Converte ***texto*** para <strong>texto</strong>
    processedText = processedText.replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>');

    // --- 3. Remover outros markdowns e formatar quebras de linha ---

    // Remove **negrito** (se não for ***)
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '$1');
    // Remove *itálico* (se não for parte de lista)
    processedText = processedText.replace(/\*(.*?)\*/g, '$1');
    // Remove _itálico_
    processedText = processedText.replace(/_(.*?)_/g, '$1');
    // Remove cabeçalhos #
    processedText = processedText.replace(/^#+\s*(.*)/gm, '$1');
    // Remove blockquotes >
    processedText = processedText.replace(/^>\s*/gm, '');
    // Remove código inline `código`
    processedText = processedText.replace(/`(.*?)`/g, '$1');
    // Remove blocos de código ```código```
    processedText = processedText.replace(/```[\s\S]*?```/g, '');


    // Converte quebras de linha em tags <br> para exibição HTML
    processedText = processedText.replace(/\n\n/g, '<br>'); // Uma quebra para parágrafos


    const textSpan = document.createElement('span');
    textSpan.innerHTML = processedText; // Define o HTML processado no span
    messageElement.appendChild(textSpan);
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

    // Função para habilitar/desabilitar o chat
    function setChatEnabled(enabled) {
        messageInput.disabled = !enabled;
        sendButton.disabled = !enabled;
    }
    // Inicialmente desativa o chat
    setChatEnabled(false);
    connectionStatus.textContent = 'Desconectado';
    connectionStatus.className = 'status-offline';
    addMessageToChat('Status', 'Bem vindo Estudante! Clique em "Iniciar conversa" para começar.', 'status');

    // Função para conectar ao servidor
    function iniciarConversa() {
        if (socket && socket.connected) return;

        socket = io('http://127.0.0.1:5000');

        socket.on('connect', () => {
            console.log('Conectado ao servidor Socket.IO! SID:', socket.id);
            connectionStatus.textContent = 'Conectado';
            connectionStatus.className = 'status-online';
            addMessageToChat('Status', 'Hora de estudar!', 'status');
            setChatEnabled(true);
        });

        socket.on('disconnect', () => {
            console.log('Desconectado do servidor Socket.IO.');
            connectionStatus.textContent = 'Desconectado';
            connectionStatus.className = 'status-offline';
            addMessageToChat('Status', 'Seu estudo terminou.', 'status');
            setChatEnabled(false);
        });

        socket.on('status_conexao', (data) => {
            if (data.session_id) {
                userSessionId = data.session_id;
            }
        });

        socket.on('nova_mensagem', (data) => {
            addMessageToChat(data.remetente, data.texto);
        });
        socket.on('erro', (data) => {
            addMessageToChat('Erro', data.erro, 'error');
        });
    }
    // Função para encerrar a conversa
    function encerrarConversa() {
        if (socket && socket.connected) {
            socket.disconnect();
            setChatEnabled(false);
            addMessageToChat('Status', 'Conversa encerrada pelo usuário.', 'status');
        }
    }

    // Enviar mensagem para o servidor
    function sendMessageToServer() {
        const messageText = messageInput.value.trim();
        if (messageText === '') return;
        if (socket && socket.connected) {
            addMessageToChat('user', messageText);
            socket.emit('enviar_mensagem', { mensagem: messageText });
            messageInput.value = '';
            messageInput.focus();
        } else {
            addMessageToChat('Erro', 'Não conectado ao servidor.', 'error');
        }
    }

    // Eventos dos botões
    iniciarBtn.addEventListener('click', iniciarConversa);
    encerrarBtn.addEventListener('click', encerrarConversa);
    sendButton.addEventListener('click', sendMessageToServer);
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessageToServer();
        }
    });
});

document.getElementById('clear-chat-button').addEventListener('click', function() {
    document.getElementById('chat-box').innerHTML = '';
});