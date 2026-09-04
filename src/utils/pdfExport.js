/**
 * 价格表 PDF 导出工具
 *
 * 采用「矢量文字 + 原生 JPEG 图片」方案（jspdf + jspdf-autotable）：
 *   - 英文统一内嵌 Arial 度量等价字体 Arimo，缺失时回退内置 helvetica；
 *   - 检测到中文时兜底内嵌 Noto Sans SC；
 *   - 产品图预下载后降采样为 JPEG（控制体积、保留清晰度，透明区填白防变黑）；
 *   - autoTable 自动分页、每页重复表头，行不跨页。
 *
 * 该模块只负责「拿到数据后如何生成并下载 PDF」，不关心数据来源与 UI 提示：
 *   - 数据由调用方通过 options.data 传入；
 *   - 下载进度通过 options.onProgress 回调上报；
 *   - 字体回退等非致命告警通过 options.onWarn 回调上报。
 */

// ========== 字体与图片预处理常量 ==========
const PDF_IMG_MAX_EDGE = 400      // 图片降采样最长边（px），控制体积同时保证清晰
const PDF_IMG_QUALITY = 0.88      // JPEG 编码质量
const ARIAL = 'Arial'             // jsPDF 中注册的英文字体家族名
const CJK_FONT_NAME = 'NotoSC'    // 中文兜底字体家族名
const fontCache = {}

/** 从 URL 获取图片 base64 Data URL，失败返回 null */
const fetchImageAsDataURL = async (url) => {
  if (!url) return null
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** 读取 public/ 下字体文件并转 base64（带缓存）；校验字体魔数，避免 SPA 回退把 index.html 当字体 */
const loadFontBase64 = async (path) => {
  if (fontCache[path]) return fontCache[path]
  const resp = await fetch(`${import.meta.env.BASE_URL}${path}`)
  if (!resp.ok) throw new Error('missing-font:' + path)
  const bytes = new Uint8Array(await resp.arrayBuffer())
  // 字体魔数：TrueType(00 01 00 00) / CFF('OTTO') / 'true' / 'typ1'；HTML 回退会以 '<' 开头，据此拦截
  const valid =
    (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
    (bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f) ||
    (bytes[0] === 0x74 && bytes[1] === 0x72 && bytes[2] === 0x75 && bytes[3] === 0x65) ||
    (bytes[0] === 0x74 && bytes[1] === 0x79 && bytes[2] === 0x70 && bytes[3] === 0x31)
  if (!valid) throw new Error('invalid-font:' + path)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
  }
  return (fontCache[path] = btoa(bin))
}

/** 内嵌 Arial 度量等价字体 Arimo，注册为家族名 'Arial'。
 *  优先静态 Regular/Bold（可得真实粗体）；缺失则回退可变字体（normal/bold 共用一份，粗体按默认字重、非真实加粗）。 */
const ensureArialFont = async (doc) => {
  const tryLoad = async (p) => { try { return await loadFontBase64(p) } catch { return null } }
  let reg = await tryLoad('fonts/Arimo-Regular.ttf')
  let bold = await tryLoad('fonts/Arimo-Bold.ttf')
  if (!reg || !bold) {
    const variable = await tryLoad('fonts/Arimo-VariableFont_wght.ttf')
    if (!variable) throw new Error('missing-font:Arimo')   // 静态与可变都缺失 → 触发 helvetica 回退
    reg = reg || variable
    bold = bold || variable
  }
  doc.addFileToVFS('Arimo-Regular.ttf', reg)
  doc.addFont('Arimo-Regular.ttf', ARIAL, 'normal')
  if (bold === reg) {
    doc.addFont('Arimo-Regular.ttf', ARIAL, 'bold')   // 复用同一 VFS，避免重复内嵌同一份字体
  } else {
    doc.addFileToVFS('Arimo-Bold.ttf', bold)
    doc.addFont('Arimo-Bold.ttf', ARIAL, 'bold')
  }
}

/** 仅当检测到中文时兜底内嵌 Noto Sans SC */
const ensureCjkFont = async (doc) => {
  const b64 = await loadFontBase64('fonts/NotoSansSC-Regular.ttf')
  doc.addFileToVFS('NotoSansSC-Regular.ttf', b64)
  doc.addFont('NotoSansSC-Regular.ttf', CJK_FONT_NAME, 'normal')
  doc.addFont('NotoSansSC-Regular.ttf', CJK_FONT_NAME, 'bold')
}

/** 将图片 Data URL 降采样为 JPEG（透明区填白防变黑），返回 { data, ratio } */
const downscaleToJpeg = (dataURL) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => {
    const w0 = img.naturalWidth || img.width
    const h0 = img.naturalHeight || img.height
    if (!w0 || !h0) return resolve(null)
    const s = Math.min(1, PDF_IMG_MAX_EDGE / Math.max(w0, h0))
    const cw = Math.max(1, Math.round(w0 * s))
    const ch = Math.max(1, Math.round(h0 * s))
    const c = document.createElement('canvas')
    c.width = cw
    c.height = ch
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cw, ch)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, cw, ch)
    resolve({ data: c.toDataURL('image/jpeg', PDF_IMG_QUALITY), ratio: cw / ch })
  }
  img.onerror = () => resolve(null)
  img.src = dataURL
})

/**
 * 生成并下载价格表 PDF。
 *
 * @param {Object}   options
 * @param {Array}    options.data             已映射好的表格数据（含 image_url 等字段）
 * @param {number}  [options.usdExchangeRate] USD 汇率（>0 时美元价 = ceil(工厂价 / 汇率)）
 * @param {number}  [options.rmbExchangeRate] RMB 汇率（>0 时人民币价 = ceil(美元价 * 汇率)）
 * @param {string}  [options.priceMode='usd'] 导出币种：'usd' | 'rmb'
 * @param {(loaded:number, total:number)=>void} [options.onProgress] 图片下载进度回调
 * @param {(msg:string)=>void} [options.onWarn] 非致命告警回调（如字体回退）
 * @returns {Promise<number>} 实际导出的数据条数
 */
export async function exportPriceListToPDF({
  data,
  usdExchangeRate = 0,
  rmbExchangeRate = 0,
  priceMode = 'usd',
  onProgress,
  onWarn
} = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ])

  const useUsdRate = usdExchangeRate > 0
  const useRmbRate = rmbExchangeRate > 0

  // 预下载图片（用于进度显示）
  const imageTasks = data
    .map((item, idx) => item.image_url ? { rowIndex: idx, url: item.image_url } : null)
    .filter(Boolean)
  const totalImages = imageTasks.length

  // 预下载图片并降采样为 JPEG（控制体积，保留清晰度；透明区填白防变黑）
  const imageDataMap = new Map()
  const CONCURRENCY = 5
  let completed = 0
  for (let i = 0; i < imageTasks.length; i += CONCURRENCY) {
    const batch = imageTasks.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async ({ rowIndex, url }) => {
      const dataURL = await fetchImageAsDataURL(url)
      if (dataURL) {
        const scaled = await downscaleToJpeg(dataURL)
        if (scaled) imageDataMap.set(rowIndex, scaled)
      }
      completed++
      onProgress?.(completed, totalImages)
    }))
  }

  // 组装表头与表体（图片列留空，由 autoTable 的 didDrawCell 叠加原生 JPEG）
  const fmtPrice = (v) => v != null ? Number(v).toLocaleString() : ''
  const isUSD = priceMode === 'usd'
  const priceSymbol = isUSD ? '$' : '¥'   // PDF价格列币种符号：USD用$，RMB用¥
  const IMG_COL = 2   // 图片列索引（0-based）

  const head = [[
    '#', 'Equipment Name', 'Equipment Images', 'Specification',
    `Price(${isUSD ? 'USD' : 'RMB'})`, 'Equipment Dimensions', 'Wooden frame dimensions',
    'Volume', 'Area', 'Standard configuration', 'Remarks', 'Game Instructions'
  ]]

  const body = data.map((item, idx) => {
    const usdPrice = isUSD ? (
      useUsdRate && item.factory_price
        ? Math.ceil(item.factory_price / usdExchangeRate)
        : item.price_usd
    ) : null
    const rmbPrice = !isUSD ? (
      useRmbRate && useUsdRate && item.factory_price
        ? Math.ceil(Math.ceil(item.factory_price / usdExchangeRate) * rmbExchangeRate)
        : item.price_rmb
    ) : null
    const priceVal = isUSD ? usdPrice : rmbPrice
    const priceText = priceVal != null ? `${priceSymbol} ${fmtPrice(priceVal)}` : ''
    return [
      idx + 1,
      item.equipment_name || '',
      '',
      item.specification || '',
      priceText,
      item.equipment_dimensions || '',
      item.wooden_frame_dimensions || '',
      item.volume || '',
      item.area || '',
      item.standard_configuration || '',
      item.remarks || '',
      item.game_instructions || ''
    ]
  })

  // 创建 A4 横向 PDF
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // 字体：英文统一用内嵌 Arial（Arimo 度量等价），缺失回退 helvetica；含中文时兜底
  let baseFont = 'helvetica'
  try {
    await ensureArialFont(doc)
    baseFont = ARIAL
  } catch {
    onWarn?.('未找到 Arial 字体（public/fonts/Arimo-Regular.ttf 与 Arimo-Bold.ttf），已回退内置 helvetica')
  }
  const CJK_RE = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/
  const hasCJK = data.some(it => CJK_RE.test(
    `${it.equipment_name} ${it.specification} ${it.remarks} ${it.standard_configuration} ${it.game_instructions} ${it.equipment_dimensions} ${it.wooden_frame_dimensions} ${it.volume} ${it.area}`
  ))
  let bodyFont = baseFont   // 表头/抬头/页码用 baseFont(Arial)；body 默认同，含中文时兜底
  if (hasCJK) {
    try {
      await ensureCjkFont(doc)
      bodyFont = CJK_FONT_NAME
    } catch {
      onWarn?.('检测到中文但缺少字体（public/fonts/NotoSansSC-Regular.ttf），中文可能显示异常')
    }
  }

  const pageW = doc.internal.pageSize.getWidth()   // 297mm
  const pageH = doc.internal.pageSize.getHeight()  // 210mm
  const marginX = 6

  // 首页品牌抬头（logo + 标题居中、联系信息、地址、日期）
  const logoH = 10  // logo 高度 mm
  const logoW = logoH * 1.5  // 15mm
  const gap = 4  // logo 与标题间距 mm
  doc.setFontSize(14)
  doc.setFont(baseFont, 'bold')
  const titleText = 'Qixun Technology Price List'
  const titleW = doc.getTextWidth(titleText)
  const groupW = logoW + gap + titleW
  const groupX = (pageW - groupW) / 2  // 整体居中起始 X

  try {
    const logoResp = await fetch(`${import.meta.env.BASE_URL}logo.png`)
    const logoBlob = await logoResp.blob()
    const logoBase64 = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(logoBlob)
    })
    doc.addImage(logoBase64, 'PNG', groupX, 3, logoW, logoH)
  } catch (e) { /* logo 加载失败时忽略 */ }
  doc.text(titleText, groupX + logoW + gap, 9)

  // 联系信息（标题下方，表格上方）
  doc.setFontSize(9)
  doc.setFont(baseFont, 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('WhatsApp: 008613049108027  WeChat: Qixun116688  Email: jadezeng0802@gmail.com', marginX, 15)
  doc.text('Add: Qixun Technology, GoldenShield Building, No.46, Shui Lian Avenue, Panyu District, Guangzhou City', marginX, 20)

  doc.setFontSize(8)
  doc.setFont(baseFont, 'normal')
  doc.setTextColor(130, 130, 130)
  doc.text(`Date: ${new Date().toISOString().split('T')[0]}`, pageW / 2, 25, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  // autoTable：矢量文字 + 原生图片，自动分页并每页重复表头
  autoTable(doc, {
    startY: 28,
    head,
    body,
    margin: { top: 12, right: marginX, bottom: 14, left: marginX },
    theme: 'grid',
    rowPageBreak: 'avoid',   // 行不跨页：整行放不下时整体移到下一页，宁可每页行数少
    styles: { font: bodyFont, fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', valign: 'middle' },
    headStyles: { font: baseFont, fontStyle: 'bold', fontSize: 9, halign: 'center', fillColor: [41, 128, 185], textColor: 255 },
    alternateRowStyles: { fillColor: [247, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 30, halign: 'center' },   // 图片列加宽，产品图展示更大
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 26 },
      6: { cellWidth: 30 },
      7: { cellWidth: 16 },
      8: { cellWidth: 15 },
      9: { cellWidth: 22 },
      10: { cellWidth: 28 },
      11: { cellWidth: 42 }
    }, // 合计 285mm
    didParseCell: (d) => {
      if (d.section !== 'body') return
      if (d.column.index === IMG_COL && imageDataMap.has(d.row.index)) d.cell.styles.minCellHeight = 22   // 抬高图片行，给产品图更多纵向空间
      if (d.column.index === 3 || d.column.index === 4) d.cell.styles.fontStyle = 'bold'
    },
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== IMG_COL) return
      const im = imageDataMap.get(d.row.index)
      if (!im) return
      const boxW = d.cell.width - 3, boxH = d.cell.height - 3   // 留 1.5mm padding
      let w = boxW, h = w / im.ratio
      if (h > boxH) { h = boxH; w = h * im.ratio }               // contain 等比缩放
      const x = d.cell.x + (d.cell.width - w) / 2
      const y = d.cell.y + (d.cell.height - h) / 2
      d.doc.addImage(im.data, 'JPEG', x, y, w, h, undefined, 'FAST')
    }
  })

  // 页码脚注（autoTable 完成后统一补）
  const n = doc.getNumberOfPages()
  for (let p = 1; p <= n; p++) {
    doc.setPage(p)
    doc.setFont(baseFont, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text(`Page ${p} / ${n}`, pageW / 2, pageH - 5, { align: 'center' })
  }
  doc.setTextColor(0, 0, 0)

  doc.save(`Qixun_PriceList_${new Date().toISOString().split('T')[0]}.pdf`)
  return data.length
}
