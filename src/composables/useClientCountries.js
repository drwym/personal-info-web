import { ref } from 'vue'
import { supabase, TABLE_NAME } from '../config/supabase'
import { HOLIDAY_COUNTRY_CODES } from '../utils/countryCodeMap'

/**
 * 客户国家选项 composable
 * 提供当前用户客户信息表中去重后的国家（ISO 代码）列表，
 * 供节日日历设置默认展示的国家使用。
 */
export function useClientCountries() {
  const clientCountryCodes = ref([])   // 去重后的国家 ISO 代码列表

  const fetchClientCountries = async (userId) => {
    if (!supabase || !userId) return []
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('country')
        .eq('user_id', userId)
        .not('country', 'is', null)
      if (error) throw error

      const validCodes = new Set(HOLIDAY_COUNTRY_CODES)
      const set = new Set()
      ;(data || []).forEach(r => {
        const code = (r.country || '').trim().toUpperCase()
        // 仅保留节日功能支持的合法 ISO 代码
        if (code && validCodes.has(code)) set.add(code)
      })
      clientCountryCodes.value = Array.from(set)
    } catch (err) {
      console.error('加载客户国家失败:', err)
      clientCountryCodes.value = []
    }
    return clientCountryCodes.value
  }

  return { clientCountryCodes, fetchClientCountries }
}
