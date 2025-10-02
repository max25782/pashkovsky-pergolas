import fs from 'fs'
import path from 'path'

const root = process.cwd()
const pergulotDir = path.join(root, 'public', 'images', 'pergulot')
const outFile = path.join(root, 'data', 'gallery', 'pergulot.json')

// Мультиязычные описания проектов
const projectsI18n = {
  ashdod: {
    title: { he: 'פרויקט אשדוד', ru: 'Проект Ашдод', en: 'Ashdod Project' },
    desc: { he: 'פרגולת אלומיניום מעוצבת במרפסת פרטית', ru: 'Дизайнерская алюминиевая пергола на частной террасе', en: 'Designer aluminum pergola on private terrace' }
  },
  ashkelon: {
    title: { he: 'פרויקט אשקלון', ru: 'Проект Ашкелон', en: 'Ashkelon Project' },
    desc: { he: 'פרגולת פרימיום עם תאורה משולבת', ru: 'Премиум-пергола со встроенным освещением', en: 'Premium pergola with integrated lighting' }
  },
  ashkelon2: {
    title: { he: 'פרויקט אשקלון 2', ru: 'Проект Ашкелон 2', en: 'Ashkelon Project 2' },
    desc: { he: 'פרגולה מודרנית לגינה', ru: 'Современная пергола для сада', en: 'Modern garden pergola' }
  },
  barkan: {
    title: { he: 'פרויקט ברקן', ru: 'Проект Баркан', en: 'Barkan Project' },
    desc: { he: 'פרגולה קומפקטית למרפסת קטנה', ru: 'Компактная пергола для небольшой террасы', en: 'Compact pergola for small terrace' }
  },
  beit_sefer: {
    title: { he: 'פרויקט בית ספר', ru: 'Проект школы', en: 'School Project' },
    desc: { he: 'פרגולה לחצר בית ספר', ru: 'Пергола для школьного двора', en: 'Pergola for school yard' }
  },
  beytar_elit: {
    title: { he: 'פרויקט ביתר עילית', ru: 'Проект Бейтар-Илит', en: 'Beitar Illit Project' },
    desc: { he: 'פרגולה משפחתית גדולה', ru: 'Большая семейная пергола', en: 'Large family pergola' }
  },
  eynav: {
    title: { he: 'פרויקט עינב', ru: 'Проект Эйнав', en: 'Eynav Project' },
    desc: { he: 'פרגולה יוקרתית למרפסת גג', ru: 'Роскошная пергола для террасы на крыше', en: 'Luxury rooftop pergola' }
  },
  hertzlia: {
    title: { he: 'פרויקט הרצליה', ru: 'Проект Герцлия', en: 'Herzliya Project' },
    desc: { he: 'פרגולה מינימליסטית בעיר', ru: 'Минималистичная пергола в городе', en: 'Minimalist city pergola' }
  },
  jerusalem: {
    title: { he: 'פרויקט ירושלים', ru: 'Проект Иерусалим', en: 'Jerusalem Project' },
    desc: { he: 'פרגולה קלאסית בסגנון ירושלמי', ru: 'Классическая пергола в иерусалимском стиле', en: 'Classic Jerusalem-style pergola' }
  },
  jerusalem2: {
    title: { he: 'פרויקט ירושלים 2', ru: 'Проект Иерусалим 2', en: 'Jerusalem Project 2' },
    desc: { he: 'פרגולה מודרנית בירושלים', ru: 'Современная пергола в Иерусалиме', en: 'Modern Jerusalem pergola' }
  },
  karney_shomron2: {
    title: { he: 'פרויקט כרני שומרון 2', ru: 'Проект Карней-Шомрон 2', en: 'Karnei Shomron 2 Project' },
    desc: { he: 'פרגולה גדולה לאירוח', ru: 'Большая пергола для приема гостей', en: 'Large entertaining pergola' }
  },
  karney_shomron3: {
    title: { he: 'פרויקט כרני שומרון 3', ru: 'Проект Карней-Шомрон 3', en: 'Karnei Shomron 3 Project' },
    desc: { he: 'פרגולה עם עיצוב מיוחד', ru: 'Пергола с особым дизайном', en: 'Specially designed pergola' }
  },
  karney_shomron4: {
    title: { he: 'פרויקט כרני שומרון 4', ru: 'Проект Карней-Шомрон 4', en: 'Karnei Shomron 4 Project' },
    desc: { he: 'פרגולה קומפקטית ומעוצבת', ru: 'Компактная дизайнерская пергола', en: 'Compact designer pergola' }
  },
  kdumim: {
    title: { he: 'פרויקט קדומים', ru: 'Проект Кдумим', en: 'Kedumim Project' },
    desc: { he: 'פרגולה למשפחה גדולה', ru: 'Пергола для большой семьи', en: 'Pergola for large family' }
  },
  kdumim2: {
    title: { he: 'פרויקט קדומים 2', ru: 'Проект Кдумим 2', en: 'Kedumim Project 2' },
    desc: { he: 'פרגולה עם הצללה מושלמת', ru: 'Пергола с идеальной тенью', en: 'Perfectly shaded pergola' }
  },
  kdumim3: {
    title: { he: 'פרויקט קדומים 3', ru: 'Проект Кдумим 3', en: 'Kedumim Project 3' },
    desc: { he: 'פרגולה מודרנית וגדולה', ru: 'Современная большая пергола', en: 'Modern large pergola' }
  },
  kerney_shomron: {
    title: { he: 'פרויקט כרני שומרון', ru: 'Проект Карней-Шомрон', en: 'Karnei Shomron Project' },
    desc: { he: 'פרגולה אלגנטית לבית פרטי', ru: 'Элегантная пергола для частного дома', en: 'Elegant private home pergola' }
  },
  kfar_yona: {
    title: { he: 'פרויקט כפר יונה', ru: 'Проект Кфар-Йона', en: 'Kfar Yona Project' },
    desc: { he: 'פרגולה גדולה עם פרטים מיוחדים', ru: 'Большая пергола с особыми деталями', en: 'Large pergola with special details' }
  },
  merkaz_asakim: {
    title: { he: 'מרכז עסקים', ru: 'Бизнес-центр', en: 'Business Center' },
    desc: { he: 'פרגולה מסחרית למרכז עסקים', ru: 'Коммерческая пергола для бизнес-центра', en: 'Commercial business center pergola' }
  },
  nes_tziona: {
    title: { he: 'פרויקט נס ציונה', ru: 'Проект Нес-Циона', en: 'Nes Ziona Project' },
    desc: { he: 'פרגולה במרפסת גג', ru: 'Пергола на террасе крыши', en: 'Rooftop terrace pergola' }
  },
  petah_tikva: {
    title: { he: 'פרויקט פתח תקווה', ru: 'Проект Петах-Тиква', en: 'Petah Tikva Project' },
    desc: { he: 'פרגולה עירונית מודרנית', ru: 'Современная городская пергола', en: 'Modern urban pergola' }
  },
  petah_tikva2: {
    title: { he: 'פרויקט פתח תקווה 2', ru: 'Проект Петах-Тиква 2', en: 'Petah Tikva Project 2' },
    desc: { he: 'פרגולה עם עיצוב ייחודי', ru: 'Пергола с уникальным дизайном', en: 'Uniquely designed pergola' }
  },
  revava: {
    title: { he: 'פרויקט רווחה', ru: 'Проект Ревава', en: 'Revava Project' },
    desc: { he: 'פרגולה למרפסת פרטית', ru: 'Пергола для частной террасы', en: 'Private terrace pergola' }
  },
  rishon: {
    title: { he: 'פרויקט ראשון לציון', ru: 'Проект Ришон-ле-Цион', en: 'Rishon LeZion Project' },
    desc: { he: 'פרגולה גדולה עם פרטי פרימיום', ru: 'Большая пергола с премиум-деталями', en: 'Large pergola with premium details' }
  },
  tel_mond: {
    title: { he: 'פרויקט תל מונד', ru: 'Проект Тель-Монд', en: 'Tel Mond Project' },
    desc: { he: 'פרגולה מעוצבת לגינה', ru: 'Дизайнерская садовая пергола', en: 'Designer garden pergola' }
  },
  yakir: {
    title: { he: 'פרויקט יקיר', ru: 'Проект Якир', en: 'Yakir Project' },
    desc: { he: 'פרגולה פרימיום עם פרטים מיוחדים', ru: 'Премиум-пергола с особыми деталями', en: 'Premium pergola with special details' }
  }
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
}

function isImageFile(file) {
  const ext = path.extname(file).toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
}

function build() {
  if (!fs.existsSync(pergulotDir)) {
    console.error('pergulot directory not found')
    return
  }

  const projects = []
  const dirs = listFiles(pergulotDir).filter(d => d.isDirectory())

  for (const dir of dirs) {
    const id = dir.name
    const projectDir = path.join(pergulotDir, id)
    const files = listFiles(projectDir).filter(f => f.isFile() && isImageFile(f.name))
    if (files.length === 0) continue

    // Prefer WebP when available
    const names = files.map(f => f.name)
    const webps = names.filter(n => n.toLowerCase().endsWith('.webp'))
    const chosen = webps.length > 0 ? webps : names
    const images = chosen.map(n => `/images/pergulot/${id}/${n}`)
    const i18n = projectsI18n[id] || {
      title: { he: id, ru: id, en: id },
      desc: { he: '', ru: '', en: '' }
    }

    projects.push({
      id,
      title: i18n.title,
      desc: i18n.desc,
      images
    })
  }

  // Sort by id
  projects.sort((a, b) => a.id.localeCompare(b.id))

  const dataDir = path.dirname(outFile)
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  fs.writeFileSync(outFile, JSON.stringify({ projects }, null, 2))
  console.log(`✓ Generated ${outFile} with ${projects.length} projects`)
}

build()

