import { ref } from 'vue'
import { supabase, HOLIDAY_TABLE_NAME } from '../config/supabase'
import { isoToCn, enToCn } from '../utils/countryCodeMap'

export function useHolidays() {
  const holidaysByDay = ref({})
  const loading = ref(false)
  const error = ref('')
  const fetchProgress = ref('')

  // 将 ISO 代码转为中文显示名（优先用中文映射，否则显示 ISO 代码）
  const resolveCountryDisplay = (code) => {
    return isoToCn[code] || code
  }

  // 将 API 返回的英文国家名转为中文
  const resolveCountryName = (enName) => {
    if (enToCn[enName]) return enToCn[enName]
    if (isoToCn[enName]) return isoToCn[enName]
    return enName
  }

  // 调用 Nager.Date API 获取某国某年的公共假日
  const fetchFromAPI = async (countryCode, year) => {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`)
    if (!res.ok) throw new Error(`API 请求失败: ${countryCode}`)
    const data = await res.json()
    return data.map(h => ({
      date: h.date,
      name: h.localName || h.name,
      country: resolveCountryName(h.countryCode || enToCn[h.country] || h.country)
    }))
  }

  // 加载指定年月的节日数据（仅加载选中的国家）
  const loadHolidays = async (year, month, selectedCodes) => {
    loading.value = true
    error.value = ''
    fetchProgress.value = ''
    holidaysByDay.value = {}

    if (!selectedCodes || selectedCodes.length === 0) {
      loading.value = false
      return
    }

    try {
      // 1. 从 Supabase 查询已有数据（仅选中的国家）
      const { data: dbData, error: dbError } = await supabase
        .from(HOLIDAY_TABLE_NAME)
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .in('country_code', selectedCodes)

      if (dbError) throw dbError

      const existing = dbData || []
      const existingCountryCodes = new Set(existing.map(r => r.country_code))

      // 2. 找出缺失的国家（仅选中的国家中缺失的）
      const missingCodes = selectedCodes.filter(code => !existingCountryCodes.has(code))

      // 3. 从 API 获取缺失国家的数据并写入数据库
      const apiRecords = []
      if (missingCodes.length > 0) {
        for (let i = 0; i < missingCodes.length; i++) {
          const code = missingCodes[i]
          const displayName = resolveCountryDisplay(code)
          fetchProgress.value = `正在获取 ${displayName} 的节日数据 (${i + 1}/${missingCodes.length})...`

          try {
            const apiHolidays = await fetchFromAPI(code, year)
            for (const h of apiHolidays) {
              const dateParts = h.date.split('-')
              const hMonth = parseInt(dateParts[1], 10)
              const hDay = parseInt(dateParts[2], 10)
              if (hMonth === month) {
                apiRecords.push({
                  year,
                  month,
                  day: hDay,
                  country: h.country,
                  country_code: code,
                  name: h.name,
                  source: 'api'
                })
              }
            }
          } catch (e) {
            console.warn(`获取 ${displayName} (${code}) 节日失败:`, e)
          }

          // 速率限制：每次请求间隔 300ms
          if (i < missingCodes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        }

        // 4. 去重后批量写入数据库（防止 ON CONFLICT 同一行被影响两次）
        if (apiRecords.length > 0) {
          const deduped = []
          const seen = new Set()
          for (const r of apiRecords) {
            const key = `${r.year}-${r.month}-${r.day}-${r.country_code}`
            if (!seen.has(key)) {
              seen.add(key)
              deduped.push(r)
            }
          }
          const { error: insertError } = await supabase
            .from(HOLIDAY_TABLE_NAME)
            .upsert(deduped, { onConflict: 'year,month,day,country_code' })
          if (insertError) {
            console.warn('写入节日数据失败:', insertError)
          }
        }
      }

      // 5. 合并数据并按日期分组（按 day+country+name 去重）
      const allRecords = [...existing, ...apiRecords]
      const grouped = {}
      const seen = new Set()
      for (const r of allRecords) {
        const key = `${r.day}-${r.country}-${r.name}`
        if (seen.has(key)) continue
        seen.add(key)
        if (!grouped[r.day]) grouped[r.day] = []
        grouped[r.day].push({ country: r.country, name: r.name })
      }

      // 按国家名排序
      for (const day of Object.keys(grouped)) {
        grouped[day].sort((a, b) => a.country.localeCompare(b.country, 'zh'))
      }

      holidaysByDay.value = grouped
      fetchProgress.value = ''
    } catch (e) {
      console.error('加载节日数据失败:', e)
      error.value = '加载节日数据失败: ' + (e.message || e)
      fetchProgress.value = ''
    } finally {
      loading.value = false
    }
  }

  return { holidaysByDay, loading, error, fetchProgress, loadHolidays }
}
