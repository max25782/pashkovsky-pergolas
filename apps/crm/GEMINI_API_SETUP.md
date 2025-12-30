# הגדרת Gemini API לשיפור טקסט עם AI

## 1️⃣ קבלת API Key

1. **היכנס ל-Google AI Studio:**
   - לך ל: https://aistudio.google.com/app/apikey
   - התחבר עם חשבון Google שלך

2. **צור API Key:**
   - לחץ על "Create API Key"
   - בחר פרויקט קיים או צור חדש
   - העתק את ה-API Key שנוצר

## 2️⃣ הוספת המפתח לפרויקט

פתח את הקובץ `apps/crm/.env.local` והוסף את השורה:

```bash
GEMINI_API_KEY=YOUR_API_KEY_HERE
```

**דוגמה:**
```bash
GEMINI_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 3️⃣ הפעלה מחדש של הסרבר

```bash
# עצור את הסרבר הנוכחי (Ctrl+C)
# הפעל מחדש:
cd apps/crm
npm run dev
```

## 4️⃣ בדיקה

1. פתח הצעת מחיר חדשה
2. כתוב טקסט בשדה "הערות נוספות"
3. לחץ על כפתור **"✨ AI שיפור"**
4. אמור לראות הצעת שיפור מ-AI!

---

## 📝 הערות

- **חינם:** Google Gemini מציע 1,500 בקשות בחינם ליום
- **מהירות:** התגובה לוקחת 1-3 שניות
- **שפה:** ה-AI מותאם לעברית ולטקסטים של פרגולות

## 🔒 אבטחה

- **אל תשתף** את ה-API Key באף מקום (GitHub, צ'אטים, וכו')
- הקובץ `.env.local` כבר במעקב `.gitignore` ולא יעלה ל-Git
- אם המפתח דלף - צור מפתח חדש מיד ב-Google AI Studio

## ❓ בעיות נפוצות

### "Gemini API key not configured"
הוסף את `GEMINI_API_KEY` ל-`.env.local` והפעל את הסרבר מחדש.

### "Failed to improve text"
- בדוק שה-API Key תקין
- בדוק חיבור לאינטרנט
- ייתכן שעברת את המכסה היומית (1,500 בקשות)

### הכפתור לא עובד
- וודא שכתבת טקסט בשדה "הערות"
- בדוק את הקונסולה בדפדפן (F12) לשגיאות

