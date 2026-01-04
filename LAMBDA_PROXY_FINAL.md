# Lambda Proxy - Финальная версия с исправлением ActionGroup

## 🔧 Исправленный Lambda код

Замените код в Lambda функции на этот:

```javascript
// index.mjs
export const handler = async (event) => {
    console.log('Full Event:', JSON.stringify(event, null, 2));
    
    try {
        // Bedrock передаёт данные в формате event.message
        const message = event.message || {};
        const actionGroupInvocation = message.actionGroupInvocationInput || {};
        
        // ВАЖНО: Извлекаем actionGroup из правильного места
        const actionGroup = actionGroupInvocation.actionGroupName || 
                           actionGroupInvocation.actionGroup || 
                           event.actionGroup ||
                           'unknown';
        
        const apiPath = actionGroupInvocation.apiPath || event.apiPath || '/';
        const parameters = actionGroupInvocation.parameters || event.parameters || [];
        
        // Session attributes находятся в event.message.sessionAttributes
        const sessionAttributes = message.sessionAttributes || event.sessionAttributes || {};
        
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
            companyId: companyId || 'MISSING',
            apiToken: apiToken ? '***' + apiToken.slice(-4) : 'MISSING',
        });
        
        if (!apiToken) {
            console.error('API token is missing');
            return {
                messageVersion: '1.0',
                response: {
                    actionGroup: actionGroup, // ВАЖНО: Используем тот же actionGroup!
                    apiPath: apiPath,
                    httpMethod: 'GET',
                    httpStatusCode: 401,
                    responseBody: {
                        'application/json': {
                            body: JSON.stringify({ 
                                error: 'API token is missing',
                            }),
                        },
                    },
                },
            };
        }
        
        if (!companyId) {
            console.error('Company ID is missing');
            return {
                messageVersion: '1.0',
                response: {
                    actionGroup: actionGroup, // ВАЖНО: Используем тот же actionGroup!
                    apiPath: apiPath,
                    httpMethod: 'GET',
                    httpStatusCode: 400,
                    responseBody: {
                        'application/json': {
                            body: JSON.stringify({ 
                                error: 'Company ID is missing',
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
        
        // Добавляем company_id из sessionAttributes
        queryParams.append('company_id', companyId);
        
        // Handle parameters - пропускаем company_id и $company_id$
        if (Array.isArray(parameters)) {
            parameters.forEach(param => {
                const name = param.name || param.parameterName;
                const value = param.value || param.parameterValue;
                
                // Пропускаем company_id из parameters
                if (name === 'company_id' || name === '$company_id$' || value === '$company_id$') {
                    console.log('Skipping company_id from parameters');
                    return;
                }
                
                if (name && value !== undefined && value !== null && value !== '$company_id$') {
                    queryParams.append(name, String(value));
                }
            });
        } else if (typeof parameters === 'object' && parameters !== null) {
            Object.entries(parameters).forEach(([name, value]) => {
                if (name === 'company_id' || name === '$company_id$' || value === '$company_id$') {
                    return;
                }
                if (value !== undefined && value !== null && value !== '$company_id$') {
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
        
        // ВАЖНО: Возвращаем тот же actionGroup, что был во входных данных!
        return {
            messageVersion: '1.0',
            response: {
                actionGroup: actionGroup, // Должен совпадать с входным!
                apiPath: apiPath,
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
        
        // ВАЖНО: Даже в случае ошибки возвращаем правильный actionGroup
        const actionGroup = event.message?.actionGroupInvocationInput?.actionGroupName || 
                           event.message?.actionGroupInvocationInput?.actionGroup ||
                           event.actionGroup || 
                           'unknown';
        
        return {
            messageVersion: '1.0',
            response: {
                actionGroup: actionGroup, // Должен совпадать с входным!
                apiPath: event.message?.actionGroupInvocationInput?.apiPath || event.apiPath || '/',
                httpMethod: 'GET',
                httpStatusCode: 500,
                responseBody: {
                    'application/json': {
                        body: JSON.stringify({ 
                            error: error.message,
                        }),
                    },
                },
            },
        };
    }
};
```

## 🔑 Ключевые изменения:

1. **Правильное извлечение actionGroup:**
   ```javascript
   const actionGroup = actionGroupInvocation.actionGroupName || 
                      actionGroupInvocation.actionGroup || 
                      event.actionGroup ||
                      'unknown';
   ```

2. **Использование того же actionGroup во всех ответах:**
   ```javascript
   return {
       messageVersion: '1.0',
       response: {
           actionGroup: actionGroup, // ВАЖНО: Тот же, что во входных данных!
           ...
       }
   };
   ```

3. **Логирование для отладки:**
   - Полный event в начале
   - Извлечённые значения
   - Session attributes

## 📋 Как обновить:

1. **AWS Lambda Console** → **Functions** → `bedrock-crm-proxy` → **Code**
2. Замените весь код на версию выше
3. Нажмите **Deploy**
4. Попробуйте снова в Test Agent

## 🧪 Проверка:

После обновления попробуйте:
```
how many deals i have
```

В CloudWatch Logs должны увидеть:
```
Extracted: {
  actionGroup: 'get_deals_data',
  apiPath: '/api/ai-director/data/deals',
  ...
}
Calling API: https://...?company_id=6998295e-...&status=open
API Response Status: 200
```

И ошибка "ActionGroup doesn't match" должна исчезнуть!


