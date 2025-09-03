// Фоновый скрипт для управления прокси
let currentProxy = null;
let isProxyEnabled = false;

// Инициализация при запуске
chrome.runtime.onStartup.addListener(() => {
  loadProxySettings();
});

chrome.runtime.onInstalled.addListener(() => {
  loadProxySettings();
});

// Загрузка настроек прокси из хранилища
async function loadProxySettings() {
  try {
    const result = await chrome.storage.sync.get(['proxyConfig', 'isEnabled']);
    if (result.proxyConfig) {
      currentProxy = result.proxyConfig;
    }
    if (result.isEnabled !== undefined) {
      isProxyEnabled = result.isEnabled;
      if (isProxyEnabled && currentProxy) {
        enableProxy();
      } else {
        disableProxy();
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки настроек:', error);
  }
}

// Включение прокси
function enableProxy() {
  if (!currentProxy) return;
  
  const config = {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: currentProxy.scheme || "http",
        host: currentProxy.host,
        port: parseInt(currentProxy.port)
      }
    }
  };

  chrome.proxy.settings.set({
    value: config,
    scope: 'regular'
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Ошибка установки прокси:', chrome.runtime.lastError);
    } else {
      console.log('Прокси включен:', currentProxy);
    }
  });
}

// Отключение прокси
function disableProxy() {
  chrome.proxy.settings.clear({
    scope: 'regular'
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Ошибка отключения прокси:', chrome.runtime.lastError);
    } else {
      console.log('Прокси отключен');
    }
  });
}

// Обработка аутентификации прокси
chrome.webRequest.onAuthRequired.addListener(
  (details, callback) => {
    if (currentProxy && currentProxy.username && currentProxy.password) {
      callback({
        authCredentials: {
          username: currentProxy.username,
          password: currentProxy.password
        }
      });
    } else {
      callback();
    }
  },
  { urls: ["<all_urls>"] },
  ["asyncBlocking"]
);

// Обработка сообщений от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'setProxy':
      currentProxy = request.proxy;
      chrome.storage.sync.set({ proxyConfig: currentProxy });
      if (isProxyEnabled) {
        enableProxy();
      }
      sendResponse({ success: true });
      break;
      
    case 'enableProxy':
      isProxyEnabled = true;
      chrome.storage.sync.set({ isEnabled: true });
      enableProxy();
      sendResponse({ success: true });
      break;
      
    case 'disableProxy':
      isProxyEnabled = false;
      chrome.storage.sync.set({ isEnabled: false });
      disableProxy();
      sendResponse({ success: true });
      break;
      
    case 'getStatus':
      sendResponse({
        proxy: currentProxy,
        isEnabled: isProxyEnabled
      });
      break;
      
    case 'testProxy':
      testProxyConnection(request.proxy).then(result => {
        sendResponse(result);
      });
      return true; // Асинхронный ответ
      

  }
});

// Тестирование подключения к прокси
async function testProxyConnection(proxy) {
  try {
    // Создаем временную конфигурацию для тестирования
    const testConfig = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: proxy.scheme || "http",
          host: proxy.host,
          port: parseInt(proxy.port)
        }
      }
    };

    return new Promise((resolve) => {
      chrome.proxy.settings.set({
        value: testConfig,
        scope: 'regular'
      }, async () => {
        try {
          // Тестируем подключение к простому сервису
          const response = await fetch('https://httpbin.org/ip', {
            method: 'GET',
            mode: 'no-cors'
          });
          
          // Восстанавливаем предыдущую конфигурацию
          if (isProxyEnabled && currentProxy) {
            enableProxy();
          } else {
            disableProxy();
          }
          
          resolve({ success: true, message: 'Прокси работает' });
        } catch (error) {
          // Восстанавливаем предыдущую конфигурацию
          if (isProxyEnabled && currentProxy) {
            enableProxy();
          } else {
            disableProxy();
          }
          
          resolve({ success: false, message: 'Ошибка подключения: ' + error.message });
        }
      });
    });
  } catch (error) {
    return { success: false, message: 'Ошибка тестирования: ' + error.message };
  }
}


