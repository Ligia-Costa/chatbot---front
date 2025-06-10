document.addEventListener('DOMContentLoaded', () => {
    let socket = null;
    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const connectionStatus = document.getElementById('connection-status');
    const iniciarBtn = document.getElementById('iniciarBtn');
    const encerrarBtn = document.getElementById('encerrarBtn');
    let userSessionId = null;

    function convertMarkdownToHtml(markdownText) {
        let htmlText = markdownText;

        // 1. Converter negrito (*** ou **) para <strong>
        // É importante fazer isso primeiro para que os asteriscos não interfiram com a detecção de lista.
        htmlText = htmlText.replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>'); // Para ***negrito***
        htmlText = htmlText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');   // Para **negrito**

        // 2. Converter itálico (*) ou (_) para <em>
        htmlText = htmlText.replace(/_([^_]+)_/g, '<em>$1</em>');
        htmlText = htmlText.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 3. Processar cabeçalhos (#) para <h1>, <h2>, etc. (Opcional, mas útil para formatação)
        // Se você não quer cabeçalhos, pode remover esta seção e apenas limpar o #
        htmlText = htmlText.replace(/^#{1}\s*(.*)/gm, '<h1>$1</h1>');
        htmlText = htmlText.replace(/^#{2}\s*(.*)/gm, '<h2>$1</h2>');
        htmlText = htmlText.replace(/^#{3}\s*(.*)/gm, '<h3>$1</h3>');
        htmlText = htmlText.replace(/^#{4}\s*(.*)/gm, '<h4>$1</h4>');
        htmlText = htmlText.replace(/^#{5}\s*(.*)/gm, '<h5>$1</h5>');
        htmlText = htmlText.replace(/^#{6}\s*(.*)/gm, '<h6>$1</h6>');

        // 4. Processar blockquotes (>) para <blockquote> (Opcional)
        // Se você não quer blockquotes, pode remover esta seção e apenas limpar o >
        htmlText = htmlText.replace(/^>\s*(.*)/gm, '<blockquote>$1</blockquote>');

        // 5. Processar código inline (`) para <code>
        htmlText = htmlText.replace(/`(.*?)`/g, '<code>$1</code>');

        // 6. Processar blocos de código (```) para <pre><code> (Opcional)
        // Se você não quer blocos de código, pode remover esta seção
        htmlText = htmlText.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');


        // 7. Converter itens de lista. Esta é a parte mais crítica.
        // O Gemini pode enviar listas com '\n' ou com espaços ' * '.
        const lines = htmlText.split('\n');
        let processedHtmlLines = [];
        let inList = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmedLine = line.trim();

            // Prioriza a detecção de listas em novas linhas com '*' ou '-'
            if (trimmedLine.match(/^(\*|-)\s/)) {
                if (!inList) {
                    processedHtmlLines.push('<ul>'); // Inicia a lista
                    inList = true;
                }
                processedHtmlLines.push(`<li>${trimmedLine.replace(/^(\*|-)\s/, '')}</li>`);
            } else {
                if (inList) {
                    processedHtmlLines.push('</ul>'); // Fecha a lista
                    inList = false;
                }
                // Se a linha não é um item de lista por '\n', mas pode ter o padrão ' * ' dentro de uma linha
                // O texto na imagem parece ter " * " como separador interno
                if (trimmedLine.includes(' * ') && !trimmedLine.includes('<ul>')) {
                     // Quebra a linha por " * " e cria itens de lista
                    const subItems = trimmedLine.split(' * ').filter(item => item.trim() !== '');
                    if (subItems.length > 1 || (subItems.length === 1 && trimmedLine.startsWith('* '))) {
                        processedHtmlLines.push('<ul>');
                        subItems.forEach(item => {
                            processedHtmlLines.push(`<li>${item.trim()}</li>`);
                        });
                        processedHtmlLines.push('</ul>');
                    } else {
                        // Se não é uma lista formatada, apenas adicione a linha
                        processedHtmlLines.push(line);
                    }
                } else {
                    // Adiciona a linha original se não for lista e não for para quebrar em <br> aqui
                    processedHtmlLines.push(line);
                }
            }
        }

        if (inList) { // Se a lista terminou sem ser fechada
            processedHtmlLines.push('</ul>');
        }

        htmlText = processedHtmlLines.join('\n'); // Junta as linhas processadas com quebras de linha temporárias

        // 8. Tratar quebras de linha e parágrafos
        // Substitui quebras de linha duplas por quebras de linha duplas HTML para parágrafos
        htmlText = htmlText.replace(/\n\n/g, '<br><br>');
        // Substitui quebras de linha simples por quebras de linha HTML simples
        htmlText = htmlText.replace(/\n/g, '<br>');


        return htmlText;
    }

    // Função para adicionar mensagens no chat
    function addMessageToChat(sender, text, type = 'normal') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        if (sender.toLowerCase() === 'user') {
            messageElement.classList.add('user-message');
            sender = 'Você';
        } else if (sender.toLowerCase() === 'bot') {
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

        // Usa a nova função para processar o texto antes de adicioná-lo ao chat
        const processedText = convertMarkdownToHtml(text);

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