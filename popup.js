// Логика интерфейса popup
document.addEventListener('DOMContentLoaded', function() {
    // Элементы интерфейса
    const proxyInput = document.getElementById('proxyInput');
    const enableBtn = document.getElementById('enableBtn');
    const disableBtn = document.getElementById('disableBtn');
    const status = document.getElementById('status');

    // Загрузка текущего состояния
    loadCurrentStatus();

    // Обработчики событий
    enableBtn.addEventListener('click', enableProxy);
    disableBtn.addEventListener('click', disableProxy);

    // Поле для ввода прокси (очищено)
    proxyInput.value = '';

    // Функция загрузки текущего состояния
    function loadCurrentStatus() {
        chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
            if (response && response.isEnabled && response.proxy) {
                updateStatus('connected');
            } else {
                updateStatus('disconnected');
            }
        });
    }

    // Функция обновления статуса
    function updateStatus(statusType) {
        switch (statusType) {
            case 'connected':
                status.textContent = 'Подключен';
                status.className = 'status connected';
                enableBtn.disabled = true;
                disableBtn.disabled = false;
                break;
            case 'disconnected':
                status.textContent = 'Не подключен';
                status.className = 'status disconnected';
                enableBtn.disabled = false;
                disableBtn.disabled = true;
                break;
            case 'error':
                status.textContent = 'Ошибка подключения';
                status.className = 'status error';
                enableBtn.disabled = false;
                disableBtn.disabled = true;
                break;
        }
    }



    // Функция парсинга прокси строки
    function parseProxyString(proxyString) {
        const proxy = {};
        
        // Поддержка формата user:pass@host:port
        if (proxyString.includes('@')) {
            const [auth, hostPort] = proxyString.split('@');
            const [username, password] = auth.split(':');
            const [host, port] = hostPort.split(':');
            
            proxy.username = username;
            proxy.password = password;
            proxy.host = host;
            proxy.port = port;
        } else {
            // Формат host:port
            const [host, port] = proxyString.split(':');
            proxy.host = host;
            proxy.port = port;
        }
        
        // Всегда используем HTTP протокол
        proxy.scheme = 'http';
        
        return proxy;
    }



    // Функция включения прокси
    function enableProxy() {
        const proxyString = proxyInput.value.trim();
        if (!proxyString) {
            updateStatus('error');
            return;
        }

        try {
            const proxy = parseProxyString(proxyString);
            
            // Валидация
            if (!proxy.host || !proxy.port) {
                updateStatus('error');
                return;
            }

            // Сначала тестируем прокси
            chrome.runtime.sendMessage({ 
                action: 'testProxy', 
                proxy: proxy 
            }, (response) => {
                if (response && response.success) {
                    // Прокси работает, сохраняем и включаем
                    chrome.runtime.sendMessage({ 
                        action: 'setProxy', 
                        proxy: proxy 
                    }, (response2) => {
                        if (response2 && response2.success) {
                            // Теперь включаем прокси
                            chrome.runtime.sendMessage({ action: 'enableProxy' }, (response3) => {
                                if (response3 && response3.success) {
                                    updateStatus('connected');
                                } else {
                                    updateStatus('error');
                                }
                            });
                        } else {
                            updateStatus('error');
                        }
                    });
                } else {
                    // Прокси не работает
                    updateStatus('error');
                }
            });

        } catch (error) {
            updateStatus('error');
        }
    }

    // Функция отключения прокси
    function disableProxy() {
        chrome.runtime.sendMessage({ action: 'disableProxy' }, (response) => {
            if (response && response.success) {
                updateStatus('disconnected');
            } else {
                updateStatus('error');
            }
        });
    }






});
