import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function auth(req: NextRequest) {
  const token = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.ADMIN_TOKEN
  return !!expected && token === expected
}

const articlesPath = path.join(process.cwd(), 'public', 'data', 'articles.json')

export async function GET(req: NextRequest) {
  if (!auth(req)) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const data = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'))
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const article = await req.json()
    const data = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'))

    // Проверяем, существует ли статья с таким slug
    const existingIndex = data.articles.findIndex((a: any) => a.slug === article.slug)

    if (existingIndex >= 0) {
      // Обновляем существующую
      data.articles[existingIndex] = article
    } else {
      // Добавляем новую
      data.articles.push(article)
    }

    // Сохраняем в файл
    fs.writeFileSync(articlesPath, JSON.stringify(data, null, 2), 'utf-8')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving article:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
    }

    const data = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'))
    data.articles = data.articles.filter((a: any) => a.slug !== slug)

    fs.writeFileSync(articlesPath, JSON.stringify(data, null, 2), 'utf-8')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting article:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

