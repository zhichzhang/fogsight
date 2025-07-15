document.addEventListener('DOMContentLoaded', () => {
    // === DOM Elements ===
    const body = document.body;
    const initialForm = document.getElementById('initial-form');
    const initialInput = document.getElementById('initial-input');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatLog = document.getElementById('chat-log');
    const newChatButton = document.getElementById('new-chat-button');
    
    // === Templates ===
    const templates = {
        user: document.getElementById('user-message-template'),
        status: document.getElementById('agent-status-template'),
        code: document.getElementById('agent-code-template'),
        player: document.getElementById('animation-player-template'),
    };

    // === State ===
    let conversationHistory = [];
    let accumulatedCode = '';

    // === Event Listeners ===
    initialForm.addEventListener('submit', handleFormSubmit);
    chatForm.addEventListener('submit', handleFormSubmit);
    newChatButton.addEventListener('click', () => location.reload()); // Simple and effective reset

    // === Core Functions ===
    function handleFormSubmit(e) {
        e.preventDefault();
        const isInitial = e.currentTarget.id === 'initial-form';
        const input = isInitial ? initialInput : chatInput;
        const submitButton = e.currentTarget.querySelector('button');
        const topic = input.value.trim();
        if (!topic) return;

        // Disable the submit button to prevent multiple submissions
        submitButton.disabled = true;
        submitButton.classList.add('disabled'); // optional: for styling

        if (isInitial) {
            switchToChatView();
        }

        // Add user message to history
        conversationHistory.push({ role: 'user', content: topic });
        startGeneration(topic);
        input.value = '';
    }

    async function startGeneration(topic, submitButton) {
        appendUserMessage(topic);
        const agentThinkingMessage = appendAgentStatus('agent正在深度思考...');
        
        accumulatedCode = '';
        let inCodeBlock = false;
        let codeBlockElement = null;

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic, history: conversationHistory })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6);
                        const data = JSON.parse(jsonStr);

                        if (data.event === '[DONE]') {
                            conversationHistory.push({ role: 'assistant', content: accumulatedCode });
                            if (codeBlockElement) {
                                markCodeAsComplete(codeBlockElement);
                                if (accumulatedCode) appendAnimationPlayer(accumulatedCode, topic);
                            }
                            return;
                        }

                        if (data.error) {
                            throw new Error(data.error);
                        }

                        const token = data.token || '';

                        if (!inCodeBlock && token.includes('```')) {
                            inCodeBlock = true;
                            if (agentThinkingMessage) agentThinkingMessage.remove();
                            codeBlockElement = appendCodeBlock();
                            const contentAfterMarker = token.substring(token.indexOf('```') + 3).replace(/^html\n/, '');
                            updateCodeBlock(codeBlockElement, contentAfterMarker);
                        } else if (inCodeBlock) {
                            if (token.includes('```')) {
                                inCodeBlock = false;
                                const contentBeforeMarker = token.substring(0, token.indexOf('```'));
                                updateCodeBlock(codeBlockElement, contentBeforeMarker);
                            } else {
                                updateCodeBlock(codeBlockElement, token);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Streaming failed:", error);
            if (agentThinkingMessage) agentThinkingMessage.remove();

            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                showWarning("LLM服务不可用，请稍后再试");
            } else if (error.message.includes('status: 429')) {
                showWarning("今天已经使用太多，请明天再试");
            } else {
                showWarning("LLM服务不可用，请稍后再试");
            }

        } finally {
            // 恢复按钮状态
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.classList.remove('disabled');
            }
        }
    }

    // === UI & DOM Functions ===
    function switchToChatView() {
        body.classList.remove('show-initial-view');
        body.classList.add('show-chat-view');
    }

    function appendFromTemplate(template, text) {
        const node = template.content.cloneNode(true);
        const element = node.firstElementChild;
        element.innerHTML = element.innerHTML.replace('${text}', text);
        chatLog.appendChild(element);
        scrollToBottom();
        return element;
    }
    const appendUserMessage = (text) => appendFromTemplate(templates.user, text);
    const appendAgentStatus = (text) => appendFromTemplate(templates.status, text);

    function appendCodeBlock() {
        const node = templates.code.content.cloneNode(true);
        chatLog.appendChild(node);
        scrollToBottom();
        return chatLog.lastElementChild;
    }

    function updateCodeBlock(codeBlockElement, text) {
        const codeElement = codeBlockElement.querySelector('code');
        if (!text) return;
        const span = document.createElement('span');
        span.textContent = text;
        codeElement.appendChild(span);
        accumulatedCode += text;
        scrollToBottom();
    }
    
    function markCodeAsComplete(codeBlockElement) {
        codeBlockElement.querySelector('.summary-title span').textContent = '代码已完成';
        codeBlockElement.querySelector('.code-details').removeAttribute('open');
    }
    
    function appendAnimationPlayer(htmlContent, topic) {
        const node = templates.player.content.cloneNode(true);
        const playerElement = node.firstElementChild;
        const iframe = playerElement.querySelector('.animation-iframe');
        iframe.srcdoc = htmlContent;

        playerElement.querySelector('.open-new-window').addEventListener('click', () => {
            const blob = new Blob([htmlContent], { type: 'text/html' });
            window.open(URL.createObjectURL(blob), '_blank');
        });
        playerElement.querySelector('.save-html').addEventListener('click', () => {
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement('a'), { href: url, download: `${topic.replace(/\s/g, '_') || 'animation'}.html` });
            a.click();
            URL.revokeObjectURL(url);
        });
        chatLog.appendChild(playerElement);
        scrollToBottom();
    }
    
    const scrollToBottom = () => chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: 'smooth' });
});

function showWarning(message) {
    const box = document.getElementById('warning-box');
    const overlay = document.getElementById('overlay');
    const text = document.getElementById('warning-message');
    text.textContent = message;
    box.style.display = 'flex';
    overlay.style.display = 'block';

    // 自动隐藏（10秒）
    setTimeout(() => {
        hideWarning();
    }, 10000);
}

function hideWarning() {
    document.getElementById('warning-box').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
}
