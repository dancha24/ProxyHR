// Логика интерфейса popup
document.addEventListener('DOMContentLoaded', function() {
    // Элементы интерфейса
    const proxyInput = document.getElementById('proxyInput');
    const enableBtn = document.getElementById('enableBtn');
    const disableBtn = document.getElementById('disableBtn');
    const status = document.getElementById('status');
    const savedProxiesList = document.getElementById('savedProxiesList');

    // Загрузка текущего состояния
    loadCurrentStatus();
    loadSavedProxies();

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

    // Функция обновления статуса после изменения
    function refreshStatus() {
        loadCurrentStatus();
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
                                    // Сохраняем прокси в список при успешном запуске
                                    saveProxyToList(proxy);
                                    // Обновляем статус из background
                                    setTimeout(refreshStatus, 500);
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
                // Обновляем статус из background
                setTimeout(refreshStatus, 500);
            } else {
                updateStatus('error');
            }
        });
    }

    // ===== ФУНКЦИИ УПРАВЛЕНИЯ СПИСКОМ ПРОКСИ =====

    // Загрузка сохраненных прокси
    function loadSavedProxies() {
        console.log('Загружаем сохраненные прокси...');
        chrome.storage.local.get(['savedProxies'], (result) => {
            const savedProxies = result.savedProxies || [];
            console.log('Загружены прокси из storage:', savedProxies);
            renderSavedProxiesList(savedProxies);
        });
    }

    // Сохранение прокси в список
    function saveProxyToList(proxy) {
        console.log('Сохраняем прокси в список:', proxy);
        chrome.storage.local.get(['savedProxies'], (result) => {
            let savedProxies = result.savedProxies || [];
            console.log('Текущие сохраненные прокси:', savedProxies);
            
            // Убираем дубликаты
            savedProxies = savedProxies.filter(p => 
                p.host !== proxy.host || p.port !== proxy.port
            );
            
            // Добавляем новый прокси в начало (последний использованный)
            savedProxies.unshift({
                ...proxy,
                timestamp: Date.now()
            });
            
            console.log('Обновленный список прокси:', savedProxies);
            
            // Сохраняем в storage
            chrome.storage.local.set({ savedProxies: savedProxies }, () => {
                console.log('Прокси сохранен в storage');
                renderSavedProxiesList(savedProxies);
            });
        });
    }

    // Удаление прокси из списка
    function removeProxyFromList(proxyToRemove) {
        if (confirm('Удалить этот прокси из списка?')) {
            chrome.storage.local.get(['savedProxies'], (result) => {
                let savedProxies = result.savedProxies || [];
                savedProxies = savedProxies.filter(p => 
                    p.host !== proxyToRemove.host || p.port !== proxyToRemove.port
                );
                
                chrome.storage.local.set({ savedProxies: savedProxies }, () => {
                    renderSavedProxiesList(savedProxies);
                });
            });
        }
    }

    // Запуск прокси из списка
    function launchProxyFromList(proxy) {
        // Вставляем прокси в поле ввода
        const proxyString = formatProxyString(proxy);
        proxyInput.value = proxyString;
        
        // Автоматически запускаем
        enableProxy();
    }

    // Форматирование прокси для отображения
    function formatProxyString(proxy) {
        if (proxy.username && proxy.password) {
            return `${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
        } else {
            return `${proxy.host}:${proxy.port}`;
        }
    }

    // Отрисовка списка сохраненных прокси
    function renderSavedProxiesList(savedProxies) {
        console.log('Отрисовываем список прокси:', savedProxies);
        if (savedProxies.length === 0) {
            savedProxiesList.innerHTML = '<div class="empty-list">Нет сохраненных прокси</div>';
            console.log('Список пуст, показываем сообщение');
            return;
        }

        savedProxiesList.innerHTML = savedProxies.map((proxy, index) => {
            const proxyString = formatProxyString(proxy);
            return `
                <div class="proxy-item" data-proxy-index="${index}">
                    <div class="proxy-info">${proxyString}</div>
                    <div class="proxy-actions">
                        <button class="proxy-btn btn-launch" title="Запустить" data-action="launch" data-proxy-index="${index}">
                            ▶️
                        </button>
                        <button class="proxy-btn btn-delete" title="Удалить" data-action="delete" data-proxy-index="${index}">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Добавляем обработчики событий для кнопок
        addProxyButtonsEventListeners(savedProxies);
        
        console.log('Список прокси отрисован, элементов:', savedProxies.length);
    }

    // Добавление обработчиков событий для кнопок прокси
    function addProxyButtonsEventListeners(savedProxies) {
        const proxyButtons = savedProxiesList.querySelectorAll('.proxy-btn');
        
        proxyButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                const action = this.getAttribute('data-action');
                const proxyIndex = parseInt(this.getAttribute('data-proxy-index'));
                const proxy = savedProxies[proxyIndex];
                
                if (!proxy) {
                    console.error('Прокси не найден по индексу:', proxyIndex);
                    return;
                }
                
                if (action === 'launch') {
                    launchProxyFromList(proxy);
                } else if (action === 'delete') {
                    removeProxyFromList(proxy);
                }
            });
        });
    }

});
