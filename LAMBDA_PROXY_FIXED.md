# Lambda Proxy - Исправленная версия

## 🔧 Обновлённый код Lambda

Замените код в Lambda функции на этот (с улучшенной обработкой event):

```javascript
// index.mjs
export const handler = async (event) => {
    console.log('Full Event:', JSON.stringify(event, null, 2));
    
    try {
        // Bedrock может передавать данные в разных форматах
        // Проверяем разные возможные структуры
        let actionGroup, apiPath, parameters, sessionAttributes;
        
        if (event.message) {
            // Формат через message
            const message = event.message;
            actionGroup = message.actionGroupInvocationInput?.actionGroupName;
            apiPath = message.actionGroupInvocationInput?.apiPath;
            parameters = message.actionGroupInvocationInput?.parameters || [];
            sessionAttributes = message.sessionAttributes || {};
        } else if (event.actionGroup) {
            // Прямой формат
            actionGroup = event.actionGroup;
            apiPath = event.apiPath;
            parameters = event.parameters || [];
            sessionAttributes = event.sessionAttributes || {};
        } else {
            // Попробуем извлечь из любого места
            actionGroup = event.actionGroupInvocationInput?.actionGroupName || event.actionGroup;
            apiPath = event.actionGroupInvocationInput?.apiPath || event.apiPath;
            parameters = event.actionGroupInvocationInput?.parameters || event.parameters || [];
            sessionAttributes = event.sessionAttributes || event.message?.sessionAttributes || {};
        }
        
        console.log('Extracted:', {
            actionGroup,
            apiPath,
            parametersCount: parameters.length,
            sessionAttributesKeys: Object.keys(sessionAttributes),
        });
        
        // Get session attributes
        const companyId = sessionAttributes.company_id || sessionAttributes['company_id'];
        const apiToken = sessionAttributes.api_token || sessionAttributes['api_token'];
        
        console.log('Session data:', {
            companyId: companyId ? 'present' : 'missing',
            apiToken: apiToken ? 'present' : 'missing',
        });
        
        if (!apiToken) {
            console.error('API token is missing from sessionAttributes');
            return {
                messageVersion: '1.0',
                response: {
                    actionGroup: actionGroup || 'unknown',
                    apiPath: apiPath || '/',
                    httpMethod: 'GET',
                    httpStatusCode: 401,
                    responseBody: {
                        'application/json': {
                            body: JSON.stringify({ 
                                error: 'API token is missing. Check sessionAttributes.api_token' 
                            }),
                        },
                    },
                },
            };
        }
        
        // Your ngrok or deployed URL
        const baseUrl = 'https://nonshipping-harrison-quadrilingual.ngrok-free.dev';
        
        // Build query parameters
        const queryParams = new URLSearchParams();
        if (companyId) {
            queryParams.append('company_id', companyId);
        }
        
        // Handle parameters - они могут быть в разных форматах
        if (Array.isArray(parameters)) {
            parameters.forEach(param => {
                const name = param.name || param.parameterName;
                const value = param.value || param.parameterValue;
                if (name && value !== undefined && value !== null) {
                    queryParams.append(name, String(value));
                }
            });
        } else if (typeof parameters === 'object') {
            // Если parameters - это объект
            Object.entries(parameters).forEach(([name, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(name, String(value));
                }
            });
        }
        
        const fullUrl = `${baseUrl}${apiPath}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        
        console.log('Calling API:', fullUrl);
        console.log('Headers:', {
            'x-api-token': apiToken ? '***' + apiToken.slice(-4) : 'MISSING',
        });
        
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'x-api-token': apiToken,
                'Content-Type': 'application/json',
            },
        });
        
        const responseText = await response.text();
        console.log('API Response Status:', response.status);
        console.log('API Response Body:', responseText.substring(0, 500));
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse response as JSON:', e);
            data = { error: 'Invalid JSON response', raw: responseText };
        }
        
        return {
            messageVersion: '1.0',
            response: {
                actionGroup: actionGroup || 'unknown',
                apiPath: apiPath || '/',
                httpMethod: 'GET',
                httpStatusCode: response.status,
                responseBody: {
                    'application/json': {
                        body: JSON.stringify(data),
                    },
                },
            },
        };
    } catch (error) {
        console.error('Lambda Error:', error);
        console.error('Error stack:', error.stack);
        
        return {
            messageVersion: '1.0',
            response: {
                actionGroup: event.actionGroup || 'unknown',
                apiPath: event.apiPath || '/',
                httpMethod: 'GET',
                httpStatusCode: 500,
                responseBody: {
                    'application/json': {
                        body: JSON.stringify({ 
                            error: error.message,
                            stack: error.stack,
                        }),
                    },
                },
            },
        };
    }
};
```

## 🔍 Как обновить Lambda:

### 1️⃣ Откройте Lambda функцию

1. **AWS Lambda Console** → **Functions** → `bedrock-crm-proxy`
2. Нажмите на вкладку **Code**

### 2️⃣ Замените код

1. Удалите весь старый код
2. Скопируйте новый код выше
3. Нажмите **Deploy**

### 3️⃣ Проверьте CloudWatch Logs

После обновления попробуйте снова в Test Agent:
```
how many deals i have
```

Затем:
1. В Lambda Console → **Monitor** → **View CloudWatch logs**
2. Откройте последний log stream
3. Посмотрите, что выводится в `console.log`

Это покажет:
- Какую структуру event получает Lambda
- Есть ли `api_token` в sessionAttributes
- Какой URL вызывается
- Что возвращает API

---

## 🎯 Что проверить в логах:

### ✅ Хорошие логи:
```
Extracted: {
  actionGroup: 'get_deals_data',
  apiPath: '/api/ai-director/data/deals',
  sessionAttributesKeys: ['company_id', 'api_token', 'user_language']
}
Session data: {
  companyId: 'present',
  apiToken: 'present'
}
Calling API: https://...
API Response Status: 200
```

### ❌ Плохие логи:
```
Session data: {
  companyId: 'missing',
  apiToken: 'missing'
}
```

Если `apiToken: 'missing'`, значит проблема в том, как Bedrock передаёт sessionAttributes.

---

## 💡 Если токен всё ещё missing:

Проверьте, что в вашем коде (`apps/crm/app/api/ai-director/chat/route.ts`) правильно передаются sessionAttributes:

```typescript
sessionAttributes: {
  company_id: companyId,
  api_base_url: process.env.NEXT_PUBLIC_APP_URL || '',
  api_token: process.env.AI_DIRECTOR_API_TOKEN || '',
  user_language: detectedLanguage,
}
```

Убедитесь, что `AI_DIRECTOR_API_TOKEN` установлен в `.env.local`!

---

**Обновите Lambda код и проверьте CloudWatch logs! 🔍**


