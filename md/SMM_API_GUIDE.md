# API למנהל SMM - קבלת לידים מקמפיינים

## כתובת בסיסית

**אפשרות 1: נקודת קצה SMM מיוחדת (מומלץ)**
```
https://pashkovsky-group.com/api/smm/leads
```

**אפשרות 2: נקודת קצה admin כללית**
```
https://pashkovsky-group.com/admin-api/leads
```

## אימות

כל הבקשות דורשות טוקן הרשאה בכותרת:

**לנקודת קצה SMM:**
```
x-smm-token: הטוקן_שלך_SMM
```

**לנקודת קצה admin:**
```
x-admin-token: הטוקן_שלך_ADMIN
```

**איפה לקבל טוקן:**

**אפשרות 1: שימוש ב-ADMIN_TOKEN (פשוט יותר)**
- השתמש באותו טוקן שמשמש לכניסה לאדמין (`/he/admin/leads`)
- זה נותן גישה מלאה לכל הפונקציות

**אפשרות 2: יצירת SMM_TOKEN נפרד (מומלץ - בטוח יותר)**
- מנהל האתר צריך להוסיף משתנה סביבה חדש: `SMM_TOKEN`
- זה נותן גישה רק לקריאת לידים, ללא אפשרות לערוך או למחוק
- אם `SMM_TOKEN` לא מוגדר, המערכת תשתמש ב-`ADMIN_TOKEN` אוטומטית

**הערה:** פנה למנהל האתר לקבלת הטוקן המתאים

## פרמטרי בקשה

### פרמטרים עיקריים:
- `source` - סינון לפי מקור/קמפיין (ניתן להשתמש בכל ערך, למשל: facebook, facebook_spring_2025, instagram_summer_2025)
- `status` - סינון לפי סטטוס (pending, confirmed, contacted, qualified, won, lost)
- `start_date` - תאריך התחלה (פורמט: YYYY-MM-DD או ISO 8601)
- `end_date` - תאריך סיום (פורמט: YYYY-MM-DD או ISO 8601)
- `q` - חיפוש לפי שם, טלפון או הערות
- `limit` - מספר רשומות בעמוד (ברירת מחדל: 20)
- `offset` - היסט לדפדוף (ברירת מחדל: 0)

## דוגמאות שימוש

### 1. קבלת כל הלידים מקמפיין Facebook:
```bash
# שימוש בנקודת קצה SMM (מומלץ)
curl -H "x-smm-token: הטוקן_שלך_SMM" \
  "https://pashkovsky-group.com/api/smm/leads?source=facebook"

# או שימוש בנקודת קצה admin
curl -H "x-admin-token: הטוקן_שלך_ADMIN" \
  "https://pashkovsky-group.com/admin-api/leads?source=facebook"
```

### 2. קבלת לידים מ-Instagram בחודש האחרון:
```bash
curl -H "x-admin-token: הטוקן_שלך" \
  "https://pashkovsky-group.com/admin-api/leads?source=instagram&start_date=2025-01-01"
```

### 3. קבלת רק לידים חדשים (pending) מ-WhatsApp:
```bash
curl -H "x-admin-token: הטוקן_שלך" \
  "https://pashkovsky-group.com/admin-api/leads?source=whatsapp&status=pending"
```

### 4. קבלת לידים לתקופה מסוימת:
```bash
curl -H "x-admin-token: הטוקן_שלך" \
  "https://pashkovsky-group.com/admin-api/leads?start_date=2025-01-01&end_date=2025-01-31"
```

### 5. חיפוש לפי שם או טלפון:
```bash
curl -H "x-admin-token: הטוקן_שלך" \
  "https://pashkovsky-group.com/admin-api/leads?q=0544922927"
```

### 6. מסננים משולבים:
```bash
curl -H "x-admin-token: הטוקן_שלך" \
  "https://pashkovsky-group.com/admin-api/leads?source=facebook&status=qualified&start_date=2025-01-01&limit=50"
```

### 7. קבלת לידים מקמפיין ספציפי (עם שם מותאם):
```bash
# קבלת לידים מקמפיין Facebook ספציפי
curl -H "x-smm-token: הטוקן_שלך" \
  "https://pashkovsky-group.com/api/smm/leads?source=facebook_spring_2025"

# קבלת לידים מקמפיין Instagram ספציפי
curl -H "x-smm-token: הטוקן_שלך" \
  "https://pashkovsky-group.com/api/smm/leads?source=instagram_summer_2025"
```

## מקורות זמינים (source):

**ניתן להשתמש בכל ערך שרוצים** - המערכת תומכת בערכים מותאמים אישית לקמפיינים.

**דוגמאות:**
- `facebook` - קמפיין Facebook כללי
- `facebook_spring_2025` - קמפיין Facebook ספציפי
- `instagram_summer_2025` - קמפיין Instagram ספציפי
- `whatsapp` - קמפיינים WhatsApp
- `website` - אתר (ברירת מחדל)
- `phone` - שיחות טלפון
- כל ערך אחר שתרצו להשתמש בו לזיהוי קמפיין

**טיפ:** השתמשו בשמות תיאוריים לקמפיינים כדי להקל על סינון וניתוח מאוחר יותר.

## סטטוסים זמינים:
- `pending` - ליד חדש
- `confirmed` - אושר
- `contacted` - יצרו קשר
- `qualified` - מוכשר
- `won` - נוצח
- `lost` - הפסיד

## פורמט תשובה

**תשובת נקודת קצה SMM:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "שם הלקוח",
      "phone": "0544922927",
      "source": "facebook",
      "status": "pending",
      "notes": "עיר הלקוח",
      "created_at": "2025-01-21T14:33:35.91667+00:00"
    }
  ],
  "count": 1,
  "limit": 100,
  "offset": 0
}
```

**תשובת נקודת קצה admin:**
```json
[
  {
    "id": "uuid",
    "name": "שם הלקוח",
    "phone": "0544922927",
    "source": "facebook",
    "status": "pending",
    "notes": "עיר הלקוח",
    "created_at": "2025-01-21T14:33:35.91667+00:00"
  }
]
```

שגיאת הרשאה (401):
```json
"Unauthorized"
```

## שימוש ב-JavaScript/TypeScript

```javascript
const token = 'הטוקן_שלך_SMM';
const source = 'facebook'; // או קמפיין אחר

// שימוש בנקודת קצה SMM
fetch(`https://pashkovsky-group.com/api/smm/leads?source=${source}`, {
  headers: {
    'x-smm-token': token
  }
})
  .then(response => response.json())
  .then(result => {
    console.log('סה"כ:', result.count);
    console.log('לידים:', result.data);
  })
  .catch(error => console.error('שגיאה:', error));
```

## שימוש ב-Python

```python
import requests

token = 'הטוקן_שלך_SMM'
source = 'facebook'

# שימוש בנקודת קצה SMM
response = requests.get(
    'https://pashkovsky-group.com/api/smm/leads',
    headers={'x-smm-token': token},
    params={'source': source}
)

result = response.json()
print(f"סה\"כ לידים: {result['count']}")
for lead in result['data']:
    print(f"{lead['name']} - {lead['phone']}")
```

## הערות חשובות

1. **אבטחת טוקן**: לעולם אל תפרסם את הטוקן במאגרים ציבוריים או בקוד לקוח
2. **מגבלות**: כברירת מחדל מוחזרות 20 רשומות. השתמש ב-`limit` ו-`offset` לדפדוף
3. **תאריכים**: פורמט תאריך - ISO 8601 (YYYY-MM-DD או YYYY-MM-DDTHH:mm:ss)
4. **תיוג קמפיינים**: בעת יצירת לידים דרך טפסים, השתמש בפרמטר `source` לציון הקמפיין

## יצירת ליד חדש (Public Endpoint)

**כתובת:**
```
POST https://pashkovsky-group.com/api/leads
```

**אין צורך באימות** - זה endpoint ציבורי

**Body (JSON):**
```json
{
  "name": "John Doe",
  "phone": "+972501234567",
  "city": "Tel Aviv",
  "email": "john@example.com",
  "source": "facebook_spring_2025"
}
```

**שדות חובה:**
- `name` - שם הלקוח (חובה)
- `phone` - מספר טלפון (חובה)

**שדות אופציונליים:**
- `city` - עיר
- `email` - אימייל
- `source` - מקור/קמפיין (ברירת מחדל: "website")

**דוגמאות שימוש:**

```bash
# יצירת ליד מקמפיין Facebook
curl -X POST https://pashkovsky-group.com/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+972501234567",
    "city": "Tel Aviv",
    "source": "facebook_spring_2025"
  }'

# יצירת ליד מקמפיין Instagram
curl -X POST https://pashkovsky-group.com/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "phone": "+972509876543",
    "email": "jane@example.com",
    "source": "instagram_summer_2025"
  }'
```

**תשובה מוצלחת (200 OK):**
```
OK
```

**שגיאה (400 Bad Request):**
```json
{
  "error": "Missing required fields"
}
```

## קבלת לידים מקמפיינים (SMM Endpoint)

