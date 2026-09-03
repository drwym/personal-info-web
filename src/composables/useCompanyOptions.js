import { ref } from 'vue'
import { supabase, TABLE_NAME } from '../config/supabase'

/**
 * 公司选项管理 composable
 * 提供当前用户已有公司名列表，供 EditDialog 公司下拉建议使用，
 * 减少同名公司因拼写差异拿到不同用户编码。
 */
export function useCompanyOptions() {
  const companyList = ref([])   // 去重后的公司名列表（升序）

  const fetchCompanyOptions = async (userId) => {
    if (!supabase || !userId) return
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('company')
        .eq('user_id', userId)
        .not('company', 'is', null)
        .order('company', { ascending: true })
      if (error) throw error
      const set = new Set()
      ;(data || []).forEach(r => {
        const c = (r.company || '').trim()
        if (c) set.add(c)
      })
      companyList.value = Array.from(set).sort((a, b) => a.localeCompare(b))
    } catch (err) {
      console.error('加载公司选项失败:', err)
    }
  }

  return { companyList, fetchCompanyOptions }
}
