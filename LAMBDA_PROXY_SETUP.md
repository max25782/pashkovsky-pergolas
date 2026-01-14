# Lambda Proxy для AI Director

## 📋 Простая Lambda функция для проксирования запросов

Создайте Lambda функцию в AWS Console с этим кодом:

```javascript
// index.mjs
import https from 'https';
import http from 'http';

export const handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Extract action group, API path, and parameters
    const actionGroup = event.actionGroup;
    const apiPath = event.apiPath;
    const parameters = event.parameters || [];
    const requestBody = event.requestBody;
    
    // Get session attributes (company_id, api_token, etc.)
    const sessionAttributes = event.sessionAttributes || {};
    const companyId = sessionAttributes.company_id;
    const apiToken = sessionAttributes.api_token;
    
    // Your ngrok or deployed URL
    const baseUrl = 'https://nonshipping-harrison-quadrilingual.ngrok-free.dev';
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (companyId) {
        queryParams.append('company_id', companyId);
    }
    
    parameters.forEach(param => {
        if (param.value) {
            queryParams.append(param.name, param.value);
        }
    });
    
    const fullUrl = `${baseUrl}${apiPath}?${queryParams.toString()}`;
    
    console.log('Calling API:', fullUrl);
    
    try {
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'x-api-token': apiToken || '',
                'Content-Type': 'application/json',
            },
        });
        
        const data = await response.json();
        
        console.log('API Response:', JSON.stringify(data, null, 2));
        
        return {
            messageVersion: '1.0',
            response: {
                actionGroup: actionGroup,
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
        console.error('Error:', error);
        
        return {
            messageVersion: '1.0',
            response: {
                actionGroup: actionGroup,
                apiPath: apiPath,
                httpMethod: 'GET',
                httpStatusCode: 500,
                responseBody: {
                    'application/json': {
                        body: JSON.stringify({ error: error.message }),
                    },
                },
            },
        };
    }
};
```

## 🚀 Как создать Lambda:

### 1️⃣ Создайте Lambda функцию

1. **AWS Lambda Console** → **Create function**
2. **Function name**: `bedrock-ai-director-proxy`
3. **Runtime**: Node.js 20.x
4. **Architecture**: x86_64
5. **Create function**

### 2️⃣ Вставьте код

1. В редакторе кода удалите всё
2. Вставьте код выше
3. **Deploy**

### 3️⃣ Настройте timeout

1. **Configuration** → **General configuration** → **Edit**
2. **Timeout**: 30 seconds
3. **Save**

### 4️⃣ Дайте права Bedrock

1. **Configuration** → **Permissions**
2. Кликните на **Role name**
3. **Add permissions** → **Attach policies**
4. Найдите `AmazonBedrockFullAccess`
5. **Attach policy**

### 5️⃣ Обновите URL в Lambda

В коде Lambda замените:
```javascript
const baseUrl = 'https://nonshipping-harrison-quadrilingual.ngrok-free.dev';
```

На ваш актуальный ngrok URL или Vercel URL.

---

## 🔧 Обновите Action Groups

Для каждого из 5 Action Groups:

1. **Edit** Action Group
2. **Action group invocation**: выберите **"Select an existing Lambda function"**
3. **Lambda function**: выберите `bedrock-ai-director-proxy`
4. **Save**

---

## ✅ После этого:

1. Нажмите **"Prepare"** на агенте
2. Подождите 2-3 минуты
3. Попробуйте снова в Test Agent или в чате

---

## 🎯 Альтернатива: Деплой на Vercel

Если не хотите возиться с Lambda:

1. Задеплойте CRM на Vercel
2. Используйте Vercel URL вместо ngrok
3. Не нужна Lambda - используйте "Return control" НО с обработкой в коде

---

Какой вариант предпочитаете? 🤔





