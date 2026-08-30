import { ref, computed } from 'vue'
import { supabase, SOURCE_TABLE_NAME } from '../config/supabase'

/**
 * 来源选项管理 composable
 * 提供来源选项的加载、新增、编辑、删除功能
 */
export function useSourceOptions() {
  const sourceOptions = ref([])   // 完整对象列表（含 id, name, sortOrder, isGlobal）
  const sourceLoading = ref(false)

  // 仅名称列表，供 FilterBar / EditDialog 下拉框使用
  const sourceList = computed(() => sourceOptions.value.map(o => o.name))

  const fetchSourceOptions = async (userId) => {
    if (!supabase || !userId) return
    sourceLoading.value = true
    try {
      const { data, error } = await supabase
        .from(SOURCE_TABLE_NAME)
        .select('id, name, sort_order')
        .or(`is_global.eq.true,user_id.eq.${userId}`)
        .order('sort_order', { ascending: true })
      if (error) throw error
      sourceOptions.value = (data || []).map(r => ({
        id: r.id,
        name: r.name,
        sortOrder: r.sort_order || 0,
        isGlobal: r.is_global === true
      }))
    } catch (err) {
      console.error('加载来源选项失败:', err)
    } finally {
      sourceLoading.value = false
    }
  }

  return { sourceOptions, sourceList, sourceLoading, fetchSourceOptions }
}
