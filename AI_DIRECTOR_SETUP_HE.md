# 🎯 הגדרת AI Director - מדריך מהיר

## ✅ מה כבר מוכן:

- ✅ כל קוד ה-API מוכן
- ✅ מסד הנתונים מוגדר
- ✅ משתני הסביבה מוגדרים
- ✅ השרת רץ על `http://localhost:3001`
- ✅ תמיכה רב-לשונית (עברית, אנגלית, רוסית)

---

## 📋 מה צריך לעשות ב-AWS Console (10 דקות):

### 1️⃣ עדכון OpenAPI Schemas ל-5 Action Groups (5 דקות)

**קובץ:** `AI_DIRECTOR_OPENAPI_SCHEMAS.md`

עבור כל Action Group:
- `get_deals_data` - נתוני עסקאות
- `get_leads_data` - נתוני לידים
- `get_workers_data` - נתוני עובדים
- `get_analytics_data` - אנליטיקה
- `get_gallery_data` - גלריה ופרויקטים

**פעולות:**
1. פתח **AWS Bedrock Console** → **Agents** → הסוכן שלך → **Action Groups**
2. לכל Action Group לחץ **Edit**
3. העתק את ה-Schema מהקובץ `AI_DIRECTOR_OPENAPI_SCHEMAS.md`
4. החלף את `YOUR_DEPLOYED_URL` ב-ngrok URL שלך
5. לחץ **Save**

**שינוי חשוב:** נוסף `x-amazon-bedrock-session-attribute` להעברה אוטומטית של `company_id` ו-`api_token`.

---

### 2️⃣ עדכון System Prompt של הסוכן (2 דקות)

**קובץ:** `AI_DIRECTOR_MULTILINGUAL_PROMPT.md`

**פעולות:**
1. פתח **AWS Bedrock Console** → **Agents** → הסוכן שלך
2. לחץ **Edit**
3. בחלק **Instructions** העתק את ה-Prompt מהקובץ
4. לחץ **Save**

**שינוי חשוב:** נוספה הוראה לענות בשפת המשתמש (`$user_language$`).

---

### 3️⃣ המתן 1-2 דקות

AWS Bedrock מעדכן את תצורת הסוכן.

---

## 🧪 בדיקה:

לאחר העדכון, נסה בצ'אט AI Director:

### בעברית (המערכת שלך בעברית):
```
כמה עסקאות פתוחות יש לנו?
```

**תשובה צפויה:**
```
יש לכם 12 עסקאות פתוחות:
- 5 בשלב משא ומתן
- 4 בשלב חוזה
- 3 בשלב ייצור

המלצה: התמקדו ב-5 עסקאות המשא ומתן כדי להעביר אותן לחוזה השבוע.
```

---

### ברוסית:
```
Сколько у нас открытых сделок?
```

---

### באנגלית:
```
How many open deals do we have?
```

---

## ✅ תוצאה צפויה:

הסוכן צריך:

1. ✅ **לא לשאול** את `company_id` (נלקח אוטומטית)
2. ✅ **לענות באותה שפה** שבה כתבת
3. ✅ **להחזיר נתונים אמיתיים** מה-CRM
4. ✅ **לתת המלצות** על בסיס הנתונים

---

## 🔧 אם משהו לא עובד:

### בעיה 1: הסוכן שואל את company_id

**פתרון:** עדכן את OpenAPI Schemas (שלב 1️⃣)

---

### בעיה 2: הסוכן עונה לא בשפה הנכונה

**פתרון:** עדכן את System Prompt (שלב 2️⃣)

---

### בעיה 3: "Access Denied" או "not authorized"

**פתרון:** הוסף IAM policy ל-`bedrock:InvokeAgent`

1. AWS Console → IAM → Users → pashkovsky-s3
2. Permissions → Add permissions → Attach policies
3. חפש `AmazonBedrockFullAccess` או צור custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeAgent"],
      "Resource": "*"
    }
  ]
}
```

---

### בעיה 4: הסוכן לא יכול לקבל נתונים

**בדוק:**

1. ✅ ngrok עובד: `curl https://your-ngrok-url.ngrok-free.app/api/ai-director/data/deals`
2. ✅ השרת רץ: `npm run dev` ב-`apps/crm`
3. ✅ משתני הסביבה מוגדרים (כבר מוגדרים ✅)

---

## 📚 קבצי הוראות:

| קובץ | למה זה |
|------|--------|
| `AI_DIRECTOR_FINAL_SETUP_RU.md` | **הוראות ראשיות** (ברוסית) |
| `AI_DIRECTOR_OPENAPI_SCHEMAS.md` | Schemas ל-Action Groups |
| `AI_DIRECTOR_MULTILINGUAL_PROMPT.md` | System Prompt לסוכן |
| `AI_DIRECTOR_SETUP_HE.md` | **המדריך הזה** (בעברית) |
| `AI_DIRECTOR_ENV_CHECKLIST.md` | רשימת משתני סביבה |

---

## 🎯 השלבים הבאים:

1. ✅ עדכן OpenAPI Schemas (5 דקות)
2. ✅ עדכן System Prompt (2 דקות)
3. ✅ בדוק ב-3 שפות (3 דקות)
4. 🎉 **מוכן!**

---

## 💡 לאחר הפעלה מוצלחת:

- **פריסה ל-Vercel** (במקום ngrok)
- **הוספת שפות נוספות** (ערבית, סינית וכו')
- **הרחבת פונקציונליות** (יצירת משימות, שליחת התראות)

---

## 📞 צריך עזרה?

אם משהו לא עובד, הראה:

1. צילום מסך מ-AWS Bedrock Console (תצורת Action Group)
2. Logs מהטרמינל עם `npm run dev`
3. תשובת הסוכן בצ'אט

אני אעזור! 🚀

---

**בהצלחה! 🎉**





