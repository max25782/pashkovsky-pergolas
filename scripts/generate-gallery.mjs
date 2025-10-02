import fs from 'fs'
import path from 'path'

const root = process.cwd()
const imagesRoot = path.join(root, 'public', 'images')
const outDir = path.join(root, 'data', 'gallery')

const imageExts = new Set(['.jpg','.jpeg','.png','.webp','.heic','.HEIC','.JPG','.PNG','.WEBP'])
const videoExts = new Set(['.mp4','.webm'])

function isMediaFile(file){
  const ext = path.extname(file)
  return imageExts.has(ext) || videoExts.has(ext)
}

function mediaType(file){
  const ext = path.extname(file).toLowerCase()
  return videoExts.has(ext) ? 'video' : 'image'
}

function listFiles(dir){
  return fs.readdirSync(dir, { withFileTypes: true })
}

function build(){
  const data = {
    fancy: [],
    mestor: [],
    rails: [],
    pergulot: [],
    dgamim: []
  }

  // simple categories
  for (const cat of ['fancy','mestor','rails']){
    const catDir = path.join(imagesRoot, cat)
    if (fs.existsSync(catDir)){
      const files = listFiles(catDir)
        .filter(d => d.isFile() && isMediaFile(d.name))
        .map(d => ({ src: `/images/${cat}/${d.name}`, type: mediaType(d.name) }))
      data[cat] = files
    }
  }

  // pergulot projects (subdirectories)
  const pergulotDir = path.join(imagesRoot, 'pergulot')
  if (fs.existsSync(pergulotDir)){
    const projects = listFiles(pergulotDir).filter(d => d.isDirectory())
    for (const proj of projects){
      const projDir = path.join(pergulotDir, proj.name)
      const media = listFiles(projDir)
        .filter(d => d.isFile() && isMediaFile(d.name))
        .map(d => ({ src: `/images/pergulot/${proj.name}/${d.name}`, type: mediaType(d.name) }))
      const cover = media.find(m => m.type === 'image')?.src || media[0]?.src || null
      data.pergulot.push({ slug: proj.name, title: proj.name, cover, media })
    }
    // sort by slug for stability
    data.pergulot.sort((a,b)=> a.slug.localeCompare(b.slug))
  }

  // dgamim categories: images/dgamim/[סוג]/[degem]/*.jpg
  const dgamimRoot = path.join(imagesRoot, 'dgamim')
  if (fs.existsSync(dgamimRoot)){
    const groups = listFiles(dgamimRoot).filter(d => d.isDirectory())
    for (const g of groups){
      const groupDir = path.join(dgamimRoot, g.name)
      const subDirs = listFiles(groupDir).filter(e => e.isDirectory())
      const directFiles = listFiles(groupDir).filter(e => e.isFile() && isMediaFile(e.name))

      // Case A: two-level structure dgamim/[type]/[degem]/*
      if (subDirs.length > 0){
        for (const d of subDirs){
          const degemDir = path.join(groupDir, d.name)
          const media = listFiles(degemDir)
            .filter(f => f.isFile() && isMediaFile(f.name))
            .map(f => `/images/dgamim/${g.name}/${d.name}/${f.name}`)
          if (media.length > 0){
            data.dgamim.push({ type: g.name, degem: d.name, images: media })
          }
        }
      }

      // Case B: one-level structure dgamim/[degem]/* (no explicit type)
      if (subDirs.length === 0 && directFiles.length > 0){
        const media = directFiles.map(f => `/images/dgamim/${g.name}/${f.name}`)
        data.dgamim.push({ type: 'default', degem: g.name, images: media })
      }
    }
  }

  // ensure data/gallery folder
  const dataDir = path.join(root, 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

  // write per-category files
  fs.writeFileSync(path.join(outDir, 'fancy.json'), JSON.stringify({ items: data.fancy }, null, 2))
  fs.writeFileSync(path.join(outDir, 'mestor.json'), JSON.stringify({ items: data.mestor }, null, 2))
  fs.writeFileSync(path.join(outDir, 'rails.json'), JSON.stringify({ items: data.rails }, null, 2))
  fs.writeFileSync(path.join(outDir, 'pergulot.json'), JSON.stringify({ projects: data.pergulot }, null, 2))
  fs.writeFileSync(path.join(outDir, 'dgamim.json'), JSON.stringify({ items: data.dgamim }, null, 2))
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({
    categories: [
      { key: 'fancy', count: data.fancy.length },
      { key: 'mestor', count: data.mestor.length },
      { key: 'rails', count: data.rails.length },
      { key: 'pergulot', count: data.pergulot.length },
      { key: 'dgamim', count: data.dgamim.length }
    ]
  }, null, 2))
  console.log(`Per-category JSON written to ${outDir}`)
}

build()


